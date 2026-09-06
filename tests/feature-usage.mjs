// Behavioural sim for the feature-usage counters (playbook/LIFECYCLE.md §R3,
// Phase 0).
//
// WHY THIS FILE EXISTS
// The counters are a measuring device, and a measuring device has exactly two
// ways to fail badly:
//   1. It breaks the thing it measures. `noteUse` runs inside click handlers
//      all over index.html; if it can throw, a full localStorage quota or a
//      Safari private-mode block takes a render down with it. Rule: it must
//      NEVER throw, whatever happens underneath.
//   2. It lies. Coalescing is what turns "typed a 12-character query" into one
//      use rather than twelve, so if it stops working the census reads a
//      number that means nothing.
// Both are invisible in normal use — the app looks fine either way — which is
// exactly the kind of failure that needs a test rather than a look.
//
// Extracts the REAL source out of index.html between the BEGIN/END
// feature-usage sentinels (same pattern as tests/security-detector.mjs), so
// drift fails the gate. No browser, no network. `node tests/feature-usage.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const START = '// ── BEGIN feature-usage ──';
const END   = '// ── END feature-usage ──';
const i0 = html.indexOf(START);
const i1 = html.indexOf(END);
if (i0 === -1 || i1 === -1 || i1 < i0) {
  throw new Error('FAIL: could not find the feature-usage sentinels in index.html');
}
const usageSrc = html.slice(i0, i1);

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('ok   ' + msg); }
  else { console.log('FAIL ' + msg); failures++; }
}

// Build a fresh instance of the real code with a controllable environment:
// a fake clock (so coalescing is testable without sleeping), a fake
// nowISTIso, and a saveLocal we can watch or sabotage.
function makeCounter({ saveImpl, startingUsage } = {}) {
  const state = { now: 1_000_000, iso: '2026-09-06T10:00:00+05:30', writes: 0, saved: null };
  const env = {
    SK: { FEATURE_USAGE: 'dayos_feature_usage_v1' },
    featureUsage: startingUsage || {},
    Date: { now: () => state.now },
    nowISTIso: () => state.iso,
    saveLocal: (key, val) => {
      state.writes++;
      state.saved = { key, val: JSON.parse(JSON.stringify(val)) };
      if (saveImpl) saveImpl(key, val);
    },
  };
  const factory = new Function(
    'SK', 'nowISTIso', 'saveLocal', 'Date', '__seed',
    'let featureUsage = __seed;\n' + usageSrc +
    '\nreturn { noteUse, read: () => featureUsage, consts: { USAGE_COALESCE_MS } };'
  );
  const api = factory(env.SK, env.nowISTIso, env.saveLocal, env.Date, env.featureUsage);
  return { ...api, state };
}

// ── 1. Shape: { n, first, last } keyed by id ────────────────────────────────
{
  const c = makeCounter();
  c.state.iso = '2026-09-06T10:00:00+05:30';
  c.noteUse('daybar');
  const rec = c.read()['daybar'];
  ok(!!rec, 'records an id on first use');
  ok(rec.n === 1, 'n starts at 1');
  ok(rec.first === '2026-09-06T10:00:00+05:30', 'first is stamped on creation');
  ok(rec.last === '2026-09-06T10:00:00+05:30', 'last is stamped on creation');
  ok(c.state.saved.key === 'dayos_feature_usage_v1', 'writes to the local-only key');
}

// ── 2. first never moves; last always does ──────────────────────────────────
{
  const c = makeCounter();
  c.state.iso = '2026-09-01T08:00:00+05:30';
  c.noteUse('search');
  c.state.now += 60_000;
  c.state.iso = '2026-09-06T21:00:00+05:30';
  c.noteUse('search');
  const rec = c.read()['search'];
  ok(rec.n === 2, 'a second separate use increments n');
  ok(rec.first === '2026-09-01T08:00:00+05:30', 'first stays at the earliest use');
  ok(rec.last === '2026-09-06T21:00:00+05:30', 'last moves to the most recent use');
}

// ── 3. Coalescing: one interaction, one count, one WRITE ────────────────────
// The write count matters as much as the use count: LIFECYCLE.md §R3 asks for
// one localStorage write per interaction, not one per keystroke.
{
  const c = makeCounter();
  const before = c.state.writes;
  for (let i = 0; i < 12; i++) { c.noteUse('search', 8000); c.state.now += 120; } // typing
  ok(c.read()['search'].n === 1, 'twelve keystrokes inside the window count as one use');
  ok(c.state.writes - before === 1, 'twelve keystrokes cause exactly one localStorage write');

  c.state.now += 8001; // long pause — a genuinely new search
  c.noteUse('search', 8000);
  ok(c.read()['search'].n === 2, 'a use after the window is counted separately');
}

// ── 4. The default window swallows a double-fire, not a real second tap ─────
{
  const c = makeCounter();
  ok(c.consts.USAGE_COALESCE_MS === 700, 'default coalesce window is 700ms');
  c.noteUse('dft-strip');
  c.state.now += 200;           // the second tap of a double-tap dispatcher
  c.noteUse('dft-strip');
  ok(c.read()['dft-strip'].n === 1, 'a double-tap counts once');
  c.state.now += 5_000;         // going back to it later
  c.noteUse('dft-strip');
  ok(c.read()['dft-strip'].n === 2, 'a deliberate later tap counts again');
}

// ── 5. Ids are independent ──────────────────────────────────────────────────
{
  const c = makeCounter();
  c.noteUse('nav-today');
  c.noteUse('nav-journal');   // same instant, different id — must not be swallowed
  ok(c.read()['nav-today'].n === 1 && c.read()['nav-journal'].n === 1,
     'coalescing is per-id, not global');
}

// ── 6. IT MUST NEVER THROW. This is the one that protects the app. ──────────
{
  // localStorage full / blocked (Safari private mode) — the real failure.
  const c = makeCounter({ saveImpl: () => { throw new Error('QuotaExceededError'); } });
  let threw = false;
  try { c.noteUse('daybar'); } catch { threw = true; }
  ok(!threw, 'a failing saveLocal does not propagate — a counter never breaks a render');
}
{
  // A corrupt stored value (hand-edited, or a half-written key).
  const c = makeCounter({ startingUsage: null });
  let threw = false;
  try { c.noteUse('daybar'); } catch { threw = true; }
  ok(!threw, 'a null usage object does not throw');
  ok(c.read()['daybar'].n === 1, 'and it recovers by rebuilding the object');
}
{
  const c = makeCounter();
  let threw = false;
  try { c.noteUse(''); c.noteUse(null); c.noteUse(undefined); } catch { threw = true; }
  ok(!threw, 'an empty/missing id does not throw');
  ok(Object.keys(c.read()).length === 0, 'and records nothing');
}

// ── 7. Never synced: the key must not appear in any sync path ───────────────
// The counters are local-only by design (no new collection, no sync-checklist
// entry, no backup change). If someone later adds this key to a sync or backup
// list, that is a real decision and should fail here first.
{
  const key = 'dayos_feature_usage_v1';
  const syncFnNames = ['forcePushToCloud', 'forcePullFromCloud', 'initialSync'];
  let leaked = [];
  for (const fn of syncFnNames) {
    const i = html.indexOf('function ' + fn);
    const j = html.indexOf('\nasync function ', i + 10);
    const body = html.slice(i, i === -1 ? 0 : (j === -1 ? i + 12000 : j));
    if (body.includes(key) || body.includes('FEATURE_USAGE')) leaked.push(fn);
  }
  ok(leaked.length === 0, 'the usage key appears in no sync path' + (leaked.length ? ' (found in ' + leaked.join(', ') + ')' : ''));
  ok(!html.includes("BACKUP_COLLECTIONS") || !/BACKUP_COLLECTIONS[\s\S]{0,800}FEATURE_USAGE/.test(html),
     'the usage key is not in BACKUP_COLLECTIONS');
}

// ── 8. Instrumentation is at acts, not renders ─────────────────────────────
// The single easiest way to ruin these numbers is a noteUse() inside a render
// function — it would count a re-render as a use and the census would read
// noise. Checked structurally rather than by eye.
{
  const renderFns = ['function renderToday(', 'function renderJournal(',
                     'function renderProjects(', 'function renderDashboard(',
                     'function renderOnThisDay(', 'function renderDayRatioBar(',
                     'function renderThreeAddBar(', 'function renderNav('];
  const offenders = [];
  for (const sig of renderFns) {
    const i = html.indexOf(sig);
    if (i === -1) continue;
    const j = html.indexOf('\nfunction ', i + 10);
    const body = html.slice(i, j === -1 ? i + 20000 : j);
    // An inline onclick="noteUse(...)" inside a render STRING is fine — that's
    // a handler, it fires on tap. A bare call is not.
    const bare = body.split('\n').filter(l =>
      /(^|[^"'\w.])noteUse\s*\(/.test(l) && !/onclick=/.test(l));
    if (bare.length) offenders.push(sig + ' -> ' + bare[0].trim().slice(0, 60));
  }
  ok(offenders.length === 0,
     'no render function calls noteUse() outside an onclick handler' +
     (offenders.length ? ': ' + offenders.join(' | ') : ''));
}

// ── 9. The Usage panel renders, and writes NOTHING ─────────────────────────
// It is the screen the founder reads to see what the census will see, so a
// crash in it is silent (the sheet just shows the toggles) and a WRITE from it
// would corrupt the very numbers it exists to display.
{
  const grab = (a, b) => {
    const i = html.indexOf(a), j = html.indexOf(b);
    if (i === -1 || j === -1 || j < i) throw new Error('FAIL: missing sentinels ' + a);
    return html.slice(i, j);
  };
  const arr = (name) => {
    const i = html.indexOf('const ' + name + ' = [');
    const j = html.indexOf('\n];', i);
    if (i === -1 || j === -1) throw new Error('FAIL: could not extract ' + name);
    return html.slice(i, j + 3);
  };

  const src = [
    arr('SETTINGS_SECTIONS'),
    arr('FEATURE_TOGGLES'),
    grab('// ── BEGIN usage-catalog ──', '// ── END usage-catalog ──'),
    grab('// ── BEGIN usage-panel ──',   '// ── END usage-panel ──'),
  ].join('\n');

  // Any write attempt from this screen is a hard failure — trap them all.
  const trap = (name) => () => { throw new Error('WROTE FROM A READ-ONLY SCREEN: ' + name); };
  const panel = new Function(
    'featureUsage', 'esc', 'todayStr', 'fmtDate',
    'saveLocal', 'noteUse', 'localStorage', 'fetch', 'setDoc',
    src + '\nreturn { renderUsagePanel, _usageAgo };'
  );

  const usage = {
    'daybar':        { n: 4,  first: '2026-08-20T09:00:00+05:30', last: '2026-09-06T09:00:00+05:30' },
    'nav-today':     { n: 91, first: '2026-08-01T09:00:00+05:30', last: '2026-09-05T09:00:00+05:30' },
    'retired-thing': { n: 2,  first: '2026-08-02T09:00:00+05:30', last: '2026-08-30T09:00:00+05:30' },
  };
  const api = panel(
    usage,
    (x) => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    () => '2026-09-06',
    (d) => d,
    trap('saveLocal'), trap('noteUse'), { setItem: trap('localStorage') }, trap('fetch'), trap('setDoc'),
  );

  let out = '', threw = null;
  try { out = api.renderUsagePanel(); } catch (e) { threw = e; }
  ok(!threw, 'the Usage panel renders without writing anything' + (threw ? ' — ' + threw.message : ''));
  ok(out.includes('>91<'), 'shows a real count');
  ok(/Day Ratio Bar/.test(out), 'lists the toggle features by their real labels');
  ok(/Weekly Review/.test(out) && /Trends tab/.test(out) && /AI Log Activities/.test(out),
     'lists the baseline surfaces');
  ok(/Security check/.test(out), 'settings rows come from the live SETTINGS_SECTIONS list');
  ok(/Other \(not in the catalog\)/.test(out) && /retired-thing/.test(out),
     'an id with no catalog entry is shown, not silently hidden');
  ok(/not used on this device yet/.test(out), 'an uncounted surface reads as never used, not as missing');
  ok(api._usageAgo('2026-09-06T22:00:00+05:30') === 'today' &&
     api._usageAgo('2026-09-05T22:00:00+05:30') === 'yesterday' &&
     api._usageAgo('2026-09-01T22:00:00+05:30') === '5 days ago',
     'last-used reads in plain English');
}


console.log('');
if (failures) { console.log(`feature-usage: ${failures} FAILURE(S)`); process.exit(1); }
console.log('feature-usage: all assertions passed');
