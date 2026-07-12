# NORTH_STAR — the builder's path

**Who this is for:** Ankit first; Claude sessions read it whenever a conversation is about
*what to build next*, *whether to start something new*, or *how the journey is going* —
strategy conversations, the weekly synthesis, and the monthly review. Routine build sessions
don't need it.

**What it is:** the one document that ties the whole journey together. Ten projects exist
because of an instinct: *build real things for yourself and the skill will come.* The instinct
was right — but skill only compounds when it's named, measured, and practiced deliberately.
This doc names it, measures it, and schedules the practice.

---

## 1. The goal, stated once

> Build a skill set that is marketable in the AI economy — usable to ship commercial-grade
> products, to consult, or to be valuable inside someone else's company. The projects are the
> gym, not the goal.

Two implications that govern everything below:

- **A project is worth building only if it stretches a named skill.** "I want this app" is a
  fine reason to build; "what will building it teach me that the last one didn't?" is the
  question that turns it into training.
- **The skill must be extractable from Claude.** After every build, the honest test is:
  *what do I now know that I could apply in a room without this AI session?* If the answer
  is "nothing," the session produced software but no skill.

## 2. The skill, named — four tracks

"Vibe coding" is not a marketable skill description. This is:

| Track | What it actually is | Marketable as |
|---|---|---|
| **P — Product judgment** | Deciding what to build, for whom, how small the first slice is, what to cut, when to kill. Friction budgets, progressive disclosure, "does this earn its place?" | Product manager / founder instinct |
| **S — System literacy** | Reading software *conceptually*: where data lives, what syncs, what caches, what's client vs server, what fails silently. Not writing code — asking the right question about code. | Technical PM / the person who can talk to engineers |
| **D — AI direction** | Getting excellent output from AI economically: specs and acceptance criteria, reviewing plans before code, demanding verification, using skills/agents/connectors, spending tokens where they pay. | AI-workflow consultant / the highest-leverage new job in every company |
| **O — Shipping operations** | Deploys, env vars, domains, caches, monitoring, incident response, cost control. Making software *stay* alive, not just come alive. | The person who can actually launch and run a product |

### The levels (same ladder for every track)

- **L1 Passenger** — it happens around you; you consume the result.
- **L2 Pilot** — you steer it on purpose; you know the moves and use them.
- **L3 Navigator** — you predict problems before they happen and design around them.
- **L4 Professional** — you could do this for someone else, for money, and defend your choices.

**Marketable = L3 in all four tracks, L4 in at least one.** That is the finish line this
document points at.

### Honest starting assessment (2026-07-12 — re-score monthly)

| Track | Level now | Evidence |
|---|---|---|
| P | **L2, strongest** | SignalDesk's snapshot-first disclosure, TradeGenie's friction budgets, UoT's locked-decisions discipline, BillBud's "mom test" — these are real product calls, made by you. Gap to L3: they're reactive taste, not yet a repeatable method you could run on a stranger's product. |
| S | **L2, fragile** | You *recognize* concepts when explained (sync contracts, cache bumps, optimistic writes) but per your own account, retention is low and you couldn't yet whiteboard how one of your own apps works end to end. |
| D | **L1–L2** | You brief well in English and iterate well, but by your own description you don't know what skills, subagents, connectors, or plan mode are — you're using maybe 30% of the instrument. This is the cheapest big win available. |
| O | **L2** | You've shipped ~8 products to Vercel, handled env vars, upgraded plans for cron, survived a model retirement. Gap: it's pattern-following; incidents still require Claude to diagnose. |

## 3. The portfolio, tiered

Every repo now has a job. The tier decides how sessions treat it. (Assignments below are my
recommendation — confirm or reshuffle at the first monthly review; after that, tiers only
change at monthly reviews, not mid-week on impulse.)

| Tier | Rule | Projects |
|---|---|---|
| **1 — Flagship** (max 2) | Where deep iteration and *new-technique practice* happen. Every CURRICULUM exercise runs here first. | **DayOS** (the daily-driver lab — you use it every day, so feedback is instant) · **PartySpark** (the commercial candidate — the only one with a plausible public user base and share loops already built) |
| **2 — Live utilities** | Keep them working; small improvements on request; no ambitious expansion without promotion. | SignalDesk · TradeGenie · BillBud · Meal-Planner · Cadence |
| **3 — Special** | Its own rules; a product-thinking gym, not a shipping race. | UoT |
| **4 — Parked** | No sessions unless explicitly revived (with a BUILD_BRIEF). | instatank42 (undeployed) · Penalty-Shootout (parked after owner playtests conclude, or promote) |

**The anti-aimlessness rule:** no new project, and no major new feature on a Tier-1 project,
without a filled **`templates/BUILD_BRIEF.md`** (10 minutes). The brief forces the questions
experience would otherwise ask: who is it for, what's the smallest slice, what does done mean,
what does it *train*, and what gets displaced to make room. A session asked to start something
new should offer to walk through the brief conversationally, then save it into the new repo.

## 4. The operating cadence

Three loops, each with a fixed cost. Nothing here depends on memory — sessions and hooks
carry the triggers.

| Loop | When | Cost | What happens |
|---|---|---|---|
| **Session** | every build session | ~3 min | 📍 flags during the work + `/wrap` v2 at the end (see `LEARNING_METHOD.md` — one question, about something you witnessed, answer changes something visible) |
| **Weekly** | one fixed slot/week | ~30 min | One paste-prompt (in `LEARNING_METHOD.md` §5): synthesis of the week's cards + **pick next week's technique from `CURRICULUM.md`** + model-retirement glance |
| **Monthly** | first session of the month | ~45 min | Re-score the four tracks against evidence · re-tier the portfolio · promote/demote/kill · choose the month's focus track |

## 5. The graduation test

Skill that's only ever been applied to your own apps is still unproven. Within roughly the
next quarter, pick **one** of these and treat it as the milestone:

1. **Ship for a stranger** — build or meaningfully improve something whose user is not you
   (a friend's business tool, a real PartySpark public launch with feedback channels).
2. **Consult once** — walk someone else through building a product with AI, using your
   playbook, and get them shipped.
3. **Present the method** — write up or record "how a non-technical founder ships production
   software with AI" from your own artifacts (playbook, LEARNINGS, briefs). If it teaches a
   stranger something, the skill is real and marketable.

The monthly review tracks progress toward whichever one is picked.

## 6. What this document is not

- Not a task list — repos have their own handoffs and backlogs.
- Not a promise to be less playful. Random exploration is allowed — Tier 4 and toy branches
  exist for it. The rule is only that it be *labeled* as play, so it stops masquerading as
  progress.
- Not finished. It gets rewritten by the monthly review, in plain English, with a date.
