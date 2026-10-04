-- +goose Up
CREATE TABLE homepage_sections (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN (
    'hero_trending','breaking_ticker','article_grid','latest_with_sidebar','quote_rotator',
    'timeline','feature_split','people_grid','agenda_calendar','video_gallery','faq',
    'newsletter','rich_text')),
  label      TEXT NOT NULL,
  position   INT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  config     JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_key   TEXT NOT NULL DEFAULT 'home',
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Deferrable so a reorder can renumber positions within one transaction.
  CONSTRAINT homepage_sections_position_key UNIQUE (page_key, position) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TRIGGER trg_homepage_sections_updated_at BEFORE UPDATE ON homepage_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE menus (
  id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  name TEXT NOT NULL
);

CREATE TABLE menu_items (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  menu_id      BIGINT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  parent_id    BIGINT REFERENCES menu_items(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  link_type    TEXT NOT NULL CHECK (link_type IN ('url','category','page','route','anchor')),
  link_target  TEXT NOT NULL,
  open_new_tab BOOLEAN NOT NULL DEFAULT false,
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX menu_items_menu_parent_sort_idx ON menu_items (menu_id, parent_id, sort_order);

CREATE TABLE site_settings (
  key        TEXT PRIMARY KEY CHECK (key ~ '^[a-z]+(\.[a-z_]+)+$'),
  value      JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_site_settings_updated_at BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS menus;
DROP TABLE IF EXISTS homepage_sections;
