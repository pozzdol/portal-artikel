package media

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"  // register GIF decoder
	_ "image/jpeg" // register JPEG decoder
	_ "image/png"  // register PNG decoder
	"io"
	"net/http"

	_ "golang.org/x/image/webp" // register WebP decoder

	"portal-berita/backend/internal/apperr"
)

// ImageInfo describes a sniffed and decoded image upload.
type ImageInfo struct {
	Mime   string
	Ext    string // no leading dot, e.g. "png"
	Width  int32
	Height int32
	Size   int64
}

// mimeExt lists the image types accepted for upload.
var mimeExt = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/gif":  "gif",
	"image/webp": "webp",
}

// formatMime maps image.DecodeConfig's format name back to its mime type, to
// cross-check against the sniffed content type.
var formatMime = map[string]string{
	"jpeg": "image/jpeg",
	"png":  "image/png",
	"gif":  "image/gif",
	"webp": "image/webp",
}

// DetectImage reads at most maxBytes+1 bytes from r, sniffs its content type
// and decodes its dimensions. It returns apperr.PayloadTooLarge when the
// upload exceeds maxBytes and apperr.UnsupportedMedia when the content is not
// a recognized image (wrong sniffed type, undecodable, or sniffed/decoded
// formats disagree, e.g. a renamed executable or a corrupt file).
func DetectImage(r io.Reader, maxBytes int64) (ImageInfo, []byte, error) {
	data, err := io.ReadAll(io.LimitReader(r, maxBytes+1))
	if err != nil {
		return ImageInfo{}, nil, fmt.Errorf("media: read upload: %w", err)
	}
	if int64(len(data)) > maxBytes {
		return ImageInfo{}, nil, apperr.PayloadTooLarge()
	}
	sniffLen := len(data)
	if sniffLen > 512 {
		sniffLen = 512
	}
	mime := http.DetectContentType(data[:sniffLen])
	ext, ok := mimeExt[mime]
	if !ok {
		return ImageInfo{}, nil, apperr.UnsupportedMedia("Tipe file harus berupa gambar JPEG, PNG, GIF, atau WebP.")
	}
	cfg, format, err := decodeConfig(data)
	if err != nil {
		return ImageInfo{}, nil, apperr.UnsupportedMedia("Berkas gambar tidak valid atau rusak.")
	}
	if formatMime[format] != mime {
		return ImageInfo{}, nil, apperr.UnsupportedMedia("Isi berkas tidak sesuai dengan tipe file.")
	}
	return ImageInfo{
		Mime:   mime,
		Ext:    ext,
		Width:  int32(cfg.Width),
		Height: int32(cfg.Height),
		Size:   int64(len(data)),
	}, data, nil
}

// decodeConfig wraps image.DecodeConfig and turns a decoder panic into an
// error. golang.org/x/image/webp has known panics on malformed input
// (GO-2026-5061, GO-2026-4961) whose fixes need Go >= 1.25, so a crafted
// upload must not reach the request-level recoverer as a 500.
func decodeConfig(data []byte) (cfg image.Config, format string, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("media: decode config panic: %v", rec)
		}
	}()
	return image.DecodeConfig(bytes.NewReader(data))
}
