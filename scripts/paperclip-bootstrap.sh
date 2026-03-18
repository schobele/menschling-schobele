#!/usr/bin/env bash
set -euo pipefail

# Bootstrap Paperclip: onboard + create CEO invite
# Run after `docker compose up -d` when setting up a new workspace.
#
# Usage:
#   docker compose exec paperclip /app/scripts/paperclip-bootstrap.sh
#   — or from the host —
#   ./scripts/paperclip-bootstrap.sh          (uses docker compose exec)

PAPERCLIP_SERVICE="paperclip"

# Detect if we're inside the container or on the host
if [ -f /paperclip/instances/default/logs/server.log ] 2>/dev/null; then
  # Inside container
  echo "==> Running Paperclip onboard..."
  npx paperclipai onboard --yes

  echo ""
  echo "==> Creating CEO bootstrap invite..."
  npx paperclipai auth bootstrap-ceo

  echo ""
  echo "==> Paperclip bootstrapped. Open the invite URL above to create your admin account."
else
  # On host — exec into the container
  echo "==> Bootstrapping Paperclip via docker compose..."
  docker compose exec "$PAPERCLIP_SERVICE" npx paperclipai onboard --yes
  echo ""
  docker compose exec "$PAPERCLIP_SERVICE" npx paperclipai auth bootstrap-ceo
  echo ""
  echo "==> Paperclip bootstrapped. Open the invite URL above to create your admin account."
fi
