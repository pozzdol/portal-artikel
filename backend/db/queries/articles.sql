-- Public predicate used by every ListPublished*/GetPublished* query:
--   a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
-- All article list queries select a.* so sqlc returns dbgen.Article; cards are
-- hydrated in Go (internal/content.Hydrator).

-- name: CreateArticle :one
INSERT INTO articles (
  title, slug, excerpt, content_json, content_html, content_text,
  cover_media_id, cover_caption, category_id, author_id, status, published_at,
  is_featured, is_breaking, reading_minutes, event_date, event_location,
  seo_title, seo_description, og_media_id, canonical_url, created_by, updated_by)
VALUES (
  sqlc.arg(title), sqlc.arg(slug), sqlc.narg(excerpt), sqlc.arg(content_json), sqlc.arg(content_html), sqlc.arg(content_text),
  sqlc.narg(cover_media_id), sqlc.narg(cover_caption), sqlc.arg(category_id), sqlc.arg(author_id), sqlc.arg(status), sqlc.narg(published_at),
  sqlc.arg(is_featured), sqlc.arg(is_breaking), sqlc.arg(reading_minutes), sqlc.narg(event_date), sqlc.narg(event_location),
  sqlc.narg(seo_title), sqlc.narg(seo_description), sqlc.narg(og_media_id), sqlc.narg(canonical_url), sqlc.narg(created_by), sqlc.narg(updated_by))
RETURNING *;

-- UpdateArticle updates editable columns; status/published_at go through SetArticleStatus.
-- name: UpdateArticle :one
UPDATE articles
SET title = sqlc.arg(title),
    slug = sqlc.arg(slug),
    excerpt = sqlc.narg(excerpt),
    content_json = sqlc.arg(content_json),
    content_html = sqlc.arg(content_html),
    content_text = sqlc.arg(content_text),
    cover_media_id = sqlc.narg(cover_media_id),
    cover_caption = sqlc.narg(cover_caption),
    category_id = sqlc.arg(category_id),
    author_id = sqlc.arg(author_id),
    is_featured = sqlc.arg(is_featured),
    is_breaking = sqlc.arg(is_breaking),
    reading_minutes = sqlc.arg(reading_minutes),
    event_date = sqlc.narg(event_date),
    event_location = sqlc.narg(event_location),
    seo_title = sqlc.narg(seo_title),
    seo_description = sqlc.narg(seo_description),
    og_media_id = sqlc.narg(og_media_id),
    canonical_url = sqlc.narg(canonical_url),
    updated_by = sqlc.narg(updated_by)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: GetArticle :one
SELECT * FROM articles WHERE id = $1;

-- GetArticleBySlugAny: any status, not deleted (preview).
-- name: GetArticleBySlugAny :one
SELECT * FROM articles WHERE slug = $1 AND deleted_at IS NULL;

-- name: GetPublishedArticleBySlug :one
SELECT a.* FROM articles a
WHERE a.slug = $1
  AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL;

-- name: ArticleSlugExists :one
SELECT EXISTS (
  SELECT 1 FROM articles WHERE slug = sqlc.arg(slug)::text AND id <> sqlc.arg(exclude_id)::bigint
) AS exists;

-- name: GetSlugRedirect :one
SELECT * FROM article_slug_redirects WHERE old_slug = $1;

-- name: UpsertSlugRedirect :exec
INSERT INTO article_slug_redirects (old_slug, article_id)
VALUES (sqlc.arg(old_slug), sqlc.arg(article_id))
ON CONFLICT (old_slug) DO UPDATE SET article_id = EXCLUDED.article_id, created_at = now();

-- name: DeleteSlugRedirect :exec
DELETE FROM article_slug_redirects WHERE old_slug = $1;

-- ListArticlesAdmin: sort whitelist '-updated_at' (default, any other value),
-- '-published_at', 'published_at', 'title', '-title', '-view_count'.
-- name: ListArticlesAdmin :many
SELECT a.* FROM articles a
WHERE (sqlc.narg('q')::text IS NULL OR a.title ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('status')::text IS NULL OR a.status = sqlc.narg('status')::text)
  AND (sqlc.narg('category_ids')::bigint[] IS NULL OR a.category_id = ANY(sqlc.narg('category_ids')::bigint[]))
  AND (sqlc.narg('author_id')::bigint IS NULL OR a.author_id = sqlc.narg('author_id')::bigint)
  AND ((sqlc.arg('trashed')::bool AND a.deleted_at IS NOT NULL)
       OR (NOT sqlc.arg('trashed')::bool AND a.deleted_at IS NULL))
ORDER BY
  CASE WHEN sqlc.arg('sort')::text = 'title' THEN a.title END ASC,
  CASE WHEN sqlc.arg('sort')::text = '-title' THEN a.title END DESC,
  CASE WHEN sqlc.arg('sort')::text = 'published_at' THEN a.published_at END ASC NULLS LAST,
  CASE WHEN sqlc.arg('sort')::text = '-published_at' THEN a.published_at END DESC NULLS LAST,
  CASE WHEN sqlc.arg('sort')::text = '-view_count' THEN a.view_count END DESC,
  a.updated_at DESC, a.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountArticlesAdmin :one
SELECT count(*) FROM articles a
WHERE (sqlc.narg('q')::text IS NULL OR a.title ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('status')::text IS NULL OR a.status = sqlc.narg('status')::text)
  AND (sqlc.narg('category_ids')::bigint[] IS NULL OR a.category_id = ANY(sqlc.narg('category_ids')::bigint[]))
  AND (sqlc.narg('author_id')::bigint IS NULL OR a.author_id = sqlc.narg('author_id')::bigint)
  AND ((sqlc.arg('trashed')::bool AND a.deleted_at IS NOT NULL)
       OR (NOT sqlc.arg('trashed')::bool AND a.deleted_at IS NULL));

-- name: ListPublishedArticles :many
SELECT a.* FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND (sqlc.narg('category_ids')::bigint[] IS NULL OR a.category_id = ANY(sqlc.narg('category_ids')::bigint[]))
  AND (sqlc.narg('tag_id')::bigint IS NULL OR EXISTS (
        SELECT 1 FROM article_tags at WHERE at.article_id = a.id AND at.tag_id = sqlc.narg('tag_id')::bigint))
  AND (sqlc.narg('author_id')::bigint IS NULL OR a.author_id = sqlc.narg('author_id')::bigint)
  AND (sqlc.narg('featured')::bool IS NULL OR a.is_featured = sqlc.narg('featured')::bool)
ORDER BY a.published_at DESC, a.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPublishedArticles :one
SELECT count(*) FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND (sqlc.narg('category_ids')::bigint[] IS NULL OR a.category_id = ANY(sqlc.narg('category_ids')::bigint[]))
  AND (sqlc.narg('tag_id')::bigint IS NULL OR EXISTS (
        SELECT 1 FROM article_tags at WHERE at.article_id = a.id AND at.tag_id = sqlc.narg('tag_id')::bigint))
  AND (sqlc.narg('author_id')::bigint IS NULL OR a.author_id = sqlc.narg('author_id')::bigint)
  AND (sqlc.narg('featured')::bool IS NULL OR a.is_featured = sqlc.narg('featured')::bool);

-- ListPublishedArticlesByIDs: row order is arbitrary; callers restore their order.
-- name: ListPublishedArticlesByIDs :many
SELECT a.* FROM articles a
WHERE a.id = ANY(sqlc.arg(ids)::bigint[])
  AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL;

-- name: ListLatestPublishedExcluding :many
SELECT a.* FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND NOT (a.id = ANY(COALESCE(sqlc.arg('exclude_ids')::bigint[], '{}'::bigint[])))
ORDER BY a.published_at DESC, a.id DESC
LIMIT sqlc.arg('limit');

-- ListPublishedByCategoryOrdered: category_ids/tag_id NULL = no filter;
-- order_by 'event_date' (event_date DESC NULLS LAST, then published_at) or anything
-- else = 'published_at'.
-- name: ListPublishedByCategoryOrdered :many
SELECT a.* FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND (sqlc.narg('category_ids')::bigint[] IS NULL OR a.category_id = ANY(sqlc.narg('category_ids')::bigint[]))
  AND (sqlc.narg('tag_id')::bigint IS NULL OR EXISTS (
        SELECT 1 FROM article_tags at WHERE at.article_id = a.id AND at.tag_id = sqlc.narg('tag_id')::bigint))
  AND NOT (a.id = ANY(COALESCE(sqlc.arg('exclude_ids')::bigint[], '{}'::bigint[])))
ORDER BY
  CASE WHEN sqlc.arg('order_by')::text = 'event_date' THEN a.event_date END DESC NULLS LAST,
  a.published_at DESC, a.id DESC
LIMIT sqlc.arg('limit');

-- name: ListFeaturedPublished :many
SELECT a.* FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.is_featured
  AND (sqlc.narg('category_ids')::bigint[] IS NULL OR a.category_id = ANY(sqlc.narg('category_ids')::bigint[]))
  AND NOT (a.id = ANY(COALESCE(sqlc.arg('exclude_ids')::bigint[], '{}'::bigint[])))
ORDER BY a.published_at DESC, a.id DESC
LIMIT sqlc.arg('limit');

-- name: ListBreakingPublished :many
SELECT a.* FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.is_breaking
ORDER BY a.published_at DESC, a.id DESC
LIMIT sqlc.arg('limit');

-- ListRelatedArticles: published articles (not article_id) in the same category
-- or sharing a tag; same category first, then shared-tag count, then recency.
-- name: ListRelatedArticles :many
SELECT a.* FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.id <> sqlc.arg('article_id')::bigint
  AND (a.category_id = sqlc.arg('category_id')::bigint OR EXISTS (
        SELECT 1 FROM article_tags t1 JOIN article_tags t2 ON t2.tag_id = t1.tag_id
        WHERE t1.article_id = a.id AND t2.article_id = sqlc.arg('article_id')::bigint))
ORDER BY
  (a.category_id = sqlc.arg('category_id')::bigint)::int DESC,
  (SELECT count(*) FROM article_tags t1 JOIN article_tags t2 ON t2.tag_id = t1.tag_id
   WHERE t1.article_id = a.id AND t2.article_id = sqlc.arg('article_id')::bigint) DESC,
  a.published_at DESC, a.id DESC
LIMIT sqlc.arg('limit');

-- SetArticleStatus: published_at NULL keeps the stored value (unpublish keeps it).
-- name: SetArticleStatus :one
UPDATE articles
SET status = sqlc.arg(status),
    published_at = COALESCE(sqlc.narg(published_at)::timestamptz, published_at),
    updated_by = sqlc.narg(updated_by)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: SoftDeleteArticle :execrows
UPDATE articles SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL;

-- name: RestoreArticle :execrows
UPDATE articles SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL;

-- name: PublishDueArticles :many
UPDATE articles
SET status = 'published'
WHERE status = 'scheduled' AND published_at <= now() AND deleted_at IS NULL
RETURNING id, slug, category_id, author_id;

-- name: IncrementArticleViewCount :exec
UPDATE articles SET view_count = view_count + 1 WHERE id = $1;

-- name: CountArticlesByStatus :many
SELECT status, count(*)::bigint AS count
FROM articles
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- name: ListRecentDrafts :many
SELECT a.* FROM articles a
WHERE a.status IN ('draft', 'scheduled') AND a.deleted_at IS NULL
ORDER BY a.updated_at DESC, a.id DESC
LIMIT sqlc.arg('limit');

-- name: ListPublishedArticlesForSitemap :many
SELECT a.id, a.slug, a.category_id, a.updated_at
FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
ORDER BY a.published_at DESC, a.id DESC;
