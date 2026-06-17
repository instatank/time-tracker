# Session handoff — June 2026

Working state for the next agent picking up this branch. Read top to bottom; nothing else from prior chats carries over.

---

## Current state

- **Branch:** `claude/review-dayos-handoff-TQYUm` — auto-merges to `main` via GitHub Actions, `main` deploys to Vercel.
- **Last commit:** `74b16d9` — AI: Daily Journal task extraction (Sonnet, proposal pills).
- **Working tree:** clean. Nothing untracked, nothing unpushed.
- **Service worker cache key:** `dayos-v71` (sw.js). **Mandatory** to bump on every user-facing change — devices serve stale `index.html` otherwise.

## What this session built (big picture)

This was an intensive multi-day session. Major systems shipped:

1. **Voice notes** (Firebase Storage). Per-entry attached voice notes across Quick Note / Project Note / Daily Journal / Project Session / Learning. Plus a Today-page strip for one-tap quick-note voice dumps. Title search, playback indicator with elapsed time, ×-delete with two-tap confirm.
2. **7-day Trash** for entries + voice notes (soft-delete model). Settings → Trash with multi-select + bulk restore/purge. Sweep on init + post-sign-in hard-deletes anything past TTL.
3. **Autosave** on Project Sessions + Learning entries (Daily Journal model). No more Save button on those modals.
4. **Push notifications** — daily 11:30pm IST reminder via Vercel cron + FCM. Hobby plan limits cron to daily; single entry.
5. **iOS PWA polish** — safe-area-inset for status bar + home indicator, status-bar-style flipped to "default", explicit standalone-mode CSS fallback with `!important`.
6. **AI infrastructure (the major new system).** Three Claude tasks live: activity-block extraction, organize (Thoughts/Reflection), task extraction. See `docs/ai-features.md`.
7. **Smaller polish:** × close buttons on all big modals, Projects/Learning lists default to current-month view, Trends calendar now shows Daily Journal entries.

## Active areas the user is iterating on

- **AI features are in active testing.** User said they'd continue testing and bring feedback. Prompts will likely need tuning.
- No private documents being drafted off-disk this session (unlike the previous handoff which mentioned `docs/working-with-claude.md` being iterated privately).

Files that exist as project SOPs:
- `CLAUDE.md` — architecture, data model, render pattern, IST helpers, recap commands. **Read this first.**
- `docs/sync-lessons.md` — Firestore-sync gotchas distilled from earlier sessions, paste-ready brief for use on other projects.
- `docs/dayos-sop.md` — Plain-English founder-learnings doc the user wrote ("what I'd tell myself starting again"). Not technical reference.
- `docs/ai-features.md` (**new this session**) — AI infrastructure + prompt locations + tuning notes.

## Tests live OUTSIDE the repo

At `/tmp/dayos-check/*.mjs`. Survive across sessions in the same dev environment but are NOT versioned. Don't trust `ls` until you confirm they're there. When you add a new pure helper, add a sim file in `/tmp/dayos-check/` in the same commit. **Note:** these may not exist in a fresh dev environment — the syntax check still runs, but the sim suite will skip silently.

## Mandatory pre-push gate

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

# 2. Server route syntax check (NEW this session — there are now serverless functions)
node --check /home/user/time-tracker/api/cron-reminders.mjs
node --check /home/user/time-tracker/api/ai/claude.mjs

# 3. Run sim tests if they exist
cd /tmp/dayos-check && for f in *-tests.mjs *-sim.mjs cal-test.mjs td-tests.mjs wr-tests.mjs tag-tests.mjs; do
  [ -f "$f" ] && (node "$f" >/dev/null 2>&1 && echo "$f ok" || echo "$f FAIL")
done | sort -u
```

**Static checks are necessary but NOT sufficient.** Multiple bugs this session passed static checks and broke at runtime. For anything touching the AI route or service worker: deploy preview + verify before declaring done.

## Branch flow + deploy (CRITICAL — read before touching Vercel)

- **`claude/*` → auto-merges to `main` → Vercel deploys.** Every commit ships.
- **Vercel deployment can silently fail** if `vercel.json` rejects a cron schedule (Hobby plan caps cron to daily). When deploys mysteriously stop, check Deployments tab in Vercel UI for the actual error. We got bitten by `*/30 * * * *` being rejected silently — burned half a day debugging.
- **`api/*.mjs` extension matters.** ES module syntax (`import` / `export default`) requires `.mjs` OR a `package.json` with `"type": "module"`. This project uses `.mjs`. Don't rename to `.js`.

## Recent work — what shipped, what's still being tested

Most of this session is on `main` and live. **Bold = user is still testing / hasn't given final approval.**

| Commit | What | User verified? |
|---|---|---|
| `74b16d9` | **AI: Task extraction in Daily Journal Tasks section** | **Pending** |
| `09048ef` | **Organize → Sonnet 4.6 + aggressive cutting prompt** | **Pending** |
| `9d70b09` | AI Organize on Thoughts + Reflection | Verified working |
| `09a8780` | AI extract: label history + activity splitting | Verified working |
| `3c27c5f` | AI: Activity log extraction (Sonnet) | Verified working |
| `420017c` | Trends calendar shows Daily Journal | Verified working |
| `2e5f282` | Trash: 7-day soft-delete recovery | Verified working |
| `71f3f5c` | Trash: multi-select + bulk actions | Verified working |
| `2f7fe1e` | Autosave on Sessions + Learning | Verified working |
| `7e73d7f` | Cron: 11:30pm IST daily push reminder | Working (Vercel cron registered) |
| `f851a47` | iOS PWA safe-area fix | Verified working after reinstall |
| `dbafa97` | Voice notes rollout to all entry types | Verified working |

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

## AI features — high-level (full detail in `docs/ai-features.md`)

- Server proxy at `api/ai/claude.mjs`. Three tasks: `extract-blocks`, `organize`, `extract-tasks`. All use Sonnet 4.6.
- Auth: Firebase ID token verified server-side via project public keys. No npm deps.
- Client: `aiCall(task, input, ctx)` helper in `index.html` — Firebase ID token in Authorization header.
- Cost ceiling: user set $5/mo Anthropic spend cap. ~$0.005/call on Sonnet. Plenty of headroom.
- All AI proposes; user confirms. Nothing auto-saves.

## Open items (in priority order)

1. **User is testing the three AI features.** Prompts will likely need tuning. Expect feedback on: over-cutting in Organize, missed/incorrect task extraction, label inconsistency in activity extraction.
2. **Next AI feature pending: Organize on Quick Notes + Project Notes.** Trivial extension; same backend, same UX. ~1h of work.
3. **Bigger AI features deferred:** Weekly/Monthly review summarizer, smart EOD prompts, semantic search, auto-tag suggestion, full Daily Journal generation, pattern detection → routine suggestion. User wanted to ship the smaller ones first and revisit these after a few days of using current features.
4. **Cross-device test pass** of everything since `2e5f282` (Trash + voice + AI) is still owed. User has been testing piecemeal but hasn't done a deliberate cross-device sweep.

## What NOT to do

- Don't speculate about sync bugs. Add diagnostic `console.log` first and ask the user to paste what their browser console says.
- Don't bundle "while I'm here" fixes into a feature commit. The user has caught this multiple times.
- Don't claim work is done because static tests passed. Wait for cross-device user confirmation when the change touches state.
- Don't push to `main` directly. Always work on the `claude/*` branch.
- Don't add the FCM/Whisper/transcription pipeline without explicit user request. We discussed it; user explicitly said skip — they have an external transcription tool.
- Don't change cron from daily to more frequent without explaining the Vercel Hobby plan limit (cron must be daily).

## How the user works

- Non-technical founder, learns by building. Push-back style is direct ("revert", "not so fast"). Plain English explanations win. Avoid jargon without a brief gloss.
- Prefers small focused commits. Will say "ship it" or "revert".
- Will explicitly say "push" when they want commits pushed (sometimes). For docs / small UI changes, just push — they've grown tired of asking. For destructive operations or things they want to preview, wait for explicit ok.
- Hits usage limits often. Plan work in increments small enough to commit + push before any risky chunk.

---

*Generated at end of session, June 2026. Pin this file at the start of the next session by reading it top to bottom. Then read `CLAUDE.md`, then `docs/sync-lessons.md`, then `docs/ai-features.md`, then `git log --oneline -25`. That's the onboarding.*
