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
