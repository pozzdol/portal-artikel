-- +goose Up
CREATE TABLE events (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title            TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  slug             TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 160),
  summary          TEXT,
  description_json JSONB,
  description_html TEXT,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ,
  is_all_day       BOOLEAN NOT NULL DEFAULT false,
  location_name    TEXT NOT NULL,
  location_address TEXT,
  maps_url         TEXT,
  cover_media_id   BIGINT REFERENCES media(id) ON DELETE SET NULL,
  registration_url TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
  seo_title        TEXT,
  seo_description  TEXT,
  created_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_ends_after_starts CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX events_status_starts_at_idx ON events (status, starts_at);
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE alumni_profiles (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 160),
  role_title      TEXT NOT NULL,
  class_year      SMALLINT CHECK (class_year IS NULL OR class_year BETWEEN 1900 AND 2100),
  short_bio       TEXT NOT NULL,
  story_json      JSONB,
  story_html      TEXT,
  photo_media_id  BIGINT REFERENCES media(id) ON DELETE SET NULL,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  sort_order      INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  seo_title       TEXT,
  seo_description TEXT,
  created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alumni_profiles_listing_idx ON alumni_profiles (status, is_featured, sort_order);
CREATE TRIGGER trg_alumni_profiles_updated_at BEFORE UPDATE ON alumni_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE videos (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title              TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  slug               TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) <= 160),
  youtube_id         TEXT NOT NULL CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  description        TEXT,
  duration_seconds   INT CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  view_count         BIGINT CHECK (view_count IS NULL OR view_count >= 0),
  thumbnail_media_id BIGINT REFERENCES media(id) ON DELETE SET NULL,
  published_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_featured        BOOLEAN NOT NULL DEFAULT false,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX videos_status_published_at_idx ON videos (status, published_at DESC);
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS videos;
DROP TABLE IF EXISTS alumni_profiles;
DROP TABLE IF EXISTS events;
