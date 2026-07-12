# Session handoff — reconciled 2026-07-06 (Phase C wrap); docs-only addenda 2026-07-07 + 2026-07-12

**2026-07-12 (branch `claude/portfolio-learning-strategy-gibhtm`, docs only — no app code, no SW bump needed):** the shared playbook gained the **builder's-path system** (founder-requested strategy overhaul): `playbook/NORTH_STAR.md` (four skill tracks + levels, portfolio tiers across all 10 repos, weekly/monthly cadence, graduation test), `playbook/CURRICULUM.md` (12-week technique ladder, one per week), `playbook/templates/BUILD_BRIEF.md` (required before new projects / major Tier-1 features), and a **v2 rewrite of `playbook/LEARNING_METHOD.md`** — decision cards join friction cards; the *witnessed rule* (never question the founder about moments he wasn't present for); 📍 live flags; ONE multiple-choice question per wrap with a named visible outcome. The `/wrap` skill's steps 2–4 were updated to match; v2 supersedes older wrap-question wording in other repos' skills. Portfolio tier assignments await founder confirmation at the first monthly review. This branch has NOT auto-merged to `main` yet — confirm merge before other repos fetch the playbook from `main`.

**2026-07-07 (branch `claude/dayos-second-brain-integration-argsm7`, docs only — no app code, no SW bump needed):** DayOS is now a **memory bank for the founder's personal AI agent** (`instatank/instatank42`). The agent mirrors this Firestore read-only via a service account (same REST pattern as `api/cron-reminders.mjs`) into markdown on its server. What changed in THIS repo: new contract doc `docs/second-brain-integration.md` (collections/fields/invariants the agent depends on), pointers in `CLAUDE.md`, and a 7th checklist site in `playbook/SOP-firebase-sync.md` (schema changes must update the contract doc in the same commit). The agent-side implementation lives entirely in the instatank42 repo (`docs/SECOND_BRAIN.md` there is the plan of record).

Working state for the next agent picking up this repo. Read top to bottom; nothing else from prior chats carries over. **Facts below are re-verified against the code by the `/wrap` skill at each session end — this doc was once ~60 SW versions stale; if a fact disagrees with the code, the code wins (fix the doc in the same commit).**

---

## Current state

- **Branches:** `claude/*` branches auto-merge to `main` via GitHub Actions, `main` deploys to Vercel. (Check `git branch --show-current` — don't trust a doc for this.) Current working branch: `claude/portfolio-learning-strategy-gibhtm` (playbook/system docs), no PR opened yet (auto-merge doesn't need one).
- **Service worker cache key:** check `const CACHE` at the top of `sw.js` — currently `dayos-v136` as of 2026-07-06. **Mandatory** to bump on every user-facing change — devices serve stale `index.html` otherwise. The `/ship` skill does this automatically.
- **Latest commit:** `4be4804` — builder's-path playbook docs (NORTH_STAR, CURRICULUM, BUILD_BRIEF, learning method v2). Last app-code commit remains `0b46647` (Tag search Phase C).

## Tag/search project — DONE (all phases shipped 2026-07-06)

Three-phase test-and-improve pass on tagging + search, tracked in `docs/tag-search-notes.md`:
- **Phase B (SW v135):** `#tag` search queries do exact tag matching (agrees with Journal filter pills — `#win` ≠ `#winner`); multi-word queries are order-independent AND; dead inline search-narrowing in `renderToday`/`renderJournal` removed. Phase A (tag-tokenizer fix) intentionally skipped by founder.
- **Phase C (SW v136):** card tag pills are tappable (`renderTagPills` → `tagPillTap`) — tapping a `#tag` filters the app to that exact tag via the unified global search; `stopPropagation` stops the card's own expand/edit tap. A removable **active-filter chip** (`activeTagFilterChipHtml`, prepended in `renderSearchResults`) sits atop results, coloured to match the tag, one tap to clear. Verified 9/9 in a headless-browser sim.
- **Known real bugs found but NOT fixed** (documented in `tag-search-notes.md`, founder hasn't prioritised): two tag tokenizers (`extractTags` vs `normalizeTag`) disagree on hyphens/non-ASCII; `getRelatedCapturesFor` (~index.html 8061) doesn't filter `notTrashed`, so a trashed capture shows under its project for up to 7 days.

## What shipped since the last real reconciliation (2026-06-27 → 2026-07-06)

The 2026-07-02/03 version of this doc claimed to be "reconciled" but only patched a top bullet — the body below was still describing the pre-2026-07-01 state. Corrected now. Actual scope of what shipped:

1. **Trends / Dashboard overhaul (2026-06-29 → 07-01), all on `main`:**
   - Time by Category collapsed into a slim ratio-bar snapshot; Skipped based on elapsed waking hours (not full days); sleep-window blocks excluded from category totals with drill-down.
   - Charts sub-tab: calendar-based Week/Month periods with `‹ / ›` navigation (`dashPeriodOffset`, `getDashPeriod()`), per-metric delta chips vs. the prior period, and a prominent Totals/Over-Time toggle.
   - Calendar sub-tab: numbered grid doubles as a consistency heatmap (`cal-dot-l0`–`l4`, red→orange→yellow→green by waking hours logged via `hoursLevel()`), with a Less→More legend and a first-run empty state.
   - **AI-drafted Weekly/Monthly Review summaries** — a 4th AI feature (`summarize-review`): client builds a digest (`buildWeeklyDigest`/`buildMonthlyDigest`), AI drafts an editable recap, saved as `aiSummary` on the review doc. This is the "bigger AI feature" the 2026-06-27 handoff had listed as deferred — it's done now, not pending.
   - Anchored search/hashtag preview snippets (`anchoredPreview()`): Journal search, `#tag` pills, and Today's Wins panel now window the collapsed preview around the matching line instead of always showing the first line.
2. **Cross-project infrastructure (2026-07-02/03):** shared `playbook/` (global rules, ship/sync/deploy/verify SOPs, learning method) + `/ship` and `/wrap` skills + Stop-hook wrap reminder + in-repo pre-push gate `scripts/check.sh` (replaces the old unversioned `/tmp/dayos-check/` sims, which were lost) + `LEARNINGS.md` friction ledger + `learning_notes.md` (cross-session diagnosis, items 1–11 shipped).
3. **2026-07-06:** `CLAUDE.md`'s Trends/Dashboard and AI-features sections were still describing the pre-2026-07-01 state (3 AI features, no heatmap, no period nav) despite all of the above being live on `main` for days — fixed in `06c8231`. This doc (`session-handoff.md`) had the same problem, one layer worse (claimed "reconciled" while stale) — fixed in this wrap.

## Earlier history (pre-2026-06-27, still accurate, kept for context)

Major systems from the prior session block: **voice notes** (Firebase Storage, per-entry, Today-page quick-dump strip), **7-day Trash** (soft-delete + Settings → Trash + sweep), **autosave** on Sessions + Learning, **push notifications** (daily 11:30pm IST via Vercel cron + FCM — Hobby plan caps cron to once daily), **iOS PWA polish** (safe-area-inset, `!important` standalone fallback), and the first 3 **AI features** (`extract-blocks`, `organize`, `extract-tasks`) — all verified working, all superseded as "final" once the 4th (`summarize-review`) shipped.

## Active areas the user is iterating on

- No specific feature currently flagged as "user is actively testing, feedback pending" — the last explicit testing note (AI extract/organize/task-extraction) was marked verified working in earlier commits. Confirm with the user at session start whether that's still true; don't assume.
- No private documents being drafted off-disk.

Files that exist as project SOPs:
- `CLAUDE.md` — architecture, data model, render pattern, IST helpers, recap commands. **Read this first.**
- `playbook/PLAYBOOK.md` — cross-project global rules + SOPs (ship/sync/deploy/verify). Supersedes old per-repo cheatsheets; read at session start.
- `playbook/NORTH_STAR.md` + `playbook/CURRICULUM.md` + `playbook/templates/BUILD_BRIEF.md` — the builder's-path system (skill tracks, portfolio tiers, technique-of-the-week, new-project brief). Read NORTH_STAR for any strategy / what-to-build conversation.
- `playbook/SOP-firebase-sync.md` — Firestore-sync gotchas (shared; `docs/sync-lessons.md` is a superseded stub, kept only for old links).
- `docs/dayos-sop.md` — Plain-English founder-learnings doc the user wrote ("what I'd tell myself starting again"). Not technical reference.
- `docs/ai-features.md` — AI infrastructure + prompt locations + tuning notes, kept current including `summarize-review`.
- `docs/experiments.md` — per-flag tracker for Settings → Experiments.
- `LEARNINGS.md` — friction ledger, appended by `/wrap`.

## Tests live IN the repo now

**History (kept as a lesson):** the sim tests used to live at `/tmp/dayos-check/*.mjs`, unversioned. A fresh environment came up without them (2026-07-02) and they were lost — the gate looked green with its teeth missing. Anything not committed doesn't exist.

**Now:** behavioural sims belong in `tests/*.mjs` (currently empty — rebuild sims there as sync/helper code gets touched; add the sim in the same commit as the helper).

## Mandatory pre-push gate

```bash
bash scripts/check.sh
```

Extracts + syntax-checks the inline module, `node --check`s every `api/**/*.mjs`, runs `tests/*.mjs` sims if present. The `/ship` skill runs this plus the cache bump. Full ritual + why: `playbook/SOP-ship.md`.

**Static checks are necessary but NOT sufficient.** Multiple bugs in past sessions passed static checks and broke at runtime. For anything touching the AI route or service worker: deploy preview + verify before declaring done.

## Branch flow + deploy (CRITICAL — read before touching Vercel)

- **`claude/*` → auto-merges to `main` → Vercel deploys.** Every commit ships.
- **Vercel deployment can silently fail** if `vercel.json` rejects a cron schedule (Hobby plan caps cron to daily). When deploys mysteriously stop, check Deployments tab in Vercel UI for the actual error. Got bitten by `*/30 * * * *` being rejected silently — burned half a day debugging.
- **`api/*.mjs` extension matters.** ES module syntax (`import` / `export default`) requires `.mjs` OR a `package.json` with `"type": "module"`. This project uses `.mjs`. Don't rename to `.js`.

## Conventions you must follow

- **One file is the app:** `index.html`. No build step, no `package.json`. CLAUDE.md has the full architecture rundown.
- **IST helpers only.** Never `new Date()` directly — use `nowIST()`, `nowISTIso()`, `todayStr()`, `capDateIST()`, `addDays()`. Direct `Date()` causes silent timezone drift.
- **Sync writes need 3-site wiring.** New collection → per-write sync function + `forcePushToCloud` + `forcePullFromCloud` + `initialSync`. Miss any and cross-device data is lost silently.
- **Tombstones for any list where users delete.** `_synced` flag for any per-item write. Both patterns are already in use; mirror them.
- **Soft-delete via `deletedAt: ISO`** for entries the user can recover from Trash. Hard-delete via the existing tombstone+cloud path is reserved for the 7-day sweep.
- **Inline-handler reachability:** module-scope functions referenced by `onclick=""` must be on `window`.
- **Use function-wrapper aliases, not bare assignments.** `window.X = function() { window.Y(); }` not `window.X = window.Y`. The latter captures `undefined` if Y is defined later in the file. Got bitten earlier — see commit `9e107fb` for the fix pattern.
- **Bump `dayos-vN` in `sw.js` on every user-facing change.** Server-only changes (`api/*.mjs`) don't need a bump.
- **iOS PWA: use `min(env(safe-area-inset-*), Npx)` patterns** when capping. `max(env(...), Npx)` for forcing a minimum.
- **Docs drift independently of each other.** Reconciling `session-handoff.md` does NOT mean `CLAUDE.md` (or vice versa) is current — each doc describing the same system must be checked against the actual code separately, every session. A doc's own "reconciled [date]" header is not proof it's accurate; verify, don't trust the label.

## AI features — high-level (full detail in `docs/ai-features.md`)

- Server proxy at `api/ai/claude.mjs`. **Four** tasks: `extract-blocks`, `organize`, `extract-tasks`, `summarize-review`. All use Sonnet 4.6.
- Auth: Firebase ID token verified server-side via project public keys. No npm deps.
- Client: `aiCall(task, input, ctx)` helper in `index.html` — Firebase ID token in Authorization header.
- Cost ceiling: user set $5/mo Anthropic spend cap. ~$0.005/call on Sonnet. Plenty of headroom.
- All AI proposes; user confirms. Nothing auto-saves.

## Open items (in priority order)

1. **Cross-device test pass** owed since the Trash/voice/AI rollout — still not confirmed done as of this reconciliation. Ask the user before assuming it happened.
2. **`tests/*.mjs` is still empty.** Rebuild behavioural sims as sync/helper code gets touched — do it in the same commit as the helper, not as a separate cleanup pass. The tag/search work built two working browser sims (Phase B + Phase C `verify-phasec.mjs`) but they live in the session scratchpad, not `tests/` — committing them needs a **Playwright-gated runner** in `scripts/check.sh` so a fresh machine without the browser doesn't fail the gate. That runner is the concrete next step to get any browser sim into the repo. Harness pattern (Firebase-module stubs, `serviceWorkers:'block'`, `--no-sandbox`, point `executablePath` at the pre-installed `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`) is in `docs/tag-search-notes.md`.
3. **Bigger AI features still deferred** (per the original priority list, minus `summarize-review` which is now done): smart EOD prompts, semantic search, auto-tag suggestion, full Daily Journal generation, pattern detection → routine suggestion.
4. **Two known tag/search bugs left unfixed** (founder hasn't prioritised, see the tag-search project section above): tokenizer disagreement (`extractTags` vs `normalizeTag`) and trashed captures leaking into project Related lists (`getRelatedCapturesFor`).

## What NOT to do

- Don't speculate about sync bugs. Add diagnostic `console.log` first and ask the user to paste what their browser console says.
- Don't bundle "while I'm here" fixes into a feature commit. The user has caught this multiple times.
- Don't claim work is done because static tests passed. Wait for cross-device user confirmation when the change touches state.
- Don't push to `main` directly. Always work on the `claude/*` branch.
- Don't add the FCM/Whisper/transcription pipeline without explicit user request. We discussed it; user explicitly said skip — they have an external transcription tool.
- Don't change cron from daily to more frequent without explaining the Vercel Hobby plan limit (cron must be daily).
- Don't trust a doc's own "reconciled" claim without diffing it against current commits/code — see the Conventions entry above.

## How the user works

- Non-technical founder, learns by building. Push-back style is direct ("revert", "not so fast"). Plain English explanations win. Avoid jargon without a brief gloss.
- Prefers small focused commits. Will say "ship it" or "revert".
- Will explicitly say "push" when they want commits pushed (sometimes). For docs / small UI changes, just push — they've grown tired of asking. For destructive operations or things they want to preview, wait for explicit ok.
- Hits usage limits often. Plan work in increments small enough to commit + push before any risky chunk.

---

*Generated/reconciled at end of session, 2026-07-06. Pin this file at the start of the next session by reading it top to bottom. Then read `CLAUDE.md`, then `playbook/PLAYBOOK.md`, then `docs/ai-features.md`, then `git log --oneline -25`. That's the onboarding.*
