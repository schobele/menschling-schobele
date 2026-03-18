#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_REMOTE="template"
TEMPLATE_URL="https://github.com/schobele/menschling.git"
TEMPLATE_BRANCH="main"

echo "==> Checking template remote..."
if ! git remote get-url "$TEMPLATE_REMOTE" &>/dev/null; then
  echo "    Adding template remote: $TEMPLATE_URL"
  git remote add "$TEMPLATE_REMOTE" "$TEMPLATE_URL"
else
  echo "    Template remote already configured"
fi

echo "==> Fetching template updates..."
git fetch "$TEMPLATE_REMOTE"

# Show what's new
CURRENT=$(git rev-parse HEAD)
TEMPLATE_HEAD=$(git rev-parse "$TEMPLATE_REMOTE/$TEMPLATE_BRANCH")
NEW_COMMITS=$(git log --oneline "$CURRENT".."$TEMPLATE_HEAD" 2>/dev/null | wc -l | tr -d ' ')

if [ "$NEW_COMMITS" = "0" ]; then
  echo "==> Already up to date with template."
  exit 0
fi

echo ""
echo "==> $NEW_COMMITS new commit(s) from template:"
git log --oneline "$CURRENT".."$TEMPLATE_HEAD" | head -20
echo ""

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "==> WARNING: You have uncommitted changes. Commit or stash them first."
  echo "    Run: git stash"
  exit 1
fi

echo "==> Merging template/$TEMPLATE_BRANCH..."
if git merge "$TEMPLATE_REMOTE/$TEMPLATE_BRANCH" --no-edit 2>/dev/null; then
  echo ""
  echo "==> Template merged cleanly!"
  echo "    Run 'bun install' if dependencies changed."
else
  echo ""
  echo "==> Merge has conflicts. This is expected — your customizations (SOUL, PROJECT,"
  echo "    custom brains) may conflict with template updates."
  echo ""
  echo "    Files with conflicts:"
  git diff --name-only --diff-filter=U
  echo ""
  echo "    To resolve:"
  echo "      1. Open each conflicted file and resolve the markers (<<<< ==== >>>>)"
  echo "      2. Keep YOUR sections: Soul, Project, custom brains, vault content"
  echo "      3. Accept TEMPLATE sections: Stack, Commands, Architecture, Conventions"
  echo "      4. git add <resolved-files>"
  echo "      5. git commit"
  echo ""
  echo "    Or abort with: git merge --abort"
  echo ""
  echo "    TIP: Run '/update-template' in Claude Code for guided conflict resolution."
fi
