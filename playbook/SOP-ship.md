# SOP — Ship ritual (version bump + gates)

**Fires:** before every push that will reach users (directly or via auto-merge/auto-deploy).
**Failure it prevents:** (a) users' installed PWAs silently running stale code because the service-worker cache key wasn't bumped — your own "most common bugs" list; (b) a syntax error or red build reaching production because no gate ran. ~100 hand-cranked bumps across three repos before this was automated.
**Mechanism:** each repo has a thin `.claude/skills/ship/SKILL.md` holding only that repo's facts; the logic lives here.

---

## EXECUTE

Run these steps in order. Cheapest checks first, push last. **Never push red** — if a gate fails, fix or report; don't ship.

1. **Diff review:** `git status` + `git diff` — confirm the change set contains only what was asked (Rule 1: no bundled fixes).
2. **Version bump (PWA repos only):** if any user-facing file changed, bump the service-worker cache key by exactly one:
   | Repo | File | Key | Bump when | Skip when |
   |---|---|---|---|---|
   | time-tracker (DayOS) | `sw.js` | `dayos-vN` | `index.html` changed | only `api/*.mjs` / docs changed |
   | Cadence | `service-worker.js` | `cadence-vN` | any user-facing change | docs/scripts only |
   | BillOS | `sw.js` | `VERSION = "vX.Y.Z"` (bump patch) | any shippable change | docs only |
   | PartySpark / TradeGenie / Penalty-Shootout | — no SW key — | | | |
3. **Syntax/type gates** (per repo — the exact commands live in that repo's ship skill):
   - time-tracker: `bash scripts/check.sh` (extracts the inline module → `node --check`, checks `api/*.mjs`, runs `tests/*.mjs` sims if present).
   - BillOS: extract inline `<script type="module">` → `node --check` (script in repo).
   - Cadence: `node scripts/smoke-test.js` + remember the 3-file engine-sync rule (engine changes must land in `index.html`, `scripts/generate-sample-plans.js`, `scripts/smoke-test.js` together).
   - PartySpark: `npm run build` **and** `node scripts/check-api-landmines.mjs` if anything under `api/` changed; new Tailwind accent → grep compiled CSS.
   - TradeGenie: `npm run typecheck && npm run lint && npm run build`.
   - Penalty-Shootout: `npm run build`.
4. **Silent-failure question** (Rule 4): for any new write/scheduled/external path in the diff, confirm a loud failure exists.
5. **Commit** with a clear message; **push** to the designated branch.
6. **Post-push deploy surfaces:** check `SOP-deploy.md` — does this change also need a storage-rules deploy, an env var, or an Action to run? A git push is not always the whole deploy.
7. **Hand off:** if the change is user-facing, produce the verify-on-phone checklist (`SOP-verify-on-phone.md`). Not optional.

## UNDERSTAND

**Why the bump exists:** an installed PWA doesn't ask the server "anything new?" on every open — the service worker serves its cached copy until its own file changes. The version key is that change: bumping it is how you *tell the cache the truth moved* (Playbook L9). Forget it and every installed device runs the old app while you stare at the new code wondering why the bug "isn't fixed."

**Why the order matters:** gates run cheapest-first (a 2-second syntax check before a 40-second build) so failures cost the least time, and the push is last so nothing red can escape. The diff review is first because it's the only step that catches the *wrong change shipping cleanly* — every later gate checks correctness of code, not correctness of scope.

**Why it's a skill and not a memory:** this ritual was performed by hand ~100 times and still got forgotten often enough to make your own bug list. The EV math: automating it cost one afternoon; each forgotten bump costs a confused debugging session on a device serving stale code. This is Playbook L11 in action — the checklist graduated into machinery.
