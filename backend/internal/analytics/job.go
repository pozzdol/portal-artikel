package analytics

import (
	"context"
	"io"
	"log/slog"
	"time"

	"portal-berita/backend/internal/jobs"
)

// CleanupJobName identifies the dedup cleanup job in logs.
const CleanupJobName = "analytics.cleanup_view_dedup"

// CleanupJob returns the daily job (also run at start) that prunes
// article_view_dedup. A nil log discards output.
func (s *Service) CleanupJob(log *slog.Logger) jobs.Job {
	if log == nil {
		log = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	return jobs.Job{
		Name:       CleanupJobName,
		Every:      24 * time.Hour,
		RunAtStart: true,
		Fn: func(ctx context.Context) error {
			n, err := s.CleanupDedup(ctx)
			if err != nil {
				return err
			}
			log.Info("view dedup cleanup", "deleted", n)
			return nil
		},
	}
}
