package category_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/category"
	"portal-berita/backend/internal/dbgen"
)

func ptr[T any](v T) *T { return &v }

func sampleRows() []dbgen.ListCategoriesWithCountsRow {
	return []dbgen.ListCategoriesWithCountsRow{
		{ID: 1, ParentID: nil, Name: "Kajian", Slug: "kajian", IsActive: true, ArticleCount: 2},
		{ID: 2, ParentID: nil, Name: "Kabar & Agenda", Slug: "kabar-agenda", IsActive: false, ArticleCount: 0},
		{ID: 3, ParentID: ptr(int64(1)), Name: "Fikih", Slug: "fikih", IsActive: true, ArticleCount: 5},
		{ID: 4, ParentID: ptr(int64(1)), Name: "Tafsir (nonaktif)", Slug: "tafsir", IsActive: false, ArticleCount: 1},
		{ID: 5, ParentID: ptr(int64(2)), Name: "Anak Inaktif", Slug: "anak-inaktif", IsActive: true, ArticleCount: 3},
	}
}

func TestBuildTreeAll(t *testing.T) {
	tree := category.BuildTree(sampleRows(), false)
	require.Len(t, tree, 2)
	assert.Equal(t, "kajian", tree[0].Slug)
	require.Len(t, tree[0].Children, 2)
	assert.Equal(t, "fikih", tree[0].Children[0].Slug)
	assert.Equal(t, "tafsir", tree[0].Children[1].Slug)
	// Parent count aggregates its own (2) + children (5+1).
	assert.Equal(t, int64(8), tree[0].ArticleCount)

	assert.Equal(t, "kabar-agenda", tree[1].Slug)
	require.Len(t, tree[1].Children, 1)
	assert.Equal(t, int64(3), tree[1].ArticleCount)
}

func TestBuildTreeActiveOnly(t *testing.T) {
	tree := category.BuildTree(sampleRows(), true)
	// kabar-agenda is inactive -> dropped, taking its (active) child with it.
	require.Len(t, tree, 1)
	assert.Equal(t, "kajian", tree[0].Slug)
	// tafsir is inactive -> dropped; only fikih remains, count = own(2)+fikih(5).
	require.Len(t, tree[0].Children, 1)
	assert.Equal(t, "fikih", tree[0].Children[0].Slug)
	assert.Equal(t, int64(7), tree[0].ArticleCount)
}

func TestSEOFor(t *testing.T) {
	n := category.TreeNode{Name: "Kajian", Description: ptr("Deskripsi kategori.")}
	seo := category.SEOFor(n)
	assert.Equal(t, "Kajian", seo.Title)
	assert.Equal(t, "Deskripsi kategori.", seo.Description)

	n.SeoTitle = ptr("Kajian Islam - ALMAIDAH")
	n.SeoDescription = ptr("Deskripsi SEO khusus.")
	seo = category.SEOFor(n)
	assert.Equal(t, "Kajian Islam - ALMAIDAH", seo.Title)
	assert.Equal(t, "Deskripsi SEO khusus.", seo.Description)
}
