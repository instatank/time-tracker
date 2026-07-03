#!/bin/bash
# DayOS pre-push gate (SOP-ship.md step 3).
# Replaces the old unversioned /tmp/dayos-check/ setup, which was lost when a
# fresh environment came up without it — this lives in the repo so it can't vanish.
#
# 1. Extracts the inline <script type="module"> from index.html -> node --check
# 2. node --check every api/**/*.mjs serverless function
# 3. Runs tests/*.mjs sims if present (behavioural checks; recreate under tests/)
set -e
cd "$(dirname "$0")/.."

node -e '
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: no inline <script type=\"module\"> found in index.html"); process.exit(1); }
fs.writeFileSync(require("os").tmpdir() + "/dayos-inline-module.mjs", m[1]);
'
node --check "$(node -e 'process.stdout.write(require("os").tmpdir())')/dayos-inline-module.mjs"
echo "OK  inline module syntax"

while IFS= read -r f; do
  node --check "$f"
  echo "OK  $f"
done < <(find api -name '*.mjs' -type f)

if ls tests/*.mjs >/dev/null 2>&1; then
  for t in tests/*.mjs; do
    echo "SIM $t"
    node "$t"
  done
else
  echo "NOTE: no tests/*.mjs sims present. The old /tmp/dayos-check sims were lost"
  echo "      (unversioned). Rebuild behavioural sims under tests/ as sync code is touched."
fi

echo "ALL GATES GREEN"
