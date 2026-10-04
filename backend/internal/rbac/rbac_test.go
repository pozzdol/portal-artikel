package rbac

import (
	"context"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSet(t *testing.T) {
	s := NewSet(PermUsersManage, PermAuditView, PermUsersManage)
	assert.True(t, s.Has(PermUsersManage))
	assert.False(t, s.Has(PermRolesManage))
	assert.True(t, s.HasAny(PermRolesManage, PermAuditView))
	assert.False(t, s.HasAny())
	assert.False(t, s.HasAny(PermRolesManage))
	assert.Equal(t, []string{PermAuditView, PermUsersManage}, s.Codes())
	assert.NotNil(t, NewSet().Codes())
	assert.Empty(t, NewSet().Codes())
}

func TestPermissionsContext(t *testing.T) {
	assert.NotNil(t, PermissionsFromContext(context.Background()))
	assert.Empty(t, PermissionsFromContext(context.Background()))
	ctx := WithPermissions(context.Background(), NewSet(PermDashboardView))
	assert.True(t, PermissionsFromContext(ctx).Has(PermDashboardView))
}

func TestAllPermissions(t *testing.T) {
	assert.Len(t, AllPermissions, 22)
	assert.True(t, sort.StringsAreSorted(AllPermissions))
	assert.Len(t, NewSet(AllPermissions...), 22)
}
