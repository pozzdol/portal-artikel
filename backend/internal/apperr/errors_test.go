package apperr

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestKindsMatch(t *testing.T) {
	err := fmt.Errorf("svc: %w", Conflict("Role masih dipakai oleh pengguna."))
	assert.True(t, errors.Is(err, ErrConflict))
	assert.False(t, errors.Is(err, ErrNotFound))
	var e *Error
	assert.True(t, errors.As(err, &e))
	assert.Equal(t, "Role masih dipakai oleh pengguna.", e.Message)
	assert.Equal(t, "not found", NotFound().Error())
	assert.Equal(t, 5*time.Second, RateLimited(5*time.Second).RetryAfter)
	assert.Equal(t, "x", Validation(map[string]string{"a": "x"}).Fields["a"])
	assert.True(t, errors.Is(fmt.Errorf("x: %w", PasswordChangeRequired()), ErrPasswordChangeRequired))
	assert.False(t, errors.Is(PasswordChangeRequired(), ErrForbidden))
}
