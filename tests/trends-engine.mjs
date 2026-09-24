// Behavioural sim for the Trends insight engine.
//
// WHY THIS FILE EXISTS
// The Trends tab, the Weekly Review and the Monthly Review all read one
// engine (teInsights / teKpis / teDrivers). Its failures are silent in the
// worst way: a wrong sentence renders just as confidently as a right one.
// "Best deep-work week in 9" on a week that wasn't, or "NaN% of your leaks",
// would erode trust in the whole screen. So every detector gets a planted
// pattern it must find, and a control it must stay quiet on.
//
// Extracts the REAL source between the BEGIN/END trends-engine sentinels in
// index.html, so drift fails the gate. No browser, no network.
// `node tests/trends-engine.mjs`
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const START = '// ── BEGIN trends-engine ──';
const END   = '// ── END trends-engine ──';
const i0 = html.indexOf(START), i1 = html.indexOf(END);
if (i0 === -1 || i1 === -1 || i1 < i0) throw new Error('FAIL: trends-engine sentinels not found in index.html');
const src = html.slice(i0, i1);
const E = new Function(src + '\nreturn { tePeriod, teRange, teKpis, teInsights, teDrivers, teDriverTargets, teHourProfile, teFmtH, teSeries };')();

let failures = 0;
function ok(cond, msg) { if (cond) console.log('ok   ' + msg); else { console.log('FAIL ' + msg); failures++; } }

// Deterministic PRNG so the sim is reproducible.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function add(d, n) { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10); }
function dow(d) { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); }

const TODAY = '2026-09-24';   // a Thursday
const WAKING = 16 * 60;

// A founder-shaped history: 16 weeks. Deep work 09:00–12:00 on weekdays (more
// on Tuesdays), leaks late at night, ratings that genuinely track deep work,
// a project that stops this week, a Check-in metric.
function makeCtx(opts = {}) {
  const R = rng(opts.seed || 7);
  const blocks = [], ratings = {}, life = {}, dfts = {}, winDates = [];
  let id = 0;
  const B = (date, start, dur, category, projectTag) => { const b = { id: 'b' + (id++), date, start_time: start, duration_min: dur, category, projectTag }; blocks.push(b); return b; };
  for (let d = add(TODAY, -7 * 16); d <= TODAY; d = add(d, 1)) {
    if (opts.skipDay && opts.skipDay(d)) continue;
    const wd = dow(d), weekday = wd >= 1 && wd <= 5;
    const isToday = d === TODAY;
    let deep = 0;
    if (weekday) {
      deep = (wd === 2 ? 180 : 90) + Math.round(R() * 60);
      if (opts.deepBoostThisWeek && d >= '2026-09-20') deep += 150;
      B(d, '09:00', deep, 'deep_work', !opts.stallProject || d < '2026-09-20' ? 'Alpha' : null);
    }
    if (isToday) continue;     // today only has the morning so far
    B(d, '07:00', 60, 'routine');
    B(d, '13:00', 60, 'learning');
    B(d, '15:00', 120, 'leisure');
    B(d, '22:00', 45 + Math.round(R() * 60), 'leaks');
    B(d, '02:00', 480, 'routine').sleep = true;
    ratings[d] = deep >= 150 ? 4 + (R() < 0.3 ? 1 : 0) : 2 + (R() < 0.4 ? 1 : 0);
    life[d] = { mindset: 3 + (R() < 0.5 ? 1 : 0) };
    dfts[d] = { text: 'ship it', status: R() < 0.7 ? 'done' : 'skipped' };
    if (R() < 0.3) winDates.push(d);
  }
  return {
    today: TODAY, blocks, isSleep: b => !!b.sleep, projectOf: b => b.projectTag || null,
    ratings, life, lifeLabel: k => k[0].toUpperCase() + k.slice(1), dfts, journals: [], journalDates: new Set(),
    winDates, adherence: null, wakingDayMin: WAKING, wakingMinToday: 6 * 60,
  };
}

const texts = res => res.items.map(i => i.text);
const noBadNumbers = arr => arr.every(t => !/NaN|undefined|Infinity|null/.test(t));

// ── Periods ──
{
  const w = E.tePeriod('week', 0, TODAY);
  ok(w.start === '2026-09-20' && w.fullEnd === '2026-09-26' && w.end === TODAY && w.isCurrent, 'current week is Sun 20 – Sat 26, clamped to today');
  const w1 = E.tePeriod('week', -1, TODAY);
  ok(w1.start === '2026-09-13' && w1.end === '2026-09-19' && !w1.isCurrent, 'previous week is whole');
  const m = E.tePeriod('month', 0, TODAY), m1 = E.tePeriod('month', -1, TODAY), m9 = E.tePeriod('month', -9, TODAY);
  ok(m.start === '2026-09-01' && m.end === TODAY && m.label === 'September 2026', 'current month');
  ok(m1.start === '2026-08-01' && m1.end === '2026-08-31', 'previous month is whole');
  ok(m9.ym === '2025-12', 'walking back across a year boundary');
}

// ── Hour profile spreads a block across the hours it covers ──
{
  const h = E.teHourProfile([{ start_time: '09:30', duration_min: 90, category: 'deep_work' }], 'deep_work');
  ok(h[9] === 30 && h[10] === 60 && h[11] === 0, '09:30 + 90m → 30m in the 9 o\'clock bin, 60m in the 10');
  const h2 = E.teHourProfile([{ start_time: '23:30', duration_min: 120, category: 'leaks' }]);
  ok(h2[23] === 30 && h2.reduce((a, b) => a + b, 0) === 30, 'a block past midnight is cut at 24:00, never wraps');
}

// ── A normal week: the planted patterns are found ──
{
  const ctx = makeCtx();
  const w1 = E.tePeriod('week', -1, TODAY);
  const res = E.teInsights(ctx, w1);
  const t = texts(res);
  console.log('     last week →\n       ' + t.join('\n       '));
  ok(noBadNumbers(t), 'no NaN / undefined / Infinity in any sentence');
  ok(t.some(x => /late at night/.test(x)), 'leaks are located late at night');
  ok(t.some(x => /clusters 9am–12pm/.test(x)), 'deep-work window found at 9am–12pm');
  ok(t.some(x => /Tuesdays are your strongest/.test(x)), 'Tuesday found as the strongest deep-work day');
  ok(t.some(x => /deep work/.test(x) && /★/.test(x)), 'the rating driver found is deep work');
  ok(!t.some(x => /Best deep-work|Lightest deep-work/.test(x)), 'an ordinary week is not called a record');
  ok(res.items.every((x, i, a) => i === 0 || a[i - 1].score >= x.score), 'items are ranked by score');
  ok(new Set(res.items.map(x => x.id)).size === res.items.length, 'one item per detector');
}

// ── A record week is called a record; a stalled project is flagged ──
{
  const ctx = makeCtx({ deepBoostThisWeek: true, stallProject: true });
  const w = E.tePeriod('week', 0, TODAY);
  const t = texts(E.teInsights(ctx, w));
  console.log('     this week (boosted, Alpha stalled) →\n       ' + t.join('\n       '));
  ok(t.some(x => /^Best deep-work week in \d+/.test(x)), 'record deep-work week detected');
  ok(t.some(x => /Nothing logged on Alpha/.test(x)), 'stalled project detected');
  ok(noBadNumbers(t), 'no bad numbers (partial current week)');
}

// ── Partial current week is compared per day, not as a raw total ──
{
  const ctx = makeCtx();
  const w = E.tePeriod('week', 0, TODAY);
  const t = texts(E.teInsights(ctx, w));
  ok(!t.some(x => /Deep work is down|Lightest deep-work/.test(x)), 'Thursday of a normal week is not reported as a deep-work drop');
}

// ── Sparse logging → coverage warning leads ──
{
  const ctx = makeCtx({ skipDay: d => d >= '2026-09-13' && d <= '2026-09-19' && dow(d) !== 2 });
  const res = E.teInsights(ctx, E.tePeriod('week', -1, TODAY));
  ok(res.items[0] && res.items[0].id === 'coverage' && res.items[0].tone === 'watch', 'a week with 1 of 7 days logged leads with the coverage warning');
  ok(/nothing at all on 6 days/.test(res.items[0].text), 'it names the missing days');
}

// ── Empty data never throws and says so plainly ──
{
  const ctx = { today: TODAY, blocks: [], isSleep: () => false, projectOf: () => null, ratings: {}, life: {}, dfts: {},
                journals: [], journalDates: new Set(), winDates: [], adherence: null, wakingDayMin: WAKING, wakingMinToday: 300 };
  const res = E.teInsights(ctx, E.tePeriod('week', 0, TODAY));
  ok(res.items.length === 1 && /Nothing logged/.test(res.items[0].text), 'empty week → one plain sentence');
  ok(E.teKpis(ctx, E.tePeriod('week', 0, TODAY)).length === 0, 'empty data → no KPI tiles (nothing shown as a fake 0)');
  // Default adherence rules exist even on a fresh install; an unlogged day
  // must not score them as failed (that showed "Adherence 0%" on no data).
  const ctxA = { ...ctx, _ix: undefined, adherence: () => ({ total: 2, passed: 0 }) };
  ok(!E.teKpis(ctxA, E.tePeriod('week', 0, TODAY)).some(k => k.id === 'adh'), 'adherence rules on unlogged days → no tile, not 0%');
  const drv = E.teDrivers(ctx);
  ok(drv.rows.length === 0 && drv.n === 0 && drv.need === 8, 'drivers report how many rated days are still needed');
  const m = E.teInsights(ctx, E.tePeriod('month', -3, TODAY));
  ok(Array.isArray(m.items), 'an old empty month renders without throwing');
}

// ── KPIs: baseline + per-day rate ──
{
  const ctx = makeCtx();
  const k = E.teKpis(ctx, E.tePeriod('week', -1, TODAY));
  const deep = k.find(x => x.id === 'deep');
  ok(deep && deep.spark.length === 8 && deep.base > 0, 'deep-work KPI has 8 sparkline points and a baseline');
  ok(Math.abs(deep.rate - deep.value / 7) < 1e-9, 'a whole past week\'s rate is total ÷ 7 waking days');
  ok(!k.some(x => x.id === 'adh'), 'adherence tile hidden when no rules exist (not shown as 0%)');
  const cur = E.teKpis(ctx, E.tePeriod('week', 0, TODAY)).find(x => x.id === 'deep');
  const r = E.teRange(ctx, '2026-09-20', TODAY);
  ok(Math.abs(r.dayEq - (4 + 6 / 16)) < 1e-9, 'today counts as the fraction of waking day elapsed (4.375 days)');
  ok(Math.abs(cur.rate - cur.value / r.dayEq) < 1e-9, 'current-week rate uses elapsed waking days');
}

// ── Drivers ──
{
  const ctx = makeCtx();
  const d = E.teDrivers(ctx, 'rating', 90);
  ok(d.rows.length > 0 && d.rows[0].id === 'deep' && d.rows[0].diff > 1, 'deep work is the top driver of the rating (planted)');
  ok(d.rows.every(r => r.nWith >= 3 && r.nWithout >= 3), 'every driver row has ≥3 days on each side');
  const tg = E.teDriverTargets(ctx);
  ok(tg[0].key === 'rating' && tg.some(t => t.key === 'mindset' && t.label === 'Mindset'), 'targets: day rating + Check-in metrics');
  // Days with no blocks logged are unknown, not "no deep work".
  const ctx2 = makeCtx({ skipDay: d => d < '2026-09-01' });
  ctx2.ratings['2026-08-15'] = 1; // rated, nothing logged
  const d2 = E.teDrivers(ctx2, 'rating', 90);
  const deepRow = d2.rows.find(r => r.id === 'deep');
  const logged = Object.keys(ctx2.ratings).filter(x => x >= '2026-06-27' && ctx2.blocks.some(b => b.date === x && !b.sleep)).length;
  ok(deepRow && deepRow.nWith + deepRow.nWithout === logged, 'an unlogged rated day is excluded from time-based drivers');
}

// ── Month view ──
{
  const ctx = makeCtx();
  const t = texts(E.teInsights(ctx, E.tePeriod('month', -1, TODAY)));
  console.log('     August →\n       ' + t.join('\n       '));
  ok(noBadNumbers(t) && t.length > 0, 'month read renders clean sentences');
}

// ── Performance at personal scale ──
{
  const ctx = makeCtx();
  const big = [];
  for (let i = 0; i < 5; i++) ctx.blocks.forEach(b => big.push({ ...b, id: b.id + '-' + i }));
  ctx.blocks = big;
  const t0 = performance.now();
  E.teInsights(ctx, E.tePeriod('month', 0, TODAY));
  E.teKpis(ctx, E.tePeriod('month', 0, TODAY));
  E.teDrivers(ctx);
  const ms = performance.now() - t0;
  ok(ms < 250, `month read over ${big.length} blocks in ${ms.toFixed(0)} ms (< 250)`);
}

if (failures) { console.log(`\n${failures} FAILED`); process.exit(1); }
console.log('\nall trends-engine checks passed');
