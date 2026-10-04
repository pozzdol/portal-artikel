# CLAUDE.md

@AGENTS.md

## Claude Code–specific rules

### Subagents
- **Planner = always model `fable`** (use the `Plan` agent with `model: "fable"`). Every phase or large feature starts with a planner pass that splits work into parallel, file-disjoint worker packages with explicit contracts.
- **Workers = `opus` / `sonnet` / `haiku`**, chosen by difficulty:
  - `opus`: security-critical or intricate code (auth, RBAC, migrations/SQL, revalidation, rich-text sanitizing, section builder)
  - `sonnet`: standard feature work (CRUD handlers, pages, components, seed data)
  - `haiku`: trivial/mechanical work (renames, boilerplate, config files, doc checklist ticks)
- Workers must not edit the same files in parallel. The orchestrator (main session) integrates, verifies, and commits.
- Workers do not commit. Only the orchestrator commits.

### UI work
- Any task that builds or restyles UI (public site, admin CMS, components) must use the **`frontend-design` skill** (`/frontend-design`), together with the design tokens in `docs/02-analisis-desain.md`. Workers that build UI must be told to load it.
- **All UI components come from shadcn/ui** (button, input, select, checkbox, dialog, popover, date/time/range pickers, table, tabs, toast, …), added with `bunx shadcn@latest add …` and themed to the ALMAIDAH tokens. Do not hand-roll a primitive that shadcn provides, and do not add another component library.

### Commits & tags
- One line, Conventional Commits, **no Co-Authored-By / no "Generated with Claude Code" / no watermark**. This project rule overrides the default attribution behavior.
- Local git identity is already configured in the repo (`git config user.name/email`); do not change it.
- After a phase is verified: `git tag -f v0.<phase>.0` (annotated with a one-line message) to update the tag.

### Workflow
- Follow `docs/08-fase-kerja.md`. Finish, verify, and report each phase to the owner before starting the next.
- Discuss in Indonesian with the owner. Ask multiple-choice questions (AskUserQuestion) for genuine decisions.
- Verify against the real DB/app (migrate, seed, run, curl) before reporting a phase as done; report failures honestly.
