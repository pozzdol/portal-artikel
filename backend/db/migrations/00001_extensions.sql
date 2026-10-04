-- +goose Up
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
-- +goose StatementEnd

-- unaccent() is STABLE; this IMMUTABLE wrapper allows its use in index expressions.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;
-- +goose StatementEnd

-- +goose Down
-- Extensions are intentionally kept (database-global and shared).
DROP FUNCTION IF EXISTS immutable_unaccent(text);
DROP FUNCTION IF EXISTS set_updated_at();
