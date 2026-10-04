-- InsertViewDedup records one visitor/day for a published article. 0 rows =
-- duplicate or not a public article.
-- name: InsertViewDedup :execrows
INSERT INTO article_view_dedup (article_id, visitor_hash, day)
SELECT a.id, sqlc.arg(visitor_hash)::bytea, sqlc.arg(day)::date
FROM articles a
WHERE a.id = sqlc.arg(article_id)::bigint
  AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- name: UpsertDailyView :exec
INSERT INTO article_views_daily (article_id, day, views)
VALUES (sqlc.arg(article_id), sqlc.arg(day), 1)
ON CONFLICT (article_id, day) DO UPDATE SET views = article_views_daily.views + 1;

-- ListTopArticleViews: published articles by summed views with day in [from_day, to_day].
-- name: ListTopArticleViews :many
SELECT v.article_id, sum(v.views)::bigint AS views
FROM article_views_daily v
JOIN articles a ON a.id = v.article_id
WHERE v.day BETWEEN sqlc.arg(from_day)::date AND sqlc.arg(to_day)::date
  AND a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
GROUP BY v.article_id, a.published_at
ORDER BY sum(v.views) DESC, a.published_at DESC, v.article_id DESC
LIMIT sqlc.arg('limit');

-- name: DeleteOldViewDedup :execrows
DELETE FROM article_view_dedup WHERE day < $1;

-- name: SumViewsBetween :one
SELECT COALESCE(sum(views), 0)::bigint AS views
FROM article_views_daily
WHERE day BETWEEN sqlc.arg(from_day)::date AND sqlc.arg(to_day)::date;

-- ListDailyViewTotals returns one row per day in [from_day, to_day] (zero-filled).
-- name: ListDailyViewTotals :many
SELECT d.day::date AS day, COALESCE(sum(v.views), 0)::bigint AS views
FROM generate_series(sqlc.arg(from_day)::date, sqlc.arg(to_day)::date, interval '1 day') AS d(day)
LEFT JOIN article_views_daily v ON v.day = d.day::date
GROUP BY d.day
ORDER BY d.day;
