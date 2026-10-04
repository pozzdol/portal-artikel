//go:build integration

package menu_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/menu"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/testdb"
)

func fakeGuard(_ ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return next }
}

func withActor(actorID int64, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := authctx.WithPrincipal(r.Context(), authctx.Principal{UserID: actorID})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func newTestServer(pool *pgxpool.Pool, actorID int64, reval revalidate.Client) *httptest.Server {
	svc := menu.NewService(pool, audit.New(pool), reval)
	h := menu.NewHandler(svc)
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler { return withActor(actorID, next) })
	h.Register(r, fakeGuard)
	return httptest.NewServer(r)
}

func doJSON(t *testing.T, method, url string, body any) *http.Response {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, url, reader)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	return resp
}

func decodeBody(t *testing.T, resp *http.Response, v any) {
	t.Helper()
	defer resp.Body.Close()
	require.NoError(t, json.NewDecoder(resp.Body).Decode(v))
}

func TestMenuReadAndReplace(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)
	reval := &revalidate.Recorder{}
	srv := newTestServer(pool, adminID, reval)
	defer srv.Close()

	// List: 4 base menus, header has 8 items with resolved hrefs.
	resp := doJSON(t, http.MethodGet, srv.URL+"/menus", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var list struct {
		Data []menu.MenuWithItems `json:"data"`
	}
	decodeBody(t, resp, &list)
	assert.Len(t, list.Data, 4)
	var header menu.MenuWithItems
	for _, m := range list.Data {
		if m.Code == "header" {
			header = m
		}
	}
	require.Equal(t, "header", header.Code)
	assert.Len(t, header.Items, 8)
	var kajianHref string
	for _, it := range header.Items {
		if it.Label == "Kajian" {
			kajianHref = it.Href
		}
	}
	assert.Equal(t, "/kajian", kajianHref)

	// Get by code.
	resp = doJSON(t, http.MethodGet, srv.URL+"/menus/header", nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var got struct {
		Data menu.MenuWithItems `json:"data"`
	}
	decodeBody(t, resp, &got)
	assert.Len(t, got.Data.Items, 8)

	// Replace with an invalid category target -> 422, old tree intact.
	resp = doJSON(t, http.MethodPut, srv.URL+"/menus/header/items", menu.ItemsInput{
		Items: []menu.ItemInput{{Label: "Rusak", LinkType: "category", LinkTarget: "tidak-ada", IsActive: true}},
	})
	assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	var verr struct {
		Error struct {
			Fields map[string]string `json:"fields"`
		} `json:"error"`
	}
	decodeBody(t, resp, &verr)
	assert.Contains(t, verr.Error.Fields, "items[0].link_target")

	resp = doJSON(t, http.MethodGet, srv.URL+"/menus/header", nil)
	decodeBody(t, resp, &got)
	assert.Len(t, got.Data.Items, 8, "tree must be untouched after a rejected replace")

	// Replace with a valid smaller tree incl. one child level.
	resp = doJSON(t, http.MethodPut, srv.URL+"/menus/header/items", menu.ItemsInput{
		Items: []menu.ItemInput{
			{Label: "Beranda", LinkType: "route", LinkTarget: "/", IsActive: true},
			{Label: "Kajian", LinkType: "category", LinkTarget: "kajian", IsActive: true, Children: []menu.ItemInput{
				{Label: "Fikih", LinkType: "category", LinkTarget: "fikih", IsActive: true},
			}},
		},
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	decodeBody(t, resp, &got)
	if assert.Len(t, got.Data.Items, 2) {
		assert.Equal(t, "Kajian", got.Data.Items[1].Label)
		if assert.Len(t, got.Data.Items[1].Children, 1) {
			assert.Equal(t, "/kajian?sub=fikih", got.Data.Items[1].Children[0].Href)
		}
	}
	assert.Contains(t, reval.Tags(), "menus")
	assertAuditAction(t, pool, "update")
}

func assertAuditAction(t *testing.T, pool *pgxpool.Pool, action string) {
	t.Helper()
	var count int
	require.NoError(t, pool.QueryRow(context.Background(),
		"SELECT count(*) FROM audit_logs WHERE entity_type = 'menu' AND action = $1", action,
	).Scan(&count))
	assert.GreaterOrEqual(t, count, 1)
}
