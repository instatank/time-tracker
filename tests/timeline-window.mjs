// Behavioural sim for Today's Log collapse window.
//
// WHY THIS FILE EXISTS
// Until 2026-09-20 the collapsed view was "the 4h ending at the LATEST
// block's end". On a day you only log as you go, that is indistinguishable
// from "the last 4 hours". The moment a block exists in the future it is
// not: a night routine at 22:00 pulled the window to 18:00–22:00, so at
// 11:00 the log showed tonight and hid everything the user had actually
// done that morning. The failure is silent — the app renders happily, it
// just shows the wrong part of the day — so it needs a test, not a look.
//
// What this pins: the window is anchored to WALL-CLOCK NOW (last 3h + next
// 2h), the hidden count is independent of the expand state, and the list is
// never empty.
//
// Extracts the REAL source out of index.html between the BEGIN/END
// timeline-window sentinels (same pattern as tests/sleep-window.mjs), so
// drift fails the gate. No browser, no network. `node tests/timeline-window.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const START = '// ── BEGIN timeline-window ──';
const END   = '// ── END timeline-window ──';
const i0 = html.indexOf(START);
const i1 = html.indexOf(END);
if (i0 === -1 || i1 === -1 || i1 < i0) {
  throw new Error('FAIL: could not find the timeline-window sentinels in index.html');
}
const src = html.slice(i0, i1);

// hhmmToMin lives in the sleep-window fence; inject it rather than duplicate
// the fence, so this test still runs the real windowing code.
const { timelineWindow, TL_LOOKBACK_MIN, TL_LOOKAHEAD_MIN } = new Function(
  'hhmmToMin',
  src + '\nreturn { timelineWindow, TL_LOOKBACK_MIN, TL_LOOKAHEAD_MIN };'
)((t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); });

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log('ok   ' + msg);
  else { console.log('FAIL ' + msg); failures++; }
}

const at = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const blk = (id, start_time, duration_min) => ({ id, start_time, duration_min });
const ids = (bs) => bs.map(b => b.id).join(',');

// ── The reported bug, exactly as described ────────────────────
// 11:00. Morning work logged from 07:00. A night routine sits at 22:00.
// Old behaviour: window = 18:00–22:00 → only the night routine showed.
{
  const day = [
    blk('a', '06:00', 60),   // 06:00–07:00 — ends before 08:00, out
    blk('b', '07:30', 60),   // 07:30–08:30 — in
    blk('c', '09:00', 90),   // 09:00–10:30 — in
    blk('d', '10:45', 30),   // 10:45–11:15 — in (spans now)
    blk('e', '22:00', 45),   // tonight — far future, out
  ];
  const { visible, hiddenCount } = timelineWindow(day, at('11:00'));
  ok(ids(visible) === 'b,c,d', 'at 11:00 shows the morning, not tonight — got ' + ids(visible));
  ok(!visible.some(b => b.id === 'e'), '22:00 night routine is hidden at 11:00');
  ok(hiddenCount === 2, 'hidden count counts both the 06:00 block and tonight — got ' + hiddenCount);
}

// ── Lookback boundary is end-based ────────────────────────────
{
  const now = at('11:00');
  // Ends exactly at the boundary (08:00) → out. One minute later → in.
  ok(timelineWindow([blk('x', '07:00', 60)], now).visible.length === 1,
     'sole block is never dropped even when it falls outside the window');
  const day = [blk('x', '07:00', 60), blk('y', '10:00', 30)];
  ok(ids(timelineWindow(day, now).visible) === 'y', 'block ending exactly at now−3h is out');
  const day2 = [blk('x', '07:01', 60), blk('y', '10:00', 30)];
  ok(ids(timelineWindow(day2, now).visible) === 'x,y', 'block ending one minute inside is in');
}

// ── A long block you're still inside stays visible ────────────
{
  // 06:00–12:00 deep work, now 11:00. Starts 5h ago (outside the lookback)
  // but has not ended, so end-based selection keeps it on screen.
  const { visible } = timelineWindow([blk('deep', '06:00', 360)], at('11:00'));
  ok(ids(visible) === 'deep', 'a 6h block you are still inside stays visible');
}

// ── Lookahead boundary is start-based ─────────────────────────
{
  const now = at('11:00'); // lookahead ends 13:00
  const day = [blk('n', '10:30', 30), blk('soon', '12:30', 60), blk('later', '13:00', 60)];
  const { visible } = timelineWindow(day, now);
  ok(ids(visible) === 'n,soon', 'next 2h shows, a block starting exactly at now+2h does not — got ' + ids(visible));
  // A long block starting beyond the lookahead must not leak in via its end.
  const day2 = [blk('n', '10:30', 30), blk('evening', '18:00', 300)];
  ok(ids(timelineWindow(day2, now).visible) === 'n', 'a long evening block does not leak in');
}

// ── Never empty ───────────────────────────────────────────────
{
  // Quiet stretch: last thing was 06:00, nothing due until tonight.
  const day = [blk('a', '05:00', 30), blk('b', '06:00', 30), blk('c', '22:00', 30)];
  const { visible, hiddenCount } = timelineWindow(day, at('11:00'));
  ok(ids(visible) === 'b', 'with nothing in the window, the most recent past block shows');
  ok(hiddenCount === 2, 'the rest stays behind the toggle — got ' + hiddenCount);
}
{
  // Early morning, whole day still ahead (daily defaults already created).
  const day = [blk('a', '09:00', 45), blk('b', '14:00', 60)];
  const { visible, hiddenCount } = timelineWindow(day, at('00:30'));
  ok(ids(visible) === 'a', 'with the whole day ahead, the first upcoming block shows');
  ok(hiddenCount === 1, 'and the rest is hidden — got ' + hiddenCount);
}
{
  const { visible, hiddenCount } = timelineWindow([], at('11:00'));
  ok(visible.length === 0 && hiddenCount === 0, 'an empty day produces no rows and no toggle');
}

// ── The window constants are the ones the founder asked for ───
ok(TL_LOOKBACK_MIN === 180, 'lookback is 3h');
ok(TL_LOOKAHEAD_MIN === 120, 'lookahead is 2h');

// ── The anchor is NOW, not the latest block ───────────────────
// Same day, two different clock readings → different windows. Under the old
// latest-block anchor these two would be identical.
{
  const day = [blk('m', '08:00', 60), blk('e', '20:00', 60)];
  const a = ids(timelineWindow(day, at('09:00')).visible);
  const b = ids(timelineWindow(day, at('20:30')).visible);
  ok(a === 'm' && b === 'e', 'the same day windows differently at 09:00 vs 20:30 — got ' + a + ' / ' + b);
}

// ── The render path must not re-anchor on expand ──────────────
// hiddenCount is computed from the window alone, so "↑ show less" survives.
{
  const day = [blk('a', '06:00', 30), blk('b', '10:30', 30)];
  const first  = timelineWindow(day, at('11:00'));
  const second = timelineWindow(day, at('11:00'));
  ok(first.hiddenCount === second.hiddenCount && first.hiddenCount === 1,
     'hidden count is stable across calls, so the collapse toggle never vanishes');
}

console.log(failures ? `\n${failures} failure(s)` : '\nall ok');
process.exit(failures ? 1 : 0);
