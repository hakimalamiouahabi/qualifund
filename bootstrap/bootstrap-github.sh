#!/usr/bin/env bash
set -euo pipefail
REPO_NAME="${1:-leyton-radar}"
VISIBILITY="${2:-private}"
command -v gh >/dev/null || { echo 'GitHub CLI (gh) est requis: https://cli.github.com/' >&2; exit 1; }
gh auth status
OWNER="$(gh api user --jq .login)"
FULL_REPO="$OWNER/$REPO_NAME"

git init >/dev/null 2>&1 || true
git branch -M main
if ! gh repo view "$FULL_REPO" --json nameWithOwner >/dev/null 2>&1; then
  gh repo create "$FULL_REPO" "--$VISIBILITY" --source . --remote origin
fi
if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "https://github.com/$FULL_REPO.git"; fi
git add .
git -c user.name='leyton-radar-bootstrap' -c user.email='leyton-radar-bootstrap@users.noreply.github.com' commit -m 'release: LEYTON RADAR v12.2.0' >/dev/null 2>&1 || true
git push -u origin main

if gh api "repos/$FULL_REPO/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/$FULL_REPO/pages" -f build_type=workflow -F https_enforced=true >/dev/null
else
  gh api --method POST "repos/$FULL_REPO/pages" -f build_type=workflow >/dev/null
fi

gh workflow run update-and-deploy.yml --repo "$FULL_REPO" -f full_refresh=true
sleep 3
RUN_ID="$(gh run list --repo "$FULL_REPO" --workflow update-and-deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
echo "Dépôt : https://github.com/$FULL_REPO"
echo "Workflow lancé : $RUN_ID"
gh api "repos/$FULL_REPO/pages" --jq '"GitHub Pages : \(.html_url)"' || true
