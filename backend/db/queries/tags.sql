-- name: ListTags :many
SELECT t.*,
       (SELECT count(*) FROM article_tags at JOIN articles a ON a.id = at.article_id
        WHERE at.tag_id = t.id
          AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL)::bigint AS article_count
FROM tags t
WHERE sqlc.narg('q')::text IS NULL OR t.name ILIKE '%' || sqlc.narg('q')::text || '%'
ORDER BY t.name, t.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountTags :one
SELECT count(*) FROM tags t
WHERE sqlc.narg('search')::text IS NULL OR t.name ILIKE '%' || sqlc.narg('search')::text || '%';

-- name: ListPopularTags :many
SELECT t.id, t.name, t.slug, count(a.id)::bigint AS article_count
FROM tags t
JOIN article_tags at ON at.tag_id = t.id
JOIN articles a ON a.id = at.article_id
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
GROUP BY t.id
ORDER BY count(a.id) DESC, t.name
LIMIT sqlc.arg('limit');

-- ListTagsWithArticles: tags with >= 1 published article (sitemap).
-- name: ListTagsWithArticles :many
SELECT t.slug, t.name, max(a.updated_at)::timestamptz AS updated_at
FROM tags t
JOIN article_tags at ON at.tag_id = t.id
JOIN articles a ON a.id = at.article_id
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
GROUP BY t.id
ORDER BY t.slug;

-- name: GetTag :one
SELECT * FROM tags WHERE id = $1;

-- name: GetTagBySlug :one
SELECT t.*,
       (SELECT count(*) FROM article_tags at JOIN articles a ON a.id = at.article_id
        WHERE at.tag_id = t.id
          AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL)::bigint AS article_count
FROM tags t
WHERE t.slug = $1;

-- name: ListTagsByIDs :many
SELECT * FROM tags WHERE id = ANY(sqlc.arg(ids)::bigint[]) ORDER BY name;

-- name: CreateTag :one
INSERT INTO tags (name, slug) VALUES (sqlc.arg(name), sqlc.arg(slug))
RETURNING *;

-- name: GetOrCreateTag :one
INSERT INTO tags (name, slug) VALUES (sqlc.arg(name), sqlc.arg(slug))
ON CONFLICT (slug) DO UPDATE SET name = tags.name
RETURNING *;

-- name: UpdateTag :one
UPDATE tags SET name = sqlc.arg(name), slug = sqlc.arg(slug)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteTag :execrows
DELETE FROM tags WHERE id = $1;

-- name: MergeTagArticles :exec
INSERT INTO article_tags (article_id, tag_id)
SELECT at.article_id, sqlc.arg(into_id)::bigint
FROM article_tags at
WHERE at.tag_id = sqlc.arg(from_id)::bigint
ON CONFLICT DO NOTHING;

-- name: ListArticleTags :many
SELECT t.* FROM tags t
JOIN article_tags at ON at.tag_id = t.id
WHERE at.article_id = $1
ORDER BY t.name;

-- name: ListArticleTagsByArticleIDs :many
SELECT at.article_id, t.id, t.name, t.slug
FROM article_tags at
JOIN tags t ON t.id = at.tag_id
WHERE at.article_id = ANY(sqlc.arg(article_ids)::bigint[])
ORDER BY at.article_id, t.name;

-- name: DeleteArticleTags :exec
DELETE FROM article_tags WHERE article_id = $1;

-- name: AddArticleTags :exec
INSERT INTO article_tags (article_id, tag_id)
SELECT sqlc.arg(article_id)::bigint, unnest(sqlc.arg(tag_ids)::bigint[])
ON CONFLICT DO NOTHING;
