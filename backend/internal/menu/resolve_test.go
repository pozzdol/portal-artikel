package menu

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"portal-berita/backend/internal/dbgen"
)

func testCats() map[string]categoryInfo {
	rows := []dbgen.Category{
		{ID: 1, Name: "Kajian", Slug: "kajian", IsActive: true},
		{ID: 2, ParentID: ptr(int64(1)), Name: "Fikih", Slug: "fikih", IsActive: true},
		{ID: 3, Name: "Nonaktif", Slug: "nonaktif", IsActive: false},
	}
	return categoryLookup(rows)
}

func ptr[T any](v T) *T { return &v }

func TestResolveHref(t *testing.T) {
	cats := testCats()
	pages := pageSlugSet([]string{"profil-yayasan"})

	cases := []struct {
		name       string
		linkType   string
		linkTarget string
		wantHref   string
		wantOK     bool
	}{
		{"route valid", "route", "/agenda", "/agenda", true},
		{"route invalid", "route", "/tidak-ada", "", false},
		{"anchor", "anchor", "kajian", "/#kajian", true},
		{"anchor empty", "anchor", "", "", false},
		{"url https", "url", "https://example.com", "https://example.com", true},
		{"url relative", "url", "/tag/beasiswa", "/tag/beasiswa", true},
		{"url javascript scheme rejected", "url", "javascript:alert(1)", "", false},
		{"category level1", "category", "kajian", "/kajian", true},
		{"category sub", "category", "fikih", "/kajian?sub=fikih", true},
		{"category inactive", "category", "nonaktif", "", false},
		{"category missing", "category", "tidak-ada", "", false},
		{"page existing", "page", "profil-yayasan", "/halaman/profil-yayasan", true},
		{"page missing", "page", "tidak-ada", "", false},
		{"unknown link_type", "widget", "x", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			href, ok := resolveHref(tc.linkType, tc.linkTarget, cats, pages)
			assert.Equal(t, tc.wantOK, ok)
			assert.Equal(t, tc.wantHref, href)
		})
	}
}

func TestBuildPublicTreeDropsInactiveAndUnresolved(t *testing.T) {
	cats := testCats()
	pages := pageSlugSet(nil)
	items := []dbgen.MenuItem{
		{ID: 1, MenuID: 1, Label: "Beranda", LinkType: "route", LinkTarget: "/", IsActive: true, SortOrder: 10},
		{ID: 2, MenuID: 1, Label: "Nonaktif", LinkType: "route", LinkTarget: "/", IsActive: false, SortOrder: 20},
		{ID: 3, MenuID: 1, Label: "Rusak", LinkType: "category", LinkTarget: "tidak-ada", IsActive: true, SortOrder: 30},
		{ID: 4, MenuID: 1, Label: "Kajian", LinkType: "category", LinkTarget: "kajian", IsActive: true, SortOrder: 40},
		{ID: 5, MenuID: 1, ParentID: ptr(int64(4)), Label: "Fikih", LinkType: "category", LinkTarget: "fikih", IsActive: true, SortOrder: 10},
	}
	tree := buildPublicTree(items, cats, pages)
	if assert.Len(t, tree, 2) {
		assert.Equal(t, "Beranda", tree[0].Label)
		assert.Equal(t, "Kajian", tree[1].Label)
		if assert.Len(t, tree[1].Children, 1) {
			assert.Equal(t, "/kajian?sub=fikih", tree[1].Children[0].Href)
		}
	}
}

func TestValidateTreeDepthAndTargets(t *testing.T) {
	cats := map[string]bool{"kajian": true}
	pages := map[string]bool{"profil-yayasan": true}

	items := []ItemInput{
		{Label: "Kajian", LinkType: "category", LinkTarget: "kajian"},
		{Label: "Rusak", LinkType: "category", LinkTarget: "tidak-ada"},
		{Label: "Rute Rusak", LinkType: "route", LinkTarget: "/tidak-ada"},
		{
			Label: "Dengan Anak", LinkType: "route", LinkTarget: "/",
			Children: []ItemInput{
				{Label: "Cucu Terlalu Dalam", LinkType: "page", LinkTarget: "profil-yayasan",
					Children: []ItemInput{{Label: "X", LinkType: "route", LinkTarget: "/"}}},
			},
		},
	}
	fields := validateTree(items, "items", 1, cats, pages)
	assert.Equal(t, "Kategori tidak ditemukan.", fields["items[1].link_target"])
	assert.Equal(t, "Rute tidak dikenal.", fields["items[2].link_target"])
	assert.Equal(t, "Menu hanya boleh 2 level.", fields["items[3].children[0].children"])
	assert.NotContains(t, fields, "items[0].link_target")
}
