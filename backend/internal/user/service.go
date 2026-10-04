package user

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/db/seed"
	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/auth"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/revalidate"
)

// Service implements the users & authors domain (§1.11 of the Fase 2 plan).
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	inv     rbac.Invalidator
	reval   revalidate.Client
}

// NewService returns a Service backed by pool. A nil reval is treated as
// revalidate.Noop{}.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, inv rbac.Invalidator, reval revalidate.Client) *Service {
	if reval == nil {
		reval = revalidate.Noop{}
	}
	return &Service{pool: pool, auditor: auditor, inv: inv, reval: reval}
}

// userRow is the common shape shared by GetUserByIDRow, CreateUserRow and
// UpdateUserAdminRow (distinct sqlc-generated types with identical fields).
type userRow struct {
	ID            int64
	Email         *string
	DisplayName   string
	Slug          string
	Title         *string
	Bio           *string
	AvatarMediaID *int64
	CanLogin      bool
	IsActive      bool
	LastLoginAt   *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func fromGetUserByIDRow(r dbgen.GetUserByIDRow) userRow {
	return userRow{r.ID, r.Email, r.DisplayName, r.Slug, r.Title, r.Bio, r.AvatarMediaID, r.CanLogin, r.IsActive, r.LastLoginAt, r.CreatedAt, r.UpdatedAt}
}

func fromCreateUserRow(r dbgen.CreateUserRow) userRow {
	return userRow{r.ID, r.Email, r.DisplayName, r.Slug, r.Title, r.Bio, r.AvatarMediaID, r.CanLogin, r.IsActive, r.LastLoginAt, r.CreatedAt, r.UpdatedAt}
}

func fromUpdateUserAdminRow(r dbgen.UpdateUserAdminRow) userRow {
	return userRow{r.ID, r.Email, r.DisplayName, r.Slug, r.Title, r.Bio, r.AvatarMediaID, r.CanLogin, r.IsActive, r.LastLoginAt, r.CreatedAt, r.UpdatedAt}
}

func toRoleRefs(rows []dbgen.ListUserRolesRow) []RoleRef {
	out := make([]RoleRef, len(rows))
	for i, r := range rows {
		out[i] = RoleRef{ID: r.ID, Code: r.Code, Name: r.Name}
	}
	return out
}

func itemFromRow(r userRow, roles []RoleRef) UserItem {
	if roles == nil {
		roles = []RoleRef{}
	}
	return UserItem{
		ID:          r.ID,
		Email:       r.Email,
		DisplayName: r.DisplayName,
		Slug:        r.Slug,
		Title:       r.Title,
		CanLogin:    r.CanLogin,
		IsActive:    r.IsActive,
		LastLoginAt: httpx.FormatTimePtr(r.LastLoginAt),
		Roles:       roles,
		CreatedAt:   httpx.FormatTime(r.CreatedAt),
	}
}

func detailFromRow(r userRow, roles []RoleRef) *UserDetail {
	return &UserDetail{
		UserItem:      itemFromRow(r, roles),
		Bio:           r.Bio,
		AvatarMediaID: r.AvatarMediaID,
		UpdatedAt:     httpx.FormatTime(r.UpdatedAt),
	}
}

// loadRoles returns each id's roles, defaulting to an empty (never nil)
// slice for ids with none.
func loadRoles(ctx context.Context, q *dbgen.Queries, ids []int64) (map[int64][]RoleRef, error) {
	out := make(map[int64][]RoleRef, len(ids))
	for _, id := range ids {
		out[id] = []RoleRef{}
	}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.ListUserRolesByUserIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("user: list roles by user ids: %w", err)
	}
	for _, r := range rows {
		out[r.UserID] = append(out[r.UserID], RoleRef{ID: r.ID, Code: r.Code, Name: r.Name})
	}
	return out, nil
}

// List returns a filtered, paginated page of users. An authors.manage-only
// actor is forced to can_login=false regardless of the requested filter.
func (s *Service) List(ctx context.Context, a Actor, f ListFilter) ([]UserItem, int64, error) {
	if authorsOnly(a) {
		no := false
		f.CanLogin = &no
	}
	q := dbgen.New(s.pool)
	var qPtr, rolePtr *string
	if f.Q != "" {
		qPtr = &f.Q
	}
	if f.RoleCode != "" {
		rolePtr = &f.RoleCode
	}
	rows, err := q.ListUsers(ctx, dbgen.ListUsersParams{
		Q: qPtr, CanLogin: f.CanLogin, IsActive: f.IsActive, RoleCode: rolePtr,
		Offset: int32(f.Page.Offset), Limit: int32(f.Page.PerPage),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("user: list: %w", err)
	}
	total, err := q.CountUsersFiltered(ctx, dbgen.CountUsersFilteredParams{
		Q: qPtr, CanLogin: f.CanLogin, IsActive: f.IsActive, RoleCode: rolePtr,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("user: count: %w", err)
	}
	ids := make([]int64, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	rolesByUser, err := loadRoles(ctx, q, ids)
	if err != nil {
		return nil, 0, err
	}
	items := make([]UserItem, len(rows))
	for i, r := range rows {
		items[i] = itemFromRow(userRow{
			ID: r.ID, Email: r.Email, DisplayName: r.DisplayName, Slug: r.Slug, Title: r.Title,
			CanLogin: r.CanLogin, IsActive: r.IsActive, LastLoginAt: r.LastLoginAt, CreatedAt: r.CreatedAt,
		}, rolesByUser[r.ID])
	}
	return items, total, nil
}

// Get returns one user. An authors.manage-only actor gets 403 on a
// can_login=true target.
func (s *Service) Get(ctx context.Context, a Actor, id int64) (*UserDetail, error) {
	q := dbgen.New(s.pool)
	row, err := q.GetUserByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound()
	}
	if err != nil {
		return nil, fmt.Errorf("user: get: %w", err)
	}
	if authorsOnly(a) && row.CanLogin {
		return nil, apperr.Forbidden("")
	}
	roles, err := q.ListUserRoles(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("user: get roles: %w", err)
	}
	return detailFromRow(fromGetUserByIDRow(row), toRoleRefs(roles)), nil
}

// Create inserts a user. See CreateInput / UpdateInput docs for the
// author<->login and authors.manage rules.
func (s *Service) Create(ctx context.Context, a Actor, in CreateInput) (*UserDetail, error) {
	if authorsOnly(a) && (in.Email != nil || in.Password != nil || in.CanLogin || len(in.RoleIDs) > 0) {
		return nil, apperr.Forbidden("Aktor authors.manage hanya dapat membuat penulis tanpa akses login.")
	}
	if in.CanLogin && (in.Email == nil || in.Password == nil) {
		return nil, apperr.Validation(map[string]string{"password": "Wajib diisi untuk pengguna dengan akses login."})
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	var detail *UserDetail
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)

		roles, err := resolveRoles(ctx, q, in.RoleIDs)
		if err != nil {
			return err
		}

		var slug string
		if in.Slug != nil {
			if err := validateSlug(*in.Slug); err != nil {
				return err
			}
			if err := checkSlugAvailable(ctx, q, *in.Slug, 0); err != nil {
				return err
			}
			slug = *in.Slug
		} else {
			base := seed.Slugify(in.DisplayName)
			if base == "" {
				base = "pengguna"
			}
			if slug, err = autoSlug(ctx, q, base, 0); err != nil {
				return err
			}
		}

		var hash *string
		if in.Password != nil {
			h, err := auth.HashPassword(*in.Password)
			if err != nil {
				return fmt.Errorf("user: hash password: %w", err)
			}
			hash = &h
		}

		row, err := q.CreateUser(ctx, dbgen.CreateUserParams{
			Email: in.Email, PasswordHash: hash, DisplayName: in.DisplayName, Slug: slug,
			Title: in.Title, Bio: in.Bio, AvatarMediaID: in.AvatarMediaID,
			CanLogin: in.CanLogin, IsActive: isActive,
		})
		if err != nil {
			if c, ok := database.UniqueViolation(err); ok {
				return uniqueViolationErr(c)
			}
			if c, ok := database.ForeignKeyViolation(err); ok {
				return fkViolationErr(c)
			}
			return fmt.Errorf("user: create: %w", err)
		}

		roleIDs := make([]int64, len(roles))
		for i, ro := range roles {
			roleIDs[i] = ro.ID
		}
		if len(roleIDs) > 0 {
			if err := q.AddUserRoles(ctx, dbgen.AddUserRolesParams{UserID: row.ID, RoleIds: roleIDs}); err != nil {
				return fmt.Errorf("user: add roles: %w", err)
			}
		}

		changes := map[string]any{"display_name": in.DisplayName, "can_login": in.CanLogin, "is_active": isActive}
		if in.Email != nil {
			changes["email"] = *in.Email
		}
		if len(in.RoleIDs) > 0 {
			changes["role_ids"] = in.RoleIDs
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: a.Meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityUser,
			EntityID: &row.ID, Summary: fmt.Sprintf("Membuat pengguna %q.", in.DisplayName),
			Changes: changes, IP: a.Meta.IP,
		}); err != nil {
			return err
		}

		createdRoles, err := q.ListUserRoles(ctx, row.ID)
		if err != nil {
			return fmt.Errorf("user: created roles: %w", err)
		}
		detail = detailFromRow(fromCreateUserRow(row), toRoleRefs(createdRoles))
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.Author(detail.Slug), revalidate.TagHomepage, revalidate.TagSitemap)
	return detail, nil
}

// Update applies a full replace of the writable fields present in in (nil
// pointers / nil RoleIDs leave the current value unchanged). See §1.11.
func (s *Service) Update(ctx context.Context, a Actor, id int64, in UpdateInput) (*UserDetail, error) {
	changingRoles := in.RoleIDs != nil
	changingCanLogin := in.CanLogin != nil
	changingActive := in.IsActive != nil
	if err := selfProtection(a, id, changingRoles, changingCanLogin, changingActive); err != nil {
		return nil, err
	}
	restrictedActor := authorsOnly(a)

	var detail *UserDetail
	var invalidate bool
	var oldSlug string
	var profileChanged bool
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		current, err := q.GetUserByID(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.NotFound()
		}
		if err != nil {
			return fmt.Errorf("user: get for update: %w", err)
		}
		oldSlug = current.Slug

		if restrictedActor {
			if current.CanLogin {
				return apperr.Forbidden("Aktor authors.manage hanya dapat mengelola penulis tanpa akses login.")
			}
			if in.Email != nil || in.Password != nil || (in.CanLogin != nil && *in.CanLogin) || in.RoleIDs != nil {
				return apperr.Forbidden("Aktor authors.manage tidak dapat mengubah email, kata sandi, akses login, atau peran.")
			}
		}

		currentRoles, err := q.ListUserRoles(ctx, id)
		if err != nil {
			return fmt.Errorf("user: current roles: %w", err)
		}
		hadSuperAdmin := containsRoleCode(currentRoles, rbac.RoleSuperAdmin)
		wasActiveSuperAdmin := current.IsActive && current.CanLogin && hadSuperAdmin

		newCanLogin := current.CanLogin
		if in.CanLogin != nil {
			newCanLogin = *in.CanLogin
		}
		newActive := current.IsActive
		if in.IsActive != nil {
			newActive = *in.IsActive
		}
		convertingToAuthor := current.CanLogin && !newCanLogin
		convertingToLogin := !current.CanLogin && newCanLogin

		var newRoles []dbgen.Role
		willHaveSuperAdmin := hadSuperAdmin
		if changingRoles && !convertingToAuthor {
			newRoles, err = resolveRoles(ctx, q, in.RoleIDs)
			if err != nil {
				return err
			}
			willHaveSuperAdmin = false
			for _, r := range newRoles {
				if r.Code == rbac.RoleSuperAdmin {
					willHaveSuperAdmin = true
					break
				}
			}
		} else if convertingToAuthor {
			willHaveSuperAdmin = false
		}

		willRemainActiveSuperAdmin := newActive && newCanLogin && willHaveSuperAdmin
		if err := lastSuperAdmin(ctx, q, id, wasActiveSuperAdmin, willRemainActiveSuperAdmin); err != nil {
			return err
		}

		newEmail := current.Email
		if in.Email != nil {
			newEmail = in.Email
		}
		if convertingToLogin {
			if in.Password == nil {
				return apperr.Validation(map[string]string{"password": "Wajib diisi saat mengaktifkan akses login."})
			}
			if newEmail == nil {
				return apperr.Validation(map[string]string{"email": "Wajib diisi saat mengaktifkan akses login."})
			}
		}

		if in.Password != nil && !convertingToAuthor {
			h, err := auth.HashPassword(*in.Password)
			if err != nil {
				return fmt.Errorf("user: hash password: %w", err)
			}
			if err := q.UpdateUserPassword(ctx, dbgen.UpdateUserPasswordParams{PasswordHash: &h, ID: id}); err != nil {
				return fmt.Errorf("user: update password: %w", err)
			}
		}

		if convertingToAuthor {
			if err := q.ClearUserCredentials(ctx, id); err != nil {
				return fmt.Errorf("user: clear credentials: %w", err)
			}
			if err := q.DeleteUserRoles(ctx, id); err != nil {
				return fmt.Errorf("user: clear roles: %w", err)
			}
			if _, err := q.RevokeAllUserRefreshTokens(ctx, id); err != nil {
				return fmt.Errorf("user: revoke sessions: %w", err)
			}
			newEmail = nil
			newCanLogin = false
		} else if changingRoles {
			if err := q.DeleteUserRoles(ctx, id); err != nil {
				return fmt.Errorf("user: replace roles: %w", err)
			}
			if len(newRoles) > 0 {
				ids := make([]int64, len(newRoles))
				for i, r := range newRoles {
					ids[i] = r.ID
				}
				if err := q.AddUserRoles(ctx, dbgen.AddUserRolesParams{UserID: id, RoleIds: ids}); err != nil {
					return fmt.Errorf("user: replace roles: %w", err)
				}
			}
		}

		newSlug := current.Slug
		if in.Slug != nil {
			if err := validateSlug(*in.Slug); err != nil {
				return err
			}
			if err := checkSlugAvailable(ctx, q, *in.Slug, id); err != nil {
				return err
			}
			newSlug = *in.Slug
		}
		newTitle := current.Title
		if in.Title != nil {
			newTitle = in.Title
		}
		newBio := current.Bio
		if in.Bio != nil {
			newBio = in.Bio
		}
		newAvatar := current.AvatarMediaID
		if in.AvatarMediaID != nil {
			newAvatar = in.AvatarMediaID
		}

		row, err := q.UpdateUserAdmin(ctx, dbgen.UpdateUserAdminParams{
			Email: newEmail, DisplayName: in.DisplayName, Slug: newSlug, Title: newTitle, Bio: newBio,
			AvatarMediaID: newAvatar, CanLogin: newCanLogin, IsActive: newActive, ID: id,
		})
		if err != nil {
			if c, ok := database.UniqueViolation(err); ok {
				return uniqueViolationErr(c)
			}
			if c, ok := database.ForeignKeyViolation(err); ok {
				return fkViolationErr(c)
			}
			return fmt.Errorf("user: update: %w", err)
		}

		roleChanged := changingRoles || convertingToAuthor
		if roleChanged {
			if _, err := q.BumpUserPermVersion(ctx, id); err != nil {
				return fmt.Errorf("user: bump perm version: %w", err)
			}
		}
		invalidate = roleChanged || changingCanLogin || changingActive

		updatedRoles, err := q.ListUserRoles(ctx, id)
		if err != nil {
			return fmt.Errorf("user: updated roles: %w", err)
		}

		changes := map[string]any{}
		if in.DisplayName != current.DisplayName {
			changes["display_name"] = in.DisplayName
		}
		if in.Email != nil {
			changes["email"] = in.Email
		}
		if in.Slug != nil {
			changes["slug"] = newSlug
		}
		if in.Title != nil {
			changes["title"] = in.Title
		}
		if in.Bio != nil {
			changes["bio"] = in.Bio
		}
		if in.AvatarMediaID != nil {
			changes["avatar_media_id"] = in.AvatarMediaID
		}
		if in.CanLogin != nil {
			changes["can_login"] = *in.CanLogin
		}
		if in.IsActive != nil {
			changes["is_active"] = *in.IsActive
		}
		if in.RoleIDs != nil {
			changes["role_ids"] = in.RoleIDs
		}
		profileChanged = in.DisplayName != current.DisplayName || in.Slug != nil ||
			in.Title != nil || in.Bio != nil || in.AvatarMediaID != nil || changingActive
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: a.Meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityUser,
			EntityID: &id, Summary: fmt.Sprintf("Memperbarui pengguna %q.", in.DisplayName),
			Changes: changes, IP: a.Meta.IP,
		}); err != nil {
			return err
		}

		detail = detailFromRow(fromUpdateUserAdminRow(row), toRoleRefs(updatedRoles))
		return nil
	})
	if err != nil {
		return nil, err
	}
	if invalidate {
		s.inv.Invalidate(id)
	}
	if profileChanged {
		tags := []string{revalidate.Author(detail.Slug), revalidate.TagHomepage, revalidate.TagSitemap}
		if oldSlug != detail.Slug {
			tags = append(tags, revalidate.Author(oldSlug))
		}
		s.reval.Enqueue(tags...)
	}
	return detail, nil
}

// ResetPassword sets a new password for a login-capable user (users.manage
// only) and revokes all of their refresh token families.
func (s *Service) ResetPassword(ctx context.Context, a Actor, id int64, in ResetPasswordInput) error {
	return database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		row, err := q.GetUserByID(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.NotFound()
		}
		if err != nil {
			return fmt.Errorf("user: get for reset password: %w", err)
		}
		if !row.CanLogin {
			return apperr.Conflict("Pengguna ini tidak memiliki akses login.")
		}
		hash, err := auth.HashPassword(in.NewPassword)
		if err != nil {
			return fmt.Errorf("user: hash password: %w", err)
		}
		if err := q.UpdateUserPassword(ctx, dbgen.UpdateUserPasswordParams{PasswordHash: &hash, ID: id}); err != nil {
			return fmt.Errorf("user: reset password: %w", err)
		}
		if _, err := q.RevokeAllUserRefreshTokens(ctx, id); err != nil {
			return fmt.Errorf("user: revoke sessions: %w", err)
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: a.Meta.UserID, Action: audit.ActionPasswordReset, EntityType: audit.EntityUser,
			EntityID: &id, Summary: "Reset kata sandi pengguna oleh admin.", IP: a.Meta.IP,
		})
	})
}

// SetActive activates or deactivates a user (users.manage only). Self-
// deactivation and demoting the last active super admin are rejected (409).
// Deactivation revokes all refresh token families.
func (s *Service) SetActive(ctx context.Context, a Actor, id int64, active bool) error {
	if a.UserID == id && !active {
		return apperr.Conflict("Anda tidak dapat menonaktifkan akun sendiri.")
	}
	changed := false
	var slug string
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		row, err := q.GetUserByID(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.NotFound()
		}
		if err != nil {
			return fmt.Errorf("user: get for set-active: %w", err)
		}
		slug = row.Slug
		if row.IsActive == active {
			return nil
		}
		if !active {
			roles, err := q.ListUserRoles(ctx, id)
			if err != nil {
				return fmt.Errorf("user: roles for set-active: %w", err)
			}
			wasActiveSuperAdmin := row.IsActive && row.CanLogin && containsRoleCode(roles, rbac.RoleSuperAdmin)
			if err := lastSuperAdmin(ctx, q, id, wasActiveSuperAdmin, false); err != nil {
				return err
			}
		}
		if err := q.SetUserActive(ctx, dbgen.SetUserActiveParams{IsActive: active, ID: id}); err != nil {
			return fmt.Errorf("user: set active: %w", err)
		}
		if !active {
			if _, err := q.RevokeAllUserRefreshTokens(ctx, id); err != nil {
				return fmt.Errorf("user: revoke sessions: %w", err)
			}
		}
		action, summary := audit.ActionActivate, "Mengaktifkan pengguna."
		if !active {
			action, summary = audit.ActionDeactivate, "Menonaktifkan pengguna."
		}
		changed = true
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: a.Meta.UserID, Action: action, EntityType: audit.EntityUser,
			EntityID: &id, Summary: summary, IP: a.Meta.IP,
		})
	})
	if err != nil {
		return err
	}
	if changed {
		s.inv.Invalidate(id)
		s.reval.Enqueue(revalidate.Author(slug), revalidate.TagHomepage, revalidate.TagSitemap)
	}
	return nil
}

// ListAuthors returns active users (login-capable or not) for the article
// authorship dropdown.
func (s *Service) ListAuthors(ctx context.Context) ([]AuthorOption, error) {
	q := dbgen.New(s.pool)
	rows, err := q.ListAuthors(ctx)
	if err != nil {
		return nil, fmt.Errorf("user: list authors: %w", err)
	}
	out := make([]AuthorOption, len(rows))
	for i, r := range rows {
		out[i] = AuthorOption{ID: r.ID, DisplayName: r.DisplayName, Title: r.Title, Slug: r.Slug}
	}
	return out, nil
}
