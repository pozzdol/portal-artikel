package role

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// codeRE matches the roles.code CHECK constraint (^[a-z][a-z0-9_]*$).
var codeRE = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

// Service implements role CRUD and permission assignment.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	inv     rbac.Invalidator
}

// NewService returns a role Service.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, inv rbac.Invalidator) *Service {
	return &Service{pool: pool, auditor: auditor, inv: inv}
}

// List returns every role with its permissions and user count.
func (s *Service) List(ctx context.Context) ([]RoleDTO, error) {
	q := dbgen.New(s.pool)
	rows, err := q.ListRoles(ctx)
	if err != nil {
		return nil, fmt.Errorf("role: list: %w", err)
	}
	perms, err := q.ListAllRolePermissions(ctx)
	if err != nil {
		return nil, fmt.Errorf("role: list all permissions: %w", err)
	}
	byRole := make(map[int64][]string, len(rows))
	for _, p := range perms {
		byRole[p.RoleID] = append(byRole[p.RoleID], p.Code)
	}
	out := make([]RoleDTO, len(rows))
	for i, r := range rows {
		out[i] = RoleDTO{
			ID:          r.ID,
			Code:        r.Code,
			Name:        r.Name,
			Description: r.Description,
			IsSystem:    r.IsSystem,
			UserCount:   r.UserCount,
			Permissions: nonNil(byRole[r.ID]),
			CreatedAt:   httpx.FormatTime(r.CreatedAt),
		}
	}
	return out, nil
}

// Get returns one role by id, or apperr.NotFound.
func (s *Service) Get(ctx context.Context, id int64) (*RoleDTO, error) {
	q := dbgen.New(s.pool)
	r, err := q.GetRole(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound()
		}
		return nil, fmt.Errorf("role: get: %w", err)
	}
	codes, err := q.ListRolePermissionCodes(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("role: get permissions: %w", err)
	}
	count, err := q.CountRoleUsers(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("role: count users: %w", err)
	}
	return &RoleDTO{
		ID: r.ID, Code: r.Code, Name: r.Name, Description: r.Description,
		IsSystem: r.IsSystem, UserCount: count, Permissions: nonNil(codes),
		CreatedAt: httpx.FormatTime(r.CreatedAt),
	}, nil
}

// Create inserts a new role with its permission set. New roles have no users
// yet, so no cache invalidation is needed.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in CreateInput) (*RoleDTO, error) {
	if !codeRE.MatchString(in.Code) {
		return nil, apperr.Validation(map[string]string{
			"code": "Kode harus diawali huruf kecil dan hanya berisi huruf kecil, angka, atau garis bawah.",
		})
	}
	var out *RoleDTO
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		permIDs, err := resolvePermissionIDs(ctx, q, in.PermissionCodes)
		if err != nil {
			return err
		}
		created, err := q.CreateRole(ctx, dbgen.CreateRoleParams{
			Code: in.Code, Name: in.Name, Description: in.Description,
		})
		if err != nil {
			if constraint, ok := database.UniqueViolation(err); ok && constraint == "roles_code_key" {
				return apperr.Validation(map[string]string{"code": "Kode role sudah dipakai."})
			}
			return fmt.Errorf("role: create: %w", err)
		}
		if len(permIDs) > 0 {
			if err := q.AddRolePermissions(ctx, dbgen.AddRolePermissionsParams{
				RoleID: created.ID, PermissionIds: permIDs,
			}); err != nil {
				return fmt.Errorf("role: add permissions: %w", err)
			}
		}
		codes, err := q.ListRolePermissionCodes(ctx, created.ID)
		if err != nil {
			return fmt.Errorf("role: reload permissions: %w", err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityRole,
			EntityID: &created.ID, Summary: "Role dibuat: " + created.Name,
			Changes: map[string]any{"code": created.Code, "name": created.Name, "permission_codes": codes},
			IP:      meta.IP,
		}); err != nil {
			return fmt.Errorf("role: audit: %w", err)
		}
		out = &RoleDTO{
			ID: created.ID, Code: created.Code, Name: created.Name, Description: created.Description,
			IsSystem: created.IsSystem, UserCount: 0, Permissions: nonNil(codes),
			CreatedAt: httpx.FormatTime(created.CreatedAt),
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// Update replaces name, description and permission set, bumps perm_version
// for every user holding the role (inside the tx) and invalidates the whole
// permission cache after commit (§1.6).
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in UpdateInput) (*RoleDTO, error) {
	var out *RoleDTO
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		if _, err := q.GetRole(ctx, id); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("role: get for update: %w", err)
		}
		permIDs, err := resolvePermissionIDs(ctx, q, in.PermissionCodes)
		if err != nil {
			return err
		}
		updated, err := q.UpdateRole(ctx, dbgen.UpdateRoleParams{
			Name: in.Name, Description: in.Description, ID: id,
		})
		if err != nil {
			return fmt.Errorf("role: update: %w", err)
		}
		if err := q.DeleteRolePermissions(ctx, id); err != nil {
			return fmt.Errorf("role: clear permissions: %w", err)
		}
		if len(permIDs) > 0 {
			if err := q.AddRolePermissions(ctx, dbgen.AddRolePermissionsParams{
				RoleID: id, PermissionIds: permIDs,
			}); err != nil {
				return fmt.Errorf("role: add permissions: %w", err)
			}
		}
		if err := q.BumpPermVersionByRole(ctx, id); err != nil {
			return fmt.Errorf("role: bump perm version: %w", err)
		}
		codes, err := q.ListRolePermissionCodes(ctx, id)
		if err != nil {
			return fmt.Errorf("role: reload permissions: %w", err)
		}
		count, err := q.CountRoleUsers(ctx, id)
		if err != nil {
			return fmt.Errorf("role: count users: %w", err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityRole,
			EntityID: &id, Summary: "Role diperbarui: " + updated.Name,
			Changes: map[string]any{"name": updated.Name, "permission_codes": codes},
			IP:      meta.IP,
		}); err != nil {
			return fmt.Errorf("role: audit: %w", err)
		}
		out = &RoleDTO{
			ID: updated.ID, Code: updated.Code, Name: updated.Name, Description: updated.Description,
			IsSystem: updated.IsSystem, UserCount: count, Permissions: nonNil(codes),
			CreatedAt: httpx.FormatTime(updated.CreatedAt),
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.inv.InvalidateAll()
	return out, nil
}

// Delete removes a role. System roles and roles still assigned to users are
// rejected with 409 (§ Worker C2 rules).
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	return database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		r, err := q.GetRole(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperr.NotFound()
			}
			return fmt.Errorf("role: get for delete: %w", err)
		}
		if r.IsSystem {
			return apperr.Conflict("Role sistem tidak dapat dihapus.")
		}
		count, err := q.CountRoleUsers(ctx, id)
		if err != nil {
			return fmt.Errorf("role: count users: %w", err)
		}
		if count > 0 {
			return apperr.Conflict("Role masih dipakai oleh pengguna.")
		}
		if err := q.DeleteRolePermissions(ctx, id); err != nil {
			return fmt.Errorf("role: clear permissions: %w", err)
		}
		rows, err := q.DeleteRole(ctx, id)
		if err != nil {
			return fmt.Errorf("role: delete: %w", err)
		}
		if rows == 0 {
			return apperr.NotFound()
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityRole,
			EntityID: &id, Summary: "Role dihapus: " + r.Name, IP: meta.IP,
		})
	})
}

// ListPermissions returns the full permission catalog, ordered by code.
func (s *Service) ListPermissions(ctx context.Context) ([]dbgen.Permission, error) {
	q := dbgen.New(s.pool)
	perms, err := q.ListPermissions(ctx)
	if err != nil {
		return nil, fmt.Errorf("role: list permissions: %w", err)
	}
	return perms, nil
}

// resolvePermissionIDs looks up ids for codes, deduplicated, and fails with a
// 422 "permission_codes" field error listing any code that does not exist.
func resolvePermissionIDs(ctx context.Context, q *dbgen.Queries, codes []string) ([]int64, error) {
	if len(codes) == 0 {
		return nil, nil
	}
	unique := dedupe(codes)
	found, err := q.ListPermissionsByCodes(ctx, unique)
	if err != nil {
		return nil, fmt.Errorf("role: list permissions by codes: %w", err)
	}
	byCode := make(map[string]int64, len(found))
	for _, p := range found {
		byCode[p.Code] = p.ID
	}
	var missing []string
	ids := make([]int64, 0, len(unique))
	for _, c := range unique {
		id, ok := byCode[c]
		if !ok {
			missing = append(missing, c)
			continue
		}
		ids = append(ids, id)
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return nil, apperr.Validation(map[string]string{
			"permission_codes": "Kode permission tidak dikenal: " + strings.Join(missing, ", "),
		})
	}
	return ids, nil
}

func dedupe(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
