//go:build integration

package audit_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/testdb"
)

func fakeGuard(_ ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return next }
}

func newTestServer(svc *audit.ListService) *httptest.Server {
	h := audit.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, fakeGuard)
	return httptest.NewServer(r)
}

func insertLog(t *testing.T, q *dbgen.Queries, userID *int64, action, entityType string, entityID *int64) {
	t.Helper()
	require.NoError(t, q.InsertAuditLog(context.Background(), dbgen.InsertAuditLogParams{
		UserID:     userID,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Summary:    "uji " + action,
	}))
}

func TestAuditLogListFiltersAndPagination(t *testing.T) {
	pool := testdb.New(t)
	userID, _, _ := testdb.SuperAdmin(t, pool)
	q := dbgen.New(pool)

	roleEntity := int64(1)
	userEntity := int64(2)
	insertLog(t, q, &userID, "create", "role", &roleEntity)
	insertLog(t, q, &userID, "update", "role", &roleEntity)
	insertLog(t, q, &userID, "login", "user", &userEntity)
	insertLog(t, q, nil, "login_failed", "user", nil)

	svc := audit.NewListService(pool)
	srv := newTestServer(svc)
	defer srv.Close()

	// Filter by entity_type=role.
	resp, err := http.Get(srv.URL + "/audit-logs?entity_type=role")
	require.NoError(t, err)
	var body struct {
		Data []audit.LogItem `json:"data"`
		Meta struct {
			Total int64 `json:"total"`
		} `json:"meta"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	resp.Body.Close()
	assert.Equal(t, int64(2), body.Meta.Total)
	for _, item := range body.Data {
		assert.Equal(t, "role", item.EntityType)
		if assert.NotNil(t, item.User) {
			assert.Equal(t, userID, item.User.ID)
		}
	}

	// Filter by action=login_failed: user is nil.
	resp, err = http.Get(srv.URL + "/audit-logs?action=login_failed")
	require.NoError(t, err)
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	resp.Body.Close()
	require.Len(t, body.Data, 1)
	assert.Nil(t, body.Data[0].User)

	// Filter by user_id.
	resp, err = http.Get(fmt.Sprintf("%s/audit-logs?user_id=%d", srv.URL, userID))
	require.NoError(t, err)
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	resp.Body.Close()
	assert.Equal(t, int64(3), body.Meta.Total)

	// Pagination: per_page=2 page=1 of the 4 rows.
	resp, err = http.Get(srv.URL + "/audit-logs?per_page=2&page=1")
	require.NoError(t, err)
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	resp.Body.Close()
	assert.Equal(t, int64(4), body.Meta.Total)
	assert.Len(t, body.Data, 2)

	// Date filter: from far in the future returns nothing.
	future := time.Now().UTC().AddDate(1, 0, 0).Format(time.RFC3339)
	resp, err = http.Get(srv.URL + "/audit-logs?from=" + future)
	require.NoError(t, err)
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	resp.Body.Close()
	assert.Equal(t, int64(0), body.Meta.Total)

	// Bad user_id -> 400.
	resp, err = http.Get(srv.URL + "/audit-logs?user_id=abc")
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()

	// Bad date -> 400.
	resp, err = http.Get(srv.URL + "/audit-logs?from=not-a-date")
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()
}

func TestAuditLogDateOnlyFilterCoversWholeDay(t *testing.T) {
	pool := testdb.New(t)
	userID, _, _ := testdb.SuperAdmin(t, pool)
	q := dbgen.New(pool)
	insertLog(t, q, &userID, "login", "user", nil)

	svc := audit.NewListService(pool)
	srv := newTestServer(svc)
	defer srv.Close()

	today := time.Now().In(mustLoadJakarta(t)).Format("2006-01-02")
	resp, err := http.Get(srv.URL + "/audit-logs?from=" + today + "&to=" + today)
	require.NoError(t, err)
	var body struct {
		Meta struct {
			Total int64 `json:"total"`
		} `json:"meta"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	resp.Body.Close()
	assert.Equal(t, int64(1), body.Meta.Total)
}

func mustLoadJakarta(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.FixedZone("WIB", 7*60*60)
	}
	return loc
}
