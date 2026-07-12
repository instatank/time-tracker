# PLAYBOOK — global rules + transferable lessons

**Scope:** every repo (DayOS/time-tracker, Cadence, BillOS, PartySpark, TradeGenie, Penalty-Shootout, Showcase) and every future project.
**Supersedes:** `TradeGenie/DayOS_cheatsheet.md`, `Cadence/docs/working-with-claude.md` (global sections), `time-tracker/docs/sync-lessons.md`. Those files are stubs pointing here. If this file and a repo doc disagree, this file wins for global rules; the repo's CLAUDE.md wins for repo-specific facts.
**Format:** every entry has an **EXECUTE** layer (what a Claude session does, mechanically) and an **UNDERSTAND** layer (for Ankit: the failure that created the rule, the transferable concept, where else it applies).

---

# Part 1 — The working contract (global rules)

These were hand-enforced by Ankit "multiple times" across three repos before landing here. They are not preferences; each one paid for itself in a real incident.

## Rule 1 — One change at a time. No bundled fixes.

**EXECUTE:** A commit contains the one thing that was asked for. If you notice something else worth fixing, list it at the end of your reply as a candidate — do not touch it. Never include "while I'm here" cleanups, renames, or refactors in a feature commit.

**UNDERSTAND:** Every time a session bundled "also fixed X," something broke and you couldn't tell which change broke it (DayOS: "Every time Claude bundled 'while we're here' into a feature, something broke" — your own SOP). The concept is **isolation of variables**: one change = one suspect when things go wrong. It's the same reason you A/B test one thing at a time. Applies everywhere, forever.

## Rule 2 — Acceptance criteria before code.

**EXECUTE:** Before implementing anything non-trivial, restate the task as 1–4 testable acceptance criteria and get confirmation (or, if working autonomously, write them down first and verify against them before claiming done).

**UNDERSTAND:** "Two minutes of typing saves an hour of rework" — your Cadence SOP. The concept is **defining done before starting**: without it, "done" defaults to "the agent got tired," and you pay for the gap in review cycles.

## Rule 3 — Options before decisions on anything visible or structural.

**EXECUTE:** For UI choices, vocabulary/enum sets, and architecture tradeoffs: present 2–3 options with their costs and let Ankit pick. Don't silently choose. For pure implementation detail, just build it.

**UNDERSTAND:** "Taste is the founder's; implementation is yours" (your TradeGenie cheatsheet). You can't read the code, but taste and product judgment are your job — sessions that guess your taste generate rework bursts (BillOS header reworked ~10 times).

## Rule 4 — The silent-failure question.

**EXECUTE:** For any new write path, scheduled job, sync step, or external call, answer in the plan: *"If this goes wrong silently, how would the founder ever find out?"* If the answer is "they wouldn't," add a loud failure (throw, banner, toast, log with a greppable tag) before shipping the feature.

**UNDERSTAND:** Your worst losses were all silent: the Vercel cron that was silently rejected (half a day), Firestore writes that silently didn't sync (data loss class), a model retirement that silently 404'd production. The concept is **fail loud beats fail safe-looking**. Your best code already does this: TradeGenie's `usesFirebase()` *throws* on a partial config rather than quietly writing to a disk that evaporates. This single question, asked at plan time, is the highest-EV sentence in this playbook.

## Rule 5 — "Done" means verified, and static checks are not verification.

**EXECUTE:** Never claim done based on "compiles / typecheck passed / smoke passed." Follow `SOP-verify-on-phone.md`: every handoff ends with a numbered verify-on-phone checklist. Work without one gets rejected.

**UNDERSTAND:** "The agent's confidence is a function of static checks, not user experience" — your Cadence SOP, and the single best line in your seven repos. Proof: three Penalty-Shootout features passed every automated test and died on first real playtest.

## Rule 6 — Don't trust docs over code; reconcile in the same commit.

**EXECUTE:** Code is the source of truth. If a doc contradicts the code, fix the doc in the same commit that revealed the drift. The `/wrap` skill re-verifies handoff-doc facts (version keys, branch names) against reality at every session end.

**UNDERSTAND:** Your DayOS handoff doc drifted ~60 service-worker versions stale. The concept: **any fact stored in two places will eventually disagree**, and the copy people read is usually the wrong one. That's also why this playbook exists once, with pointers — not seven copies.

## Rule 7 — Ask before anything irreversible.

**EXECUTE:** Production deploys, deleting live data, changing Firebase rules on a live project, force-pushes to shared branches: pause and flag. Everything reversible (branch pushes, docs, skills): proceed.

**UNDERSTAND:** Reversible mistakes cost minutes; irreversible ones cost your journal data or your users' trust. EV framing: asking costs one message; not asking occasionally costs everything.

---

# Part 2 — Transferable lessons (concept cards)

Each lesson = one failure your stack actually paid for, generalized. New lessons get promoted here from repo `LEARNINGS.md` files during weekly synthesis — as *instances of existing concepts* where possible, new entries only when genuinely new.

## L1 — Optimistic writes: never block the UI on a server acknowledgment

**EXECUTE:** With Firestore offline persistence, `await setDoc/updateDoc` resolves on *server ack*, which can stall. Do not gate UI (closing a modal, clearing a spinner) on the write promise. Pattern: issue the write → update the UI immediately → surface only genuine failures via `.catch` → toast. Exception: true transactions that need the round-trip (BillOS Mark Paid) stay awaited — and show a spinner honestly.

**UNDERSTAND:** This froze BillOS twice ("Uploading 100%", "Saving…") and the concept then *predicted* a third instance (Pause/Cancel/Reactivate) before it fired in production. The transferable concept is **local truth vs server truth**: the app's own cache already knows the answer; waiting for the server to agree adds latency and a failure mode, not safety. Where else: any Firestore write in DayOS, Cadence's `saveState()`, any future offline-first app.

## L2 — Distributed data needs the full sync contract, every time

**EXECUTE:** Any new synced collection or field follows `SOP-firebase-sync.md` — all six wiring sites (per-write sync, initialSync merge, force-push, force-pull, tombstones, `_synced` flag), no exceptions, plus the reload-vs-cross-device test distinction.

**UNDERSTAND:** "We added tombstones for blocks, captures, sessions, learning, AND meta/projects — **each one bit us in turn**" (DayOS). Concept: **partial sync is silent data loss**, and "it syncs" is a claim about six code paths, not one. Diagnostic concept worth memorizing: *stale after reload = initialSync bug; stale across devices = per-write bug. Different bugs.*

## L3 — Deterministic IDs beat duplicate-detection logic

**EXECUTE:** For any "auto-create one X per day/period" feature, derive the document ID from the natural key (`default-{templateId}-{date}`), so two racing devices write the *same* document instead of two documents. Layer skip-if-exists / user-deletion-sticks on top, but the deterministic ID is the load-bearing defense.

**UNDERSTAND:** Auto-sleep in DayOS got this wrong (duplicates → feature killed); daily-defaults got it right with five overlapping defenses. Concept: **make the collision impossible instead of detecting it** — the same idea as using a natural key so the question "did we already create this?" never needs asking. Applies to: reminders, recurring bills in BillOS, any scheduled auto-creation anywhere.

## L4 — Timezones: bare `new Date()` string conversion is a bug waiting for evening

**EXECUTE:** In IST-anchored apps, never derive a date string via `toISOString()` or bare `new Date()` — use the repo's helpers (`nowIST()`/`todayStr()` in DayOS, `localISO()` in Cadence, IST anchoring in BillOS). Any date comparison in review: check which clock it uses.

**UNDERSTAND:** Cadence: after ~6:30pm IST, "today" rolled to tomorrow because `toISOString()` speaks UTC — Saturday evening displayed as Sunday and blocked legitimate workout completions. Concept: **UTC is the storage language, local is the display language; mixing them fails only at certain hours**, which is why it passes every daytime test.

## L5 — Identifiers are load-bearing; renames are two different operations

**EXECUTE:** Renaming the *display* name is cheap; renaming *internal identifiers* (storage keys, file paths, enum values, function names) moves data and breaks references. Default: rename the display layer, keep internals, leave a comment (PartySpark "Scramble" kept `JUMBLE` internals; TradeGenie keeps its legacy store filename deliberately). If internals must change, plan the migration explicitly.

**UNDERSTAND:** Concept: **names users see are labels; names code sees are addresses.** Changing an address without mail-forwarding loses the mail (saved bests, stored data, imports). Ask on any rename: "is this a label or an address?"

## L6 — External services retire things on their schedule, not yours

**EXECUTE:** Never leave a `-preview`/`-beta` model or API version in production. Keep the model/dependency inventory in `SOP-deploy.md` current; check retirement dates during the weekly synthesis. When adding an external model/API, record its ID + any announced sunset date there.

**UNDERSTAND:** Gemini 2.0's retirement silently 404'd all PartySpark text generation in production (June 2026); the image *preview* model nearly repeated it in July. Concept: **every external dependency is a clock you don't control** — the EV move is a cheap monthly glance, not a surprise outage.

## L7 — Secrets: client-side means public; but not everything client-side is a secret

**EXECUTE:** Real API keys (Anthropic, Gemini, OpenAI) live server-side only — Vercel env vars, called via a serverless proxy (`/api/...`). Never in client JS, never with a `VITE_`/`NEXT_PUBLIC_` prefix. Conversely: a Firebase *web config* (apiKey etc.) in client code is public **by design** — security lives in Firestore/Storage rules, not in hiding the config. Don't "fix" that; do verify the rules exist.

**UNDERSTAND:** You've had both failure modes: real keys shipped in the PartySpark bundle (fixed by the `/api/ai` proxy), and a false alarm where `VITE_ROAST_LIMIT` (a number) looked like a leaked secret. Concept: **the browser is enemy territory — anything sent there is published**; and its twin, **know which "keys" are actually locks** so you don't panic at the wrong ones.

## L8 — Local green ≠ prod green: know what your local check can't see

**EXECUTE:** Before claiming a serverless/API change works: it must run under the *production resolver*, not just the dev one — for Vercel functions that means `vercel dev` or a preview deploy, never `npm run dev` (which doesn't run `/api/*` at all). PartySpark: run `scripts/check-api-landmines.mjs` (extensionless imports, static `@google/genai` imports) before any push touching `api/`.

**UNDERSTAND:** Three PartySpark landmines each produced `FUNCTION_INVOCATION_FAILED 500` with zero client-side detail, and each "slips through every local check" because TypeScript's local resolver is more forgiving than Node's production one. Concept: **a passing test only covers the environment it ran in** — the question to ask is "what does prod do differently from my check?" Same concept as L4 (daytime tests miss evening bugs) and Rule 5 (static checks miss runtime).

## L9 — Caches serve stale truth until you tell them the truth changed

**EXECUTE:** Follow `SOP-ship.md`: bump the service-worker version key on every user-facing change (DayOS `dayos-vN`, Cadence `cadence-vN`, BillOS `VERSION`). Vercel: after env-var changes, redeploy *without* build cache. Vercel git integration caches the production branch at connect time — reconnect after changing default branches.

**UNDERSTAND:** ~100 hand-cranked bumps across three repos, and "forgot a cache bump" is in your own most-common-bugs list. Concept: **a cache is a bet that nothing changed** — every caching layer (service worker, build cache, Vercel's branch config, browser) needs an explicit invalidation signal, and each missed signal shows users the past. When something "didn't update," ask: *which cache wasn't told?*

## L10 — The platform gap list: things that only fail on the real device

**EXECUTE:** Treat these as review triggers whenever code touches them: iOS dictation leaves fields in composition state (`isComposing`/keyCode 229 — Enter handlers must cope); safe-area insets for notch/home-bar; no Vibration API on iOS Safari; `-webkit-line-clamp` is unreliable — cap with `max-height` too; HEIC decode fails outside Safari — wrap in try/fallback; iPadOS masquerades as Mac (`maxTouchPoints > 1 && /Macintosh/`); touch inputs need ≥16px font to prevent iOS focus-zoom; Tailwind v4 JIT silently drops template-literal class names — static class maps only, verify new accents in compiled CSS.

**UNDERSTAND:** Every one of these shipped "working" and broke on your iPhone. Concept: same as L8 — **your phone is a different environment than the dev preview**, and it's the one that counts. This is why `SOP-verify-on-phone.md` exists and why "works on the Mac means nothing" is your own rule.

## L11 — Guardrails belong at the moment of failure, not in a doc

**EXECUTE:** When a mistake happens twice, don't just document it — move it into the path of execution: a check script in the ship gate, a version gate in code (TradeGenie's `PROMPT_TEMPLATES_VERSION`), a fail-loud throw (L4 of Rule 4), a skill that fires automatically. Docs are for understanding; enforcement is for machines.

**UNDERSTAND:** Your history shows every guardrail was retrofitted *after* the second bite, and the ones that stuck are the ones wired into code, not prose. Concept: the **checklist → invariant graduation path** — a lesson starts as a note, becomes a checklist item, and should end as something that *cannot be skipped*. That's also the path your own learning follows (see `LEARNING_METHOD.md`).

---

# Part 3 — When a session starts (loading protocol)

**EXECUTE:** 1) Read the repo's CLAUDE.md. 2) Read this playbook (locally if time-tracker is cloned, else via GitHub `get_file_contents` on `instatank/time-tracker`, `playbook/PLAYBOOK.md`). 3) Read the repo's handoff doc + `LEARNINGS.md` if present. 4) If the conversation is about *what to build next*, starting something new, or the founder's progress/strategy — also read `NORTH_STAR.md` (and require a `templates/BUILD_BRIEF.md` for new projects). If a technique-of-the-week is active, read its `CURRICULUM.md` entry and practice it. 5) During the session, post 📍 flags per `LEARNING_METHOD.md` §3. 6) Before ending a session that shipped commits, run the repo's `/wrap` skill — the Stop hook will remind you once if you forget; the wrap's founder questions follow `LEARNING_METHOD.md` v2 (one question max, witnessed moments only), which supersedes any older question list hard-coded in a repo's wrap skill.
