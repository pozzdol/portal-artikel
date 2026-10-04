package article

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/jobs"
)

// PublishDueJobName is the jobs.Job name of the scheduled-publish job.
const PublishDueJobName = "article.publish_due"

// PublishDue publishes every scheduled article whose published_at has
// passed (one UPDATE … RETURNING, committed on its own), then enqueues the
// revalidation tags of the published articles and writes a best-effort
// audit entry per article. It returns the number of published articles.
func (s *Service) PublishDue(ctx context.Context) (int, error) {
	q := dbgen.New(s.pool)
	rows, err := q.PublishDueArticles(ctx)
	if err != nil {
		return 0, fmt.Errorf("article: publish due: %w", err)
	}
	if len(rows) == 0 {
		return 0, nil
	}

	// The UPDATE has committed; everything below is post-commit.
	ids := make([]int64, len(rows))
	refs := make([]revalRef, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
		refs[i] = revalRef{Slug: r.Slug, CategoryID: r.CategoryID, AuthorID: r.AuthorID}
	}
	tagRows, err := q.ListArticleTagsByArticleIDs(ctx, ids)
	if err != nil {
		return len(rows), fmt.Errorf("article: publish due tags: %w", err)
	}
	slugs := make([]string, len(tagRows))
	for i, t := range tagRows {
		slugs[i] = t.Slug
	}
	tags, err := collectRevalTags(ctx, q, refs, slugs)
	if err != nil {
		return len(rows), err
	}
	s.reval.Enqueue(tags...)

	for _, r := range rows {
		id := r.ID
		s.auditor.LogBestEffort(ctx, audit.Entry{
			Action: audit.ActionPublish, EntityType: audit.EntityArticle, EntityID: &id,
			Summary: fmt.Sprintf("Artikel %q terbit sesuai jadwal.", r.Slug),
		})
	}
	return len(rows), nil
}

// PublishDueJob returns the scheduler job (every minute) for jobs.Runner.
// log may be nil (slog.Default).
func (s *Service) PublishDueJob(log *slog.Logger) jobs.Job {
	if log == nil {
		log = slog.Default()
	}
	return jobs.Job{
		Name:  PublishDueJobName,
		Every: time.Minute,
		Fn: func(ctx context.Context) error {
			n, err := s.PublishDue(ctx)
			if n > 0 {
				log.InfoContext(ctx, "publish_due", "published", n)
			}
			return err
		},
	}
}
