# AI features — architecture + prompt locations

Reference for the next agent picking up the AI work. The three tasks below are the entire AI surface as of June 2026. All live; all in user testing.

---

## Architecture overview

**One serverless route, four tasks.**

```
api/ai/claude.mjs         ← shared proxy handler
  ├── extract-blocks      ← voice dump → time-block proposals (activity logs)
  ├── organize            ← rambly text → tightened version (Thoughts / Reflection)
  ├── extract-tasks       ← voice dump → checklist items (Daily Journal Tasks)
  └── summarize-review    ← week/month digest → short narrative recap (Weekly/Monthly Review)
```

Pattern: the client POSTs `{ task, input, ctx }` to `/api/ai/claude`. The handler:
1. Verifies the caller's Firebase ID token (passed in `Authorization: Bearer <token>`).
2. Looks up the task in its `TASKS` registry.
3. Builds the system prompt by calling `task.system(ctx)`.
4. Calls Anthropic's Messages API with `model`, `max_tokens`, `system`, `messages`.
5. Returns `{ ok, uid, task, text, usage }`.

No Anthropic SDK. No Firebase Admin SDK. Zero npm dependencies. Pure `fetch` + `node:crypto`.

## Authentication

- Client gets a Firebase ID token via `auth.currentUser.getIdToken()`.
- Sent as `Authorization: Bearer <token>` header.
- Server verifies the token against Firebase's project public keys (cached for 1h).
- Project ID is read from the existing `FIREBASE_SERVICE_ACCOUNT` env var (same one the cron handler uses).
- Result: only signed-in users with a valid token can call the AI route. Rejects randos who somehow find the URL — protects the Anthropic spend.

## Environment variables (Vercel)

| Name | Purpose | Set in |
|---|---|---|
| `ANTHROPIC_API_KEY` | Auth for Anthropic Messages API | Production + Preview |
| `FIREBASE_SERVICE_ACCOUNT` | Already existed for cron; also used here for `project_id` | Production + Preview |
| `CRON_SECRET` | Cron job auth (unrelated to AI) | Production + Preview |

User has a $5/mo spending cap on the Anthropic account. ~$0.005/call on Sonnet 4.6.

## Model choices

| Task | Model | Reason |
|---|---|---|
| `extract-blocks` | `claude-sonnet-4-6` | Needs reliable structured JSON output + nuance for category/project mapping |
| `organize` | `claude-sonnet-4-6` | Judgment-heavy (preserve every idea, cut aggressively, choose bullets vs prose by feel). We tried Haiku first; Sonnet is more calibrated |
| `extract-tasks` | `claude-sonnet-4-6` | Strict actionable-vs-rumination filter needs nuance |
| `summarize-review` | `claude-sonnet-4-6` | Must stay grounded in the supplied digest (no invented numbers) + write tight plain-English prose |

All four on Sonnet for now. Could route `organize` back to Haiku to save cost if usage grows, but at current volume it's irrelevant.

## Prompt locations (in `api/ai/claude.mjs`)

All three prompts live in the `TASKS` object near the top of `api/ai/claude.mjs`. Each task has:
- `model`
- `maxTokens`
- `buildUserMessage(input)` — builds the user-role message from the client-passed input
- `system(ctx)` — builds the system prompt, optionally consuming client-passed context

### `extract-blocks` — activity log extraction

**Input:** `{ text: "<dump>" }`, `ctx: { projects: [...], recentLabels: [...] }`

**Context fields injected into the prompt:**
- `ctx.projects` — list of active projects so Claude only proposes valid project tags.
- `ctx.recentLabels` — top 40 most-recently-used distinct block labels so Claude reuses the user's vocabulary (e.g. "Wake MR", "Night Routine", "Break and chill") instead of inventing variants.

**Critical prompt rules** (already in the prompt; mention here so future iterations don't accidentally drop them):
- Output is a JSON array, no markdown fences.
- Categories from a fixed list — never invented.
- Splitting rule: "after X", "then Y", "while Z" indicate SEPARATE activities, not sub-details.
- Label rules: 1-4 words, keywords/phrases, never a sentence. Reuse `recentLabels` first.
- Note rules: default empty. Only filled for people, artifacts, outcomes, moods, or context the label can't fit.

### `organize` — text tightener / structurer

**Input:** `{ text: "<rambly text>" }`, optional `ctx: { entryType }`.

**One task, two prompt shapes** — selected by `ctx.entryType`:

1. **Free-form tighten** (default — any `entryType` except `session-review`, or none). Used by Daily Journal Thoughts/Reflection, Project/Quick Note + Insight body, Session Notes (during), Learning full notes.
   - Default to bullets, one idea per bullet, kept as short as possible.
   - Short paragraphs only when content is a single continuous emotional/reflective thread.
   - Preserve EVERY idea. Cut words, not content.
   - Explicit hit-list of phrases to drop: "I was thinking that", "kind of", "honestly", "basically", hedges, restatements.
   - No new ideas, insights, summaries. No editorializing.
   - Keep first person + emotional register intact.

2. **Structured** (`entryType: 'session-review'`). Used by the Project Session **Review (after)** field.
   - Classifies every point into Done / Pending / Learned and outputs `✓ ` / `> ` / `* ` prefixed lines — the exact prefixes `parseReviewText()` reads back into `done[]` / `pending[]` / `learned[]` on save.
   - STRICT output: one point per line, each line starts with a prefix, ✓ then > then * order, no headers/blanks/bullets.
   - Ambiguous points default to `>` (Pending) — safer to keep visible than wrongly mark done.

**Both variants preserve `#hashtags` verbatim** (same spelling/casing, kept attached to their idea). Tags drive Journal/project filtering, so dropping or renaming them silently breaks data — this rule is in both prompts.

**Client `entryType` values** (in `index.html` `_ORGANIZE_FIELDS`): `project-note`, `session-notes`, `session-review`, `learning-notes`. The Daily Journal organize path is separate (`_DJ_FIELD_IDS`) and sends no `entryType` → default shape.

### `extract-tasks` — actionable items from a dump

**Input:** `{ text: "<dump>" }`. No `ctx` needed.

**Critical prompt rules:**
- Output is a JSON array of short strings.
- Heuristic: would it read naturally with "I need to..." prefixed? If yes → task.
- Skip ruminations, observations, feelings, present/past reports, generic intentions.
- Each task is 5-8 words max, verb + object. Drop "I need to / should / have to". Compress context into "re:" tails.

### `summarize-review` — narrative recap of a week/month

**Input:** `{ text: "<digest>" }`. **`ctx`:** `{ periodType: 'week' | 'month' }`.

The client builds the digest (NOT free text) — `buildWeeklyDigest(weekStart)` / `buildMonthlyDigest(ym)` in `index.html` assemble a plain-text block of the period's own metrics + deltas + `surfacePatterns` observations + a few EOD/reflection snippets (week) or category/project/intention rollups (month). The model turns that into a recap.

**Critical prompt rules:**
- Ground EVERY statement in the digest — never invent numbers, projects, or events. This is the load-bearing rule (a review summary that hallucinates is worse than none).
- One headline sentence → 2–4 `• ` bullets → optional `→ ` forward-looking line. 90 words max.
- Plain second person, honest about slips, no motivational fluff.

Stored on the review doc as `aiSummary` (rides the existing whole-doc sync for `weeklyReviews` / `monthlyReviews` — no new sync wiring). `saveWeeklyReview` / `saveMonthlyReview` preserve it like they preserve tasks.

## Client-side integration

**Helper function** in `index.html`:

```js
async function aiCall(task, input, ctx = {}) {
  if (!user) throw new Error('Not signed in');
  const idToken = await user.getIdToken();
  const r = await fetch('/api/ai/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify({ task, input, ctx }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
```

**Each task has its own UI flow** built around `aiCall`:

| Task | UI entry point | UX pattern |
|---|---|---|
| `extract-blocks` | + add picker → ✨ AI Log Activities | Sheet with textarea + Extract button; results as proposal cards with ✓ / ✎ / ✕ |
| `organize` (default) | ✨ Organize next to: Daily Journal Thoughts/Reflection; capture body (Note/Project/Insight); Session Notes (during); Learning full notes | Inline comparison panel below textarea with Original / Cleaned tabs |
| `organize` (session-review) | ✨ Organize next to Session **Review** (after) field | Same comparison panel; Cleaned tab shows ✓/>/* prefixed lines |
| `extract-tasks` | ✨ Add via AI button in Daily Journal Tasks section header | Inline panel with textarea + Extract; results as pill rows with ✓ / ✕ |
| `summarize-review` | ✨ Draft summary button in the AI Summary section of the Weekly/Monthly Review | Editable textarea proposal with Save / Redraft / Cancel; saved recap shows inline with Redraft / Clear (`renderReviewAiSummary` + `draftReviewSummary`) |

The generic organize widget lives in `index.html` (`_ORGANIZE_FIELDS` registry + `organizeField` / `acceptOrganize` / `rejectOrganize`). The Daily Journal organize predates it and uses its own near-identical `_DJ_FIELD_IDS` path — same UX, same CSS (`.dj-organize-*`).

**The pattern that holds across all three: AI proposes, human commits.** Nothing auto-saves. Every proposal requires explicit user acceptance before persisting.

## Tuning levers (when the user gives feedback)

When the user says output is "too verbose" / "too terse" / "missing X":

1. **The prompt is the only thing to change.** Don't touch model, don't add post-processing, don't add validation layers — just adjust the system prompt in `api/ai/claude.mjs`.
2. **Server-only changes don't need an SW bump.** Don't bump `dayos-vN` in `sw.js` if you only touched the AI route. Vercel redeploys in ~30s.
3. **Test by re-running the same input.** If output changes in the right direction, you got it. If it doesn't, push the rule harder (more examples, stronger imperatives, explicit anti-examples).
4. **Keep the existing "what to do / what NOT to do" structure.** Claude responds well to explicit anti-examples. The prompt is currently structured as positive rules + explicit do/don't lists + worked examples.

## Cost monitoring

- $5/mo spend cap on the Anthropic account is the hard ceiling.
- Sonnet 4.6: ~$3/M input tokens, ~$15/M output. Typical call is ~500 input + ~200 output → ~$0.005.
- Current usage pattern (3-5 AI calls/day across all features) puts the user at ~$0.50-$1/month. Far below cap.
- If usage grows or new heavier features land (semantic search, full-day generation), revisit routing `organize` to Haiku to save cost.

## Pending AI work (priority order)

1. **Tune prompts based on user feedback** — they're testing the live features.
2. ~~Organize on Quick Notes + Project Notes~~ — **done.** Also extended to Sessions (Notes + Review) and Learning notes via the generic widget.
3. ~~Weekly/Monthly review summarizer~~ — **done** (`summarize-review`). AI reads a client-built digest of the period's data + patterns and drafts an editable recap stored as `aiSummary` on the review doc.
4. **Smart EOD prompts** — personalized prompts on the Today page based on actual day data.
5. **Semantic search across journal entries** — RAG over user's data. Requires embedding generation + storage.
6. **Auto-tag suggestion while typing** — small polish feature.
7. **Full Daily Journal voice→all-fields generation** — biggest scope; defer until simpler features prove their value.
8. **Pattern detection → routine suggestion** — detect recurring patterns and offer to auto-create.

## What's intentionally NOT being built

- **In-app voice transcription.** User has an external transcription tool they're happy with; in-app Whisper would duplicate that. Discussed and skipped. Revisit only if the user changes their mind.
- **Auto-saving AI proposals.** All proposals require explicit user confirmation. Don't add an "auto-accept high-confidence" shortcut — the data integrity risk is real (user spotted this concern early).
- **Multi-user awareness.** This is single-user; no proposals about "what your team said". Server is also single-user-scoped via Firebase Auth + Firestore rules.

---

*Living doc. Update the task registry section if new tasks are added. Update the model choices table if any task gets routed to a different model.*
