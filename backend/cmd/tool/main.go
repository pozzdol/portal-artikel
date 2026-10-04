// Command tool is the operations CLI: migrations, seeding, superadmin creation.
// Subcommands register themselves from sibling files via register().
package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"sort"
	"syscall"

	_ "time/tzdata" // embed tz database so Asia/Jakarta always resolves

	"github.com/jackc/pgx/v5/pgxpool"

	"portal-berita/backend/internal/config"
	"portal-berita/backend/internal/database"
	"portal-berita/backend/internal/logging"
)

// Env is passed to every command.
type Env struct {
	Cfg  *config.Config
	Log  *slog.Logger
	Pool *pgxpool.Pool
}

// Command is one tool subcommand.
type Command struct {
	Name  string
	Usage string
	Run   func(ctx context.Context, env *Env, args []string) error
}

var registry = map[string]Command{}

func register(c Command) { registry[c.Name] = c }

func usage(w io.Writer) {
	fmt.Fprintln(w, "Usage: tool <command> [flags]")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "Commands:")
	names := make([]string, 0, len(registry))
	for n := range registry {
		names = append(names, n)
	}
	sort.Strings(names)
	if len(names) == 0 {
		fmt.Fprintln(w, "  (no commands registered)")
	}
	for _, n := range names {
		fmt.Fprintf(w, "  %-20s %s\n", n, registry[n].Usage)
	}
	fmt.Fprintf(w, "  %-20s %s\n", "help", "show this help")
}

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 || args[0] == "help" || args[0] == "-h" || args[0] == "--help" {
		usage(os.Stderr)
		return 2
	}
	cmd, ok := registry[args[0]]
	if !ok {
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", args[0])
		usage(os.Stderr)
		return 2
	}

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	log := logging.New(cfg.AppEnv, cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Error("database connection failed", "error", err)
		return 1
	}
	defer pool.Close()

	if err := cmd.Run(ctx, &Env{Cfg: cfg, Log: log, Pool: pool}, args[1:]); err != nil {
		log.Error("command failed", "command", cmd.Name, "error", err)
		return 1
	}
	return 0
}
