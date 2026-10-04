// Package config loads and validates application configuration from the
// environment (optionally seeded from a .env file).
package config

import (
	"errors"
	"fmt"
	"io/fs"
	"net/netip"
	"os"
	"strings"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

// Supported values for APP_ENV.
const (
	EnvDevelopment = "development"
	EnvStaging     = "staging"
	EnvProduction  = "production"
)

// Config holds every runtime setting. Variable names follow docs/09 §1.
type Config struct {
	AppEnv                  string        `env:"APP_ENV" envDefault:"development"`
	HTTPAddr                string        `env:"HTTP_ADDR" envDefault:":8080"`
	DatabaseURL             string        `env:"DATABASE_URL,required,notEmpty"`
	DBMaxConns              int32         `env:"DB_MAX_CONNS" envDefault:"10"`
	JWTSecret               string        `env:"JWT_SECRET,required,notEmpty"`
	AccessTokenTTL          time.Duration `env:"ACCESS_TOKEN_TTL" envDefault:"15m"`
	RefreshTokenTTL         time.Duration `env:"REFRESH_TOKEN_TTL" envDefault:"168h"`
	RefreshTokenTTLRemember time.Duration `env:"REFRESH_TOKEN_TTL_REMEMBER" envDefault:"720h"`
	CookieSecure            bool          `env:"COOKIE_SECURE" envDefault:"false"`
	CookieDomain            string        `env:"COOKIE_DOMAIN"`
	CORSOrigins             []string      `env:"CORS_ORIGINS" envSeparator:","`
	TrustedProxies          []string      `env:"TRUSTED_PROXIES" envSeparator:"," envDefault:"127.0.0.0/8,::1/128"`
	UploadDir               string        `env:"UPLOAD_DIR" envDefault:"./uploads"`
	UploadMaxMB             int           `env:"UPLOAD_MAX_MB" envDefault:"5"`
	PublicSiteURL           string        `env:"PUBLIC_SITE_URL" envDefault:"http://localhost:3000"`
	NextRevalidateURL       string        `env:"NEXT_REVALIDATE_URL" envDefault:"http://127.0.0.1:3000/api/revalidate"`
	RevalidateSecret        string        `env:"REVALIDATE_SECRET,required,notEmpty"`
	ViewHashSalt            string        `env:"VIEW_HASH_SALT,required,notEmpty"`
	SeedSuperadminEmail     string        `env:"SEED_SUPERADMIN_EMAIL"`
	SeedSuperadminPassword  string        `env:"SEED_SUPERADMIN_PASSWORD"`
	LogLevel                string        `env:"LOG_LEVEL" envDefault:"info"`
}

// Load reads the file named by ENV_FILE (default ".env") if it exists, then
// parses and validates the environment. Variables already set in the process
// environment take precedence over the file.
func Load() (*Config, error) {
	file := os.Getenv("ENV_FILE")
	if file == "" {
		file = ".env"
	}
	if err := godotenv.Load(file); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("config: load %s: %w", file, err)
	}
	return parse()
}

func parse() (*Config, error) {
	cfg, err := env.ParseAs[Config]()
	if err != nil {
		return nil, fmt.Errorf("config: parse env: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Validate checks cross-field and value constraints.
func (c *Config) Validate() error {
	var errs []error
	switch c.AppEnv {
	case EnvDevelopment, EnvStaging, EnvProduction:
	default:
		errs = append(errs, fmt.Errorf("APP_ENV must be development, staging or production (got %q)", c.AppEnv))
	}
	if len(c.JWTSecret) < 32 {
		errs = append(errs, errors.New("JWT_SECRET must be at least 32 characters"))
	}
	if c.AppEnv == EnvProduction && !c.CookieSecure {
		errs = append(errs, errors.New("COOKIE_SECURE must be true in production"))
	}
	if c.DBMaxConns < 1 {
		errs = append(errs, errors.New("DB_MAX_CONNS must be >= 1"))
	}
	if _, err := parseTrustedProxies(c.TrustedProxies); err != nil {
		errs = append(errs, err)
	}
	if len(errs) > 0 {
		return fmt.Errorf("config: invalid: %w", errors.Join(errs...))
	}
	return nil
}

// IsDevelopment reports whether APP_ENV is development.
func (c *Config) IsDevelopment() bool { return c.AppEnv == EnvDevelopment }

// defaultTrustedProxies is used when TRUSTED_PROXIES is unset or empty
// (loopback: Next.js and the API on the same host).
var defaultTrustedProxies = []netip.Prefix{
	netip.MustParsePrefix("127.0.0.0/8"),
	netip.MustParsePrefix("::1/128"),
}

// TrustedProxyPrefixes returns the networks whose X-Forwarded-For /
// X-Real-IP headers are believed. An empty list means the loopback default;
// the single value "none" trusts nobody (empty result). Invalid entries are
// rejected by Validate; here they are skipped.
func (c *Config) TrustedProxyPrefixes() []netip.Prefix {
	out, _ := parseTrustedProxies(c.TrustedProxies)
	return out
}

func parseTrustedProxies(list []string) ([]netip.Prefix, error) {
	var vals []string
	for _, v := range list {
		if v = strings.TrimSpace(v); v != "" {
			vals = append(vals, v)
		}
	}
	if len(vals) == 0 {
		return append([]netip.Prefix(nil), defaultTrustedProxies...), nil
	}
	if len(vals) == 1 && strings.EqualFold(vals[0], "none") {
		return []netip.Prefix{}, nil
	}
	out := make([]netip.Prefix, 0, len(vals))
	var bad []string
	for _, v := range vals {
		if strings.Contains(v, "/") {
			p, err := netip.ParsePrefix(v)
			if err != nil {
				bad = append(bad, v)
				continue
			}
			if p.Addr().Is4In6() {
				p = netip.PrefixFrom(p.Addr().Unmap(), p.Bits()-96)
			}
			out = append(out, p.Masked())
			continue
		}
		a, err := netip.ParseAddr(v)
		if err != nil {
			bad = append(bad, v)
			continue
		}
		a = a.Unmap()
		out = append(out, netip.PrefixFrom(a, a.BitLen()))
	}
	if len(bad) > 0 {
		return out, fmt.Errorf("TRUSTED_PROXIES has invalid entries (want IP or CIDR, or \"none\"): %s", strings.Join(bad, ", "))
	}
	return out, nil
}
