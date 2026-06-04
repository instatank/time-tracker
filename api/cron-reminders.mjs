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

import { createSign } from 'node:crypto';

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
    label: 'midday',
    istMinute: 17 * 60,                  // 17:00 IST
    title: 'Midday check',
    body:  'Log what you’ve been up to.',
    // Skip if any activity was logged in the last N minutes.
    skipIfActiveWithinMin: 120,
  },
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

async function listUsers(projectId, token) {
  const r = await firestoreGet(`projects/${projectId}/databases/(default)/documents/users`, token);
  return (r?.documents || []).map(d => d.name.split('/').pop());
}

async function listDeviceTokens(projectId, uid, token) {
  const r = await firestoreGet(`projects/${projectId}/databases/(default)/documents/users/${uid}/devices`, token);
  return (r?.documents || [])
    .map(d => ({
      id: d.name.split('/').pop(),
      token: d.fields?.token?.stringValue,
      disabled: d.fields?.disabled?.booleanValue === true,
    }))
    .filter(x => x.token && !x.disabled);
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
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  // Are we inside one of the reminder windows right now?
  const { minuteOfDay: nowMin } = nowInIST();
  const window = REMINDER_WINDOWS.find(w => Math.abs(nowMin - w.istMinute) <= 15);
  if (!window) {
    return res.status(200).json({ ok: true, skip: 'not-in-window', nowMin });
  }

  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
  catch (e) { return res.status(500).json({ ok: false, error: 'bad service account JSON' }); }

  let accessToken;
  try { accessToken = await getAccessToken(sa); }
  catch (e) { return res.status(500).json({ ok: false, error: 'oauth: ' + e.message }); }

  const projectId = sa.project_id;
  const results = [];
  let uids = [];
  try { uids = await listUsers(projectId, accessToken); }
  catch (e) { return res.status(500).json({ ok: false, error: 'list users: ' + e.message }); }

  for (const uid of uids) {
    // State check
    if (window.skipIfActiveWithinMin) {
      const last = await lastActivityISTMin(projectId, uid, accessToken);
      if (last !== null && (nowMin - last) < window.skipIfActiveWithinMin) {
        results.push({ uid, skip: 'recent-activity', minutesSince: nowMin - last });
        continue;
      }
    }
    const devices = await listDeviceTokens(projectId, uid, accessToken);
    for (const d of devices) {
      const r = await sendFcm(projectId, accessToken, d.token, window.title, window.body, { window: window.label });
      results.push({ uid, deviceId: d.id, ...r });
      // Clean up dead tokens — FCM returns 404/UNREGISTERED for endpoints
      // that have unsubscribed (uninstalled PWA, denied permissions, etc).
      if (!r.ok && (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(r.body))) {
        await deleteDevice(projectId, uid, d.id, accessToken);
      }
    }
  }

  return res.status(200).json({ ok: true, window: window.label, results });
}
