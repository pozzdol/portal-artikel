package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/dbgen"
	"portal-berita/backend/internal/httpx"
)

// ListFilter is the parsed query for GET /admin/audit-logs.
type ListFilter struct {
	EntityType string
	Action     string
	UserID     *int64
	From       *time.Time
	To         *time.Time
	Page       httpx.Pagination
}

// LogItem is the API representation of one audit_logs row.
type LogItem struct {
	ID   int64 `json:"id"`
	User *struct {
		ID          int64  `json:"id"`
		DisplayName string `json:"display_name"`
	} `json:"user"`
	Action     string          `json:"action"`
	EntityType string          `json:"entity_type"`
	EntityID   *int64          `json:"entity_id"`
	Summary    string          `json:"summary"`
	Changes    json.RawMessage `json:"changes,omitempty"`
	IP         *string         `json:"ip"`
	CreatedAt  string          `json:"created_at"`
}

// ListService reads audit_logs for the admin listing endpoint.
type ListService struct {
	pool *pgxpool.Pool
}

// NewListService returns a ListService backed by pool.
func NewListService(pool *pgxpool.Pool) *ListService { return &ListService{pool: pool} }

// List returns the page of audit log entries matching f, newest first, and
// the total row count matching the same filters (ignoring pagination).
func (s *ListService) List(ctx context.Context, f ListFilter) ([]LogItem, int64, error) {
	q := dbgen.New(s.pool)
	entityType := nilIfEmpty(f.EntityType)
	action := nilIfEmpty(f.Action)

	rows, err := q.ListAuditLogs(ctx, dbgen.ListAuditLogsParams{
		EntityType: entityType,
		UserID:     f.UserID,
		Action:     action,
		From:       f.From,
		To:         f.To,
		Offset:     int32(f.Page.Offset),
		Limit:      int32(f.Page.PerPage),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("audit: list logs: %w", err)
	}
	total, err := q.CountAuditLogs(ctx, dbgen.CountAuditLogsParams{
		EntityType: entityType,
		UserID:     f.UserID,
		Action:     action,
		From:       f.From,
		To:         f.To,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("audit: count logs: %w", err)
	}

	items := make([]LogItem, len(rows))
	for i, r := range rows {
		items[i] = toLogItem(r)
	}
	return items, total, nil
}

func toLogItem(r dbgen.ListAuditLogsRow) LogItem {
	item := LogItem{
		ID:         r.ID,
		Action:     r.Action,
		EntityType: r.EntityType,
		EntityID:   r.EntityID,
		Summary:    r.Summary,
		CreatedAt:  httpx.FormatTime(r.CreatedAt),
	}
	if len(r.Changes) > 0 {
		item.Changes = json.RawMessage(r.Changes)
	}
	if r.UserID != nil {
		displayName := ""
		if r.UserDisplayName != nil {
			displayName = *r.UserDisplayName
		}
		item.User = &struct {
			ID          int64  `json:"id"`
			DisplayName string `json:"display_name"`
		}{ID: *r.UserID, DisplayName: displayName}
	}
	if r.Ip != nil {
		ip := r.Ip.String()
		item.IP = &ip
	}
	return item
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
