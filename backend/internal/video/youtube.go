package video

import (
	"net/url"
	"strings"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/content"
)

// ParseYouTubeURL extracts the 11-character video id from raw, which may be
// a bare id or a watch/shorts/embed/live/youtu.be URL (with or without
// scheme). Anything else is rejected with a validation error on "url".
func ParseYouTubeURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", invalidURL()
	}
	if isValidID(raw) {
		return raw, nil
	}
	candidate := raw
	if !strings.Contains(candidate, "://") {
		candidate = "https://" + candidate
	}
	u, err := url.Parse(candidate)
	if err != nil || u.Host == "" {
		return "", invalidURL()
	}
	host := strings.TrimPrefix(strings.ToLower(u.Host), "www.")
	switch host {
	case "youtu.be":
		if id := firstSegment(u.Path); isValidID(id) {
			return id, nil
		}
	case "youtube.com", "m.youtube.com", "youtube-nocookie.com":
		switch {
		case u.Path == "/watch":
			if id := u.Query().Get("v"); isValidID(id) {
				return id, nil
			}
		case strings.HasPrefix(u.Path, "/shorts/"):
			if id := firstSegment(strings.TrimPrefix(u.Path, "/shorts/")); isValidID(id) {
				return id, nil
			}
		case strings.HasPrefix(u.Path, "/embed/"):
			if id := firstSegment(strings.TrimPrefix(u.Path, "/embed/")); isValidID(id) {
				return id, nil
			}
		case strings.HasPrefix(u.Path, "/live/"):
			if id := firstSegment(strings.TrimPrefix(u.Path, "/live/")); isValidID(id) {
				return id, nil
			}
		}
	}
	return "", invalidURL()
}

// ThumbnailURL returns the default YouTube thumbnail for id.
func ThumbnailURL(id string) string { return content.YouTubeThumbnailURL(id) }

func firstSegment(path string) string {
	path = strings.Trim(path, "/")
	if i := strings.IndexByte(path, '/'); i >= 0 {
		path = path[:i]
	}
	return path
}

func isValidID(s string) bool {
	if len(s) != 11 {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '_', r == '-':
		default:
			return false
		}
	}
	return true
}

func invalidURL() error {
	return apperr.Validation(map[string]string{"url": "URL YouTube tidak dikenali."})
}
