package content

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/dbgen"
)

func ptr[T any](v T) *T { return &v }

func TestArticleURL(t *testing.T) {
	assert.Equal(t, "/kajian/adab-menuntut-ilmu", ArticleURL("kajian", "adab-menuntut-ilmu"))
	assert.Equal(t, "/agenda/reuni", EventURL("reuni"))
	assert.Equal(t, "/tokoh/budi", AlumniURL("budi"))
	assert.Equal(t, "/video/v1", VideoURL("v1"))
	assert.Equal(t, "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", YouTubeThumbnailURL("abcdefghijk"))
}

func TestIsPublic(t *testing.T) {
	now := time.Date(2026, 9, 27, 10, 0, 0, 0, time.UTC)
	past, future := now.Add(-time.Minute), now.Add(time.Minute)
	assert.True(t, IsPublic(StatusPublished, &past, now))
	assert.True(t, IsPublic(StatusPublished, &now, now))
	assert.False(t, IsPublic(StatusPublished, &future, now))
	assert.False(t, IsPublic(StatusPublished, nil, now))
	assert.False(t, IsPublic(StatusScheduled, &past, now))
	assert.False(t, IsPublic(StatusDraft, &past, now))
	assert.False(t, IsPublic(StatusArchived, &past, now))
}

func TestCategoryRefsFrom(t *testing.T) {
	rows := []dbgen.Category{
		{ID: 1, Name: "Kajian", Slug: "kajian"},
		{ID: 2, Name: "Fikih", Slug: "fikih", ParentID: ptr(int64(1))},
		{ID: 3, Name: "Yatim", Slug: "yatim", ParentID: ptr(int64(99))},
	}
	refs := CategoryRefsFrom(rows)
	require.Len(t, refs, 3)
	assert.Nil(t, refs[1].Parent)
	assert.Equal(t, "kajian", refs[1].Level1Slug())
	require.NotNil(t, refs[2].Parent)
	assert.Equal(t, "kajian", refs[2].Parent.Slug)
	assert.Nil(t, refs[2].Parent.Parent)
	assert.Equal(t, "kajian", refs[2].Level1Slug())
	assert.Nil(t, refs[3].Parent, "unknown parent is dropped")
}

func TestBuildCard(t *testing.T) {
	pub := time.Date(2026, 9, 1, 0, 30, 0, 0, time.UTC)
	ev := time.Date(2026, 8, 17, 0, 0, 0, 0, time.UTC)
	cats := CategoryRefsFrom([]dbgen.Category{
		{ID: 1, Name: "Kajian", Slug: "kajian"},
		{ID: 2, Name: "Fikih", Slug: "fikih", ParentID: ptr(int64(1))},
	})
	authors := map[int64]dbgen.ListUsersByIDsRow{7: {ID: 7, DisplayName: "Ust. A", Slug: "ust-a", AvatarMediaID: ptr(int64(5))}}
	media := map[int64]Media{5: {ID: 5, URL: "/uploads/a.png"}, 6: {ID: 6, URL: "/uploads/c.png"}}
	c := buildCard(dbgen.Article{
		ID: 10, Slug: "adab", Title: "Adab", CategoryID: 2, AuthorID: 7, CoverMediaID: ptr(int64(6)),
		PublishedAt: &pub, EventDate: &ev, ReadingMinutes: 3,
	}, cats, authors, media)
	assert.Equal(t, "/kajian/adab", c.URL)
	require.NotNil(t, c.Cover)
	assert.Equal(t, "/uploads/c.png", c.Cover.URL)
	require.NotNil(t, c.Author.Avatar)
	assert.Equal(t, "2026-09-01T07:30:00+07:00", *c.PublishedAt)
	assert.Equal(t, "2026-08-17", *c.EventDate)

	raw, err := json.Marshal(c)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	for _, k := range []string{"id", "slug", "title", "excerpt", "url", "cover", "category", "author", "published_at",
		"reading_minutes", "event_date", "event_location", "is_featured", "is_breaking", "view_count"} {
		assert.Contains(t, m, k)
	}
	assert.NotContains(t, m["author"], "email")
}

func TestUniqueIDs(t *testing.T) {
	assert.Equal(t, []int64{3, 1}, uniqueIDs([]int64{3, 0, 1, 3, 1}))
	assert.Empty(t, uniqueIDs(nil))
}
