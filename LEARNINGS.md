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
- In my words: (pending — answer at next wrap)
- Where else: (pending — answer at next wrap)
- Quiz question: "You `npm install` a browser-automation library to run a quick test, and it errors that a browser is missing — but the machine clearly has Chrome pre-installed. What's the likely mismatch, and what do you reach for before trying to download anything?"
- Internalized: no
