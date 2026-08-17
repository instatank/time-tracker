// Behavioural sim for Settings → Security check (docs/security-audit.md Phase 1).
//
// The detector has its own corpus (tests/security-detector.mjs). This sim covers
// the SCREEN, and specifically the three promises the screen makes:
//
//   1. It sweeps EVERY collection, including soft-deleted (trashed) entries,
//      voice-note titles and attachment filenames. A collection silently
//      missing from the sweep is the failure mode that matters — the founder
//      would read "Scanned 412 entries" and believe a clean result.
//   2. It performs ZERO writes, ZERO deletes and ZERO network calls. Enforced
//      here by handing the code trapped localStorage / fetch / setDoc / saveLocal
//      and asserting nothing was called.
//   3. Everything reaches innerHTML through esc(). An entry containing HTML must
//      render as text, never execute — and journal entries are exactly where
//      pasted HTML ends up.
//
// Extracts the REAL source region out of index.html (like tests/tag-tokenizer.mjs)
// and runs it against fixture state. No browser, no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const i0 = html.indexOf('// ── BEGIN secret-detector ──');
const i1 = html.indexOf('// ── Settings → Trash ──');
if (i0 === -1 || i1 === -1 || i1 < i0) {
  throw new Error('FAIL: could not slice the detector + security-check region out of index.html');
}
const region = html.slice(i0, i1);

// The real esc() — the escaping assertion is only meaningful against the real one.
const escSrc = html.match(/function esc\(s\) \{.*\}/);
if (!escSrc) throw new Error('FAIL: could not extract esc() from index.html');

// ── Fixtures: one planted secret per collection, plus the awkward cases ──
const GH  = 'ghp_' + 'AbCdEf1234567890AbCdEf1234567890Ab';
const AK  = 'AKIA' + 'IOSFODNN7EXAMPLE';
const ANT = 'sk-ant-' + 'api03-AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890-QwErTyAA';
const XSS = '<img src=x onerror="alert(1)"> the wifi password is Tr0ub4dor&3';

const fixtures = {
  blocks: [
    { id: 'b1', date: '2026-08-17', start_time: '09:00', label: 'Deep work', note: 'token ' + GH },
    { id: 'b2', date: '2026-08-10', start_time: '10:00', label: 'Reading', note: 'nothing sensitive here' },
  ],
  captures: [
    { id: 'c1', timestamp: '2026-08-16T21:00:00+05:30', type: 'note', body: 'aws ' + AK },
    // TRASHED — the case the founder cares about most.
    { id: 'c2', timestamp: '2026-08-12T08:00:00+05:30', type: 'note', body: 'old key ' + ANT, deletedAt: '2026-08-15T10:00:00+05:30' },
    // Voice-note title + attachment filename carry text too.
    { id: 'c3', timestamp: '2026-08-14T08:00:00+05:30', type: 'note', body: 'clean',
      voiceNotes: [{ id: 'v1', title: 'wifi password is Tr0ub4dor&3' }],
      attachments: [{ id: 'a1', title: 'recovery codes 8H2K-9QLM.txt', url: 'https://firebasestorage.googleapis.com/v0/b/x/o/users%2FQ7xKd93LmPq2VbNr8TsWyZcH4jFg%2Fattachments%2Fa1.txt?alt=media&token=9f2c1e64-3b7a-4d58-9e01-6c8d5a4b2f13' }] },
    // Pasted HTML — must render as text.
    { id: 'c4', timestamp: '2026-08-13T08:00:00+05:30', type: 'note', body: XSS },
  ],
  dailyJournals: [
    { id: '2026-08-15', date: '2026-08-15', thoughts: 'the atm pin is 4417', reflection: '', tasks: [{ text: 'rotate the api key for stripe', done: false }] },
  ],
  sessions: {
    DayOS: [
      { id: 's1', projectName: 'DayOS', date: '2026-08-11', before: '', during: 'pasted ' + ANT, after: '', pending: ['ask about the account number 0021 4455 7788'] },
    ],
  },
  learning: [
    { id: 'l1', date: '2026-08-09', sourceName: 'Auth docs', takeaway: 'clean', fullNotes: 'sample cvv 421 in the test card' },
  ],
  eodNotes:  { '2026-08-08': 'good day, otp 883921 arrived late' },
  dfts:      { '2026-08-07': { text: 'seed phrase: witch collapse practice feed shame open despair creek', status: 'pending' } },
  weeklyReviews:  { '2026-08-02': { weekStart: '2026-08-02', weekEnd: '2026-08-08', aiSummary: 'solid week; deploy key ' + GH + ' still in the notes', tasks: [{ text: 'clean up', done: true }] } },
  monthlyReviews: { '2026-07': { ym: '2026-07', coherence: 'strong', notes: 'the cron secret is s3cr3t-value-99' } },
};

// ── Trapped host: any write or network call lands in __calls ─────────────
const preamble = `
const __calls = [];
const localStorage = {
  getItem: () => null,
  setItem: (k) => __calls.push('localStorage.setItem:' + k),
  removeItem: (k) => __calls.push('localStorage.removeItem:' + k),
};
const fetch  = (u) => { __calls.push('fetch:' + u); return Promise.resolve({}); };
const XMLHttpRequest = function () { __calls.push('XMLHttpRequest'); };
const saveLocal   = (k) => __calls.push('saveLocal:' + k);
const setDoc      = () => __calls.push('setDoc');
const addDoc      = () => __calls.push('addDoc');
const updateDoc   = () => __calls.push('updateDoc');
const deleteDoc   = () => __calls.push('deleteDoc');
const writeBatch  = () => __calls.push('writeBatch');
const deleteObject= () => __calls.push('deleteObject');
const uploadBytes = () => __calls.push('uploadBytes');
const navigator   = { sendBeacon: () => __calls.push('sendBeacon') };

${escSrc[0]}
const isTrashed  = (x) => !!(x && x.deletedAt);
const ctypeById  = (t) => ({ label: t === 'daily' ? 'Daily Journal' : 'Quick Note' });
const todayStr   = () => '2026-08-17';
const addDays    = (d, n) => new Date(Date.UTC(+d.slice(0,4), +d.slice(5,7)-1, +d.slice(8,10) + n)).toISOString().slice(0,10);
function getWeekStart(dateStr) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}
const settingsSubhdrHtml = (t) => '<div class="settings-subhdr">' + esc(t) + '</div>';
const toast = () => {};
const window = {};
const __painted = { innerHTML: '' };
const document = { getElementById: () => __painted };

const blocks         = ${JSON.stringify(fixtures.blocks)};
const captures       = ${JSON.stringify(fixtures.captures)};
const dailyJournals  = ${JSON.stringify(fixtures.dailyJournals)};
const sessions       = ${JSON.stringify(fixtures.sessions)};
const learning       = ${JSON.stringify(fixtures.learning)};
const eodNotes       = ${JSON.stringify(fixtures.eodNotes)};
const dfts           = ${JSON.stringify(fixtures.dfts)};
const weeklyReviews  = ${JSON.stringify(fixtures.weeklyReviews)};
const monthlyReviews = ${JSON.stringify(fixtures.monthlyReviews)};
`;

const api = new Function(
  preamble + region +
  '\nreturn { runSecuritySweep, openSettingsSecurity, painted: __painted, calls: __calls, win: window };'
)();

let failed = 0;
const pass = (n) => console.log(`ok   ${n}`);
const fail = (n, d) => { failed++; console.error(`FAIL ${n}: ${d}`); };

// ── 1. Sweep coverage ────────────────────────────────────────────────────
const { scanned, findings } = api.runSecuritySweep();

// 2 blocks + 4 captures + 1 daily + 1 session + 1 learning + 1 eod + 1 dft
// + 1 weekly + 1 monthly = 13 entries.
if (scanned !== 13) fail('sweep/scanned', `expected 13 entries scanned, got ${scanned}`);
else pass('sweep: counts every entry across all nine collections');

const typesFound = new Set(findings.map(f => f.type));
for (const t of ['block', 'capture', 'daily', 'session', 'learning', 'eod', 'dft', 'weekly', 'monthly']) {
  if (typesFound.has(t)) pass(`sweep: finds planted secret in ${t}`);
  else fail(`sweep/${t}`, 'no finding — this collection is not being swept');
}

// Voice-note titles and attachment filenames.
const fields = new Set(findings.map(f => f.field));
if (fields.has('voice note title')) pass('sweep: voice-note titles');
else fail('sweep/voice', 'voice-note title not scanned');
if (fields.has('attachment filename')) pass('sweep: attachment filenames');
else fail('sweep/attachment', 'attachment filename not scanned');

// The Firebase Storage download URL on that attachment embeds a 28-char uid.
// If it were being walked, the high-entropy rule would flag every attachment.
if (findings.some(f => f.field && f.field.includes('url'))) {
  fail('sweep/urls', 'machine-generated URLs are being scanned — every attachment would be a finding');
} else pass('sweep: skips machine-generated URL fields');

// ── 2. Trash is covered, and routed away from the autosaving editors ─────
const trashed = findings.filter(f => f.trashed);
if (!trashed.length) fail('trash/covered', 'no finding from the soft-deleted capture');
else if (!trashed.every(f => f.open === 'secOpenTrash()')) {
  fail('trash/route', `trashed findings must open Trash, got ${trashed.map(f => f.open).join(', ')}`);
} else pass('trash: soft-deleted entries scanned and routed to Trash, not the autosaving editor');

// Live entries route to their real editor.
const liveCapture = findings.find(f => f.type === 'capture' && !f.trashed);
if (!liveCapture || !/^openCaptureEdit\('/.test(liveCapture.open)) {
  fail('open/live', `live capture should open its editor, got ${liveCapture && liveCapture.open}`);
} else pass('open: live entries open their own editor');

// ── 3. Ordering: newest first ────────────────────────────────────────────
{
  const keys = findings.map(f => String(f.sortKey || ''));
  const sorted = keys.every((k, i) => i === 0 || keys[i - 1] >= k);
  if (!sorted) fail('order/newest-first', 'findings are not newest-first');
  else pass('order: newest first');
}

// ── 4. Render ────────────────────────────────────────────────────────────
api.openSettingsSecurity();
const painted = api.painted.innerHTML;

const HEADER = 'Scanned 13 entries. Nothing was sent anywhere.';
if (!painted.includes(HEADER)) fail('render/header-count', 'header sentence missing or wrong count');
else pass('render: header states the scanned count and that nothing was sent');

const MIRROR = 'This does not scan the second-brain mirror or the 2ndbrain backup repo — those hold separate copies.';
if (!painted.includes(MIRROR)) fail('render/header-mirror', 'second-brain / 2ndbrain caveat missing');
else pass('render: header names the copies this sweep cannot reach');

if (!painted.includes('Shaped keys') || !painted.includes('Worth a look')) {
  fail('render/groups', 'findings are not grouped into shaped + worded');
} else pass('render: grouped by category, shaped first');

if (painted.indexOf('Shaped keys ·') > painted.indexOf('Worth a look ·')) {
  fail('render/order', 'worded section painted before shaped');
} else pass('render: shaped section comes first');

// ── 5. Escaping: pasted HTML must render as text, never execute ──────────
if (painted.includes('<img src=x')) fail('render/xss', 'raw <img> tag reached innerHTML unescaped');
else if (!painted.includes('&lt;img src=x')) fail('render/xss-present', 'the HTML-bearing entry was not rendered at all')
else pass('render: entry containing HTML is escaped, not executed');

if (/onerror="alert/.test(painted)) fail('render/xss-attr', 'an onerror attribute survived into the markup');
else pass('render: attribute-style injection neutralised');

// ── 6. No raw shaped secret anywhere in the painted markup ──────────────
for (const [name, secret] of [['github token', GH], ['aws key id', AK], ['anthropic key', ANT]]) {
  if (painted.includes(secret)) fail('render/leak', `the raw ${name} was painted to the screen`);
  else pass(`render: raw ${name} never painted — masked only`);
}

// ── 7. THE constraint: zero writes, zero deletes, zero network ──────────
if (api.calls.length) fail('readonly', `the sweep called: ${api.calls.join(', ')}`);
else pass('read-only: zero writes, zero deletes, zero network calls');

if (failed) { console.error(`\n${failed} security-screen assertion(s) failed`); process.exit(1); }
console.log('\nsecurity-screen: all assertions passed');
