package video

import "testing"

func TestParseYouTubeURL(t *testing.T) {
	const want = "dQw4w9WgXcQ"
	cases := []struct {
		name    string
		raw     string
		wantID  string
		wantErr bool
	}{
		{"watch url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", want, false},
		{"watch url with extra params", "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s", want, false},
		{"youtu.be short link", "https://youtu.be/dQw4w9WgXcQ", want, false},
		{"youtu.be with query", "https://youtu.be/dQw4w9WgXcQ?t=5", want, false},
		{"shorts", "https://www.youtube.com/shorts/dQw4w9WgXcQ", want, false},
		{"embed", "https://www.youtube.com/embed/dQw4w9WgXcQ", want, false},
		{"nocookie embed", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", want, false},
		{"live", "https://www.youtube.com/live/dQw4w9WgXcQ", want, false},
		{"bare id", "dQw4w9WgXcQ", want, false},
		{"no scheme", "youtube.com/watch?v=dQw4w9WgXcQ", want, false},
		{"mobile host", "https://m.youtube.com/watch?v=dQw4w9WgXcQ", want, false},
		{"empty", "", "", true},
		{"too short id", "dQw4w9WgXc", "", true},
		{"unrelated url", "https://vimeo.com/12345678", "", true},
		{"watch without v", "https://www.youtube.com/watch", "", true},
		{"garbage", "not a url at all!!", "", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			id, err := ParseYouTubeURL(c.raw)
			if c.wantErr {
				if err == nil {
					t.Fatalf("ParseYouTubeURL(%q) = %q, want error", c.raw, id)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseYouTubeURL(%q) unexpected error: %v", c.raw, err)
			}
			if id != c.wantID {
				t.Fatalf("ParseYouTubeURL(%q) = %q, want %q", c.raw, id, c.wantID)
			}
		})
	}
}

func TestThumbnailURL(t *testing.T) {
	if got, want := ThumbnailURL("dQw4w9WgXcQ"), "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"; got != want {
		t.Fatalf("ThumbnailURL() = %q, want %q", got, want)
	}
}
