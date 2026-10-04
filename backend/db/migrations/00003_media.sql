-- +goose Up
CREATE TABLE media (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  storage_key   TEXT NOT NULL UNIQUE,
  url           TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL CHECK (size_bytes >= 0),
  width         INT,
  height        INT,
  alt_text      TEXT,
  caption       TEXT,
  uploaded_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX media_created_at_idx ON media (created_at DESC);

ALTER TABLE users ADD CONSTRAINT users_avatar_media_id_fkey
  FOREIGN KEY (avatar_media_id) REFERENCES media(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_avatar_media_id_fkey;
DROP TABLE IF EXISTS media;
