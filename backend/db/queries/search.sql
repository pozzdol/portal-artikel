-- Full-text search over articles.search_vector ('simple' config, unaccented).

-- name: SearchArticles :many
SELECT a.id,
       ts_rank_cd(a.search_vector, q.query)::float8 AS rank,
       ts_headline('simple', a.content_text, q.query,
                   'MaxWords=35, MinWords=15, MaxFragments=1, StartSel=<mark>, StopSel=</mark>')::text AS headline
FROM articles a,
     (SELECT websearch_to_tsquery('simple', immutable_unaccent(sqlc.arg('query')::text)) AS query) q
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.search_vector @@ q.query
ORDER BY rank DESC, a.published_at DESC, a.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSearchArticles :one
SELECT count(*)
FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND a.search_vector @@ websearch_to_tsquery('simple', immutable_unaccent(sqlc.arg('query')::text));

-- Fuzzy fallback on the title (pg_trgm word_similarity(query, title) > 0.3).
-- name: SearchArticlesFuzzy :many
SELECT a.id,
       word_similarity(immutable_unaccent(sqlc.arg('query')::text), immutable_unaccent(a.title))::float8 AS sim
FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND word_similarity(immutable_unaccent(sqlc.arg('query')::text), immutable_unaccent(a.title)) > 0.3
ORDER BY sim DESC, a.published_at DESC, a.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountSearchArticlesFuzzy :one
SELECT count(*)
FROM articles a
WHERE a.status = 'published' AND a.published_at <= now() AND a.deleted_at IS NULL
  AND word_similarity(immutable_unaccent(sqlc.arg('query')::text), immutable_unaccent(a.title)) > 0.3;
