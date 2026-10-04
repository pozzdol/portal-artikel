package user

import (
	"context"
	"errors"
	"fmt"
	"regexp"

	"github.com/jackc/pgx/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/rbac"
)

// slugPattern mirrors the users.slug CHECK constraint
// (db/migrations/00002_auth_rbac.sql).
var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

const maxSlugLen = 160

// validateSlug rejects a client-supplied slug that would fail the DB CHECK,
// so the error surfaces as a 422 instead of a generic 500 from the driver.
func validateSlug(slug string) error {
	if slug == "" || len(slug) > maxSlugLen || !slugPattern.MatchString(slug) {
		return apperr.Validation(map[string]string{"slug": "Format slug tidak valid."})
	}
	return nil
}

// checkSlugAvailable errors 422 slug when a different user already holds
// slug. Used for a client-supplied slug: unlike autoSlug it never silently
// substitutes a suffixed variant, since the client asked for this exact
// value. excludeID lets an update treat the target's own current slug as
// free (pass 0 on create, where no id can match).
func checkSlugAvailable(ctx context.Context, q *dbgen.Queries, slug string, excludeID int64) error {
	row, err := q.GetUserBySlug(ctx, slug)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return nil
	case err != nil:
		return fmt.Errorf("user: check slug: %w", err)
	case row.ID == excludeID:
		return nil
	default:
		return apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
	}
}

// autoSlug returns base if it is free, else base-2, base-3, ... It runs
// against q (pool- or tx-scoped) so callers can use it inside a transaction.
// Used only for a slug derived from display_name (never for a
// client-supplied one; see checkSlugAvailable). excludeID lets an update
// treat the target's own current slug as free (pass 0 on create, where no id
// can match).
func autoSlug(ctx context.Context, q *dbgen.Queries, base string, excludeID int64) (string, error) {
	for n := 1; n <= 50; n++ {
		candidate := base
		if n > 1 {
			candidate = fmt.Sprintf("%s-%d", base, n)
		}
		row, err := q.GetUserBySlug(ctx, candidate)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return candidate, nil
		case err != nil:
			return "", fmt.Errorf("user: check slug: %w", err)
		case row.ID == excludeID:
			return candidate, nil
		}
	}
	return "", apperr.Conflict("Tidak dapat membuat slug unik untuk nama ini.")
}

// authorsOnly reports whether the actor may only manage can_login=false
// authors: they hold authors.manage but not users.manage (§1.11).
func authorsOnly(a Actor) bool {
	return !a.Perms.Has(rbac.PermUsersManage) && a.Perms.Has(rbac.PermAuthorsManage)
}

// selfProtection rejects an actor changing their own role_ids, can_login or
// is_active (§1.11). Call before any write.
func selfProtection(a Actor, targetID int64, changingRoles, changingCanLogin, changingActive bool) error {
	if a.UserID != targetID {
		return nil
	}
	if changingRoles || changingCanLogin || changingActive {
		return apperr.Conflict("Anda tidak dapat mengubah peran, akses login, atau status aktif akun sendiri.")
	}
	return nil
}

// lastSuperAdmin rejects a change that would leave no active super admin.
// wasActiveSuperAdmin/willRemainActiveSuperAdmin are computed by the caller
// from the target's current and pending is_active/can_login/role state.
func lastSuperAdmin(ctx context.Context, q *dbgen.Queries, targetID int64, wasActiveSuperAdmin, willRemainActiveSuperAdmin bool) error {
	if !wasActiveSuperAdmin || willRemainActiveSuperAdmin {
		return nil
	}
	n, err := q.CountActiveSuperAdminsExcept(ctx, targetID)
	if err != nil {
		return fmt.Errorf("user: count active super admins: %w", err)
	}
	if n == 0 {
		return apperr.Conflict("Minimal satu super admin aktif harus tetap ada.")
	}
	return nil
}

// containsRoleCode reports whether roles includes code.
func containsRoleCode(roles []dbgen.ListUserRolesRow, code string) bool {
	for _, r := range roles {
		if r.Code == code {
			return true
		}
	}
	return false
}

// uniqueInt64 returns ids with duplicates removed, order not preserved.
func uniqueInt64(ids []int64) []int64 {
	seen := make(map[int64]struct{}, len(ids))
	out := make([]int64, 0, len(ids))
	for _, id := range ids {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// resolveRoles validates ids against the roles table and returns them in
// full, erroring 422 role_ids when any id is unknown.
func resolveRoles(ctx context.Context, q *dbgen.Queries, ids []int64) ([]dbgen.Role, error) {
	unique := uniqueInt64(ids)
	if len(unique) == 0 {
		return nil, nil
	}
	roles, err := q.ListRolesByIDs(ctx, unique)
	if err != nil {
		return nil, fmt.Errorf("user: resolve role_ids: %w", err)
	}
	if len(roles) != len(unique) {
		return nil, apperr.Validation(map[string]string{"role_ids": "Salah satu role tidak ditemukan."})
	}
	return roles, nil
}

// uniqueViolationErr maps a unique-constraint name to a 422 field error.
func uniqueViolationErr(constraint string) error {
	switch constraint {
	case "users_email_key":
		return apperr.Validation(map[string]string{"email": "Email sudah terdaftar."})
	case "users_slug_key":
		return apperr.Validation(map[string]string{"slug": "Slug sudah dipakai."})
	default:
		return apperr.Conflict("Data bentrok dengan data yang sudah ada.")
	}
}

// fkViolationErr maps a foreign-key constraint name to a 422 field error.
func fkViolationErr(constraint string) error {
	switch constraint {
	case "users_avatar_media_id_fkey":
		return apperr.Validation(map[string]string{"avatar_media_id": "Media tidak ditemukan."})
	default:
		return apperr.BadRequest("")
	}
}
