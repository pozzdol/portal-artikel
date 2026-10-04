// Package logging builds the application's slog logger.
package logging

import (
	"log/slog"
	"os"
	"strings"
)

// New returns a logger writing to stdout: human-readable text in development,
// JSON otherwise. It is also installed as the slog default.
func New(appEnv, level string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: parseLevel(level)}
	var h slog.Handler
	if appEnv == "development" {
		h = slog.NewTextHandler(os.Stdout, opts)
	} else {
		h = slog.NewJSONHandler(os.Stdout, opts)
	}
	l := slog.New(h)
	slog.SetDefault(l)
	return l
}

func parseLevel(s string) slog.Level {
	var lvl slog.Level
	if err := lvl.UnmarshalText([]byte(strings.TrimSpace(s))); err != nil {
		return slog.LevelInfo
	}
	return lvl
}
