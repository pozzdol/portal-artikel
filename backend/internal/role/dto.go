// Package role implements role CRUD, permission assignment and the
// permission-catalog listing (docs/05-api.md §4 "User, role, penulis").
package role

// RoleDTO is the API representation of a role.
type RoleDTO struct {
	ID          int64    `json:"id"`
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	IsSystem    bool     `json:"is_system"`
	UserCount   int64    `json:"user_count"`
	Permissions []string `json:"permissions"`
	CreatedAt   string   `json:"created_at"`
}

// CreateInput is the body of POST /admin/roles.
type CreateInput struct {
	// Code must match ^[a-z][a-z0-9_]*$ (checked in the service, not here,
	// so the validation error carries the right Indonesian message).
	Code            string   `json:"code" validate:"required,max=60"`
	Name            string   `json:"name" validate:"required,max=120"`
	Description     *string  `json:"description" validate:"omitempty,max=500"`
	PermissionCodes []string `json:"permission_codes" validate:"dive,max=80"`
}

// UpdateInput is the body of PUT /admin/roles/{id}. Code is immutable and not
// accepted here.
type UpdateInput struct {
	Name            string   `json:"name" validate:"required,max=120"`
	Description     *string  `json:"description" validate:"omitempty,max=500"`
	PermissionCodes []string `json:"permission_codes" validate:"dive,max=80"`
}
