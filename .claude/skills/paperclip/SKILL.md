---
name: paperclip
description: >
  Paperclip API reference for managing the autonomous agent company. Use when
  creating agents, managing companies, dispatching issues, checking heartbeats,
  or interacting with the Paperclip orchestration layer. Also use when the user
  mentions "paperclip", "agents", "heartbeat", "company", or "org chart".
---

# Paperclip API

Paperclip is the orchestration layer that turns brains into an autonomous company. The user is the board. The Mastermind agent is the CEO. Each brain is a department head.

**Base URL:** `http://localhost:3100` (or `PAPERCLIP_URL` from `.env`)

**Auth:** All mutating requests require either:
- Session cookies (from sign-in) — for human/setup operations
- Bearer token (from agent API key) — for agent-to-Paperclip operations like issue creation

**CSRF:** All mutating requests require `Origin: http://localhost:3100` header.

## Authentication

### Sign in (get session cookies)

```bash
curl -s -X POST "$PAPERCLIP_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -H "Origin: $PAPERCLIP_URL" \
  -c /tmp/paperclip-cookies.txt \
  -d '{"email":"<email>","password":"<password>"}'
```

Returns user object with session. Cookies saved for subsequent requests.

### Agent auth (Bearer token)

Agents authenticate via API key:
```
Authorization: Bearer <PAPERCLIP_API_KEY>
```

Used by `dispatch.ts` and the `mensch` CLI when creating issues programmatically.

## Companies

### Create company

```bash
curl -s -X POST "$PAPERCLIP_URL/api/companies" \
  -H "Content-Type: application/json" \
  -H "Origin: $PAPERCLIP_URL" \
  -b /tmp/paperclip-cookies.txt \
  -d '{"name":"<name>","description":"<description>"}'
```

Returns: `{ "id": "<company-id>", "name": "...", ... }`

### List companies

```bash
curl -s "$PAPERCLIP_URL/api/companies" \
  -b /tmp/paperclip-cookies.txt
```

## Agents

### Create agent

```bash
curl -s -X POST "$PAPERCLIP_URL/api/companies/<COMPANY_ID>/agents" \
  -H "Content-Type: application/json" \
  -H "Origin: $PAPERCLIP_URL" \
  -b /tmp/paperclip-cookies.txt \
  -d '{
    "name": "<name>",
    "role": "<role>",
    "title": "<title>",
    "capabilities": "<description>",
    "adapterType": "claude_local",
    "adapterConfig": {
      "cwd": "/workspace",
      "extraArgs": ["--agent", "<brain-name>"],
      "model": "<model-id>"
    }
  }'
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name (e.g. "Mastermind") |
| `role` | string | Org role slug (e.g. "ceo", "engineer", "analyst") |
| `title` | string | Human-readable title |
| `capabilities` | string | What this agent does |
| `adapterType` | string | Always `"claude_local"` for Menschling |
| `adapterConfig.cwd` | string | Working directory — must be `/workspace` (the read-only mount point) |
| `adapterConfig.extraArgs` | string[] | CLI args appended to `claude` command — use `["--agent", "<brain>"]` |
| `adapterConfig.model` | string | Model ID: `claude-sonnet-4-6` or `claude-opus-4-6` |

Returns: `{ "id": "<agent-id>", "urlKey": "<slug>", ... }`

The `urlKey` is auto-generated from the name (lowercase, hyphenated). This is what `dispatch.ts` uses as `assigneeAgentId`.

### Update agent config

```bash
curl -s -X PATCH "$PAPERCLIP_URL/api/agents/<AGENT_ID>" \
  -H "Content-Type: application/json" \
  -H "Origin: $PAPERCLIP_URL" \
  -b /tmp/paperclip-cookies.txt \
  -d '{
    "adapterConfig": {
      "cwd": "/workspace",
      "extraArgs": ["--agent", "<brain>"],
      "model": "<model>"
    }
  }'
```

### List agents

```bash
curl -s "$PAPERCLIP_URL/api/companies/<COMPANY_ID>/agents" \
  -b /tmp/paperclip-cookies.txt
```

### Create agent API key

```bash
curl -s -X POST "$PAPERCLIP_URL/api/agents/<AGENT_ID>/keys" \
  -H "Content-Type: application/json" \
  -H "Origin: $PAPERCLIP_URL" \
  -b /tmp/paperclip-cookies.txt \
  -d '{}'
```

Returns: `{ "token": "pcp_...", ... }` — save this, it's only shown once.

## Issues (Task Dispatch)

Issues are how work gets assigned to agents. The gateway creates issues when messages arrive. Brains create issues to delegate work to other brains.

### Create issue

```bash
curl -s -X POST "$PAPERCLIP_URL/api/companies/<COMPANY_ID>/issues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Origin: $PAPERCLIP_URL" \
  -d '{
    "title": "[telegram] What is the project status?",
    "body": "<JSON-serialized UnifiedMessage or task description>",
    "assigneeAgentId": "mastermind"
  }'
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Short description (shown in Paperclip UI) |
| `body` | string | Full context — for inbound messages this is the serialized `UnifiedMessage` |
| `assigneeAgentId` | string | The agent's `urlKey` (e.g. "mastermind", "research", "principal") |

The assigned agent receives the issue body as its prompt context via `claude --agent <brain> -p <body>`.

### List issues

```bash
curl -s "$PAPERCLIP_URL/api/companies/<COMPANY_ID>/issues" \
  -b /tmp/paperclip-cookies.txt
```

## Heartbeat

Paperclip runs heartbeats on a schedule (default: every 30s) to check if agents have pending work. You can also trigger one manually.

### Invoke heartbeat

```bash
curl -s -X POST "$PAPERCLIP_URL/api/agents/<AGENT_ID>/heartbeat/invoke" \
  -H "Origin: $PAPERCLIP_URL" \
  -b /tmp/paperclip-cookies.txt
```

Returns heartbeat run ID. Check the Paperclip UI or API for run events.

### Check heartbeat status

```bash
curl -s "$PAPERCLIP_URL/api/agents/<AGENT_ID>/heartbeat/runs" \
  -b /tmp/paperclip-cookies.txt
```

**What to verify in heartbeat events:**
- `cwd` is `/workspace`
- `commandArgs` includes `--agent <brain-name>`
- `model` matches expected model
- Status is `succeeded`

## Default Agent Roster

The onboarding skill creates these agents, matching the brain roster:

```
| Agent      | Role      | Brain      | Model             | urlKey     |
|------------|-----------|------------|-------------------|------------|
| Mastermind | ceo       | mastermind | claude-sonnet-4-6 | mastermind |
| Knowledge  | librarian | knowledge  | claude-sonnet-4-6 | knowledge  |
| Research   | analyst   | research   | claude-opus-4-6   | research   |
| Project    | pm        | project    | claude-sonnet-4-6 | project    |
| Principal  | engineer  | principal  | claude-opus-4-6   | principal  |
| Menschling | architect | menschling | claude-opus-4-6   | menschling |
```

## How Dispatch Works

```
Inbound message → gateway normalize() → UnifiedMessage
  → dispatch() checks PAPERCLIP_ENABLED
    → true:  POST /api/companies/{id}/issues with assigneeAgentId="mastermind"
    → false: Bun.spawn(["claude", "--agent", "mastermind", ...])

Paperclip receives issue → assigns to Mastermind agent
  → heartbeat triggers → claude --agent mastermind -p <issue body>
  → Mastermind works the task, may create new issues for other agents
  → Issue resolved → Paperclip records result
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| 403 on POST requests | Missing `Origin` header | Add `-H "Origin: http://localhost:3100"` |
| "No config found" | Paperclip not bootstrapped | Run `./scripts/paperclip-bootstrap.sh` |
| Heartbeat shows wrong cwd | Volume not mounted | Check `docker-compose.yml` has `.:/workspace:ro` on paperclip service |
| Agent can't find brain | `extraArgs` misconfigured | PATCH agent with correct `["--agent", "<brain>"]` |
| Issue not assigned | Wrong `assigneeAgentId` | Must match agent's `urlKey`, not `id` |
| "BETTER_AUTH_SECRET required" | Missing env var | Run `bash scripts/setup.sh` to auto-generate |
