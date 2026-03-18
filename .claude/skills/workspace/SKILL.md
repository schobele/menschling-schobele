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
| `.claude/settings.json` | Permissions, plugins, env config |
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

1. `workspace/tools/<domain>/index.ts` — export `register(program)`
2. `.claude/skills/<domain>/SKILL.md` with frontmatter
3. Document in CLAUDE.md

Auto-discovery in `workspace/tools/shared/registry.ts` picks up new domains. The existing `Bash(mensch *)` wildcard in settings.json covers all domains — no per-domain permission entry needed.

## Coding conventions

- Named exports, Zod validation, typed errors
- Pino logger -> stderr, JSON -> stdout
- Tests colocated: `<file>.test.ts`

## Permissions model (settings.json)

`.claude/settings.json` controls what tools brains can use at runtime.

```
permissions.allow    — list of allowed tool patterns
permissions.deny     — list of denied tool patterns (overrides allow)
```

Key patterns in this workspace:

| Pattern | What it permits |
|---------|-----------------|
| `Bash(mensch *)` | All mensch CLI commands, all domains |
| `Read` | Read any file |
| `Write(workspace/knowledge/vault/04-log/*)` | Write only to log vault |
| `Write(workspace/knowledge/vault/00-inbox/*)` | Write only to inbox vault |

Brain frontmatter has a `tools` field listing Claude Code tools (Read, Write, Edit, Bash, etc.). This controls what tools Paperclip grants the agent at the Claude Code level. Settings.json then further restricts what those tools can do.

## How skills are loaded

Skills live at `.claude/skills/<name>/SKILL.md`. Each has YAML frontmatter:

```yaml
name: messaging
description: >
  Reference for mensch messaging commands...
```

Claude reads the `name` and `description` from frontmatter. When a brain's task matches a skill's description, Claude loads that skill on demand. Skills are never loaded eagerly — only when the task context triggers them. This means the `description` field is critical: it must contain the keywords that match real tasks.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `mensch: command not found` | CLI not linked globally | Run `bun link` from the project root |
| `Domain "<name>" not found` | `index.ts` missing or doesn't export `register()` | Verify `workspace/tools/<domain>/index.ts` exports `register(program: Command)` |
| Env validation fails on startup | Required env var missing | Check `.env` has all keys from `.env.example`. Run `mensch system env` to see what's set. |
| `Cannot find module` on import | Bun cache stale or dependency missing | Run `bun install`, then retry |
| Brain can't call mensch commands | `Bash` not in brain's `tools` frontmatter | Add `Bash` to the brain's tools list in `.claude/agents/<brain>.md` |
| Write permission denied | `settings.json` deny list or missing allow pattern | Check `.claude/settings.json` permissions — Write is restricted to specific vault paths by default |
