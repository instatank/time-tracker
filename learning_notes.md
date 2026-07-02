# Learning Notes — Cross-Session Diagnosis (2026-07-02)

**What this is:** A diagnosis of the highest-leverage improvements to your Claude Code setup, produced by mining all 7 repos (time-tracker/DayOS, party-spark, BillOS, TradeGenie, Cadence, Penalty-Shootout, Showcase) — ~300 commits, every handoff/SOP/lessons doc, and the existing automation (hooks, GitHub Actions, permissions). Six sub-agents pulled raw signals; this file is the clustered, ranked result.

**Nothing here has been built or changed yet.** Every item is a candidate with a verdict: **FIX** (one-off change), **BUILD** (a skill, hook, or automation), or **NOTHING** (not worth the cost, or it's genuinely your job, not tooling's).

**How to read the ranking:** leverage = how often the pain recurs × how much it costs you each time ÷ how expensive the fix is to build. #1 is the exception — it's ranked by urgency, not recurrence.

---

## Ranked candidates

| # | Candidate | Verdict | Recurrence | Build cost |
|---|-----------|---------|------------|-----------|
| 1 | PartySpark: Gemini image model retires ~July 17 — prod will break | FIX (urgent) | 2nd occurrence of this failure class | ~5 min |
| 2 | Automate the ship ritual (service-worker bump + syntax gates) | BUILD | ~100+ manual repetitions across 3 repos | Low |
| 3 | One shared "playbook" skill — stop re-teaching every session | BUILD | Every session, every repo | Medium |
| 4 | Automate the session-wrap: handoff docs + learnings actually get written | BUILD | Every session; docs are provably stale | Low-Medium |
| 5 | "Verify on phone" checklist as a standard output, not a favour | BUILD (process + skill) | Every handoff; 3 features shipped then rolled back | Low |
| 6 | Firebase sync checklist → enforced skill; fix known latent bugs | BUILD + FIX | "Each one bit us in turn" — 4 repos | Medium |
| 7 | Unify the deploy surface (storage rules, cron, env vars) | FIX + document | Every rules/env change; one half-day loss | Low-Medium |
| 8 | Serverless landmine linter for `api/` (PartySpark class of 500s) | BUILD | 3 landmines, each cost a prod debugging cycle | Low |
| 9 | Global working rules in user-level CLAUDE.md (no bundling, options-first) | FIX | You've hand-policed this "multiple times" in 3 repos | Trivial |
| 10 | Quarterly housekeeping sweep (stale names, dead copy, doc drift) | BUILD (light) | 5+ live stale artifacts right now | Low |
| 11 | Clean dead config: broken hook, bloated permission list | FIX | Ongoing noise | Trivial |
| 12 | UI micro-iteration churn | NOTHING (coach instead) | Constant, but it's how you design | — |
| 13 | Showcase stalled on placeholder content | NOTHING (it's your content, not tooling) | — | — |

---

## 1. PartySpark model retirement — fix before ~July 17 ⚠️

**Evidence.** Google shut down `gemini-2.0-flash-001` on 2026-06-01 and every text feature in PartySpark silently returned "API error" to users until commit `3583bbb` bumped the model. Your own CLAUDE.md already forecasts the sequel: *"Gemini 3 Pro Image Preview… slated to retire ~2026-07-17; bump to the stable `gemini-3-pro-image` before then or Roast Me image gen will 404."* Today is July 2. That's 15 days, and it is unmitigated.

**Verdict: FIX now.** It's a one-line model-ID change in `api/_lib/handlers-image.ts`. Optionally BUILD a tiny follow-up: a monthly reminder (calendar or cron) to check model deprecation notices for every model ID you depend on — you now depend on 3 across projects.

**What you learn from this:** external services retire things on *their* schedule. Any hardcoded model/API version is a quiet time bomb; keep a one-page inventory of them.

## 2. Automate the ship ritual (the single biggest recurring tax)

**Evidence.** Three repos require a hand-remembered service-worker cache bump on every user-facing change: DayOS is at `dayos-v134` (37 of the last 50 commits carry a manual bump line), BillOS at `v0.4.24`, Cadence went `v2 → v29` (28 bumps in 41 commits). That's ~100 hand-cranked repetitions of the same edit, and forgetting it means users silently run stale code — your own SOP lists "forgot a cache bump" among the most common bugs. On top of that, each repo has a remembered pre-push gate: extract the inline `<script>` and `node --check` it (DayOS, BillOS), run `/tmp` sim scripts that may silently not exist (DayOS), run typecheck+lint+build (TradeGenie) — all re-declared in docs instead of enforced.

**Verdict: BUILD.** One `/ship` skill per repo (or a shared one that reads per-repo config) that: (a) auto-bumps the SW cache key when `index.html` changed, (b) runs the repo's syntax/typecheck gate, (c) refuses to push red. A Stop or PreToolUse hook can back it up so it happens even when nobody remembers. Also **FIX**: move the DayOS sim scripts from `/tmp/dayos-check/` into the repo (`tests/` or `scripts/`) — right now your only behavioural safety net is unversioned and evaporates with every fresh environment.

**Recurrence vs cost:** highest recurrence in the whole dataset; a skill is an afternoon of work. Clear #1 build.

## 3. One shared playbook skill — stop re-teaching the same scars

**Evidence.** You have *already invented this three times by hand*: `DayOS_cheatsheet.md` in TradeGenie exists (its own words) so a new session "inherits the taste and the scar tissue instead of rediscovering both"; Cadence has `docs/working-with-claude.md`; DayOS has `sync-lessons.md` "paste-ready for other projects." Each new project re-copies the same lessons: never `new Date()` in IST apps, "code compiles ≠ feature working," one change at a time, public Firebase web config is not a leak, tombstones + `_synced` flags, phone is the source of truth. Every session pays a "60-second onboarding" (Cadence SOP) that in DayOS has grown to *five documents*.

**Verdict: BUILD.** A single user-level skill (lives in `~/.claude/skills/`, applies to every repo and every *future* repo) containing your cross-project scar tissue: the Firebase sync rules, the timezone rule, the iOS/PWA gotchas, the Vercel gotchas, your working preferences. Per-project docs then only need to carry what's genuinely project-specific, which shrinks the onboarding tax and the doc-drift surface (TradeGenie currently spends ~1 in 5 commits just fixing stale docs).

**Why this is the meta-lever:** every other cluster's lessons get *deposited* here. It's also the best learning tool you can own — see the coaching section.

## 4. Automate the session wrap — the ritual exists but doesn't happen

**Evidence.** BillOS defines a `wrap and teach` ritual that writes to `LEARNINGS.md` — **that file does not exist; it was never invoked once.** DayOS's `session-handoff.md` says the cache key is `dayos-v71`; reality is `dayos-v134` — the handoff doc drifted ~60 versions stale. TradeGenie needed 5 docs-only "fix stale docs" commits in a 4-day window. The pattern: end-of-session documentation depends on you remembering a magic phrase at the exact moment you're most tired.

**Verdict: BUILD.** Make the wrap automatic: a session-end habit backed by tooling — either a Stop hook that reminds/refuses until the handoff doc matches reality (e.g., checks the SW version in the doc vs `sw.js`), or a `/wrap` skill that updates the handoff doc, appends to LEARNINGS, and stages the commit in one step. Cheap to build; fixes the root cause of cluster 3's doc drift.

## 5. "Verify on phone" checklist as a standard, everywhere

**Evidence.** This is the strongest *cross-project* insight your own docs contain. Cadence SOP: *"The agent will say 'JS OK' and 'smoke passed' — both can be true while a feature is broken on the phone… Reject work that ships without a checklist."* DayOS: "Multiple bugs this session passed static checks and broke at runtime." Penalty-Shootout: three polish features passed headless tests and had to be disabled after one real playtest ("bloom haze, lurching camera, auto-replay"). BillOS: real-iPhone verification "perpetually deferred," cross-user sync gate is a manual DevTools ritual.

**Verdict: BUILD (light) + process.** Put one rule in the shared playbook skill: *every handoff ends with a numbered verify-on-phone checklist, and work without one is rejected* (Cadence already does this — universalize it). Where possible, have sessions use the built-in `/verify` skill before claiming done. Not everything can be automated — your phone is genuinely the last gate — but the *checklist generation* can be made unconditional.

## 6. Firebase sync: turn the checklist into an enforced skill, and fix the known latent bugs

**Evidence.** DayOS: "New collection → per-write sync fn + initialSync + forcePush + forcePull + tombstones + `_synced`. Miss any → silent cross-device data loss." And: "we added tombstones for blocks, captures, sessions, learning AND meta/projects — **each one bit us in turn**." BillOS: the optimistic-write bug "bit us twice" and the handoff *names a third latent instance* (Pause/Cancel/Reactivate still `await` and can hang). Cadence: seeder gate must be bumped in lockstep or devices silently don't re-seed; engine logic hand-duplicated across 3 files ("this is a known smell"). TradeGenie: the whole durability scare (silent local-file fallback on Vercel = data loss).

**Verdict: BUILD + FIX.** (a) Fold the sync checklist into the shared playbook skill so any session touching sync code is *forced* through it, instead of hoping it re-reads `sync-lessons.md`. (b) FIX the named latent BillOS optimistic-write instances — they're already diagnosed in your own handoff. (c) Longer-term candidate (medium cost, only when it next bites): Cadence's 3-file engine duplication.

**Why ranked below the ship ritual despite higher stakes:** the checklist already exists and mostly works when read; the marginal gain is enforcement. Data loss severity is what keeps it top-6.

## 7. Unify the deploy surface

**Evidence.** One BillOS change can require: git push (Vercel app) + manual `firebase deploy --only storage` + a GitHub Action (functions/Firestore rules) + occasionally disconnect/reconnect Vercel's git integration + a SW bump — five rituals, none enforced. DayOS has the same manual storage-rules step. Vercel burned you twice more: the cron schedule silently rejected (`*/30` on Hobby plan — "burned half a day debugging"), and the production-branch confusion that dragged across multiple TradeGenie sessions and a BillOS reconnect saga. PartySpark adds the env-var ritual ("tick all three environments… redeploy without build cache").

**Verdict: FIX + document.** (a) Copy BillOS's existing `firebase-deploy.yml` pattern so **storage rules auto-deploy on push** in BillOS and time-tracker — you already own the template, this is an hour. (b) The rest (cron caps, env-var checklist, production-branch cache) goes into the shared playbook skill as a "Vercel/Firebase gotchas" section. No new infrastructure needed.

## 8. Serverless landmine linter for `api/`

**Evidence.** PartySpark's three "critical landmines" each produced `FUNCTION_INVOCATION_FAILED 500` with zero client-side info, only visible in Vercel logs: extensionless relative imports in `api/` (works locally, dies on Vercel), static `@google/genai` imports (cold-start crash), and `api/` dropping out of typecheck. The debugging saga spawned 6 throwaway diagnostic endpoints. Root cause of the class: `npm run dev` doesn't run `/api/*` at all, so local success proves nothing about prod.

**Verdict: BUILD (small).** A ~20-line check script (grep for extensionless relative imports and static genai imports under `api/`) wired into the `/ship` skill from item 2, and a playbook rule: "AI features must be tested via `vercel dev` or a preview deploy, never `npm run dev`." Low cost, kills a whole class of the most painful (invisible) failures.

## 9. Global working rules — promote your hand-policed rules to user-level config

**Evidence.** You have personally caught and corrected the same agent behaviours repeatedly, in writing, in three repos: "Don't bundle 'while I'm here' fixes — the user has caught this multiple times" (DayOS); ready-made rebuttal scripts in the Cadence SOP ("I asked for X. Why is Y in this commit?", "Don't assume. Ask."); "Taste is the founder's… list 2–3 options and let the founder pick. Don't silently choose" (TradeGenie cheatsheet).

**Verdict: FIX (trivial).** These belong in a user-level `~/.claude/CLAUDE.md` (or the shared playbook skill) so they apply to *every* project automatically — including the next one you create — instead of being re-typed per repo and re-enforced by you mid-session.

## 10. Housekeeping sweep

**Evidence.** Live stale artifacts right now: `tradeforge` survives in 5 TradeGenie files including the live data path, two weeks after the rename; PartySpark's `setup_env.sh` still documents the retired (client-exposed!) env-var scheme and README is untouched Vite boilerplate; the "5 in 5 seconds" tagline survived a timer change to 6s; DayOS handoff doc is ~60 versions stale; graduated experiment cruft awaits deletion. Your own SOP already names the failure mode: "stale copy hides in plain sight."

**Verdict: BUILD (light).** A `/housekeeping` skill run occasionally (monthly, or at project milestones): grep for old names after renames, diff docs against reality, list dead flags/scripts. Not urgent; cheap; compounds.

## 11. Dead config cleanup

**Evidence.** time-tracker's `.claude/settings.local.json` contains a PreToolUse hook with an `"if"` field that isn't part of the hooks schema — it likely never fires as intended (and time-tracker has no build step for it to guard). The permission allowlist is an accumulation of one-off historical commands (old Mac paths, `npm install -g vercel` variants) that add noise.

**Verdict: FIX (trivial).** Delete the dead hook, prune the allowlist (the built-in `fewer-permission-prompts` skill can rebuild it properly from real usage).

## 12. UI micro-iteration churn — deliberately NOTHING

**Evidence.** Every repo shows 3–5-commit bursts converging on one visual detail (DayOS collapsed-preview ×5 in a day, BillOS header ×~10 + a calendar view built and deleted same day, PartySpark keyboard ×5 ending in abandoning the keyboard, Penalty-Shootout feel-tuning commits). 

**Verdict: NOTHING to build.** This is not waste — it's how a founder without a design background legitimately designs: on the real device, by feel. Your own SOP figured this out ("We redesigned it 5 times in 30 minutes once I just looked at it on my phone"). The only coaching tweak: for *new* surfaces, ask the session for 2–3 visual options (screenshots/mock HTML) before any real implementation — you'll spend your iterations choosing rather than discovering.

## 13. Showcase — NOTHING (tooling can't fix this one)

**Evidence.** 3 commits, all on one day, then 12 days of silence. The scaffold is done; 100+ `PLACEHOLDER` strings wait on founder-owned content (story text, six app write-ups, screenshots). The PRD itself calls content "the real work."

**Verdict: NOTHING to automate.** A session *can* draft the write-ups from each repo's docs for you to edit — that's a task, not a tool. Flagging it so it doesn't silently rot.

---

# Coaching: how you upgrade your skills while building

You asked how a zero-tech-background builder should be developing during the build process. The diagnosis above says something encouraging: **you already do the single most effective thing — you write down scar tissue.** The SOPs in Cadence, DayOS, and TradeGenie are genuinely good engineering-management documents. The gap is not discipline; it's that your learning system is scattered (per-repo), manual (magic phrases you must remember), and write-only (nothing prompts you to re-read).

**1. Consolidate: one playbook, not five.** Items 3 and 9 above are also your learning system. When your lessons live in one user-level playbook, every session both *applies* them and *tests* them — and you re-encounter them instead of re-discovering them per repo.

**2. Close the loop on "wrap and teach."** You designed a spaced-learning ritual and then never triggered it (BillOS: zero invocations). Don't rely on willpower — make the tooling ask (item 4). The recap format you already defined (concepts in plain English, one transferable insight, friction point) is exactly right; the fix is making it fire automatically.

**3. Learn one concept per friction, not per session.** The highest-retention moments in your history are all friction points: the cron that silently rejected, the optimistic write that hung the UI, the model that retired under you. Each time something breaks, ask the session one question: *"Explain the underlying concept in plain English, and where else in my projects this same concept applies."* That last clause is the multiplier — e.g., the optimistic-writes lesson from BillOS also explains DayOS sync behaviour; the model-retirement lesson applies to all three AI-touched apps.

**4. Teach-back as the "am I done learning this?" test.** After each wrap, try restating the one key concept in your own words *in the playbook*. If you can't, ask the next session to re-explain. Your `dayos-sop.md` shows you already do this instinctively ("Code compiling ≠ feature working") — those one-liners are the format; keep producing them.

**5. Graduate from checklists to invariants.** The next level of thinking, and the pattern your best work already shows: DayOS's duplicate-proof daily-defaults design (five overlapping defenses) and TradeGenie's fail-loud storage (`usesFirebase()` *throws* on partial config rather than guessing). The concept: don't just remember to check a thing — make the system *unable to be wrong quietly*. When you review a session's plan, one founder-level question beats ten technical ones: **"If this goes wrong silently, how would I ever find out?"** Asking it forces guardrails to be designed in, and it's a question that needs zero coding background.

**6. Your verification instinct is your superpower — keep sharpening it.** "Don't trust agent self-report" (Cadence SOP) is the most valuable line in all seven repos. You can't read the code, but you can be an excellent acceptance tester: demand the phone checklist, insist on acceptance criteria up front ("two minutes of typing saves an hour of rework" — your words), and refuse "done" without a verify step. That role — spec + acceptance + taste — is the founder's job even on fully technical teams.

**Suggested cadence going forward:**
- *Every session:* state acceptance criteria up front; end with the (soon-automated) wrap.
- *Weekly (~15 min):* skim the playbook's newest entries; pick ONE recurring friction and ask a session to either fix it or explain it deeply.
- *Monthly:* run the housekeeping sweep (item 10) + check the model/dependency inventory (item 1's follow-up).

---

## Suggested execution order (when you green-light)

1. **Today-ish:** #1 model bump (5 min) · #11 dead-config cleanup · #9 global working rules.
2. **First build sprint:** #2 `/ship` skill + move DayOS sims into the repo · #8 api/ linter folded in.
3. **Second sprint:** #3 shared playbook skill (seeded from DayOS_cheatsheet + sync-lessons + Cadence SOP) · #4 automated wrap · #5 verify-checklist rule.
4. **Then:** #6 latent BillOS fixes + sync skill · #7 storage-rules auto-deploy.
5. **Ongoing:** #10 monthly housekeeping.
