package auth

import (
	"net/netip"
	"time"
)

// Config holds token lifetimes.
type Config struct {
	AccessTTL          time.Duration
	RefreshTTL         time.Duration
	RefreshTTLRemember time.Duration
}

// Client is request metadata recorded with sessions and audit entries.
type Client struct {
	IP        *netip.Addr
	UserAgent string
}

// RoleRef is a role summary.
type RoleRef struct {
	ID   int64  `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

// Me is the authenticated user's profile with roles and permissions.
type Me struct {
	ID            int64   `json:"id"`
	Email         *string `json:"email"`
	Phone         *string `json:"phone"` // normalized (8xxxxxxxxx), no +62/0 prefix
	DisplayName   string  `json:"display_name"`
	Slug          string  `json:"slug"`
	Title         *string `json:"title"`
	Bio           *string `json:"bio"`
	AvatarMediaID *int64  `json:"avatar_media_id"`
	CanLogin      bool    `json:"can_login"`
	IsActive      bool    `json:"is_active"`
	// MustChangePassword: the client must send the user to the forced
	// password change screen; /admin/* answers 403 password_change_required.
	MustChangePassword bool      `json:"must_change_password"`
	Roles              []RoleRef `json:"roles"`
	Permissions        []string  `json:"permissions"`
	LastLoginAt        *string   `json:"last_login_at"`
	CreatedAt          string    `json:"created_at"`
}

// Session is the result of a login or refresh: the raw tokens to put in
// cookies and the user.
type Session struct {
	AccessToken      string
	RefreshToken     string
	CSRFToken        string
	RefreshExpiresAt time.Time
	User             *Me
}

// SessionInfo describes one active session (refresh token family).
type SessionInfo struct {
	FamilyID   string  `json:"family_id"`
	UserAgent  *string `json:"user_agent"`
	IP         *string `json:"ip"`
	StartedAt  string  `json:"started_at"`
	LastUsedAt string  `json:"last_used_at"`
	ExpiresAt  string  `json:"expires_at"`
	Current    bool    `json:"current"`
}

// UpdateMeInput is the body of PUT /auth/me.
type UpdateMeInput struct {
	DisplayName   string  `json:"display_name" validate:"required,max=120"`
	Title         *string `json:"title" validate:"omitempty,max=120"`
	Bio           *string `json:"bio" validate:"omitempty,max=2000"`
	AvatarMediaID *int64  `json:"avatar_media_id" validate:"omitempty,gt=0"`
}

// loginRequest is the validated body of POST /auth/login. Identifier is an
// email address or an Indonesian mobile number in any accepted form.
type loginRequest struct {
	Identifier string `json:"identifier" validate:"required,max=254"`
	Password   string `json:"password" validate:"required,max=128"`
	Remember   bool   `json:"remember"`
}

// changePasswordRequest is the body of PUT /auth/me/password.
type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required,max=128"`
	NewPassword     string `json:"new_password" validate:"required,min=10,max=128"`
}

// loginResponse is {user} inside the data envelope.
type loginResponse struct {
	User *Me `json:"user"`
}
