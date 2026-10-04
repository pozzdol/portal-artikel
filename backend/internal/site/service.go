// Package site implements GET /public/site: one aggregate call for the
// frontend layout (settings, resolved menus, active announcements).
package site

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/menu"
	"portal-berita/backend/internal/setting"
)

// Announcement is one active "announcement" snippet.
type Announcement struct {
	ID      int64   `json:"id"`
	Body    string  `json:"body"`
	LinkURL *string `json:"link_url"`
}

// Payload is the /public/site response body.
type Payload struct {
	Settings      map[string]any               `json:"settings"`
	Menus         map[string][]menu.PublicItem `json:"menus"`
	Announcements []Announcement               `json:"announcements"`
}

// Service builds the /public/site payload.
type Service struct {
	pool *pgxpool.Pool
	now  func() time.Time
}

// NewService returns a site Service.
func NewService(pool *pgxpool.Pool, now func() time.Time) *Service {
	return &Service{pool: pool, now: now}
}

const announcementType = "announcement"

// Get assembles settings (site.identity's media ids resolved to content.Media),
// every menu's resolved item tree and active announcements.
func (s *Service) Get(ctx context.Context) (*Payload, error) {
	q := dbgen.New(s.pool)
	rows, err := q.ListSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("site: list settings: %w", err)
	}
	raw := make(map[string]json.RawMessage, len(rows))
	for _, r := range rows {
		raw[r.Key] = r.Value
	}

	var identity setting.Identity
	if b, ok := raw[setting.KeySiteIdentity]; ok {
		if err := json.Unmarshal(b, &identity); err != nil {
			return nil, fmt.Errorf("site: decode site.identity: %w", err)
		}
	}
	var seoDefaults setting.SEODefaults
	if b, ok := raw[setting.KeySEODefaults]; ok {
		if err := json.Unmarshal(b, &seoDefaults); err != nil {
			return nil, fmt.Errorf("site: decode seo.defaults: %w", err)
		}
	}

	var mediaIDs []int64
	if identity.LogoMediaID != nil {
		mediaIDs = append(mediaIDs, *identity.LogoMediaID)
	}
	if identity.FaviconMediaID != nil {
		mediaIDs = append(mediaIDs, *identity.FaviconMediaID)
	}
	if seoDefaults.DefaultOGMediaID != nil {
		mediaIDs = append(mediaIDs, *seoDefaults.DefaultOGMediaID)
	}
	media, err := content.NewHydrator(s.pool).Media(ctx, mediaIDs)
	if err != nil {
		return nil, err
	}

	settingsOut := make(map[string]any, len(raw))
	for key, b := range raw {
		if key == setting.KeySiteIdentity {
			settingsOut[key] = map[string]any{
				"name":    identity.Name,
				"tagline": identity.Tagline,
				"logo":    mediaPtr(media, identity.LogoMediaID),
				"favicon": mediaPtr(media, identity.FaviconMediaID),
			}
			continue
		}
		var v any
		if err := json.Unmarshal(b, &v); err != nil {
			return nil, fmt.Errorf("site: decode %s: %w", key, err)
		}
		if key == setting.KeySEODefaults {
			// Keep every stored field (including default_og_media_id, for
			// admin compatibility) and add the hydrated media object.
			if m, ok := v.(map[string]any); ok {
				m["default_og_media"] = mediaPtr(media, seoDefaults.DefaultOGMediaID)
				v = m
			}
		}
		settingsOut[key] = v
	}

	menus, err := menu.ResolvePublic(ctx, s.pool)
	if err != nil {
		return nil, err
	}

	typ := announcementType
	snippets, err := q.ListActiveSnippets(ctx, dbgen.ListActiveSnippetsParams{Type: &typ, Now: s.now()})
	if err != nil {
		return nil, fmt.Errorf("site: list announcements: %w", err)
	}
	announcements := make([]Announcement, len(snippets))
	for i, sn := range snippets {
		announcements[i] = Announcement{ID: sn.ID, Body: sn.Body, LinkURL: sn.LinkUrl}
	}

	return &Payload{Settings: settingsOut, Menus: menus, Announcements: announcements}, nil
}

func mediaPtr(media map[int64]content.Media, id *int64) *content.Media {
	if id == nil {
		return nil
	}
	m, ok := media[*id]
	if !ok {
		return nil
	}
	return &m
}
