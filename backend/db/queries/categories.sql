-- name: ListCategories :many
SELECT * FROM categories
ORDER BY parent_id NULLS FIRST, sort_order, id;

-- ListCategoriesWithCounts: article_count counts published articles directly in c
-- (children are aggregated in Go).
-- name: ListCategoriesWithCounts :many
SELECT c.*,
       (SELECT count(*) FROM articles a
        WHERE a.category_id = c.id
          AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL)::bigint AS article_count
FROM categories c
ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.id;

-- name: GetCategory :one
SELECT * FROM categories WHERE id = $1;

-- name: GetCategoryBySlug :one
SELECT * FROM categories WHERE slug = $1;

-- name: CreateCategory :one
INSERT INTO categories (parent_id, name, slug, description, sort_order, is_active, seo_title, seo_description)
VALUES (sqlc.narg(parent_id), sqlc.arg(name), sqlc.arg(slug), sqlc.narg(description),
        sqlc.arg(sort_order), sqlc.arg(is_active), sqlc.narg(seo_title), sqlc.narg(seo_description))
RETURNING *;

-- name: UpdateCategory :one
UPDATE categories
SET parent_id = sqlc.narg(parent_id),
    name = sqlc.arg(name),
    slug = sqlc.arg(slug),
    description = sqlc.narg(description),
    sort_order = sqlc.arg(sort_order),
    is_active = sqlc.arg(is_active),
    seo_title = sqlc.narg(seo_title),
    seo_description = sqlc.narg(seo_description)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteCategory :execrows
DELETE FROM categories WHERE id = $1;

-- name: CountCategoryChildren :one
SELECT count(*) FROM categories WHERE parent_id = sqlc.arg(parent_id)::bigint;

-- CountArticlesInCategory counts all rows, including drafts and soft-deleted.
-- name: CountArticlesInCategory :one
SELECT count(*) FROM articles WHERE category_id = $1;

-- name: UpdateCategoryOrder :exec
UPDATE categories SET parent_id = sqlc.narg(parent_id), sort_order = sqlc.arg(sort_order)
WHERE id = sqlc.arg(id);
