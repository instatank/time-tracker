# LEARNINGS — DayOS friction ledger

Appended by `/wrap` at session end. Card format + the method: `playbook/LEARNING_METHOD.md`.
Weekly synthesis promotes cards into `playbook/PLAYBOOK.md` — as instances of existing concepts where possible.

---

### 2026-07-02 — The /tmp test sims were gone
- What happened: DayOS's behavioural test sims lived in `/tmp/dayos-check/` (unversioned); a fresh cloud environment came up without them, so the pre-push gate's most valuable checks silently didn't exist.
- Concept: **anything not committed doesn't exist** — ephemeral environments (cloud containers, `/tmp`, un-pushed branches) evaporate; the repo is the only durable place. Instance of PLAYBOOK Rule 4's theme: the sims skipped *silently* — the gate looked green with its teeth missing.
- In my words: (pending — answer at next wrap)
- Where else: (pending — answer at next wrap)
- Quiz question: "A session writes a useful check script to /tmp and the gate passes. What's wrong with this picture, and where should the script live?"
- Internalized: no
