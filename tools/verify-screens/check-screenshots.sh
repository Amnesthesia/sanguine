#!/usr/bin/env bash
# Fails when the last commit names a backlog id (e.g. "P8-25 ..." or "P8-20 P8-21 ...") and changes a screen (apps/mobile/src/app/** or a
# .tsx under apps/mobile/src/features/**, tests excluded) but docs/screenshots/<id>[-suffix]/ holds no PNG in that commit's tree.
# A change that truly has nothing to see says so in the commit message: a line "Screenshots: none (<reason>)".
# CI runs it on push with `fetch-depth: 2`; run it by hand with `tools/verify-screens/check-screenshots.sh [rev]`.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
rev="${1:-HEAD}"

msg="$(git log -1 --format=%B "$rev")"
# the ids at the start of the subject: "P8-25", "P8-20 P8-21 P8-22", "P8-20, P8-21"
ids="$(git log -1 --format=%s "$rev" | grep -oE '^(P[0-9]+-[0-9]+[ ,]+)*P[0-9]+-[0-9]+' | grep -oE 'P[0-9]+-[0-9]+' || true)"
[ -n "$ids" ] || exit 0   # no backlog id in the subject: nothing to hold it to

if echo "$msg" | grep -qiE '^Screenshots: none \(.+\)'; then exit 0; fi

# the files this commit changes; against the first parent for a merge, and the whole commit for a shallow root
changed="$(git diff-tree --no-commit-id --name-only -r -m --first-parent --root "$rev")"
screens="$(echo "$changed" | grep -E '^apps/mobile/src/app/|^apps/mobile/src/features/.*\.tsx$' | grep -vE '\.(test|spec)\.tsx?$' || true)"
[ -n "$screens" ] || exit 0

for id in $ids; do
  if git ls-tree -r --name-only "$rev" -- docs/screenshots | grep -qE "^docs/screenshots/$id(-[^/]*)?/.*\.png$"; then exit 0; fi
done

echo "check-screenshots: $(git log -1 --format=%h "$rev") names $(echo $ids | tr '\n' ' ')and changes a screen, but docs/screenshots/<id>/ has no PNG:" >&2
echo "$screens" | sed 's/^/  /' >&2
echo "Run tools/verify-screens/run.sh (ITEM=<id>) and commit the images, or add a line 'Screenshots: none (<reason>)' to the commit message." >&2
exit 1
