-- +goose Up
CREATE TABLE articles (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 160),
  excerpt         TEXT CHECK (excerpt IS NULL OR char_length(excerpt) <= 300),
  content_json    JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  content_html    TEXT NOT NULL DEFAULT '',
  content_text    TEXT NOT NULL DEFAULT '',
  cover_media_id  BIGINT REFERENCES media(id) ON DELETE SET NULL,
  cover_caption   TEXT,
  category_id     BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  author_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','archived')),
  published_at    TIMESTAMPTZ,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  is_breaking     BOOLEAN NOT NULL DEFAULT false,
  reading_minutes SMALLINT NOT NULL DEFAULT 1 CHECK (reading_minutes >= 1),
  event_date      DATE,
  event_location  TEXT,
  view_count      BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  seo_title       TEXT,
  seo_description TEXT,
  og_media_id     BIGINT REFERENCES media(id) ON DELETE SET NULL,
  canonical_url   TEXT,
  search_vector   TSVECTOR NOT NULL DEFAULT ''::tsvector,
  created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT articles_published_at_required CHECK (status NOT IN ('scheduled','published') OR published_at IS NOT NULL)
);
CREATE TRIGGER trg_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION articles_search_vector_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
      setweight(to_tsvector('simple', immutable_unaccent(coalesce(NEW.title, ''))),        'A')
   || setweight(to_tsvector('simple', immutable_unaccent(coalesce(NEW.excerpt, ''))),      'B')
   || setweight(to_tsvector('simple', immutable_unaccent(coalesce(NEW.content_text, ''))), 'C');
  RETURN NEW;
END
$$;
-- +goose StatementEnd

CREATE TRIGGER trg_articles_search_vector BEFORE INSERT OR UPDATE OF title, excerpt, content_text
  ON articles FOR EACH ROW EXECUTE FUNCTION articles_search_vector_update();

CREATE INDEX articles_status_published_idx ON articles (status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX articles_category_idx ON articles (category_id, status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX articles_author_idx ON articles (author_id, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX articles_featured_idx ON articles (is_featured, published_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX articles_breaking_idx ON articles (published_at DESC) WHERE is_breaking AND status = 'published' AND deleted_at IS NULL;
CREATE INDEX articles_event_date_idx ON articles (event_date DESC) WHERE event_date IS NOT NULL;
CREATE INDEX articles_search_idx ON articles USING GIN (search_vector);
CREATE INDEX articles_title_trgm_idx ON articles USING GIN (title gin_trgm_ops);
CREATE INDEX articles_title_unaccent_trgm_idx ON articles USING GIN (immutable_unaccent(title) gin_trgm_ops);

CREATE TABLE article_tags (
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
CREATE INDEX article_tags_tag_id_idx ON article_tags (tag_id);

CREATE TABLE article_slug_redirects (
  old_slug   TEXT PRIMARY KEY CHECK (old_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(old_slug) <= 160),
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX article_slug_redirects_article_id_idx ON article_slug_redirects (article_id);

-- +goose Down
DROP TABLE IF EXISTS article_slug_redirects;
DROP TABLE IF EXISTS article_tags;
DROP TABLE IF EXISTS articles;
DROP FUNCTION IF EXISTS articles_search_vector_update();
