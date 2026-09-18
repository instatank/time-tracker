// Behavioural sim for the sleep window + sleep-block classifier.
//
// WHY THIS FILE EXISTS
// Until 2026-09-18 these were one idea: "a block that STARTS between 02:00
// and 10:00 is sleep". That quietly did two wrong things at once —
//   1. it hid every early-morning block from Today's Log, not just sleep, so
//      a 09:00 morning routine the user had deliberately configured as a
//      daily default never appeared anywhere;
//   2. the 02:00/10:00/16h numbers were hardcoded, so editing the sleep
//      template in Settings → Daily defaults changed nothing.
// Both failures are silent: the app renders happily, it just shows the wrong
// day. So they need a test, not a look.
//
// The split this pins:
//   isSleepBlock(b)        — is THIS block sleep? (hiding, waking-hour totals)
//   sleepWindow() & co.    — how much of the clock is sleep? (time math only)
//
// Extracts the REAL source out of index.html between the BEGIN/END
// sleep-window sentinels (same pattern as tests/feature-usage.mjs), so drift
// fails the gate. No browser, no network. `node tests/sleep-window.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const START = '// ── BEGIN sleep-window ──';
const END   = '// ── END sleep-window ──';
const i0 = html.indexOf(START);
const i1 = html.indexOf(END);
if (i0 === -1 || i1 === -1 || i1 < i0) {
  throw new Error('FAIL: could not find the sleep-window sentinels in index.html');
}
const src = html.slice(i0, i1);

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('ok   ' + msg); }
  else { console.log('FAIL ' + msg); failures++; }
}

// Build the real helpers against a controllable Daily-defaults config.
function build(templates) {
  const factory = new Function(
    '__cfg',
    'let defaultBlocksConfig = __cfg;\n' + src +
    '\nreturn { sleepTemplate, sleepWindow, sleepOverlapMin, wakingResumeMin,' +
    ' wakingTotalMin, isSleepBlock, hhmmToMin };'
  );
  return factory(templates === null ? null : { templates });
}

// The founder's actual setup, as described 2026-09-18: a night routine and a
// morning routine under Practice, and the sleep block under Routine.
const TPL_SLEEP   = { id: 'tpl-sleep',   enabled: true, start_time: '02:00', duration_min: 480, category: 'routine',  label: 'Sleep', isSleep: true };
const TPL_MORNING = { id: 'tpl-morning', enabled: true, start_time: '09:00', duration_min: 45,  category: 'practice', label: 'Morning routine' };
const TPL_NIGHT   = { id: 'tpl-night',   enabled: true, start_time: '00:30', duration_min: 60,  category: 'practice', label: 'Night routine' };
const REAL = [TPL_NIGHT, TPL_MORNING, TPL_SLEEP];

const blk = (tplId, start, dur, cat) => ({
  id: `default-${tplId}-2026-09-18`, date: '2026-09-18',
  start_time: start, duration_min: dur, category: cat, _default: true, _templateId: tplId,
});

// ── 1. The reported bug: only sleep is hidden ───────────────────────────────
{
  const a = build(REAL);
  ok(a.isSleepBlock(blk('tpl-sleep', '02:00', 480, 'routine')) === true,
     'the ticked sleep template\'s block IS sleep');
  ok(a.isSleepBlock(blk('tpl-morning', '09:00', 45, 'practice')) === false,
     'a 09:00 morning routine INSIDE the old 02:00–10:00 window is NOT sleep');
  ok(a.isSleepBlock(blk('tpl-night', '00:30', 60, 'practice')) === false,
     'a 00:30 night routine is NOT sleep');
  ok(a.isSleepBlock({ start_time: '05:30', duration_min: 300, category: 'deep_work' }) === false,
     'a 5h dawn deep-work session is NOT sleep');
  ok(a.isSleepBlock({ start_time: '07:00', duration_min: 30, category: 'routine' }) === false,
     'a short hand-logged routine inside the window is NOT sleep');
}

// ── 2. A default that is NOT the sleep one is never sleep ───────────────────
// Even when it looks exactly like sleep. An explicit tick beats a heuristic.
{
  const a = build([{ ...TPL_SLEEP, isSleep: false }, { id: 'tpl-x', enabled: true, start_time: '02:00', duration_min: 480, category: 'routine', label: 'Long thing', isSleep: true }]);
  ok(a.isSleepBlock(blk('tpl-sleep', '02:00', 480, 'routine')) === false,
     'an unticked 8h routine template is not sleep once another is ticked');
  ok(a.isSleepBlock(blk('tpl-x', '02:00', 480, 'routine')) === true,
     'the ticked one is');
}

// ── 3. Legacy data still reads as sleep ─────────────────────────────────────
{
  const a = build(REAL);
  ok(a.isSleepBlock({ start_time: '02:00', duration_min: 480, category: 'sleep' }) === true,
     "legacy category === 'sleep' blocks stay sleep");
  ok(a.isSleepBlock({ start_time: '02:00', duration_min: 480, category: 'routine' }) === true,
     'a hand-logged 8h Routine block inside the window is caught as legacy sleep');
  ok(a.isSleepBlock({ start_time: '02:00', duration_min: 180, category: 'routine' }) === false,
     'a 3h Routine block is under the legacy floor and shows');
}

// ── 4. The window is READ FROM SETTINGS, not hardcoded ──────────────────────
{
  const a = build(REAL);
  ok(a.sleepWindow().startMin === 120 && a.sleepWindow().durMin === 480,
     'window comes from the ticked template (02:00, 8h)');
  ok(a.wakingTotalMin() === 960, 'a waking day is 16h on an 8h sleep');

  // The founder edits sleep to 23:30 for 7h. Everything must move.
  const b = build([TPL_NIGHT, TPL_MORNING, { ...TPL_SLEEP, start_time: '23:30', duration_min: 420 }]);
  ok(b.sleepWindow().startMin === 1410 && b.sleepWindow().durMin === 420,
     'editing the template moves the window (23:30, 7h)');
  ok(b.wakingTotalMin() === 1020, 'a waking day is 17h on a 7h sleep');
  ok(b.sleepOverlapMin(0, 6 * 60) === 360,
     'a window crossing midnight covers 00:00–06:30 (6h of the first 6h)');
  ok(b.sleepOverlapMin(0, 24 * 60) === 420,
     'a wrapped window still totals exactly its duration across the day');
  ok(b.isSleepBlock({ ...blk('tpl-sleep', '23:30', 420, 'routine') }) === true,
     'the sleep block is still sleep after the edit');
}

// ── 5. Overlap + resume math (drives the "unlogged" gap bands) ──────────────
{
  const a = build(REAL);
  ok(a.sleepOverlapMin(60, 11 * 60) === 480, '01:00→11:00 contains the whole 8h window');
  ok(a.sleepOverlapMin(11 * 60, 13 * 60) === 0, '11:00→13:00 misses sleep entirely');
  ok(a.sleepOverlapMin(0, 3 * 60) === 60, '00:00→03:00 clips one hour of sleep');
  ok(a.sleepOverlapMin(5 * 60, 5 * 60) === 0, 'an empty span has no overlap');
  ok(a.wakingResumeMin(60, 13 * 60) === 600, 'waking resumes at 10:00 after a gap through sleep');
  ok(a.wakingResumeMin(11 * 60, 13 * 60) === 11 * 60, 'a gap that misses sleep resumes where it started');
}

// ── 6. No tick, or no config at all → safe fallback ─────────────────────────
// The fallback still gives the time math a window, but hides NOTHING beyond
// genuinely sleep-shaped blocks. Failing toward "shown" is the right direction.
{
  for (const [label, a] of [
    ['no template ticked', build([TPL_NIGHT, TPL_MORNING])],
    ['no config at all',   build(null)],
    ['empty template list', build([])],
  ]) {
    ok(a.sleepTemplate() === null, `${label}: no sleep template`);
    ok(a.sleepWindow().startMin === 120 && a.sleepWindow().durMin === 480,
       `${label}: falls back to 02:00 + 8h for time math`);
    ok(a.isSleepBlock(blk('tpl-morning', '09:00', 45, 'practice')) === false,
       `${label}: the morning routine still shows`);
    ok(a.isSleepBlock({ start_time: '06:00', duration_min: 60, category: 'routine' }) === false,
       `${label}: a 1h 06:00 routine still shows`);
  }
}

// ── 7. Junk in, no throw out ────────────────────────────────────────────────
{
  const a = build(REAL);
  ok(a.isSleepBlock(null) === false, 'null block is not sleep');
  ok(a.isSleepBlock(undefined) === false, 'undefined block is not sleep');
  ok(a.isSleepBlock({ category: 'routine', duration_min: 480 }) === false,
     'a block with no start_time is not caught by the legacy rule');
}

console.log('');
if (failures) { console.log(`sleep-window: ${failures} FAILED`); process.exit(1); }
console.log('sleep-window: all assertions passed');
