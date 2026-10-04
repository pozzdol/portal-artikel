-- +goose Up
CREATE TABLE article_views_daily (
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  views      INT NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (article_id, day)
);
CREATE INDEX article_views_daily_day_views_idx ON article_views_daily (day, views DESC);

CREATE TABLE article_view_dedup (
  article_id   BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  visitor_hash BYTEA NOT NULL,
  day          DATE NOT NULL,
  PRIMARY KEY (article_id, visitor_hash, day)
);
CREATE INDEX article_view_dedup_day_idx ON article_view_dedup (day);

-- +goose Down
DROP TABLE IF EXISTS article_view_dedup;
DROP TABLE IF EXISTS article_views_daily;
