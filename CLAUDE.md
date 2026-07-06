# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Style

Before or after running any terminal command, always give a single plain-English sentence explaining what it does and why — assume the user has zero technical background.

## Project Overview

**DayOS** — a personal time intelligence and journaling PWA. Single-page app (`index.html`) deployed on Vercel at `https://time-tracker-7a7l.vercel.app`. No build step, no package manager, no framework for the app itself.

- **Git repo:** `git@github.com:instatank/time-tracker.git`
- **Stack:** Vanilla JS (ES modules), Firebase (Auth + Firestore + **Storage** + **Cloud Messaging**), Chart.js (CDN), Service Worker.
- **Serverless functions:** `api/*.mjs` — Vercel serverless routes (cron reminders + AI proxy). These DO use ES module syntax and run on Node, separate from the no-build front end.
- **Timezone:** All times are IST (`Asia/Kolkata`) — always use `nowIST()`, `nowISTIso()`, `todayStr()`, `capDateIST()`, `addDays()` helpers, never `new Date()` directly.

## Development Workflow

No build step for the app. Edit `index.html`, open it directly in browser, or push to `main` for Vercel to auto-deploy.

**Branch flow:** Work on `claude/*` branches → auto-merged into `main` via GitHub Actions → `main` deploys to Vercel. Every commit ships.

**Mandatory on every user-facing change:** bump the service-worker cache key `dayos-vN` in `sw.js`. Devices serve stale `index.html` otherwise. (Server-only `api/*.mjs` changes don't need a bump.)

**Pre-push gate:** run `bash scripts/check.sh` (extracts + syntax-checks the inline module, checks `api/**/*.mjs`, runs `tests/*.mjs` sims if present). The old `/tmp/dayos-check/` location is dead — those sims were unversioned and got lost with a fresh environment; behavioural sims now belong in `tests/`. The `/ship` skill runs this gate + the cache bump automatically — use it for every push.

## Shared playbook (cross-project — read at session start)

The single source of truth for global working rules, transferable lessons, and the ship / sync / deploy / verify SOPs lives in **`playbook/`** in this repo (`PLAYBOOK.md` first). It supersedes the old per-repo cheatsheets. Every session: read `playbook/PLAYBOOK.md`; before ending a session that shipped commits, run the **`/wrap`** skill (a Stop hook nudges once if forgotten) — it reconciles `docs/session-handoff.md` against reality, appends friction cards to `LEARNINGS.md`, and asks the founder the two learning questions from `playbook/LEARNING_METHOD.md`.

## Architecture

The front end lives entirely in `index.html` in three sections:
1. `<style>` — all CSS (dark + light theme, CSS variables in `:root`)
2. `<body>` — static shell (`#hdr`, `#main`, `#nav`) + bottom-sheet modals (`<div class="sheet">`)
3. `<script type="module">` — all front-end JS

Server-side code lives in `api/`:
- `api/cron-reminders.mjs` — daily push-notification cron (see Push Notifications)
- `api/ai/claude.mjs` — Anthropic proxy for all AI features (see `docs/ai-features.md`)

### Data Model

State lives in three places, in this order of truth: module-level `let` vars → `localStorage` → Firestore mirror. All localStorage keys are in the `SK` object near the top of the script. Current keys:

- `dayos_blocks_v1` — time blocks: `{ id, date, start_time, duration_min, category, label, note, energy_level, projectTag, tags, voiceNotes?, deletedAt?, _synced }`
- `dayos_captures_v1` — captures: `{ id, timestamp (IST ISO), type, body, project_tag, tags, voiceNotes?, attachments?, deletedAt?, _synced }`
- `dayos_daily_journal_v1` — Daily Journal entries (separate collection): `{ id (=date), date, thoughts, reflection, tasks[], entertainmentCap, tags, voiceNotes?, attachments?, deletedAt?, _synced }`
- `dayos_sessions_v1` — `{ [projectName]: Session[] }` where a Session is `{ id, projectName, date, before, during, after, durationMin, done[], pending[], learned[], tags, voiceNotes?, attachments?, linkedBlockId, createdAt, deletedAt?, _synced }`
- `dayos_learning_v1` — Learning entries: `{ id, sourceName, sourceType, takeaway, fullNotes, tags, voiceNotes?, attachments?, date, createdAt, deletedAt?, _synced }`
- `dayos_projects_v1` — canonical project name list
- `dayos_ratings_v1` — `{ 'YYYY-MM-DD': 1–5 }` (day star rating)
- `dayos_life_ratings_v1` — `{ 'YYYY-MM-DD': { metricId: 1–5 } }` (Daily Check-in)
- `dayos_eod_v1` — `{ 'YYYY-MM-DD': text }` (EOD review note)
- `dayos_dfts_v1` — `{ 'YYYY-MM-DD': { text, status } }` status ∈ `pending | done | skipped`
- `dayos_weekly_reviews_v1` / `dayos_monthly_reviews_v1` — structured review objects keyed by period; can carry an `aiSummary` string (see AI features)
- `dayos_tag_history_v1` — user's custom tag history
- `dayos_experiments_v1` — `{ [flagKey]: true }` opt-in feature flags. **Local-only / NOT synced** by design (so a half-baked experiment on phone never leaks to laptop). Surfaced in Settings → Experiments. See `docs/experiments.md`.
- `dayos_default_blocks_config_v1` — `{ templates: [{ id, enabled, start_time, duration_min, category, label, projectTag? }] }` user-defined daily auto-blocks (Settings → Daily defaults). Synced to `users/{uid}/meta/defaultBlocks`. The auto-creator runs at the top of every `renderToday` and uses deterministic block IDs (`default-{tplId}-{date}`) so two devices racing produce one Firestore document, not two.
- `dayos_default_blocks_skips_v1` — `{ 'YYYY-MM-DD': { templateId: 'deleted'|'manual' } }` per-day skip record. `'deleted'` = user deleted today's auto-block (deletion sticks). `'manual'` = user manually logged an equivalent block before auto-creator ran. Synced to `users/{uid}/meta/defaultBlockSkips`.
- `dayos_tombstones_*_v1` — hard-delete tombstones per collection (blocks/captures/sessions/learning/projects)

**Block categories** (`CATS`): `deep_work`, `learning`, `practice`, `routine`, `leisure`, `leaks`
**Special categories** (not in `CATS`): `SKIPPED_CAT` (computed, never stored). `SLEEP_CAT` still exists as a constant for rendering legacy sleep blocks, but **auto-sleep-logging was removed** — no new sleep blocks are created.
**Capture types** (`CTYPES`): `note` (Quick Note), `daily` (Daily Journal), `project` (Project Note). Legacy types `insight` + `journal` render gracefully via `LEGACY_CTYPES` but aren't offered in the picker.

### Render Pattern

Fully re-renders on every state change. No virtual DOM, no diffing:
```
render() → renderHdr() + renderNav() + renderMain()
renderMain() → switch(activeTab) → renderToday() | renderJournal() | renderProjects() | renderDashboard()
```
Tabs (`_VALID_TABS`): `today`, `journal`, `projects`, `dashboard` (labelled "Trends"). All render functions return HTML strings injected via `innerHTML`. Sheet modals are static HTML toggled via `.open` class. Inline `onclick="x()"` handlers require `window.x = …` — module-scope functions are invisible to inline handlers.

### Soft-delete + Trash

Entries (captures, daily journals, sessions, learning) and individual voice notes are **soft-deleted**: tapping × stamps `deletedAt: ISO` rather than removing. Soft-deleted items are filtered out of every render via `notTrashed()` / `liveVoiceNotes()` but listed in **Settings → Trash** with restore + delete-forever (multi-select + bulk). A `sweepTrash()` on init + post-sign-in hard-deletes anything older than `TRASH_TTL_MS` (7 days). Hard-delete uses the existing tombstone+cloud-verify path.

### Voice notes

Recorded via `MediaRecorder`, uploaded to **Firebase Storage** at `users/{uid}/voice/{id}.{ext}`. Stored on the parent entry as a `voiceNotes[]` array: `{ id, url, storagePath, title, durationSec, createdAt, deletedAt? }`. Codec differs by platform (Safari `audio/mp4`, Chrome `audio/webm`). Recording is launched from the **unified attach menu** (see Attachments) — there are no longer separate "Add voice note" buttons; the live "Recording… tap to stop" row in the voice list stops + uploads. Available on Quick Note / Project Note / Daily Journal / Session / Learning + the Today page. Titles are searchable; playback shows a live elapsed-time indicator.

### Attachments (files)

Generic counterpart to voice notes, built on the **same** Storage + parent-embedded-array + soft-delete/trash/sync plumbing — so new modalities slot in by adding a `kind` without new sync code. Uploads (resumable, with progress, 25 MB client cap) go to **Firebase Storage** at `users/{uid}/attachments/{id}.{ext}` and persist on the parent as an `attachments[]` array: `{ id, kind ('file' | 'image'), url, storagePath, title, mime, size, ext, createdAt, deletedAt? }`. Added via the single **➕ Add voice, photo or file** button → `openAttachMenu(ctx)` overflow menu (a standalone overlay, NOT a `.sheet`, so it layers over an open entry sheet without `openSheet()` closing it). The menu offers **Voice note** (→ the per-context recording toggle), **Take photo** (`<input capture=environment>`), **Photo library** (`<input accept=image/*>`), and **Attach file** (any file). Images are downscaled + re-encoded to JPEG client-side via `compressImage()` (`createImageBitmap` with `imageOrientation:'from-image'` for EXIF; falls back to the original on decode failure, e.g. HEIC on non-Safari) and render as a thumbnail grid (`.attach-thumbs`); files render as rows. **Clipboard paste** of an image (`document` `paste` listener → `_activePasteCtx()` → `_processImageFile()`) works on any open entry sheet and the Today page. The **Today page** uses a `'home'` context: each add spins up a brand-new Quick Note capture carrying the single item (same default as the old quick-voice strip). Contexts: `capture` / `session` / `learning` / `daily` / `home`. Tapping opens the item; titles/filenames are searchable; soft-delete + Trash + 7-day sweep + `liveAttachments()` all mirror voice. Since `attachments[]` rides inside the parent doc, every sync path (per-write, `initialSync`, force push/pull) carries it for free. **Storage rules** live in `storage.rules` (deploy with `firebase deploy --only storage` — Vercel does not deploy them). Future modalities (drawing, location) remain deferred.

### Autosave

Daily Journal, Project Sessions, and Learning entries autosave (no Save button): debounced 30s on text, immediate on blur / pill taps / voice actions, flushed on modal close via `flushDailyJournalIfOpen()` / `flushSessionIfOpen()` / `flushLearningIfOpen()`. The "Cancel" button is now "Close". Quick Note / Project Note / Log Activity still use explicit Save.

### Tags System

`extractTags(text)` parses `#hashtags` → lowercased, space-stripped. Stored on blocks + captures + all entry types at save time. **Special tags**: `#dft`, `#win`, `#insight`, `#1%` — surface as filter pills in Journal. **Project matching**: a `tags` entry of `#<projectslug>` links an entry to a project; the canonical project list lives in `dayos_projects_v1`.

### DFT (Daily Focus Task)

Stored in `dayos_dfts_v1`. States: `pending` → tick (`done`) or skip (`skipped`). Both auto-create a journal capture with `#dft` tag. `sweepOldDfts()` auto-skips pending DFTs from previous days on init. The Today-page DFT control is an inline strip between the search icon and + button: single tap toggles the ✓/✕ actions, double tap edits.

### Experiments (local-only feature flags)

Opt-in previews of unfinished features. State lives in `experiments` (storage key `dayos_experiments_v1`), gated via `expEnabled(key)`. **Flags are local-only — deliberately NOT synced** so trying something on phone never leaks to laptop. Catalog lives in `EXPERIMENTS_CATALOG`; toggles render under Settings → Experiments via `openSettingsExperiments`. **House rules:** experiments must be read-only by default (no new fields/collections), have one injection site where possible, and graduate-or-kill within ~4 weeks to avoid dead branches. Every active flag is tracked in `docs/experiments.md` with its exact functions, CSS block, sheet, and wiring sites so removal is a checklist, not an archaeology dig. A feature that *needs* a new field or collection is NOT an experiment — it's a real architecture change and should be built as such (see Daily Defaults below for the canonical pattern).

### Daily defaults (auto-blocks) — duplicate-proof pattern

User-defined templates that auto-create a matching block every day. Configured in Settings → Daily defaults. The interesting engineering bit is **how it avoids duplicates across devices** — this is the canonical pattern to reuse for any future "auto-create something every day/period" feature, because the previous auto-sleep feature got this wrong and the user is allergic to duplicates.

Five overlapping defenses (any one alone would prevent duplicates; together they're structural):

1. **Deterministic block IDs**: `default-{templateId}-{YYYY-MM-DD}`. Same on every device. If phone + laptop race to create today's block, Firestore `setDoc` merges identical fields into one document. Local `blocks` is keyed by id so onSnapshot replays don't dupe either. This is the load-bearing defense.
2. **Skip-if-exists**: before creating, scan `blocks` for the deterministic id and bail if present.
3. **Skip-if-manual-fulfilled**: if the user already logged a block today with the same `start_time` + `label`, mark the template as fulfilled for that date in `defaultBlocksSkips[date][tplId] = 'manual'` so we never reconsider.
4. **Per-session latch**: `_defaultBlocksLastRunDate` module var gates the creator (`maybeCreateDefaultBlocksForToday`) to one pass per date per page session. Reset to `null` at the end of `initialSync` so a fresh sign-in gets one shot.
5. **Deletion sticks**: when `deleteBlock` removes a block with `_templateId` set, it records `defaultBlocksSkips[block.date][tplId] = 'deleted'` and syncs the skip. No device will re-create that block for that date, ever.

Auto-created blocks carry `_default: true` and `_templateId: <id>` flags. They're otherwise indistinguishable from manual blocks (editable, syncable, counted everywhere). Removing the feature later = delete `maybeCreateDefaultBlocksForToday` + its hook in `renderToday` + the `_templateId`-detection branch in `deleteBlock`. Existing auto-blocks stay as inert normal blocks — no migration needed.

### Firebase Sync

Firestore paths: `users/{uid}/{blocks|captures|sessions|learning|dailyJournal}/{id}`, plus `users/{uid}/meta/*`, `users/{uid}/devices/{deviceId}` (push tokens), and top-level `projectRefs/{uid}/...`.

- Per-write sync functions (`syncBlockDoc`, `syncCaptureDoc`, `syncSessionDoc`, `syncLearningDoc`, `syncDailyJournalDoc`) write after local save.
- `initialSync(uid)` on sign-in merges local + remote, then batch-writes back. Uses `onSnapshot` for live updates.
- `forcePushToCloud()` / `forcePullFromCloud()` — manual overrides in Settings.
- **New collection checklist:** per-write sync fn + `initialSync` + `forcePushToCloud` + `forcePullFromCloud` + tombstones + `_synced` flag. Miss any → silent cross-device data loss. See `docs/sync-lessons.md`.

### Trends / Dashboard

- **Calendar sub-tab**: pick a date → see that day's blocks + Daily Journal entry + captures + EOD + life ratings. The numbered grid doubles as a consistency heatmap — each day-with-data gets a `cal-dot-l0`–`l4` marker (neutral = data but no logged hours; red→orange→yellow→green by waking hours logged, via `hoursLevel()`), with a Less→More legend.
- **Charts sub-tab**: `view-toggle-prominent` switches Totals (bar chart) vs Over Time (line chart); both read a **calendar week/month period** from `getDashPeriod()`, walked backwards with `‹ / ›` (`shiftDashPeriod`, state in `dashPeriodOffset`) so the numbers line up exactly with Weekly/Monthly Review. Metric cards show a `metric-delta` chip vs the prior period.
- **Weekly/Monthly Review**: structured review screens with an **AI Summary** section (`renderReviewAiSummary` / `draftReviewSummary`) — see AI features.
- `SKIPPED_CAT` computed at render. Over Time chart uses Chart.js lazy-loaded from CDN; instance in `_chartInstance`, destroyed before rebuild.

### Anchored preview snippets

`anchoredPreview(text, needle, opts)` (used by Journal search, `#tag` filter pills, and Today's Wins panel, which always anchors on `#win`) locates the matched term inside a long entry and windows the collapsed preview around that line instead of always showing the first line, wrapping the match in `<mark class="hl">`. Falls back to a plain head-of-text preview when the needle isn't found (e.g. a tag added via the pill picker rather than typed inline).

### AI features

Four Claude-powered features, all server-proxied through `api/ai/claude.mjs`, all "AI proposes → user confirms": **activity-block extraction** (voice dump → time blocks), **organize** (tighten Thoughts/Reflection), **task extraction** (dump → Daily Journal tasks), **review summary** (`summarize-review`: week/month digest → editable narrative recap, stored as `aiSummary` on the review doc). Full architecture, prompts, auth, and tuning in **`docs/ai-features.md`**.

### Push notifications

Daily 11:30pm IST reminder. `api/cron-reminders.mjs` runs as a Vercel cron (declared in `vercel.json`), authenticates via `CRON_SECRET`, finds device tokens via a Firestore collection-group query, sends via FCM. Client registers tokens in **Settings → Notifications**. Vercel Hobby plan caps cron to **once daily** — don't use sub-daily schedules, they're silently rejected and block deploys.

### iOS PWA

Respects `env(safe-area-inset-*)` for status bar + home indicator. `apple-mobile-web-app-status-bar-style` is `default`. A JS shim stamps `.ios-pwa` on `<html>`/`<body>` in standalone mode, backing hardcoded fallback CSS with `!important`. Inputs are forced to ≥16px on touch to prevent iOS focus-zoom.

## Companion docs (read these too)

- `docs/session-handoff.md` — current branch state, what's shipped vs pending, open items. **Read at session start.**
- `docs/ai-features.md` — full AI architecture + prompt locations + tuning.
- `playbook/SOP-firebase-sync.md` — Firestore sync gotchas (shared playbook; `docs/sync-lessons.md` is a superseded stub).
- `docs/experiments.md` — per-flag tracker for everything under Settings → Experiments. Lists exact functions, CSS blocks, sheets, and wiring sites to delete when graduating or killing each experiment.
- `docs/dayos-sop.md` — the user's own plain-English founder-learnings doc.

## End of Session Learning Recap

When the user types the session recap commands, generate a session recap using this exact structure.
Keep it brief, plain English, no jargon without explanation.
The user is a non-technical founder learning by building — prioritize conceptual understanding over syntax.
**Scope: cover only what happened in this session — not the full project history or prior sessions.**

## Session Recap Commands

### wrap and teach
Generate a structured session recap covering only this session. Plain English only — no jargon without a brief explanation. User is a non-technical founder learning by building.

**SESSION WRAP — [date]**

**What we built**
- [2–4 bullets: what actually shipped today]

**Key concepts encountered**
- [concept]: [one plain-English sentence — what it is, why it matters]
- [repeat for 2–4 concepts max — only what was genuinely touched today]

**One thing worth remembering**
- [Single most transferable insight from this session]

**Friction point** *(only if something broke or took unexpectedly long)*
- [What it was and why]

---

### summarize learnings
3–5 bullet points covering only this session. What was built, what was learned. One line each. No headers, no padding.
