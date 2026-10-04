// Package audit writes audit_logs rows.
package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/authctx"
	"portal-berita/backend/internal/dbgen"
)

// Actions.
const (
	ActionLogin          = "login"
	ActionLoginFailed    = "login_failed"
	ActionLogout         = "logout"
	ActionRefreshReuse   = "refresh_reuse"
	ActionPasswordChange = "password_change"
	ActionPasswordReset  = "reset_password"
	ActionSessionRevoke  = "session_revoke"
	ActionCreate         = "create"
	ActionUpdate         = "update"
	ActionDelete         = "delete"
	ActionActivate       = "activate"
	ActionDeactivate     = "deactivate"
	ActionPublish        = "publish"
	ActionUnpublish      = "unpublish"
	ActionSchedule       = "schedule"
	ActionRestore        = "restore"
	ActionReorder        = "reorder"
	ActionMerge          = "merge"
	ActionUpload         = "upload"
)

// Entity types. audit_logs.entity_type is NOT NULL; auth events (login,
// logout, refresh reuse, password/session changes) use EntityUser with
// EntityID = the affected user id (nil for login_failed on an unknown email).
const (
	EntityUser            = "user"
	EntityRole            = "role"
	EntityArticle         = "article"
	EntityCategory        = "category"
	EntityTag             = "tag"
	EntityMedia           = "media"
	EntityEvent           = "event"
	EntityAlumni          = "alumni"
	EntityVideo           = "video"
	EntityPage            = "page"
	EntitySnippet         = "snippet"
	EntityHomepageSection = "homepage_section"
	EntityMenu            = "menu"
	EntitySetting         = "setting"
)

// maxUserAgent bounds stored user agents.
const maxUserAgent = 512

// Entry is one audit record. Changes is JSON-marshalled into JSONB (nil → NULL).
type Entry struct {
	UserID     *int64
	Action     string
	EntityType string
	EntityID   *int64
	Summary    string
	Changes    any
	IP         *netip.Addr
}

// Logger writes audit entries.
type Logger struct {
	pool *pgxpool.Pool
}

// New returns a Logger backed by pool.
func New(pool *pgxpool.Pool) *Logger { return &Logger{pool: pool} }

// Log inserts e using the pool.
func (l *Logger) Log(ctx context.Context, e Entry) error {
	return insert(ctx, dbgen.New(l.pool), e)
}

// LogTx inserts e inside tx, so it commits or rolls back with the caller's work.
func (l *Logger) LogTx(ctx context.Context, tx pgx.Tx, e Entry) error {
	return insert(ctx, dbgen.New(tx), e)
}

// LogBestEffort inserts e and only logs a warning on failure.
func (l *Logger) LogBestEffort(ctx context.Context, e Entry) {
	if err := l.Log(ctx, e); err != nil {
		slog.WarnContext(ctx, "audit log write failed", "action", e.Action, "entity_type", e.EntityType, "error", err)
	}
}

func insert(ctx context.Context, q *dbgen.Queries, e Entry) error {
	var changes []byte
	if e.Changes != nil {
		b, err := json.Marshal(e.Changes)
		if err != nil {
			return fmt.Errorf("audit: marshal changes: %w", err)
		}
		changes = b
	}
	err := q.InsertAuditLog(ctx, dbgen.InsertAuditLogParams{
		UserID:     e.UserID,
		Action:     e.Action,
		EntityType: e.EntityType,
		EntityID:   e.EntityID,
		Summary:    e.Summary,
		Changes:    changes,
		Ip:         e.IP,
	})
	if err != nil {
		return fmt.Errorf("audit: insert %s: %w", e.Action, err)
	}
	return nil
}

// Meta is request metadata used for audit entries and session records.
type Meta struct {
	UserID    *int64
	IP        *netip.Addr
	UserAgent string
}

// RequestMeta extracts the principal's user id (if authenticated), the client
// IP from r.RemoteAddr (with or without port; set by chi's RealIP upstream)
// and the user agent truncated to 512 bytes.
func RequestMeta(r *http.Request) Meta {
	var m Meta
	if p, ok := authctx.FromContext(r.Context()); ok {
		id := p.UserID
		m.UserID = &id
	}
	m.IP = parseIP(r.RemoteAddr)
	m.UserAgent = truncateUTF8(r.UserAgent(), maxUserAgent)
	return m
}

func parseIP(remote string) *netip.Addr {
	host := strings.TrimSpace(remote)
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.TrimSuffix(strings.TrimPrefix(host, "["), "]")
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return nil
	}
	addr = addr.Unmap().WithZone("")
	return &addr
}

func truncateUTF8(s string, n int) string {
	if len(s) <= n {
		return s
	}
	s = s[:n]
	for len(s) > 0 && !utf8.ValidString(s) {
		s = s[:len(s)-1]
	}
	return s
}
