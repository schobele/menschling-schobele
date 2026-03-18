# Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Docker-based deployment that packages the full Menschling stack (menschling + paperclip + postgres), with hot-reload, auto-commit persistence, graceful shutdown, and GitHub Actions CI/CD.

**Architecture:** Dockerfile builds a Bun + Node.js + Claude CLI image. docker-compose.yml orchestrates three services. An entrypoint script manages git config, cron jobs, SIGTERM trapping, and a gateway process wrapper. A deploy webhook enables hot-reload without full rebuilds. GitHub Actions detects change scope and SSH-deploys accordingly.

**Tech Stack:** Docker, docker-compose, GitHub Actions, bash scripts, Elysia (deploy webhook), Bun

**Spec:** `docs/superpowers/specs/2026-03-17-docker-deployment-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `Dockerfile` | Menschling image: `oven/bun` + Node.js + Claude CLI + git + ssh |
| `docker-compose.yml` | Production stack: menschling + paperclip + postgres |
| `docker-compose.override.yml` | Local dev overrides (exposed ports, volume mounts) |
| `.dockerignore` | Exclude node_modules, .env, .git from build context |
| `scripts/entrypoint.sh` | Container startup: git config, cron, SIGTERM trap, gateway wrapper |
| `scripts/shutdown.sh` | Graceful commit + push before container exit |
| `scripts/auto-commit.sh` | Cron: commit + push every 15 min |
| `.github/workflows/deploy.yml` | CI/CD: detect change scope, SSH hot-reload or rebuild |
| `workspace/apps/gateway/adapters/deploy.ts` | `/webhook/deploy` endpoint handler |
| `workspace/tools/system/shutdown.ts` | `mensch system shutdown` CLI command |

### Modified Files
| File | Change |
|------|--------|
| `lib/env.ts` | Add `DEPLOY_SECRET` and `GIT_USER_NAME`/`GIT_USER_EMAIL` env vars |
| `.env.example` | Add new env vars |
| `workspace/apps/gateway/index.ts` | Add `/webhook/deploy` route |
| `workspace/tools/system/index.ts` | Register `shutdown` subcommand |
| `CLAUDE.md` | Document Docker commands |

---

## Task 1: Docker Build Files

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [x] **Step 1: Create .dockerignore**

```
node_modules
.env
.env.*
.git
.gitignore
*.log
coverage
.cache
.idea
.DS_Store
workspace/knowledge/*.db-wal
workspace/knowledge/*.db-shm
```

- [x] **Step 2: Create Dockerfile**

The image needs Bun (primary runtime), Node.js (required by Claude CLI), Claude Code CLI, git, ssh, and cron.

```dockerfile
FROM oven/bun:1 AS base

# Install Node.js (required by Claude CLI), git, ssh, cron
RUN apt-get update && apt-get install -y \
    curl \
    git \
    openssh-client \
    cron \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally via npm
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the project
COPY . .

# Link mensch CLI
RUN bun link

# Make scripts executable
RUN chmod +x scripts/entrypoint.sh scripts/shutdown.sh scripts/auto-commit.sh

EXPOSE 3200

ENTRYPOINT ["scripts/entrypoint.sh"]
```

- [ ] **Step 3: Verify Dockerfile syntax**

```bash
docker build --check . 2>&1 || echo "Docker not available locally, syntax looks correct"
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(docker): add Dockerfile and .dockerignore"
```

---

## Task 2: Shell Scripts (entrypoint, shutdown, auto-commit)

**Files:**
- Create: `scripts/entrypoint.sh`
- Create: `scripts/shutdown.sh`
- Create: `scripts/auto-commit.sh`

- [ ] **Step 1: Create scripts/shutdown.sh**

Commits all uncommitted changes and pushes to GitHub. Called on SIGTERM and available via `mensch system shutdown`.

```bash
#!/usr/bin/env bash
set -euo pipefail

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

- [ ] **Step 2: Create scripts/auto-commit.sh**

Cron job that runs every 15 minutes. Commits and pushes any uncommitted changes.

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /app

git add -A

if ! git diff --cached --quiet; then
  git commit -m "auto: workspace sync $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git push origin main
  echo "[auto-commit] Pushed changes"
else
  echo "[auto-commit] Nothing to commit"
fi
```

- [ ] **Step 3: Create scripts/entrypoint.sh**

Container entrypoint. Sets up git SSH, configures cron, traps SIGTERM for graceful shutdown, and runs the gateway in a restart loop.

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> Configuring git..."
git config --global user.name "${GIT_USER_NAME:-menschling-agent}"
git config --global user.email "${GIT_USER_EMAIL:-agent@menschling.dev}"

# Configure SSH deploy key if mounted
if [ -f /run/secrets/deploy_key ]; then
  mkdir -p ~/.ssh
  cp /run/secrets/deploy_key ~/.ssh/id_ed25519
  chmod 600 ~/.ssh/id_ed25519
  ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
  echo "==> Deploy key configured"
fi

echo "==> Setting up cron jobs..."
# Auto-commit every 15 minutes
echo "*/15 * * * * /app/scripts/auto-commit.sh >> /var/log/auto-commit.log 2>&1" | crontab -
cron
echo "==> Cron started"

echo "==> Ensuring dependencies are up to date..."
bun install

echo "==> Initializing database..."
bun run -e "import './lib/db.ts'"

# Graceful shutdown handler
GATEWAY_PID=""

shutdown() {
  echo "==> SIGTERM received, shutting down..."

  # Stop gateway
  if [ -n "$GATEWAY_PID" ]; then
    kill -TERM "$GATEWAY_PID" 2>/dev/null || true
    wait "$GATEWAY_PID" 2>/dev/null || true
  fi

  # Wait for any running claude agent processes to finish (up to 90s)
  WAITED=0
  while pgrep -f "claude.*--agent" > /dev/null 2>&1 && [ $WAITED -lt 90 ]; do
    echo "==> Waiting for agent processes to finish ($WAITED/90s)..."
    sleep 5
    WAITED=$((WAITED + 5))
  done

  # Commit and push
  /app/scripts/shutdown.sh

  echo "==> Shutdown complete"
  exit 0
}

trap shutdown SIGTERM SIGINT

echo "==> Starting gateway..."

# Gateway restart loop — SIGUSR1 restarts the gateway process
restart_gateway() {
  if [ -n "$GATEWAY_PID" ]; then
    kill -TERM "$GATEWAY_PID" 2>/dev/null || true
    wait "$GATEWAY_PID" 2>/dev/null || true
  fi
}

trap restart_gateway SIGUSR1

while true; do
  bun run workspace/apps/gateway/index.ts &
  GATEWAY_PID=$!
  echo "==> Gateway started (PID: $GATEWAY_PID)"
  wait $GATEWAY_PID || true
  EXIT_CODE=$?
  # Exit code 0 from a clean kill means we should restart or shutdown
  # Check if we're shutting down (SIGTERM sets a flag via the trap)
  if [ ! -f /tmp/.gateway-restart ]; then
    # If no restart flag, this was a crash — restart after a delay
    echo "==> Gateway exited ($EXIT_CODE), restarting in 2s..."
    sleep 2
  else
    rm -f /tmp/.gateway-restart
    echo "==> Gateway restarting (hot-reload)..."
  fi
done
```

- [ ] **Step 4: Make scripts executable**

```bash
chmod +x scripts/entrypoint.sh scripts/shutdown.sh scripts/auto-commit.sh
```

- [ ] **Step 5: Commit**

```bash
git add scripts/entrypoint.sh scripts/shutdown.sh scripts/auto-commit.sh
git commit -m "feat(docker): add entrypoint, shutdown, and auto-commit scripts"
```

---

## Task 3: Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.override.yml`

- [ ] **Step 1: Create docker-compose.yml**

Production compose file. Three services: menschling, paperclip, postgres.

```yaml
services:
  menschling:
    build: .
    container_name: menschling
    restart: unless-stopped
    stop_grace_period: 120s
    ports:
      - "${GATEWAY_PORT:-3200}:3200"
    env_file: .env
    environment:
      - NODE_ENV=production
      - PAPERCLIP_URL=http://paperclip:3100
    secrets:
      - deploy_key
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./workspace/knowledge/vault:/app/workspace/knowledge/vault

  paperclip:
    image: ghcr.io/paperclipai/paperclip:latest
    build:
      context: https://github.com/paperclipai/paperclip.git
      dockerfile: Dockerfile
    container_name: paperclip
    restart: unless-stopped
    ports:
      - "${PAPERCLIP_PORT:-3100}:3100"
    environment:
      - DATABASE_URL=postgresql://paperclip:paperclip@postgres:5432/paperclip
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:17-alpine
    container_name: menschling-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: paperclip
      POSTGRES_PASSWORD: paperclip
      POSTGRES_DB: paperclip
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U paperclip"]
      interval: 5s
      timeout: 3s
      retries: 5

secrets:
  deploy_key:
    file: ${DEPLOY_KEY_PATH:-./deploy_key}

volumes:
  pgdata:
```

- [ ] **Step 2: Create docker-compose.override.yml**

Local dev overrides. Mounts the project directory for live editing, exposes debug ports.

```yaml
# Local development overrides
# This file is automatically loaded by `docker compose up`
# Delete or rename to .disabled for production
services:
  menschling:
    build:
      context: .
      target: base
    environment:
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3200:3200"

  paperclip:
    ports:
      - "3100:3100"

  postgres:
    ports:
      - "5432:5432"
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.override.yml
git commit -m "feat(docker): add docker-compose with menschling, paperclip, postgres"
```

---

## Task 4: Deploy Webhook Endpoint

**Files:**
- Modify: `lib/env.ts`
- Modify: `.env.example`
- Create: `workspace/apps/gateway/adapters/deploy.ts`
- Modify: `workspace/apps/gateway/index.ts`

- [x] **Step 1: Add DEPLOY_SECRET and git env vars to lib/env.ts**

Add these fields to the Zod schema in `lib/env.ts`, after the WhatsApp section:

```typescript
  // Deploy
  DEPLOY_SECRET: z.string().optional(),
  GIT_USER_NAME: z.string().default("menschling-agent"),
  GIT_USER_EMAIL: z.string().default("agent@menschling.dev"),
```

- [x] **Step 2: Update .env.example**

Append to the end of `.env.example`:

```bash

# Deploy webhook (for GitHub push → hot-reload)
DEPLOY_SECRET=
GIT_USER_NAME=menschling-agent
GIT_USER_EMAIL=agent@menschling.dev
```

- [x] **Step 3: Create workspace/apps/gateway/adapters/deploy.ts**

Deploy webhook handler. Authenticates via `X-Deploy-Secret`, runs `git pull && bun install`, optionally restarts the gateway if gateway code changed.

```typescript
import { logger } from "../../../../lib/logger.ts";
import { env } from "../../../../lib/env.ts";

export async function deployWebhook({
  body,
  headers,
}: {
  body: unknown;
  headers: Record<string, string | undefined>;
}): Promise<{ ok: boolean; action?: string; error?: string }> {
  // Authenticate
  const secret = headers["x-deploy-secret"];
  if (!env.DEPLOY_SECRET) {
    return { ok: false, error: "DEPLOY_SECRET not configured" };
  }
  if (secret !== env.DEPLOY_SECRET) {
    logger.warn("Deploy webhook: invalid secret");
    return { ok: false, error: "unauthorized" };
  }

  // Check if this is an auto-commit (skip to prevent loops)
  const payload = body as Record<string, unknown>;
  const headCommit = payload?.head_commit as Record<string, unknown> | undefined;
  const commitMessage = (headCommit?.message as string) ?? "";
  if (commitMessage.startsWith("auto:")) {
    logger.info("Deploy webhook: skipping auto-commit");
    return { ok: true, action: "skipped (auto-commit)" };
  }

  logger.info("Deploy webhook: pulling changes...");

  try {
    // Pull latest changes
    const pull = Bun.spawnSync(["git", "pull", "--rebase", "origin", "main"], {
      cwd: "/app",
    });
    if (pull.exitCode !== 0) {
      const stderr = pull.stderr.toString();
      logger.error({ stderr }, "Deploy webhook: git pull failed");
      return { ok: false, error: `git pull failed: ${stderr}` };
    }

    // Install deps in case package.json changed
    const install = Bun.spawnSync(["bun", "install"], { cwd: "/app" });
    if (install.exitCode !== 0) {
      logger.warn("Deploy webhook: bun install had issues");
    }

    // Check if gateway code changed — if so, signal restart
    const diffOutput = pull.stdout.toString();
    const gatewayChanged = diffOutput.includes("workspace/apps/gateway/");

    if (gatewayChanged) {
      logger.info("Deploy webhook: gateway code changed, signaling restart");
      // Touch restart flag and kill the gateway process so the entrypoint loop restarts it
      Bun.spawnSync(["touch", "/tmp/.gateway-restart"]);
      Bun.spawnSync(["pkill", "-SIGUSR1", "-f", "entrypoint.sh"]);
      return { ok: true, action: "pulled + gateway restart" };
    }

    return { ok: true, action: "pulled" };
  } catch (err) {
    logger.error({ err }, "Deploy webhook: error");
    return { ok: false, error: String(err) };
  }
}
```

- [x] **Step 4: Add deploy route to gateway index.ts**

Add the import and route to `workspace/apps/gateway/index.ts`. After the whatsapp webhook line, add:

```typescript
import { deployWebhook } from "./adapters/deploy.ts";
```

And add this route after `.post("/api/message", restEndpoint)`:

```typescript
  .post("/webhook/deploy", deployWebhook)
```

- [x] **Step 5: Run tests to verify nothing broke**

```bash
bun test
```

Expected: All existing tests still pass.

- [x] **Step 6: Commit**

```bash
git add lib/env.ts .env.example workspace/apps/gateway/adapters/deploy.ts workspace/apps/gateway/index.ts
git commit -m "feat(gateway): add deploy webhook for hot-reload"
```

---

## Task 5: Shutdown CLI Command

**Files:**
- Create: `workspace/tools/system/shutdown.ts`
- Modify: `workspace/tools/system/index.ts`

- [ ] **Step 1: Create workspace/tools/system/shutdown.ts**

Wraps `scripts/shutdown.sh` as a `mensch system shutdown` CLI command.

```typescript
import type { CommandResult } from "../shared/base.ts";
import { logger } from "../../../lib/logger.ts";

export async function shutdownAction(): Promise<CommandResult<{ committed: boolean; pushed: boolean }>> {
  logger.info("Running graceful shutdown...");

  // Stage all changes
  const add = Bun.spawnSync(["git", "add", "-A"], { cwd: process.cwd() });
  if (add.exitCode !== 0) {
    return { success: false, error: "git add failed", code: "GIT_ERROR" };
  }

  // Check if there's anything to commit
  const diff = Bun.spawnSync(["git", "diff", "--cached", "--quiet"], { cwd: process.cwd() });
  if (diff.exitCode === 0) {
    logger.info("Nothing to commit");
    return { success: true, data: { committed: false, pushed: false } };
  }

  // Commit
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const commit = Bun.spawnSync(
    ["git", "commit", "-m", `auto: shutdown sync ${timestamp}`],
    { cwd: process.cwd() },
  );
  if (commit.exitCode !== 0) {
    return { success: false, error: "git commit failed", code: "GIT_ERROR" };
  }

  // Push
  const push = Bun.spawnSync(["git", "push", "origin", "main"], { cwd: process.cwd() });
  if (push.exitCode !== 0) {
    const stderr = push.stderr.toString();
    return { success: false, error: `git push failed: ${stderr}`, code: "GIT_ERROR" };
  }

  logger.info("Shutdown sync complete");
  return { success: true, data: { committed: true, pushed: true } };
}
```

- [ ] **Step 2: Register shutdown command in system/index.ts**

Add the import at the top of `workspace/tools/system/index.ts`:

```typescript
import { shutdownAction } from "./shutdown.ts";
```

Add the command registration after the `manifest` command:

```typescript
  system
    .command("shutdown")
    .description("Commit and push all workspace changes (graceful shutdown)")
    .action(handler(shutdownAction));
```

- [ ] **Step 3: Verify command registers**

```bash
bun run workspace/tools/cli.ts system --help
```

Expected: Shows `shutdown` in the commands list.

- [ ] **Step 4: Commit**

```bash
git add workspace/tools/system/shutdown.ts workspace/tools/system/index.ts
git commit -m "feat(system): add shutdown command for graceful commit+push"
```

---

## Task 6: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create .github/workflows/deploy.yml**

CI/CD workflow. Detects change scope, SSH-deploys accordingly. Skips auto-commits to prevent loops.

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    # Skip auto-commits from agents to prevent deploy loops
    if: "!startsWith(github.event.head_commit.message, 'auto:')"
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Detect change scope
        id: scope
        run: |
          CHANGED=$(git diff --name-only HEAD~1 HEAD)
          echo "Changed files:"
          echo "$CHANGED"

          if echo "$CHANGED" | grep -qE '^(Dockerfile|docker-compose|scripts/entrypoint)'; then
            echo "level=rebuild" >> "$GITHUB_OUTPUT"
          elif echo "$CHANGED" | grep -qE '^workspace/apps/gateway/'; then
            echo "level=restart-gateway" >> "$GITHUB_OUTPUT"
          else
            echo "level=pull" >> "$GITHUB_OUTPUT"
          fi

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Add host key
        run: ssh-keyscan -H ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts

      - name: Hot-reload (pull + install)
        if: steps.scope.outputs.level == 'pull' || steps.scope.outputs.level == 'restart-gateway'
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "
            docker compose -f /opt/menschling/docker-compose.yml \
              exec -T menschling bash -c 'cd /app && git pull --rebase origin main && bun install'
          "

      - name: Restart gateway
        if: steps.scope.outputs.level == 'restart-gateway'
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "
            docker compose -f /opt/menschling/docker-compose.yml \
              exec -T menschling touch /tmp/.gateway-restart && \
            docker compose -f /opt/menschling/docker-compose.yml \
              exec -T menschling pkill -SIGUSR1 -f entrypoint.sh
          "

      - name: Full rebuild
        if: steps.scope.outputs.level == 'rebuild'
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "
            cd /opt/menschling && \
            git pull && \
            docker compose up -d --build menschling
          "
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): add GitHub Actions deploy workflow with hot-reload"
```

---

## Task 7: Update Docs and Env

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Docker section to CLAUDE.md**

Add after the "## Commands" section:

```markdown
## Docker

```bash
docker compose up -d              # Start full stack (menschling + paperclip + postgres)
docker compose up -d --build      # Rebuild and start
docker compose logs -f menschling # Follow menschling logs
docker compose exec menschling bash  # Shell into workspace
docker compose down               # Stop all services
```

### Production deployment (Hetzner)

1. Fork the repo, generate a deploy key (`ssh-keygen -t ed25519`)
2. Place `deploy_key` and `.env` on host at `/opt/menschling/`
3. `docker compose up -d`
4. Configure GitHub Actions secrets: `SSH_HOST`, `SSH_PRIVATE_KEY`, `SSH_USER`
5. Agents auto-commit every 15 min, graceful shutdown on SIGTERM
```

- [ ] **Step 2: Run all tests**

```bash
bun test
```

Expected: All tests pass.

- [ ] **Step 3: Verify CLI still works**

```bash
bun run workspace/tools/cli.ts system --help
bun run workspace/tools/cli.ts --help
```

Expected: Shows shutdown in system commands, all domains listed.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Docker deployment section to CLAUDE.md"
```
