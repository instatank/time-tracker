---
name: wrap
description: Session-wrap ritual - run before ending any session that shipped commits (the Stop hook will nudge once if forgotten). Reconciles the handoff doc against reality, appends friction cards to LEARNINGS.md, asks the founder the teach-back/transfer questions, quizzes one old card. Also triggered by "wrap and teach" or "wrap up".
---

# /wrap — DayOS

The learning half lives in `playbook/LEARNING_METHOD.md`; this skill is its trigger. The founder is non-technical — plain language throughout.

1. **Reconcile the handoff doc** (`docs/session-handoff.md`): verify every stated fact against reality — current `sw.js` cache key, last commit, branch, what shipped vs pending. Fix drift in place (PLAYBOOK Rule 6; this doc was once ~60 versions stale).
2. **Friction cards:** for each genuine friction this session (0 is a valid count — don't pad), append a card to `LEARNINGS.md` (create the file from the format in `playbook/LEARNING_METHOD.md` if missing). Fill every field except the two founder fields.
3. **Ask the founder, and wait for answers** (use AskUserQuestion or plain questions):
   - Teach-back: "One sentence, your words — what's the concept behind today's friction?" → record verbatim in the card's *In my words*. If it misses the concept, re-explain plainly and invite one retry.
   - Transfer: "Where else in your stack could this same failure bite?" → record in *Where else*.
4. **Quiz one old card:** pick the oldest card with `Internalized: no` or `streak 1`, ask its quiz question. Correct → bump streak; streak 2 on separate dates → mark `Internalized: YES (date)`. Wrong → say the answer plainly, streak resets.
5. **Recap:** produce the `wrap and teach` session recap in the exact format defined in CLAUDE.md (this session only, no padding).
6. **Mark done:** `touch "${TMPDIR:-/tmp}/wrap-done-$(basename "$(git rev-parse --show-toplevel)")-$(date +%F)"` so the Stop-hook reminder stays quiet.
7. Commit the doc updates (handoff + LEARNINGS) and push.

If the founder doesn't respond to step 3 (unattended session): leave the two founder fields as `(pending — answer at next wrap)`, complete everything else, and surface the questions at the start of the next wrap.
