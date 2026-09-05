// Behavioural sim for the offsite backup (api/backup.mjs).
//
// None of this can be run here against the real thing: the Firestore service
// account and the GitHub token both live in Vercel, and the container has
// neither. So instead of shipping it unproven, the module was written with its
// readers injected and its HTTP behind global fetch — and this file stands in
// for both. The second half drives the WHOLE run (OAuth -> Firestore walk ->
// guards -> git data API commit) against a fake GitHub that implements the
// same call sequence, which is what covers the guards that only ever fire on a
// bad day and could never be observed otherwise.
//
// What this cannot cover, honestly: whether Google and GitHub behave the way
// this code believes they do. That is what the "Check backup" button in the
// deployed app is for.
//
// Runs in scripts/check.sh. `node tests/backup.mjs`.
import { generateKeyPairSync } from 'node:crypto';

let failed = 0;
const eq = (got, want, name) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { failed++; console.error(`FAIL ${name}\n     got  ${g}\n     want ${w}`); }
  else console.log(`ok   ${name}`);
};
const ok = (cond, name, extra = '') => {
  if (!cond) { failed++; console.error(`FAIL ${name} ${extra}`); }
  else console.log(`ok   ${name}`);
};

const B = await import('../api/backup.mjs');

// ── 1. Firestore value decoding ──────────────────────────────────────────────

{
  const issues = [];
  eq(B.decodeValue({ stringValue: 'hi' }, issues, 'x'), 'hi', 'decode string');
  eq(B.decodeValue({ integerValue: '42' }, issues, 'x'), 42, 'decode integer (arrives as a string)');
  eq(B.decodeValue({ doubleValue: 1.5 }, issues, 'x'), 1.5, 'decode double');
  eq(B.decodeValue({ booleanValue: false }, issues, 'x'), false, 'decode boolean false');
  eq(B.decodeValue({ nullValue: null }, issues, 'x'), null, 'decode null');
  eq(B.decodeValue({ arrayValue: { values: [{ stringValue: '#win' }] } }, issues, 'x'), ['#win'], 'decode array');
  eq(B.decodeValue({ arrayValue: {} }, issues, 'x'), [], 'decode empty array (no values key)');
  eq(B.decodeValue({ mapValue: { fields: { a: { integerValue: '1' } } } }, issues, 'x'), { a: 1 }, 'decode map');
  eq(issues.length, 0, 'no issues from known types');

  // The one that matters: a type nobody anticipated must be REPORTED, not
  // dropped. A silent drop is exactly how a field goes missing from a backup
  // for a year without anyone noticing.
  const unknown = [];
  eq(B.decodeValue({ someFutureValue: 1 }, unknown, 'doc.field'), null, 'unknown type decodes to null');
  ok(unknown.length === 1 && unknown[0].includes('doc.field'), 'unknown type is reported as an issue');
}

{
  const issues = [];
  const doc = B.decodeDocument({
    name: 'projects/p/databases/(default)/documents/users/u1/blocks/blk-9',
    fields: { id: { stringValue: 'WRONG' }, label: { stringValue: 'Deep work' } },
  }, issues);
  // A stored `id` field must never win over the document id: the id is the
  // address the restore writes back to, and a disagreement would silently
  // relocate the entry.
  eq(doc.id, 'blk-9', 'document id comes from the path, not a stored field');
  eq(doc.label, 'Deep work', 'other fields decode alongside');
}

// ── 2. A fake database, walked ───────────────────────────────────────────────

const fakeDb = {
  u1: {
    blocks: [
      { id: 'b1', date: '2026-09-01', category: 'deep_work', label: 'Build', tags: ['#win'] },
      { id: 'b2', date: '2026-09-02', category: 'leaks', label: 'Scroll', tags: [] },
    ],
    captures: [
      { id: 'c1', timestamp: '2026-09-01T10:00:00', type: 'note', body: 'a thought',
        voiceNotes: [{ id: 'v1', storagePath: 'users/u1/voice/v1.webm', title: 'idea', size: 120000, createdAt: '2026-09-01T10:01:00' }],
        attachments: [{ id: 'a1', kind: 'image', storagePath: 'users/u1/attachments/a1.jpg', title: 'shot.jpg', size: 40000, deletedAt: '2026-09-02T00:00:00' }] },
    ],
    meta: [{ id: 'projects', list: ['DayOS', 'TradeGenie'] }],
    // Excluded on purpose — push tokens are device credentials that regenerate.
    devices: [{ id: 'd1', token: 'fcm-token-abc' }],
  },
};

const encodeValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeValue(x)])) } };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  return { stringValue: String(v) };
};
const encodeDoc = (uid, coll, rec) => ({
  name: `projects/p/databases/(default)/documents/users/${uid}/${coll}/${rec.id}`,
  fields: Object.fromEntries(Object.entries(rec).filter(([k]) => k !== 'id').map(([k, v]) => [k, encodeValue(v)])),
});

const io = {
  listUids: async () => Object.keys(fakeDb),
  listCollections: async (uid) => Object.keys(fakeDb[uid]),
  listDocuments: async (uid, coll) => (fakeDb[uid][coll] || []).map(r => encodeDoc(uid, coll, r)),
  probeSubcollections: async () => [],
};

const snap = await B.buildSnapshot(io, new Date('2026-09-05T18:00:00Z'));

eq(snap.formatVersion, 1, 'snapshot carries a format version');
eq(snap.source, 'firestore', 'snapshot names where it was read from');
eq(snap.users.u1.collections, ['blocks', 'captures', 'meta'], 'devices is excluded from the backup');
eq(snap.users.u1.counts, { blocks: 2, captures: 1, meta: 1 }, 'per-collection counts');
eq(snap.totalRecords, 4, 'total records excludes devices');
eq(snap.users.u1.data.meta[0].list, ['DayOS', 'TradeGenie'], 'a meta list-doc round-trips through decoding');
eq(snap.issues, [], 'a clean walk reports no issues');

// The structural probe: DayOS has no nested subcollections today, and if that
// ever changes this walk would stop at the parent. It must say so.
{
  const nestedIo = { ...io, probeSubcollections: async (uid, coll) => (coll === 'blocks' ? ['revisions'] : []) };
  const s = await B.buildSnapshot(nestedIo);
  ok(s.issues.some(i => i.includes('revisions')), 'nested subcollections are reported, not silently skipped');
}

// ── 3. The media manifest ────────────────────────────────────────────────────

eq(snap.media.total, 2, 'media manifest sees both the voice note and the attachment');
eq(snap.media.live, 1, 'a trashed attachment is counted but not as live');
eq(snap.media.knownBytes, 120000, 'known bytes sums live media only');
eq(snap.media.items[0].parent, 'u1/captures/c1', 'each media item names the entry it belonged to');
ok(/NOT in this backup/i.test(snap.media.note), 'the manifest says plainly that the bytes are not backed up');

// ── 4. The content hash ──────────────────────────────────────────────────────

{
  const later = await B.buildSnapshot(io, new Date('2027-01-01T00:00:00Z'));
  eq(B.contentHashOf(later), B.contentHashOf(snap), 'the hash ignores exportedAt — an unchanged journal must not commit daily');

  // Firestore makes no ordering promise about a document's fields. Hashing
  // their serialisation order would turn a re-read into a "change".
  const reordered = JSON.parse(JSON.stringify(snap));
  reordered.users.u1.data.blocks[0] = { label: 'Build', tags: ['#win'], category: 'deep_work', date: '2026-09-01', id: 'b1' };
  eq(B.contentHashOf(reordered), B.contentHashOf(snap), 'the hash is insensitive to key order');

  const edited = JSON.parse(JSON.stringify(snap));
  edited.users.u1.data.captures[0].body = 'a thought, edited';
  ok(B.contentHashOf(edited) !== B.contentHashOf(snap), 'editing an entry changes the hash even though no count moved');
}

// ── 5. The guards ────────────────────────────────────────────────────────────

eq(B.shrinkGuard(0, 500), null, 'no previous backup means nothing to compare against');
eq(B.shrinkGuard(undefined, 500), null, 'a missing sidecar does not block the run');
eq(B.shrinkGuard(1000, 500), null, 'exactly half is allowed through');
ok(B.shrinkGuard(1000, 499) !== null, 'losing more than half is refused');
ok(B.shrinkGuard(1000, 0) !== null, 'losing everything is refused');

ok(B.integrityGuard({ users: {}, totalRecords: 0, readError: 'Firestore 503' }) !== null, 'a failed read is refused');
ok(B.integrityGuard({ users: {}, totalRecords: 0 }) !== null, 'no users found is refused');
ok(B.integrityGuard({ users: { u1: {} }, totalRecords: 0 }) !== null, 'zero records is refused');
eq(B.integrityGuard(snap), null, 'a healthy snapshot passes');

// ── 6. Configuration ─────────────────────────────────────────────────────────

eq(B.destinationFromEnv({}), null, 'unconfigured means no destination');
eq(B.destinationFromEnv({ BACKUP_GITHUB_REPO: 'me/backups' }), null, 'a repo without a token is not configured');
eq(B.destinationFromEnv({ BACKUP_GITHUB_REPO: 'backups', BACKUP_GITHUB_TOKEN: 't' }), null, 'a repo missing its owner is not a destination');
eq(B.destinationEnvState({ BACKUP_GITHUB_REPO: 'backups', BACKUP_GITHUB_TOKEN: 't' }).repoMalformed, true,
   'owner-less repo is flagged as malformed, not reported as "never configured"');
eq(B.destinationEnvState({ BACKUP_GITHUB_REPO: 'me/backups', BACKUP_GITHUB_TOKEN: 't' }).repoMalformed, false, 'owner/repo is well formed');
ok(!('token' in (B.destinationEnvState({ BACKUP_GITHUB_TOKEN: 'super-secret' }) )), 'the token never leaves destinationEnvState');
ok(!JSON.stringify(B.destinationEnvState({ BACKUP_GITHUB_TOKEN: 'super-secret', BACKUP_GITHUB_REPO: 'me/b' })).includes('super-secret'),
   'no token value appears anywhere in the settings-panel state');

{
  const off = await B.runBackup({ env: {} });
  eq(off.status, 'off', 'unconfigured runs report "off" and touch nothing');
  const bad = await B.runBackup({ env: { BACKUP_GITHUB_REPO: 'backups', BACKUP_GITHUB_TOKEN: 't' } });
  eq(bad.status, 'off', 'a malformed repo is reported rather than half-attempted');
  ok(bad.detail.includes('owner/repo'), 'the malformed-repo message says what the value should look like');
}

// ── 7. The whole run, against a fake Google and a fake GitHub ────────────────

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({
  client_email: 'sim@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  project_id: 'dayos-sim',
});

function makeFakeWorld({ private_ = true, existingStatus = null, emptyRepo = false } = {}) {
  const state = { commits: [], blobs: {}, files: {}, refExists: !emptyRepo, calls: [] };
  if (existingStatus) state.files['backup-status.json'] = JSON.stringify(existingStatus);

  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  return {
    state,
    fetch: async (url, init = {}) => {
      const u = String(url);
      state.calls.push(`${init.method || 'GET'} ${u.replace('https://api.github.com/repos/me/dayos-backups', '')}`);

      if (u.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'fake-token' });

      if (u.startsWith('https://firestore.googleapis.com')) {
        const path = u.split('/documents')[1].split('?')[0];
        if (path === '/users') {
          return json({ documents: Object.keys(fakeDb).map(uid => ({ name: `projects/p/databases/(default)/documents/users/${uid}` })) });
        }
        if (path.endsWith(':listCollectionIds')) {
          const docPath = path.replace(':listCollectionIds', '');
          const parts = docPath.split('/').filter(Boolean); // users, uid[, coll, docId]
          if (parts.length === 2) return json({ collectionIds: Object.keys(fakeDb[parts[1]] || {}) });
          return json({ collectionIds: [] }); // no nested subcollections
        }
        const [, , uid, coll] = path.split('/');
        return json({ documents: (fakeDb[uid]?.[coll] || []).map(r => encodeDoc(uid, coll, r)) });
      }

      if (u.startsWith('https://api.github.com/repos/me/dayos-backups')) {
        const p = u.replace('https://api.github.com/repos/me/dayos-backups', '');
        const method = init.method || 'GET';
        if (p === '') return json({ private: private_, default_branch: 'main', html_url: 'https://github.com/me/dayos-backups' });
        if (p.startsWith('/contents/')) {
          const name = p.slice('/contents/'.length).split('?')[0];
          if (!state.files[name]) return json({ message: 'Not Found' }, 404);
          return json({ content: Buffer.from(state.files[name], 'utf8').toString('base64') });
        }
        if (p.startsWith('/git/ref/heads/')) {
          if (!state.refExists) return json({ message: 'Not Found' }, 404);
          return json({ object: { sha: 'parent-sha' } });
        }
        if (p.startsWith('/git/commits/')) return json({ tree: { sha: 'base-tree' } });
        if (p === '/git/blobs' && method === 'POST') {
          const body = JSON.parse(init.body);
          const sha = `blob-${Object.keys(state.blobs).length}`;
          state.blobs[sha] = Buffer.from(body.content, 'base64').toString('utf8');
          return json({ sha });
        }
        if (p === '/git/trees' && method === 'POST') {
          const body = JSON.parse(init.body);
          state.lastTree = body;
          for (const t of body.tree) state.files[t.path] = state.blobs[t.sha];
          return json({ sha: 'tree-sha' });
        }
        if (p === '/git/commits' && method === 'POST') {
          const body = JSON.parse(init.body);
          state.commits.push(body);
          return json({ sha: 'new-commit-sha', html_url: 'https://github.com/me/dayos-backups/commit/new' });
        }
        if (p.startsWith('/git/refs')) { state.refExists = true; return json({ ok: true }); }
      }
      return json({ message: `unexpected call ${u}` }, 500);
    },
  };
}

const ENV = { BACKUP_GITHUB_REPO: 'me/dayos-backups', BACKUP_GITHUB_TOKEN: 'ghp_fake', FIREBASE_SERVICE_ACCOUNT: SA };
const realFetch = globalThis.fetch;

async function withWorld(opts, fn) {
  const world = makeFakeWorld(opts);
  globalThis.fetch = world.fetch;
  B._resetStatusCache();
  try { return await fn(world); } finally { globalThis.fetch = realFetch; }
}

// 7a. First run into an empty repo.
await withWorld({ emptyRepo: true }, async (world) => {
  const out = await B.runBackup({ env: ENV });
  eq(out.status, 'ok', 'first run into an empty repo succeeds');
  eq(out.totalRecords, 4, 'the run reports the record count it wrote');
  ok(world.state.commits.length === 1, 'exactly one commit');
  eq(world.state.commits[0].parents, [], 'the first commit in an empty repo has no parent');
  eq(world.state.lastTree.tree.map(t => t.path).sort(), ['HOW-TO-RESTORE.md', 'backup-status.json', 'dayos-backup.json'],
     'journal, sidecar and recovery notes land in ONE commit');

  const written = JSON.parse(world.state.files['dayos-backup.json']);
  eq(written.users.u1.counts, { blocks: 2, captures: 1, meta: 1 }, 'the committed file holds the journal');
  ok(!JSON.stringify(written).includes('fcm-token-abc'), 'no device push token reaches the backup file');
  ok(world.state.files['HOW-TO-RESTORE.md'].includes('Settings → Backup'), 'the recovery notes tell you where the restore lives');
});

// 7b. Second run with nothing changed — must not commit.
await withWorld({ existingStatus: { contentHash: B.contentHashOf(snap), totalRecords: 4, lastBackupAt: '2026-09-04T18:00:00Z' } }, async (world) => {
  const out = await B.runBackup({ env: ENV });
  eq(out.status, 'unchanged', 'an unchanged journal reports "unchanged"');
  eq(world.state.commits.length, 0, 'an unchanged journal commits nothing');
});

// 7c. The repo has been flipped public.
await withWorld({ private_: false }, async (world) => {
  const out = await B.runBackup({ env: ENV });
  eq(out.status, 'blocked', 'a public destination repo is refused');
  ok(/PUBLIC/.test(out.detail), 'the refusal says why');
  eq(world.state.commits.length, 0, 'nothing is written to a public repo');
});

// 7d. The journal has shrunk.
await withWorld({ existingStatus: { contentHash: 'something-else', totalRecords: 900, lastBackupAt: '2026-09-04T18:00:00Z' } }, async (world) => {
  const out = await B.runBackup({ env: ENV });
  eq(out.status, 'blocked', 'a journal that lost most of itself is refused');
  eq(world.state.commits.length, 0, "yesterday's backup is left untouched");

  const forced = await B.runBackup({ env: ENV, force: true });
  eq(forced.status, 'ok', 'force pushes a deliberate deletion through');
  ok(world.state.commits.length === 1, 'the forced run commits');
});

// 7e. Status reads live from the repo, never from anything the app stores.
await withWorld({ existingStatus: { lastBackupAt: '2026-09-04T18:00:00Z', totalRecords: 4, contentHash: 'x' } }, async () => {
  const s = await B.readStatus({ env: ENV });
  eq(s.configured, true, 'status reports configured');
  eq(s.ok, true, 'status is healthy when the sidecar reads');
  eq(s.lastBackupAt, '2026-09-04T18:00:00Z', 'status carries the real last-backup time from the repo');
  ok(!JSON.stringify(s).includes('ghp_fake'), 'the GitHub token never appears in the status response');
});

await withWorld({ private_: false }, async () => {
  const s = await B.readStatus({ env: ENV });
  eq(s.ok, false, 'status is unhealthy while the repo is public');
  ok(s.isPublic, 'status names the public-repo problem specifically');
});

// ── 8. The endpoint's gates ──────────────────────────────────────────────────
//
// There is no unauthenticated path into /api/backup. Two callers, two
// credentials: the scheduler's CRON_SECRET, and the founder's Firebase ID
// token (verified by the same helper api/ai/claude.mjs uses, so this exercises
// the real signature check rather than a mock of it).

{
  const FB_KEYS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
  const KID = 'sim-kid';
  const { publicKey: fbPub, privateKey: fbPriv } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const { createSign } = await import('node:crypto');
  const b64u = (s) => Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const makeIdToken = ({ uid = 'founder-uid', signWith = fbPriv, aud = 'dayos-sim' } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
    const pl = b64u(JSON.stringify({ iss: `https://securetoken.google.com/${aud}`, aud, exp: now + 3600, iat: now, sub: uid }));
    const sig = createSign('RSA-SHA256').update(`${h}.${pl}`).sign(signWith).toString('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${h}.${pl}.${sig}`;
  };

  // Verification fetches Google's public keys, so the fake world must serve
  // them. It caches for an hour inside claude.mjs, which is fine here.
  const worldFor = (opts) => {
    const w = makeFakeWorld(opts);
    const inner = w.fetch;
    w.fetch = async (url, init) => {
      if (String(url).startsWith(FB_KEYS_URL)) {
        return new Response(JSON.stringify({ [KID]: fbPub }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return inner(url, init);
    };
    return w;
  };

  const fakeRes = () => {
    const r = { code: null, body: null, headers: {} };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.setHeader = (k, v) => { r.headers[k] = v; };
    return r;
  };

  const call = async (opts, { auth = '', url = '/api/backup' } = {}) => {
    const w = worldFor(opts);
    globalThis.fetch = w.fetch;
    B._resetStatusCache();
    const prevEnv = { ...process.env };
    Object.assign(process.env, ENV, { CRON_SECRET: 'cron-secret-value', ALLOWED_UIDS: 'founder-uid' });
    const res = fakeRes();
    try {
      await B.default({ url, headers: { authorization: auth } }, res);
    } finally {
      globalThis.fetch = realFetch;
      for (const k of Object.keys(process.env)) if (!(k in prevEnv)) delete process.env[k];
      Object.assign(process.env, prevEnv);
    }
    return { res, state: w.state };
  };

  let r = await call({ emptyRepo: true }, { auth: '' });
  eq(r.res.code, 401, 'no credential is rejected');
  eq(r.state.commits.length, 0, 'an unauthenticated call runs no backup');

  r = await call({ emptyRepo: true }, { auth: 'Bearer wrong-secret' });
  eq(r.res.code, 401, 'a wrong secret is rejected');

  r = await call({ emptyRepo: true }, { auth: 'Bearer cron-secret-value' });
  eq(r.res.code, 200, 'the scheduler is admitted');
  eq(r.res.body.status, 'ok', 'the scheduled run backs up');
  eq(r.state.commits.length, 1, 'the scheduled run commits');

  r = await call({ emptyRepo: true }, { auth: `Bearer ${makeIdToken()}` });
  eq(r.res.code, 200, 'a valid Firebase ID token is admitted');
  eq(r.res.body.status, 'ok', 'the owner can run a backup by hand');

  // A token signed by someone else's key must not open the door.
  const { privateKey: attacker } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  r = await call({ emptyRepo: true }, { auth: `Bearer ${makeIdToken({ signWith: attacker })}` });
  eq(r.res.code, 401, 'a forged ID token is rejected');
  eq(r.state.commits.length, 0, 'a forged token runs no backup');

  // A real Firebase user who is not on the allow-list.
  r = await call({ emptyRepo: true }, { auth: `Bearer ${makeIdToken({ uid: 'someone-else' })}` });
  eq(r.res.code, 401, 'a verified but non-allow-listed uid is rejected');

  r = await call({ existingStatus: { contentHash: 'x', totalRecords: 4, lastBackupAt: '2026-09-04T18:00:00Z' } },
                 { auth: `Bearer ${makeIdToken()}`, url: '/api/backup?status=1' });
  eq(r.res.code, 200, 'status is served to the owner');
  eq(r.res.body.lastBackupAt, '2026-09-04T18:00:00Z', 'status carries the real last-backup time');
  eq(r.state.commits.length, 0, 'reading status never writes');

  // The footgun this guards: a typo in the query string must not silently run
  // a full backup when the caller asked to read a number.
  r = await call({ emptyRepo: true }, { auth: 'Bearer cron-secret-value', url: '/api/backup?staus=1' });
  eq(r.res.code, 400, 'an unrecognised parameter is refused, not treated as "run"');
  eq(r.state.commits.length, 0, 'a mistyped status request runs no backup');
}

// ── 9. vercel.json actually schedules it ─────────────────────────────────────
//
// The gate next door (check:cron in TradeGenie) exists because a scheduled job
// that is never scheduled is indistinguishable from one that is working. This
// is the cheap half of that: the cron entry and the route must agree.
{
  const fs = await import('node:fs');
  const cfg = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const cron = (cfg.crons || []).find(c => c.path.startsWith('/api/backup'));
  ok(!!cron, 'vercel.json schedules /api/backup');
  ok(fs.existsSync(new URL('../api/backup.mjs', import.meta.url)), 'the scheduled route exists on disk');
}

console.log(failed ? `\n${failed} FAILED` : '\nAll backup sims passed');
process.exit(failed ? 1 : 0);
