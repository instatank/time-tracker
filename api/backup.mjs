// DayOS offsite backup — one file, zero dependencies.
//
// WHAT THIS IS
// A scheduled copy of the whole journal, committed as one JSON file into a
// SEPARATE, PRIVATE GitHub repository. Vercel cron hits it daily; nothing
// commits on a day the journal did not change.
//
// WHY GITHUB, having measured the thing first
// DayOS is text. A block is a few hundred bytes, a capture a couple of KB —
// a year of daily journaling is single-digit megabytes and will stay that way.
// At that size every "real" backup product solves a problem this app does not
// have, and the four things that actually matter are: it costs nothing, it is
// somewhere else entirely from Firebase and Vercel, it keeps every past version
// with no retention policy to maintain, and the founder can recover it from a
// browser — which is the only interface he has. Git history gives all four free.
//
// WHY IT READS FIRESTORE AND NOT THE DEVICE
// DayOS's order of truth is module vars -> localStorage -> Firestore mirror.
// The mirror is the only copy that is cross-device, always current and reachable
// without anyone opening the app — which is the whole point of an unattended
// backup. Reading the device would mean the backup only happens when the founder
// remembers to visit a screen, which is the failure this is meant to remove.
//
// WHY IT DISCOVERS COLLECTIONS INSTEAD OF LISTING THEM
// CLAUDE.md's new-collection checklist already has six things to remember, and
// "silent cross-device data loss" is what happens when one is missed. A backup
// with a hardcoded collection list would be a seventh — and the one whose
// failure you only discover when you need it. So this walks whatever is
// actually in Firestore. A collection added next year is in the backup the day
// it ships, with nobody having to remember this file exists.
//
// NEVER LOAD-BEARING. Every failure path returns a description and changes
// nothing. The app works exactly as it did before backups existed.
//
// OFF UNTIL CONFIGURED. With no BACKUP_GITHUB_TOKEN / BACKUP_GITHUB_REPO there
// is no network call to GitHub at all and not one byte of the journal leaves
// Google's infrastructure. Turning it on is an explicit act — this is a
// personal journal going to a third party, and that is not a decision code
// should make quietly.

import { createSign, createHash, timingSafeEqual } from 'node:crypto';
// ONE Firebase token verifier in this codebase, not two. api/ai/claude.mjs
// already had to solve exactly this — verify an ID token from the browser
// against Google's rotating public keys — and it is covered by
// tests/api-hardening.mjs. A second copy here would be the two-tokenizer
// mistake in new clothes, and the copy nobody tests is always the one that
// drifts. Importing it pulls in constants and function definitions only; the
// AI handler is the module's default export and is never invoked from here.
import { verifyFirebaseToken, uidAllowed } from './ai/claude.mjs';

const DS_SCOPE       = 'https://www.googleapis.com/auth/datastore';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';
const GITHUB_API     = 'https://api.github.com';
const UA             = 'dayos-backup';

/** The file the whole journal lands in. One fixed path, overwritten each run:
 *  git history IS the archive, so dated filenames would only pile up in the
 *  tree while adding nothing the file's own history does not already give. */
export const BACKUP_PATH   = 'dayos-backup.json';
/** A ~2KB sidecar. Lets a run answer "what did last night's backup hold, and
 *  has anything changed since?" without downloading a multi-megabyte file, and
 *  lets the Settings panel show live status for the cost of one small request. */
export const STATUS_PATH   = 'backup-status.json';
/** Recovery instructions written INTO the backup repo. Whoever is holding this
 *  file when DayOS is gone is the least equipped to work out what to do with
 *  it, so the instructions live beside the data — not in a codebase that may
 *  no longer exist. Identical content re-commits to the same git blob, so
 *  rewriting it every run costs nothing. */
export const RECOVERY_PATH = 'HOW-TO-RESTORE.md';

/** Bumped only if the shape below changes in a way a reader must know about.
 *  The client restore refuses a version it was not written to understand
 *  rather than guessing at an unfamiliar file. */
export const BACKUP_FORMAT_VERSION = 1;

/** Push tokens, not journal data. Deliberately excluded: they regenerate on
 *  every app load, they are per-device state nobody would ever want restored,
 *  and they are the one collection in the database whose contents are
 *  credentials. A backup should not be the place a stale device credential
 *  survives longest. */
const SKIP_COLLECTIONS = new Set(['devices']);

/** Page size for document listing. Firestore's own ceiling is higher, but a
 *  personal journal fits in a handful of pages either way and smaller pages
 *  keep any single response comfortably under the function's memory. */
const PAGE_SIZE = 300;

// ── auth helpers ─────────────────────────────────────────────────────────────

// Constant-time compare, same shape as api/cron-reminders.mjs. Length is
// checked plainly first because timingSafeEqual throws on mismatched buffers,
// and the length of a secret is not the part worth hiding.
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function b64url(input) {
  const b = typeof input === 'string' ? Buffer.from(input) : input;
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: sa.client_email,
    scope: DS_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))}`;
  const sig = b64url(createSign('RSA-SHA256').update(unsigned).sign(sa.private_key.replace(/\\n/g, '\n')));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(`${unsigned}.${sig}`)}`,
  });
  if (!r.ok) throw new Error(`OAuth token failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

// ── Firestore value decoding ─────────────────────────────────────────────────
//
// The REST API returns every field wrapped in its type ({stringValue: "x"}).
// The backup stores PLAIN JSON instead, for two reasons that both matter more
// than round-trip purity: a person can open the file in a browser and read
// their own journal, and the client restore writes plain JS through the
// Firebase SDK, so plain JSON is exactly the shape it needs.
//
// The one lossy edge: a real Firestore Timestamp decodes to an ISO string and
// would restore as a string. DayOS stores every date and time as an IST string
// already (see docs/second-brain-integration.md, invariant 2), so nothing in
// this app is affected — but a future field typed as a Timestamp would be, and
// that is why this comment exists.

export function decodeValue(v, issues, path) {
  if (v == null || typeof v !== 'object') return null;
  if ('nullValue'      in v) return null;
  if ('stringValue'    in v) return v.stringValue;
  if ('booleanValue'   in v) return v.booleanValue;
  if ('integerValue'   in v) return Number(v.integerValue);
  if ('doubleValue'    in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('bytesValue'     in v) return { __bytes_b64: v.bytesValue };
  if ('referenceValue' in v) return { __ref: v.referenceValue };
  if ('geoPointValue'  in v) return { __geo: v.geoPointValue };
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map((x, i) => decodeValue(x, issues, `${path}[${i}]`));
  if ('mapValue'       in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = decodeValue(val, issues, `${path}.${k}`);
    return out;
  }
  // Never silently drop something we do not understand — a field type nobody
  // anticipated is exactly the thing that would go missing without a word.
  issues.push(`Unrecognised Firestore value type at ${path}: ${Object.keys(v).join(',')}`);
  return null;
}

export function decodeDocument(doc, issues) {
  const id = String(doc.name || '').split('/').pop();
  const out = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) {
    if (k === 'id') continue; // the document id is authoritative; a stored `id` field cannot override it
    out[k] = decodeValue(v, issues, `${id}.${k}`);
  }
  return out;
}

// ── the snapshot ─────────────────────────────────────────────────────────────
//
// Built through injected readers so the whole walk — including every guard
// below it — is testable offline against a fake database. That is not a
// nicety: none of this can be exercised here against real credentials, so
// anything not injectable would ship unproven.

/**
 * @param {object} io
 * @param {() => Promise<string[]>} io.listUids
 * @param {(uid: string) => Promise<string[]>} io.listCollections
 * @param {(uid: string, coll: string) => Promise<object[]>} io.listDocuments
 * @param {(uid: string, coll: string, docId: string) => Promise<string[]>} io.probeSubcollections
 */
export async function buildSnapshot(io, now = new Date()) {
  const issues = [];
  const users = {};
  let totalRecords = 0;

  const uids = await io.listUids();
  if (!uids.length) issues.push('No user found in Firestore.');

  for (const uid of uids) {
    const collections = (await io.listCollections(uid)).filter(c => !SKIP_COLLECTIONS.has(c));
    const data = {};
    const counts = {};
    for (const coll of collections) {
      const docs = await io.listDocuments(uid, coll);
      const decoded = docs.map(d => decodeDocument(d, issues));
      data[coll] = decoded;
      counts[coll] = decoded.length;
      totalRecords += decoded.length;

      // Structural probe, one call per collection, not per document. DayOS
      // stores no nested subcollections today; if that ever changes, this walk
      // would quietly stop at the parent. Probing the first document costs
      // ~15 requests a run and turns a silent gap into a named one.
      if (decoded.length && io.probeSubcollections) {
        const nested = await io.probeSubcollections(uid, coll, decoded[0].id);
        if (nested.length) {
          issues.push(`${coll}/${decoded[0].id} has nested subcollections (${nested.join(', ')}) that this backup does not walk.`);
        }
      }
    }
    users[uid] = { collections: collections.slice().sort(), counts, data };
  }

  const media = countMedia(users);

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: 'dayos',
    source: 'firestore',
    exportedAt: now.toISOString(),
    // Which deployment wrote it. Months later, after a bad restore, "what code
    // produced this file?" is the only question that matters about it.
    appCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    totalRecords,
    users,
    media,
    issues,
  };
}

// Voice notes and attachments live as embedded arrays on their parent document
// (contract invariant 5), so the POINTERS are backed up here for free — the
// BYTES are not: they are in Firebase Storage, which is the same failure domain
// this backup exists to escape.
//
// So the manifest is the honest half-measure: after a total loss you would know
// exactly what existed, when, on which entry and under what filename, even
// though the audio and images themselves would be gone. That is worth having,
// and it is deliberately not dressed up as more than it is — the Settings panel
// and HOW-TO-RESTORE.md both say the bytes are not covered.
export function countMedia(users) {
  const items = [];
  const walk = (node, parent) => {
    if (Array.isArray(node)) { node.forEach(n => walk(n, parent)); return; }
    if (!node || typeof node !== 'object') return;
    for (const key of ['voiceNotes', 'attachments']) {
      for (const m of (node[key] || [])) {
        if (!m || typeof m !== 'object' || !m.storagePath) continue;
        items.push({
          kind: key === 'voiceNotes' ? 'voice' : (m.kind || 'file'),
          storagePath: m.storagePath,
          title: m.title || null,
          bytes: typeof m.size === 'number' ? m.size : null,
          createdAt: m.createdAt || null,
          deleted: !!m.deletedAt,
          parent,
        });
      }
    }
  };
  for (const [uid, u] of Object.entries(users)) {
    for (const [coll, docs] of Object.entries(u.data || {})) {
      for (const doc of docs) walk(doc, `${uid}/${coll}/${doc.id}`);
    }
  }
  const live = items.filter(i => !i.deleted);
  return {
    note: 'Pointers only. The audio and image bytes live in Firebase Storage and are NOT in this backup.',
    total: items.length,
    live: live.length,
    knownBytes: live.reduce((n, i) => n + (i.bytes || 0), 0),
    items,
  };
}

// ── content hash ─────────────────────────────────────────────────────────────
//
// Hashes the JOURNAL, deliberately not the file. exportedAt changes on every
// run, so hashing the file would make every single day look like a change and
// commit an identical journal forever. Keys are sorted so a reordering by
// Firestore — which makes no ordering promise — cannot read as an edit.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function contentHashOf(snapshot) {
  return createHash('sha256').update(canonicalJson(snapshot.users)).digest('hex');
}

// ── guards ───────────────────────────────────────────────────────────────────
//
// A backup system's own worst failure mode is quietly destroying the thing it
// protects: overwriting a good copy with an empty or truncated one. Each of
// these refuses the run and leaves the last good backup untouched.

/** Guard: the journal has suddenly lost most of itself. Almost always a
 *  partial read or a bad deploy rather than a real deletion — and if it IS a
 *  real deletion, yesterday's copy is precisely what you want kept. */
export function shrinkGuard(previousRecords, nextRecords) {
  if (!previousRecords || previousRecords <= 0) return null;
  if (nextRecords >= previousRecords / 2) return null;
  return `Refusing to back up: Firestore has ${nextRecords} records but the last backup held ${previousRecords} — more than half are gone. The previous backup has been left untouched. If you deleted them on purpose, run the backup again with force=1.`;
}

/** Guard: the walk itself went wrong. A snapshot assembled from a failed read
 *  looks exactly like a snapshot of a journal that was deleted, and committing
 *  it would destroy the good copy. */
export function integrityGuard(snapshot) {
  if (snapshot.readError) return `Refusing to back up: reading Firestore failed (${snapshot.readError}). Nothing was written.`;
  if (!Object.keys(snapshot.users).length) return 'Refusing to back up: no user data was found in Firestore. Nothing was written.';
  if (snapshot.totalRecords === 0) return 'Refusing to back up: the read returned zero records. That is far more likely to be a broken read than an empty journal, so the previous backup has been left untouched.';
  return null;
}

// ── Firestore readers (the real ones) ────────────────────────────────────────

function firestoreIo(projectId, token) {
  const root = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents`;
  const auth = { Authorization: `Bearer ${token}` };

  const getJson = async (url, init) => {
    const r = await fetch(url, init);
    if (!r.ok) throw new Error(`Firestore ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return r.json();
  };

  const listCollectionIds = async (docPath) => {
    const ids = [];
    let pageToken;
    do {
      const body = await getJson(`${root}${docPath}:listCollectionIds`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageSize: 100, pageToken }),
      });
      ids.push(...(body.collectionIds || []));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return ids;
  };

  return {
    // users/{uid} is not a concrete document in DayOS — a uid exists only as a
    // path segment above real subcollections. showMissing=true is the one
    // listing mode that returns those "missing" parents, which is why a plain
    // list of the users collection comes back empty and this does not.
    listUids: async () => {
      const uids = new Set();
      let pageToken;
      do {
        const body = await getJson(`${root}/users?pageSize=${PAGE_SIZE}&showMissing=true${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: auth });
        for (const d of (body.documents || [])) {
          const id = String(d.name || '').split('/').pop();
          if (id) uids.add(id);
        }
        pageToken = body.nextPageToken;
      } while (pageToken);
      return [...uids];
    },
    listCollections: (uid) => listCollectionIds(`/users/${uid}`),
    listDocuments: async (uid, coll) => {
      const docs = [];
      let pageToken;
      do {
        const body = await getJson(`${root}/users/${uid}/${encodeURIComponent(coll)}?pageSize=${PAGE_SIZE}${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: auth });
        docs.push(...(body.documents || []));
        pageToken = body.nextPageToken;
      } while (pageToken);
      return docs;
    },
    probeSubcollections: (uid, coll, docId) => listCollectionIds(`/users/${uid}/${encodeURIComponent(coll)}/${encodeURIComponent(docId)}`),
  };
}

// ── GitHub destination ───────────────────────────────────────────────────────

export function destinationFromEnv(env = process.env) {
  const token = (env.BACKUP_GITHUB_TOKEN || '').trim();
  const repo  = (env.BACKUP_GITHUB_REPO  || '').trim();
  if (!token || !repo) return null;
  const [owner, name] = repo.split('/');
  if (!owner || !name) return null;
  return { owner, repo: name, branch: (env.BACKUP_GITHUB_BRANCH || '').trim() || null, token };
}

/** What the app can see of its own configuration, for the Settings panel.
 *  The repository path is safe to show — it is not a secret, and seeing it
 *  spelled back is how a typo gets noticed. The TOKEN never leaves here in any
 *  form, only whether one is present. */
export function destinationEnvState(env = process.env) {
  const repo  = (env.BACKUP_GITHUB_REPO  || '').trim();
  const token = (env.BACKUP_GITHUB_TOKEN || '').trim();
  return {
    repoSet: !!repo,
    tokenSet: !!token,
    repo: repo || null,
    // The trap worth naming: entering just "dayos-backups" without the owner
    // makes destinationFromEnv() return null, which is indistinguishable from
    // "never configured" — so the panel would report "off" while the variable
    // sits right there. The one mistake most likely to be made is the one with
    // no error message.
    repoMalformed: !!repo && !/^[^/\s]+\/[^/\s]+$/.test(repo),
  };
}

function gh(dest) {
  const headers = {
    Authorization: `Bearer ${dest.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': UA,
  };
  const base = `${GITHUB_API}/repos/${dest.owner}/${dest.repo}`;
  const call = async (path, init = {}) => {
    const r = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await r.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
    return { ok: r.ok, status: r.status, body, text };
  };
  return { call };
}

// ── the run ──────────────────────────────────────────────────────────────────

export async function runBackup({ force = false, env = process.env } = {}) {
  const dest = destinationFromEnv(env);
  if (!dest) {
    const state = destinationEnvState(env);
    return {
      status: 'off',
      detail: state.repoMalformed
        ? `BACKUP_GITHUB_REPO is set to "${state.repo}" but must be owner/repo. No backup was attempted.`
        : 'Offsite backup is not configured. Set BACKUP_GITHUB_REPO and BACKUP_GITHUB_TOKEN to switch it on.',
      env: state,
    };
  }

  let sa;
  try { sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT); }
  catch { return { status: 'failed', detail: 'FIREBASE_SERVICE_ACCOUNT is missing or not valid JSON.' }; }

  // 1. Read the journal. A failure here is recorded on the snapshot rather than
  //    thrown, so integrityGuard is the single place that decides what a bad
  //    read means — one refusal path, not two.
  let snapshot;
  try {
    const token = await getAccessToken(sa);
    snapshot = await buildSnapshot(firestoreIo(sa.project_id, token));
  } catch (e) {
    snapshot = { users: {}, totalRecords: 0, readError: e.message };
  }
  const integrity = integrityGuard(snapshot);
  if (integrity) return { status: 'blocked', detail: integrity };

  const api = gh(dest);

  // 2. Guard: never write a private journal into a public repository. Checked
  //    on EVERY run, not once at setup — a repo can be flipped public later,
  //    and a journal in a public repo is worse than having no backup at all.
  const repoInfo = await api.call('');
  if (!repoInfo.ok) {
    return { status: 'failed', detail: `Cannot reach the backup repo ${dest.owner}/${dest.repo} (GitHub ${repoInfo.status}). Check BACKUP_GITHUB_REPO and that the token has Contents: read and write on it.` };
  }
  if (repoInfo.body?.private !== true) {
    return { status: 'blocked', detail: `Refusing to back up: ${dest.owner}/${dest.repo} is PUBLIC. Make it private, or point BACKUP_GITHUB_REPO at a private repo.` };
  }
  const branch = dest.branch || repoInfo.body.default_branch || 'main';

  // 3. Previous run's sidecar: the unchanged check and the shrink guard both
  //    read from it. A missing or corrupt one must not stop tonight's backup —
  //    losing the shrink guard for one run is a far smaller problem than
  //    skipping the backup entirely.
  let previous = null;
  const prevRes = await api.call(`/contents/${STATUS_PATH}?ref=${encodeURIComponent(branch)}`);
  if (prevRes.ok && prevRes.body?.content) {
    try { previous = JSON.parse(Buffer.from(prevRes.body.content, 'base64').toString('utf8')); } catch { /* corrupt sidecar */ }
  }

  const contentHash = contentHashOf(snapshot);

  if (!force) {
    const shrink = shrinkGuard(previous?.totalRecords, snapshot.totalRecords);
    if (shrink) return { status: 'blocked', detail: shrink, totalRecords: snapshot.totalRecords };
  }

  // 4. Nothing changed — no commit. Keyed on the hash of the DATA, not on the
  //    record counts: editing a note changes no count and must still be caught.
  if (previous?.contentHash === contentHash) {
    return { status: 'unchanged', detail: 'The journal has not changed since the last backup, so nothing was committed.', lastBackupAt: previous.lastBackupAt || null, totalRecords: snapshot.totalRecords };
  }

  // 5. One commit, three files, all or nothing.
  const status = {
    lastBackupAt: snapshot.exportedAt,
    totalRecords: snapshot.totalRecords,
    contentHash,
    appCommit: snapshot.appCommit,
    users: Object.fromEntries(Object.entries(snapshot.users).map(([uid, u]) => [uid, { collections: u.collections, counts: u.counts }])),
    media: { total: snapshot.media.total, live: snapshot.media.live, knownBytes: snapshot.media.knownBytes, note: snapshot.media.note },
    issues: snapshot.issues,
  };

  const files = [
    { path: BACKUP_PATH,   content: JSON.stringify(snapshot, null, 2) },
    { path: STATUS_PATH,   content: JSON.stringify(status, null, 2) },
    { path: RECOVERY_PATH, content: recoveryDoc(dest) },
  ];

  try {
    const commit = await commitFiles(api, branch, files, `DayOS backup ${snapshot.exportedAt.slice(0, 10)} — ${snapshot.totalRecords} records`);
    return {
      status: 'ok',
      detail: `Backed up ${snapshot.totalRecords} records to ${dest.owner}/${dest.repo}.`,
      commitUrl: commit.html_url,
      commitSha: commit.sha,
      totalRecords: snapshot.totalRecords,
      bytes: Buffer.byteLength(files[0].content),
      media: status.media,
      issues: snapshot.issues,
    };
  } catch (e) {
    return { status: 'failed', detail: `Backup read fine but the commit failed: ${e.message}` };
  }
}

// Git data API: blobs -> tree -> commit -> move the branch. Doing it this way
// rather than three PUT /contents calls is what makes the run atomic — the
// journal, its sidecar and the recovery notes land together or not at all, so
// a status file can never claim a backup that is not actually there.
async function commitFiles(api, branch, files, message) {
  const refRes = await api.call(`/git/ref/heads/${encodeURIComponent(branch)}`);
  // 404 = a repo with no commits yet. That is the normal state of a
  // freshly-created backup repo, so the first run has to work in it.
  const parentSha = refRes.ok ? refRes.body.object.sha : null;
  let baseTree = null;
  if (parentSha) {
    const commitRes = await api.call(`/git/commits/${parentSha}`);
    if (!commitRes.ok) throw new Error(`git/commits ${commitRes.status}`);
    baseTree = commitRes.body.tree.sha;
  }

  const tree = [];
  for (const f of files) {
    const blob = await api.call('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: Buffer.from(f.content, 'utf8').toString('base64'), encoding: 'base64' }),
    });
    if (!blob.ok) throw new Error(`git/blobs ${blob.status} for ${f.path}: ${blob.text.slice(0, 200)}`);
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.body.sha });
  }

  const treeRes = await api.call('/git/trees', {
    method: 'POST',
    body: JSON.stringify(baseTree ? { base_tree: baseTree, tree } : { tree }),
  });
  if (!treeRes.ok) throw new Error(`git/trees ${treeRes.status}: ${treeRes.text.slice(0, 200)}`);

  const commitRes = await api.call('/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeRes.body.sha, parents: parentSha ? [parentSha] : [] }),
  });
  if (!commitRes.ok) throw new Error(`git/commits ${commitRes.status}: ${commitRes.text.slice(0, 200)}`);

  const refPath = `/git/refs/heads/${encodeURIComponent(branch)}`;
  const move = parentSha
    ? await api.call(refPath, { method: 'PATCH', body: JSON.stringify({ sha: commitRes.body.sha }) })
    : await api.call('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commitRes.body.sha }) });
  if (!move.ok) throw new Error(`moving ${branch} failed: ${move.status} ${move.text.slice(0, 200)}`);

  return commitRes.body;
}

// ── the recovery notes, written into the backup repo ─────────────────────────

function recoveryDoc(dest) {
  return `# How to restore DayOS from this backup

This repository holds a complete copy of the DayOS journal. You are reading it
because something went wrong, so this file assumes nothing.

## What is here

- \`${BACKUP_PATH}\` — the whole journal as one JSON file. Every version ever
  backed up is in this repository's git history, so you can also recover the
  state from any earlier day by browsing the file's history on GitHub.
- \`${STATUS_PATH}\` — a small summary of the most recent backup: when it ran,
  how many records, and per-collection counts.
- This file.

## What is NOT here

**Voice-note audio and attached images/files are not in this backup.** Those
bytes live in Firebase Storage. The backup records every one of them —
filename, title, size, date and which entry it belonged to, under \`media\` in
\`${BACKUP_PATH}\` — so you can see exactly what existed, but the audio and
images themselves cannot be recovered from this repository.

Device push-notification tokens are also excluded, on purpose. They regenerate.

## Restoring into a working DayOS

1. Open the app, sign in with the same Google account.
2. Download \`${BACKUP_PATH}\` from this repository (open the file on GitHub and
   press the download / raw button).
3. In the app: **Settings → Backup → Restore from a file**, and pick it.
4. The restore **only fills gaps** by default: it writes entries whose ids are
   missing and never overwrites or deletes anything that is already there. If
   you want the backup's version of an entry to replace what is in the app, tick
   "overwrite existing entries" — that discards edits made since the backup.

## Reading it without the app

\`${BACKUP_PATH}\` is plain readable JSON. The shape is:

\`\`\`
{
  "formatVersion": 1,
  "exportedAt": "2026-09-05T18:00:00.000Z",
  "users": {
    "<your firebase uid>": {
      "counts":  { "blocks": 412, "captures": 980, ... },
      "data":    { "blocks": [ { "id": "...", "date": "2026-09-05", ... } ], ... }
    }
  },
  "media": { "items": [ ... ] }
}
\`\`\`

Every entry keeps its original field names. \`deletedAt\` on an entry means it
was in the Trash when the backup ran.

## Rebuilding Firestore by hand

If the app itself is gone, the data can be written straight back to Firestore:
each entry in \`data.<collection>\` becomes the document
\`users/<uid>/<collection>/<that entry's id>\`. That mapping is the whole schema.

---
Written automatically by DayOS on every backup run. Destination: ${dest.owner}/${dest.repo}.
`;
}

// ── status, for the Settings panel ───────────────────────────────────────────
//
// Read LIVE from the backup repo, never from anything this app stores about
// itself. A self-reported status keeps cheerfully saying "backed up" long
// after backups have actually stopped, and a backup you wrongly believe you
// have is worse than knowing you have none.
//
// Returns metadata only — dates, counts, collection names. No journal content
// passes through here, which is what makes it safe to answer without the
// founder's credentials, in an app that has no server-side session of its own.

let _statusCache = { at: 0, value: null };

export async function readStatus({ env = process.env, now = Date.now() } = {}) {
  if (_statusCache.value && now - _statusCache.at < 60_000) return _statusCache.value;

  const state = destinationEnvState(env);
  const dest = destinationFromEnv(env);
  let value;
  if (!dest) {
    value = { configured: false, env: state, detail: state.repoMalformed
      ? 'BACKUP_GITHUB_REPO must be owner/repo.'
      : 'Offsite backup is not configured yet.' };
  } else {
    const api = gh(dest);
    const repoInfo = await api.call('');
    if (!repoInfo.ok) {
      value = { configured: true, env: state, ok: false, detail: `Cannot reach ${state.repo} (GitHub ${repoInfo.status}). Check the repo name and that the token has Contents: read and write on it.` };
    } else if (repoInfo.body?.private !== true) {
      value = { configured: true, env: state, ok: false, isPublic: true, detail: `${state.repo} is PUBLIC — backups are refused until it is private.` };
    } else {
      const branch = dest.branch || repoInfo.body.default_branch || 'main';
      const res = await api.call(`/contents/${STATUS_PATH}?ref=${encodeURIComponent(branch)}`);
      if (!res.ok) {
        value = { configured: true, env: state, ok: false, detail: 'Configured, but no backup has run yet.' };
      } else {
        let parsed = null;
        try { parsed = JSON.parse(Buffer.from(res.body.content, 'base64').toString('utf8')); } catch { /* corrupt */ }
        value = parsed
          ? { configured: true, env: state, ok: true, branch, repoUrl: repoInfo.body.html_url, ...parsed }
          : { configured: true, env: state, ok: false, detail: 'The status file in the backup repo could not be read.' };
      }
    }
  }
  _statusCache = { at: now, value };
  return value;
}

/** Test seam — the module-level cache would otherwise leak between sims. */
export function _resetStatusCache() { _statusCache = { at: 0, value: null }; }

// ── HTTP ─────────────────────────────────────────────────────────────────────

/** Who is asking. Two callers, deliberately authenticated in two different
 *  ways, because they are two different things:
 *
 *  - The SCHEDULER holds CRON_SECRET. Vercel injects it on the scheduled
 *    invocation; nothing else can produce it.
 *  - The FOUNDER, in a browser, holds a Firebase ID token — the same
 *    credential api/ai/claude.mjs already accepts. This is what lets the
 *    Settings panel show live status and press "Back up now" without anyone
 *    pasting a secret into a URL, where it would sit in browser history.
 *
 *  There is no third, open path. An earlier draft left status unauthenticated
 *  on the grounds that record counts are only metadata; that is true and it
 *  was still the wrong call, because the verifier this app needed already
 *  existed and cost nothing to reuse. */
async function authenticate(req) {
  const auth = req.headers.authorization || '';
  if (process.env.CRON_SECRET && safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`)) {
    return { as: 'cron' };
  }
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); } catch { return null; }
  try {
    const uid = await verifyFirebaseToken(token, sa.project_id);
    if (!uidAllowed(uid)) return null;
    return { as: 'owner', uid };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const who = await authenticate(req);
  if (!who) return res.status(401).json({ status: 'unauthorized' });

  res.setHeader('Cache-Control', 'no-store');

  // Status is metadata only — when the last backup ran, how many records it
  // held, which repo it went to. It is read LIVE from the backup repo rather
  // than from anything this app remembers about itself, because a
  // self-reported status keeps saying "backed up" long after backups have
  // stopped, and a backup you wrongly believe you have is worse than none.
  if (url.searchParams.get('status') === '1') {
    try {
      return res.status(200).json(await readStatus());
    } catch (e) {
      return res.status(200).json({ configured: true, ok: false, detail: `Could not read backup status: ${e.message}` });
    }
  }

  // Explicit intent only. The scheduler calls /api/backup with no parameters;
  // a browser calls ?status=1 or ?run=1. Anything else is a 400 rather than a
  // fall-through, because the fall-through case is a typo like ?staus=1
  // quietly running a full backup when the caller asked to read a number.
  const params = [...url.searchParams.keys()].filter(k => k !== 'force');
  const wantsRun = params.length === 0 || (params.length === 1 && url.searchParams.get('run') === '1');
  if (!wantsRun) {
    return res.status(400).json({ status: 'bad-request', detail: 'Use ?status=1 to read status, ?run=1 to run a backup.' });
  }

  // A manual run. This is also the answer to "is it actually set up right?" —
  // the last mile (a real service account, a real token, a real private repo)
  // cannot be verified from a dev container, only from the deployment that
  // holds the credentials. So the check ships as a button rather than as a
  // claim in a doc.
  //
  // 200 even when the run was refused or failed: this is a report, and a
  // scheduler retrying against a deliberate refusal (a public repo, a shrunken
  // journal) would only hammer the same answer.
  const outcome = await runBackup({ force: url.searchParams.get('force') === '1' });
  return res.status(200).json(outcome);
}
