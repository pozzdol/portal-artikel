-- Public event queries require status = 'published' (cancelled/draft are hidden).

-- name: CreateEvent :one
INSERT INTO events (
  title, slug, summary, description_json, description_html, starts_at, ends_at, is_all_day,
  location_name, location_address, maps_url, cover_media_id, registration_url, status,
  seo_title, seo_description, created_by, updated_by)
VALUES (
  sqlc.arg(title), sqlc.arg(slug), sqlc.narg(summary), sqlc.narg(description_json), sqlc.narg(description_html),
  sqlc.arg(starts_at), sqlc.narg(ends_at), sqlc.arg(is_all_day),
  sqlc.arg(location_name), sqlc.narg(location_address), sqlc.narg(maps_url), sqlc.narg(cover_media_id),
  sqlc.narg(registration_url), sqlc.arg(status),
  sqlc.narg(seo_title), sqlc.narg(seo_description), sqlc.narg(created_by), sqlc.narg(updated_by))
RETURNING *;

-- name: UpdateEvent :one
UPDATE events
SET title = sqlc.arg(title),
    slug = sqlc.arg(slug),
    summary = sqlc.narg(summary),
    description_json = sqlc.narg(description_json),
    description_html = sqlc.narg(description_html),
    starts_at = sqlc.arg(starts_at),
    ends_at = sqlc.narg(ends_at),
    is_all_day = sqlc.arg(is_all_day),
    location_name = sqlc.arg(location_name),
    location_address = sqlc.narg(location_address),
    maps_url = sqlc.narg(maps_url),
    cover_media_id = sqlc.narg(cover_media_id),
    registration_url = sqlc.narg(registration_url),
    status = sqlc.arg(status),
    seo_title = sqlc.narg(seo_title),
    seo_description = sqlc.narg(seo_description),
    updated_by = sqlc.narg(updated_by)
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: GetEvent :one
SELECT * FROM events WHERE id = $1;

-- name: GetEventBySlug :one
SELECT * FROM events WHERE slug = $1;

-- name: GetPublishedEventBySlug :one
SELECT * FROM events WHERE slug = $1 AND status = 'published';

-- name: DeleteEvent :execrows
DELETE FROM events WHERE id = $1;

-- name: EventSlugExists :one
SELECT EXISTS (
  SELECT 1 FROM events WHERE slug = sqlc.arg(slug)::text AND id <> sqlc.arg(exclude_id)::bigint
) AS exists;

-- name: ListEventsAdmin :many
SELECT * FROM events
WHERE (sqlc.narg('q')::text IS NULL OR title ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text)
ORDER BY starts_at DESC, id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountEventsAdmin :one
SELECT count(*) FROM events
WHERE (sqlc.narg('q')::text IS NULL OR title ILIKE '%' || sqlc.narg('q')::text || '%')
  AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text);

-- ListPublishedEvents: when = 'upcoming' (COALESCE(ends_at, starts_at) >= now(),
-- starts_at ASC), 'past' (< now(), starts_at DESC), anything else = no time
-- filter (starts_at ASC). month_from/month_to (NULL = open) filter starts_at in
-- [month_from, month_to).
-- name: ListPublishedEvents :many
SELECT * FROM events
WHERE status = 'published'
  AND (sqlc.arg('when')::text <> 'upcoming' OR COALESCE(ends_at, starts_at) >= now())
  AND (sqlc.arg('when')::text <> 'past' OR COALESCE(ends_at, starts_at) < now())
  AND (sqlc.narg('month_from')::timestamptz IS NULL OR starts_at >= sqlc.narg('month_from')::timestamptz)
  AND (sqlc.narg('month_to')::timestamptz IS NULL OR starts_at < sqlc.narg('month_to')::timestamptz)
ORDER BY
  CASE WHEN sqlc.arg('when')::text = 'past' THEN starts_at END DESC,
  starts_at ASC, id ASC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountPublishedEvents :one
SELECT count(*) FROM events
WHERE status = 'published'
  AND (sqlc.arg('when')::text <> 'upcoming' OR COALESCE(ends_at, starts_at) >= now())
  AND (sqlc.arg('when')::text <> 'past' OR COALESCE(ends_at, starts_at) < now())
  AND (sqlc.narg('month_from')::timestamptz IS NULL OR starts_at >= sqlc.narg('month_from')::timestamptz)
  AND (sqlc.narg('month_to')::timestamptz IS NULL OR starts_at < sqlc.narg('month_to')::timestamptz);

-- name: ListUpcomingEvents :many
SELECT * FROM events
WHERE status = 'published' AND COALESCE(ends_at, starts_at) >= now()
ORDER BY starts_at ASC, id ASC
LIMIT sqlc.arg('limit');

-- ListPublishedEventsBetween: starts_at in [from_ts, to_ts) (calendar).
-- name: ListPublishedEventsBetween :many
SELECT * FROM events
WHERE status = 'published'
  AND starts_at >= sqlc.arg(from_ts)::timestamptz AND starts_at < sqlc.arg(to_ts)::timestamptz
ORDER BY starts_at ASC, id ASC;

-- name: ListPublishedEventsForSitemap :many
SELECT slug, updated_at FROM events
WHERE status = 'published'
ORDER BY starts_at DESC, id DESC;
