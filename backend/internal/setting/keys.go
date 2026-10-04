// Package setting implements the typed site_settings key/value store: each
// key is validated against a Go struct (docs/04 §4.6), so unknown keys and
// unknown fields are rejected.
package setting

// Known site_settings keys (docs/04 §4.6).
const (
	KeySiteIdentity  = "site.identity"
	KeySiteFooter    = "site.footer"
	KeySiteContact   = "site.contact"
	KeySiteSocial    = "site.social"
	KeySEODefaults   = "seo.defaults"
	KeyHeaderOptions = "header.options"
)

// Keys lists every known key in a stable display order.
var Keys = []string{KeySiteIdentity, KeySiteFooter, KeySiteContact, KeySiteSocial, KeySEODefaults, KeyHeaderOptions}

// IsKnownKey reports whether key is one of Keys.
func IsKnownKey(key string) bool {
	for _, k := range Keys {
		if k == key {
			return true
		}
	}
	return false
}

// Identity is site.identity.
type Identity struct {
	Name           string `json:"name" validate:"required,max=120"`
	Tagline        string `json:"tagline" validate:"max=200"`
	LogoMediaID    *int64 `json:"logo_media_id"`
	FaviconMediaID *int64 `json:"favicon_media_id"`
}

// Footer is site.footer.
type Footer struct {
	Description string `json:"description" validate:"max=2000"`
	Copyright   string `json:"copyright" validate:"max=300"`
}

// Contact is site.contact.
type Contact struct {
	Address string `json:"address" validate:"max=500"`
	Email   string `json:"email" validate:"omitempty,email"`
	Phone   string `json:"phone" validate:"max=60"`
}

// SocialLink is one entry of site.social (a JSON array, not an object).
type SocialLink struct {
	Platform string `json:"platform" validate:"required,oneof=instagram youtube whatsapp facebook tiktok x telegram website"`
	URL      string `json:"url" validate:"required,url"`
}

// SEODefaults is seo.defaults.
type SEODefaults struct {
	TitleTemplate          string `json:"title_template" validate:"required,contains=%s"`
	DefaultDescription     string `json:"default_description" validate:"max=300"`
	DefaultOGMediaID       *int64 `json:"default_og_media_id"`
	GoogleSiteVerification string `json:"google_site_verification" validate:"max=200"`
}

// HeaderOptions is header.options.
type HeaderOptions struct {
	ShowDate        bool   `json:"show_date"`
	ShowSearch      bool   `json:"show_search"`
	ShowThemeToggle bool   `json:"show_theme_toggle"`
	ShowLoginButton bool   `json:"show_login_button"`
	LoginLabel      string `json:"login_label" validate:"max=60"`
}
