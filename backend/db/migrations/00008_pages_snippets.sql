-- +goose Up
CREATE TABLE pages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 160),
  content_json    JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_html    TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  seo_title       TEXT,
  seo_description TEXT,
  og_media_id     BIGINT REFERENCES media(id) ON DELETE SET NULL,
  created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_pages_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE snippets (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('announcement','breaking','quote','faq')),
  title      TEXT,
  body       TEXT NOT NULL,
  source     TEXT,
  link_url   TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  starts_at  TIMESTAMPTZ,
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT snippets_faq_requires_title CHECK (type <> 'faq' OR title IS NOT NULL),
  CONSTRAINT snippets_period_valid CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX snippets_type_active_sort_idx ON snippets (type, is_active, sort_order);
CREATE TRIGGER trg_snippets_updated_at BEFORE UPDATE ON snippets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS snippets;
DROP TABLE IF EXISTS pages;
