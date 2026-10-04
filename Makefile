# ALMAIDAH monorepo tasks. Run from the repository root.
SHELL := /bin/bash
.DEFAULT_GOAL := help

# Go toolchain: any installed Go >= 1.21 works; the go command downloads the
# toolchain named in backend/go.mod (checksum-verified) via GOTOOLCHAIN=auto.
# Bump dependencies with explicit versions (`go get mod@vX.Y.Z`), not `go get -u`.
export GOTOOLCHAIN := auto
export GOPROXY := https://proxy.golang.org,direct
GOBIN_DIR := $(shell go env GOPATH)/bin
export PATH := $(GOBIN_DIR):$(HOME)/.bun/bin:/usr/local/go/bin:$(PATH)

# Toolchain version from backend/go.mod (e.g. go1.27.1). Tools are built with it
# so staticcheck/govulncheck understand the module's Go version.
GO_TOOLCHAIN := go$(shell awk '/^go /{print $$2}' backend/go.mod)

SQLC_VERSION := v1.31.1
STATICCHECK_VERSION := v0.8.1
GOVULNCHECK_VERSION := v1.8.0

TOOL := go run ./cmd/tool

.PHONY: help tools dev-api dev-web \
	migrate-up migrate-down migrate-status migrate-reset \
	sqlc seed seed-base seed-demo create-superadmin \
	lint test test-integration vuln build

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

tools: ## Install sqlc, staticcheck and govulncheck (pinned versions, built with the go.mod toolchain)
	GOTOOLCHAIN=$(GO_TOOLCHAIN) go install github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION)
	GOTOOLCHAIN=$(GO_TOOLCHAIN) go install honnef.co/go/tools/cmd/staticcheck@$(STATICCHECK_VERSION)
	GOTOOLCHAIN=$(GO_TOOLCHAIN) go install golang.org/x/vuln/cmd/govulncheck@$(GOVULNCHECK_VERSION)

dev-api: ## Run the Go API on :8080
	cd backend && go run ./cmd/api

dev-web: ## Run the Next.js dev server on :3000
	cd frontend && bun run dev

migrate-up: ## Apply all pending migrations
	cd backend && $(TOOL) migrate up

migrate-down: ## Roll back the last migration (development only)
	cd backend && $(TOOL) migrate down

migrate-status: ## Show migration status
	cd backend && $(TOOL) migrate status

migrate-reset: ## Roll back all migrations (development only)
	cd backend && $(TOOL) migrate reset

sqlc: ## Regenerate backend/internal/dbgen from db/queries
	cd backend && sqlc generate

seed: ## Seed base + demo content (idempotent)
	cd backend && $(TOOL) seed --base --demo

seed-base: ## Seed base data only (settings, menus, homepage, categories)
	cd backend && $(TOOL) seed --base

seed-demo: ## Seed demo content only
	cd backend && $(TOOL) seed --demo

create-superadmin: ## Create/update superadmin: make create-superadmin EMAIL=... NAME="..."
	@test -n "$(EMAIL)" || { echo "EMAIL is required, e.g. make create-superadmin EMAIL=admin@almaidah.id NAME=\"Administrator\""; exit 2; }
	cd backend && $(TOOL) create-superadmin --email "$(EMAIL)" --name "$(NAME)"

lint: ## gofmt + go vet + staticcheck + frontend lint
	cd backend && test -z "$$(gofmt -l .)" || { echo "gofmt needed:"; gofmt -l .; exit 1; }
	cd backend && go vet ./... && staticcheck ./...
	cd frontend && bun run lint

test: ## Run backend unit tests
	cd backend && go test ./...

test-integration: ## Run backend integration tests (needs TEST_DATABASE_URL; run with `go test -p 1` to avoid connection pool conflicts)
	cd backend && go test -p 1 -tags integration ./...

vuln: ## govulncheck (Go deps + stdlib) + bun audit (frontend, >= moderate); runs both, fails if either finds issues
	@rc=0; \
	(cd backend && govulncheck ./...) || rc=1; \
	(cd frontend && bun audit --audit-level=moderate) || rc=1; \
	exit $$rc

build: ## Build backend binaries and the frontend
	cd backend && go build -o bin/api ./cmd/api && go build -o bin/tool ./cmd/tool
	cd frontend && bun run build
