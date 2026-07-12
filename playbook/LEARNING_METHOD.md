# The Learning Method v2 — decisions first, one question, visible outcomes

**This doc is for Ankit and for Claude sessions.** Sessions follow §2–§4 mechanically at wrap
time. **Precedence note for sessions:** if a repo's `/wrap` skill still describes the older
ritual (teach-back + transfer + quiz, three questions), THIS document wins — run the v2 ritual
below.

---

## §1 What broke in v1 (so we don't rebuild it)

The Friction Ledger's ideas were right (one concept per incident, teach-back, spaced quizzes).
Its unit was wrong, and the founder said so plainly:

1. **Wrong unit.** Cards captured *Claude's* engineering frictions — Playwright binary
   mismatches, ESM resolver quirks — that happened invisibly inside the session's work. Then
   the wrap quizzed the founder on them. He was being tested on someone else's experience,
   so the honest answer was "I don't know," every time. Learning attaches to moments you
   *lived*, not moments that were summarized to you.
2. **No visible outcome.** Answers were recorded into a file he never reopened. From his
   side: effort in, nothing out. A ritual whose payoff is invisible gets rationally abandoned.
3. **Too many asks.** Three questions per wrap (teach-back + transfer + quiz) at the exact
   moment energy is lowest — end of session.

v2 keeps the card machinery but fixes all three: **only witnessed moments become questions;
every answer changes something named on the spot; one question per wrap, maximum.**

## §2 The two kinds of card

### Decision cards — the founder's lane (this is where he learns)

The unit of Ankit's learning is a **decision he made or watched being made**: a product call,
a scope cut, a plan he approved or rejected, a tradeoff he picked from options, a technique he
tried from `CURRICULUM.md`. These are moments he was *present* for by definition.

```
### [date] — [the decision, in five words]
- The choice: what was decided, and what the live alternative was.
- Why (his words): ← recorded verbatim from the wrap answer.
- The principle: the one-line transferable rule this instance suggests.
- Status: watching | confirmed (it worked) | reversed (we learned the hard way)
```

Decision cards live in each repo's `LEARNINGS.md` alongside friction cards.

### Friction cards — the sessions' lane (unchanged format, new audience)

Engineering frictions (the v1 card format) are still valuable — **for future sessions**, and
as the raw feed for weekly promotion into `PLAYBOOK.md`. Sessions keep writing them. But:

> **The witnessed rule: a card can only generate a founder question if the founder was present
> for the moment** — he made the call, he saw it break, or the session flagged it live (📍,
> §3) and he read the flag. Cards without a witnessed moment get `founder: not present` and
> are *permanently exempt* from wrap questions and quizzes. No exceptions — one unanswerable
> question costs more trust than ten cards are worth.

## §3 During the session — the 📍 flag (sessions: do this)

When something learn-worthy happens **while it's happening**, the session posts one line,
marked so it's scannable:

> 📍 **Moment:** we just chose X over Y because Z. *(one sentence, plain English, no jargon)*

Rules for sessions: max 2–3 flags per session — flag the moment you'd want a smart
non-technical co-founder to notice, not every technical event. A flag costs the founder
nothing in the moment (no response expected). The wrap may only ask about flagged moments or
decisions the founder himself made in conversation. **No flags and no founder decisions =
no question at wrap.** A silent wrap is a valid wrap.

## §4 At wrap — one question, one visible outcome (sessions: do this)

After the mechanical wrap work (handoff reconcile, cards appended), ask **at most ONE**
question, built like this:

1. **Subject:** the most consequential witnessed moment of the session.
2. **Form: multiple choice** (use AskUserQuestion), 3 options — the real principle, a
   plausible near-miss, and a clearly-wrong distractor. Recognition beats recall for a
   builder at this stage; free-text "explain the concept" questions produced blank stares in
   v1. Offer free-text as the "Other" escape, never as the requirement.
3. **Stakes stated up front:** say *why* this question, in one line ("this decides whether
   the principle goes in the playbook").
4. **The outcome, immediately and named.** Whatever he answers, something visible happens
   *in the same reply*:
   - Right → "Locked. I've written it into the card as confirmed; it'll come back as a
     scenario quiz in ~a week, then retire."
   - Wrong/unsure → re-explain in two plain sentences, then: "No penalty — I've marked it
     'watching'; you'll see it again in a different form." (No streak resets announced like
     a scolding. The v1 ledger literally recorded "founder needed the answer, streak reset" —
     never write that sentence again.)
   - Either way, if the principle is playbook-worthy, show the one-line diff being added.
5. **Skipping is fine.** "Skip" is a first-class answer, logged without comment. Three skips
   in a row on the same card = the card wasn't worth a question; drop it silently.

**Quizzes (spaced repetition), redesigned:** only decision cards and *witnessed* friction
cards enter rotation. A quiz question is always a **scenario with its context restated**
("You're adding a synced field to Cadence — here's what that means: … — what's the first
thing that breaks if you skip the seeder gate?") and **multiple choice**. One quiz max per
wrap, and only if a card is due (~1 week since last touch); a wrap with a new-moment question
skips the quiz — one question total, always.

## §5 Weekly synthesis — one paste, ~30 minutes

Once a week, fixed slot, paste into any session (or better: after CURRICULUM item 10, this
arrives as a scheduled routine and pastes itself):

> **Weekly review.** 1) Read every repo's LEARNINGS.md for cards since [date]; promote
> playbook-worthy ones into PLAYBOOK.md (as instances of existing concepts where possible),
> dedupe, show me the diff in plain English. 2) Look at playbook/CURRICULUM.md: tell me how
> last week's technique went based on the cards, mark its status, and recommend next week's
> — one line on why. 3) Glance at SOP-deploy.md's model inventory for anything nearing
> retirement. 4) End with exactly one scenario quiz from a due card — multiple choice.

His cost: read one diff, confirm one technique, answer one question.

## §6 Monthly review — first session of the month, ~45 minutes

> **Monthly review.** Open playbook/NORTH_STAR.md. 1) Re-score the four tracks — argue from
> evidence in this month's LEARNINGS/commits, not vibes; show me last month's scores next to
> your proposal. 2) Portfolio: recommend any tier changes, promotions, kills — with one-line
> reasons. I decide. 3) Ask me the graduation-test question: what happened this month that
> moved toward it? 4) Rewrite NORTH_STAR.md's assessment + date, show me the diff. 5) Refill
> CURRICULUM.md if fewer than 4 unstarted items remain — check what's new in Claude Code
> since the last refill.

## §7 The self-test that matters (unchanged from v1 — it was right)

You've internalized a principle when you **predict the failure or name the tradeoff before
the session does.** Watch for the first unprompted "careful — does anything cache this?" or
"what's the smallest slice here?" That's the metric. Not cards collected — questions you no
longer need asked.
