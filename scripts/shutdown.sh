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
