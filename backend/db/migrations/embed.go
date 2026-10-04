// Package migrations embeds the goose SQL migrations so they ship inside the binary.
package migrations

import "embed"

// FS holds every *.sql migration at its root.
//
//go:embed *.sql
var FS embed.FS
