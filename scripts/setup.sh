#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
bun install

echo "==> Checking .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env from .env.example — edit it with your API keys."
else
  echo "    .env already exists, skipping."
fi

echo "==> Ensuring vault directories..."
mkdir -p workspace/knowledge/vault/{00-inbox,01-projects,02-people,03-resources,04-log}

echo "==> Initializing database..."
bun run -e "import './lib/db.ts'"

echo "==> Linking mensch CLI globally..."
bun link

echo "==> Generating BETTER_AUTH_SECRET if not set..."
if ! grep -q "^BETTER_AUTH_SECRET=.\+" .env 2>/dev/null; then
  SECRET=$(openssl rand -hex 32)
  if grep -q "^BETTER_AUTH_SECRET=" .env 2>/dev/null; then
    sed -i.bak "s/^BETTER_AUTH_SECRET=.*/BETTER_AUTH_SECRET=${SECRET}/" .env && rm -f .env.bak
  else
    echo "BETTER_AUTH_SECRET=${SECRET}" >> .env
  fi
  echo "    Generated BETTER_AUTH_SECRET"
else
  echo "    BETTER_AUTH_SECRET already set"
fi

echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run 'docker compose up -d' to start the full stack"
echo "  3. Run './scripts/paperclip-bootstrap.sh' to create your Paperclip admin account"
echo "  4. Run 'mensch system health' to verify connectivity"
