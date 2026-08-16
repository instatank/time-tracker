# LEARNINGS — DayOS friction ledger

Appended by `/wrap` at session end. Card format + the method: `playbook/LEARNING_METHOD.md`.
Weekly synthesis promotes cards into `playbook/PLAYBOOK.md` — as instances of existing concepts where possible.

---

### 2026-07-02 — The /tmp test sims were gone
- What happened: DayOS's behavioural test sims lived in `/tmp/dayos-check/` (unversioned); a fresh cloud environment came up without them, so the pre-push gate's most valuable checks silently didn't exist.
- Concept: **anything not committed doesn't exist** — ephemeral environments (cloud containers, `/tmp`, un-pushed branches) evaporate; the repo is the only durable place. Instance of PLAYBOOK Rule 4's theme: the sims skipped *silently* — the gate looked green with its teeth missing.
- In my words: "If it's not committed to the repo, it doesn't really exist — anything left in /tmp or an un-pushed branch can vanish."
- Where else: "Any scratch script or config I write during a session that I never commit — next session, gone."
- Quiz question: "A session writes a useful check script to /tmp and the gate passes. What's wrong with this picture, and where should the script live?"
- Internalized: no (quizzed 2026-07-06 — founder needed the answer, streak reset to 0)

---

### 2026-07-06 — Two docs both claimed "reconciled" while both were stale
- What happened: asked to update `CLAUDE.md` with "latest developments," found its Trends/Dashboard and AI-features sections still described the pre-2026-07-01 app (3 AI features, no heatmap, no period nav) even though all of that had been live on `main` for up to 5 days. Then found `docs/session-handoff.md` had the *same* problem one layer deeper: its 2026-07-03 commit message claimed "Reconcile session-handoff.md against reality," but only patched a top bullet — the body underneath was still describing an even older state.
- Concept: **a doc's "reconciled [date]" label is not evidence it's accurate** — it's evidence someone touched it that day, possibly superficially. Multiple docs describing the same system (CLAUDE.md, session-handoff.md, docs/ai-features.md) drift independently; fixing one doesn't fix its siblings, and a doc can look freshly maintained (recent commit, confident header) while being wrong underneath. Instance of the "silently lied" pattern in PLAYBOOK Rule 4 — the same shape as the /tmp test-sims card above, but for documentation instead of tests.
- In my words: "Docs get stale because nobody re-reads the whole thing, only the part they're currently editing."
- Where else: "docs/experiments.md or docs/ai-features.md in this repo — same risk, just not caught yet."
- Quiz question: "You skim `docs/some-feature.md`, see 'Reconciled 2026-08-01' at the top, and it's only 2 weeks old — do you trust its body without checking it against the actual code/commits first? Why or why not?"
- Internalized: no

---

### 2026-07-06 — Playwright I installed didn't match the browser already on the machine
- What happened: to verify Phase C in a real browser I `npm install`ed Playwright, but it launched looking for a browser version (`chromium-1140`) that wasn't there — the cloud environment ships a *different* pre-installed Chromium (`chromium-1194`). Pointing at that binary then failed a second way: the full `chrome` build has dropped the old headless mode Playwright 1.48 asks for. Fix was to point `executablePath` at the separate `headless_shell` binary that still implements it. Two rounds of trial-and-error before the browser even launched.
- Concept: **a tool and the thing it drives are two separate versions that must line up.** The test *library* (Playwright, from npm) and the *browser* it controls (pre-installed on the box) are pinned independently; install the library fresh and it assumes a browser version the machine doesn't have. When an environment pre-provisions the heavy dependency, you adopt its version rather than letting the library fetch its own. Instance of the "ephemeral environment" theme — the box has its own fixed toolchain you must conform to, not override.
- In my words: — (founder: not present — this friction happened inside the session's tooling; per LEARNING_METHOD v2 §2 this card is exempt from founder questions, forever. Kept for future sessions.)
- Where else: any repo where a session installs a driver/library for a tool the environment pre-provisions.
- Quiz question: (exempt — founder not present)
- Internalized: n/a (sessions' lane)

---

### 2026-07-12 — Rebuilt the learning ritual around witnessed moments (decision card)
- The choice: fix the existing wrap ritual (LEARNING_METHOD v2: one multiple-choice question, only about moments the founder was present for, every answer producing a named visible outcome) instead of adding another parallel system on top. The live alternative was more process — extra review steps, more questions, a new tool.
- Why (his words): "a few reasons: they were too technical; they asked about moments I never saw; and also! even when I answered the questions, nothing happened!" (answered correctly at this wrap — named both root causes unprompted)
- The principle: learning attaches to decisions you made or moments you witnessed — quizzing someone on an experience they didn't have produces "I don't know," and an answer that changes nothing visible trains people to stop answering.
- Status: watching → scenario quiz due ~2026-07-19, then retire

---

### 2026-07-12 — Portfolio tiered; new builds now require a brief (decision card)
- The choice: give every repo a job — DayOS + PartySpark as the two flagships (deep iteration + technique practice), five utilities in maintain-mode, UoT special, instatank42 + Penalty-Shootout parked — and require a 10-minute BUILD_BRIEF before any new project or major flagship feature. The live alternative was continuing to build on impulse across all ten.
- Why (his words): "I'm building very aimlessly… I just think like a normal person who needs something and come up with brain dumps." (from the commissioning conversation — tier assignments still await his confirmation at the first monthly review)
- The principle: a project is training only when it stretches a named skill; unlabeled play masquerades as progress.
- Status: watching

---

### 2026-07-16 — Open loops: 10-day window, permanent archive, collapse repeats (decision card)
- The choice: cap the DayOS second-brain's open-loops ledger to a 10-day active window, move anything older into a permanent "never closed" archive file, and collapse a task that carries forward day after day into ONE entry — dated from when it first went open — instead of one entry per day it reappeared. The live alternative (what shipped first, before his own testing caught it) listed every open item with no cutoff and no de-duplication across carried-forward days.
- Why (his words): "i was thinking 10 days should be enough. then it stores under a 'never closed' category for perpetuity (in case i want to know in future what tends to fall here)... my open loops carry forward for the day... It doesn't need to repeat showing it... Even if it's carried for three days, it doesn't need to show across three days. It can just show us one open task."
- The principle: when a system logs the same underlying fact once per day it recurs (a raw log), a view built on top of that log must collapse repeats into one entity keyed by first occurrence — otherwise "how long has this been open" reads as "how many times was this logged," which is the wrong number.
- Status: confirmed (it worked) — promoted to `playbook/PLAYBOOK.md` L12, 2026-07-16

---

### 2026-07-16 — Sonnet's silent thinking ate the whole digest budget (friction card — founder witnessed)
- What happened: the second-brain agent's monthly-synthesis job budgets only 1200 tokens for its one Sonnet call. Sonnet 5 defaults to "adaptive thinking" whenever the `thinking` parameter is omitted — invisible reasoning tokens spent out of that same small budget. It ate the entire budget, so the model returned zero visible text; the code still wrote a file, just with the "Agent-written monthly synthesis for June..." label and nothing after it. Nothing raised an error — the founder had to notice a blank body himself to catch it.
- Concept: **a tool's invisible internal step can quietly consume a budget meant for its visible output.** When a token/time/cost budget is small and a step (reasoning, retries, warm-up) shares that budget without being explicitly asked for, the visible result can go to zero with no error raised. The fix has two halves: turn the invisible step off explicitly wherever the budget can't absorb it, AND make "the output came back empty" a raised error, never a silently-written file.
- In my words: (not asked this wrap — the one question went to the open-loops decision card above; the founder witnessed this break directly, so it's eligible for a future scenario quiz, not permanently exempt)
- Where else: any batch/scheduled job in either repo that calls an LLM with a small `max_tokens` and no explicit thinking config — e.g. any future weekly/monthly job, or a new AI feature added to DayOS's own `api/ai/claude.mjs`.
- Quiz question: "A new scheduled job calls Sonnet with max_tokens=1000 and doesn't set `thinking`. What's the risk, and what two things should the code do about it?"
- Internalized: no

---

### 2026-07-16 — His GitHub tokens were living inside DayOS notes (friction card — founder witnessed + resolved it himself)
- What happened: the very first nightly brain-backup push was rejected by GitHub's push protection — it spotted GitHub tokens inside the backup. The founder had saved personal-access tokens (and possibly passwords) in DayOS notes. Because DayOS syncs to Firestore and the agent mirrors Firestore to the VPS, those tokens had already been sitting in plaintext in three places (Firestore, the VPS disk, and nearly a fourth: the backup repo) — the backup didn't create the exposure, it surfaced it. The founder found and deleted the tokens at the source; the backup then went through clean.
- Concept: **notes and journals are copying systems, not storage vaults** — anything typed into a synced app gets replicated to every downstream mirror, forever multiplying the places a secret lives. Secrets belong only in purpose-built stores (.env on the server, a password manager) that are deliberately excluded from every sync path. Defense-in-depth followed: the backup now auto-redacts anything key-shaped from the copy it pushes (instatank42 `memory_backup.py`) — but that catches shaped keys/tokens only, never free-text passwords, so the source rule still carries the weight.
- In my words: "Notes apps copy; vaults don't" — picked the principle unprompted at this wrap (2026-07-16): anything typed into a synced app replicates to every downstream mirror; secrets belong only in stores no sync path touches.
- Where else: WhatsApp exports and future Gmail/Drive banks — anything a secret was ever typed into will carry it into the brain; same rule, same redaction net.
- Quiz question: "You paste an API key into a DayOS note 'so you don't lose it.' How many places does that key now live, and which of them does deleting the note NOT clean up?"
- Internalized: no

---

### 2026-07-16 — Where should the brain's backup live? (decision card)
- The choice: nightly backup of the agent's whole memory/ to a **private GitHub repo** (`instatank/2ndbrain`, which he created on the spot) rather than rclone-to-Google-Drive or staying VPS-only. Doubles as the "I can't see my data" fix: the repo is browsable on GitHub and readable as an Obsidian vault from a clone.
- Why (his words): "Tier 3A sounds good! … I'll go with your recommendation for now, i.e. GitHub repo. I will create a new repo for this called '2nd brain'." (Also asked about Obsidian — the GitHub route turned out to BE the Obsidian route: plain-markdown repo → clone → vault.)
- Follow-on decision, same session: after his leaked fine-grained tokens were deleted at source, he chose **not to rotate** them ("do I really need to rotate?? I think we should be fine") — reasonable because they were narrowly scoped fine-grained tokens that never went public; rotation was flagged as mandatory only if any had been broad classic tokens.
- Status: shipped + verified live by him same day (memory/ folder visible in the repo after the first successful run)

---

### 2026-08-15 — Simple + button reuse over per-page custom long-press (decision card)
- The choice: replicate the Today page's `+` button (tap → full add picker, long-press → today's Daily Journal) onto Journal and Projects exactly as-is, instead of building custom long-press targets per page (e.g. Projects → jump straight into a new session/learning entry matching whichever project tag was active). The live alternative — bespoke per-page logic — was floated first but made conditional on its own complexity.
- Why (his words): "I think we were intending to do custom long press functionality for each page... but if this kind of customization is more complex, let's just replicate the same functionality from today page across all pages."
- The principle: when a fancier, tailored version of a feature would require new branching logic per surface, and a plain surface (max ~1 hour to build) already exists and works, default to reusing it — pay for the custom version only when the plain one is later shown to fall short in practice, not upfront on a guess.
- Status: watching (asked at this wrap — picked "always pick the fastest build," the speed-framing near-miss, over "reuse until proven insufficient"; re-explained, no penalty, will resurface as a scenario quiz in a different form)

---

### 2026-08-16 — Detector precision is per-surface, not global (decision card)
- The choice: when told the CI secret scanner had to run clean or he'd start ignoring it, the founder declined the global rule and set precision **per surface, by whether a false alarm interrupts him or waits for him** — near-zero false alarms for the CI gate (it blocks a merge), strictest precision of all for an in-app save-time/pre-AI-send warning (it interrupts mid-sentence), and deliberately *sensitive* for the read-only Security Check sweep (it never interrupts). The live alternative was the single project-wide "tune everything for near-zero false alarms" rule implied by the original instruction. He also split the detector in two: shaped secrets stay findings to act on, worded secrets get surfaced as "worth a look" rather than alarms.
- Why (his words): "the rule is per-surface, not global. It depends on whether a false alarm interrupts me or waits for me... A blocked merge I don't believe just teaches me to bypass the gate, and then it catches nothing... That one interrupts me mid-sentence. Wrong twice and I'll dismiss it reflexively forever, including the time it's right... Read-only, batch-reviewed, never interrupts. Be sensitive here — a false positive costs me one glance, a miss costs a leaked credential." And on the split: "if I tune those to zero false positives I've deleted the category, which is the only reason the detector exists beyond what push protection already does."
- The principle: an alert's tolerable false-positive rate is set by its **interruption cost**, not by its subject matter — the same detector belongs at different sensitivities on a blocking gate, an interrupting prompt, and a batch review. And when one detector covers both a precise category and a fuzzy one, tune them separately: averaging them either floods the precise lane or deletes the fuzzy one.
- Status: recorded in `docs/security-audit.md` (new "Detector tuning doctrine" section, placed above the plan so all phases inherit it); the shipped CI rules already match the near-zero ruling, so no rework followed.

---

### 2026-08-16 — Two doors into main, only one of them guarded (friction card — founder: not present)
- What happened: the task was to make `auto-merge-claude.yml` wait for the new CI + secret-scan checks. But that workflow only guards the **pull-request** path, and this repo's normal flow never opens a PR — `create-pr-for-claude.yml` fires on every push to `claude/**` and merges straight into `main`. Gating only the PR path would have shipped a gate with the door still open beside it: a secret would have gone laptop → public repo → Vercel exactly as before, while the green checkmarks suggested otherwise. Both paths were gated instead. A second instance of the same shape surfaced immediately after: turning on branch protection with "Require a pull request before merging" would *forbid* that direct push and silently break the auto-merge flow.
- Concept: **a guard is only as good as the number of entrances it covers.** Before trusting a new gate, enumerate every route to the protected thing — not just the one the task names — because the unguarded route is invisible in exactly the way the guarded one is visible. The corollary bites in reverse too: a protection setting written for the guarded route can break an unguarded route that was quietly load-bearing.
- Where else: any "require checks before X" work — branch protection, deploy approvals, Firestore rules (a rule on one collection while a second write path targets another), and the `/ship` gate itself, which guards pushes made through the skill but not pushes made around it.
- Quiz question: "You add a required status check on `main` and see it pass on your next merge. What should you check before believing `main` is actually protected?"
- Internalized: no
