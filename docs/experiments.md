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

`Stage` is from `playbook/LIFECYCLE.md` §1.1. All three are **S1** — built, behind a
toggle, **off by default**. That matters more than it looks: §R4 says a feature at S1
**cannot be cut for non-use**, because off-by-default plus "you never used it" measures
discoverability and calls it value. To get a real verdict on any of these, the census has to
promote it to S2 (default on) first, or you switch it on and leave it on for the window.

| Key | Stage | Label | Touches data? | Render fn(s) | CSS block | HTML | Wired in |
|---|---|---|---|---|---|---|---|
| `onthisday` | S1 | On This Day | **No** (read-only) | `renderOnThisDay`, helpers `_shiftByMonths` / `_otdSnippet`, const `OTD_INTERVALS`. **Also uses the shared `_dayHasContent`** — do not delete that with this feature | `/* On This Day (optional feature: 'onthisday') */` | — | `renderToday` (below action row) |
| `threeAdd` | S1 | 3-Button Add Bar | **No** (routes to existing `dispatchAdd`) | `renderThreeAddBar`, `openNotePicker` | `/* 3-Button Add Bar (optional feature: 'threeAdd') */` | `<div id="sheet-note-picker">` | `renderToday` — own row below the action row (the `+` stays either way) |
| `daybar` | S1 | Day Ratio Bar | **No** (read-only) | `renderDayRatioBar`, handler `toggleDaybarExpanded`, state `_daybarExpanded` | `/* Day Ratio Bar (optional feature: 'daybar') */` | — | `renderToday` (between Day Score and Wins) |

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

## Birth certificates (retro-fitted 2026-09-06)

`playbook/LIFECYCLE.md` §R1 says: no birth certificate, no build. These three were built
before that rule existed, so their certificates are **retro-fitted** — which is exactly the
weak case the rule exists to prevent. A criterion written after you have the feature is one
you can bend to fit it. Read these as *proposals*, not as pre-registration, and treat the
first census that uses them as their real registration date.

> ⚠️ **Ankit — these `earns-its-place-if` lines are mine, not yours. Correct them.**
> They are deliberately specific numbers so they can be *wrong*, which is the point: a
> criterion you can't fail is not a criterion. If a number feels off, change it now, while
> nothing depends on it. Changing it after the first census reading is the move §R1 exists
> to stop.

### `onthisday` — On This Day

```
id:            onthisday
stage:         S1
built:         ≤ 2026-07-01 (earliest commit carrying it; history before that is squashed)
instrumented:  2026-09-06
one-liner:     Shows what you wrote 1 month / 6 months / 1 year ago on the Today page, tap to revisit.
earns-its-place-if:  ≥6 card taps in any 30-day window while the toggle is ON.
                     (≈ once every 5 days. Below that it is a strip of text you scroll past.)
exit-cost:     REVERSIBLE — render-only, reads existing entries, one injection site in renderToday.
touches-data:  no
review-on:     2026-10-06 (first census with a full 30 days of counting)
counter:       `onthisday`, incremented on the card tap (NOT on render — the strip
               renders on every Today visit, which would read as constant use).
```

### `threeAdd` — 3-Button Add Bar

```
id:            threeAdd
stage:         S1
built:         ≤ 2026-07-01
instrumented:  2026-09-06
one-liner:     A row of three direct buttons (Activity / Journal / Note) so the commonest entries open in one tap.
earns-its-place-if:  in a 30-day window with the toggle ON for the whole window,
                     `threeAdd` ≥ 2 × (`addpick-activity` + `addpick-note` + `addpick-session`).
                     i.e. it must carry the clear majority of adds. Its entire claim is
                     "saves you a tap versus the + picker", so the honest test is comparative,
                     not absolute — if the + still carries most adds, this is a second row of
                     buttons on the busiest screen buying nothing.
exit-cost:     REVERSIBLE — routes to the existing dispatchAdd; deleting it is a diff.
touches-data:  no
review-on:     2026-10-06
counter:       `threeAdd`, on any of the three buttons. Compare against the `addpick-*`
               baseline, which is why those were instrumented in the same pass.
```

### `daybar` — Day Ratio Bar

```
id:            daybar
stage:         S1
built:         ≤ 2026-07-01
instrumented:  2026-09-06
one-liner:     One stacked bar showing how the waking day so far split across categories. One glance, no scrolling.
earns-its-place-if:  ≥8 expands in a 30-day window with the toggle ON,
                     OR — switched OFF for the 7 days before a census — you notice it missing.
exit-cost:     REVERSIBLE — render-only. NOTE it shares the "time-math + sleep-window
               helpers" block with the (permanent) Day Timeline; that block stays either way.
touches-data:  no
review-on:     2026-10-06
counter:       `daybar`, on the expand/collapse tap.
```

> **⚠️ The `daybar` counter under-counts, on purpose, and the census must know it.**
> This feature's stated value is *a glance*. A glance leaves no trace in a browser, and the
> only trace-leaving act the bar offers is tapping it to expand — which is arguably the
> feature *failing* (the collapsed pill wasn't enough). So `daybar: 0` means "never
> expanded", **not** "never read", and it is not grounds for a non-use cut under §R4. That
> is why the criterion carries a second limb: switching it off for a week and seeing whether
> you miss it is a real experiment, costs nothing, and measures the thing the counter can't.
> A comment at `toggleDaybarExpanded` in `index.html` points back here.

---

## Usage counters (Phase 0, shipped 2026-09-06)

`playbook/LIFECYCLE.md` §R3. DayOS now counts its own use, so the monthly census reads
numbers instead of recall.

- **Storage:** `dayos_feature_usage_v1` = `{ [id]: { n, first, last } }`, IST ISO timestamps.
  `SK.FEATURE_USAGE`. **Local-only** — never synced, never in Firestore, never in the backup,
  never sent anywhere. Same reasoning as the toggles: no new collection, no sync-checklist
  entry, no third-party analytics (settled by `docs/security-audit.md`).
- **Call:** `noteUse(id, coalesceMs?)`. Wrapped in one swallowing try/catch — **a counter must
  never break a render.** Coalesced (default 700 ms) so one deliberate interaction is one
  count and one localStorage write; search passes 8 s so a typed query counts once, not once
  per keystroke. Exposed as `window.noteUse` because most call sites are inline `onclick`s.
- **Where:** at the act, never in a render function. Fenced as
  `// ── BEGIN feature-usage ──` / `// ── END feature-usage ──` in `index.html`.
- **Screen:** Settings → 🎛 Optional features → **Usage**. Read-only; it performs zero writes.
- **Test:** `tests/feature-usage.mjs` runs the real fenced source (not a copy) and pins the
  three things that would otherwise fail silently — it never throws, coalescing holds, and no
  render function calls it. It also traps every write path while rendering the Usage panel.

### What is instrumented

| Group | ids |
|---|---|
| Optional features | `onthisday` · `threeAdd` · `daybar` |
| Navigation | `nav-today` · `nav-journal` · `nav-projects` · `nav-dashboard` |
| Add picker (+) | `addpick-activity` · `addpick-note` · `addpick-session` |
| Search | `search` (a typed query) · `search-tagpill` |
| Daily Focus Task | `dft-strip` · `dft-resolve` |
| Reviews | `weekly-review` · `monthly-review` |
| AI | `ai-extract-blocks` · `ai-organize` · `ai-extract-tasks` · `ai-summarize-review` |
| Settings rows | `settings-<id>` for all 15 rows in `SETTINGS_SECTIONS` |

Everything outside the three toggles is **baseline**: it exists so a toggle's number has
something to be compared against. "`threeAdd` was used 12 times" says nothing on its own;
"12 against 60 through the + picker" is a verdict.

### What is deliberately NOT instrumented

- **Saving an entry** (block / capture / session / learning / journal). The records already
  are the count — `blocks.length` per day answers it exactly, and a counter would be a second,
  drift-prone copy of a number already on disk.
- **Long-press +**, the attach menu, voice notes, tag pills on cards, Trash restore, the
  Day Score tiles, Daily Check-in. All real surfaces; adding them would have made this pass a
  sweep instead of a baseline. They are cheap to add later, one line each.
- **Anything passive** — the Day Ratio Bar glance, reading the timeline, seeing a banner.
  Not measurable client-side without tracking attention, which is not a thing this app does.

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

**Usage-counter infrastructure (keep — it's the measuring device):**

- `SK.FEATURE_USAGE` (`dayos_feature_usage_v1`), `featureUsage` state, `_usageLastAt`,
  `USAGE_COALESCE_MS`, `noteUse()` + `window.noteUse` — between the
  `// ── BEGIN feature-usage ──` / `// ── END feature-usage ──` sentinels
- `USAGE_GROUPS` (display catalog, between the `usage-catalog` sentinels)
- `renderUsagePanel` / `_usageRowHtml` / `_usageAgo` (between the `usage-panel` sentinels)
  + the `.usage-*` CSS block
- `tests/feature-usage.mjs`
- Every `noteUse('…')` call site — `grep -n "noteUse(" index.html`

Deleting the counters is a separate decision from deleting any feature, and it undoes
`playbook/LIFECYCLE.md` §R3. Don't take it out as collateral in a feature cut.

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
5. **Instrumented at the act, or it isn't shipped** (`LIFECYCLE.md` §R3). A new toggle gets a
   `noteUse('<its key>')` at its point of deliberate use in the same commit — never inside a
   render — plus a birth certificate above with a falsifiable `earns-its-place-if`. A toggle
   with no counter can only ever be cut on the *cost* argument, which means the census can
   never say anything about it.
