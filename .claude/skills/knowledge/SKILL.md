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

## Sync pipeline

```
vault/*.md
    │
    ▼
┌────────────────┐
│  preprocess     │  extract frontmatter, compute SHA256 hash
└───────┬────────┘
        │
        ▼
┌────────────────┐     hash unchanged?
│ manifest check  │────────────────────► skip (no work)
└───────┬────────┘
        │ hash changed or new file
        ▼
┌────────────────┐     failure?
│ OpenAI Files    │────────────────────► status=error in manifest
│ API upload      │                      (retry next cycle)
└───────┬────────┘
        │ success
        ▼
┌────────────────┐
│ Vector Store    │  attach uploaded file to vector store
│ attach          │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ manifest upsert │  status=synced, update hash + file IDs
└────────────────┘
```

### Failure points

| Stage | Failure | Manifest status | Recovery |
|-------|---------|-----------------|----------|
| Preprocess | Malformed frontmatter | Not updated | Fix the YAML frontmatter in the vault file |
| Upload | OpenAI API 5xx or timeout | `status=error` | Automatic retry on next sync cycle |
| Upload | OpenAI API 401 | `status=error` | Check `OPENAI_API_KEY` in `.env` |
| Attach | Vector store not found | `status=error` | Check `OPENAI_VECTOR_STORE_ID` in `.env` |
| Attach | File ID invalid | `status=error` | Run `mensch knowledge sync --force` to re-upload |

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

### Filter syntax

Only `key=value` equality is supported. No operators, no wildcards, no chaining multiple filters.

| Filter key | Values | Example |
|------------|--------|---------|
| `category` | `inbox`, `projects`, `people`, `resources`, `log` | `--filter "category=projects"` |
| `source` | `human`, `research-brain`, `knowledge-brain`, etc. | `--filter "source=research-brain"` |
| `path` | Relative path prefix | `--filter "path=01-projects/"` |

### When to use search vs direct file reads

| Situation | Use |
|-----------|-----|
| Semantic query ("what do we know about X?") | `mensch knowledge search --query "X"` |
| Known file path | `Read` tool directly on `workspace/knowledge/vault/<path>` |
| Browsing a category | `Glob` on `workspace/knowledge/vault/01-projects/**/*.md` |
| Finding prior agent work | `mensch knowledge search --filter "source=research-brain"` |

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
- Combine search with direct file reads for known paths
- `--filter "source=research-brain"` for prior agent work
