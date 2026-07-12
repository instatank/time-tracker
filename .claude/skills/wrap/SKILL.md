---
name: wrap
description: Session-wrap ritual - run before ending any session that shipped commits (the Stop hook will nudge once if forgotten). Reconciles the handoff doc against reality, appends friction cards to LEARNINGS.md, asks the founder the teach-back/transfer questions, quizzes one old card. Also triggered by "wrap and teach" or "wrap up".
---

# /wrap — DayOS

The learning half lives in `playbook/LEARNING_METHOD.md`; this skill is its trigger. The founder is non-technical — plain language throughout.

1. **Reconcile the handoff doc** (`docs/session-handoff.md`): verify every stated fact against reality — current `sw.js` cache key, last commit, branch, what shipped vs pending. Fix drift in place (PLAYBOOK Rule 6; this doc was once ~60 versions stale).
2. **Cards:** append cards to `LEARNINGS.md` per `playbook/LEARNING_METHOD.md` §2 — decision cards for choices the founder made/witnessed, friction cards for engineering incidents (0 of either is a valid count — don't pad). Friction cards the founder wasn't present for get `founder: not present` and are exempt from questions, forever.
3. **One question, maximum** (LEARNING_METHOD.md §4): about the most consequential 📍-flagged or founder-made decision this session. Multiple choice via AskUserQuestion (principle / near-miss / distractor), stakes stated in one line, and the answer must produce a named, visible outcome in the same reply. "Skip" is a first-class answer. No flags and no founder decisions → no question.
4. **Scenario quiz (only if no new-moment question was asked, and only if a card is due ~1 week):** multiple choice, context restated in the question. Right → advance toward retirement; wrong → re-teach in two plain sentences, mark "watching", zero scolding.
5. **Recap:** produce the `wrap and teach` session recap in the exact format defined in CLAUDE.md (this session only, no padding).
6. **Mark done:** `touch "${TMPDIR:-/tmp}/wrap-done-$(basename "$(git rev-parse --show-toplevel)")-$(date +%F)"` so the Stop-hook reminder stays quiet.
7. Commit the doc updates (handoff + LEARNINGS) and push.

If the founder doesn't respond to step 3 (unattended session): leave the two founder fields as `(pending — answer at next wrap)`, complete everything else, and surface the questions at the start of the next wrap.
