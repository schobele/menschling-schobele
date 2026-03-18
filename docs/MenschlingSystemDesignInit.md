# Menschling System Design

## TL;DR

A single Bun workspace that turns `.claude/agents/*.md` "brains" into a team of specialized AI agents, orchestrated by Paperclip, extended by the `mensch` CLI toolbox, backed by an Obsidian vault synced bidirectionally to OpenAI vector stores, and accessible via webhook adapters for Telegram, email, REST, CLI, and later WhatsApp.

**No SDK orchestration. No MCP servers. No message queues.** Just Claude Code CLI, Paperclip heartbeats, markdown brain definitions, and a domain-grouped CLI binary.

The repo IS the operating state. The vault and SQLite manifest are both checked into git.

---

## Architecture overview

```
Inbound channels (Telegram, Email, REST, CLI, WhatsApp)
       │ webhooks
       ▼
  apps/gateway (Elysia) — normalize → UnifiedMessage → trigger Paperclip
       │
       ▼
  Paperclip — selects agent, each agent has a brain assignment
       │ claude --agent <brain> --yes -p <context>
       ▼
  .claude/agents/*.md — brains (reusable capability profiles)
       │ Bash(mensch <domain> <action> ...)
       ▼
  mensch CLI — domain-grouped toolbox
       │
       ├── mensch messaging send --channel slack ...
       ├── mensch knowledge search --query "..."
       ├── mensch knowledge sync
       └── mensch system health
```

---

## Brains

A brain is a `.claude/agents/*.md` file — a reusable capability profile that defines personality, tools, model, and operating constraints. Paperclip agents are configured in the Paperclip database and each one references a brain by name via `--agent <brain>`.

Multiple Paperclip agents can share the same brain with different triggers, budgets, or task scopes. The brain defines *what it can do*. Paperclip defines *when it runs*.

### Brain roster

| Brain | File | Model | Purpose |
|-------|------|-------|---------|
| **Mastermind** | `mastermind.md` | sonnet | Communication hub, human interface. Receives all inbound messages, responds on channels, delegates to other agents, orchestrates multi-step workflows. |
| **KnowledgeBrain** | `knowledge.md` | sonnet | Knowledge base manager. Sync, search, organize, and curate vault content. Handles triage from 00-inbox, maintains structure. |
| **ResearchBrain** | `research.md` | opus | Deep external research. Web search, public data gathering, synthesis. Writes findings to 04-log. Heavy context, high token budget. |
| **ProjectBrain** | `project.md` | sonnet | Project management. Tracks project status, writes specs and ADRs, maintains 01-projects, generates status reports. |
| **MenschlingBrain** | `menschling.md` | opus | System architect. Maintains and evolves the menschling framework itself — adds new tools, skills, brains. System health, development, architecture. |
| **PrincipalEngineerBrain** | `principal.md` | opus | 10x software engineer. Full code generation, refactoring, debugging, architecture. All Bash permissions, file system access, git operations (read). |

### Brain ↔ Paperclip agent relationship

```
Paperclip Agent "comms-lead"
  ├── brain: mastermind          ← claude --agent mastermind
  ├── triggers: [assignment, on_demand]
  └── budget: 5M tokens/month

Paperclip Agent "research-analyst"
  ├── brain: research            ← claude --agent research
  ├── triggers: [assignment, timer:6h]
  └── budget: 3M tokens/month

Paperclip Agent "night-researcher"
  ├── brain: research            ← same brain, different schedule
  ├── triggers: [timer:daily:02:00]
  └── budget: 2M tokens/month

Paperclip Agent "system-ops"
  ├── brain: menschling          ← claude --agent menschling
  ├── triggers: [assignment, timer:1h]
  └── budget: 2M tokens/month
```

Brains live in the repo (`.claude/agents/`). Paperclip agents live in the Paperclip database, configured via its CLI or UI. The repo doesn't need a `config/paperclip/` directory — Paperclip manages its own state. The only coupling is the brain name passed via `additional_args: ["--agent", "<brain>"]`.

---

## CLI design — `mensch`

### Domain structure

```
mensch
├── messaging           # Send and receive across channels
│   ├── send            # Send a message
│   ├── reply           # Reply in a thread/conversation
│   └── status          # Check delivery status
│
├── knowledge           # Obsidian vault + vector store
│   ├── search          # Semantic search
│   ├── sync            # Vault → vector store sync
│   ├── inspect         # Show manifest entry for a path
│   └── write           # Write a new knowledge document
│
└── system              # Workspace introspection
    ├── health          # Check service connectivity
    ├── env             # Show loaded config (redacted)
    └── manifest        # Knowledge manifest stats
```

New domains are added by creating `workspace/tools/<domain>/index.ts` exporting `register(program)`. The registry auto-discovers them.

### CLI conventions

1. **Domain-first**: `mensch <domain> <action> [--flags]`
2. **JSON stdout**: All output is valid JSON. Brains parse stdout.
3. **Stderr for humans**: Progress, warnings, debug info go to stderr.
4. **Exit codes**: 0 = success, 1 = error, 2 = bad input.
5. **`--help` at every level**.
6. **Output is always JSON**. `--pretty` flag for human debugging.
7. **`--dry-run` where destructive**.
8. **Named flags only**, no positional args. LLMs generate flags more reliably.

### Example commands

```bash
# Messaging
mensch messaging send --channel slack --conversation "#general" --message "Deployment complete ✅"
mensch messaging send --channel telegram --conversation "12345" --message "Status update"
mensch messaging send --channel email --to "user@example.com" --subject "Re: Project" --body "Hi, ..."
mensch messaging reply --channel slack --conversation "#support" --thread "1710234567.123456" --message "On it"

# Knowledge
mensch knowledge search --query "cloud integration" --filter "category=projects" --top 5
mensch knowledge sync --dry-run
mensch knowledge sync --force --path "01-projects/"
mensch knowledge write --path "04-log/2026-03-17-summary.md" --title "Summary" --category log --body "..."
mensch knowledge inspect --path "01-projects/my-project.md"

# System
mensch system health
mensch system env
mensch system manifest --stats
```

---

## Directory structure

```
menschling/
├── package.json
├── bun.lock
├── tsconfig.json
├── .env                              # Gitignored
├── .env.example
├── .gitignore
├── CLAUDE.md
│
├── .claude/
│   ├── settings.json                 # Permissions, hooks (checked in)
│   ├── settings.local.json           # Local overrides (gitignored)
│   ├── agents/                       # Brains
│   │   ├── mastermind.md
│   │   ├── knowledge.md
│   │   ├── research.md
│   │   ├── project.md
│   │   ├── menschling.md
│   │   └── principal.md
│   └── skills/
│       ├── messaging/
│       │   └── SKILL.md
│       ├── knowledge/
│       │   └── SKILL.md
│       ├── workspace/
│       │   └── SKILL.md
│       └── channel-voice/
│           └── SKILL.md
│
├── lib/
│   ├── types.ts
│   ├── env.ts
│   ├── logger.ts
│   ├── db.ts
│   ├── openai.ts
│   └── errors.ts
│
├── workspace/
│   ├── apps/
│   │   └── gateway/
│   │       ├── index.ts              # Elysia server
│   │       ├── adapters/
│   │       │   ├── telegram.ts
│   │       │   ├── email.ts
│   │       │   ├── rest.ts
│   │       │   └── whatsapp.ts       # Stub
│   │       ├── normalize.ts
│   │       ├── dispatch.ts
│   │       └── auth.ts
│   │
│   ├── tools/
│   │   ├── cli.ts
│   │   ├── shared/
│   │   │   ├── base.ts
│   │   │   ├── registry.ts
│   │   │   └── validators.ts
│   │   ├── messaging/
│   │   │   ├── index.ts
│   │   │   ├── send.ts
│   │   │   ├── reply.ts
│   │   │   ├── status.ts
│   │   │   └── channels/
│   │   │       ├── slack.ts
│   │   │       ├── telegram.ts
│   │   │       ├── resend.ts
│   │   │       └── whatsapp.ts
│   │   ├── knowledge/
│   │   │   ├── index.ts
│   │   │   ├── search.ts
│   │   │   ├── sync.ts
│   │   │   ├── inspect.ts
│   │   │   ├── write.ts
│   │   │   ├── manifest.ts
│   │   │   ├── preprocess.ts
│   │   │   └── summarize.ts
│   │   └── system/
│   │       ├── index.ts
│   │       ├── health.ts
│   │       ├── env.ts
│   │       └── manifest.ts
│   │
│   └── knowledge/
│       ├── vault/                    # Checked into git
│       │   ├── .obsidian/
│       │   ├── 00-inbox/
│       │   ├── 01-projects/
│       │   ├── 02-people/
│       │   ├── 03-resources/
│       │   └── 04-log/
│       ├── schema.sql
│       └── menschling.db             # Checked into git
│
├── system/
│   └── cron/
│       └── sync.ts                   # Knowledge sync cron (15min)
│
└── scripts/
    ├── setup.sh
    ├── dev.sh
    └── seed-knowledge.ts
```

### Git policy

**.gitignore:**
```
.env
.env.local
.claude/settings.local.json
node_modules/
*.log

# Obsidian workspace UI state
workspace/knowledge/vault/.obsidian/workspace.json
workspace/knowledge/vault/.obsidian/workspace-mobile.json

# SQLite transient files
workspace/knowledge/*.db-wal
workspace/knowledge/*.db-shm
```

Everything else is checked in. The vault is the knowledge base. The db is the sync manifest. The repo is the operating state.

---

## Vault structure

```
vault/
├── 00-inbox/           # Unprocessed captures, quick notes, raw dumps
├── 01-projects/        # Active project docs, specs, ADRs
├── 02-people/          # Contact notes, relationship context, org charts
├── 03-resources/       # Reference material, templates, guides
└── 04-log/             # Timestamped: agent outputs, meeting notes, decisions
```

| Directory | Category | Write access |
|-----------|----------|-------------|
| `00-inbox/` | `inbox` | Brains + humans |
| `01-projects/` | `projects` | ProjectBrain + humans |
| `02-people/` | `people` | Humans only |
| `03-resources/` | `resources` | Humans only |
| `04-log/` | `log` | Brains + humans |

Category values are the directory name with the number prefix stripped. Filters use `--filter "category=projects"`.

---

## CLAUDE.md

```markdown
# Menschling

AI agent workspace template.

## Stack

- Runtime: Bun
- Language: TypeScript strict
- Gateway: Elysia
- Database: SQLite via better-sqlite3 (knowledge manifest)
- Knowledge: Obsidian vault → OpenAI Vector Store API
- Orchestration: Paperclip (heartbeat-based)
- Agent runtime: Claude Code CLI with .claude/agents/ brains

## Project structure

- `.claude/agents/` — brains (reusable capability profiles)
- `.claude/skills/` — per-domain reference docs, loaded on demand
- `lib/` — shared code (types, env, db, logger, errors)
- `workspace/apps/gateway/` — Elysia server, webhook adapters, dispatch
- `workspace/tools/` — `mensch` CLI: domain-grouped subcommands
- `workspace/knowledge/` — Obsidian vault + SQLite manifest
- `system/cron/` — scheduled tasks

## Git policy

The repo is the operating state. Vault and menschling.db are checked in.
Only `.env` and `.claude/settings.local.json` are gitignored.

## Brains

Brains are `.claude/agents/*.md` files — reusable capability profiles.
Paperclip agents reference brains by name via `--agent <brain>`.

| Brain | Purpose |
|-------|---------|
| mastermind | Communication hub, human interface, orchestrator |
| knowledge | Knowledge base manager, vault curation |
| research | Deep web research, synthesis |
| project | Project management, specs, ADRs |
| menschling | System architect, framework evolution |
| principal | 10x engineer, full code generation |

## Agent communication model

Brains do NOT call each other directly:
1. Receive task from Paperclip (assigned issue)
2. Do work using `mensch <domain> <action>` commands
3. Return results by releasing the Paperclip issue
4. Delegate by creating new issues for other Paperclip agents

## Vault structure

```
vault/
├── 00-inbox/        # Unprocessed captures
├── 01-projects/     # Active project docs
├── 02-people/       # Contact/relationship notes
├── 03-resources/    # Reference material
└── 04-log/          # Agent outputs, meeting notes, decisions
```

## Conventions

- Named exports only, no default exports
- Env vars validated with Zod in `lib/env.ts`
- Errors: typed classes from `lib/errors.ts`
- Tests colocated: `foo.test.ts`
- Never hardcode secrets

## mensch CLI — complete reference

All output is JSON to stdout. Logging goes to stderr.

### mensch messaging

```
mensch messaging send --channel <slack|telegram|email> --conversation <target> --message <text>
mensch messaging send --channel email --to <addr> --subject <subj> --body <text>
mensch messaging reply --channel slack --conversation <ch> --thread <ts> --message <text>
mensch messaging status --id <message_id>
```

### mensch knowledge

```
mensch knowledge search --query <text> [--filter <key=value>] [--top <n>]
mensch knowledge sync [--dry-run] [--force] [--path <subpath>]
mensch knowledge write --path <path> --title <title> --category <cat> --body <content>
mensch knowledge inspect --path <path>
```

### mensch system

```
mensch system health
mensch system env
mensch system manifest [--stats]
```

## Adding a new CLI domain

1. Create `workspace/tools/<domain>/index.ts` exporting `register(program)`
2. Create `.claude/skills/<domain>/SKILL.md` with frontmatter
3. Add `Bash(mensch <domain> *)` to `.claude/settings.json`
4. Document in this file

## Adding a new brain

1. Create `.claude/agents/<brain>.md` with YAML frontmatter
2. Register a Paperclip agent pointing to it via `--agent <brain>`
3. Document in this file
```

---

## Brain definitions

### .claude/agents/mastermind.md

```markdown
---
name: mastermind
description: Communication hub and human interface. Receives all inbound messages, responds on channels, delegates to specialist agents.
tools: Read, Grep, Glob, Bash, Task, WebSearch
model: sonnet
---

You are the Mastermind — the communication and orchestration brain for
this workspace. All inbound messages flow through you. You are
the human-facing interface.

## Capabilities

### Messaging
```
mensch messaging send --channel <ch> --conversation <target> --message <text>
mensch messaging send --channel email --to <addr> --subject <subj> --body <text>
mensch messaging reply --channel slack --conversation <ch> --thread <ts> --message <text>
```

### Knowledge lookup
```
mensch knowledge search --query <q> [--filter <k=v>]
```

### Logging
```
mensch knowledge write --path "04-log/YYYY-MM-DD-<slug>.md" --title <t> --category log --body <b>
```

## Inbound message format

JSON prompt:
```json
{
  "channel": "telegram",
  "userId": "user_123",
  "conversationId": "conv_456",
  "content": { "type": "text", "text": "What's the project status?" },
  "metadata": { "telegram": { "chatId": 12345 } }
}
```

## Protocol

1. Parse inbound message, determine intent
2. Search knowledge base for relevant context
3. If about a person → `--filter "category=people"`
4. If about a project → `--filter "category=projects"`
5. Compose response following channel-voice skill conventions
6. Send on the SAME channel via `mensch messaging send`
7. If task exceeds your scope → delegate via Task to a specialist brain:
   - Knowledge curation → KnowledgeBrain
   - Deep external research → ResearchBrain
   - Project management → ProjectBrain
   - Code/engineering work → PrincipalEngineerBrain
   - System/framework work → MenschlingBrain
8. Log noteworthy interactions to 04-log/

## Constraints

- Always respond on the originating channel
- Never fabricate — search first, say "Ich schaue nach" if unsure
- Write only to 00-inbox/ and 04-log/
- No git push, no commits, no config changes
```

### .claude/agents/knowledge.md

```markdown
---
name: knowledge
description: Knowledge base manager. Syncs vault, curates content, triages inbox, maintains structure.
tools: Read, Write, Grep, Glob, Bash
model: sonnet
---

You are the KnowledgeBrain — guardian of the knowledge base. You manage
the Obsidian vault, run sync operations, triage the inbox, and maintain
structure and quality.

## Capabilities

```
mensch knowledge search --query <q> [--filter <k=v>] [--top <n>]
mensch knowledge sync [--dry-run] [--force] [--path <subpath>]
mensch knowledge write --path <p> --title <t> --category <c> --body <b>
mensch knowledge inspect --path <p>
mensch system manifest --stats
```

Direct file access: Read/Write in `workspace/knowledge/vault/`

## Responsibilities

### Inbox triage
- Review files in 00-inbox/
- Categorize and move to appropriate directories
- Add YAML frontmatter if missing
- Flag items needing human decision

### Vault maintenance
- Ensure consistent frontmatter across documents
- Identify stale or duplicate content
- Fix broken wikilinks
- Maintain directory structure conventions

### Sync operations
- Run sync cycles, handle errors
- Re-sync failed entries
- Monitor manifest health

## Write access

You have broader write access than other brains:
- 00-inbox/ — triage and organize
- 01-projects/ — maintain project docs (with care)
- 04-log/ — standard agent output

You do NOT write to 02-people/ or 03-resources/ — those are human-curated.

## Constraints

- Never delete files — flag for human review instead
- Never modify 02-people/ or 03-resources/
- Preserve existing frontmatter fields when editing
- When triaging inbox: move, don't delete the original
```

### .claude/agents/research.md

```markdown
---
name: research
description: Deep external research. Web search, public data, synthesis. Writes findings to knowledge base.
tools: Read, Write, Grep, Glob, Bash, WebSearch, WebFetch
model: opus
---

You are the ResearchBrain — the deep research specialist. You search
the web, gather public data, synthesize findings, and produce
structured research outputs.

## Capabilities

```
mensch knowledge search --query <q> [--filter <k=v>] [--top <n>]
mensch knowledge write --path "04-log/YYYY-MM-DD-<slug>.md" --title <t> --category log --body <b>
```

Plus: WebSearch, WebFetch, and direct vault file reads.

## Protocol

1. Check existing knowledge first — don't re-research what's already known
2. Use WebSearch for broad discovery, WebFetch for deep reads
3. Synthesize across multiple sources
4. Write findings to 04-log/ with proper frontmatter
5. Always cite: vault paths for internal, URLs for external
6. Include a "Sources" section at bottom
7. Lead with the conclusion, supporting detail below

## Output conventions

Filename: `04-log/YYYY-MM-DD-<slug>.md`

Frontmatter:
```yaml
---
title: <Research title>
category: log
tags: [<relevant>, <keywords>]
created_by: research-brain
created_at: <ISO timestamp>
---
```

## Constraints

- Write only to 04-log/
- Never present speculation as fact
- Clearly distinguish findings from analysis
- Heavy token user — be thorough but efficient
```

### .claude/agents/project.md

```markdown
---
name: project
description: Project manager. Tracks status, writes specs and ADRs, maintains 01-projects/, generates reports.
tools: Read, Write, Grep, Glob, Bash
model: sonnet
---

You are the ProjectBrain — the project management specialist. You track
project status, write specs and architecture decisions, maintain the
01-projects/ directory, and generate status reports.

## Capabilities

```
mensch knowledge search --query <q> --filter "category=projects"
mensch knowledge write --path <p> --title <t> --category <c> --body <b>
mensch knowledge inspect --path <p>
```

Direct Read/Write access to `workspace/knowledge/vault/01-projects/`
and `workspace/knowledge/vault/04-log/`.

## Responsibilities

- Maintain project documentation in 01-projects/
- Write and update specs, ADRs, status docs
- Generate periodic status reports to 04-log/
- Track deliverables and flag blockers
- Keep project files structured and current

## File conventions

Project specs: `01-projects/<project-slug>.md` or `01-projects/<project-slug>/`
ADRs: `01-projects/<project>/adr-NNN-<slug>.md`
Status reports: `04-log/YYYY-MM-DD-<project>-status.md`

## Constraints

- Never modify 02-people/ or 03-resources/
- Don't invent status — search and verify before reporting
- Flag blockers clearly, don't attempt to resolve cross-team issues
```

### .claude/agents/menschling.md

```markdown
---
name: menschling
description: System architect for the menschling framework. Adds tools, skills, brains. System health, development, architecture.
tools: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch
model: opus
---

You are the MenschlingBrain — the architect and maintainer of this very
system. You evolve the menschling framework: add new CLI tools, write
skills, create brains, maintain system health, and design architecture.

## Capabilities

Full workspace access. You can:
- Read and write anywhere in the repo (except .env)
- Run `mensch system health`, `mensch system manifest`
- Run `mensch knowledge sync` to maintain the pipeline
- Create new files in workspace/tools/, .claude/skills/, .claude/agents/

## Responsibilities

### Adding a new mensch domain
1. Create `workspace/tools/<domain>/index.ts` with `register(program)`
2. Create action files per subcommand
3. Create `.claude/skills/<domain>/SKILL.md`
4. Update `.claude/settings.json` permissions
5. Update CLAUDE.md CLI reference

### Adding a new skill
1. Create `.claude/skills/<name>/SKILL.md`
2. YAML frontmatter: name, description (triggers on-demand loading)
3. Include command reference, examples, common patterns

### Adding a new brain
1. Create `.claude/agents/<brain>.md`
2. YAML frontmatter: name, description, tools, model
3. Document in CLAUDE.md brain roster
4. Paperclip agent registration is done via Paperclip CLI (not in repo)

### System health
- Monitor sync pipeline, fix errors
- Check service connectivity
- Review manifest for stale entries
- Run diagnostics

## Constraints

- Never modify .env or .claude/settings.json without human approval
- Never push to git — propose changes for human review
- Test new tools before documenting them
- Follow existing patterns: handler() wrapper, CommandResult, Zod validation
```

### .claude/agents/principal.md

```markdown
---
name: principal
description: 10x software engineer. Writes exceptional code, full code generation, debugging, architecture, refactoring.
tools: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch
model: opus
---

You are the PrincipalEngineerBrain — a 10x software engineer. You write
exceptional, production-grade code. You architect systems, debug complex
issues, refactor with precision, and ship clean implementations.

## Capabilities

Full development toolset:
- Read, Write, Edit any source file
- Bash: run tests, linters, build tools, git (read-only)
- WebSearch, WebFetch for docs and references
- Grep, Glob for codebase navigation

## Standards

### Code quality
- TypeScript strict, no `any` unless absolutely necessary
- Zod validation on all external boundaries
- Named exports only
- Error handling: typed errors, never swallow exceptions
- Tests: colocated, meaningful assertions, edge cases

### Architecture
- Single responsibility per module
- Dependencies flow inward (lib ← tools, lib ← apps)
- No circular imports
- Prefer composition over inheritance
- Keep abstractions shallow — one layer of indirection max

### Patterns for this codebase
- CLI tools: `handler()` wrapper from `shared/base.ts`
- JSON stdout for tool output, stderr for logging
- Zod schemas in `shared/validators.ts`
- Pino logger via `lib/logger.ts`
- SQLite via `lib/db.ts` (better-sqlite3, WAL mode)

## Constraints

- Never push to git — stage changes for human review
- Never modify .env or secrets
- Run `bun test` after changes
- Run `bun run typecheck` before considering work done
- Write tests for new functionality
```

---

## .claude/settings.json

```json
{
  "permissions": {
    "allow": [
      "Bash(mensch *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(cat *)",
      "Bash(ls *)",
      "Bash(find *)",
      "Bash(bun test *)",
      "Bash(bun run typecheck)",
      "Read",
      "Write(workspace/knowledge/vault/04-log/*)",
      "Write(workspace/knowledge/vault/00-inbox/*)",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push *)",
      "Bash(git commit *)",
      "Read(.env)",
      "Read(.env.*)",
      "Write(.env*)",
      "Write(.claude/settings*)"
    ]
  },
  "env": {
    "MENSCH_ROOT": "."
  }
}
```

Note: PrincipalEngineerBrain and MenschlingBrain need broader Write access than the base settings provide. They override via their brain frontmatter `tools` field (Write, Edit), which Claude Code merges with project settings. For production, consider scoped overrides via `.claude/settings.local.json` per environment.

---

## Skills

### .claude/skills/messaging/SKILL.md

```markdown
---
name: messaging
description: >
  Reference for mensch messaging commands. Load when composing or sending
  messages to Slack, Telegram, email, or WhatsApp. Channel-specific
  formatting, thread handling, delivery patterns.
---

# Messaging domain

## mensch messaging send

```bash
mensch messaging send --channel slack --conversation "#general" --message "Hello"
mensch messaging send --channel slack --conversation "@leo" --message "FYI"
mensch messaging send --channel telegram --conversation "12345" --message "Update"
mensch messaging send --channel email --to "user@example.com" --subject "Sync" --body "Hi, ..."
```

## mensch messaging reply

```bash
mensch messaging reply --channel slack --conversation "#support" --thread "1710234567.123456" --message "On it"
```

## Channel specifics

### Slack
- `--conversation`: `#channel`, `@user`, or channel ID
- Slack mrkdwn: `*bold*`, `_italic_`, `<url|text>`
- Thread via parent message `ts` as `--thread`
- Auto-splits >4000 chars

### Telegram
- `--conversation`: numeric chat ID from inbound metadata
- Markdown V2: `*bold*`, `_italic_`, `` `code` ``
- Auto-splits >4096 chars

### Email (Resend)
- `--to`: single or comma-separated addresses
- `--body`: markdown, auto-converted to HTML
- `--subject`: required
- Reply threading automatic for inbound conversations

### WhatsApp (planned)
- 24-hour conversation window
- Template messages after 24h

## Output format

```json
{ "success": true, "data": { "messageId": "msg_abc", "channel": "slack", "timestamp": "..." } }
{ "success": false, "error": "Channel not configured: whatsapp", "code": "CHANNEL_NOT_CONFIGURED" }
```
```

### .claude/skills/knowledge/SKILL.md

```markdown
---
name: knowledge
description: >
  Reference for mensch knowledge commands. Search, sync, write, inspect.
  Vault conventions, filter syntax, sync pipeline.
---

# Knowledge domain

## Architecture

```
Obsidian vault → SQLite manifest → OpenAI Vector Store
(all checked into git)    (checked in)       (search backend)
```

Cron runs sync every 15 minutes. Hash-based incremental.

## Vault structure

```
00-inbox/     → category: inbox       (brains + humans write)
01-projects/  → category: projects    (ProjectBrain + humans)
02-people/    → category: people      (humans only)
03-resources/ → category: resources   (humans only)
04-log/       → category: log         (brains + humans write)
```

## mensch knowledge search

```bash
mensch knowledge search --query "cloud integration"
mensch knowledge search --query "onboarding" --filter "category=projects"
mensch knowledge search --query "Q1 OKRs" --top 3
mensch knowledge search --query "notes" --filter "source=human"
```

Filters: `category` (inbox/projects/people/resources/log), `source` (human/research-brain/...), `path`.

## mensch knowledge sync

```bash
mensch knowledge sync                        # Incremental
mensch knowledge sync --dry-run              # Preview
mensch knowledge sync --force                # Full re-upload
mensch knowledge sync --path "01-projects/"  # Scoped
```

## mensch knowledge write

```bash
mensch knowledge write \
  --path "04-log/2026-03-17-summary.md" \
  --title "Summary" --category log \
  --tags "integration,api" --body "## Summary\n\n..."
```

Auto-generates YAML frontmatter. Convention: `04-log/YYYY-MM-DD-<slug>.md`.

## mensch knowledge inspect

```bash
mensch knowledge inspect --path "01-projects/my-project.md"
```

Returns: hash, file IDs, sync status, summary, outline, word count.

## Search tips

- Start broad, narrow with filters
- `--top 3` for focused, `--top 10` for research
- Combine search with direct file reads
- `--filter "source=research-brain"` for prior agent work
```

### .claude/skills/workspace/SKILL.md

```markdown
---
name: workspace
description: >
  Menschling workspace navigation. Project structure, conventions,
  how to add tools, skills, and brains.
---

# Workspace navigation

## Key paths

| Path | Purpose |
|------|---------|
| `.claude/agents/` | Brains (capability profiles) |
| `.claude/skills/` | Per-domain reference docs |
| `lib/` | Shared: types, env, db, logger, errors |
| `workspace/apps/gateway/` | Elysia server, adapters, dispatch |
| `workspace/tools/` | `mensch` CLI domains |
| `workspace/knowledge/vault/` | Obsidian vault (checked in) |
| `workspace/knowledge/menschling.db` | SQLite manifest (checked in) |
| `system/cron/` | Scheduled tasks |

## Git policy

Everything checked in except: `.env`, `.claude/settings.local.json`,
Obsidian workspace UI files, SQLite WAL/SHM transients.

## How brains execute

1. Paperclip triggers heartbeat for an agent
2. Agent has a brain assignment: `claude --agent <brain> --yes -p <context>`
3. Claude Code loads `.claude/agents/<brain>.md`
4. Brain calls `Bash(mensch <domain> <action> ...)`
5. Brain exits, Paperclip records result

## Adding a new domain

1. `workspace/tools/<domain>/index.ts` → `register(program)`
2. `.claude/skills/<domain>/SKILL.md` with frontmatter
3. `Bash(mensch <domain> *)` in settings.json
4. Document in CLAUDE.md

## Coding conventions

- Named exports, Zod validation, typed errors
- Pino logger → stderr, JSON → stdout
- Tests colocated: `<file>.test.ts`
```

### .claude/skills/channel-voice/SKILL.md

```markdown
---
name: channel-voice
description: >
  Tone, formatting, and language per channel. Load when composing messages.
---

# Channel voice

All communication in **German** unless recipient uses English.
Adapt tone to domain and audience — practical, direct language.

## Slack (internal)
- German, casual. Direct, brief, emoji OK.
- No greeting/sign-off. Use threads. `*bold*` for key points.
- Emoji reactions > "OK" messages.

## Telegram (customer-facing)
- German, conversational formal (Sie-Form unless du established).
- "Hallo [Name]" greeting. "Viele Grüße" sign-off.
- Short paragraphs, <300 words. No bullet lists.

## Email (customer + partner)
- German, professional. Warm but structured.
- "Hallo Herr/Frau [Nachname]" or "Hallo [Vorname]" if established.
- "Mit freundlichen Grüßen" (formal) / "Viele Grüße" (established).
- Include context. Lead with conclusion for technical topics.

## REST API
- English. Structured JSON. No voice concerns.

## WhatsApp (planned)
- Same as Telegram. 24h window constraint. Templates after 24h.
```

---

## Gateway (Elysia)

### workspace/apps/gateway/index.ts

```typescript
import { Elysia } from "elysia";
import { telegramWebhook } from "./adapters/telegram";
import { emailWebhook } from "./adapters/email";
import { restEndpoint } from "./adapters/rest";
import { env } from "../../lib/env";
import { logger } from "../../lib/logger";

const app = new Elysia()
  .onRequest(({ request }) => {
    logger.debug({ method: request.method, url: request.url }, "Request");
  })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .post("/webhook/telegram", telegramWebhook)
  .post("/webhook/email", emailWebhook)
  .post("/api/message", restEndpoint)
  .listen(env.GATEWAY_PORT);

logger.info({ port: env.GATEWAY_PORT }, "Gateway running");

export type App = typeof app;
```

### workspace/apps/gateway/adapters/telegram.ts

```typescript
import type { Context } from "elysia";
import { createMessage } from "../normalize";
import { dispatch } from "../dispatch";

export async function telegramWebhook({ body }: { body: any }) {
  const msg = body?.message;
  if (!msg?.text) return { ok: true };

  const message = createMessage("telegram", String(msg.from.id), msg.text, {
    telegram: {
      chatId: msg.chat.id,
      messageId: msg.message_id,
      chatType: msg.chat.type,
      firstName: msg.from.first_name,
      username: msg.from.username,
    },
  });

  await dispatch(message);
  return { ok: true };
}
```

### workspace/apps/gateway/dispatch.ts

```typescript
import type { UnifiedMessage } from "../../lib/types";
import { logger } from "../../lib/logger";
import { env } from "../../lib/env";

export async function dispatch(message: UnifiedMessage): Promise<{ taskId: string }> {
  const taskId = `msg_${Date.now()}_${message.channel}`;

  if (env.PAPERCLIP_ENABLED) {
    await fetch(`${env.PAPERCLIP_URL}/api/companies/${env.PAPERCLIP_COMPANY_ID}/issues`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PAPERCLIP_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `[${message.channel}] ${message.content.text?.slice(0, 80) ?? "inbound"}`,
        body: JSON.stringify(message),
        assigneeAgentId: "comms-lead",
      }),
    });
    logger.info({ taskId, channel: message.channel }, "Dispatched via Paperclip");
    return { taskId };
  }

  // Direct mode
  const proc = Bun.spawn(
    ["claude", "--agent", "mastermind", "--yes", "-p", JSON.stringify(message)],
    { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
  );
  proc.exited.then((code) => logger.info({ taskId, exitCode: code }, "Direct agent completed"));
  return { taskId };
}
```

### workspace/apps/gateway/normalize.ts

```typescript
import type { UnifiedMessage } from "../../lib/types";
import { randomUUID } from "crypto";

export function createMessage(
  channel: UnifiedMessage["channel"],
  userId: string,
  text: string,
  metadata: Record<string, unknown> = {},
): UnifiedMessage {
  return {
    id: randomUUID(),
    channel,
    direction: "inbound",
    userId,
    conversationId: `${channel}_${userId}`,
    timestamp: new Date(),
    content: { type: "text", text },
    metadata: { channel, ...metadata },
    auth: { userId, channelUserId: userId, authenticated: true },
  };
}
```

---

## CLI implementation

### workspace/tools/cli.ts

```typescript
#!/usr/bin/env bun
import { Command } from "commander";
import { discoverDomains } from "./shared/registry";

const program = new Command()
  .name("mensch")
  .description("Menschling agent toolbox")
  .version("0.1.0")
  .configureHelp({ sortSubcommands: true, showGlobalOptions: true });

discoverDomains(program);
program.parse();
```

### workspace/tools/shared/base.ts

```typescript
import { logger } from "../../../lib/logger";

export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export function output<T>(result: CommandResult<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.success ? 0 : 1);
}

export function handler<TFlags>(
  fn: (flags: TFlags) => Promise<CommandResult>
): (flags: TFlags) => Promise<void> {
  return async (flags: TFlags) => {
    try {
      output(await fn(flags));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof MenschError ? err.code : "UNKNOWN_ERROR";
      logger.error({ err, code }, "Command failed");
      output({ success: false, error: message, code });
    }
  };
}

export class MenschError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MenschError";
  }
}

export class ChannelNotConfiguredError extends MenschError {
  constructor(channel: string) {
    super(`Channel not configured: ${channel}`, "CHANNEL_NOT_CONFIGURED");
  }
}

export class NotFoundError extends MenschError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND");
  }
}
```

### workspace/tools/shared/registry.ts

```typescript
import { Command } from "commander";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const TOOLS_DIR = join(import.meta.dir, "..");

export function discoverDomains(program: Command): void {
  const skip = new Set(["shared", "cli.ts"]);
  for (const entry of readdirSync(TOOLS_DIR)) {
    if (skip.has(entry)) continue;
    const dir = join(TOOLS_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;
    const indexPath = join(dir, "index.ts");
    if (!existsSync(indexPath)) continue;
    try {
      const mod = require(indexPath);
      if (typeof mod.register === "function") mod.register(program);
    } catch (err) {
      console.error(`[mensch] Failed to load domain "${entry}":`, err);
    }
  }
}
```

### workspace/tools/shared/validators.ts

```typescript
import { z } from "zod";

export const channelSchema = z.enum(["slack", "telegram", "email", "whatsapp"]);
export const vaultCategorySchema = z.enum(["inbox", "projects", "people", "resources", "log"]);
```

---

## Knowledge system

### workspace/knowledge/schema.sql

```sql
CREATE TABLE IF NOT EXISTS entries (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  path                 TEXT    NOT NULL UNIQUE,
  content_hash         TEXT    NOT NULL,
  openai_file_id       TEXT,
  vector_store_file_id TEXT,
  summary              TEXT,
  outline              TEXT,
  title                TEXT,
  category             TEXT,
  tags                 TEXT,
  created_by           TEXT    DEFAULT 'human',
  word_count           INTEGER,
  created_at           TEXT    DEFAULT (datetime('now')),
  updated_at           TEXT    DEFAULT (datetime('now')),
  last_synced          TEXT,
  sync_error           TEXT,
  status               TEXT    DEFAULT 'pending'
                                CHECK (status IN ('pending','synced','error','deleted'))
);

CREATE INDEX IF NOT EXISTS idx_entries_status   ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_hash     ON entries(content_hash);
```

### workspace/tools/knowledge/manifest.ts

```typescript
const DIR_TO_CATEGORY: Record<string, string> = {
  "00-inbox": "inbox",
  "01-projects": "projects",
  "02-people": "people",
  "03-resources": "resources",
  "04-log": "log",
};

export function dirToCategory(relPath: string): string {
  return DIR_TO_CATEGORY[relPath.split("/")[0] ?? ""] ?? "inbox";
}
```

---

## Shared library

### lib/env.ts

```typescript
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GATEWAY_PORT: z.coerce.number().default(3200),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string(),
  OPENAI_VECTOR_STORE_ID: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  PAPERCLIP_ENABLED: z.coerce.boolean().default(false),
  PAPERCLIP_URL: z.string().default("http://localhost:3100"),
  PAPERCLIP_API_KEY: z.string().optional(),
  PAPERCLIP_COMPANY_ID: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
});

export const env = schema.parse(process.env);
```

### lib/types.ts

```typescript
export interface UnifiedMessage {
  id: string;
  channel: "cli" | "rest" | "telegram" | "email" | "whatsapp";
  direction: "inbound" | "outbound";
  userId: string;
  conversationId: string;
  timestamp: Date;
  content: {
    type: "text" | "image" | "audio" | "document";
    text?: string;
    html?: string;
    attachments?: Attachment[];
  };
  metadata: Record<string, unknown>;
  auth: { userId: string; channelUserId: string; authenticated: boolean };
}

export interface Attachment {
  type: string;
  url?: string;
  mimeType: string;
  filename?: string;
  size?: number;
}
```

### lib/db.ts

```typescript
import Database from "better-sqlite3";
import { join } from "path";
import { readFileSync } from "fs";

const DB_PATH = join(import.meta.dir, "../workspace/knowledge/menschling.db");
const SCHEMA_PATH = join(import.meta.dir, "../workspace/knowledge/schema.sql");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(readFileSync(SCHEMA_PATH, "utf-8"));
```

### lib/logger.ts

```typescript
import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport: env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { destination: 2 } }
    : undefined,
}, pino.destination(2));
```

### lib/errors.ts

```typescript
export class MenschError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MenschError";
  }
}

export class ChannelNotConfigured extends MenschError {
  constructor(ch: string) { super(`Channel not configured: ${ch}`, "CHANNEL_NOT_CONFIGURED"); }
}

export class NotFound extends MenschError {
  constructor(r: string, id: string) { super(`${r} not found: ${id}`, "NOT_FOUND"); }
}

export class ExternalApiError extends MenschError {
  constructor(svc: string, status: number, detail?: string) {
    super(`${svc} API error (${status}): ${detail ?? "unknown"}`, "EXTERNAL_API_ERROR");
  }
}
```

---

## package.json

Always use `bun add ...` and NEVER write versions manually in package.json.

```json
{
  "name": "menschling",
  "private": true,
  "type": "module",
  "bin": { "mensch": "./workspace/tools/cli.ts" },
  "scripts": {
    "dev": "bun run workspace/apps/gateway/index.ts",
    "mensch": "bun run workspace/tools/cli.ts",
    "sync": "bun run workspace/tools/cli.ts knowledge sync",
    "sync:cron": "bun run system/cron/sync.ts",
    "setup": "bash scripts/setup.sh",
    "seed": "bun run scripts/seed-knowledge.ts",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@anthropic-ai/sdk": ...,
    "better-sqlite3": ...,
    "commander": ...,
    "elysia": ...,
    "gray-matter": ...,
    "openai": ...,
    "pino": ...,
    "pino-pretty": ...,
    "resend": ...,
    "zod": ...,
  },
  "devDependencies": ...,
    "@types/better-sqlite3": ...,
    "@types/bun": ...,
    "typescript": ...,
  }
}
```

---

## Implementation order

1. **Skeleton**: lib/ (env, db, logger, errors), schema.sql, empty vault dirs, .gitignore
2. **CLI framework**: cli.ts, shared/ (base, registry, validators), system/health
3. **Knowledge pipeline**: sync, preprocess, summarize, manifest, search, write, inspect
4. **First brain**: mastermind.md + messaging/send (Slack)
5. **Gateway**: Elysia server, Telegram adapter, dispatch (direct mode)
6. **Skills**: All skill files, verify brains load them
7. **Paperclip**: Setup paperclip in dockercompose, define org template and seed scripts, register agents in Paperclip DB, switch dispatch
8. **More brains**: knowledge, research, project, menschling, principal
9. **Remaining channels**: email adapter, WhatsApp stub