package config

import (
	"net/netip"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setValidEnv(t *testing.T) {
	t.Helper()
	t.Setenv("ENV_FILE", "does-not-exist.env")
	t.Setenv("APP_ENV", "development")
	t.Setenv("DATABASE_URL", "postgres://u:p@localhost:5432/db?sslmode=disable")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	t.Setenv("REVALIDATE_SECRET", "rev")
	t.Setenv("VIEW_HASH_SALT", "salt")
}

func TestLoadValid(t *testing.T) {
	setValidEnv(t)
	t.Setenv("CORS_ORIGINS", "http://a.test,http://b.test")
	cfg, err := Load()
	require.NoError(t, err)
	assert.Equal(t, ":8080", cfg.HTTPAddr)
	assert.Equal(t, int32(10), cfg.DBMaxConns)
	assert.Equal(t, []string{"http://a.test", "http://b.test"}, cfg.CORSOrigins)
	assert.True(t, cfg.IsDevelopment())
}

func TestLoadMissingRequired(t *testing.T) {
	setValidEnv(t)
	t.Setenv("DATABASE_URL", "")
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "DATABASE_URL")
}

func TestLoadShortJWTSecret(t *testing.T) {
	setValidEnv(t)
	t.Setenv("JWT_SECRET", "too-short")
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")
}

func TestValidateProductionRequiresSecureCookie(t *testing.T) {
	setValidEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("COOKIE_SECURE", "false")
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "COOKIE_SECURE")
}

func TestValidateBadAppEnv(t *testing.T) {
	setValidEnv(t)
	t.Setenv("APP_ENV", "prod")
	_, err := Load()
	require.Error(t, err)
}

func TestTrustedProxiesDefault(t *testing.T) {
	setValidEnv(t)
	cfg, err := Load()
	require.NoError(t, err)
	assert.Equal(t, []string{"127.0.0.0/8", "::1/128"}, cfg.TrustedProxies)
	assert.Equal(t, []netip.Prefix{
		netip.MustParsePrefix("127.0.0.0/8"), netip.MustParsePrefix("::1/128"),
	}, cfg.TrustedProxyPrefixes())
}

func TestTrustedProxiesParse(t *testing.T) {
	setValidEnv(t)
	t.Setenv("TRUSTED_PROXIES", " 10.0.0.1 , 192.168.0.0/16,2001:db8::/32, ::ffff:10.9.9.9")
	cfg, err := Load()
	require.NoError(t, err)
	assert.Equal(t, []netip.Prefix{
		netip.MustParsePrefix("10.0.0.1/32"),
		netip.MustParsePrefix("192.168.0.0/16"),
		netip.MustParsePrefix("2001:db8::/32"),
		netip.MustParsePrefix("10.9.9.9/32"),
	}, cfg.TrustedProxyPrefixes())
}

func TestTrustedProxiesNone(t *testing.T) {
	setValidEnv(t)
	t.Setenv("TRUSTED_PROXIES", "none")
	cfg, err := Load()
	require.NoError(t, err)
	assert.Empty(t, cfg.TrustedProxyPrefixes())
	assert.NotNil(t, cfg.TrustedProxyPrefixes())
}

func TestTrustedProxiesEmptyAndNilUseDefault(t *testing.T) {
	assert.Len(t, (&Config{}).TrustedProxyPrefixes(), 2)
	assert.Len(t, (&Config{TrustedProxies: []string{" "}}).TrustedProxyPrefixes(), 2)
}

func TestTrustedProxiesInvalid(t *testing.T) {
	setValidEnv(t)
	t.Setenv("TRUSTED_PROXIES", "127.0.0.1,localhost,10.0.0.0/33")
	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "TRUSTED_PROXIES")
	assert.Contains(t, err.Error(), "localhost")
	assert.Contains(t, err.Error(), "10.0.0.0/33")
}
