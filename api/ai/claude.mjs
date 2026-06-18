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
      const recentLabels = (ctx.recentLabels || []).length
        ? (ctx.recentLabels).map(l => `"${l}"`).join(', ')
        : '(none yet)';
      return `You extract structured activity blocks from a personal time-tracking description. The user is logging activities they DID today. Return ONLY a JSON array, no preamble, no markdown code fence.

Available categories (use ONLY these IDs): deep_work, learning, practice, routine, leisure, leaks

Active projects (use ONLY these names exactly, or empty string): ${projects}

User's recently used labels (REUSE these exactly when the activity matches one of them — this preserves the user's own vocabulary): ${recentLabels}

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

General rules:
- Only extract activities the user clearly DID. Skip future plans, intentions, or generic mentions.
- If a start time isn't given but duration is clear, set "start_time" to null.
- Map each activity to the closest category. Never invent categories.
- Match projects to the list exactly. Never invent project names.
- Confidence "low" for vague/uncertain items.

Splitting rule (IMPORTANT):
- Each distinct activity becomes its OWN entry, even if mentioned in one phrase.
- Phrases like "after X", "then Y", "while Z", "followed by W", "and then" indicate a SEPARATE later activity. Always split into two (or more) entries.
- Example: "chilled with mom after breakfast" → TWO entries:
    (1) Breakfast (routine, ~30m)
    (2) Break and chill / Social (leisure, ~30m, note: "with mom")
- Example: "deep work on trading model then standup" → TWO entries.
- Never merge two activities into one entry just because they share a sentence.

label rules (CRITICAL — be terse + reuse history):
- 1-4 words. Keywords or short phrases. Never a full sentence.
- FIRST check the recent-labels list above. If the current activity matches one of them semantically, use that exact label (preserves user's conventions like "Wake MR", "Night Routine", "Break and chill", "Social").
- Only invent a new label if no recent label fits.
- Do NOT use articles ("the", "a") or filler ("worked on", "spent time on").
- Do NOT include duration or time in the label.

note rules (CRITICAL — almost always empty):
- Guiding principle: if the user took the trouble to mention something specific that the label / category / time don't already capture, THAT'S the note. Everything else stays empty.
- Default to "". The label + category + time already say WHAT and WHEN. Notes are ONLY for genuinely additional context the user explicitly mentions.
- Do NOT restate, paraphrase, or elaborate on the label. If the label is "Breakfast", the note is NOT "had breakfast" or "breakfast meal".
- Do NOT describe what the category already conveys. If category is "deep_work" and label is "Deck", the note is NOT "deep work session on the deck".
- Do NOT include time, sequencing, or duration ("after standup", "for an hour", "in the morning").
- DO fill the note if the user mentions: a specific person (e.g. "with Priya", "with mom"), a concrete artifact ("v3 of the spec"), a notable outcome ("shipped", "stuck on X"), a mood / state ("groggy", "energised"), or context the label can't fit.
- 1 short phrase max. No sentences.

Return ONLY the JSON array.`;
    },
  },
  'extract-tasks': {
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
    buildUserMessage: (input) => String(input.text || '').slice(0, 5000),
    system: () =>
      `You extract a to-do list from a personal voice dump. Return ONLY a JSON array of short task strings — no preamble, no markdown code fence.

Output format:
["<task 1>", "<task 2>", ...]

What counts as a task (extract ONLY these):
- Concrete actions the user needs/wants to do. Verb + object. Future-ish or imperative in feel.
- Heuristic: would the sentence read naturally with "I need to..." prefixed? If yes → task.
- Examples to extract: "Call the bank about the loan", "Follow up with Priya re: deck", "Review v3 of the spec", "Book the venue".

What does NOT count as a task (skip these):
- Ruminations: "worried about X", "thinking about Y".
- Observations: "noticed Z was off", "X felt slow today".
- Feelings: "frustrated about Q", "energised after the walk".
- Present-tense reports: "working on the deck right now".
- Past-tense reports: "did Q today", "spent 2h on R".
- Generic intentions without an object: "be more disciplined", "stay focused".

Task wording rules (CRITICAL — be terse):
- 5-8 words max. Verb + object. Imperative or short fragment.
- Drop "I need to", "I should", "I have to" — they're implied.
- Drop filler ("probably", "remember to", "maybe", "kind of").
- Compress long context into a "re:" tail when useful: "Call bank re: loan", "Follow up Priya re: deck v3".
- Keep concrete details (names, numbers, version IDs) verbatim.
- If no tasks are present in the input, return [].

Return ONLY the JSON array.`,
  },
  'organize': {
    model: 'claude-sonnet-4-6',
    maxTokens: 2000,
    buildUserMessage: (input) => String(input.text || '').slice(0, 5000),
    // One task, two shapes. `ctx.entryType` selects the prompt:
    //   - 'session-review' → classify a dump into DONE / PENDING / LEARNED
    //     and emit ✓ / > / * prefixed lines the app's parser reads back.
    //   - everything else (project-note, session-notes, learning-notes,
    //     daily journal) → free-form tighten into a scannable version.
    // Both variants preserve #hashtags verbatim — tags carry meaning the
    // user relies on for filtering, so they must never be dropped or altered.
    system: (ctx) => {
      const TAG_RULE =
        `Hashtags: preserve every #hashtag exactly as written — same spelling and casing — and keep it attached to the idea it belongs to. Never drop, rename, merge, or invent a tag.`;

      if ((ctx.entryType || '') === 'session-review') {
        return `You organize a rambly project-session review into three buckets the app parses automatically: DONE, PENDING, and LEARNED. The text is the user's own notes from a work session — keep their voice and first person, but be aggressive about cutting verbosity.

Classify every distinct point in the input into exactly one bucket and output it as a prefixed line:
- "✓ " for things finished, accomplished, shipped, or decided (DONE).
- "> " for things still open — unfinished, to do next, blocked, or an unresolved question (PENDING).
- "* " for insights, lessons, realisations, or principles worth keeping (LEARNED).

Output format (STRICT):
- One point per line. Every line MUST start with "✓ ", "> ", or "* " and nothing else.
- No section headers, no blank lines, no bullets, no numbering — just prefixed lines.
- Order all ✓ lines first, then all > lines, then all * lines.

Classification rules:
- Past-tense accomplishment ("did", "finished", "fixed", "shipped") → ✓ DONE.
- "still need to", "next", "didn't get to", "blocked on", an open question → > PENDING.
- "realised", "learned", "turns out", "noticed that", a takeaway or principle → * LEARNED.
- If a point is genuinely ambiguous, prefer > PENDING — an open item is safer left visible than wrongly marked done.

Cutting rules (aggressive — favour brevity):
- Preserve EVERY distinct point. The only thing that gets cut is words, not content.
- Each line is as short as it can be without losing meaning. Fragments are fine; lines don't need to be full sentences.
- Drop scaffolding and filler: "I was thinking that", "kind of", "honestly", "I guess", "basically", "maybe", "really", "just".
- Concrete details (names, numbers, project names, specific terms) stay verbatim.

${TAG_RULE}

Output ONLY the prefixed lines. No preamble, no commentary, no markdown code fences.`;
      }

      return `You tighten a rambly personal journal entry into a clean, scannable version the user can read back later. The entry is the user's own private notes — keep their voice and first person, but be aggressive about cutting verbosity.

Output structure (default to this):
- Bullets, one idea per bullet.
- Each bullet is as short as it can be without losing the idea.
- Group related bullets into short sections with a tiny header (e.g. "Project Y", "Frustrations", "Wins") ONLY when there are 3+ bullets that clearly belong together. Otherwise just a flat bullet list.
- Use a short paragraph ONLY when the content is one continuous emotional/reflective thread that loses meaning if broken up.

Cutting rules (aggressive — favour brevity):
- Preserve EVERY distinct idea, observation, feeling, name, number, decision, or detail the user wrote. Idea preservation is non-negotiable; the only thing that gets cut is words, not content.
- Drop verbal scaffolding: "I was thinking that", "it kind of feels like", "I guess", "honestly", "to be fair", "sort of", "you know", "basically".
- Drop hedges and filler: "maybe", "perhaps", "I think" (when not load-bearing), "really", "just", "actually".
- Drop restatements — if the user makes the same point twice in different words, keep the sharper version.
- Compress: turn long subordinate clauses into short fragments. Bullets don't need full sentences.
- Concrete details (names, places, projects, numbers, specific words) stay verbatim.

Voice rules:
- Keep the user's first person ("I", "my").
- Keep the emotional register. If they're frustrated, the bullets are still frustrated.
- Don't add new ideas, insights, summaries, or interpretations. No "in summary", no "overall". No editorialising or reframing.

${TAG_RULE}

Output ONLY the cleaned text. No preamble, no commentary, no markdown code fences.`;
    },
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
