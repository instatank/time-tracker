// Vercel cron handler — runs every 30 minutes (see vercel.json), checks if
// we're within ±15 min of one of the IST reminder windows, optionally
// skips on recent activity, then dispatches an FCM push to every
// registered device token for every user.
//
// Auth: Vercel injects `Authorization: Bearer ${CRON_SECRET}` on the
// scheduled invocation. Anything else is rejected.
//
// Zero deps — Google OAuth JWT signing uses node:crypto, Firestore +
// FCM are hit via raw fetch against their REST APIs.

import { createSign, timingSafeEqual } from 'node:crypto';

// Constant-time string compare. Length is checked first with a plain
// comparison so timingSafeEqual is never handed mismatched buffers (it
// throws on those) — the length of a secret is not the part worth hiding.
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

const FCM_SCOPE       = 'https://www.googleapis.com/auth/firebase.messaging';
const DS_SCOPE        = 'https://www.googleapis.com/auth/datastore';
const FIRESTORE_BASE  = 'https://firestore.googleapis.com/v1';
const FCM_SEND        = (projectId) => `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
const IST_OFFSET_MIN  = 5 * 60 + 30;

// Two slots per day in IST. Tolerance window of ±15 min handles the
// every-30-min cron — at worst the reminder fires a few minutes off
// the nominal time, which is fine.
const REMINDER_WINDOWS = [
  {
    label: 'eod',
    istMinute: 23 * 60 + 30,             // 23:30 IST
    title: 'End of day',
    body:  'Anything to capture before tomorrow?',
    skipIfActiveWithinMin: 60,
  },
];

function b64url(input) {
  const b = typeof input === 'string' ? Buffer.from(input) : input;
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: `${FCM_SCOPE} ${DS_SCOPE}`,
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const pk = sa.private_key.replace(/\\n/g, '\n');
  const sig = b64url(createSign('RSA-SHA256').update(unsigned).sign(pk));
  const jwt = `${unsigned}.${sig}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  if (!r.ok) throw new Error(`OAuth token failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function firestoreGet(path, token) {
  const r = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore GET ${path} → ${r.status}`);
  return r.json();
}

async function firestoreQuery(parentPath, query, token) {
  const r = await fetch(`${FIRESTORE_BASE}/${parentPath}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query }),
  });
  if (!r.ok) throw new Error(`Firestore runQuery → ${r.status} ${await r.text()}`);
  return r.json();
}

// Current IST minute-of-day + date (YYYY-MM-DD).
function nowInIST(d = new Date()) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    date: shifted.toISOString().slice(0, 10),
  };
}

// Read the user's latest block today and capture today. Returns the most
// recent activity end-time in IST minute-of-day, or null if nothing today.
async function lastActivityISTMin(projectId, uid, accessToken) {
  const { date: istDate } = nowInIST();
  const parent = `projects/${projectId}/databases/(default)/documents/users/${uid}`;
  let lastMin = null;

  // Blocks: end-of-block = start_time + duration_min
  try {
    const blocksRes = await firestoreQuery(parent, {
      from: [{ collectionId: 'blocks' }],
      where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: istDate } } },
      orderBy: [{ field: { fieldPath: 'start_time' }, direction: 'DESCENDING' }],
      limit: 1,
    }, accessToken);
    const doc = (blocksRes || []).find(r => r.document)?.document;
    if (doc) {
      const start = doc.fields?.start_time?.stringValue || '';
      const dur = parseInt(doc.fields?.duration_min?.integerValue ?? doc.fields?.duration_min?.doubleValue ?? '0', 10);
      const [h, m] = start.split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        lastMin = Math.max(lastMin ?? -1, h * 60 + m + (Number.isFinite(dur) ? dur : 0));
      }
    }
  } catch { /* swallow — treat as no data */ }

  // Captures: pick latest by capDate matching today (timestamp is IST ISO)
  try {
    const capsRes = await firestoreQuery(parent, {
      from: [{ collectionId: 'captures' }],
      orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
      limit: 1,
    }, accessToken);
    const doc = (capsRes || []).find(r => r.document)?.document;
    const ts = doc?.fields?.timestamp?.stringValue || '';
    if (ts.startsWith(istDate)) {
      const t = ts.slice(11, 16); // HH:MM
      const [h, m] = t.split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        lastMin = Math.max(lastMin ?? -1, h * 60 + m);
      }
    }
  } catch { /* swallow */ }

  return lastMin;
}

// Collection-group query over every devices subcollection in the
// database (users/{uid}/devices/{deviceId}). Bypasses the need for
// users/{uid} docs to exist as concrete documents — they don't in
// DayOS, where users are only ever in the path. Returns one row per
// live registered device with uid + token + deviceId derived from
// the doc's full name.
async function listAllDevices(projectId, accessToken) {
  const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'devices', allDescendants: true }],
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`devices group query → ${r.status} ${await r.text()}`);
  const data = await r.json();
  const out = [];
  for (const row of (data || [])) {
    if (!row.document) continue;
    const parts = row.document.name.split('/'); // ../users/{uid}/devices/{id}
    const usersIdx = parts.indexOf('users');
    if (usersIdx < 0) continue;
    const uid = parts[usersIdx + 1];
    const deviceId = parts[parts.length - 1];
    const fields = row.document.fields || {};
    const token = fields.token?.stringValue;
    const disabled = fields.disabled?.booleanValue === true;
    if (!token || disabled) continue;
    out.push({ uid, deviceId, token });
  }
  return out;
}

async function deleteDevice(projectId, uid, deviceId, token) {
  await fetch(`${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}/devices/${deviceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function sendFcm(projectId, accessToken, deviceToken, title, body, dataExtra = {}) {
  const r = await fetch(FCM_SEND(projectId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        // Data-only payload — the service worker formats + displays the
        // notification. Avoids the system auto-showing a stripped version
        // alongside the SW-shown one on some platforms.
        data: { title, body, ...dataExtra },
      },
    }),
  });
  const txt = await r.text();
  return { ok: r.ok, status: r.status, body: txt };
}

export default async function handler(req, res) {
  // Auth: only accept invocations from Vercel's cron with our shared secret.
  const auth = req.headers.authorization || '';
  if (!process.env.CRON_SECRET || !safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  // Which window are we serving? Cron config pins each entry to its own
  // exact UTC time AND tags itself via ?w=midday|eod, so the handler
  // doesn't need to time-match — it just reads the label.
  const url = new URL(req.url, 'http://localhost');
  const wLabel = url.searchParams.get('w');
  const window = REMINDER_WINDOWS.find(w => w.label === wLabel);
  if (!window) {
    return res.status(400).json({ ok: false, error: 'missing or unknown ?w param', wLabel });
  }
  const { minuteOfDay: nowMin } = nowInIST();

  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
  catch (e) { return res.status(500).json({ ok: false, error: 'bad service account JSON' }); }

  let accessToken;
  try { accessToken = await getAccessToken(sa); }
  catch (e) { return res.status(500).json({ ok: false, error: 'oauth: ' + e.message }); }

  const projectId = sa.project_id;
  const results = [];
  let allDevices = [];
  try { allDevices = await listAllDevices(projectId, accessToken); }
  catch (e) { return res.status(500).json({ ok: false, error: 'list devices: ' + e.message }); }

  if (allDevices.length === 0) {
    return res.status(200).json({ ok: true, window: window.label, info: 'no devices registered', results: [] });
  }

  // Group devices by uid so the state check only fires once per user.
  const byUid = {};
  for (const d of allDevices) {
    (byUid[d.uid] = byUid[d.uid] || []).push(d);
  }

  // The response is returned to whoever can reach the endpoint, so it carries
  // counts and per-device delivery status only — never uids, device ids, or
  // FCM response bodies. Those identify the user base and are of no use to
  // the cron caller.
  let usersSkipped = 0;
  let sent = 0;
  let failed = 0;
  let tokensDeleted = 0;

  for (const [uid, devices] of Object.entries(byUid)) {
    if (window.skipIfActiveWithinMin) {
      const last = await lastActivityISTMin(projectId, uid, accessToken);
      if (last !== null && (nowMin - last) < window.skipIfActiveWithinMin) {
        usersSkipped++;
        continue;
      }
    }
    for (const d of devices) {
      const r = await sendFcm(projectId, accessToken, d.token, window.title, window.body, { window: window.label });
      if (r.ok) sent++; else failed++;
      results.push({ ok: r.ok, status: r.status });
      // Clean up dead tokens — FCM returns 404/UNREGISTERED for endpoints
      // that have unsubscribed (uninstalled PWA, denied permissions, etc).
      if (!r.ok && (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(r.body))) {
        await deleteDevice(projectId, uid, d.deviceId, accessToken);
        tokensDeleted++;
      }
    }
  }

  return res.status(200).json({
    ok: true,
    window: window.label,
    counts: {
      devices: allDevices.length,
      users: Object.keys(byUid).length,
      usersSkipped,
      sent,
      failed,
      tokensDeleted,
    },
    results,
  });
}
