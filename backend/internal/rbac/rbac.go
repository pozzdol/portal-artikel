// Package rbac holds permission constants, permission sets and the
// request-context plumbing used by the permission guard.
package rbac

import (
	"context"
	"net/http"
	"sort"
)

// Permission codes (seeded by 00010_seed_rbac.sql).
const (
	PermDashboardView     = "dashboard.view"
	PermArticlesRead      = "articles.read"
	PermArticlesCreate    = "articles.create"
	PermArticlesUpdate    = "articles.update"
	PermArticlesDelete    = "articles.delete"
	PermArticlesPublish   = "articles.publish"
	PermArticlesUpdateAny = "articles.update_any"
	PermCategoriesManage  = "categories.manage"
	PermTagsManage        = "tags.manage"
	PermMediaManage       = "media.manage"
	PermEventsManage      = "events.manage"
	PermAlumniManage      = "alumni.manage"
	PermVideosManage      = "videos.manage"
	PermPagesManage       = "pages.manage"
	PermSnippetsManage    = "snippets.manage"
	PermHomepageManage    = "homepage.manage"
	PermMenusManage       = "menus.manage"
	PermAuthorsManage     = "authors.manage"
	PermSettingsManage    = "settings.manage"
	PermUsersManage       = "users.manage"
	PermRolesManage       = "roles.manage"
	PermAuditView         = "audit.view"
)

// AllPermissions lists every seeded permission code, sorted.
var AllPermissions = []string{
	PermAlumniManage, PermArticlesCreate, PermArticlesDelete, PermArticlesPublish,
	PermArticlesRead, PermArticlesUpdate, PermArticlesUpdateAny, PermAuditView,
	PermAuthorsManage, PermCategoriesManage, PermDashboardView, PermEventsManage,
	PermHomepageManage, PermMediaManage, PermMenusManage, PermPagesManage,
	PermRolesManage, PermSettingsManage, PermSnippetsManage, PermTagsManage,
	PermUsersManage, PermVideosManage,
}

// System role codes.
const (
	RoleSuperAdmin = "super_admin"
	RoleAdmin      = "admin"
)

// Set is a set of permission codes.
type Set map[string]struct{}

// NewSet builds a Set from codes.
func NewSet(codes ...string) Set {
	s := make(Set, len(codes))
	for _, c := range codes {
		s[c] = struct{}{}
	}
	return s
}

// Has reports whether code is in the set.
func (s Set) Has(code string) bool {
	_, ok := s[code]
	return ok
}

// HasAny reports whether at least one of codes is in the set.
func (s Set) HasAny(codes ...string) bool {
	for _, c := range codes {
		if s.Has(c) {
			return true
		}
	}
	return false
}

// Codes returns the codes sorted ascending (never nil).
func (s Set) Codes() []string {
	out := make([]string, 0, len(s))
	for c := range s {
		out = append(out, c)
	}
	sort.Strings(out)
	return out
}

// Guard builds a middleware that requires ANY of codes.
type Guard func(codes ...string) func(http.Handler) http.Handler

// Invalidator drops cached permission data after role/status changes.
type Invalidator interface {
	Invalidate(userID int64)
	InvalidateAll()
}

type permsKey struct{}

// WithPermissions stores the caller's effective permissions in ctx.
func WithPermissions(ctx context.Context, s Set) context.Context {
	return context.WithValue(ctx, permsKey{}, s)
}

// PermissionsFromContext returns the permissions stored by WithPermissions,
// or an empty set (never nil).
func PermissionsFromContext(ctx context.Context) Set {
	if s, ok := ctx.Value(permsKey{}).(Set); ok && s != nil {
		return s
	}
	return Set{}
}
