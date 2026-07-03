---
name: ship
description: DayOS pre-push ship ritual - run before every push that reaches users. Bumps the sw.js cache key when index.html changed, runs the syntax/sim gates, refuses to push red. Use when about to commit/push user-facing changes, or when the user says "ship it".
---

# /ship — DayOS

Repo-specific config for `playbook/SOP-ship.md` (read it for the why and the full ordering). Never push red.

1. `git status` + `git diff` — confirm the diff contains only the asked-for change (no bundled fixes).
2. **Cache bump:** if `index.html` changed → bump `const CACHE = 'dayos-vN'` in `sw.js` by exactly +1. Skip if only `api/*.mjs` or docs changed.
3. **Gates:** `bash scripts/check.sh` (inline-module syntax, api/*.mjs syntax, tests/*.mjs sims if present). All must pass.
4. **Silent-failure question** for any new write/scheduled/external path in the diff (PLAYBOOK Rule 4).
5. Commit (clear message, cache bump noted) and push to the designated branch.
6. **Post-push surfaces** (`playbook/SOP-deploy.md`): storage-rules change → needs manual `firebase deploy --only storage`; cron change → Hobby plan allows max one daily cron, sub-daily is silently rejected and blocks the deploy.
7. If user-facing: produce the verify-on-phone checklist (`playbook/SOP-verify-on-phone.md`). State which verification rung you reached; never claim the phone rung.
