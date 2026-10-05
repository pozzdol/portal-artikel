package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/apperr"
	"portal-berita/backend/internal/audit"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
	"portal-berita/backend/internal/phone"
	"portal-berita/backend/internal/revalidate"
)

// User-facing (Indonesian) session messages.
const (
	msgSessionInvalid  = "Sesi tidak valid."
	msgSessionReuse    = "Sesi dicabut karena terdeteksi aktivitas mencurigakan. Silakan masuk kembali."
	msgSessionExpired  = "Sesi telah berakhir. Silakan masuk kembali."
	msgWrongPassword   = "Kata sandi saat ini salah."
	msgMediaNotFound   = "Media tidak ditemukan."
	msgRequired        = "Wajib diisi."
	msgSamePassword    = "Kata sandi baru harus berbeda dari kata sandi saat ini."
	constraintAvatarFK = "users_avatar_media_id_fkey"
)

// fallbackDummyHash is a well-formed argon2id hash with the production
// parameters, used only if generating the dummy hash at startup fails.
const fallbackDummyHash = "$argon2id$v=19$m=65536,t=3,p=2$c29tZXNhbHRzb21lc2FsdA$Q2xhdWRlRHVtbXlIYXNoRm9yVGltaW5nRXF1YWxpdHk"

// Service implements authentication: login, refresh rotation with reuse
// detection, logout, profile and session management.
type Service struct {
	pool      *pgxpool.Pool
	issuer    *TokenIssuer
	auditor   *audit.Logger
	limiter   *LoginLimiter
	cfg       Config
	now       func() time.Time
	dummyHash string
	reval     revalidate.Client
	inv       Invalidator
}

// Invalidator drops cached authorization state of a user (rbac.Checker
// implements it). Declared locally so auth does not import rbac.
type Invalidator interface {
	Invalidate(userID int64)
}

type noopInvalidator struct{}

func (noopInvalidator) Invalidate(int64) {}

// NewService wires the auth service. A dummy password hash is computed once
// so failed logins for unknown/disabled accounts cost the same as real ones.
func NewService(pool *pgxpool.Pool, issuer *TokenIssuer, auditor *audit.Logger, limiter *LoginLimiter, cfg Config) *Service {
	dummy, err := HashPassword("almaidah-dummy-password-for-timing")
	if err != nil {
		slog.Warn("auth: dummy hash generation failed, using fallback", "error", err)
		dummy = fallbackDummyHash
	}
	return &Service{
		pool:      pool,
		issuer:    issuer,
		auditor:   auditor,
		limiter:   limiter,
		cfg:       cfg,
		now:       func() time.Time { return time.Now().UTC() },
		dummyHash: dummy,
		reval:     revalidate.Noop{},
		inv:       noopInvalidator{},
	}
}

// WithInvalidator sets the cache invalidated after a password change (the
// flag and perm_version change). A nil value is treated as a no-op.
func (s *Service) WithInvalidator(inv Invalidator) *Service {
	if inv == nil {
		inv = noopInvalidator{}
	}
	s.inv = inv
	return s
}

// WithClock replaces the service time source (tests).
func (s *Service) WithClock(now func() time.Time) *Service {
	s.now = now
	return s
}

// WithRevalidator sets the client notified of cache tags to revalidate
// after a committed self-profile edit (docs/03-arsitektur.md §4.2). A nil
// client is treated as revalidate.Noop{}.
func (s *Service) WithRevalidator(c revalidate.Client) *Service {
	if c == nil {
		c = revalidate.Noop{}
	}
	s.reval = c
	return s
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Identifier kinds accepted at login.
const (
	identEmail   = "email"
	identPhone   = "phone"
	identUnknown = "unknown"
)

// parseIdentifier classifies a login identifier: anything containing '@' is
// an email (trimmed, lower-cased); otherwise it must be a valid Indonesian
// mobile number (normalized). Unparseable input yields identUnknown with the
// trimmed raw value; such logins always fail like an unknown user.
func parseIdentifier(raw string) (kind, norm string) {
	t := strings.TrimSpace(raw)
	if strings.Contains(t, "@") {
		return identEmail, normalizeEmail(t)
	}
	if n, ok := phone.Normalize(t); ok {
		return identPhone, n
	}
	return identUnknown, strings.ToLower(t)
}

func limiterKey(c Client, kind, norm string) string {
	ip := "unknown"
	if c.IP != nil {
		ip = c.IP.String()
	}
	return ip + "|" + kind + ":" + norm
}

// lookupLoginUser loads the user for a parsed identifier. found is false for
// unknown users and unparseable identifiers.
func lookupLoginUser(ctx context.Context, q *dbgen.Queries, kind, norm string) (u dbgen.GetUserByEmailRow, found bool, err error) {
	switch kind {
	case identEmail:
		u, err = q.GetUserByEmail(ctx, norm)
	case identPhone:
		var pu dbgen.GetUserByPhoneRow
		pu, err = q.GetUserByPhone(ctx, norm)
		u = dbgen.GetUserByEmailRow(pu)
	default:
		return u, false, nil
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return dbgen.GetUserByEmailRow{}, false, nil
		}
		return u, false, fmt.Errorf("auth: login lookup: %w", err)
	}
	return u, true, nil
}

func optString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func int64Ptr(v int64) *int64 { return &v }

// Login authenticates identifier (email or mobile number) + password and
// opens a new session (refresh family). Unknown users, unparseable
// identifiers, disabled accounts and wrong passwords all cost one argon2
// verification and return the same invalid_credentials error. Users flagged
// must_change_password can log in; the flag is reported in Me.
func (s *Service) Login(ctx context.Context, identifier, password string, remember bool, c Client) (*Session, error) {
	kind, norm := parseIdentifier(identifier)
	key := limiterKey(c, kind, norm)
	// Rate limit before any DB or argon2 work.
	if ok, retry := s.limiter.Allow(key); !ok {
		return nil, apperr.RateLimited(retry)
	}

	q := dbgen.New(s.pool)
	u, found, err := lookupLoginUser(ctx, q, kind, norm)
	if err != nil {
		return nil, err
	}
	usable := found && u.IsActive && u.CanLogin && u.PasswordHash != nil
	hash := s.dummyHash
	if usable {
		hash = *u.PasswordHash
	}
	match, verr := VerifyPassword(password, hash)
	if verr != nil {
		slog.ErrorContext(ctx, "auth: stored password hash invalid", "user_id", u.ID, "error", verr)
		match = false
	}
	if !usable || !match {
		e := audit.Entry{
			Action:     audit.ActionLoginFailed,
			EntityType: audit.EntityUser,
			Summary:    "Percobaan masuk gagal",
			Changes:    map[string]string{"identifier": norm, "kind": kind},
			IP:         c.IP,
		}
		if found {
			e.UserID, e.EntityID = int64Ptr(u.ID), int64Ptr(u.ID)
		}
		s.auditor.LogBestEffort(ctx, e)
		return nil, apperr.InvalidCredentials()
	}
	s.limiter.Reset(key)

	ttl := s.cfg.RefreshTTL
	if remember {
		ttl = s.cfg.RefreshTTLRemember
	}
	var sess *Session
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		qtx := dbgen.New(tx)
		if err := qtx.TouchLastLogin(ctx, u.ID); err != nil {
			return fmt.Errorf("auth: touch last login: %w", err)
		}
		var err error
		sess, err = s.openSession(ctx, qtx, u.ID, u.PermVersion, pgtype.UUID{}, s.now().Add(ttl), c)
		return err
	})
	if err != nil {
		return nil, err
	}

	s.auditor.LogBestEffort(ctx, audit.Entry{
		UserID:     int64Ptr(u.ID),
		Action:     audit.ActionLogin,
		EntityType: audit.EntityUser,
		EntityID:   int64Ptr(u.ID),
		Summary:    "Masuk ke CMS",
		IP:         c.IP,
	})
	if n, err := q.DeleteExpiredRefreshTokens(ctx); err != nil {
		slog.WarnContext(ctx, "auth: delete expired refresh tokens failed", "error", err)
	} else if n > 0 {
		slog.InfoContext(ctx, "auth: deleted expired refresh tokens", "count", n)
	}
	return sess, nil
}

// openSession inserts a refresh token (new family when familyID is invalid),
// issues the access and CSRF tokens and loads the user, all on q.
func (s *Service) openSession(ctx context.Context, q *dbgen.Queries, userID int64, permVersion int32,
	familyID pgtype.UUID, expiresAt time.Time, c Client) (*Session, error) {
	raw, hash, err := NewRefreshToken()
	if err != nil {
		return nil, err
	}
	rt, err := q.CreateRefreshToken(ctx, dbgen.CreateRefreshTokenParams{
		UserID:    userID,
		FamilyID:  familyID,
		TokenHash: hash,
		ExpiresAt: expiresAt,
		UserAgent: optString(c.UserAgent),
		Ip:        c.IP,
	})
	if err != nil {
		return nil, fmt.Errorf("auth: create refresh token: %w", err)
	}
	access, _, err := s.issuer.Issue(Principal{UserID: userID, FamilyID: rt.FamilyID.String(), PermVersion: permVersion})
	if err != nil {
		return nil, err
	}
	csrf, err := NewCSRFToken()
	if err != nil {
		return nil, err
	}
	me, err := loadMe(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	return &Session{
		AccessToken:      access,
		RefreshToken:     raw,
		CSRFToken:        csrf,
		RefreshExpiresAt: rt.ExpiresAt,
		User:             me,
	}, nil
}

// Refresh rotates a refresh token. Decision order (docs/plan §1.3): unknown →
// revoked → rotated (reuse: revoke family + audit, committed) → expired →
// inactive user (revoke family) → rotate. It never returns token_expired.
func (s *Service) Refresh(ctx context.Context, rawRefresh string, c Client) (*Session, error) {
	if rawRefresh == "" {
		return nil, apperr.Unauthenticated(msgSessionInvalid)
	}
	var (
		sess *Session
		// outcome is returned after a committed transaction, so revocations
		// persist even though the caller receives a 401.
		outcome error
	)
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		row, err := q.GetRefreshTokenByHashForUpdate(ctx, HashRefreshToken(rawRefresh))
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				outcome = apperr.Unauthenticated(msgSessionInvalid)
				return nil
			}
			return fmt.Errorf("auth: refresh lookup: %w", err)
		}
		switch {
		case row.RevokedAt != nil:
			outcome = apperr.Unauthenticated(msgSessionInvalid)
			return nil
		case row.RotatedAt != nil:
			if _, err := q.RevokeRefreshTokenFamily(ctx, row.FamilyID); err != nil {
				return fmt.Errorf("auth: revoke family on reuse: %w", err)
			}
			if err := s.auditor.LogTx(ctx, tx, audit.Entry{
				UserID:     int64Ptr(row.UserID),
				Action:     audit.ActionRefreshReuse,
				EntityType: audit.EntityUser,
				EntityID:   int64Ptr(row.UserID),
				Summary:    "Deteksi pemakaian ulang refresh token; semua sesi dicabut",
				Changes:    map[string]string{"family_id": row.FamilyID.String()},
				IP:         c.IP,
			}); err != nil {
				return err
			}
			slog.WarnContext(ctx, "auth: refresh token reuse detected; family revoked",
				"user_id", row.UserID, "family_id", row.FamilyID.String(), "ip", ipString(c))
			outcome = apperr.Unauthenticated(msgSessionReuse)
			return nil
		case !row.ExpiresAt.After(s.now()):
			outcome = apperr.Unauthenticated(msgSessionExpired)
			return nil
		case !row.IsActive || !row.CanLogin:
			if _, err := q.RevokeRefreshTokenFamily(ctx, row.FamilyID); err != nil {
				return fmt.Errorf("auth: revoke family of disabled user: %w", err)
			}
			outcome = apperr.Unauthenticated(msgSessionInvalid)
			return nil
		}
		if err := q.MarkRefreshTokenRotated(ctx, row.ID); err != nil {
			return fmt.Errorf("auth: mark rotated: %w", err)
		}
		sess, err = s.openSession(ctx, q, row.UserID, row.PermVersion, row.FamilyID, row.ExpiresAt, c)
		return err
	})
	if err != nil {
		return nil, err
	}
	if outcome != nil {
		return nil, outcome
	}
	return sess, nil
}

func ipString(c Client) string {
	if c.IP == nil {
		return ""
	}
	return c.IP.String()
}

// Logout revokes the family of rawRefresh, if it is a known live token.
func (s *Service) Logout(ctx context.Context, rawRefresh string, c Client) error {
	if rawRefresh == "" {
		return nil
	}
	return database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		row, err := q.GetRefreshTokenByHashForUpdate(ctx, HashRefreshToken(rawRefresh))
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil
			}
			return fmt.Errorf("auth: logout lookup: %w", err)
		}
		if row.RevokedAt != nil {
			return nil
		}
		if _, err := q.RevokeRefreshTokenFamily(ctx, row.FamilyID); err != nil {
			return fmt.Errorf("auth: logout revoke: %w", err)
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID:     int64Ptr(row.UserID),
			Action:     audit.ActionLogout,
			EntityType: audit.EntityUser,
			EntityID:   int64Ptr(row.UserID),
			Summary:    "Keluar dari CMS",
			IP:         c.IP,
		})
	})
}

// Me returns the user's profile, roles and permissions. Inactive or
// non-login users are unauthenticated.
func (s *Service) Me(ctx context.Context, userID int64) (*Me, error) {
	return loadMe(ctx, dbgen.New(s.pool), userID)
}

func loadMe(ctx context.Context, q *dbgen.Queries, userID int64) (*Me, error) {
	u, err := q.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.Unauthenticated("")
		}
		return nil, fmt.Errorf("auth: get user: %w", err)
	}
	if !u.IsActive || !u.CanLogin {
		return nil, apperr.Unauthenticated("")
	}
	roles, err := q.ListUserRoles(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("auth: list roles: %w", err)
	}
	perms, err := q.ListUserPermissionCodes(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("auth: list permissions: %w", err)
	}
	me := &Me{
		ID:                 u.ID,
		Email:              u.Email,
		Phone:              u.Phone,
		DisplayName:        u.DisplayName,
		Slug:               u.Slug,
		Title:              u.Title,
		Bio:                u.Bio,
		AvatarMediaID:      u.AvatarMediaID,
		CanLogin:           u.CanLogin,
		IsActive:           u.IsActive,
		MustChangePassword: u.MustChangePassword,
		Roles:              make([]RoleRef, 0, len(roles)),
		Permissions:        append(make([]string, 0, len(perms)), perms...),
		LastLoginAt:        httpx.FormatTimePtr(u.LastLoginAt),
		CreatedAt:          httpx.FormatTime(u.CreatedAt),
	}
	for _, r := range roles {
		me.Roles = append(me.Roles, RoleRef{ID: r.ID, Code: r.Code, Name: r.Name})
	}
	return me, nil
}

// requireActive returns Unauthenticated unless the user exists, is active
// and can log in. It returns the access row for further checks.
func requireActive(ctx context.Context, q *dbgen.Queries, userID int64) (dbgen.GetUserAccessRow, error) {
	acc, err := q.GetUserAccess(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return acc, apperr.Unauthenticated("")
		}
		return acc, fmt.Errorf("auth: get access: %w", err)
	}
	if !acc.IsActive || !acc.CanLogin {
		return acc, apperr.Unauthenticated("")
	}
	return acc, nil
}

func trimOptional(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

// UpdateMe updates the caller's own profile. Users flagged
// must_change_password get apperr.ErrPasswordChangeRequired.
func (s *Service) UpdateMe(ctx context.Context, userID int64, in UpdateMeInput, c Client) (*Me, error) {
	name := strings.TrimSpace(in.DisplayName)
	if name == "" {
		return nil, apperr.Validation(map[string]string{"display_name": msgRequired})
	}
	var me *Me
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		acc, err := requireActive(ctx, q, userID)
		if err != nil {
			return err
		}
		if acc.MustChangePassword {
			return apperr.PasswordChangeRequired()
		}
		_, err = q.UpdateUserProfile(ctx, dbgen.UpdateUserProfileParams{
			DisplayName:   name,
			Title:         trimOptional(in.Title),
			Bio:           trimOptional(in.Bio),
			AvatarMediaID: in.AvatarMediaID,
			ID:            userID,
		})
		if err != nil {
			if c, ok := database.ForeignKeyViolation(err); ok && c == constraintAvatarFK {
				return apperr.Validation(map[string]string{"avatar_media_id": msgMediaNotFound})
			}
			return fmt.Errorf("auth: update profile: %w", err)
		}
		if err := s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID:     int64Ptr(userID),
			Action:     audit.ActionUpdate,
			EntityType: audit.EntityUser,
			EntityID:   int64Ptr(userID),
			Summary:    "Memperbarui profil sendiri",
			IP:         c.IP,
		}); err != nil {
			return err
		}
		me, err = loadMe(ctx, q, userID)
		return err
	})
	if err != nil {
		return nil, err
	}
	s.reval.Enqueue(revalidate.Author(me.Slug), revalidate.TagHomepage, revalidate.TagSitemap)
	return me, nil
}

func parseFamilyID(s string) (pgtype.UUID, bool) {
	var u pgtype.UUID
	if s == "" || u.Scan(s) != nil || !u.Valid {
		return pgtype.UUID{}, false
	}
	return u, true
}

// ChangePassword verifies the current password, sets the new one (which must
// differ from the current one), clears must_change_password, bumps the
// perm_version and revokes every other session of the user (the current one
// is kept). The bumped perm_version makes the caller's current access token
// stale: its next guarded request gets token_expired once and the client
// refreshes into a token carrying the new version.
func (s *Service) ChangePassword(ctx context.Context, p Principal, current, next string, c Client) error {
	keep, ok := parseFamilyID(p.FamilyID)
	if !ok {
		return apperr.Unauthenticated("")
	}
	q := dbgen.New(s.pool)
	acc, err := requireActive(ctx, q, p.UserID)
	if err != nil {
		return err
	}
	stored, err := q.GetUserPasswordHash(ctx, p.UserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.Unauthenticated("")
		}
		return fmt.Errorf("auth: get password hash: %w", err)
	}
	hash := s.dummyHash
	if stored != nil {
		hash = *stored
	}
	match, verr := VerifyPassword(current, hash)
	if verr != nil || !match || stored == nil {
		return apperr.Validation(map[string]string{"current_password": msgWrongPassword})
	}
	// current is verified to equal the stored password, so this rejects
	// re-using it as the new one.
	if next == current {
		return apperr.Validation(map[string]string{"new_password": msgSamePassword})
	}
	newHash, err := HashPassword(next)
	if err != nil {
		return err
	}
	err = database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		qtx := dbgen.New(tx)
		if err := qtx.UpdateUserPassword(ctx, dbgen.UpdateUserPasswordParams{
			PasswordHash:       &newHash,
			MustChangePassword: false,
			ID:                 p.UserID,
		}); err != nil {
			return fmt.Errorf("auth: update password: %w", err)
		}
		if _, err := qtx.BumpUserPermVersion(ctx, p.UserID); err != nil {
			return fmt.Errorf("auth: bump perm version: %w", err)
		}
		n, err := qtx.RevokeOtherUserRefreshTokens(ctx, dbgen.RevokeOtherUserRefreshTokensParams{UserID: p.UserID, KeepFamilyID: keep})
		if err != nil {
			return fmt.Errorf("auth: revoke other sessions: %w", err)
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID:     int64Ptr(p.UserID),
			Action:     audit.ActionPasswordChange,
			EntityType: audit.EntityUser,
			EntityID:   int64Ptr(p.UserID),
			Summary:    "Mengganti kata sandi sendiri; sesi lain dicabut",
			Changes:    map[string]any{"revoked_tokens": n, "forced": acc.MustChangePassword},
			IP:         c.IP,
		})
	})
	if err != nil {
		return err
	}
	s.inv.Invalidate(p.UserID)
	return nil
}

// ListSessions returns the caller's active sessions, newest first.
func (s *Service) ListSessions(ctx context.Context, p Principal) ([]SessionInfo, error) {
	rows, err := dbgen.New(s.pool).ListActiveSessions(ctx, p.UserID)
	if err != nil {
		return nil, fmt.Errorf("auth: list sessions: %w", err)
	}
	out := make([]SessionInfo, 0, len(rows))
	for _, r := range rows {
		fid := r.FamilyID.String()
		var ip *string
		if r.Ip != nil {
			v := r.Ip.String()
			ip = &v
		}
		out = append(out, SessionInfo{
			FamilyID:   fid,
			UserAgent:  r.UserAgent,
			IP:         ip,
			StartedAt:  httpx.FormatTime(r.StartedAt),
			LastUsedAt: httpx.FormatTime(r.LastUsedAt),
			ExpiresAt:  httpx.FormatTime(r.ExpiresAt),
			Current:    fid == p.FamilyID,
		})
	}
	return out, nil
}

// RevokeSession revokes one of the caller's sessions. Unknown, foreign or
// already revoked families are NotFound. revokedCurrent reports whether the
// caller revoked its own current session.
func (s *Service) RevokeSession(ctx context.Context, p Principal, familyID string, c Client) (bool, error) {
	fid, ok := parseFamilyID(familyID)
	if !ok {
		return false, apperr.NotFound()
	}
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		n, err := q.RevokeUserRefreshTokenFamily(ctx, dbgen.RevokeUserRefreshTokenFamilyParams{FamilyID: fid, UserID: p.UserID})
		if err != nil {
			return fmt.Errorf("auth: revoke session: %w", err)
		}
		if n == 0 {
			return apperr.NotFound()
		}
		return s.auditor.LogTx(ctx, tx, audit.Entry{
			UserID:     int64Ptr(p.UserID),
			Action:     audit.ActionSessionRevoke,
			EntityType: audit.EntityUser,
			EntityID:   int64Ptr(p.UserID),
			Summary:    "Mencabut sesi",
			Changes:    map[string]string{"family_id": fid.String()},
			IP:         c.IP,
		})
	})
	if err != nil {
		return false, err
	}
	return fid.String() == p.FamilyID, nil
}
