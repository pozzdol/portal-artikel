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
}

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
	}
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

func limiterKey(c Client, email string) string {
	ip := "unknown"
	if c.IP != nil {
		ip = c.IP.String()
	}
	return ip + "|" + email
}

func optString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func int64Ptr(v int64) *int64 { return &v }

// Login authenticates email/password and opens a new session (refresh family).
func (s *Service) Login(ctx context.Context, email, password string, remember bool, c Client) (*Session, error) {
	email = normalizeEmail(email)
	key := limiterKey(c, email)
	// Rate limit before any DB or argon2 work.
	if ok, retry := s.limiter.Allow(key); !ok {
		return nil, apperr.RateLimited(retry)
	}

	q := dbgen.New(s.pool)
	u, err := q.GetUserByEmail(ctx, email)
	found := true
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("auth: login lookup: %w", err)
		}
		found = false
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
			Changes:    map[string]string{"email": email},
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
		ID:            u.ID,
		Email:         u.Email,
		DisplayName:   u.DisplayName,
		Slug:          u.Slug,
		Title:         u.Title,
		Bio:           u.Bio,
		AvatarMediaID: u.AvatarMediaID,
		CanLogin:      u.CanLogin,
		IsActive:      u.IsActive,
		Roles:         make([]RoleRef, 0, len(roles)),
		Permissions:   append(make([]string, 0, len(perms)), perms...),
		LastLoginAt:   httpx.FormatTimePtr(u.LastLoginAt),
		CreatedAt:     httpx.FormatTime(u.CreatedAt),
	}
	for _, r := range roles {
		me.Roles = append(me.Roles, RoleRef{ID: r.ID, Code: r.Code, Name: r.Name})
	}
	return me, nil
}

// requireActive returns Unauthenticated unless the user exists, is active
// and can log in.
func requireActive(ctx context.Context, q *dbgen.Queries, userID int64) error {
	acc, err := q.GetUserAccess(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.Unauthenticated("")
		}
		return fmt.Errorf("auth: get access: %w", err)
	}
	if !acc.IsActive || !acc.CanLogin {
		return apperr.Unauthenticated("")
	}
	return nil
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

// UpdateMe updates the caller's own profile.
func (s *Service) UpdateMe(ctx context.Context, userID int64, in UpdateMeInput, c Client) (*Me, error) {
	name := strings.TrimSpace(in.DisplayName)
	if name == "" {
		return nil, apperr.Validation(map[string]string{"display_name": msgRequired})
	}
	var me *Me
	err := database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		q := dbgen.New(tx)
		if err := requireActive(ctx, q, userID); err != nil {
			return err
		}
		_, err := q.UpdateUserProfile(ctx, dbgen.UpdateUserProfileParams{
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

// ChangePassword verifies the current password, sets the new one and revokes
// every other session of the user (the current one is kept).
func (s *Service) ChangePassword(ctx context.Context, p Principal, current, next string, c Client) error {
	keep, ok := parseFamilyID(p.FamilyID)
	if !ok {
		return apperr.Unauthenticated("")
	}
	q := dbgen.New(s.pool)
	if err := requireActive(ctx, q, p.UserID); err != nil {
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
	newHash, err := HashPassword(next)
	if err != nil {
		return err
	}
	return database.WithTx(ctx, s.pool, func(tx pgx.Tx) error {
		qtx := dbgen.New(tx)
		if err := qtx.UpdateUserPassword(ctx, dbgen.UpdateUserPasswordParams{PasswordHash: &newHash, ID: p.UserID}); err != nil {
			return fmt.Errorf("auth: update password: %w", err)
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
			Changes:    map[string]int64{"revoked_tokens": n},
			IP:         c.IP,
		})
	})
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
