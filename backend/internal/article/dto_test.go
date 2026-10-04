package article

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

func sp(s string) *string { return &s }

func validInput() Input {
	return Input{
		Title:       "Judul Uji",
		ContentJSON: json.RawMessage(`{"type":"doc","content":[]}`),
		ContentHTML: sp("<p>Isi artikel uji.</p>"),
		CategoryID:  1,
	}
}

func fieldsOf(t *testing.T, err error) map[string]string {
	t.Helper()
	var ae *apperr.Error
	require.True(t, errors.As(err, &ae), "want *apperr.Error, got %v", err)
	require.ErrorIs(t, err, apperr.ErrValidation)
	return ae.Fields
}

func TestInputStructValidation(t *testing.T) {
	in := Input{}
	fields := validationFields(t, in)
	assert.Equal(t, "Wajib diisi.", fields["title"])
	assert.Equal(t, "Wajib diisi.", fields["content_json"])
	assert.Equal(t, "Wajib diisi.", fields["content_html"])
	assert.Equal(t, "Wajib diisi.", fields["category_id"])

	in = validInput()
	in.Title = strings.Repeat("a", 201)
	in.Excerpt = sp(strings.Repeat("b", 301))
	in.CanonicalURL = sp("bukan url")
	in.EventDate = sp("27-09-2026")
	in.TagIDs = []int64{0}
	fields = validationFields(t, in)
	assert.Equal(t, "Maksimal 200 karakter.", fields["title"])
	assert.Equal(t, "Maksimal 300 karakter.", fields["excerpt"])
	assert.Equal(t, "Format URL tidak valid.", fields["canonical_url"])
	assert.Contains(t, fields, "event_date")
	assert.Contains(t, fields, "tag_ids[0]")

	assert.NoError(t, httpx.Validate(validInput()))
}

// validationFields runs struct validation and renders the 422 field map the
// way httpx.WriteError does.
func validationFields(t *testing.T, in Input) map[string]string {
	t.Helper()
	err := httpx.Validate(in)
	require.Error(t, err)
	rec := httptest.NewRecorder()
	httpx.WriteError(rec, httptest.NewRequest(http.MethodPost, "/articles", nil), err)
	var body struct {
		Error struct {
			Fields map[string]string `json:"fields"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return body.Error.Fields
}

func TestPrepareInput(t *testing.T) {
	in := validInput()
	in.ContentHTML = sp(`<p>Kalimat pertama yang cukup panjang. Kalimat kedua.</p><script>alert(1)</script><img src="x" onerror="alert(2)">`)
	in.EventDate = sp("2026-09-01")
	in.NewTags = []string{" Reuni Akbar ", "reuni akbar", "Beasiswa"}
	in.SeoTitle = sp("   ")
	p, err := prepareInput(in)
	require.NoError(t, err)
	assert.NotContains(t, p.ContentHTML, "script")
	assert.NotContains(t, p.ContentHTML, "onerror")
	assert.Contains(t, p.ContentText, "Kalimat pertama")
	assert.Equal(t, int16(1), p.ReadingMinutes)
	require.NotNil(t, p.Excerpt)
	assert.Contains(t, *p.Excerpt, "Kalimat pertama")
	require.NotNil(t, p.EventDate)
	assert.Equal(t, "2026-09-01", httpx.FormatDate(*p.EventDate))
	assert.Nil(t, p.SeoTitle)
	require.Len(t, p.NewTags, 2)
	assert.Equal(t, "reuni-akbar", p.NewTags[0].Slug)
	assert.Equal(t, "Reuni Akbar", p.NewTags[0].Name)
	assert.JSONEq(t, `{"type":"doc","content":[]}`, string(p.ContentJSON))

	// An explicit excerpt wins over the auto excerpt.
	in = validInput()
	in.Excerpt = sp("  Ringkasan manual.  ")
	p, err = prepareInput(in)
	require.NoError(t, err)
	assert.Equal(t, "Ringkasan manual.", *p.Excerpt)

	cases := []struct {
		name  string
		mod   func(*Input)
		field string
	}{
		{"content_json array", func(i *Input) { i.ContentJSON = json.RawMessage(`[1,2]`) }, "content_json"},
		{"content_json wrong type", func(i *Input) { i.ContentJSON = json.RawMessage(`{"type":"paragraph"}`) }, "content_json"},
		{"content_json null", func(i *Input) { i.ContentJSON = json.RawMessage(`null`) }, "content_json"},
		{"slug invalid", func(i *Input) { i.Slug = sp("Judul Besar") }, "slug"},
		{"canonical scheme", func(i *Input) { i.CanonicalURL = sp("ftp://contoh.id/a") }, "canonical_url"},
		{"event date", func(i *Input) { i.EventDate = sp("2026-13-40") }, "event_date"},
		{"blank title", func(i *Input) { i.Title = "   " }, "title"},
		{"bad new tag", func(i *Input) { i.NewTags = []string{"!!!"} }, "new_tags[0]"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			in := validInput()
			c.mod(&in)
			_, err := prepareInput(in)
			assert.Contains(t, fieldsOf(t, err), c.field)
		})
	}
}

func art(id int64) dbgen.Article { return dbgen.Article{ID: id} }

func TestMergeRelated(t *testing.T) {
	got := mergeRelated(1, 4,
		[]dbgen.Article{art(2), art(1), art(3)},
		[]dbgen.Article{art(3), art(4)},
		[]dbgen.Article{art(5), art(6)},
	)
	ids := make([]int64, len(got))
	for i, a := range got {
		ids[i] = a.ID
	}
	assert.Equal(t, []int64{2, 3, 4, 5}, ids)
	assert.Empty(t, mergeRelated(1, 4))
	assert.Len(t, mergeRelated(1, 2, []dbgen.Article{art(2), art(3), art(4)}), 2)
	assert.Equal(t, []int64{1, 2, 3}, excludeIDs(1, []dbgen.Article{art(2), art(3)}))
}

func TestRevalTags(t *testing.T) {
	parent := int64(1)
	cats := content.CategoryRefsFrom([]dbgen.Category{
		{ID: 1, Slug: "kajian"},
		{ID: 2, Slug: "fikih", ParentID: &parent},
		{ID: 3, Slug: "opini"},
	})
	authors := map[int64]string{10: "ust-a", 11: "ust-b"}
	tags := revalTags(cats, authors,
		[]revalRef{{Slug: "lama", CategoryID: 3, AuthorID: 10}, {Slug: "baru", CategoryID: 2, AuthorID: 11}},
		[]string{"fikih", "reuni", "fikih"})
	assert.Equal(t, []string{
		"article:baru", "article:lama", "author:ust-a", "author:ust-b",
		"category:fikih", "category:kajian", "category:opini",
		"homepage", "search", "sitemap", "tag:fikih", "tag:reuni", "trending",
	}, tags)
}

func TestCategoryTreeIDs(t *testing.T) {
	p := int64(1)
	rows := []dbgen.Category{
		{ID: 1, Slug: "kajian", IsActive: true},
		{ID: 2, Slug: "fikih", ParentID: &p, IsActive: true},
		{ID: 3, Slug: "tafsir", ParentID: &p, IsActive: false},
		{ID: 4, Slug: "opini", IsActive: false},
	}
	ids, ok := categoryTreeIDs(rows, "kajian", true)
	assert.True(t, ok)
	assert.Equal(t, []int64{1, 2}, ids)
	ids, ok = categoryTreeIDs(rows, "kajian", false)
	assert.True(t, ok)
	assert.Equal(t, []int64{1, 2, 3}, ids)
	_, ok = categoryTreeIDs(rows, "opini", true)
	assert.False(t, ok)
	_, ok = categoryTreeIDs(rows, "tidak-ada", false)
	assert.False(t, ok)
}

func TestWithSuffix(t *testing.T) {
	assert.Equal(t, "judul-2", withSuffix("judul", 2))
	long := strings.Repeat("a", 159) + "-b"
	s := withSuffix(long, 12)
	assert.LessOrEqual(t, len(s), 160)
	assert.True(t, strings.HasSuffix(s, "-12"))
	assert.NotContains(t, s, "--")
}
