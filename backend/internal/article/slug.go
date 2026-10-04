package article

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/jackc/pgx/v5"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/slugutil"
)

const (
	msgSlugInvalid = "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung (maks. 160 karakter)."
	msgSlugTaken   = "Slug sudah dipakai."
	fallbackSlug   = "artikel"
	maxSlugTries   = 200
)

// slugAvailable reports whether slug can be used by article excludeID (0 for
// a new article): no other article has it and no redirect of another article
// claims it. A redirect that already points to excludeID does not block it
// (the article is returning to a previous slug).
func slugAvailable(ctx context.Context, q *dbgen.Queries, slug string, excludeID int64) (bool, error) {
	exists, err := q.ArticleSlugExists(ctx, dbgen.ArticleSlugExistsParams{Slug: slug, ExcludeID: excludeID})
	if err != nil {
		return false, fmt.Errorf("article: slug exists: %w", err)
	}
	if exists {
		return false, nil
	}
	red, err := q.GetSlugRedirect(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return true, nil
	}
	if err != nil {
		return false, fmt.Errorf("article: slug redirect: %w", err)
	}
	return red.ArticleID == excludeID && excludeID != 0, nil
}

// withSuffix appends "-n" to base, trimming base so the result stays within
// slugutil.MaxLen.
func withSuffix(base string, n int) string {
	suffix := "-" + strconv.Itoa(n)
	if len(base)+len(suffix) > slugutil.MaxLen {
		base = base[:slugutil.MaxLen-len(suffix)]
		for len(base) > 0 && base[len(base)-1] == '-' {
			base = base[:len(base)-1]
		}
	}
	return base + suffix
}

// nextFreeSlug returns base, or base-2, base-3, … — the first available one.
func nextFreeSlug(ctx context.Context, q *dbgen.Queries, base string, excludeID int64) (string, error) {
	if base == "" {
		base = fallbackSlug
	}
	for n := 1; n <= maxSlugTries; n++ {
		cand := base
		if n > 1 {
			cand = withSuffix(base, n)
		}
		ok, err := slugAvailable(ctx, q, cand, excludeID)
		if err != nil {
			return "", err
		}
		if ok {
			return cand, nil
		}
	}
	return "", apperr.Validation(map[string]string{"slug": msgSlugTaken})
}

// resolveSlug picks the slug for a create/update. A client slug must be
// valid and available (422 otherwise). Without one, create derives it from
// the title (numeric suffix on conflict) and update keeps current.
func resolveSlug(ctx context.Context, q *dbgen.Queries, requested *string, title, current string, excludeID int64) (string, error) {
	if requested != nil && *requested != "" {
		s := *requested
		if !slugutil.Valid(s) {
			return "", apperr.Validation(map[string]string{"slug": msgSlugInvalid})
		}
		if s == current {
			return s, nil
		}
		ok, err := slugAvailable(ctx, q, s, excludeID)
		if err != nil {
			return "", err
		}
		if !ok {
			return "", apperr.Validation(map[string]string{"slug": msgSlugTaken})
		}
		return s, nil
	}
	if current != "" {
		return current, nil
	}
	return nextFreeSlug(ctx, q, slugutil.Make(title), excludeID)
}

// SlugCheck reports whether slug is free for article excludeID (0 = new).
// An invalid or taken slug comes with a suggestion.
func (s *Service) SlugCheck(ctx context.Context, slug string, excludeID int64) (SlugCheck, error) {
	q := dbgen.New(s.pool)
	out := SlugCheck{Slug: slug}
	base := slug
	if !slugutil.Valid(slug) {
		base = slugutil.Make(slug)
	} else {
		ok, err := slugAvailable(ctx, q, slug, excludeID)
		if err != nil {
			return SlugCheck{}, err
		}
		if ok {
			out.Available = true
			return out, nil
		}
	}
	sug, err := nextFreeSlug(ctx, q, base, excludeID)
	if err != nil {
		var ae *apperr.Error
		if errors.As(err, &ae) {
			return out, nil // no suggestion found; still a valid answer
		}
		return SlugCheck{}, err
	}
	out.Suggestion = &sug
	return out, nil
}
