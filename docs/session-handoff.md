# Session handoff — May 2026

Working state for the next agent picking up this branch. Read top to bottom; nothing else from prior chats carries over.

---

## Current state

- **Branch:** `claude/refactor-tagging-system-Rt3k5` — auto-merges to `main` via GitHub Actions, `main` deploys to Vercel.
- **Last commit:** `b73a0f4` — picked-date header on Trends → Calendar bumped to 1.8rem.
- **Working tree:** clean. Nothing untracked, nothing unpushed.
- **Service worker cache key:** `dayos-v9` (sw.js). **Mandatory** to bump on every user-facing change — devices serve stale `index.html` otherwise (we hit this twice in this session).

## What the user is actively working on, outside this branch

The user is iterating *privately* on two documents and will paste them back when ready:

1. **`docs/working-with-claude.md`** — agent-collaboration SOP. An earlier draft was committed locally then dropped (commit `58e23bf` was reset out before push). User asked us to wait for their finalized version. **Don't recreate this file.** When the user pastes the final version, just commit + push it.
2. **A founder-playbook draft** sent in chat (their own SOP for working with Claude). Also not yet on disk. Same: wait for them to finalize.

Files that DO exist as project SOPs:
- `CLAUDE.md` — architecture, data model, render pattern, IST helpers, recap commands. **Read this first.**
- `docs/sync-lessons.md` (commit `15e6883`) — Firestore-sync gotchas distilled from this session, paste-ready brief for use on other projects.

## Tests live OUTSIDE the repo

At `/tmp/dayos-check/*.mjs`. Survive across sessions in the same dev environment but are NOT versioned. Don't trust `ls` until you confirm they're there.

Files (12 total — 11 active tests + 1 non-test scaffold `app.mjs` that throws on Node ESM loader; ignore it):

```
cal-test.mjs                  carry-forward-tests.mjs
dayscore-lifecheck-tests.mjs  proj-recency-tests.mjs
proj-tombstone-tests.mjs      proj-unify-tests.mjs
projectref-sim.mjs            tag-mgmt-tests.mjs
tag-tests.mjs                 td-tests.mjs
wr-tasks-tests.mjs            wr-tests.mjs
```

Cumulative: 280+ simulation cases across pure helpers. When you add a new pure helper, add a sim file in `/tmp/dayos-check/` in the same commit.

## Mandatory pre-push gate (this session got bitten twice when it was skipped)

```bash
# 1. Inline-script syntax check
node -e "
const fs=require('fs');
const html=fs.readFileSync('/home/user/time-tracker/index.html','utf8');
const m=html.match(/<script type=\"module\">([\s\S]*?)<\/script>/);
let body=m[1].replace(/^\s*import[^;]*;/gm,'// import stripped');
try{new Function('return (async()=>{'+body+'})')();console.log('SYNTAX_OK');}
catch(e){console.log('SYNTAX_FAIL:',e.message);process.exit(1);}
"

# 2. Run every simulation test (skip app.mjs which is non-test scaffold)
cd /tmp/dayos-check && for f in *-tests.mjs *-sim.mjs cal-test.mjs td-tests.mjs wr-tests.mjs tag-tests.mjs; do
  [ -f "$f" ] && (node "$f" >/dev/null 2>&1 && echo "$f ok" || echo "$f FAIL")
done | sort -u
```

**Static checks are necessary but NOT sufficient.** The `onSnapshot` bug and the unified-search ReferenceError bug both passed static checks and broke the app on load. For anything touching `<script type="module">` reachability or runtime imports: **load the file in a browser tab before pushing**.

## Recent work — what shipped, what's verified, what isn't

Reverse-chronological from the most recent. **Bold = user has NOT cross-device-verified yet.** Treat as untested until the user confirms.

| Commit | What | User verified? |
|---|---|---|
| `b73a0f4` | Trends → Calendar picked-date header bumped 0.9rem → 1.8rem | **Pending** |
| `cfa8271` | Auto-scroll Trends to picked date after home-calendar tap (≈140px above hist-day-hdr) | **Pending** |
| `b7fdafa` | Home-page header date → tappable → mini calendar popup → navigates to Trends → Calendar. **Also fixes** the Saturday-column cutoff via `grid-template-columns: repeat(7, minmax(0, 1fr))` | **Pending** |
| `17d0262` | Fixed blank-screen ReferenceError caused by the unified-search shims (bare-identifier RHS in `window.X = closeGlobalSearch`) | Verified working |
| `da8b9db` + `5563b9a` | Unified search across every page (one `globalSearch` state, `renderSearchResults()` walks captures/daily/sessions/learning) | Verified working |
| `9cc46b6` | Project Session + Learning card header polish; capture type "Project" → "Project Note" | Pending |
| `37f1a8b` | Search results exclude activity-log blocks across all pages | Pending |
| `d5197c9` | Single `+` button on Journal page → 6-option add picker | Pending |
| `a085758` | Tombstones for project delete/rename — fixes the "deleted projects resurrect" bug | Pending |
| `15e6883` | `docs/sync-lessons.md` added | n/a — docs only |
| `eaded56` | Imported `onSnapshot` — fixes the silent reload-sync failure | Verified by user |

Older commits (banners, day-score config, daily-check-in customisation, daily-journal carry-forward, weekly-review tasks, etc.) are all on the branch; check `git log -- index.html` for the full list. **None of those have been deeply cross-device verified by the user since the original onSnapshot fix.** The user said earlier: do a deliberate cross-device test pass before stacking new features. That pass hasn't happened yet.

## Conventions you must follow

- **One file is the app:** `index.html`. No build step, no `package.json`. CLAUDE.md has the full architecture rundown.
- **IST helpers only.** Never `new Date()` directly — use `nowIST()`, `nowISTIso()`, `todayStr()`, `capDateIST()`, `addDays()`. Direct `Date()` causes silent timezone drift.
- **Sync writes need 3-site wiring.** New collection → per-write sync function + `forcePushToCloud` + `forcePullFromCloud` + `initialSync`. Miss any and cross-device data is lost silently.
- **Tombstones for any list where users delete.** `_synced` flag for any per-item write. Both patterns are already in use; mirror them.
- **Inline-handler reachability:** module-scope functions referenced by `onclick=""` must be on `window`. Forgot this twice this session.
- **Bump `dayos-vN` in `sw.js` on every user-facing change.** Forgot this twice this session too.
- **Branch flow:** `claude/*` auto-merges to `main`, `main` deploys to production via Vercel. No draft state. Every commit ships.

## How the user works

- Non-technical founder, learns by building. Push-back style is direct ("revert", "not so fast"). Plain English explanations win. Avoid jargon without a brief gloss.
- Prefers small focused commits. Will say "ship it" or "revert".
- Will explicitly say "push" when they want commits pushed (sometimes). For docs / small UI changes, just push — they've grown tired of asking. For destructive operations or things they want to preview, wait for explicit ok.

## Open items (in priority order)

1. **Deliberate cross-device test pass** of everything from the last ~20 commits, especially anything touching user state or sync. The user flagged this as the right next move two days ago and we kept building features on top instead.
2. The user is iterating on `docs/working-with-claude.md` and a founder-playbook doc privately; **wait for them to paste finalized text**, then commit.
3. Calendar date-pick auto-scroll offset (140px) might need tuning based on how it feels — user is testing now.

## What NOT to do

- Don't speculate about sync bugs. Add diagnostic `console.log` first and ask the user to paste what their browser console says.
- Don't bundle "while I'm here" fixes into a feature commit. The user has caught this multiple times.
- Don't claim work is done because static tests passed. Wait for cross-device user confirmation when the change touches state.
- Don't push to `main` directly. Always work on the `claude/*` branch.

---

*Generated at end of session, May 2026. Pin this file at the start of the next session by reading it top to bottom. Then read `CLAUDE.md`, then `docs/sync-lessons.md`, then `git log --oneline -25`. That's the onboarding.*
