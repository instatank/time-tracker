// Vercel serverless route — proxies AI calls to Anthropic.
// Auth: client sends a Firebase ID token in the Authorization header. We
// verify it against the project's public keys (no Firebase SDK / no npm
// deps). FIREBASE_SERVICE_ACCOUNT env var provides the project_id we
// validate against; ANTHROPIC_API_KEY env var provides the Claude key.
//
// One route, multiple tasks. The `task` body field selects a prompt
// definition below — each task has its own model, max_tokens, system
// prompt template, and user-message builder. Keeps both features
// (extract-blocks now, organize later) on a single auth + transport
// surface without coupling their prompt logic.

import { createVerify } from 'node:crypto';

const FB_PUBLIC_KEYS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ── Task registry ───────────────────────────────────────────────
const TASKS = {
  'extract-blocks': {
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    buildUserMessage: (input) => String(input.text || '').slice(0, 5000),
    system: (ctx) => {
      const projects = (ctx.projects || []).length
        ? (ctx.projects).map(p => `"${p}"`).join(', ')
        : '(none — leave projectTag empty)';
      return `You extract structured activity blocks from a personal time-tracking description. The user is logging activities they DID today. Return ONLY a JSON array, no preamble, no markdown code fence.

Available categories (use ONLY these IDs): deep_work, learning, practice, routine, leisure, leaks

Active projects (use ONLY these names exactly, or empty string): ${projects}

Output format:
[
  {
    "start_time": "HH:MM" or null,
    "duration_min": <number>,
    "category": <id from category list>,
    "label": "<keywords only — see rules>",
    "note": "<empty unless essential>",
    "projectTag": "<project name from list or empty>",
    "confidence": "high"|"medium"|"low"
  }
]

Rules:
- Only extract activities the user clearly DID. Skip future plans, intentions, or generic mentions.
- If a start time isn't given but duration is clear, set "start_time" to null.
- Map each activity to the closest category. Never invent categories.
- Match projects to the list exactly. Never invent project names.
- Confidence "low" for vague/uncertain items.

label rules (CRITICAL — be terse):
- 1-4 words. Keywords or short phrases. Never a full sentence.
- Examples: "Trading model", "Standup", "Deck deep work", "Walk", "Email triage"
- Do NOT use articles ("the", "a") or filler ("worked on", "spent time on").
- Do NOT include duration or time in the label.

note rules (CRITICAL — almost always empty):
- Default to "". The label + category + time already say WHAT and WHEN
  the activity was. Notes are ONLY for genuinely additional context
  the user explicitly mentions that the structured fields don't cover.
- Do NOT restate, paraphrase, or elaborate on the label. If the label
  is "Breakfast", the note is NOT "had breakfast" or "breakfast meal".
- Do NOT describe what the category already conveys. If category is
  "deep_work" and label is "Deck", the note is NOT "deep work session
  on the deck" or "continued working".
- Do NOT include time, sequencing, or duration ("after standup",
  "for an hour", "in the morning").
- DO fill the note if the user mentions: a specific person (e.g.
  "with Priya"), a concrete artifact ("v3 of the spec"), a notable
  outcome ("shipped", "stuck on X"), or context the label can't fit.
- 1 short phrase max. No sentences.

Return ONLY the JSON array.`;
    },
  },
  'organize': {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1500,
    buildUserMessage: (input) => String(input.text || '').slice(0, 5000),
    system: () =>
      `You clean up rambly personal journal entries. Preserve every idea, all nuance, and the user's voice. Make the prose tighter — cut filler, fix structure, use bullets only where natural. Never add ideas the user didn't write. Never moralize or interpret. Return ONLY the cleaned text, no preamble, no commentary.`,
  },
};

// ── Firebase ID token verification ──────────────────────────────
function b64urlToBuf(s) {
  // base64url → base64 → buffer
  const pad = (str) => str + '='.repeat((4 - str.length % 4) % 4);
  return Buffer.from(pad(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

let _fbKeysCache = { keys: null, fetchedAt: 0 };
async function getFirebaseKeys() {
  // Cache for 1h — Firebase rotates these but not frequently.
  const HOUR = 60 * 60 * 1000;
  if (_fbKeysCache.keys && (Date.now() - _fbKeysCache.fetchedAt) < HOUR) {
    return _fbKeysCache.keys;
  }
  const r = await fetch(FB_PUBLIC_KEYS_URL);
  if (!r.ok) throw new Error(`fb keys fetch ${r.status}`);
  const keys = await r.json();
  _fbKeysCache = { keys, fetchedAt: Date.now() };
  return keys;
}

async function verifyFirebaseToken(idToken, projectId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(b64urlToBuf(headerB64).toString('utf-8'));
  const payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf-8'));
  const keys = await getFirebaseKeys();
  const publicKey = keys[header.kid];
  if (!publicKey) throw new Error('unknown kid');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  const ok = verifier.verify(publicKey, b64urlToBuf(sigB64));
  if (!ok) throw new Error('bad signature');

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad iss');
  if (payload.aud !== projectId) throw new Error('bad aud');
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('expired');
  if (payload.iat > now + 60) throw new Error('iat in future');
  return payload.user_id || payload.sub;
}

// ── Anthropic call ──────────────────────────────────────────────
async function callClaude({ model, maxTokens, system, userMessage }) {
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${txt.slice(0, 500)}`);
  const data = JSON.parse(txt);
  const text = data.content?.[0]?.text || '';
  return { text, usage: data.usage };
}

// ── Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // Auth
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return res.status(401).json({ ok: false, error: 'missing token' });

  let sa;
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
  catch { return res.status(500).json({ ok: false, error: 'service account env var missing or malformed' }); }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY env var not set' });
  }

  let uid;
  try { uid = await verifyFirebaseToken(idToken, sa.project_id); }
  catch (e) { return res.status(401).json({ ok: false, error: 'auth: ' + e.message }); }

  // Parse body — Vercel auto-parses JSON for POST
  const body = req.body || {};
  const task = body.task;
  const def = TASKS[task];
  if (!def) return res.status(400).json({ ok: false, error: 'unknown task: ' + task });

  const input = body.input || {};
  const ctx = body.ctx || {};
  const system = def.system(ctx);
  const userMessage = def.buildUserMessage(input);
  if (!userMessage.trim()) {
    return res.status(400).json({ ok: false, error: 'empty input' });
  }

  try {
    const result = await callClaude({
      model: def.model,
      maxTokens: def.maxTokens,
      system,
      userMessage,
    });
    return res.status(200).json({ ok: true, uid, task, text: result.text, usage: result.usage });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
}
