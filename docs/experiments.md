# Experiments — tracker + cleanup checklist

Local-only feature flags surfaced in **Settings → 🧪 Experiments**. Each flag is opt-in per device and **NOT synced** — turning one on on phone won't affect laptop. Default OFF.

This doc exists so when a feature graduates (becomes permanent) or gets killed, the cleanup is mechanical: each row below names the exact symbols + files to delete, so you can grep-and-go.

---

## How to graduate an experiment (= make it permanent)

1. Remove its row from `EXPERIMENTS_CATALOG` in `index.html`.
2. Replace every `${expEnabled('<key>') ? ... : ''}` site with the unconditional render call.
3. (If applicable) Remove the experimental-only CSS block's "(experiment)" label.
4. Delete this row from the table below.
5. Bump SW cache (`sw.js` → `dayos-vN+1`).

## How to kill an experiment

1. Remove its row from `EXPERIMENTS_CATALOG`.
2. Delete every `expEnabled('<key>') ? renderX() : ''` site.
3. Delete the render function(s) + helpers listed below.
4. Delete the CSS block.
5. Delete any new sheets / supporting HTML.
6. Delete this row from the table below.
7. Bump SW cache.

Each cleanup should be 5–15 minutes and confined to `index.html` (+ sometimes one sheet block).

---

## Active experiments

| Key | Label | Touches data? | Render fn(s) | CSS block | HTML | Wired in |
|---|---|---|---|---|---|---|
| `timeline` | Day Timeline | **No** (read-only) | `renderTodayTimeline`, `tlBlockHeight`, handler `toggleTimeline`, state `_timelineExpanded`, consts `TL_*` (uses shared time helpers — see note) | `/* Day Timeline (experiment) */` | — | `renderToday` (Today's Log section) |
| `heatmap` | Journal Heatmap | **No** (read-only) | `renderJournalHeatmap`, helper `_dayHasContent`, const `HEATMAP_DAYS` | `/* Journal Heatmap (experiment) */` | — | `renderJournal` (between row1 and row2) |
| `onthisday` | On This Day | **No** (read-only) | `renderOnThisDay`, helpers `_shiftByMonths` / `_otdSnippet`, const `OTD_INTERVALS` | `/* On This Day (experiment) */` | — | `renderToday` (below action row) |
| `capturebar` | Quick Capture Bar | **Yes** — writes `captures` via canonical save path | `renderQuickCaptureBar`, handler `onQuickCapKey`, save `saveQuickCaptureBarEntry` | `/* Quick Capture Bar (experiment) */` | — | `renderToday` (below action row, above OTD) |
| `threeAdd` | 3-Button Add Bar | **No** (just routes to existing dispatchAdd) | `renderThreeAddBar`, `openNotePicker` | `/* 3-Button Add Bar (experiment) */` | `<div id="sheet-note-picker">` | `renderToday` — own row below action row (action row + stays untouched) |
| `longPressAdd` | Long-Press + | **No** (just routes to existing entry points) | `renderLongPressAddBtn`, `renderTodayAddControl`, handlers `lpAddDown` / `lpAddUp` / `lpAddCancel`, const `LONG_PRESS_MS`, state `_lpAddTimer` / `_lpAddFired` | `/* Long-Press + (experiment) */` | — | `renderToday` action row (replaces the `+`'s gesture handling) |
| `daybar` | Day Ratio Bar | **No** (read-only) | `renderDayRatioBar`, handler `toggleDaybarExpanded`, state `_daybarExpanded` (uses shared time helpers — see note) | `/* Day Ratio Bar (experiment) */` | — | `renderToday` (between Day Score and Wins) |

> **Shared time helpers:** `timeline` and `daybar` both depend on the "Shared time-math + sleep-window helpers" block above `renderDayRatioBar` — `hhmmToMin`, `minToHHMM`, `fmtMins`, `_nowMinutesIST`, `isSleepWindowBlock`, `elapsedWakingMin`, and consts `SLEEP_WINDOW_START_MIN` / `SLEEP_WINDOW_END_MIN` / `WAKING_TOTAL_MIN`. If you kill **both** experiments, delete that block too; if you kill only one, leave it.

> **Data-touching experiments are flagged in bold.** These leave normal entries behind on disk even after removal — that's intentional (entries the user created via the experiment should survive cleanup). What needs deleting is just the *entry surface*, not the data.

---

## Shared experiment infrastructure (keep these — they're the platform)

- `SK.EXPERIMENTS` localStorage key (`dayos_experiments_v1`)
- `experiments` state + `expEnabled(key)` helper
- `EXPERIMENTS_CATALOG` array
- `openSettingsExperiments` + `toggleExperiment` (Settings → Experiments section)
- `SETTINGS_SECTIONS` row for `experiments` + the `openSettingsSection` dispatch case

These cost ~30 lines total and are the substrate for all the experiments. Only delete them if you decide to drop the experiments mechanism entirely.

---

## Rules to keep this tidy

1. **Read-only by default.** New experiments should render existing data, not create new data shapes. If an experiment *needs* a new field or collection, raise it as a real architecture change — not a flag-gated try.
2. **One injection site per experiment** where possible. Two is OK; three means promote the helper to general code.
3. **No cross-experiment helpers.** If `experiment A`'s helper would be useful to `experiment B`, promote it out of A's block into the general helpers section first.
4. **Graduate or kill within ~4 weeks of building.** Long-lived flags accumulate dead branches in render functions.
