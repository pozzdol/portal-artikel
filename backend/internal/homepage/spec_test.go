package homepage

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
)

var allTypes = []string{
	"hero_trending", "breaking_ticker", "article_grid", "latest_with_sidebar", "quote_rotator",
	"timeline", "feature_split", "people_grid", "agenda_calendar", "video_gallery", "faq",
	"newsletter", "rich_text",
}

func TestRegistryHasAllTypes(t *testing.T) {
	reg := NewRegistry()
	assert.Equal(t, allTypes, reg.TypeNames(), "registry order = migration CHECK order")
	for _, typ := range allTypes {
		assert.True(t, reg.Has(typ), typ)
		_, ok := resolvers[typ]
		assert.True(t, ok, "resolver for %s", typ)
		_, ok = configPrototypes[typ]
		assert.True(t, ok, "config struct for %s", typ)
	}
	assert.False(t, reg.Has("carousel"))
}

func TestDefaultsNormalizeAndDecode(t *testing.T) {
	reg := NewRegistry()
	for _, info := range reg.Types() {
		t.Run(info.Type, func(t *testing.T) {
			v := configPrototypes[info.Type]()
			dec := json.NewDecoder(strings.NewReader(string(info.DefaultConfig)))
			dec.DisallowUnknownFields()
			require.NoError(t, dec.Decode(v))
			// Normalizing the default again is a fixed point.
			again, err := reg.Normalize(info.Type, info.DefaultConfig)
			require.NoError(t, err)
			assert.JSONEq(t, string(info.DefaultConfig), string(again))
		})
	}
}

// jsonFieldNames flattens embedded structs like encoding/json does.
func jsonFieldNames(t reflect.Type) []string {
	var out []string
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.Anonymous {
			out = append(out, jsonFieldNames(f.Type)...)
			continue
		}
		name := strings.Split(f.Tag.Get("json"), ",")[0]
		if name != "" && name != "-" {
			out = append(out, name)
		}
	}
	return out
}

func TestSpecMatchesConfigStructs(t *testing.T) {
	reg := NewRegistry()
	for _, typ := range allTypes {
		spec, _ := reg.spec(typ)
		var specNames []string
		for _, f := range spec.Fields {
			specNames = append(specNames, f.Name)
		}
		structNames := jsonFieldNames(reflect.TypeOf(configPrototypes[typ]()).Elem())
		sort.Strings(specNames)
		sort.Strings(structNames)
		assert.Equal(t, specNames, structNames, typ)
	}
	// more_link sub-fields match MoreLink.
	var sub []string
	for _, f := range commonFields {
		if f.Name == "more_link" {
			for _, s := range f.Fields {
				sub = append(sub, s.Name)
			}
		}
	}
	assert.ElementsMatch(t, sub, jsonFieldNames(reflect.TypeOf(MoreLink{})))
}

// seedSectionRE extracts {pos, "type", "label", active, `config`} from db/seed/base.go.
var seedSectionRE = regexp.MustCompile("\\{(\\d+), \"([a-z_]+)\", \"[^\"]*\", (?:true|false),\\s*`([^`]*)`\\}")

func TestSeedConfigsNormalize(t *testing.T) {
	src, err := os.ReadFile("../../db/seed/base.go")
	require.NoError(t, err)
	matches := seedSectionRE.FindAllStringSubmatch(string(src), -1)
	require.Len(t, matches, 13, "base.go seeds 13 sections")
	reg := NewRegistry()
	for _, m := range matches {
		typ, cfg := m[2], m[3]
		norm, err := reg.Normalize(typ, json.RawMessage(cfg))
		require.NoError(t, err, "seed section %s %s", m[1], typ)
		// Every seeded key survives normalization unchanged.
		var in, out map[string]any
		require.NoError(t, json.Unmarshal([]byte(cfg), &in))
		require.NoError(t, json.Unmarshal(norm, &out))
		for k, v := range in {
			assert.Equal(t, v, out[k], "%s.%s", typ, k)
		}
	}
}

func fieldErrors(t *testing.T, err error) map[string]string {
	t.Helper()
	require.Error(t, err)
	var ae *apperr.Error
	require.True(t, errors.As(err, &ae), "apperr.Error expected, got %v", err)
	require.ErrorIs(t, err, apperr.ErrValidation)
	return ae.Fields
}

func TestNormalizeRejectsInvalid(t *testing.T) {
	reg := NewRegistry()
	cases := []struct {
		typ, cfg, field string
	}{
		{"article_grid", `{"columns":5}`, "config.columns"},
		{"article_grid", `{"limit":13}`, "config.limit"},
		{"article_grid", `{"limit":2.5}`, "config.limit"},
		{"article_grid", `{"foo":1}`, "config.foo"},
		{"article_grid", `{"category_slug":"Bad Slug"}`, "config.category_slug"},
		{"article_grid", `{"image_ratio":"21/9"}`, "config.image_ratio"},
		{"article_grid", `{"show_excerpt":"yes"}`, "config.show_excerpt"},
		{"hero_trending", `{"trending_limit":9}`, "config.trending_limit"},
		{"hero_trending", `{"trending_limit":2}`, "config.trending_limit"},
		{"hero_trending", `{"hero_source":"manual"}`, "config.hero_article_id"},
		{"hero_trending", `{"hero_source":"random"}`, "config.hero_source"},
		{"latest_with_sidebar", `{"widgets":["popular","weather"]}`, "config.widgets[1]"},
		{"latest_with_sidebar", `{"widgets":["tags","tags"]}`, "config.widgets[1]"},
		{"latest_with_sidebar", `{"widgets":"tags"}`, "config.widgets"},
		{"people_grid", `{"columns":2}`, "config.columns"},
		{"faq", `{"default_open_index":-2}`, "config.default_open_index"},
		{"timeline", `{"more_link":{"label":"x"}}`, "config.more_link.href"},
		{"timeline", `{"more_link":{"label":"x","href":"javascript:alert(1)"}}`, "config.more_link.href"},
		{"timeline", `{"more_link":{"label":"x","href":"/a","extra":1}}`, "config.more_link.extra"},
		{"timeline", `{"background":"red"}`, "config.background"},
		{"timeline", `{"anchor_id":"Kajian Utama"}`, "config.anchor_id"},
		{"quote_rotator", `[1,2]`, "config"},
		{"quote_rotator", `{bad`, "config"},
		{"carousel", `{}`, "type"},
	}
	for _, c := range cases {
		t.Run(c.typ+" "+c.cfg, func(t *testing.T) {
			_, err := reg.Normalize(c.typ, json.RawMessage(c.cfg))
			fields := fieldErrors(t, err)
			assert.Contains(t, fields, c.field, "fields=%v", fields)
		})
	}
}

func TestNormalizeFillsDefaultsAndDropsEmpty(t *testing.T) {
	reg := NewRegistry()
	norm, err := reg.Normalize("article_grid", json.RawMessage(`{"category_slug":"","title":"  Kajian  ","hero_article_id_x":null}`))
	fields := fieldErrors(t, err)
	assert.Contains(t, fields, "config.hero_article_id_x")
	assert.Nil(t, norm)

	norm, err = reg.Normalize("article_grid", json.RawMessage(`{"category_slug":"","title":"  Kajian  ","tag_slug":null}`))
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(norm, &m))
	assert.Equal(t, "Kajian", m["title"])
	assert.NotContains(t, m, "category_slug")
	assert.NotContains(t, m, "tag_slug")
	assert.EqualValues(t, 3, m["columns"])
	assert.EqualValues(t, 6, m["limit"])
	assert.Equal(t, true, m["exclude_hero"])
	assert.Equal(t, false, m["dedupe"])

	norm, err = reg.Normalize("hero_trending", json.RawMessage(`{"hero_source":"manual","hero_article_id":42}`))
	require.NoError(t, err)
	var hero HeroTrendingConfig
	require.NoError(t, json.Unmarshal(norm, &hero))
	require.NotNil(t, hero.HeroArticleID)
	assert.EqualValues(t, 42, *hero.HeroArticleID)
	assert.Equal(t, 5, hero.TrendingLimit)
	assert.Equal(t, "Trending Hari Ini", hero.TrendingTitle)
}

func TestRichTextSanitized(t *testing.T) {
	reg := NewRegistry()
	norm, err := reg.Normalize("rich_text", json.RawMessage(`{"content_html":"<p onclick=\"x()\">Halo</p><script>alert(1)</script>"}`))
	require.NoError(t, err)
	var cfg RichTextConfig
	require.NoError(t, json.Unmarshal(norm, &cfg))
	assert.Equal(t, "<p>Halo</p>", cfg.ContentHTML)
	assert.Equal(t, "left", cfg.Align)
}

func TestSchemaRendering(t *testing.T) {
	reg := NewRegistry()
	for _, typ := range allTypes {
		s := reg.Schema(typ)
		require.NotNil(t, s, typ)
		assert.Equal(t, "object", s["type"])
		assert.Equal(t, false, s["additionalProperties"])
		props := s["properties"].(map[string]any)
		for _, common := range []string{"anchor_id", "eyebrow", "title", "more_link", "background"} {
			assert.Contains(t, props, common, typ)
		}
	}
	grid := reg.Schema("article_grid")
	props := grid["properties"].(map[string]any)
	cat := props["category_slug"].(map[string]any)
	assert.Equal(t, "category_slug", cat["x-ui"])
	cols := props["columns"].(map[string]any)
	assert.Equal(t, []int{2, 3, 4}, cols["enum"])
	assert.Equal(t, 3, cols["default"])
	more := props["more_link"].(map[string]any)
	assert.Equal(t, false, more["additionalProperties"])
	assert.ElementsMatch(t, []string{"label", "href"}, more["required"])

	lws := reg.Schema("latest_with_sidebar")["properties"].(map[string]any)
	widgets := lws["widgets"].(map[string]any)
	assert.Equal(t, "array", widgets["type"])
	assert.Equal(t, true, widgets["uniqueItems"])
	assert.Equal(t, "widgets", widgets["x-ui"])

	// The schema must be JSON-serializable.
	b, err := json.Marshal(reg.Types())
	require.NoError(t, err)
	assert.Contains(t, string(b), `"$schema":"http://json-schema.org/draft-07/schema#"`)
	assert.Nil(t, reg.Schema("carousel"))
}
