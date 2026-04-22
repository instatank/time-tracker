# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Style

Before or after running any terminal command, always give a single plain-English sentence explaining what it does and why — assume the user has zero technical background.

## Project Overview

**DayOS** — a personal time intelligence and journaling PWA. Single-page app (`index.html`) deployed on Vercel at `https://time-tracker-7a7l.vercel.app`. No build step, no package manager, no framework.

- **Git repo:** `git@github.com:instatank/time-tracker.git`
- **Stack:** Vanilla JS (ES modules), Firebase (Auth + Firestore), Chart.js (CDN), Service Worker
- **Timezone:** All times are IST (`Asia/Kolkata`) — always use `nowIST()`, `nowISTIso()`, `todayStr()`, `capDateIST()` helpers, never `new Date()` directly

## Development Workflow

No build. Edit `index.html`, open it directly in browser, or push to `main` for Vercel to auto-deploy.

**Deploy to production:**
```bash
git add index.html
git commit -m "..."
git push origin main
```

**Claude branches** (`claude/*`) are auto-merged into `main` via GitHub Actions.

## Architecture

Everything lives in `index.html` in three sections:
1. `<style>` — all CSS (dark theme, CSS variables in `:root`)
2. `<body>` — static shell (`#hdr`, `#main`, `#nav`) + bottom-sheet modals (`<div class="sheet">`)
3. `<script type="module">` — all JS

### Data Model

Three localStorage keys (also synced to Firestore):
- `dayos_blocks_v1` — array of time blocks: `{ id, date, start_time, duration_min, category, label, note, energy_level, tags }`
- `dayos_captures_v1` — array of journal entries: `{ id, timestamp (IST ISO), type, body, project_tag, tags }`
- `dayos_ratings_v1` — object: `{ 'YYYY-MM-DD': 1–5 }`
- `dayos_dfts_v1` — object: `{ 'YYYY-MM-DD': { text, status } }` where status ∈ `pending | done | skipped`

**Block categories** (`CATS`): `deep_work`, `learning`, `practice`, `routine`, `leisure`, `leaks`
**Special categories** (not in `CATS`): `SLEEP_CAT` (auto-logged, hidden from Trends display), `SKIPPED_CAT` (computed, never stored)
**Capture types** (`CTYPES`): `note`, `journal`, `project`, `insight`

### Render Pattern

Fully re-renders on every state change. No virtual DOM, no diffing:
```
render() → renderHdr() + renderNav() + renderMain()
renderMain() → switch(activeTab) → renderToday() | renderJournal() | renderHistory() | renderDashboard()
```
All render functions return HTML strings and are injected via `innerHTML`. Sheet modals are static HTML toggled via `.open` class.

### Tags System

`extractTags(text)` parses `#hashtags` from body text → lowercased, space-stripped (e.g. `#Time Tracker` → `#timetracker`). Tags are stored on both blocks and captures at save time.

**Special tags**: `#dft`, `#win`, `#insight`, `#1%` — surface as filter pills in Journal.
**Project matching**: The Journal → Project filter includes any capture whose `tags` array contains `#<projectname>` (spaces stripped, lowercase), matched against the canonical project list (established by `type=project` captures).

### DFT (Daily Focus Task)

Stored separately in `dayos_dfts_v1`. Key states: `pending` → tick (→ `done`) or skip (→ `skipped`). Both `done` and `skipped` auto-create a journal capture with `#dft` tag. `sweepOldDfts()` runs on init and auto-skips any pending DFT from previous days. `clearDft()` resets today's DFT so a new one can be entered.

### Sleep Auto-logging

`autoLogSleep()` runs on init and after sync. It auto-logs an 8h sleep block (category `sleep`) for each day that doesn't already have one. Sleep is logged and synced but **excluded from all Trends display** — bar charts and Over Time chart never show it. "Skipped" hours in Trends are computed as `max(0, 16h − waking_logged)` (16 = 24 − 8 sleep).

### Firebase Sync

Firestore path: `users/{uid}/blocks/{id}`, `users/{uid}/captures/{id}`, `users/{uid}/ratings/{date}`

- `syncBlockDoc(b)` / `syncCaptureDoc(c)` — write individual docs after local save
- `initialSync(uid)` — on sign-in: merge local + remote (remote wins on same ID), then batch-write everything back
- `forcePushToCloud()` / `forcePullFromCloud()` — manual override controls in Account sheet

### Trends / Dashboard

- **Day view**: single date with ‹/› nav, bar chart + Day Score grid
- **Week/Month view**: bar chart (Totals) or line chart (Over Time), Metrics grid, Weekly Review
- `SKIPPED_CAT` is computed at render time, never stored
- Over Time chart uses Chart.js loaded lazily from CDN; instance stored in `_chartInstance` and destroyed before rebuild

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
