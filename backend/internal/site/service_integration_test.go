//go:build integration

package site_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/setting"
	"portal-berita/backend/internal/site"
	"portal-berita/backend/internal/testdb"
)

// TestGetHydratesDefaultOGMedia covers Issue 11(a): seo.defaults.default_og_media_id
// must be resolved into a full media object (or null) alongside site.identity.
func TestGetHydratesDefaultOGMedia(t *testing.T) {
	pool := testdb.New(t)
	testdb.SeedBase(t, pool)
	adminID, _, _ := testdb.SuperAdmin(t, pool)

	settingSvc := setting.NewService(pool, audit.New(pool), revalidate.Noop{})
	svc := site.NewService(pool, func() time.Time { return time.Now() })

	// Before seo.defaults.default_og_media_id is set: default_og_media is null,
	// but the rest of the payload still decodes.
	payload, err := svc.Get(context.Background())
	require.NoError(t, err)
	seo, ok := payload.Settings["seo.defaults"].(map[string]any)
	require.True(t, ok, "seo.defaults must decode as an object")
	assert.Nil(t, seo["default_og_media"])

	var mediaID int64
	testdb.Exec(t, pool, `INSERT INTO media (storage_key, url, original_name, mime_type, size_bytes, width, height, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		"seo/og-default.jpg", "/uploads/seo/og-default.jpg", "og-default.jpg", "image/jpeg", int64(12345), int32(1200), int32(630), adminID)
	row := pool.QueryRow(context.Background(), `SELECT id FROM media WHERE storage_key = $1`, "seo/og-default.jpg")
	require.NoError(t, row.Scan(&mediaID))

	body, err := json.Marshal(setting.SEODefaults{
		TitleTemplate:      "%s | ALMAIDAH",
		DefaultDescription: "Portal berita alumni.",
		DefaultOGMediaID:   &mediaID,
	})
	require.NoError(t, err)
	_, err = settingSvc.Update(context.Background(), audit.Meta{UserID: &adminID}, setting.KeySEODefaults, body)
	require.NoError(t, err)

	payload, err = svc.Get(context.Background())
	require.NoError(t, err)
	seo, ok = payload.Settings["seo.defaults"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "%s | ALMAIDAH", seo["title_template"])
	require.NotNil(t, seo["default_og_media"], "default_og_media must be hydrated once set")
	m, ok := seo["default_og_media"].(*content.Media)
	require.True(t, ok)
	assert.Equal(t, "/uploads/seo/og-default.jpg", m.URL)
	assert.Equal(t, mediaID, m.ID)
	// default_og_media_id stays in the payload for admin compatibility.
	assert.EqualValues(t, mediaID, seo["default_og_media_id"])

	// The JSON wire shape matches site.identity.logo: a full media object.
	wire, err := json.Marshal(payload)
	require.NoError(t, err)
	var decoded struct {
		Settings struct {
			SEODefaults struct {
				DefaultOGMedia *struct {
					ID  int64  `json:"id"`
					URL string `json:"url"`
				} `json:"default_og_media"`
			} `json:"seo.defaults"`
		} `json:"settings"`
	}
	require.NoError(t, json.Unmarshal(wire, &decoded))
	require.NotNil(t, decoded.Settings.SEODefaults.DefaultOGMedia)
	assert.Equal(t, mediaID, decoded.Settings.SEODefaults.DefaultOGMedia.ID)
}
