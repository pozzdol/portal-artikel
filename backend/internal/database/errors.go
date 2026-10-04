package database

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// PostgreSQL SQLSTATE codes.
const (
	codeUniqueViolation     = "23505"
	codeForeignKeyViolation = "23503"
	codeCheckViolation      = "23514"
)

func pgConstraint(err error, code string) (string, bool) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == code {
		return pgErr.ConstraintName, true
	}
	return "", false
}

// UniqueViolation reports whether err is a unique_violation (23505) and
// returns the violated constraint name (e.g. "users_email_key").
func UniqueViolation(err error) (constraint string, ok bool) {
	return pgConstraint(err, codeUniqueViolation)
}

// ForeignKeyViolation reports whether err is a foreign_key_violation (23503)
// and returns the violated constraint name (e.g. "users_avatar_media_id_fkey").
func ForeignKeyViolation(err error) (constraint string, ok bool) {
	return pgConstraint(err, codeForeignKeyViolation)
}

// CheckViolation reports whether err is a check_violation (23514) and returns
// the violated constraint name (e.g. "categories_slug_not_reserved").
func CheckViolation(err error) (constraint string, ok bool) {
	return pgConstraint(err, codeCheckViolation)
}
