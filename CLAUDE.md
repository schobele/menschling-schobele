# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- SOUL -->
<!-- /SOUL -->

<!-- PROJECT -->
<!-- /PROJECT -->

<!-- TEMPLATE -->

## What is Menschling

AI agent workspace template. Turns `.claude/agents/*.md` "brains" into a team of specialized AI agents, orchestrated by Paperclip, extended by the `mensch` CLI toolbox, backed by an Obsidian vault synced to OpenAI vector stores, and accessible via webhook adapters (Telegram, email, REST, CLI, WhatsApp).

No SDK orchestration. No MCP servers. No message queues. Just Claude Code CLI, Paperclip heartbeats, markdown brain definitions, and a domain-grouped CLI binary.

The repo IS the operating state. The vault and SQLite manifest are both checked into git.

## Stack

- Runtime: Bun (use `bun` for everything — run, test, install, build)
- Language: TypeScript strict (ESNext, bundler module resolution, JSX via react-jsx)
- Gateway: Elysia (not Express)
- Database: SQLite via `bun:sqlite` (not better-sqlite3), WAL mode
- Knowledge: Obsidian vault → OpenAI Vector Store API
- Orchestration: Paperclip (heartbeat-based)
- Agent runtime: Claude Code CLI with `.claude/agents/` brains

## Commands

```bash
bash scripts/setup.sh    # First-time setup (deps, .env, db, link CLI)
bun install              # Install dependencies
bun link                 # Link `mensch` CLI globally (via package.json "bin")
bun run dev              # Start Elysia gateway
bun test                 # Run all tests
bun test <file>          # Run a single test file
bun run typecheck        # Type check (tsc --noEmit)
```

## Docker

```bash
docker compose up -d                        # Start full stack
docker compose up -d --build                # Rebuild and start
docker compose logs -f menschling           # Follow menschling logs
docker compose exec menschling bash         # Shell into workspace
docker compose down                         # Stop all services
./scripts/paperclip-bootstrap.sh            # First-time: create Paperclip admin account
```

Multiple workspaces on the same machine: use `COMPOSE_PROJECT_NAME` or `-p`:
```bash
COMPOSE_PROJECT_NAME=workspace-a docker compose up -d
COMPOSE_PROJECT_NAME=workspace-b docker compose up -d
```

### First-time setup

1. `bash scripts/setup.sh` — installs deps, generates secrets, links CLI
2. Edit `.env` with your API keys
3. `docker compose up -d` — starts menschling + paperclip + postgres
4. `./scripts/paperclip-bootstrap.sh` — creates CEO invite URL
5. Open the invite URL in your browser to create your Paperclip admin account
6. Run `/onboarding` — the agent configures Paperclip, creates the CEO agent, and wires up the API key
7. `mensch system health` — verify connectivity

### Production deployment (Hetzner)

1. Fork the repo, generate a deploy key (`ssh-keygen -t ed25519`)
2. Place `deploy_key` and `.env` on host at `/opt/menschling/`
3. `docker compose up -d && ./scripts/paperclip-bootstrap.sh`
4. Configure GitHub Actions secrets: `SSH_HOST`, `SSH_PRIVATE_KEY`, `SSH_USER`
5. Agents auto-commit every 15 min, graceful shutdown on SIGTERM

## Bun-specific APIs

- `Bun.serve()` for HTTP/WebSocket/HTTPS (not Express)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.redis` for Redis (not ioredis)
- `Bun.sql` for Postgres (not pg/postgres.js)
- `Bun.file` over `node:fs` readFile/writeFile
- `Bun.$\`cmd\`` over execa
- Built-in `WebSocket` (not ws)
- Bun auto-loads `.env` — no dotenv

## Project structure

- `.claude/agents/` — brains (reusable capability profiles for Paperclip agents)
- `.claude/skills/` — per-domain reference docs, loaded on demand
- `lib/` — shared code (types, env, db, logger, errors)
- `workspace/apps/gateway/` — Elysia server, webhook adapters, dispatch
- `workspace/tools/` — `mensch` CLI: domain-grouped subcommands
- `workspace/knowledge/` — Obsidian vault + SQLite manifest
- `system/cron/` — scheduled tasks
- `docs/MenschlingSystemDesignInit.md` — full system design document

## Architecture

```
Inbound                                                    Outbound
  Telegram ─┐                                        ┌─ Telegram
  Email    ─┤                                        ├─ Email
  REST     ─┼─► normalize() ─► UnifiedMessage ──┐    ├─ Slack
  WhatsApp ─┤                                   │    └─ WhatsApp
  CLI      ─┘                                   │
                                                ▼
                                          dispatch()
                                           │    │
                              ┌────────────┘    └────────────┐
                              ▼                              ▼
                        Paperclip                     direct CLI
                     (PAPERCLIP_ENABLED)          (fallback mode)
                              │
                        agent select
                              │
          ┌───────┬───────────┼────────┬──────────┐
          ▼       ▼           ▼        ▼          ▼
       mastermind knowledge research project  principal
          │
          ├─► mensch messaging send ──► channel adapter ──► outbound
          ├─► mensch knowledge search ──► vector store
          └─► Task(delegate) ──► Paperclip ──► another brain
```

### Brains

Brains are `.claude/agents/*.md` files. Paperclip agents reference brains by name via `--agent <brain>`. Multiple Paperclip agents can share the same brain with different triggers/budgets.

| Brain | Model | Purpose |
|-------|-------|---------|
| mastermind | sonnet | Communication hub, human interface, orchestrator |
| knowledge | sonnet | Knowledge base manager, vault curation, inbox triage |
| research | opus | Deep web research, synthesis |
| project | sonnet | Project management, specs, ADRs |
| menschling | opus | System architect, framework evolution |
| principal | opus | 10x engineer, full code generation |

Brains do NOT call each other directly.

### Inter-Brain Communication

Brains communicate exclusively through Paperclip's task system:

1. Brain A creates a Paperclip issue via Task tool
2. Paperclip assigns the issue to the appropriate agent (by brain type)
3. Brain B receives the issue context as its prompt
4. Brain B completes work and releases the issue
5. Brain A receives the result (if waiting) or Paperclip routes the output

Brains never import each other's code, share memory, or call each other's CLI commands directly.

### Vault structure

```
vault/
├── 00-inbox/        # Unprocessed captures (brains + humans write)
├── 01-projects/     # Active project docs (ProjectBrain + humans)
├── 02-people/       # Contact/relationship notes (humans only)
├── 03-resources/    # Reference material (humans only)
└── 04-log/          # Agent outputs, meeting notes, decisions (brains + humans)
```

## mensch CLI

All output is JSON to stdout. Logging goes to stderr. Named flags only (no positional args).

```bash
# Messaging
mensch messaging send --channel <slack|telegram|email> --conversation <target> --message <text>
mensch messaging send --channel email --to <addr> --subject <subj> --body <text>
mensch messaging reply --channel slack --conversation <ch> --thread <ts> --message <text>
mensch messaging status --id <message_id>

# Knowledge
mensch knowledge search --query <text> [--filter <key=value>] [--top <n>]
mensch knowledge sync [--dry-run] [--force] [--path <subpath>]
mensch knowledge write --path <path> --title <title> --category <cat> --body <content>
mensch knowledge inspect --path <path>

# System
mensch system health
mensch system env
mensch system manifest [--stats]
```

## Error Taxonomy

All CLI commands return JSON with `{ success, data?, error?, code? }`. Common error codes:

| Code | Meaning | Recovery |
|------|---------|----------|
| `CHANNEL_NOT_CONFIGURED` | Channel missing from .env | Add the channel's API key to .env |
| `EXTERNAL_API_ERROR` | Upstream API failure (Slack, Telegram, OpenAI) | Check API key validity, retry |
| `NOT_FOUND` | Requested resource doesn't exist | Verify the path or ID |
| `SYNC_ERROR` | Knowledge sync failed for a file | Check `mensch knowledge inspect --path <path>` |
| `GIT_ERROR` | Git operation failed (shutdown/auto-commit) | Check git remote config and deploy key |
| `UNKNOWN_ERROR` | Untyped exception | Check stderr logs for stack trace |

## Conventions

- Named exports only, no default exports
- Env vars validated with Zod in `lib/env.ts`
- Errors: typed classes from `lib/errors.ts`
- Tests colocated: `foo.test.ts` next to `foo.ts`
- CLI tools use `handler()` wrapper from `shared/base.ts`, return `CommandResult`
- Zod schemas in `shared/validators.ts`
- Pino logger via `lib/logger.ts`
- Dependencies flow inward: `lib ← tools`, `lib ← apps`

## Adding a new CLI domain

1. Create `workspace/tools/<domain>/index.ts` exporting `register(program)`
2. Create `.claude/skills/<domain>/SKILL.md` with frontmatter
3. Add `Bash(mensch <domain> *)` to `.claude/settings.json`
4. Document in this file

## Adding a new brain

1. Create `.claude/agents/<brain>.md` with YAML frontmatter (name, description, tools, model)
2. Register a Paperclip agent pointing to it via `--agent <brain>`
3. Document in this file

## gstack

Use `/browse` from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills:
- `/browse` — Headless browser: navigate, interact, screenshot, assert
- `/qa` — Systematic QA testing + fix loop with before/after evidence
- `/qa-only` — QA report without fixes
- `/review` — Pre-landing PR review (SQL safety, trust boundaries, side effects)
- `/ship` — Ship workflow: merge, test, version bump, changelog, PR
- `/plan-ceo-review` — Founder-mode plan review (scope expansion/hold/reduction)
- `/plan-eng-review` — Engineering rigor review (architecture, data flow, edge cases)
- `/plan-design-review` — Design audit with AI Slop detection
- `/design-consultation` — Design system creation (typography, color, layout)
- `/qa-design-review` — Design QA + fix loop
- `/setup-browser-cookies` — Import browser cookies for authenticated testing
- `/retro` — Weekly engineering retrospective with metrics
- `/document-release` — Post-ship documentation update

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.

## Git policy

The vault and `menschling.db` are checked in. Only `.env` and `.claude/settings.local.json` are gitignored.

## Updating from template

```bash
./scripts/update-template.sh
```

Fetches upstream template changes and merges them. Your SOUL, PROJECT, custom brains, and vault content are preserved. Conflicts are expected in CLAUDE.md — keep your sections (between `<!-- SOUL -->` and `<!-- PROJECT -->` markers), accept the template's structural updates (between `<!-- TEMPLATE -->` markers).

<!-- /TEMPLATE -->
