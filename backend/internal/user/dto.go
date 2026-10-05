// Package user implements the admin "users & authors" domain: listing,
// creating and updating users (both login-capable staff and non-login
// authors), password resets, activation and the /authors dropdown.
//
// Safety rules (self-protection, last-active-super-admin, authors.manage
// scoping, author<->login conversion) live in rules.go and are enforced by
// Service; handler.go only decodes/encodes HTTP.
package user

import (
	"bytes"
	"encoding/json"
	"net/http"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/rbac"
)

// Actor is the authenticated caller performing an admin action.
type Actor struct {
	UserID int64
	Perms  rbac.Set
	Meta   audit.Meta
}

// ActorFromRequest builds an Actor from the request's authenticated
// principal (via authctx, never package auth) and permission set.
func ActorFromRequest(r *http.Request) Actor {
	p, _ := authctx.FromContext(r.Context())
	return Actor{
		UserID: p.UserID,
		Perms:  rbac.PermissionsFromContext(r.Context()),
		Meta:   audit.RequestMeta(r),
	}
}

// Nullable is a tri-state optional string for JSON bodies: the key omitted
// (Set=false) leaves the stored value unchanged, an explicit null (Set=true,
// Value=nil) clears it, and a string (Set=true, Value!=nil) replaces it.
type Nullable struct {
	Set   bool
	Value *string
}

// UnmarshalJSON implements json.Unmarshaler; it is only invoked when the key
// is present in the body.
func (n *Nullable) UnmarshalJSON(b []byte) error {
	n.Set = true
	if bytes.Equal(bytes.TrimSpace(b), []byte("null")) {
		n.Value = nil
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	n.Value = &s
	return nil
}

// MarshalJSON renders Value (null when unset or cleared).
func (n Nullable) MarshalJSON() ([]byte, error) { return json.Marshal(n.Value) }

// Str returns a Nullable that sets the field to s.
func Str(s string) Nullable { return Nullable{Set: true, Value: &s} }

// Clear returns a Nullable that clears the field.
func Clear() Nullable { return Nullable{Set: true} }

// ListFilter narrows GET /admin/users.
type ListFilter struct {
	Q        string
	CanLogin *bool
	IsActive *bool
	RoleCode string
	Page     httpx.Pagination
}

// RoleRef is a role reference embedded in user DTOs.
type RoleRef struct {
	ID   int64  `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

// UserItem is one row of GET /admin/users.
type UserItem struct {
	ID          int64   `json:"id"`
	Email       *string `json:"email"`
	Phone       *string `json:"phone"`
	DisplayName string  `json:"display_name"`
	Slug        string  `json:"slug"`
	Title       *string `json:"title"`
	CanLogin    bool    `json:"can_login"`
	IsActive    bool    `json:"is_active"`
	// MustChangePassword is true until the user replaces an admin-set password.
	MustChangePassword bool      `json:"must_change_password"`
	LastLoginAt        *string   `json:"last_login_at"`
	Roles              []RoleRef `json:"roles"`
	CreatedAt          string    `json:"created_at"`
}

// UserDetail is the body of GET/POST/PUT on a single user.
type UserDetail struct {
	UserItem
	Bio           *string `json:"bio"`
	AvatarMediaID *int64  `json:"avatar_media_id"`
	UpdatedAt     string  `json:"updated_at"`
}

// AuthorOption is one row of GET /admin/authors.
type AuthorOption struct {
	ID          int64   `json:"id"`
	DisplayName string  `json:"display_name"`
	Title       *string `json:"title"`
	Slug        string  `json:"slug"`
}

// CreateInput is the POST /admin/users body. CanLogin requires Password and
// an Email or Phone (users_login_requires_credentials). Phone is accepted in
// any typed form and stored normalized. MustChangePassword defaults to true
// whenever Password is supplied. IsActive defaults to true when omitted.
type CreateInput struct {
	Email              *string `json:"email" validate:"omitempty,email,max=254"`
	Phone              *string `json:"phone" validate:"omitempty,max=40"`
	Password           *string `json:"password" validate:"omitempty,min=10,max=128"`
	MustChangePassword *bool   `json:"must_change_password"`
	DisplayName        string  `json:"display_name" validate:"required,max=120"`
	Slug               *string `json:"slug" validate:"omitempty,max=160"`
	Title              *string `json:"title" validate:"omitempty,max=120"`
	Bio                *string `json:"bio" validate:"omitempty,max=2000"`
	AvatarMediaID      *int64  `json:"avatar_media_id" validate:"omitempty,gt=0"`
	CanLogin           bool    `json:"can_login"`
	IsActive           *bool   `json:"is_active"`
	RoleIDs            []int64 `json:"role_ids" validate:"omitempty,dive,gt=0"`
}

// UpdateInput is the PUT /admin/users/{id} body. Every field is a pointer
// (RoleIDs a nilable slice) except DisplayName: a nil/omitted field leaves
// the current value unchanged; RoleIDs: [] clears all role assignments.
// Email and Phone are Nullable: omitted keeps, null clears. Setting CanLogin
// true requires Password (and an Email or Phone, existing or supplied);
// setting it false clears credentials (incl. phone), roles and sessions
// (rules.go / service.go, §1.11). A supplied Password sets
// must_change_password (default true).
type UpdateInput struct {
	Email              Nullable `json:"email"`
	Phone              Nullable `json:"phone"`
	Password           *string  `json:"password" validate:"omitempty,min=10,max=128"`
	MustChangePassword *bool    `json:"must_change_password"`
	DisplayName        string   `json:"display_name" validate:"required,max=120"`
	Slug               *string  `json:"slug" validate:"omitempty,max=160"`
	Title              *string  `json:"title" validate:"omitempty,max=120"`
	Bio                *string  `json:"bio" validate:"omitempty,max=2000"`
	AvatarMediaID      *int64   `json:"avatar_media_id" validate:"omitempty,gt=0"`
	CanLogin           *bool    `json:"can_login"`
	IsActive           *bool    `json:"is_active"`
	RoleIDs            []int64  `json:"role_ids" validate:"omitempty,dive,gt=0"`
}

// ResetPasswordInput is the POST /admin/users/{id}/reset-password body.
type ResetPasswordInput struct {
	NewPassword string `json:"new_password" validate:"required,min=10,max=128"`
	// MustChangePassword defaults to true when omitted.
	MustChangePassword *bool `json:"must_change_password"`
}
