-- +goose Up
CREATE TABLE categories (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id       BIGINT REFERENCES categories(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 160),
  description     TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  seo_title       TEXT,
  seo_description TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT categories_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  -- Level-1 slugs are served at /{slug}; they must not clash with reserved routes.
  -- The 2-level depth limit is enforced in the service layer.
  CONSTRAINT categories_slug_not_reserved CHECK (parent_id IS NOT NULL OR slug NOT IN (
    'agenda','tokoh','video','tag','cari','penulis','halaman','admin','api','uploads',
    'sitemap.xml','robots.txt','feed','_next'))
);
CREATE INDEX categories_parent_sort_idx ON categories (parent_id, sort_order);
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tags (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 60),
  slug       TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS categories;
