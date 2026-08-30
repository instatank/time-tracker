# Optional features — tracker + cleanup checklist

> **Renamed 2026-08-30** (was `Experiments`). The file keeps its name so old links
> still resolve; the *concept* changed. See "What changed" below.

Local-only toggles surfaced in **Settings → 🎛 Optional features**. Each is opt-in per
device and **NOT synced** — turning one on on phone won't affect laptop. Default OFF.

This doc exists so that when a feature is switched to always-on or removed, the cleanup is
mechanical: each row names the exact symbols + files to delete, so you can grep-and-go.

---

## What changed on 2026-08-30 (contraction pass)

These started as **experiments**: previews of unfinished work, on a graduate-or-kill clock.
That clock did its job — of six flags, two were killed and one graduated in a single pass.
The three that remain are **finished features the founder wants to switch on and off**, which
is a different thing from an experiment, so the framing changed with them:

| | Experiments (old) | Optional features (now) |
|---|---|---|
| What's in the list | unfinished previews | finished, self-contained features |
| Expiry | graduate or kill in ~4 weeks | none — a toggle can live indefinitely |
| Why it's a toggle | not ready for everyone | the founder wants it *some* of the time |

**A genuinely unfinished preview can still go here** — the list just isn't *for* that any
more, and anything parked here should still be resolved rather than left to rot.

**The localStorage key is still `dayos_experiments_v1`, deliberately.** Renaming it would
silently reset every toggle on every device — the exact data-orphaning failure the
contraction phase is meant to avoid. The key is an implementation detail; the label is what
the user sees. Same reason `SK.EXPERIMENTS` keeps its name.

**Open question, raised not assumed:** these toggles are local-only, which was right when
they were half-baked experiments (don't leak a broken preview to your other device). Now
that they're real preferences, it's arguably wrong — you'd probably want Day Ratio Bar on
in both places. Switching to synced means a new `users/{uid}/meta/*` doc and a place in the
sync checklist, so it's a real change, not a tweak. Not done.

---

## How to make a feature always-on (remove the toggle, keep the feature)

1. Remove its row from `FEATURE_TOGGLES` in `index.html`.
2. Replace every `${featureEnabled('<key>') ? ... : ''}` site with the unconditional call.
3. Drop any "(optional feature)" label from its CSS block comment.
4. Move its row to the **Removed from the toggle list** section below, saying which way it went.
5. Bump SW cache (`sw.js` → `dayos-vN+1`).

## How to delete a feature outright

1. Remove its row from `FEATURE_TOGGLES`.
2. Delete every `featureEnabled('<key>') ? renderX() : ''` site.
3. Delete the render function(s) + helpers listed below — **but grep each one first.** Two of
   the three 2026-08-30 deletions had a helper that another feature also used (see the
   Removed section); a delete-list in this doc is a starting point, not an authority.
4. Delete the CSS block.
5. Delete any sheets / supporting HTML.
6. Move its row to **Removed from the toggle list**, recording where anything shared went.
7. Bump SW cache.

---

## Active toggles

| Key | Label | Touches data? | Render fn(s) | CSS block | HTML | Wired in |
|---|---|---|---|---|---|---|
| `onthisday` | On This Day | **No** (read-only) | `renderOnThisDay`, helpers `_shiftByMonths` / `_otdSnippet`, const `OTD_INTERVALS`. **Also uses the shared `_dayHasContent`** — do not delete that with this feature | `/* On This Day (optional feature: 'onthisday') */` | — | `renderToday` (below action row) |
| `threeAdd` | 3-Button Add Bar | **No** (routes to existing `dispatchAdd`) | `renderThreeAddBar`, `openNotePicker` | `/* 3-Button Add Bar (optional feature: 'threeAdd') */` | `<div id="sheet-note-picker">` | `renderToday` — own row below the action row (the `+` stays either way) |
| `daybar` | Day Ratio Bar | **No** (read-only) | `renderDayRatioBar`, handler `toggleDaybarExpanded`, state `_daybarExpanded` | `/* Day Ratio Bar (optional feature: 'daybar') */` | — | `renderToday` (between Day Score and Wins) |

> **Known inconsistency, not yet fixed:** `threeAdd`'s `sheet-note-picker` still lists Quick
> Note / Project Note / Project Session / Learning as four separate rows — the arrangement the
> main add picker moved away from on 2026-08-30 (it now has three rows, with the choice made
> by pills inside each sheet). If `threeAdd` ever comes on for real, that sheet should follow
> the same collapse.

> **Shared time helpers:** the Day Timeline (default) and `daybar` both depend on the "Shared
> time-math + sleep-window helpers" block above `renderDayRatioBar` — `hhmmToMin`,
> `minToHHMM`, `fmtMins`, `_nowMinutesIST`, `isSleepWindowBlock`, `elapsedWakingMin`, and
> consts `SLEEP_WINDOW_START_MIN` / `SLEEP_WINDOW_END_MIN` / `WAKING_TOTAL_MIN`. The timeline
> is permanent, so this block stays regardless of `daybar`.

---

## Removed from the toggle list

Kept for traceability — so a future session doesn't rebuild something that was tried and
rejected, or hunt for a symbol that moved.

- **`classicLog` — Classic Activity Log · DELETED 2026-08-30.** Tested; the vertical timeline
  is what the founder wants. The `expEnabled('classicLog')` branch in `renderToday` is gone
  and `renderTodayTimeline(bks)` is unconditional. Its paging state went with it
  (`todayBksExpanded`, `window.toggleTodayBks`, and the `visBks`/`moreBks` locals).
  ⚠️ **`renderBlock` was NOT deleted** despite being this flag's render function — Trends →
  Calendar renders a day's blocks as those same stacked cards. A note at the definition says
  so.
- **`heatmap` — Journal Heatmap · DELETED 2026-08-30.** Tested; not wanted. Removed:
  `renderJournalHeatmap`, `HEATMAP_DAYS`, the injection in `renderJournal`, and the
  `.heatmap-strip` / `.heatmap-cell` CSS block.
  ⚠️ **`_dayHasContent` was NOT deleted** — On This Day calls it. It was promoted out of the
  heatmap block into general helper code, with a comment recording where it came from. (This
  is rule 3 below having been broken when the heatmap was built.)
- **`longPressAdd` — Long-Press + · NOW ALWAYS ON 2026-08-30.** `renderAddControl` no longer
  branches; it just returns `renderLongPressAddBtn(extraStyle)`, and the plain-tap fallback
  button is gone. `renderLongPressAddBtn`, `longPressAddAction`, `LP_ADD_LABELS`,
  `LONG_PRESS_MS` and the `lpAdd*` handlers are all unconditional. Long press targets the
  page's own entry: Daily Journal on Today/Journal, Project Session or Learning on Projects
  (by sub-tab).
- **`capturebar` — Quick Capture Bar · became always-on** when the DFT moved into the Daily
  Journal modal; the bar lives permanently in the Today action row.
- **`timeline` — Day Timeline · became always-on**, the default Today's Log view.
  `renderTodayTimeline` / `tlBlockHeight` / `toggleTimeline` / `_timelineExpanded` / `TL_*`
  are unconditional; rows reuse the shared card-swipe mechanism and the
  `tlBlockDown`/`Move`/`Up`/`Cancel` long-press-to-edit handlers.

---

## Shared toggle infrastructure (keep — it's the platform)

- `SK.EXPERIMENTS` localStorage key (`dayos_experiments_v1` — name retained on purpose, above)
- `featureToggles` state + `featureEnabled(key)` helper
- `FEATURE_TOGGLES` array
- `openSettingsFeatures` + `toggleFeature` (Settings → Optional features)
- `SETTINGS_SECTIONS` row for `features` + the `openSettingsSection` dispatch case

~30 lines total. Only delete if you drop switchable features entirely.

---

## Rules to keep this tidy

1. **Read-only by default.** A toggle should render existing data, not create new data
   shapes. If it *needs* a new field or collection, that's a real architecture change — not a
   flag-gated try. (See Daily Defaults in `CLAUDE.md` for how a real one is built.)
2. **One injection site where possible.** Two is OK; three means promote the helper to
   general code.
3. **No cross-feature helpers.** If A's helper would be useful to B, promote it out of A's
   block into general helpers *first*. Breaking this is what made the heatmap deletion
   riskier than it should have been — `_dayHasContent` was sitting inside the heatmap block
   while On This Day quietly depended on it.
4. **Every toggle is a permanent second code path.** That's the standing cost. Three is a
   reasonable number; six was not.
