package server

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/httpx"
)

const readyTimeout = 3 * time.Second

// healthz is a liveness probe: the process is up.
func healthz(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// readyz is a readiness probe: the database answers a ping within 3s.
func readyz(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if pool == nil {
			writeUnavailable(w)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), readyTimeout)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			writeUnavailable(w)
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok", "database": "ok"})
	}
}

func writeUnavailable(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable", "database": "error"})
}
