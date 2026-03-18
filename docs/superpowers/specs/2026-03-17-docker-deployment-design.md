# Menschling Docker Deployment — Design Spec

**Goal:** Deploy a self-updating Menschling agent workspace to Hetzner via Docker, where agents autonomously commit/push changes to GitHub, and the deployment hot-reloads without rebuilding.

**Architecture:** Three containers (menschling, paperclip, postgres) orchestrated via docker-compose. Git is the persistence layer — everything is committed. A hot-reload strategy avoids full rebuilds for most changes. Graceful shutdown ensures no work is lost.

**Deployment targets:** Raw docker-compose on any VPS (primary), Coolify-compatible (secondary).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Hetzner VPS                                             │
│                                                          │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │  menschling   │  │  paperclip  │  │   postgres     │  │
│  │              │  │             │  │                │  │
│  │  - Gateway   │←→│  - API      │←→│  - Paperclip   │  │
│  │  - Claude CLI│  │  - UI       │  │    DB          │  │
│  │  - mensch CLI│  │  - Scheduler│  │                │  │
│  │  - cron      │  │             │  │                │  │
│  │  - process   │  │  Port 3100  │  │  Port 5432     │  │
│  │    manager   │  │             │  │                │  │
│  │  Port 3200   │  └─────────────┘  └────────────────┘  │
│  └──────────────┘                                        │
│                                                          │
│  Named volume: pgdata (Paperclip DB)                     │
│  Bind mount: /opt/menschling/.env (secrets)              │
└──────────────────────────────────────────────────────────┘
         │                    ▲
         │ push               │ webhook / GH Actions SSH
         ▼                    │
    ┌──────────┐         ┌──────────┐
    │  GitHub   │────────→│ Actions  │
    │   Repo    │         │ Workflow │
    └──────────┘         └──────────┘
```

## Containers

### 1. `menschling`

The workspace. This is where agents execute.

- **Base image:** `oven/bun:latest` (Debian-based for Claude CLI compatibility)
- **Installed:** Bun, Node.js (for Claude CLI), Claude Code CLI (`npm i -g @anthropic-ai/claude-code`), git, ssh
- **Working dir:** `/app` — the repo is cloned here at build time, `git pull` updates it at runtime
- **Process manager:** Simple bash wrapper that runs the gateway and restarts it on signal
- **Cron:** Auto-commit every 15 minutes, knowledge sync every 15 minutes
- **Git config:** Deploy key mounted as secret, configured for push access
- **Entrypoint:** `scripts/entrypoint.sh` — sets up git, starts cron, traps SIGTERM, launches gateway

### 2. `paperclip`

Orchestration engine. Schedules agent heartbeats, manages org chart, assigns tasks.

- **Image:** Built from `paperclipai/paperclip` repo
- **Database:** Connects to the postgres container
- **Agent execution:** Paperclip triggers `claude --agent <brain> --yes -p <context>` which runs inside the menschling container (via `docker compose exec` or Paperclip's own agent runner pointing at the menschling workspace)
- **Port:** 3100 (API + UI)

### 3. `postgres`

Paperclip's database only. Menschling uses SQLite (checked into git).

- **Image:** `postgres:17-alpine`
- **Volume:** `pgdata` named volume for persistence
- **Port:** 5432 (internal only, not exposed)

## Hot-Reload Strategy

No compile step — Bun runs TypeScript directly. Most changes are picked up on next process invocation without any restart.

| What changed | Action | Restart needed? |
|---|---|---|
| Vault files only | `git pull` | No |
| CLI tools, lib/, brains, skills | `git pull && bun install` | No — next `mensch` or `claude --agent` call picks up changes |
| package.json dependencies | `git pull && bun install` | No — `bun install` updates node_modules in place |
| Gateway code (`workspace/apps/gateway/`) | `git pull && bun install` + restart gateway process | Gateway only (not full container) |
| Dockerfile, entrypoint, compose | `docker compose up -d --build` | Full rebuild |

### Why this works

- Each `mensch <domain> <action>` call is a fresh Bun process — it always reads the latest code
- Each `claude --agent <brain>` call is a fresh Claude CLI process — it always reads the latest brain `.md`
- The CLI registry auto-discovers domains on each invocation
- Only the gateway is a long-running process that needs restarting when its own code changes

### Gateway process manager

The entrypoint runs the gateway via a simple wrapper:

```bash
# Gateway wrapper — restarts on SIGUSR1
while true; do
  bun run workspace/apps/gateway/index.ts &
  GATEWAY_PID=$!
  wait $GATEWAY_PID
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then break; fi  # Clean exit = shutdown
  echo "Gateway restarting..."
done
```

The deploy webhook sends SIGUSR1 to restart the gateway when gateway code changes. All other changes need no restart.

## Git-as-State Lifecycle

```
Fork template → docker compose up → Agents work → Auto-commit (15min cron)
     ↑                                                    │
     │              ┌─────────────────────────────────────┘
     │              ▼
     └──── git push ────→ GH Actions ────→ SSH hot-reload
```

### Auto-commit cron (every 15 minutes)

```bash
#!/usr/bin/env bash
cd /app
git add -A
if ! git diff --cached --quiet; then
  git commit -m "auto: workspace sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git push origin main
fi
```

Captures everything: vault changes, code changes, SQLite manifest, new brains/skills/tools.

### SIGTERM graceful shutdown

Container entrypoint traps SIGTERM:

1. Send SIGTERM to gateway process (stops accepting requests)
2. Wait for any running `claude` agent processes to finish (up to 90s)
3. Run `scripts/shutdown.sh` — commits all uncommitted changes, pushes to GitHub
4. Exit cleanly

`stop_grace_period: 120s` in docker-compose gives enough time.

```bash
#!/usr/bin/env bash
# scripts/shutdown.sh
cd /app
echo "Shutdown: committing workspace state..."
git add -A
if ! git diff --cached --quiet; then
  git commit -m "auto: shutdown sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git push origin main
  echo "Shutdown: pushed to GitHub"
else
  echo "Shutdown: nothing to commit"
fi
```

## Deploy Flow

### Deploy webhook (`/webhook/deploy`)

New gateway endpoint. Called by GitHub webhook on push events.

```
POST /webhook/deploy
Header: X-Deploy-Secret: <shared secret>
Body: GitHub push event payload
```

Logic:
1. Verify `X-Deploy-Secret` header
2. `git pull --rebase origin main`
3. `bun install` (in case deps changed)
4. Check if `workspace/apps/gateway/` changed in the pulled commits
5. If yes: restart gateway process (SIGUSR1 to wrapper)
6. Return `{ ok: true, reloaded: ["gateway"] | [] }`

### GitHub Actions workflow

Triggered on every push to `main`:

```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Detect change scope
        id: scope
        run: |
          CHANGED=$(git diff --name-only HEAD~1 HEAD)
          if echo "$CHANGED" | grep -qE '^(Dockerfile|docker-compose|scripts/entrypoint)'; then
            echo "level=rebuild" >> $GITHUB_OUTPUT
          elif echo "$CHANGED" | grep -qE '^workspace/apps/gateway/'; then
            echo "level=restart-gateway" >> $GITHUB_OUTPUT
          else
            echo "level=pull" >> $GITHUB_OUTPUT
          fi

      - name: Hot-reload (pull + install)
        if: steps.scope.outputs.level == 'pull' || steps.scope.outputs.level == 'restart-gateway'
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "
            cd /opt/menschling
            docker compose exec -T menschling bash -c 'cd /app && git pull --rebase origin main && bun install'
          "

      - name: Restart gateway
        if: steps.scope.outputs.level == 'restart-gateway'
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "
            cd /opt/menschling
            docker compose exec -T menschling kill -SIGUSR1 1
          "

      - name: Full rebuild
        if: steps.scope.outputs.level == 'rebuild'
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "
            cd /opt/menschling
            git pull
            docker compose up -d --build menschling
          "
```

### Deploy loop prevention

Agents push → GH Actions triggers → SSH pulls into container. But the auto-commit cron also pushes. To prevent loops:

- Auto-commit messages start with `auto:` prefix
- GH Actions workflow skips runs where the commit message starts with `auto:`
- The deploy webhook also checks for this prefix and skips if present

## Persistence Strategy

| Data | Persisted via | Survives rebuild? |
|------|--------------|-------------------|
| Vault (knowledge) | Git (committed + pushed) | Yes |
| SQLite manifest (`menschling.db`) | Git (committed + pushed) | Yes |
| Agent code changes | Git (committed + pushed) | Yes |
| Brain/skill/tool edits | Git (committed + pushed) | Yes |
| Paperclip DB | Postgres named volume (`pgdata`) | Yes |
| Deploy key | Mounted file on host | Yes |
| `.env` (secrets) | File on host, bind-mounted | Yes |
| `node_modules` | Rebuilt on `bun install` after pull | Regenerated |

## Security

- **Deploy key** (SSH, read-write) mounted from host at `/run/secrets/deploy_key`, never baked into image
- **API keys** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) via `.env` on host, bind-mounted
- **Deploy webhook** authenticated via `DEPLOY_SECRET` header
- **GH Actions SSH** via secrets: `SSH_HOST`, `SSH_PRIVATE_KEY`, `SSH_USER`
- **Postgres** internal only, not port-exposed to host
- **Paperclip UI** optionally behind reverse proxy with auth

## File Map

| File | Purpose |
|------|---------|
| `Dockerfile` | Menschling image: Bun + Node.js + Claude CLI + git |
| `docker-compose.yml` | Full stack: menschling + paperclip + postgres |
| `docker-compose.override.yml` | Local dev overrides (ports, volumes) |
| `.dockerignore` | Exclude node_modules, .env, .git from build context |
| `scripts/entrypoint.sh` | Container startup: git config, cron, SIGTERM trap, gateway |
| `scripts/shutdown.sh` | Graceful commit + push on SIGTERM |
| `scripts/auto-commit.sh` | Cron: commit + push every 15 min |
| `.github/workflows/deploy.yml` | GH Actions: detect scope, SSH hot-reload or rebuild |
| `workspace/apps/gateway/adapters/deploy.ts` | `/webhook/deploy` endpoint |
| `workspace/tools/system/shutdown.ts` | `mensch system shutdown` CLI command |

## Setup Flow (User Perspective)

1. Fork the menschling template repo on GitHub
2. Generate a deploy key: `ssh-keygen -t ed25519 -f deploy_key`
3. Add the public key to the GitHub repo (Settings → Deploy keys, allow write)
4. On Hetzner VPS:
   ```bash
   mkdir -p /opt/menschling
   # Place deploy_key and .env on the host
   scp deploy_key hetzner:/opt/menschling/deploy_key
   scp .env hetzner:/opt/menschling/.env
   # Clone and start
   ssh hetzner "cd /opt/menschling && git clone git@github.com:you/menschling.git repo"
   ssh hetzner "cd /opt/menschling && docker compose up -d"
   ```
5. Add GitHub Actions secrets: `SSH_HOST`, `SSH_PRIVATE_KEY`, `SSH_USER`, `DEPLOY_SECRET`
6. Configure GitHub webhook: `https://your-vps:3200/webhook/deploy` with deploy secret
7. Agents start working autonomously

## Coolify Compatibility

The `docker-compose.yml` is Coolify-importable:
- Environment variables injected via Coolify's UI (maps to container env)
- Deploy key can be added as a Coolify secret file
- Coolify handles SSL termination and reverse proxy
- Set Coolify's deploy method to "Docker Compose" and point at the repo
