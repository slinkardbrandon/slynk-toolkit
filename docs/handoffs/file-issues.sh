#!/usr/bin/env bash
# Files one GitHub issue per planned spec session, body taken from the sibling
# NN-*.md prompt files. Each issue is consumable by `/spec <issue-number>`.
#
# Run from your PERSONAL machine (the work box can't reach the personal repo):
#   gh auth status          # confirm the slinkardbrandon account is active
#   git push -u origin chore/tooling-and-distribution   # docs must be on the remote first
#   bash docs/handoffs/file-issues.sh
#
# One-shot — re-running creates duplicates. Delete a row below once filed.
# pr-review / pr-triage are intentionally absent: gather your existing skill
# flavors first (roadmap Tier 2).

set -euo pipefail

REPO="slinkardbrandon/slynk-toolkit"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# title <TAB> prompt-file
ISSUES=(
  "Spec: npx installer (distribution)	01-npx-installer.md"
  "Spec: bootstrap dial (suggest/force/off)	02-bootstrap-dial.md"
  "Spec: todo-list convention	03-todo-convention.md"
  "Spec: /tdd mindset lens + /spec wiring	04-tdd-lens.md"
  "Spec: spec-review (artifact-quality critic)	05-spec-review.md"
)

for row in "${ISSUES[@]}"; do
  title="${row%%	*}"
  file="${row##*	}"
  echo "Filing: $title  (from $file)"
  gh issue create --repo "$REPO" --label "spec" \
    --title "$title" --body-file "$DIR/$file"
done

echo
echo "Done. /spec <issue-number> per session. Order: npx first, then bootstrap"
echo "+ todo (parallel), then tdd, then spec-review."
