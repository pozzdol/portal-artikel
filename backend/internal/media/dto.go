package media

import (
	"io"

	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

// Item is the admin representation of one media row.
type Item struct {
	ID           int64   `json:"id"`
	URL          string  `json:"url"`
	OriginalName string  `json:"original_name"`
	MimeType     string  `json:"mime_type"`
	SizeBytes    int64   `json:"size_bytes"`
	Width        *int32  `json:"width"`
	Height       *int32  `json:"height"`
	AltText      *string `json:"alt_text"`
	Caption      *string `json:"caption"`
	UploadedBy   *int64  `json:"uploaded_by"`
	CreatedAt    string  `json:"created_at"`
}

func itemFromRow(m dbgen.Medium) Item {
	return Item{
		ID:           m.ID,
		URL:          m.Url,
		OriginalName: m.OriginalName,
		MimeType:     m.MimeType,
		SizeBytes:    m.SizeBytes,
		Width:        m.Width,
		Height:       m.Height,
		AltText:      m.AltText,
		Caption:      m.Caption,
		UploadedBy:   m.UploadedBy,
		CreatedAt:    httpx.FormatTime(m.CreatedAt),
	}
}

// UploadInput carries a multipart upload's contents and metadata.
type UploadInput struct {
	Reader   io.Reader
	Filename string
	AltText  *string
	Caption  *string
}

// UpdateMetaInput updates alt text and caption only.
type UpdateMetaInput struct {
	AltText *string `json:"alt_text"`
	Caption *string `json:"caption"`
}

// ListFilter filters the admin media list.
type ListFilter struct {
	Q          string
	MimePrefix string
	Page       httpx.Pagination
}
