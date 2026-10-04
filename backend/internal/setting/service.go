package setting

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/go-playground/validator/v10"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/revalidate"
)

// Service implements site_settings reads and typed, validated writes.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
}

// NewService returns a setting Service. reval is nil-safe (pass revalidate.Noop{}).
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client) *Service {
	return &Service{pool: pool, auditor: auditor, reval: reval}
}

// List returns every stored key mapped to its decoded value. Keys that have
// never been written (should not happen once seeded) are simply absent.
func (s *Service) List(ctx context.Context) (map[string]any, error) {
	q := dbgen.New(s.pool)
	rows, err := q.ListSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("setting: list: %w", err)
	}
	out := make(map[string]any, len(rows))
	for _, r := range rows {
		var v any
		if err := json.Unmarshal(r.Value, &v); err != nil {
			return nil, fmt.Errorf("setting: decode %s: %w", r.Key, err)
		}
		out[r.Key] = v
	}
	return out, nil
}

// Update validates body against key's struct (unknown key -> 404, unknown
// field or invalid value -> 422), checks that any referenced media id
// exists, stores the canonical JSON and enqueues the settings revalidate tag
// after commit.
func (s *Service) Update(ctx context.Context, meta audit.Meta, key string, body []byte) (*Item, error) {
	if !IsKnownKey(key) {
		return nil, apperr.NotFound()
	}
	value, mediaFields, err := decodeAndValidate(key, body)
	if err != nil {
		return nil, err
	}
	q := dbgen.New(s.pool)
	for field, id := range mediaFields {
		if _, err := q.GetMedia(ctx, id); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apperr.Validation(map[string]string{field: "Media tidak ditemukan."})
			}
			return nil, fmt.Errorf("setting: get media %s: %w", field, err)
		}
	}
	canonical, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("setting: marshal: %w", err)
	}

	var out *Item
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		qtx := dbgen.New(tx)
		if err := qtx.UpsertSetting(ctx, dbgen.UpsertSettingParams{
			Key: key, Value: canonical, UpdatedBy: meta.UserID,
		}); err != nil {
			return fmt.Errorf("setting: upsert: %w", err)
		}
		row, err := qtx.GetSetting(ctx, key)
		if err != nil {
			return fmt.Errorf("setting: reload: %w", err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntitySetting,
			Summary: "Pengaturan diperbarui: " + key, Changes: value, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("setting: audit: %w", err)
		}
		var decoded any
		if err := json.Unmarshal(row.Value, &decoded); err != nil {
			return fmt.Errorf("setting: decode reloaded value: %w", err)
		}
		out = &Item{Key: row.Key, Value: decoded, UpdatedAt: httpx.FormatTime(row.UpdatedAt)}
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.TagSettings)
	return out, nil
}

// decodeAndValidate decodes body against key's struct with unknown fields
// rejected, runs struct validation, and collects the ids of any referenced
// media fields (json field name -> id) for existence checking.
func decodeAndValidate(key string, body []byte) (value any, mediaFields map[string]int64, err error) {
	switch key {
	case KeySiteIdentity:
		v := &Identity{}
		if err := decodeStrict(body, v); err != nil {
			return nil, nil, err
		}
		if err := httpx.Validate(v); err != nil {
			return nil, nil, err
		}
		media := map[string]int64{}
		if v.LogoMediaID != nil {
			media["logo_media_id"] = *v.LogoMediaID
		}
		if v.FaviconMediaID != nil {
			media["favicon_media_id"] = *v.FaviconMediaID
		}
		return v, media, nil
	case KeySiteFooter:
		v := &Footer{}
		if err := decodeStrict(body, v); err != nil {
			return nil, nil, err
		}
		if err := httpx.Validate(v); err != nil {
			return nil, nil, err
		}
		return v, nil, nil
	case KeySiteContact:
		v := &Contact{}
		if err := decodeStrict(body, v); err != nil {
			return nil, nil, err
		}
		if err := httpx.Validate(v); err != nil {
			return nil, nil, err
		}
		return v, nil, nil
	case KeySiteSocial:
		var v []SocialLink
		if err := decodeStrict(body, &v); err != nil {
			return nil, nil, err
		}
		var allErrs validator.ValidationErrors
		for _, item := range v {
			if verr := httpx.Validate(item); verr != nil {
				var ve validator.ValidationErrors
				if errors.As(verr, &ve) {
					allErrs = append(allErrs, ve...)
					continue
				}
				return nil, nil, verr
			}
		}
		if len(allErrs) > 0 {
			return nil, nil, allErrs
		}
		if v == nil {
			v = []SocialLink{}
		}
		return v, nil, nil
	case KeySEODefaults:
		v := &SEODefaults{}
		if err := decodeStrict(body, v); err != nil {
			return nil, nil, err
		}
		if err := httpx.Validate(v); err != nil {
			return nil, nil, err
		}
		media := map[string]int64{}
		if v.DefaultOGMediaID != nil {
			media["default_og_media_id"] = *v.DefaultOGMediaID
		}
		return v, media, nil
	case KeyHeaderOptions:
		v := &HeaderOptions{}
		if err := decodeStrict(body, v); err != nil {
			return nil, nil, err
		}
		if err := httpx.Validate(v); err != nil {
			return nil, nil, err
		}
		return v, nil, nil
	default:
		return nil, nil, apperr.NotFound()
	}
}

// decodeStrict decodes exactly one JSON value into v, rejecting unknown
// object fields and any trailing content.
func decodeStrict(body []byte, v any) error {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return apperr.Validation(map[string]string{"value": "Format nilai tidak valid: " + err.Error()})
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return apperr.Validation(map[string]string{"value": "Body harus berisi satu nilai JSON."})
	}
	return nil
}
