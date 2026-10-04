package homepage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/revalidate"
)

// positionStep is the gap between section positions.
const positionStep = 10

// Service implements the homepage builder (admin CRUD/reorder) and the public
// resolver.
type Service struct {
	pool    *pgxpool.Pool
	auditor *audit.Logger
	reval   revalidate.Client
	reg     *Registry
	now     func() time.Time
	log     *slog.Logger
}

// NewService returns a homepage Service. reval nil → revalidate.Noop,
// reg nil → NewRegistry(), now nil → time.Now.
func NewService(pool *pgxpool.Pool, auditor *audit.Logger, reval revalidate.Client, reg *Registry, now func() time.Time) *Service {
	if reval == nil {
		reval = revalidate.Noop{}
	}
	if reg == nil {
		reg = NewRegistry()
	}
	if now == nil {
		now = time.Now
	}
	return &Service{pool: pool, auditor: auditor, reval: reval, reg: reg, now: now, log: slog.Default()}
}

// Registry returns the section type registry.
func (s *Service) Registry() *Registry { return s.reg }

// SectionTypes lists the registry for the admin form.
func (s *Service) SectionTypes() []TypeInfo { return s.reg.Types() }

func (s *Service) toSection(row dbgen.HomepageSection) Section {
	sec := Section{
		ID: row.ID, Type: row.Type, Label: row.Label, Position: row.Position, IsActive: row.IsActive,
		Config: json.RawMessage(row.Config), UpdatedBy: row.UpdatedBy,
		CreatedAt: httpx.FormatTime(row.CreatedAt), UpdatedAt: httpx.FormatTime(row.UpdatedAt),
	}
	if len(sec.Config) == 0 {
		sec.Config = json.RawMessage("{}")
	}
	if norm, err := s.reg.Normalize(row.Type, row.Config); err == nil {
		sec.Config = norm
		sec.ConfigValid = true
	}
	return sec
}

// ListAdmin returns every section of the home page (active or not) in
// position order.
func (s *Service) ListAdmin(ctx context.Context) ([]Section, error) {
	rows, err := dbgen.New(s.pool).ListHomepageSections(ctx, PageKeyHome)
	if err != nil {
		return nil, fmt.Errorf("homepage: list sections: %w", err)
	}
	out := make([]Section, 0, len(rows))
	for _, r := range rows {
		out = append(out, s.toSection(r))
	}
	return out, nil
}

// normalizeAndCheck validates cfg and checks that referenced categories,
// tags and articles exist.
func (s *Service) normalizeAndCheck(ctx context.Context, q *dbgen.Queries, typ string, raw json.RawMessage) (json.RawMessage, error) {
	norm, err := s.reg.Normalize(typ, raw)
	if err != nil {
		return nil, err
	}
	spec, _ := s.reg.spec(typ)
	var cfg map[string]any
	if err := json.Unmarshal(norm, &cfg); err != nil {
		return nil, fmt.Errorf("homepage: decode normalized config: %w", err)
	}
	errs := map[string]string{}
	for _, f := range spec.Fields {
		v, ok := cfg[f.Name]
		if !ok {
			continue
		}
		key := "config." + f.Name
		switch f.UI {
		case UICategorySlug:
			c, err := q.GetCategoryBySlug(ctx, v.(string))
			if errors.Is(err, pgx.ErrNoRows) || (err == nil && !c.IsActive) {
				errs[key] = "Kategori tidak ditemukan atau nonaktif."
			} else if err != nil {
				return nil, fmt.Errorf("homepage: check category: %w", err)
			}
		case UITagSlug:
			if _, err := q.GetTagBySlug(ctx, v.(string)); errors.Is(err, pgx.ErrNoRows) {
				errs[key] = "Tag tidak ditemukan."
			} else if err != nil {
				return nil, fmt.Errorf("homepage: check tag: %w", err)
			}
		case UIArticleID:
			id := int64(v.(float64))
			a, err := q.GetArticle(ctx, id)
			if errors.Is(err, pgx.ErrNoRows) || (err == nil && a.DeletedAt != nil) {
				errs[key] = "Artikel tidak ditemukan."
			} else if err != nil {
				return nil, fmt.Errorf("homepage: check article: %w", err)
			}
		}
	}
	if len(errs) > 0 {
		return nil, apperr.Validation(errs)
	}
	return norm, nil
}

func (s *Service) afterCommit() { s.reval.Enqueue(revalidate.TagHomepage) }

// Create adds a section at the end of the home page.
func (s *Service) Create(ctx context.Context, meta audit.Meta, in CreateInput) (*Section, error) {
	in.Type = strings.TrimSpace(in.Type)
	label := strings.TrimSpace(in.Label)
	if !s.reg.Has(in.Type) {
		return nil, apperr.Validation(map[string]string{"type": "Tipe section tidak dikenal."})
	}
	if label == "" {
		return nil, apperr.Validation(map[string]string{"label": "Label wajib diisi."})
	}
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	var out Section
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		cfg, err := s.normalizeAndCheck(ctx, q, in.Type, in.Config)
		if err != nil {
			return err
		}
		maxPos, err := q.MaxHomepagePosition(ctx, PageKeyHome)
		if err != nil {
			return fmt.Errorf("homepage: max position: %w", err)
		}
		row, err := q.CreateHomepageSection(ctx, dbgen.CreateHomepageSectionParams{
			Type: in.Type, Label: label, Position: maxPos + positionStep, IsActive: active,
			Config: cfg, PageKey: PageKeyHome, UpdatedBy: meta.UserID,
		})
		if err != nil {
			if _, ok := database.UniqueViolation(err); ok {
				return apperr.Conflict("Urutan section bentrok, silakan coba lagi.")
			}
			return fmt.Errorf("homepage: create section: %w", err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionCreate, EntityType: audit.EntityHomepageSection,
			EntityID: &row.ID, Summary: "Section homepage dibuat: " + row.Label,
			Changes: map[string]any{"type": row.Type, "label": row.Label, "is_active": row.IsActive, "config": json.RawMessage(cfg)},
			IP:      meta.IP,
		}); err != nil {
			return fmt.Errorf("homepage: audit: %w", err)
		}
		out = s.toSection(row)
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.afterCommit()
	return &out, nil
}

// Update changes label, config and/or is_active of a section.
func (s *Service) Update(ctx context.Context, meta audit.Meta, id int64, in UpdateInput) (*Section, error) {
	var out Section
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		cur, err := q.GetHomepageSection(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.NotFound()
		}
		if err != nil {
			return fmt.Errorf("homepage: get section: %w", err)
		}
		label, active, cfg := cur.Label, cur.IsActive, cur.Config
		if in.Label != nil {
			label = strings.TrimSpace(*in.Label)
			if label == "" {
				return apperr.Validation(map[string]string{"label": "Label wajib diisi."})
			}
		}
		if in.IsActive != nil {
			active = *in.IsActive
		}
		if in.Config != nil {
			norm, err := s.normalizeAndCheck(ctx, q, cur.Type, in.Config)
			if err != nil {
				return err
			}
			cfg = norm
		}
		row, err := q.UpdateHomepageSection(ctx, dbgen.UpdateHomepageSectionParams{
			Label: label, IsActive: active, Config: cfg, UpdatedBy: meta.UserID, ID: id,
		})
		if err != nil {
			return fmt.Errorf("homepage: update section: %w", err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionUpdate, EntityType: audit.EntityHomepageSection,
			EntityID: &row.ID, Summary: "Section homepage diperbarui: " + row.Label,
			Changes: map[string]any{"label": row.Label, "is_active": row.IsActive, "config": json.RawMessage(row.Config)},
			IP:      meta.IP,
		}); err != nil {
			return fmt.Errorf("homepage: audit: %w", err)
		}
		out = s.toSection(row)
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.afterCommit()
	return &out, nil
}

// Delete removes a section.
func (s *Service) Delete(ctx context.Context, meta audit.Meta, id int64) error {
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		cur, err := q.GetHomepageSection(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.NotFound()
		}
		if err != nil {
			return fmt.Errorf("homepage: get section: %w", err)
		}
		n, err := q.DeleteHomepageSection(ctx, id)
		if err != nil {
			return fmt.Errorf("homepage: delete section: %w", err)
		}
		if n == 0 {
			return apperr.NotFound()
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionDelete, EntityType: audit.EntityHomepageSection,
			EntityID: &id, Summary: "Section homepage dihapus: " + cur.Label,
			Changes: map[string]any{"type": cur.Type, "label": cur.Label},
			IP:      meta.IP,
		}); err != nil {
			return fmt.Errorf("homepage: audit: %w", err)
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.afterCommit()
	return nil
}

// Reorder sets the order of the home page sections. ids must contain every
// section id of the page exactly once. Positions are renumbered in two passes
// (negative, then 10, 20, …) so the unique (page_key, position) key never
// clashes mid-transaction.
func (s *Service) Reorder(ctx context.Context, meta audit.Meta, ids []int64) ([]Section, error) {
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		current, err := q.ListHomepageSectionIDs(ctx, PageKeyHome)
		if err != nil {
			return fmt.Errorf("homepage: list section ids: %w", err)
		}
		if !sameIDSet(current, ids) {
			return apperr.Validation(map[string]string{"ids": "Daftar id harus memuat setiap section tepat satu kali."})
		}
		for i, id := range ids {
			if err := q.UpdateHomepageSectionPosition(ctx, dbgen.UpdateHomepageSectionPositionParams{
				ID: id, Position: int32(-(i + 1) * positionStep),
			}); err != nil {
				return fmt.Errorf("homepage: reorder pass 1: %w", err)
			}
		}
		for i, id := range ids {
			if err := q.UpdateHomepageSectionPosition(ctx, dbgen.UpdateHomepageSectionPositionParams{
				ID: id, Position: int32((i + 1) * positionStep),
			}); err != nil {
				return fmt.Errorf("homepage: reorder pass 2: %w", err)
			}
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID: meta.UserID, Action: audit.ActionReorder, EntityType: audit.EntityHomepageSection,
			Summary: "Urutan section homepage diubah", Changes: map[string]any{"ids": ids}, IP: meta.IP,
		}); err != nil {
			return fmt.Errorf("homepage: audit: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.afterCommit()
	return s.ListAdmin(ctx)
}

func sameIDSet(current, ids []int64) bool {
	if len(current) != len(ids) {
		return false
	}
	want := make(map[int64]bool, len(current))
	for _, id := range current {
		want[id] = true
	}
	for _, id := range ids {
		if !want[id] {
			return false
		}
		delete(want, id) // duplicates fail on the second occurrence
	}
	return true
}
