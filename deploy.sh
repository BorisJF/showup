#!/usr/bin/env bash
#
# ShowUp — one-step deploy.
# Commits any changes, pushes to GitHub, then deploys to Netlify.
#
# Usage:
#   ./deploy.sh                 # auto message: "deploy: <date time>"
#   ./deploy.sh "your message"  # custom commit message
#
set -e
cd "$(dirname "$0")"

MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"

# ── 1. Commit + push (skipped cleanly if nothing changed) ──────────────────
git add -A
if git diff --cached --quiet; then
  echo "→ Git: nothing to commit, working tree clean."
else
  git commit -m "$MSG"
  echo "→ Git: committed \"$MSG\""
  if git push; then
    echo "→ Git: pushed to GitHub."
  else
    echo "⚠  Git push failed — fix it, then re-run. Skipping deploy."
    exit 1
  fi
fi

# ── 2. Deploy to Netlify ───────────────────────────────────────────────────
echo "→ Netlify: deploying app/ to production..."
netlify deploy --prod --dir=app
echo "✓ Done."
