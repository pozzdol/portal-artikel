package revalidate

// Collection-level cache tags used by the frontend.
const (
	TagHomepage = "homepage"
	TagSitemap  = "sitemap"
	TagMenus    = "menus"
	TagSettings = "settings"
	TagSnippets = "snippets"
	TagEvents   = "events"
	TagAlumni   = "alumni"
	TagVideos   = "videos"
	TagTrending = "trending"
	TagSearch   = "search"
)

// Article returns the tag for one article detail page.
func Article(slug string) string { return "article:" + slug }

// Category returns the tag for one category listing.
func Category(slug string) string { return "category:" + slug }

// Tag returns the tag for one tag listing.
func Tag(slug string) string { return "tag:" + slug }

// Author returns the tag for one author profile.
func Author(slug string) string { return "author:" + slug }

// Event returns the tag for one event detail page.
func Event(slug string) string { return "event:" + slug }

// Alumni returns the tag for one alumni profile.
func Alumni(slug string) string { return "alumni:" + slug }

// Video returns the tag for one video detail page.
func Video(slug string) string { return "video:" + slug }

// Page returns the tag for one static page.
func Page(slug string) string { return "page:" + slug }
