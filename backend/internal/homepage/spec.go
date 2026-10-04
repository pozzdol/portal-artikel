package homepage

import "portal-berita/backend/internal/richtext"

// FieldType is the kind of a config field. It drives both Go validation
// (Registry.Normalize) and the JSON Schema served to the admin form.
type FieldType string

// Field types.
const (
	FieldString      FieldType = "string"
	FieldInteger     FieldType = "integer"
	FieldBoolean     FieldType = "boolean"
	FieldEnum        FieldType = "enum"
	FieldStringArray FieldType = "string_array"
	FieldEnumArray   FieldType = "enum_array"
	FieldObject      FieldType = "object"
)

// UI hints rendered as "x-ui" in the JSON Schema.
const (
	UICategorySlug = "category_slug"
	UITagSlug      = "tag_slug"
	UIArticleID    = "article_id"
	UIWidgets      = "widgets"
	UIRichText     = "richtext"
	UITextarea     = "textarea"
)

// Field describes one config key. Min/Max bound integer values, string
// length (Max only) and array length. Label/Description are Indonesian
// (shown in the admin form).
type Field struct {
	Name        string
	Type        FieldType
	Label       string
	Description string
	Enum        []string // FieldEnum, FieldEnumArray
	IntEnum     []int    // FieldInteger with a fixed set of choices
	Min, Max    *int
	Pattern     string // FieldString: Go/ECMA-compatible regexp
	PatternMsg  string
	Default     any
	Required    bool
	UI          string
	Fields      []Field // FieldObject
}

// TypeSpec is the registry entry of one section type. Validate runs after
// field checks and defaults on the normalized map (it may rewrite values,
// e.g. sanitize HTML) and returns field-name → message errors.
type TypeSpec struct {
	Type        string
	Label       string
	Description string
	Fields      []Field
	Validate    func(cfg map[string]any) map[string]string
}

// Section type identifiers (homepage_sections.type CHECK constraint).
const (
	TypeHeroTrending      = "hero_trending"
	TypeBreakingTicker    = "breaking_ticker"
	TypeArticleGrid       = "article_grid"
	TypeLatestWithSidebar = "latest_with_sidebar"
	TypeQuoteRotator      = "quote_rotator"
	TypeTimeline          = "timeline"
	TypeFeatureSplit      = "feature_split"
	TypePeopleGrid        = "people_grid"
	TypeAgendaCalendar    = "agenda_calendar"
	TypeVideoGallery      = "video_gallery"
	TypeFAQ               = "faq"
	TypeNewsletter        = "newsletter"
	TypeRichText          = "rich_text"
)

// Sidebar widget identifiers (latest_with_sidebar.widgets).
const (
	WidgetPopular    = "popular"
	WidgetCategories = "categories"
	WidgetTags       = "tags"
	WidgetNextEvent  = "next_event"
)

func ip(n int) *int { return &n }

const (
	slugPattern = `^[a-z0-9]+(?:-[a-z0-9]+)*$`
	slugMsg     = "Hanya huruf kecil, angka, dan tanda hubung."
	hrefPattern = `^(/|#|https?://)`
	hrefMsg     = "Tautan harus diawali /, # atau http(s)://."
)

// commonFields are prepended to every type (docs/06 §3).
var commonFields = []Field{
	{Name: "anchor_id", Type: FieldString, Label: "ID anchor", Description: "Dipakai untuk tautan menu seperti /#kajian.", Max: ip(60), Pattern: slugPattern, PatternMsg: slugMsg},
	{Name: "eyebrow", Type: FieldString, Label: "Eyebrow", Description: "Teks kecil di atas judul section.", Max: ip(120)},
	{Name: "title", Type: FieldString, Label: "Judul", Max: ip(200)},
	{Name: "more_link", Type: FieldObject, Label: "Tautan selengkapnya", Fields: []Field{
		{Name: "label", Type: FieldString, Label: "Teks tautan", Required: true, Max: ip(120)},
		{Name: "href", Type: FieldString, Label: "Alamat tautan", Required: true, Max: ip(500), Pattern: hrefPattern, PatternMsg: hrefMsg},
	}},
	{Name: "background", Type: FieldEnum, Label: "Latar", Enum: []string{"paper", "ink", "muted"}},
}

// dedupeFields are shared by the article-list types.
func dedupeFields(excludeHeroDefault bool) []Field {
	return []Field{
		{Name: "exclude_hero", Type: FieldBoolean, Label: "Sembunyikan artikel hero", Description: "Jangan tampilkan ulang artikel yang sudah menjadi hero.", Default: excludeHeroDefault},
		{Name: "dedupe", Type: FieldBoolean, Label: "Hindari duplikat", Description: "Jangan tampilkan artikel yang sudah tampil di section sebelumnya.", Default: false},
	}
}

func concat(parts ...[]Field) []Field {
	var out []Field
	for _, p := range parts {
		out = append(out, p...)
	}
	return out
}

// typeSpecs lists the 13 section types in registry order. Common fields are
// added by NewRegistry.
func typeSpecs() []TypeSpec {
	return []TypeSpec{
		{
			Type: TypeHeroTrending, Label: "Hero + Trending",
			Description: "Artikel utama besar dan daftar trending bernomor.",
			Fields: []Field{
				{Name: "hero_source", Type: FieldEnum, Label: "Sumber hero", Enum: []string{"featured", "latest", "manual"}, Default: "featured"},
				{Name: "hero_article_id", Type: FieldInteger, Label: "Artikel hero", Description: "Wajib jika sumber hero manual.", Min: ip(1), UI: UIArticleID},
				{Name: "hero_category_slug", Type: FieldString, Label: "Kategori hero", Max: ip(160), Pattern: slugPattern, PatternMsg: slugMsg, UI: UICategorySlug},
				{Name: "trending_title", Type: FieldString, Label: "Judul trending", Max: ip(120), Default: "Trending Hari Ini"},
				{Name: "trending_window", Type: FieldEnum, Label: "Rentang trending", Enum: []string{"day", "week"}, Default: "day"},
				{Name: "trending_limit", Type: FieldInteger, Label: "Jumlah trending", Min: ip(3), Max: ip(8), Default: 5},
				{Name: "show_thumbnails", Type: FieldBoolean, Label: "Tampilkan thumbnail", Default: true},
			},
			Validate: func(cfg map[string]any) map[string]string {
				if cfg["hero_source"] == "manual" {
					if _, ok := cfg["hero_article_id"]; !ok {
						return map[string]string{"hero_article_id": "Wajib diisi jika sumber hero manual."}
					}
				}
				return nil
			},
		},
		{
			Type: TypeBreakingTicker, Label: "Breaking Ticker",
			Description: "Bar hitam dengan teks berjalan.",
			Fields: []Field{
				{Name: "label", Type: FieldString, Label: "Label", Max: ip(40), Default: "Breaking"},
				{Name: "source", Type: FieldEnum, Label: "Sumber", Enum: []string{"snippets", "articles", "both"}, Default: "both"},
				{Name: "speed_seconds", Type: FieldInteger, Label: "Durasi putaran (detik)", Min: ip(5), Max: ip(120), Default: 26},
				{Name: "limit", Type: FieldInteger, Label: "Jumlah item", Min: ip(1), Max: ip(20), Default: 6},
			},
		},
		{
			Type: TypeArticleGrid, Label: "Grid Artikel",
			Description: "Grid kartu artikel 2/3/4 kolom.",
			Fields: concat([]Field{
				{Name: "category_slug", Type: FieldString, Label: "Kategori", Description: "Kosong = semua kategori.", Max: ip(160), Pattern: slugPattern, PatternMsg: slugMsg, UI: UICategorySlug},
				{Name: "include_children", Type: FieldBoolean, Label: "Sertakan subkategori", Default: true},
				{Name: "tag_slug", Type: FieldString, Label: "Tag", Max: ip(160), Pattern: slugPattern, PatternMsg: slugMsg, UI: UITagSlug},
				{Name: "columns", Type: FieldInteger, Label: "Kolom", IntEnum: []int{2, 3, 4}, Default: 3},
				{Name: "limit", Type: FieldInteger, Label: "Jumlah artikel", Min: ip(1), Max: ip(12), Default: 6},
				{Name: "show_excerpt", Type: FieldBoolean, Label: "Tampilkan ringkasan", Default: true},
				{Name: "show_author", Type: FieldBoolean, Label: "Tampilkan penulis", Default: true},
				{Name: "show_reading_time", Type: FieldBoolean, Label: "Tampilkan waktu baca", Default: true},
				{Name: "image_ratio", Type: FieldEnum, Label: "Rasio gambar", Enum: []string{"4/3", "16/9", "1/1"}, Default: "4/3"},
			}, dedupeFields(true)),
		},
		{
			Type: TypeLatestWithSidebar, Label: "Terbaru + Sidebar",
			Description: "Daftar artikel terbaru dengan widget sidebar.",
			Fields: concat([]Field{
				{Name: "list_title", Type: FieldString, Label: "Judul daftar", Max: ip(120), Default: "Berita Terbaru"},
				{Name: "limit", Type: FieldInteger, Label: "Jumlah artikel", Min: ip(1), Max: ip(12), Default: 4},
				{Name: "category_slug", Type: FieldString, Label: "Kategori", Description: "Kosong = semua kategori.", Max: ip(160), Pattern: slugPattern, PatternMsg: slugMsg, UI: UICategorySlug},
				{Name: "widgets", Type: FieldEnumArray, Label: "Widget sidebar", Description: "Urutan = urutan tampil.", Enum: []string{WidgetPopular, WidgetCategories, WidgetTags, WidgetNextEvent}, Max: ip(4), Default: []string{WidgetPopular, WidgetCategories, WidgetTags, WidgetNextEvent}, UI: UIWidgets},
				{Name: "popular_limit", Type: FieldInteger, Label: "Jumlah populer", Min: ip(1), Max: ip(10), Default: 3},
				{Name: "popular_days", Type: FieldInteger, Label: "Rentang populer (hari)", Min: ip(1), Max: ip(365), Default: 30},
				{Name: "tags_limit", Type: FieldInteger, Label: "Jumlah tag", Min: ip(1), Max: ip(30), Default: 8},
			}, dedupeFields(false)),
		},
		{
			Type: TypeQuoteRotator, Label: "Kutipan Berputar",
			Description: "Kutipan besar berganti otomatis (dari snippet kutipan).",
			Fields: []Field{
				{Name: "interval_seconds", Type: FieldInteger, Label: "Interval (detik)", Min: ip(2), Max: ip(60), Default: 6},
				{Name: "order", Type: FieldEnum, Label: "Urutan", Enum: []string{"sequential", "random"}, Default: "sequential"},
			},
		},
		{
			Type: TypeTimeline, Label: "Timeline Kegiatan",
			Description: "Garis waktu artikel kegiatan.",
			Fields: concat([]Field{
				{Name: "category_slug", Type: FieldString, Label: "Kategori", Max: ip(160), Pattern: slugPattern, PatternMsg: slugMsg, UI: UICategorySlug, Default: "yayasan"},
				{Name: "limit", Type: FieldInteger, Label: "Jumlah artikel", Min: ip(1), Max: ip(12), Default: 3},
				{Name: "order_by", Type: FieldEnum, Label: "Urutkan berdasarkan", Enum: []string{"event_date", "published_at"}, Default: "event_date"},
			}, dedupeFields(false)),
		},
		{
			Type: TypeFeatureSplit, Label: "Artikel Utama + Daftar",
			Description: "Satu artikel utama dan daftar artikel dengan thumbnail.",
			Fields: concat([]Field{
				{Name: "category_slug", Type: FieldString, Label: "Kategori", Description: "Kosong = semua kategori.", Max: ip(160), Pattern: slugPattern, PatternMsg: slugMsg, UI: UICategorySlug},
				{Name: "featured_label", Type: FieldString, Label: "Label artikel utama", Max: ip(60), Default: "Opini Utama"},
				{Name: "side_limit", Type: FieldInteger, Label: "Jumlah artikel samping", Min: ip(1), Max: ip(8), Default: 3},
				{Name: "show_author_title", Type: FieldBoolean, Label: "Tampilkan jabatan penulis", Default: true},
			}, dedupeFields(false)),
		},
		{
			Type: TypePeopleGrid, Label: "Grid Tokoh",
			Description: "Grid foto tokoh alumni.",
			Fields: []Field{
				{Name: "limit", Type: FieldInteger, Label: "Jumlah tokoh", Min: ip(1), Max: ip(12), Default: 4},
				{Name: "only_featured", Type: FieldBoolean, Label: "Hanya tokoh unggulan", Default: true},
				{Name: "columns", Type: FieldInteger, Label: "Kolom", IntEnum: []int{3, 4}, Default: 4},
				{Name: "cta_label", Type: FieldString, Label: "Teks tombol", Max: ip(40), Default: "Baca Kisah"},
			},
		},
		{
			Type: TypeAgendaCalendar, Label: "Agenda + Kalender",
			Description: "Daftar agenda mendatang dan kalender bulan.",
			Fields: []Field{
				{Name: "limit", Type: FieldInteger, Label: "Jumlah agenda", Min: ip(1), Max: ip(12), Default: 3},
				{Name: "show_calendar", Type: FieldBoolean, Label: "Tampilkan kalender", Default: true},
				{Name: "calendar_month", Type: FieldEnum, Label: "Bulan kalender", Description: "current = bulan ini (jika kosong, bulan agenda berikutnya).", Enum: []string{"current", "next_event"}, Default: "current"},
			},
		},
		{
			Type: TypeVideoGallery, Label: "Galeri Video",
			Description: "Satu video besar dan video kecil.",
			Fields: []Field{
				{Name: "limit", Type: FieldInteger, Label: "Jumlah video", Min: ip(1), Max: ip(12), Default: 3},
				{Name: "layout", Type: FieldEnum, Label: "Tata letak", Enum: []string{"feature", "grid"}, Default: "feature"},
			},
		},
		{
			Type: TypeFAQ, Label: "FAQ",
			Description: "Accordion pertanyaan umum (dari snippet FAQ).",
			Fields: []Field{
				{Name: "default_open_index", Type: FieldInteger, Label: "Item terbuka awal", Description: "-1 = semua tertutup.", Min: ip(-1), Max: ip(50), Default: 0},
				{Name: "limit", Type: FieldInteger, Label: "Jumlah maksimum", Description: "Kosong = semua.", Min: ip(1), Max: ip(50)},
			},
		},
		{
			Type: TypeNewsletter, Label: "Newsletter",
			Description: "Formulir berlangganan (belum aktif di MVP).",
			Fields: []Field{
				{Name: "description", Type: FieldString, Label: "Deskripsi", Max: ip(500), UI: UITextarea},
				{Name: "button_label", Type: FieldString, Label: "Teks tombol", Max: ip(40), Default: "Subscribe"},
				{Name: "placeholder", Type: FieldString, Label: "Placeholder", Max: ip(120), Default: "Alamat email Anda"},
			},
		},
		{
			Type: TypeRichText, Label: "Teks Bebas",
			Description: "Blok teks/HTML bebas (disanitasi).",
			Fields: []Field{
				{Name: "content_html", Type: FieldString, Label: "Konten", Max: ip(100000), UI: UIRichText, Default: ""},
				{Name: "align", Type: FieldEnum, Label: "Perataan", Enum: []string{"left", "center", "right"}, Default: "left"},
				{Name: "max_width", Type: FieldEnum, Label: "Lebar maksimum", Enum: []string{"prose", "wide", "full"}, Default: "prose"},
			},
			Validate: func(cfg map[string]any) map[string]string {
				if s, ok := cfg["content_html"].(string); ok {
					cfg["content_html"] = richtext.Sanitize(s)
				}
				return nil
			},
		},
	}
}
