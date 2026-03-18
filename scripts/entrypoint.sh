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
