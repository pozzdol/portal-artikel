package homepage

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/content"
	"portal-berita/backend/internal/dbgen"
)

func cards(ids ...int64) []content.ArticleCard {
	out := make([]content.ArticleCard, len(ids))
	for i, id := range ids {
		out[i] = content.ArticleCard{ID: id}
	}
	return out
}

func ids(cs []content.ArticleCard) []int64 {
	out := make([]int64, len(cs))
	for i, c := range cs {
		out[i] = c.ID
	}
	return out
}

func TestFinalizeDedupeInPositionOrder(t *testing.T) {
	hero := &HeroTrendingData{Hero: &content.ArticleCard{ID: 1}, Trending: cards(2, 3)}
	// exclude_hero only: drops 1, keeps trending ids.
	gridA := &ArticleListData{cands: cards(1, 2, 4, 5), pick: pickOpts{limit: 3, excludeHero: true}}
	// dedupe: drops everything shown before (1,2,3 from hero; 2,4,5 from gridA).
	gridB := &ArticleListData{cands: cards(1, 2, 3, 4, 5, 6, 7), pick: pickOpts{limit: 2, dedupe: true}}
	// neither: may repeat.
	gridC := &ArticleListData{cands: cards(1, 2), pick: pickOpts{limit: 5}}
	split := &FeatureSplitData{
		featuredCands: cards(6, 8), cands: cards(6, 8, 9, 10, 11), sideLimit: 2,
		pick: pickOpts{limit: 2, dedupe: true},
	}

	seen := newSeenSet(1)
	for _, f := range []finalizer{hero, gridA, gridB, gridC, split} {
		f.finalize(seen)
	}
	assert.Equal(t, []int64{2, 4, 5}, ids(gridA.Items))
	assert.Equal(t, []int64{6, 7}, ids(gridB.Items))
	assert.Equal(t, []int64{1, 2}, ids(gridC.Items))
	require.NotNil(t, split.Featured)
	assert.EqualValues(t, 8, split.Featured.ID, "6 was shown by gridB")
	assert.Equal(t, []int64{9, 10}, ids(split.Items))
}

func TestFeatureSplitFallsBackToLatest(t *testing.T) {
	d := &FeatureSplitData{cands: cards(4, 5, 6), sideLimit: 3, pick: pickOpts{limit: 3}}
	d.finalize(newSeenSet(0))
	require.NotNil(t, d.Featured)
	assert.EqualValues(t, 4, d.Featured.ID)
	assert.Equal(t, []int64{5, 6}, ids(d.Items))

	empty := &FeatureSplitData{Items: []content.ArticleCard{}, pick: pickOpts{limit: 3}, sideLimit: 3}
	empty.finalize(newSeenSet(0))
	assert.Nil(t, empty.Featured)
	assert.NotNil(t, empty.Items)
}

func TestEmptyDataMarshalsArrays(t *testing.T) {
	for typ, r := range resolvers {
		d := r.empty()
		if f, ok := d.(finalizer); ok {
			f.finalize(newSeenSet(0))
		}
		b, err := json.Marshal(d)
		require.NoError(t, err, typ)
		assert.NotContains(t, string(b), `"items":null`, typ)
		assert.NotContains(t, string(b), `"trending":null`, typ)
		assert.NotContains(t, string(b), `"quotes":null`, typ)
	}
}

func TestCatIndex(t *testing.T) {
	root := int64(1)
	rows := []dbgen.Category{
		{ID: 1, Slug: "kajian", Name: "Kajian", IsActive: true},
		{ID: 2, Slug: "off", Name: "Off", IsActive: false},
		{ID: 3, Slug: "fikih", Name: "Fikih", ParentID: &root, IsActive: true},
		{ID: 4, Slug: "lama", Name: "Lama", ParentID: &root, IsActive: false},
	}
	c := newCatIndex(rows)
	got, ok := c.ids("kajian", true)
	assert.True(t, ok)
	assert.Equal(t, []int64{1, 3}, got)
	got, ok = c.ids("kajian", false)
	assert.True(t, ok)
	assert.Equal(t, []int64{1}, got)
	_, ok = c.ids("off", true)
	assert.False(t, ok)
	_, ok = c.ids("missing", true)
	assert.False(t, ok)
	assert.Equal(t, "/kajian/adab", c.articleURL(dbgen.Article{CategoryID: 3, Slug: "adab"}))
}

func TestSameIDSet(t *testing.T) {
	assert.True(t, sameIDSet([]int64{1, 2, 3}, []int64{3, 1, 2}))
	assert.False(t, sameIDSet([]int64{1, 2, 3}, []int64{1, 2}))
	assert.False(t, sameIDSet([]int64{1, 2, 3}, []int64{1, 2, 2}))
	assert.False(t, sameIDSet([]int64{1, 2, 3}, []int64{1, 2, 4}))
}
