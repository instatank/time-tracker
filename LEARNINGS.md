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
- **Confirmed instance, next day (2026-08-16):** the "Where else" list above named *"Firestore rules (a rule on one collection while a second write path targets another)"* as a hypothetical. It was already true in production — the live rules covered `users/**` while `projectRefs/{uid}/…` had no rule at all and 7 write sites pointing at it. The prediction landed within 24 hours, on the exact surface it named. Card strength: high — leave in quiz rotation.

---

### 2026-08-16 — Rules in version control beat rules under test (decision card)
- The choice: for the Firestore rules, spend the session on **getting the live Console rules into the repo and reviewed**, and explicitly skip building an emulator test suite. Also, in the same instruction: review first, apply second — report the delta and the reasoning *before* changing any semantics, rather than fixing what the review found in the same pass. The live alternative was the thorough version: rules + emulator suite + fixes, all shipped together.
- Why (his words): "Skip the emulator test suite. This is a one-user app; getting the rules into version control and reviewed is 90% of the value." And on the sequencing: "Report what you'd change and why BEFORE changing semantics — show me the delta, don't silently rewrite."
- The principle: when a thing is unreviewable, **visibility is the 90%** — get it into version control where it can be read and diffed before investing in machinery that proves it correct. And the review-before-apply split isn't ceremony: it's what surfaces changes whose real cost sits outside the file being edited.
- Status: **validated the same session, by the split doing its job.** The one fix the review found (adding a `projectRefs` rule) turned out to carry a data consequence — it resumes writing 80-char entry previews into Firestore, hop 2 of the copy graph in `docs/security-audit.md`. A "helpful" silent rewrite would have shipped that as a one-line bugfix with no one noticing the privacy side. The delta is documented and unapplied, pending his call.
- *Wrap-question status: **no question asked this wrap.** The founder dismissed the in-session `projectRefs` decision prompt, so per `/wrap` step 3 the §4 question is deferred — ask it at the next wrap, on this card, framed as "was review-before-apply worth the extra round-trip?"*

---

### 2026-08-16 — Default-deny made a broken feature invisible (friction card — founder: not present)
- What happened: the live Firestore rules covered `users/{uid}/**` and nothing else. `index.html` writes cross-project pointers to `projectRefs/{uid}/{slug}/{refId}` from 7 call sites, so Firestore's default-deny had been rejecting every one of them. Nothing surfaced it: `writeProjectRef` / `deleteProjectRef` swallow the error into `console.error`, the UI renders project links from local in-memory state so it looks fine on the device that wrote it, and the second brain doesn't read that collection (`docs/second-brain-integration.md` lists it as "NOT consumed"). Three independent reasons no one would ever see the failure. Found by reading the rules against the data model, not by anything breaking.
- Concept: **"secure by default" and "working" are different properties, and default-deny quietly converts missing configuration into a silent feature failure.** A deny-by-default system is right to fail closed — but the failure arrives as a permission error at the client, which is exactly the kind of error apps swallow. So the safest configuration state and the most invisible bug state are the same state. The tell is the *asymmetry*: a missing rule can never look like a security incident, only like a feature that quietly does nothing.
- Where else: any allowlist-shaped config where absence means denial — Storage rules vs a new upload path, CORS origins, an `ALLOWED_UIDS` list that shipped without the env var set (this repo, right now — same shape, opposite default: unset means allow-all, so it fails *open* and is equally invisible), IAM roles, firewall rules. General move: when adding a deny-by-default layer, enumerate the write paths that must survive it, and make the client log-and-surface permission errors rather than swallow them.
- Quiz question: "Your app writes to two Firestore collections. You add rules covering one of them and deploy. What does the second collection do, and which of your usual signals — an error toast, a red CI check, a crash report — will tell you?"
- Internalized: no

---

### 2026-08-16 — The automation that could not trigger the automation (friction card — founder: not present)
- What happened: the new rules-deploy workflow was about to be wired the obvious way, `on: push: branches: [main]`. It would never have run. Both routes into `main` merge using `GITHUB_TOKEN` — `create-pr-for-claude.yml` pushes with it, `auto-merge-claude.yml` squash-merges through the API with it — and GitHub deliberately refuses to start new workflow runs from a `GITHUB_TOKEN` push, to stop workflows triggering each other in loops. The deploy would have sat in the Actions tab looking installed and correct, firing never. Caught before shipping by asking "what actually pushes to main here?", and both merge workflows now **call** the deploy via `workflow_call` instead.
- Concept: **the thing that fails silently is the trigger, not the job.** A workflow that never runs presents identically to a workflow with nothing to do — no red X, no log, no output, just absence. And the specific trap is that platforms suppress automation-triggered-by-automation on purpose, so the more automated the pipeline already is, the *less* likely a push-triggered addition fires. Verify a new trigger by watching it fire once on the real path, never by reading the YAML and agreeing with it.
- Where else: any `on: push` / `on: workflow_run` added to a repo whose commits are made by bots (the `claude/**` sync here, Dependabot, release-please); Vercel deploy hooks fired from CI; Firestore triggers acting on writes made by a service account; webhook handlers that ignore their own app's events. General move: after adding a trigger, produce the real event and confirm a run appears — the same "watch it fire once" step that this session used to catch it.
- Quiz question: "You add a workflow that runs on every push to `main`. Your merges to `main` are made by another GitHub Action. How many times does your new workflow run, and what would you check first?"
- Internalized: no
- Note: an extension of the 2026-08-16 "two doors into main" card — same enumerate-the-routes discipline, but the failure mode is inverted. There, a real door was left unguarded; here, the guard was attached to a door nobody walks through.

---

### 2026-08-16 — Least privilege cost three failed runs (friction card — founder witnessed, lived every round)
- What happened: the deploy key was granted the narrowest role that fixed each error in turn. Round 1: `403 Permission denied to get service [firebasestorage...]` → granted Service Usage Consumer. Round 2: same error for `firestore.googleapis.com`, plus a wrong prediction that splitting the deploy would let Firestore through (it did not — both targets run the same preflight). Round 3: two *new* 403s, `firebaserules...:test` and `firebasestorage.defaultBucket.get`. Deploying rules touches three separate Google APIs and IAM reveals exactly one missing permission per attempt, so the minimal-role path costs one failed run per API — with the founder, who is not a cloud engineer, doing the clicking each round. Ended by granting `roles/firebase.admin`, which covers all three and is still Firebase-scoped rather than project-wide Editor.
- Concept: **least privilege has an iteration cost, and the cost belongs in the decision.** Permission systems reveal missing grants serially, never as a list, so "grant the minimum, then widen on failure" silently converts into "one failed round-trip per hidden permission." The fix is not to abandon least privilege but to **choose the right unit**: scope the grant to the whole task ("deploy Firebase rules") rather than to each error, and pick the narrowest role that covers the task — not the narrowest that clears the current message. Who is paying the iteration cost is part of the arithmetic.
- Where else: IAM roles anywhere (GCP/AWS), OAuth scope lists, GitHub App permissions, Firebase/Firestore rules granted predicate-by-predicate, and any `ALLOWED_*` list widened one rejection at a time. Tell: if you have granted permissions twice for the same task, stop and find the role that names the task.
- Second lesson, same incident: the workflow's own error hint said "you are missing Service Usage Consumer" unconditionally, so it confidently misattributed the two later, unrelated 403s. **A hint that names one cause for every failure is worse than no hint** — it aims the reader away from the real error printed directly above it. Now it says to read the actual error.
- Quiz question: "A deploy fails with a permissions error. You grant the exact permission named. It fails again with a different one. What does the second failure tell you about your approach, and what would you do differently on the third?"
- Internalized: no
- **Wrap question asked 2026-08-16. He chose "grant broad access, narrow later"** over "scope to the task, not the error." Marked **watching** — the near-miss is worth understanding because it is *nearly* right and fails on the second half. Re-taught: the fix isn't a wider grant, it's a differently-sized one — pick the narrowest role that covers the whole job up front, which is why this ended on `roles/firebase.admin` (Firebase only) and not on Editor (the entire cloud project). And "narrow it later" is the step that never gets done: it has no trigger, nothing breaks while it's pending, and this repo already has the receipt — the Firestore rules went unreviewed and undeployed for the project's whole life for exactly that reason. Will resurface as a scenario quiz in a different form, no penalty.

---

### 2026-08-16 — Automate the rules deploy, giving up the manual gate (decision card)
- The choice: after the rules were in version control, the founder chose to build a GitHub Action that deploys Firestore + Storage rules automatically on every merge to `main` — over the alternative of keeping the deploy a deliberate manual command he types. The tradeoff was named before he decided: automation removes a human checkpoint, so a bad rules change can reach production without anyone typing anything. He also chose to spend the extra setup rounds (service-account key, repo secret, IAM roles) rather than accept "type the command each time."
- Why (his words): "and yes, please set this up so 'Do you want to never do this again?'" — and earlier, on the whole task: "so much better if you can do this for me."
- The principle: a step that is manual *and* easy to skip is not a safety gate, it is a pending outage — the rules had gone un-deployed and unreviewed for the entire life of the project precisely because deploying them was a command someone had to remember. Automating it trades a checkpoint nobody was performing for one that always runs. The checkpoint that actually survives is the one upstream: `check.sh` and `gitleaks` still gate every merge, so the automated deploy sits *behind* a gate rather than replacing one.
- Consequence he should carry: the repo now overwrites the Firebase Console on every merge, so a hand-edit in the web UI is silently reverted by the next commit. Recorded in `playbook/SOP-deploy.md` and in the handoff's open items.
- Status: shipped and verified green the same session (run `31959948715`, both targets deployed).

---

### 2026-08-30 — Deferred the customization, then it was cheap (decision card)
- The choice: on 2026-08-15 the founder floated per-page long-press behaviour for the `+` button, then pre-authorized falling back to plain replication "if the customization is more complex than it's worth." The session took the fallback and shipped only the extraction (`renderTodayAddControl` → `renderAddControl`, all three pages pointed at it). Today he came back and asked for the customization itself. The live alternative, two weeks ago, was building both at once.
- Why (his words): *(pending — answer at next wrap)*
- The principle: **the cheap version of a feature is worth shipping when it's the same refactor the expensive version needs.** The 2026-08-15 session's only real work was pulling one hardcoded button into a shared function. Because that existed, today's per-page behaviour was one new function plus a lookup table at a single call site — no per-page wiring at all. Deferring cost nothing because the deferred work sat *behind* the same extraction, not beside it. (The rule doesn't generalize to every deferral — it holds when the simple version consolidates the thing the complex version would have to modify.)
- Status: watching — the same shape repeated within one session today (see the next card), which is weak evidence it's real.

---

### 2026-08-30 — Move the choice inside the thing that already offers it (decision card)
- The choice: the add picker listed 8 rows, three of them Quick Note / Daily Journal / Project Note, and later two more for Project Session / Learning. The founder collapsed the three into one **"Add note"** and — mid-session, extending the ask — the two into one **"Add Session"**, with the choice made by a tab row *inside* the destination sheet. The live alternative was leaving the picker flat and complete, which is the more discoverable arrangement by the usual argument.
- Why (his words): "we're just cleaning up the drop-down list to fewer" — and, on the notes: "of course the tabs to alternate to daily journal and project note are right there."
- The principle: **a menu that duplicates a choice the destination already presents is pure cost.** The notes sheet already rendered a type pill row, so the picker was asking the user to decide something they'd be shown again one tap later — three decisions offered where one was needed, with zero capability gained. The tell is that nothing became unreachable: every option still exists, one pill-tap deeper, on a screen that was going to display it anyway. Note the asymmetry that makes this safe — collapsing *toward* an existing switcher is free; the Sessions half required *building* the switcher first, which is why that was the larger change.
- Status: **watching** — picker went 8 rows → 5.
- **Wrap question asked 2026-08-30. He chose "fewer options is better UI"** over "the choice already exists one tap later." Marked watching — the near-miss is worth understanding because it is *nearly* right and fails on the second half. Re-taught: "fewer rows" alone would equally justify deleting Learning outright, or burying it in a submenu with no way back — both of which lose something, while today's collapse lost nothing. The real test is whether the choice **reappears on the screen the user lands on**; the receipt is in this session's own diff, where the notes half was a pure deletion and the sessions half needed a *new* toggle built first (`renderSessionKindRow`). Under "fewer rows is the point," that extra work has no explanation. Not promoted to `PLAYBOOK.md` this round; will resurface as a scenario quiz in a different form, no penalty.

---

### 2026-08-30 — openSheet doesn't flush, closeSheets does (friction card — founder: not present)
- What happened: the Session/Learning toggle switches sheets while a draft is open. Both sheets autosave, so it looked like a free swap. It isn't: `closeSheets()` calls `flushDailyJournalIfOpen()` / `flushSessionIfOpen()` / `flushLearningIfOpen()`, but `openSheet()` does none of that — it only removes `.open` from every sheet and adds it to one. So switching mid-thought would have dropped every unflushed keystroke, silently, with the entry looking saved because "auto-saved" was on screen a second earlier. Two sibling paths had the same shape: tapping the *already-active* pill would fall through to `openNewSession`/`openNewLearning`, which overwrite the draft var without flushing; and with zero projects, `openNewSession` bails on a toast and opens no sheet, stranding the other sheet on screen with its draft already flushed away. All three are now guarded explicitly.
- Concept: **two functions that look like a pair can have different contracts, and the quieter one is usually the incomplete one.** `openSheet`/`closeSheets` read as symmetric, but only the close path grew the flush calls — because the flush was added when *closing* was the only way to leave an editor. A new navigation path between editors inherits the gap. The general move: when you add a *new way to leave* a stateful screen, go read what the *existing* way to leave does, and port it — the teardown logic accretes on whichever exit existed first.
- Where else: any modal/route/tab switcher over autosaving editors — the Daily Journal, Session and Learning sheets here all have their own flush; a future "next entry" or "duplicate" affordance would hit this same gap. Also browser `beforeunload` vs in-app navigation, and React `useEffect` cleanup vs an early `return`.
- Quiz question: "You add a button that switches directly from one autosaving editor to another. It calls the same function that opens the editor normally. What did you skip, and how would the failure present to the user?"
- Internalized: no
