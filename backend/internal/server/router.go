package server

import (
	"context"
	"crypto/rand"
	"log/slog"
	"net/http"
	"net/netip"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/alumni"
	"portal-berita/backend/internal/analytics"
	"portal-berita/backend/internal/article"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/auth"
	"portal-berita/backend/internal/category"
	"portal-berita/backend/internal/config"
	"portal-berita/backend/internal/dashboard"
	"portal-berita/backend/internal/event"
	"portal-berita/backend/internal/homepage"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/jobs"
	"portal-berita/backend/internal/media"
	"portal-berita/backend/internal/media/storage"
	"portal-berita/backend/internal/menu"
	appmw "portal-berita/backend/internal/middleware"
	"portal-berita/backend/internal/page"
	"portal-berita/backend/internal/ratelimit"
	"portal-berita/backend/internal/rbac"
	"portal-berita/backend/internal/revalidate"
	"portal-berita/backend/internal/role"
	"portal-berita/backend/internal/search"
	"portal-berita/backend/internal/setting"
	"portal-berita/backend/internal/site"
	"portal-berita/backend/internal/sitemap"
	"portal-berita/backend/internal/snippet"
	"portal-berita/backend/internal/tag"
	"portal-berita/backend/internal/user"
	"portal-berita/backend/internal/video"
)

// Deps are the dependencies injected into the router. Reval, Storage and Now
// are optional: nil means revalidate.Noop, local storage under
// Cfg.UploadDir and time.Now.
type Deps struct {
	Cfg  *config.Config
	Pool *pgxpool.Pool
	Log  *slog.Logger
	// Reval receives cache tags after committed content mutations. main
	// passes a revalidate.Worker; tests pass a revalidate.Recorder.
	Reval   revalidate.Client
	Storage storage.Storage
	Now     func() time.Time
}

// App is the wired application: the HTTP handler plus the background jobs
// (scheduled publishing, snippet windows, view-dedup cleanup) that share the
// same service instances.
type App struct {
	Handler http.Handler
	Jobs    []jobs.Job
}

const (
	requestTimeout = 30 * time.Second
	// permCacheTTL bounds how long a cached permission set is trusted.
	permCacheTTL = 60 * time.Second
	// Login attempts allowed per client IP + email within loginWindow.
	loginLimit  = 5
	loginWindow = time.Minute
	// View beacons allowed per client IP within viewWindow.
	viewLimit  = 60
	viewWindow = time.Minute
	// Preview requests (?preview=, never cached) allowed per client IP
	// within previewWindow.
	previewLimit  = 60
	previewWindow = time.Minute
	// publicMaxAge is the Cache-Control max-age (seconds) of public GETs.
	publicMaxAge = 60
	// previewTTL is the lifetime of article preview tokens.
	previewTTL = 30 * time.Minute
	// snippetJobName is the jobs.Runner name of the snippet window job.
	snippetJobName = "snippet.window_transitions"
)

// NewRouter builds the root HTTP handler.
func NewRouter(d Deps) http.Handler {
	return NewApp(d).Handler
}

// NewApp builds the root HTTP handler and the background jobs.
func NewApp(d Deps) *App {
	if d.Log == nil {
		d.Log = slog.Default()
	}
	if d.Reval == nil {
		d.Reval = revalidate.Noop{}
	}
	if d.Now == nil {
		d.Now = time.Now
	}
	uploadDir := "./uploads"
	if d.Cfg != nil && d.Cfg.UploadDir != "" {
		uploadDir = d.Cfg.UploadDir
	}
	if d.Storage == nil {
		d.Storage = storage.NewLocal(uploadDir, "/uploads")
	}
	var jobList []jobs.Job
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(appmw.RealIP(trustedProxies(d.Cfg)))
	r.Use(requestLogger(d.Log))
	r.Use(recoverer(d.Log))
	r.Use(middleware.Timeout(requestTimeout))
	r.Use(securityHeaders)
	if d.Cfg != nil && len(d.Cfg.CORSOrigins) > 0 {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   d.Cfg.CORSOrigins,
			AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-Id"},
			ExposedHeaders:   []string{"Retry-After", "X-Request-Id"},
			AllowCredentials: true,
			MaxAge:           300,
		}))
	}

	r.NotFound(notFound)
	r.MethodNotAllowed(methodNotAllowed)

	r.Get("/healthz", healthz)
	r.Get("/readyz", readyz(d.Pool))

	r.Route("/api/v1", func(api chi.Router) {
		api.NotFound(notFound)
		api.MethodNotAllowed(methodNotAllowed)
		jobList = mountAPI(api, d)
	})

	r.Handle("/uploads/*", uploadsHandler(uploadDir))

	return &App{Handler: r, Jobs: jobList}
}

// mountAPI wires the auth, public content and admin routes under /api/v1 and
// returns the background jobs bound to the same services.
func mountAPI(api chi.Router, d Deps) []jobs.Job {
	cfg := authConfig(d.Cfg)
	secret := jwtSecret(d.Cfg, d.Log)

	issuer := auth.NewTokenIssuer(secret, cfg.AccessTTL)
	cookies := auth.CookieConfig{}
	if d.Cfg != nil {
		cookies = auth.CookieConfig{Secure: d.Cfg.CookieSecure, Domain: d.Cfg.CookieDomain}
	}
	checker := rbac.NewChecker(d.Pool, permCacheTTL)
	auditor := audit.New(d.Pool)
	authSvc := auth.NewService(d.Pool, issuer, auditor, auth.NewLoginLimiter(loginLimit, loginWindow), cfg).
		WithRevalidator(d.Reval)

	authn := appmw.Authenticate(issuer)
	csrf := appmw.CSRF
	guard := checker.Guard()

	api.Route("/auth", func(a chi.Router) {
		auth.NewHandler(authSvc, cookies, authn, csrf).Register(a)
	})

	var (
		publicSiteURL string
		viewSalt      string
		uploadMax     int64 = 5 << 20
	)
	if d.Cfg != nil {
		publicSiteURL = d.Cfg.PublicSiteURL
		viewSalt = d.Cfg.ViewHashSalt
		if d.Cfg.UploadMaxMB > 0 {
			uploadMax = int64(d.Cfg.UploadMaxMB) << 20
		}
	}

	// Content services are built once and shared by handlers and jobs.
	mediaSvc := media.NewService(d.Pool, d.Storage, auditor, uploadMax)
	categorySvc := category.NewService(d.Pool, auditor, d.Reval)
	tagSvc := tag.NewService(d.Pool, auditor, d.Reval)
	articleSvc := article.NewService(d.Pool, auditor, d.Reval, article.Config{
		PublicSiteURL: publicSiteURL,
		JWTSecret:     secret,
		PreviewTTL:    previewTTL,
		Now:           d.Now,
	})
	analyticsSvc := analytics.NewService(d.Pool, viewSalt, d.Now)
	searchSvc := search.NewService(d.Pool)
	eventSvc := event.NewService(d.Pool, auditor, d.Reval)
	alumniSvc := alumni.NewService(d.Pool, auditor, d.Reval)
	videoSvc := video.NewService(d.Pool, auditor, d.Reval)
	pageSvc := page.NewService(d.Pool, auditor, d.Reval)
	snippetSvc := snippet.NewService(d.Pool, auditor, d.Reval)
	homepageSvc := homepage.NewService(d.Pool, auditor, d.Reval, homepage.NewRegistry(), d.Now)
	menuSvc := menu.NewService(d.Pool, auditor, d.Reval)
	settingSvc := setting.NewService(d.Pool, auditor, d.Reval)
	siteSvc := site.NewService(d.Pool, d.Now)
	sitemapSvc := sitemap.NewService(d.Pool, d.Now)
	dashboardSvc := dashboard.NewService(d.Pool, d.Now)

	articleH := article.NewHandler(articleSvc).WithPreviewLimiter(ratelimit.New(previewLimit, previewWindow))
	categoryH := category.NewHandler(categorySvc)
	tagH := tag.NewHandler(tagSvc)
	eventH := event.NewHandler(eventSvc)
	alumniH := alumni.NewHandler(alumniSvc)
	videoH := video.NewHandler(videoSvc)
	pageH := page.NewHandler(pageSvc)
	snippetH := snippet.NewHandler(snippetSvc)
	homepageH := homepage.NewHandler(homepageSvc)

	api.Route("/public", func(p chi.Router) {
		p.Use(httpx.CacheControl(publicMaxAge))
		// Analytics first: /articles/trending and /articles/popular must not
		// be captured by the article detail route /articles/{slug}.
		analytics.NewHandler(analyticsSvc, ratelimit.New(viewLimit, viewWindow)).RegisterPublic(p)
		articleH.RegisterPublic(p)
		search.NewHandler(searchSvc).RegisterPublic(p)
		categoryH.RegisterPublic(p)
		tagH.RegisterPublic(p)
		eventH.RegisterPublic(p)
		alumniH.RegisterPublic(p)
		videoH.RegisterPublic(p)
		pageH.RegisterPublic(p)
		snippetH.RegisterPublic(p)
		homepageH.RegisterPublic(p)
		site.NewHandler(siteSvc).RegisterPublic(p)
		sitemap.NewHandler(sitemapSvc).RegisterPublic(p)
	})

	api.Route("/admin", func(ad chi.Router) {
		ad.Use(authn, csrf)
		user.NewHandler(user.NewService(d.Pool, auditor, checker, d.Reval)).Register(ad, guard)
		role.NewHandler(role.NewService(d.Pool, auditor, checker)).Register(ad, guard)
		audit.NewHandler(audit.NewListService(d.Pool)).Register(ad, guard)

		media.NewHandler(mediaSvc).Register(ad, guard)
		categoryH.Register(ad, guard)
		tagH.Register(ad, guard)
		articleH.Register(ad, guard)
		eventH.Register(ad, guard)
		alumniH.Register(ad, guard)
		videoH.Register(ad, guard)
		pageH.Register(ad, guard)
		snippetH.Register(ad, guard)
		homepageH.Register(ad, guard)
		menu.NewHandler(menuSvc).Register(ad, guard)
		setting.NewHandler(settingSvc).Register(ad, guard)
		dashboard.NewHandler(dashboardSvc).Register(ad, guard)
	})

	return []jobs.Job{
		articleSvc.PublishDueJob(d.Log),
		snippetWindowJob(snippetSvc, d.Log),
		analyticsSvc.CleanupJob(d.Log),
	}
}

// snippetWindowJob wraps snippet.Service.WindowTransitions (which enqueues
// the snippets/homepage tags itself) as a one-minute job.
func snippetWindowJob(svc *snippet.Service, log *slog.Logger) jobs.Job {
	return jobs.Job{
		Name:  snippetJobName,
		Every: time.Minute,
		Fn: func(ctx context.Context) error {
			n, err := svc.WindowTransitions(ctx)
			if n > 0 {
				log.InfoContext(ctx, "snippet window transitions", "count", n)
			}
			return err
		},
	}
}

// trustedProxies returns the peers whose forwarding headers RealIP believes:
// TRUSTED_PROXIES from cfg, or loopback for a nil cfg (tests).
func trustedProxies(cfg *config.Config) []netip.Prefix {
	if cfg == nil {
		return appmw.DefaultTrustedProxies
	}
	return cfg.TrustedProxyPrefixes()
}

// authConfig returns token lifetimes from cfg, falling back to the documented
// defaults (docs/09 §1) for unset values or a nil cfg (tests).
func authConfig(cfg *config.Config) auth.Config {
	out := auth.Config{
		AccessTTL:          15 * time.Minute,
		RefreshTTL:         7 * 24 * time.Hour,
		RefreshTTLRemember: 30 * 24 * time.Hour,
	}
	if cfg == nil {
		return out
	}
	if cfg.AccessTokenTTL > 0 {
		out.AccessTTL = cfg.AccessTokenTTL
	}
	if cfg.RefreshTokenTTL > 0 {
		out.RefreshTTL = cfg.RefreshTokenTTL
	}
	if cfg.RefreshTokenTTLRemember > 0 {
		out.RefreshTTLRemember = cfg.RefreshTokenTTLRemember
	}
	return out
}

// jwtSecret returns the configured signing secret. Without one (only possible
// when cfg bypassed validation, e.g. in tests) a random per-process secret is
// used so tokens can never be forged with a known key.
func jwtSecret(cfg *config.Config, log *slog.Logger) []byte {
	if cfg != nil && cfg.JWTSecret != "" {
		return []byte(cfg.JWTSecret)
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("server: generate random jwt secret: " + err.Error())
	}
	log.Warn("JWT_SECRET empty; using a random per-process secret")
	return b
}

func notFound(w http.ResponseWriter, r *http.Request) {
	httpx.WriteError(w, r, httpx.NotFound())
}

func methodNotAllowed(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusMethodNotAllowed, map[string]any{
		"error": map[string]string{
			"code":    "method_not_allowed",
			"message": "Metode HTTP tidak diizinkan.",
		},
	})
}

// uploadsHandler serves files from dir under /uploads/ with long-lived
// immutable caching for successful responses only; errors (404 etc.) are
// no-store so a missing file is never cached. Directory listings are
// disabled (404).
func uploadsHandler(dir string) http.Handler {
	fsrv := http.StripPrefix("/uploads", http.FileServer(noDirFS{http.Dir(dir)}))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fsrv.ServeHTTP(&uploadCacheWriter{ResponseWriter: w}, r)
	})
}

// uploadCacheWriter picks the Cache-Control header from the final status code.
type uploadCacheWriter struct {
	http.ResponseWriter
	wroteHeader bool
}

func (w *uploadCacheWriter) WriteHeader(status int) {
	if !w.wroteHeader {
		w.wroteHeader = true
		if status >= 200 && status < 400 {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-store")
		}
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *uploadCacheWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

// noDirFS hides directories so http.FileServer never renders listings.
type noDirFS struct{ fs http.FileSystem }

func (n noDirFS) Open(name string) (http.File, error) {
	f, err := n.fs.Open(name)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		_ = f.Close()
		return nil, err
	}
	if st.IsDir() {
		_ = f.Close()
		return nil, os.ErrNotExist
	}
	return f, nil
}
