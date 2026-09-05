// Behavioural sim for the client half of the backup (index.html).
//
// THE FAILURE THIS EXISTS TO CATCH: BACKUP_COLLECTIONS holds two halves of one
// mapping — toDocs() turns this device's state into Firestore-shaped documents,
// fromDocs() turns them back. If they ever stop being inverses, the app still
// builds, the download still produces a plausible-looking file, and the loss
// only shows up on the day someone actually restores — which is the worst
// possible day to discover it. So this seeds real-shaped state, exports it,
// wipes everything, restores, and demands the state come back identical.
//
// It also fails if a collection is added to the table with a toDocs() and no
// working fromDocs() — the drift that would silently drop a whole collection
// from every restore.
//
// The REAL functions are extracted out of index.html (not copied), so this
// catches drift rather than agreeing with a stale duplicate. Same trick as
// tests/tag-tokenizer.mjs.
//
// Runs in scripts/check.sh. `node tests/backup-restore.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
const eq = (got, want, name) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { failed++; console.error(`FAIL ${name}\n     got  ${g}\n     want ${w}`); }
  else console.log(`ok   ${name}`);
};
const ok = (cond, name) => { if (!cond) { failed++; console.error(`FAIL ${name}`); } else console.log(`ok   ${name}`); };

function grab(re, what) {
  const m = html.match(re);
  if (!m) { console.error(`FAIL: could not extract ${what} from index.html`); process.exit(1); }
  return m[0];
}

const tableSrc     = grab(/const BACKUP_COLLECTIONS = \[[\s\S]*?\n\];/, 'BACKUP_COLLECTIONS');
const versionSrc   = grab(/const BACKUP_FORMAT_VERSION = \d+;/, 'BACKUP_FORMAT_VERSION');
const snapshotSrc  = grab(/function buildDeviceSnapshot\(\) \{[\s\S]*?\n\}/, 'buildDeviceSnapshot');
const validateSrc  = grab(/function validateBackupFile\(raw\) \{[\s\S]*?\n\}/, 'validateBackupFile');
const helperSrc    = grab(/function backupCollection\(name\) \{.*?\n\}/s, 'backupCollection');

// A stand-in for the module scope those functions close over.
const harness = `
  const SK = {
    BLOCKS: 'blocks', CAPTURES: 'captures', RATINGS: 'ratings', LIFE_RATINGS: 'life_ratings',
    EOD: 'eod', PROJECTS: 'projects', SESSIONS: 'sessions', TAG_HISTORY: 'tag_history',
    LEARNING: 'learning', DAILY_JOURNAL: 'daily', DEFAULT_BLOCKS_CONFIG: 'dbc', DEFAULT_BLOCKS_SKIPS: 'dbs',
  };
  const saved = {};
  function saveLocal(k, v) { saved[k] = JSON.parse(JSON.stringify(v)); }
  function todayStr() { return '2026-09-05'; }
  let user = { uid: 'founder-uid' };
  let blocks = [], captures = [], dailyJournals = [], sessions = {}, learning = [];
  let ratings = {}, lifeRatings = {}, eodNotes = {}, dfts = {}, dismissals = {};
  let weeklyReviews = {}, monthlyReviews = {};
  let projects = [], tagHistory = [];
  let adherenceConfig = { rules: [] }, dayScoreConfig = { tiles: [] }, lifeCheckConfig = { metrics: [] };
  let defaultBlocksConfig = { templates: [] }, defaultBlocksSkips = {};
  ${versionSrc}
  ${tableSrc}
  ${helperSrc}
  ${snapshotSrc}
  ${validateSrc}
  return {
    BACKUP_COLLECTIONS, BACKUP_FORMAT_VERSION, buildDeviceSnapshot, validateBackupFile, backupCollection, saved,
    setState(s) {
      blocks = s.blocks; captures = s.captures; dailyJournals = s.dailyJournals; sessions = s.sessions;
      learning = s.learning; ratings = s.ratings; lifeRatings = s.lifeRatings; eodNotes = s.eodNotes;
      dfts = s.dfts; dismissals = s.dismissals; weeklyReviews = s.weeklyReviews; monthlyReviews = s.monthlyReviews;
      projects = s.projects; tagHistory = s.tagHistory; adherenceConfig = s.adherenceConfig;
      dayScoreConfig = s.dayScoreConfig; lifeCheckConfig = s.lifeCheckConfig;
      defaultBlocksConfig = s.defaultBlocksConfig; defaultBlocksSkips = s.defaultBlocksSkips;
    },
    getState() {
      return { blocks, captures, dailyJournals, sessions, learning, ratings, lifeRatings, eodNotes, dfts,
               dismissals, weeklyReviews, monthlyReviews, projects, tagHistory, adherenceConfig,
               dayScoreConfig, lifeCheckConfig, defaultBlocksConfig, defaultBlocksSkips };
    },
    setUser(u) { user = u; },
  };
`;
// eslint-disable-next-line no-new-func
const M = new Function(harness)();

// State shaped like the real thing: one of everything, including the awkward
// ones (a keyed map, a per-project session bucket, the meta config docs).
const FULL = {
  blocks: [
    { id: 'b1', date: '2026-09-01', start_time: '09:00', duration_min: 90, category: 'deep_work', label: 'Build', tags: ['#win'] },
    { id: 'b2', date: '2026-09-01', start_time: '21:00', duration_min: 45, category: 'leaks', label: 'Scroll', tags: [] },
  ],
  captures: [{ id: 'c1', timestamp: '2026-09-01T10:00:00', type: 'note', body: 'a thought', tags: ['#insight'] }],
  dailyJournals: [{ id: '2026-09-01', date: '2026-09-01', thoughts: 'ok day', reflection: '', tasks: [{ text: 'ship', completed: true }], tags: [] }],
  sessions: {
    DayOS:      [{ id: 's1', projectName: 'DayOS', date: '2026-09-01', before: 'plan', during: '', after: '', durationMin: 60, done: ['x'], pending: [], learned: [], tags: [] }],
    TradeGenie: [{ id: 's2', projectName: 'TradeGenie', date: '2026-09-02', before: '', during: '', after: 'done', durationMin: 30, done: [], pending: ['y'], learned: [], tags: [] }],
  },
  learning: [{ id: 'l1', sourceName: 'A book', sourceType: 'book', takeaway: 'a thing', fullNotes: '', tags: [], date: '2026-09-01', createdAt: '2026-09-01T12:00:00' }],
  ratings: { '2026-09-01': 4, '2026-09-02': 2 },
  lifeRatings: { '2026-09-01': { mindset: 5, exercise_nutrition: 3 } },
  eodNotes: { '2026-09-01': 'Long day.' },
  dfts: { '2026-09-01': { text: 'ship the backup', status: 'done' } },
  dismissals: { '2026-09-01': { onthisday: true } },
  weeklyReviews: { '2026-08-30': { weekStart: '2026-08-30', weekEnd: '2026-09-05', nextWeekIntention: 'less scrolling', patterns: ['late nights'] } },
  monthlyReviews: { '2026-08': { month: '2026-08', monthLabel: 'August', oneFocus: 'contraction' } },
  projects: ['DayOS', 'TradeGenie'],
  tagHistory: ['#win', '#insight'],
  adherenceConfig: { rules: [{ id: 'r1', label: 'Deep work 2h', type: 'auto', enabled: true }] },
  dayScoreConfig: { tiles: [{ id: 'deep-work', enabled: true }] },
  lifeCheckConfig: { metrics: [{ id: 'mindset', label: 'Mindset' }] },
  defaultBlocksConfig: { templates: [{ id: 't1', enabled: true, start_time: '23:00', duration_min: 480, category: 'routine', label: 'Sleep' }] },
  defaultBlocksSkips: { '2026-09-01': { t1: 'deleted' } },
};
const EMPTY = {
  blocks: [], captures: [], dailyJournals: [], sessions: {}, learning: [],
  ratings: {}, lifeRatings: {}, eodNotes: {}, dfts: {}, dismissals: {},
  weeklyReviews: {}, monthlyReviews: {}, projects: [], tagHistory: [],
  adherenceConfig: { rules: [] }, dayScoreConfig: { tiles: [] }, lifeCheckConfig: { metrics: [] },
  defaultBlocksConfig: { templates: [] }, defaultBlocksSkips: {},
};
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── every collection in the table is actually exported ───────────────────────

M.setState(clone(FULL));
const snap = M.buildDeviceSnapshot();
const bucket = snap.users['founder-uid'];

eq(snap.app, 'dayos', 'the device export is labelled as a DayOS backup');
eq(snap.source, 'device', 'the device export says where it came from');
eq(snap.formatVersion, M.BACKUP_FORMAT_VERSION, 'the device export carries the format version');

for (const c of M.BACKUP_COLLECTIONS) {
  ok(Array.isArray(bucket.data[c.coll]) && bucket.data[c.coll].length > 0,
     `${c.coll}: exports at least one document from a fully populated device`);
  ok(bucket.data[c.coll].every(d => d && d.id != null && String(d.id) !== ''),
     `${c.coll}: every exported document carries an id (a restore addresses by id)`);
  const ids = bucket.data[c.coll].map(d => String(d.id));
  eq(new Set(ids).size, ids.length, `${c.coll}: exported ids are unique`);
}
eq(snap.totalRecords, Object.values(bucket.counts).reduce((a, b) => a + b, 0), 'totalRecords matches the per-collection counts');

// ── the round trip ───────────────────────────────────────────────────────────
//
// Export, wipe the device, restore from the export, and demand every last
// field back. This is the whole feature in one assertion.

const exported = clone(bucket.data);
M.setState(clone(EMPTY));
{
  // Prove the wipe really happened, or the round trip below would be passing
  // on leftover state rather than on anything the restore did.
  const wiped = M.buildDeviceSnapshot().users['founder-uid'].counts;
  for (const c of M.BACKUP_COLLECTIONS) {
    // `meta` is configuration, not entries: its seven fixed documents exist
    // whether or not they hold anything, so an empty device still exports
    // seven empty ones. Every other collection must be at zero.
    if (c.coll === 'meta') { eq(wiped.meta, 7, 'meta still exports its 7 config documents when empty'); continue; }
    eq(wiped[c.coll], 0, `${c.coll}: empty after the wipe`);
  }
}

for (const c of M.BACKUP_COLLECTIONS) c.fromDocs(clone(exported[c.coll]));

const after = M.getState();
for (const key of Object.keys(FULL)) {
  eq(after[key], FULL[key], `round trip restores ${key} exactly`);
}

// ── the id-field rule ────────────────────────────────────────────────────────
//
// The backup adds `id` from the document path. Collections whose documents
// never carried one (ratings, eod, dfts, the meta docs) must not gain the
// field on restore — the second-brain mirror reads these documents, and a
// field DayOS never stored there is schema pollution.

for (const c of M.BACKUP_COLLECTIONS) {
  if (c.idField !== null) continue;
  const docs = c.toDocs();
  ok(docs.every(d => 'id' in d), `${c.coll}: exports an id even though the stored document has none`);
}
eq(M.backupCollection('ratings').idField, null, 'ratings documents carry no id field of their own');
eq(M.backupCollection('blocks').idField, 'id', 'block documents do carry their own id field');
eq(M.backupCollection('nope'), null, 'an unknown collection resolves to null rather than throwing');

// ── validation of a file handed in from outside ──────────────────────────────

const good = { app: 'dayos', formatVersion: 1, users: { 'founder-uid': { data: { blocks: [{ id: 'b1' }] } } } };
const throws = (fn, name, match) => {
  try { fn(); failed++; console.error(`FAIL ${name}: no error thrown`); }
  catch (e) {
    if (match && !match.test(e.message)) { failed++; console.error(`FAIL ${name}: message was "${e.message}"`); }
    else console.log(`ok   ${name}`);
  }
};
throws(() => M.validateBackupFile(null), 'null is refused');
throws(() => M.validateBackupFile([1, 2]), 'an array is refused');
throws(() => M.validateBackupFile({ app: 'tradegenie', users: {} }), "another app's backup is refused", /tradegenie/i);
throws(() => M.validateBackupFile({ app: 'dayos' }), 'a file with no users section is refused', /users/);
throws(() => M.validateBackupFile({ app: 'dayos', users: {} }), 'a file with no user data is refused');
// Refusing a newer format is the point of having a version at all: guessing at
// an unfamiliar file is how a restore corrupts what it was meant to rescue.
throws(() => M.validateBackupFile({ ...good, formatVersion: 99 }), 'a newer format version is refused', /newer version/);

{
  const r = M.validateBackupFile(good);
  eq(r.total, 1, 'a good file previews its record count');
  eq(r.foreignUid, false, "the signed-in account's own backup is not flagged as foreign");
}
{
  // Restoring someone else's entries into your journal, silently, would be the
  // worst outcome of pressing Restore. It must be named on screen.
  const r = M.validateBackupFile({ app: 'dayos', formatVersion: 1, users: { 'someone-else': { data: { blocks: [{ id: 'x' }] } } } });
  eq(r.foreignUid, true, "another account's backup is flagged before anything is written");
}
{
  M.setUser({ uid: 'founder-uid' });
  const r = M.validateBackupFile({ app: 'dayos', formatVersion: 1, users: {
    'someone-else': { data: { blocks: [{ id: 'x' }] } },
    'founder-uid':  { data: { blocks: [{ id: 'a' }, { id: 'b' }] } },
  } });
  eq(r.fileUid, 'founder-uid', 'a multi-account file picks the signed-in account, not the first one listed');
  eq(r.total, 2, 'and previews that account\'s records');
}

console.log(failed ? `\n${failed} FAILED` : '\nAll backup round-trip sims passed');
process.exit(failed ? 1 : 0);
