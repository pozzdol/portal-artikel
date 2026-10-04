package seed

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/png" // register PNG decoder for logo dimensions
	"io/fs"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5"
)

type baseCategory struct {
	Slug, Name, Description string
	SortOrder               int
}

var baseCategories = []baseCategory{
	{"kajian", "Kajian", "Kajian keislaman dari para asatidz: fikih, tafsir, akhlak, dan aqidah.", 10},
	{"berita", "Berita", "Kabar terbaru seputar alumni, prestasi santri, komunitas, dan karier.", 20},
	{"yayasan", "Yayasan", "Kegiatan dan program Yayasan Darul Hikmah Sumedang.", 30},
	{"opini", "Opini", "Sudut pandang dan gagasan alumni tentang umat, pendidikan, dan kehidupan.", 40},
	// "agenda" is a reserved route, so the category uses slug kabar-agenda.
	{"kabar-agenda", "Agenda", "Berita dan liputan seputar agenda kegiatan alumni dan pesantren.", 50},
}

var baseSubcategories = map[string][]baseCategory{
	"kajian": {
		{"fikih", "Fikih", "Pembahasan hukum Islam dalam ibadah dan muamalah sehari-hari.", 10},
		{"tafsir", "Tafsir", "Tadabbur dan penjelasan makna ayat-ayat Al-Qur'an.", 20},
		{"akhlak", "Akhlak", "Kajian adab dan akhlak seorang muslim dalam kehidupan.", 30},
		{"aqidah", "Aqidah", "Pokok-pokok keimanan dan tauhid seorang muslim.", 40},
	},
	"berita": {
		{"alumni", "Alumni", "Kabar dan kegiatan alumni Darul Hikmah dari berbagai angkatan.", 10},
		{"prestasi", "Prestasi", "Capaian dan prestasi santri serta alumni.", 20},
		{"komunitas", "Komunitas", "Kegiatan komunitas alumni di berbagai wilayah.", 30},
		{"karier", "Karier", "Kisah perjalanan karier dan pengabdian alumni.", 40},
	},
}

type baseMenuItem struct {
	Label, LinkType, Target string
}

var baseMenus = []struct {
	Code, Name string
	Items      []baseMenuItem
}{
	{"header", "Header", []baseMenuItem{
		{"Beranda", "route", "/"},
		{"Kajian", "category", "kajian"},
		{"Berita", "category", "berita"},
		{"Yayasan", "category", "yayasan"},
		{"Opini", "category", "opini"},
		{"Agenda", "route", "/agenda"},
		{"Tokoh Alumni", "route", "/tokoh"},
		{"Video", "route", "/video"},
	}},
	{"footer_categories", "Footer · Kategori", []baseMenuItem{
		{"Kajian", "category", "kajian"},
		{"Berita", "category", "berita"},
		{"Yayasan", "category", "yayasan"},
		{"Opini", "category", "opini"},
		{"Agenda", "route", "/agenda"},
	}},
	{"footer_about", "Footer · Tentang", []baseMenuItem{
		{"Profil Yayasan", "page", "profil-yayasan"},
		{"Redaksi", "page", "redaksi"},
		{"Pedoman Media", "page", "pedoman-media"},
		{"Karier", "page", "karier"},
	}},
	{"footer_legal", "Footer · Legal", []baseMenuItem{
		{"Kebijakan Privasi", "page", "kebijakan-privasi"},
		{"Syarat & Ketentuan", "page", "syarat-ketentuan"},
	}},
}

var basePages = []struct{ Slug, Title string }{
	{"profil-yayasan", "Profil Yayasan"},
	{"redaksi", "Redaksi"},
	{"pedoman-media", "Pedoman Media"},
	{"karier", "Karier"},
	{"kebijakan-privasi", "Kebijakan Privasi"},
	{"syarat-ketentuan", "Syarat & Ketentuan"},
}

const pagePlaceholder = "Halaman ini sedang disusun oleh redaksi."

type baseSection struct {
	Position int
	Type     string
	Label    string
	Active   bool
	Config   string // exact JSON
}

var baseSections = []baseSection{
	{10, "hero_trending", "Hero + Trending Hari Ini", true,
		`{"hero_source":"featured","trending_title":"Trending Hari Ini","trending_window":"day","trending_limit":5,"show_thumbnails":true}`},
	{20, "breaking_ticker", "Breaking News", true,
		`{"label":"Breaking","source":"both","speed_seconds":26,"limit":6}`},
	{30, "article_grid", "Kajian Terbaru (3 kolom)", true,
		`{"anchor_id":"kajian","eyebrow":"Kategori Utama","title":"Kajian Terbaru","category_slug":"kajian","include_children":true,"columns":3,"limit":3,"show_excerpt":true,"show_author":true,"show_reading_time":true,"image_ratio":"4/3","exclude_hero":true,"more_link":{"label":"Lihat Semua Kajian →","href":"/kajian"}}`},
	{40, "article_grid", "Berita Alumni (4 kolom)", true,
		`{"anchor_id":"berita","eyebrow":"Komunitas","title":"Berita Alumni","category_slug":"berita","include_children":true,"columns":4,"limit":4,"show_excerpt":false,"show_author":false,"show_reading_time":true,"image_ratio":"4/3","exclude_hero":true,"more_link":{"label":"Lihat Semua Berita →","href":"/berita"}}`},
	{50, "latest_with_sidebar", "Berita Terbaru + Sidebar", true,
		`{"list_title":"Berita Terbaru","limit":4,"widgets":["popular","categories","tags","next_event"],"popular_limit":3,"popular_days":30,"tags_limit":8}`},
	{60, "quote_rotator", "Kutipan", true,
		`{"interval_seconds":6,"order":"sequential","background":"ink"}`},
	{70, "timeline", "Kegiatan Yayasan", true,
		`{"anchor_id":"yayasan","eyebrow":"Yayasan Darul Hikmah","title":"Kegiatan Yayasan","category_slug":"yayasan","limit":3,"order_by":"event_date","more_link":{"label":"Lihat Semua Kegiatan →","href":"/yayasan"}}`},
	{80, "feature_split", "Opini", true,
		`{"anchor_id":"opini","eyebrow":"Sudut Pandang","title":"Opini","category_slug":"opini","featured_label":"Opini Utama","side_limit":3,"show_author_title":true,"more_link":{"label":"Lihat Semua Opini →","href":"/opini"}}`},
	{90, "people_grid", "Tokoh Alumni", true,
		`{"anchor_id":"tokoh","eyebrow":"Author Expertise","title":"Tokoh Alumni","limit":4,"only_featured":true,"columns":4,"cta_label":"Baca Kisah","more_link":{"label":"Lihat Semua Tokoh →","href":"/tokoh"}}`},
	{100, "agenda_calendar", "Agenda", true,
		`{"anchor_id":"agenda","eyebrow":"Jadwal","title":"Agenda","limit":3,"show_calendar":true,"calendar_month":"current","more_link":{"label":"Lihat Semua Agenda →","href":"/agenda"}}`},
	{110, "video_gallery", "Video", true,
		`{"anchor_id":"video","eyebrow":"Dokumentasi","title":"Video","limit":3,"layout":"feature","more_link":{"label":"Lihat Semua Video →","href":"/video"}}`},
	{120, "faq", "Pertanyaan Umum", true,
		`{"eyebrow":"FAQ","title":"Pertanyaan Umum","default_open_index":0}`},
	{130, "newsletter", "Newsletter", false,
		`{"title":"Berlangganan Buletin","description":"Dapatkan ringkasan kajian dan kabar alumni setiap pekan langsung ke email Anda.","button_label":"Subscribe","placeholder":"Alamat email Anda","background":"ink"}`},
}

func runBase(ctx context.Context, tx pgx.Tx, opts Options) error {
	steps := []struct {
		name string
		fn   func(context.Context, pgx.Tx, Options) error
	}{
		{"categories", seedCategories},
		{"media+site_settings", seedLogoAndSettings},
		{"menus", seedMenus},
		{"pages", seedPages},
		{"homepage_sections", seedHomepageSections},
	}
	for _, s := range steps {
		if err := s.fn(ctx, tx, opts); err != nil {
			return fmt.Errorf("%s: %w", s.name, err)
		}
	}
	return nil
}

func seedCategories(ctx context.Context, tx pgx.Tx, _ Options) error {
	for _, c := range baseCategories {
		if _, err := tx.Exec(ctx, `
			INSERT INTO categories (name, slug, description, sort_order)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (slug) DO NOTHING`,
			c.Name, c.Slug, c.Description, c.SortOrder); err != nil {
			return fmt.Errorf("category %s: %w", c.Slug, err)
		}
	}
	for parent, children := range baseSubcategories {
		for _, c := range children {
			if _, err := tx.Exec(ctx, `
				INSERT INTO categories (parent_id, name, slug, description, sort_order)
				SELECT p.id, $2::text, $3::text, $4::text, $5::int FROM categories p WHERE p.slug = $1::text
				ON CONFLICT (slug) DO NOTHING`,
				parent, c.Name, c.Slug, c.Description, c.SortOrder); err != nil {
				return fmt.Errorf("category %s: %w", c.Slug, err)
			}
		}
	}
	return nil
}

// logoInfo returns size and dimensions of uploads/brand/logo.png if it exists.
func logoInfo(uploadDir string) (size int64, width, height *int32, err error) {
	path := filepath.Join(uploadDir, "brand", "logo.png")
	f, err := os.Open(path)
	if errors.Is(err, fs.ErrNotExist) {
		return 0, nil, nil, nil
	}
	if err != nil {
		return 0, nil, nil, err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return 0, nil, nil, err
	}
	cfg, _, decErr := image.DecodeConfig(f)
	if decErr != nil {
		return st.Size(), nil, nil, nil // not a decodable PNG: keep size, unknown dims
	}
	w, h := int32(cfg.Width), int32(cfg.Height)
	return st.Size(), &w, &h, nil
}

func seedLogoAndSettings(ctx context.Context, tx pgx.Tx, opts Options) error {
	size, w, h, err := logoInfo(opts.UploadDir)
	if err != nil {
		return fmt.Errorf("read logo: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO media (storage_key, url, original_name, mime_type, size_bytes, width, height, alt_text)
		VALUES ('brand/logo.png', '/uploads/brand/logo.png', 'logo.png', 'image/png', $1, $2, $3, 'Logo ALMAIDAH')
		ON CONFLICT (storage_key) DO NOTHING`, size, w, h); err != nil {
		return fmt.Errorf("logo media: %w", err)
	}
	var logoID int64
	if err := tx.QueryRow(ctx, `SELECT id FROM media WHERE storage_key = 'brand/logo.png'`).Scan(&logoID); err != nil {
		return fmt.Errorf("logo media id: %w", err)
	}

	settings := []struct {
		key   string
		value any
	}{
		{"site.identity", map[string]any{
			"name": "ALMAIDAH", "tagline": "Alumni Darul Hikmah Sumedang",
			"logo_media_id": logoID, "favicon_media_id": nil,
		}},
		{"site.footer", map[string]any{
			"description": "Portal resmi alumni Darul Hikmah Sumedang. Menyajikan kajian, kabar alumni, kegiatan yayasan, dan agenda komunitas untuk merawat ilmu dan silaturahmi.",
			"copyright":   "© {year} ALMAIDAH — Alumni Darul Hikmah Sumedang. Seluruh hak cipta dilindungi.",
		}},
		{"site.contact", map[string]any{
			"address": "Jl. Darul Hikmah No. 1\nSumedang, Jawa Barat 45311",
			"email":   "redaksi@almaidah.id",
			"phone":   "(0261) 123-456",
		}},
		{"site.social", []map[string]string{
			{"platform": "instagram", "url": "https://instagram.com/almaidah.id"},
			{"platform": "youtube", "url": "https://youtube.com/@almaidah"},
			{"platform": "whatsapp", "url": "https://wa.me/62261123456"},
		}},
		{"seo.defaults", map[string]any{
			"title_template":           "%s — ALMAIDAH",
			"default_description":      "Portal berita resmi komunitas alumni Darul Hikmah Sumedang: kajian, berita alumni, kegiatan yayasan, opini, agenda, dan video.",
			"default_og_media_id":      nil,
			"google_site_verification": "",
		}},
		{"header.options", map[string]any{
			"show_date": true, "show_search": true, "show_theme_toggle": true,
			"show_login_button": true, "login_label": "Login Admin",
		}},
	}
	for _, s := range settings {
		raw, err := json.Marshal(s.value)
		if err != nil {
			return fmt.Errorf("marshal %s: %w", s.key, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO site_settings (key, value) VALUES ($1, $2::jsonb)
			ON CONFLICT (key) DO NOTHING`, s.key, string(raw)); err != nil {
			return fmt.Errorf("setting %s: %w", s.key, err)
		}
	}
	return nil
}

func seedMenus(ctx context.Context, tx pgx.Tx, _ Options) error {
	for _, m := range baseMenus {
		if _, err := tx.Exec(ctx, `
			INSERT INTO menus (code, name) VALUES ($1, $2)
			ON CONFLICT (code) DO NOTHING`, m.Code, m.Name); err != nil {
			return fmt.Errorf("menu %s: %w", m.Code, err)
		}
		for i, it := range m.Items {
			if _, err := tx.Exec(ctx, `
				INSERT INTO menu_items (menu_id, label, link_type, link_target, sort_order)
				SELECT m.id, $2::text, $3::text, $4::text, $5::int FROM menus m
				WHERE m.code = $1::text
				  AND NOT EXISTS (SELECT 1 FROM menu_items mi WHERE mi.menu_id = m.id AND mi.label = $2::text)`,
				m.Code, it.Label, it.LinkType, it.Target, (i+1)*10); err != nil {
				return fmt.Errorf("menu item %s/%s: %w", m.Code, it.Label, err)
			}
		}
	}
	return nil
}

func seedPages(ctx context.Context, tx pgx.Tx, _ Options) error {
	contentJSON := string(tiptapDoc(pagePlaceholder))
	contentHTML := htmlParagraphs(pagePlaceholder)
	for _, p := range basePages {
		if _, err := tx.Exec(ctx, `
			INSERT INTO pages (title, slug, content_json, content_html, status)
			VALUES ($1, $2, $3::jsonb, $4, 'published')
			ON CONFLICT (slug) DO NOTHING`, p.Title, p.Slug, contentJSON, contentHTML); err != nil {
			return fmt.Errorf("page %s: %w", p.Slug, err)
		}
	}
	return nil
}

// homepage_sections_position_key is DEFERRABLE, which PostgreSQL does not accept
// as an ON CONFLICT arbiter, so existence is checked with NOT EXISTS instead.
func seedHomepageSections(ctx context.Context, tx pgx.Tx, _ Options) error {
	for _, s := range baseSections {
		if !json.Valid([]byte(s.Config)) {
			return fmt.Errorf("section %d: invalid config JSON", s.Position)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO homepage_sections (type, label, position, is_active, config, page_key)
			SELECT $1::text, $2::text, $3::int, $4::boolean, $5::jsonb, 'home'
			WHERE NOT EXISTS (SELECT 1 FROM homepage_sections WHERE page_key = 'home' AND position = $3::int)`,
			s.Type, s.Label, s.Position, s.Active, s.Config); err != nil {
			return fmt.Errorf("section %d %s: %w", s.Position, s.Type, err)
		}
	}
	return nil
}
