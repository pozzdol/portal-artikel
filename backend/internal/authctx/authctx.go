// Package authctx is a dependency-free leaf holding the authenticated
// principal and its context plumbing. It exists so packages that auth itself
// depends on (e.g. audit) can read the principal without an import cycle.
// Application code should use the aliases in package auth.
package authctx

import "context"

// Principal is the authenticated identity carried by a verified access token.
type Principal struct {
	UserID      int64
	FamilyID    string // refresh token family UUID (session id)
	PermVersion int32
}

type principalKey struct{}

// WithPrincipal stores p in ctx.
func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, p)
}

// FromContext returns the principal stored by WithPrincipal.
func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey{}).(Principal)
	return p, ok
}
