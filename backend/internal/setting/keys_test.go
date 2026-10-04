package setting

import (
	"errors"
	"testing"

	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"portal-berita/backend/internal/apperr"
)

func TestIsKnownKey(t *testing.T) {
	assert.True(t, IsKnownKey(KeySiteIdentity))
	assert.True(t, IsKnownKey(KeyHeaderOptions))
	assert.False(t, IsKnownKey("unknown.key"))
}

func TestDecodeAndValidateUnknownKey(t *testing.T) {
	_, _, err := decodeAndValidate("unknown.key", []byte(`{}`))
	require.Error(t, err)
	assert.True(t, errors.Is(err, apperr.ErrNotFound))
}

func TestDecodeAndValidateIdentity(t *testing.T) {
	value, media, err := decodeAndValidate(KeySiteIdentity, []byte(`{"name":"ALMAIDAH","tagline":"Alumni","logo_media_id":1,"favicon_media_id":null}`))
	require.NoError(t, err)
	identity, ok := value.(*Identity)
	require.True(t, ok)
	assert.Equal(t, "ALMAIDAH", identity.Name)
	assert.Equal(t, map[string]int64{"logo_media_id": 1}, media)
}

func TestDecodeAndValidateIdentityMissingName(t *testing.T) {
	_, _, err := decodeAndValidate(KeySiteIdentity, []byte(`{"tagline":"Alumni"}`))
	require.Error(t, err)
	var verrs validator.ValidationErrors
	require.True(t, errors.As(err, &verrs))
	assert.Equal(t, "name", verrs[0].Field())
}

func TestDecodeAndValidateUnknownField(t *testing.T) {
	_, _, err := decodeAndValidate(KeySiteIdentity, []byte(`{"name":"ALMAIDAH","nickname":"x"}`))
	require.Error(t, err)
	var de *apperr.Error
	require.True(t, errors.As(err, &de))
	assert.True(t, errors.Is(err, apperr.ErrValidation))
}

func TestDecodeAndValidateSocial(t *testing.T) {
	value, _, err := decodeAndValidate(KeySiteSocial, []byte(`[{"platform":"instagram","url":"https://instagram.com/almaidah.id"}]`))
	require.NoError(t, err)
	links, ok := value.([]SocialLink)
	require.True(t, ok)
	assert.Len(t, links, 1)
}

func TestDecodeAndValidateSocialBadPlatform(t *testing.T) {
	_, _, err := decodeAndValidate(KeySiteSocial, []byte(`[{"platform":"myspace","url":"https://myspace.com/x"}]`))
	require.Error(t, err)
	var verrs validator.ValidationErrors
	require.True(t, errors.As(err, &verrs))
}

func TestDecodeAndValidateSEODefaultsRequiresPercentS(t *testing.T) {
	_, _, err := decodeAndValidate(KeySEODefaults, []byte(`{"title_template":"ALMAIDAH","default_description":"d","default_og_media_id":null,"google_site_verification":""}`))
	require.Error(t, err)
	var verrs validator.ValidationErrors
	require.True(t, errors.As(err, &verrs))

	value, media, err := decodeAndValidate(KeySEODefaults, []byte(`{"title_template":"%s — ALMAIDAH","default_description":"d","default_og_media_id":9,"google_site_verification":""}`))
	require.NoError(t, err)
	seo, ok := value.(*SEODefaults)
	require.True(t, ok)
	assert.Equal(t, "%s — ALMAIDAH", seo.TitleTemplate)
	assert.Equal(t, map[string]int64{"default_og_media_id": 9}, media)
}

func TestDecodeAndValidateHeaderOptions(t *testing.T) {
	value, media, err := decodeAndValidate(KeyHeaderOptions, []byte(`{"show_date":true,"show_search":true,"show_theme_toggle":true,"show_login_button":true,"login_label":"Login Admin"}`))
	require.NoError(t, err)
	assert.Nil(t, media)
	opts, ok := value.(*HeaderOptions)
	require.True(t, ok)
	assert.True(t, opts.ShowDate)
	assert.Equal(t, "Login Admin", opts.LoginLabel)
}
