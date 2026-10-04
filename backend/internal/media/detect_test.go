package media_test

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/media"
)

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

func jpegBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatalf("encode jpeg: %v", err)
	}
	return buf.Bytes()
}

func gifBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewPaletted(image.Rect(0, 0, w, h), []color.Color{color.White, color.Black})
	var buf bytes.Buffer
	if err := gif.Encode(&buf, img, nil); err != nil {
		t.Fatalf("encode gif: %v", err)
	}
	return buf.Bytes()
}

func TestDetectImageAccepted(t *testing.T) {
	cases := []struct {
		name string
		data []byte
		mime string
		ext  string
	}{
		{"png", pngBytes(t, 10, 6), "image/png", "png"},
		{"jpeg", jpegBytes(t, 10, 6), "image/jpeg", "jpg"},
		{"gif", gifBytes(t, 10, 6), "image/gif", "gif"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			info, data, err := media.DetectImage(bytes.NewReader(c.data), 1<<20)
			if err != nil {
				t.Fatalf("DetectImage: %v", err)
			}
			if info.Mime != c.mime || info.Ext != c.ext {
				t.Fatalf("info = %+v, want mime=%s ext=%s", info, c.mime, c.ext)
			}
			if info.Width != 10 || info.Height != 6 {
				t.Fatalf("dimensions = %dx%d, want 10x6", info.Width, info.Height)
			}
			if int64(len(data)) != info.Size {
				t.Fatalf("returned data len %d != Size %d", len(data), info.Size)
			}
		})
	}
}

func TestDetectImageRejectsRenamedExecutable(t *testing.T) {
	// "MZ" is the DOS/PE executable magic; renaming it to .jpg must not fool
	// the sniffer.
	data := append([]byte("MZ\x90\x00\x03\x00\x00\x00"), bytes.Repeat([]byte{0}, 100)...)
	_, _, err := media.DetectImage(bytes.NewReader(data), 1<<20)
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || !errors.Is(err, apperr.ErrUnsupportedMedia) {
		t.Fatalf("err = %v, want ErrUnsupportedMedia", err)
	}
}

func TestDetectImageRejectsOversized(t *testing.T) {
	data := pngBytes(t, 200, 200)
	_, _, err := media.DetectImage(bytes.NewReader(data), int64(len(data)-1))
	if !errors.Is(err, apperr.ErrPayloadTooLarge) {
		t.Fatalf("err = %v, want ErrPayloadTooLarge", err)
	}
}

func TestDetectImageRejectsSVG(t *testing.T) {
	data := []byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	_, _, err := media.DetectImage(bytes.NewReader(data), 1<<20)
	if !errors.Is(err, apperr.ErrUnsupportedMedia) {
		t.Fatalf("err = %v, want ErrUnsupportedMedia", err)
	}
}

func TestDetectImageRejectsTruncatedFile(t *testing.T) {
	data := pngBytes(t, 200, 200)
	// Keep the 8-byte PNG signature (so the mime sniff still says image/png)
	// but cut well before the IHDR chunk completes, so DecodeConfig fails.
	truncated := data[:20]
	_, _, err := media.DetectImage(bytes.NewReader(truncated), 1<<20)
	if !errors.Is(err, apperr.ErrUnsupportedMedia) {
		t.Fatalf("err = %v, want ErrUnsupportedMedia", err)
	}
}
