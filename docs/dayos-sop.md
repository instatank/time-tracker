# DayOS — Build SOP

A 1-page operational reference. Read top-to-bottom in 5 minutes. Use as the template once you've built 4-5 projects.

---

## What it is, in one line
Personal time-intelligence PWA. Single `index.html`, vanilla JS modules, Firebase (Auth + Firestore + Storage), deployed on Vercel.

## Stack at a glance
- **No build step, no package manager, no framework.** One HTML file is the app.
- **Firebase web SDK** loaded via CDN (`gstatic.com`). Auth (Google sign-in) + Firestore (data) + Storage (voice notes).
- **Chart.js** via CDN, lazy.
- **Service Worker** is a cache-buster only — not for offline.
- **Branches:** work on `claude/*`, auto-merges to `main`, `main` deploys to Vercel. Every commit ships; no draft state.

## Architecture rules (don't break)
1. **One file = the app.** All CSS, HTML shell, and JS module live in `index.html`. Sheets are static `<div class="sheet">`s in the body, toggled with `.open`.
2. **Full re-render on every state change.** No diffing, no virtual DOM. `render() → renderMain() → switch(activeTab) → innerHTML`.
3. **IST helpers only.** Never `new Date()` directly. Use `nowIST()`, `todayStr()`, `capDateIST()`, `addDays()`.
4. **State lives in three places, in this order of truth:** module-level `let` vars → `localStorage` → Firestore mirror. Read from the first, write to all three.
5. **`onclick="x()"` needs `window.x = …`.** Module-scope functions are invisible to inline HTML handlers.

## The sync gospel (apply to every persistent collection)
1. **Tombstones on delete.** Without them, the loader's "remote first, then local extras" merge silently resurrects what you just deleted.
2. **`_synced: false` flag on write.** Flip to `true` only when the cloud confirms. Loader respects the flag during conflict.
3. **`onSnapshot` for live updates.** Reload-driven sync is fine single-user/multi-device; multi-user needs live subs.

When adding a new collection: per-write sync function + `initialSync` + `forcePushToCloud` + `forcePullFromCloud`. Miss any one → silent data loss.

## Pre-push gate (skipped three times this session, paid for it each time)
1. Inline-script syntax check (the `node -e` snippet in `docs/session-handoff.md`).
2. Run `/tmp/dayos-check/*.mjs` sim tests (~280 cases over pure helpers).
3. **Load `index.html` in a browser and click the changed surface.** Static checks pass ≠ sync works ≠ feature works.
4. Bump `dayos-vN` in `sw.js`. Open tabs serve stale `index.html` otherwise.
5. When in doubt, the browser console is the diagnostic source of truth. Watchdogs hide bugs, they don't fix them.

## iOS Safari / PWA traps (high-cost, easy to forget)
- **Inputs with `font-size < 16px` auto-zoom on focus.** Once zoomed, the bottom nav vanishes and only a reload fixes it. Force 16px on touch via `@media (hover: none) and (pointer: coarse) { input, textarea, select { font-size: 16px !important; } }`.
- **`MediaRecorder` codec differs:** Safari = `audio/mp4`, Chrome = `audio/webm;codecs=opus`. Detect with `MediaRecorder.isTypeSupported()`.
- **`ondblclick` is eaten if single-tap handler does `renderMain()` — the original element is gone by tap two.** Use a ~280ms timer dispatcher to differentiate single vs double tap.
- **Mic / audio permission must come from a direct user gesture.** PWA standalone mode sometimes re-prompts; don't auto-start.

## Security model
- **Firebase web `apiKey` in client is public by design.** Don't try to hide it. Security is enforced by Auth domain allowlist + Firestore/Storage rules, not by secrecy.
- **Firestore rules:** owner-only via `match /users/{userId}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == userId; }`. Any new top-level collection (e.g. `projectRefs/{userId}/...`) needs its own matching block — wildcards don't reach outside `users/`.
- **Storage rules are separate** from Firestore. Enabling Storage = a separate setup + a separate rule block (same owner-only pattern).
- **Default-deny is your friend.** Missing rules = blocked writes, not leaked data.

## Commit & shipping discipline
- One logical change per commit. No "while I'm here" cleanups bundled in.
- Commit messages: WHY first, WHAT second. Past tense.
- Branch flow is `claude/* → auto-merge → main → Vercel`. Don't push to `main` directly unless asked.

## Pitfalls catalog (the actual bugs)
- **Missing import → ReferenceError throws out of `initialSync` → watchdog flips green at 12s → nothing actually merged.** Imports are the first thing to check when sync looks weird.
- **`window.X = window.Y` declared before `Y` is assigned → captures `undefined` → click handler is a silent no-op.** Use function wrappers (`window.X = function() { window.Y(); }`) so the lookup happens at call time.
- **Auto-logging that re-runs on every init → duplicate rows.** If the job can fire more than once per day, gate it with an idempotency check or remove it.
- **Inline-handler reachability:** every `window.X = …` only lives at the line it runs. Adding a new onclick → add the `window.` assignment.
- **Don't conflate destructive cleanup with "stop creating new ones."** When removing a feature, confirm the existing data's fate explicitly — keep / sweep / migrate.

## How to add a feature (template)
1. **Decide where state lives:** module `let` + localStorage key. Define the shape upfront.
2. **Sync wiring (if it persists):** per-write fn + initialSync + force push/pull + tombstones + `_synced`.
3. **UI:** sheet markup + render fn + inline handler → `window.X` assignment.
4. **Reset state** in close/cancel handler so it doesn't bleed between modal sessions.
5. **SW cache bump.**
6. **Cross-device verify before "done."** Phone + Mac.

## "Done" means
- Pre-push gate green.
- Tested in a real browser, on both phone and mac, in the actual flow a user would hit.
- Synced data still synced after the change.
- One commit per logical change. SW bumped. No leftover comments / dead code.

---

*Living doc. Update when a new bug class appears or a pattern proves itself.*
