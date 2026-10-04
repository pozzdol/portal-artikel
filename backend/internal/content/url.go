package content

// ArticleURL is the public path of an article: "/{level1Slug}/{articleSlug}".
// level1Slug is the parent category slug when the article's category has a
// parent, else the category's own slug.
func ArticleURL(level1Slug, articleSlug string) string {
	return "/" + level1Slug + "/" + articleSlug
}

// EventURL is the public path of an event.
func EventURL(slug string) string { return "/agenda/" + slug }

// AlumniURL is the public path of an alumni profile.
func AlumniURL(slug string) string { return "/tokoh/" + slug }

// VideoURL is the public path of a video.
func VideoURL(slug string) string { return "/video/" + slug }

// PageURL is the public path of a static page.
func PageURL(slug string) string { return "/halaman/" + slug }

// TagURL is the public path of a tag listing.
func TagURL(slug string) string { return "/tag/" + slug }

// AuthorURL is the public path of an author profile.
func AuthorURL(slug string) string { return "/penulis/" + slug }

// YouTubeThumbnailURL is the default YouTube thumbnail for a video id.
func YouTubeThumbnailURL(youtubeID string) string {
	return "https://i.ytimg.com/vi/" + youtubeID + "/hqdefault.jpg"
}
