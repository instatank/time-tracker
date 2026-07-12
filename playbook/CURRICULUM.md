# CURRICULUM — the technique ladder (Track D: AI direction)

**Who this is for:** Ankit, at the weekly review, picking the next technique. Claude sessions
read it when the founder says "this week's technique is ___" so they know what to practice and
how to coach it.

**The rule: one technique per week. No more.** Each week's technique gets used on a real task
in a Tier-1 project (see `NORTH_STAR.md`), and produces one decision card
(`LEARNING_METHOD.md`). Adopting two at once is how none of them stick. If a week goes by
without using it, the same technique rolls over — that's normal, not failure.

**Format per item:** *What* (plain English) · *Why it pays* · *This week's exercise* ·
*You have it when*.

Status legend: `☐ not started · ◐ tried once · ● habit`. Update at weekly review.

---

## First, one correction

**You already use skills.** `/wrap` and `/ship` — the things you trigger with a slash — ARE
skills: folders in each repo (`.claude/skills/wrap/SKILL.md`) containing instructions a
session follows when invoked. They work in Claude Code everywhere — terminal, desktop app,
web/cloud sessions. Typing `/` in the input box lists what's available in the current repo.
So the belief "I can't invoke skills in Claude Code" is simply false — you've been invoking
them for weeks. What's true is you haven't yet *authored* one deliberately or used the
built-in ones. That's Week 3.

---

## Level 1 — Control the work (weeks 1–4)

### 1. ☐ Plan mode — see the plan before any code is written

- **What:** Claude Code has a mode where the session must present a plan in English and get
  your approval before touching a single file. (Shift+Tab in the terminal/desktop input cycles
  modes; or just say "enter plan mode" / "give me a plan first, don't build yet.")
- **Why it pays:** Today you review *results* — which means rework when taste was guessed
  wrong (the BillOS header, ~10 rounds). Reviewing the *plan* costs 2 minutes and catches the
  same problems before tokens are spent. This is the single highest-leverage habit for a
  non-technical director: plans are in English; code isn't. It's also the token-efficiency
  move — a rejected plan costs hundreds of tokens, a rejected build costs tens of thousands.
- **This week:** every non-trivial ask starts with "plan first." Reject or edit at least one
  plan — feel what it's like to steer before the work.
- **You have it when:** approving a plan feels like reviewing a contractor's quote, and you
  catch a wrong assumption in one before any code exists.

### 2. ☐ The spec sentence — "done means…"

- **What:** before Claude starts, *you* state 1–3 acceptance criteria in one breath: "Done
  means: I can X on my phone, Y still works, and Z fails loudly if the network dies."
- **Why it pays:** PLAYBOOK Rule 2 exists, but today Claude extracts the criteria *for* you —
  which means the skill lives in Claude. Saying it yourself is Track D's core muscle: a spec
  is the unit of delegation, to an AI today, to a contractor or employee later. This is the
  direct answer to "anybody could do this" — most people can't write a crisp spec; it's rare
  and it's visible in the result.
- **This week:** open every feature request with a "done means" sentence before Claude says
  anything. Let sessions coach: if a criterion isn't testable, they should say so.
- **You have it when:** a session's first draft passes your own criteria most of the time —
  because the criteria did the steering.

### 3. ☐ Skills — author one yourself

- **What:** a skill is a reusable instruction file a session executes on demand. You have
  repo skills (`/wrap`, `/ship`). You can also have *personal* skills (in `~/.claude/skills`
  on your machine) that work in every repo.
- **Why it pays:** anything you've told Claude three times should become a skill — it's the
  difference between re-explaining and invoking. It also teaches you the shape of encoded
  process, which is exactly what consulting deliverables look like.
- **This week:** have a session build you `/brief` — a skill that interviews you through
  `templates/BUILD_BRIEF.md` conversationally and saves the result. You now own a skill you
  designed.
- **You have it when:** you notice a repeated instruction and your reflex is "make this a
  skill" — and you can describe to a session exactly what the skill should do.

### 4. ☐ Context economy — sessions are workspaces, not chat threads

- **What:** a session's context window is a finite desk. Everything on it (long chats, pasted
  files, old tangents) crowds the work. The moves: **one task per session**; start fresh
  (`/clear` or a new session) when switching topics; let Claude *read files itself* instead of
  pasting them; put permanent facts in CLAUDE.md instead of repeating them (you already do
  this well — your CLAUDE.md files are genuinely excellent, which is why sessions start smart).
- **Why it pays:** this IS token efficiency — the thing you said you're not learning. A
  crowded context makes output worse *and* more expensive at the same time. The 40-message
  session that drifts is paying more for less.
- **This week:** end sessions when the task ends. Notice once that a fresh session with a good
  CLAUDE.md outperforms a tired long one, and write the card on it.
- **You have it when:** you treat "start a new session" like closing a messy desk, without
  feeling you're losing something — because the durable knowledge lives in the repo, not the
  chat.

## Level 2 — Multiply the work (weeks 5–8)

### 5. ☐ Subagents — send a scout, keep your desk clean

- **What:** a session can spawn helper agents (e.g. an Explore agent) that go read a codebase
  or research a question in their *own* context and report back only the conclusion. You just
  say: "use a subagent to investigate X before we plan."
- **Why it pays:** research is the biggest context-polluter. A scout burns its own desk, not
  yours — the main session stays sharp for decisions. This is the entry ramp to what you
  called "loop engineering": orchestrating multiple AIs instead of chatting with one.
- **This week:** before the next non-trivial feature, ask for a subagent scout of the affected
  code. Compare how the main session feels afterward.
- **You have it when:** "should a subagent do this part?" is a question you ask, not one
  Claude asks you.

### 6. ☐ Adversarial review — /code-review and the verify habit

- **What:** built-in skills exist that review a diff for bugs (`/code-review`) and drive the
  actual app to prove a change works (verify). Separately: always demand *evidence* of done —
  "show me the test output / the screenshot," never accepting "it should work now."
- **Why it pays:** PLAYBOOK Rule 5 (static checks aren't verification) currently depends on
  Claude's discipline. This puts the enforcement in *your* hands with two words. A director
  who demands evidence gets a different grade of work — true of AI, contractors, employees.
- **This week:** before any ship, run `/code-review`. Once, ask "verify this end-to-end and
  show me what you observed" and read what comes back.
- **You have it when:** "show me" is your reflex, and unverified "done" claims feel as wrong
  to you as an unbumped cache key.

### 7. ☐ Connectors (MCP) — give sessions hands beyond the repo

- **What:** connectors let a session operate other tools directly — GitHub, Vercel (deploy
  status, build logs, runtime errors), Gmail, Notion, Google Drive. Cloud sessions here
  already have GitHub + Vercel wired; you've watched sessions use them without naming them.
- **Why it pays:** without connectors you are the middleware — copy-pasting Vercel errors into
  chat. With them, "check why last night's deploy failed and fix it" is one sentence. Fewer
  round-trips through you = faster and cheaper.
- **This week:** next deploy issue, don't paste anything — say "use the Vercel connector to
  pull the build logs and diagnose." Watch it work.
- **You have it when:** you know which connectors your sessions have, and reach for them by
  name.

### 8. ☐ Hooks — automation that fires without anyone remembering

- **What:** hooks are rules in a repo's settings that run automatically on events — you
  already have one (the Stop hook that nudges `/wrap` if a session shipped commits and
  forgot). They're how a lesson graduates from "documented" to "cannot be skipped"
  (PLAYBOOK L11).
- **Why it pays:** every process that depends on memory eventually skips; hooks don't. This
  is the machinery layer of the fluency ladder: *felt it → can say it → machine enforces it.*
- **This week:** pick one repeated miss (e.g. cache-key bump) and ask a session: "add a hook
  that catches this before push." You specify the behavior; it wires the plumbing.
- **You have it when:** after a second bite of any mistake, your instinct is "this becomes a
  hook or a gate," not "I'll remember next time."

## Level 3 — Orchestrate (weeks 9–12)

### 9. ☐ Parallel fan-out — many agents, one question each

- **What:** for wide jobs (audit all 10 repos for X, review a big diff from three angles),
  sessions can run several agents in parallel and merge the findings — this is real "loop
  engineering." You invoke it in English: "fan out subagents to check every repo for
  hardcoded model IDs and give me one table."
- **Why it pays:** some jobs are horizontal, and doing them serially in one context is slow,
  expensive, and lossy. Fan-out is how one person operates like a team — the defining skill
  of the AI economy you're aiming at.
- **This week (when a wide job genuinely appears — don't invent one):** phrase it as a
  fan-out and review the merged result instead of ten transcripts.
- **You have it when:** you can look at a task and say "that's one agent" vs "that's five
  agents and a merge" — and be right about the cost.

### 10. ☐ Scheduled routines — work that happens while you sleep

- **What:** cloud sessions can be triggered on a schedule (cron) — e.g. the weekly synthesis
  could run itself every Friday and message you the diff + the one quiz question, instead of
  waiting for you to paste the prompt.
- **Why it pays:** rituals survive when they arrive *at* you (this is your own push-
  notification lesson from DayOS, applied to yourself).
- **This week:** ask a session to schedule the weekly synthesis as a routine. Keep the manual
  paste as fallback.
- **You have it when:** the Friday summary shows up unprompted and you act on it.

### 11. ☐ Model & cost matching — the right brain for the job

- **What:** models differ in cost ~10× (Haiku: fast/cheap; Sonnet: balanced; Opus/Fable:
  deep). You already did this once deliberately (instatank42 routes short messages to Haiku).
  The skill is asking: "does this task need the expensive model?" — for both your API-powered
  features *and* your own building sessions.
- **Why it pays:** cost control is a marketable operations skill in itself; every company
  deploying AI is desperate for someone with model-economics instinct.
- **This week:** review one of your apps' AI features and ask "would Haiku do here?" Run the
  comparison; decide with numbers.
- **You have it when:** you can defend, in one sentence each, why every AI call in your stack
  uses the model it uses.

### 12. ☐ Read the map — one system, whiteboarded (Track S capstone)

- **What:** pick one app you built and have a session teach you its full data journey until
  you can draw it from memory: where a tap lands, what saves locally, what syncs, what caches,
  what the server does, what fails silently and where you'd find out.
- **Why it pays:** this converts accumulated exposure into actual system literacy — the
  difference between "I have built apps" and "I understand my apps," which is the difference
  interviewers and clients probe for.
- **This week (schedule it as its own session, not a build session):** DayOS or BillBud —
  30 minutes of "explain, quiz me, correct me." Save your final drawing/description in the
  repo.
- **You have it when:** you can explain to a smart friend, unaided, why the app still works
  in airplane mode and what happens when it comes back online.

---

## After week 12

The ladder isn't finished — it refills at the monthly review from whatever the frontier is
then (new Claude Code capabilities ship monthly; ask a session "what's new since [date] that
belongs on my curriculum?"). But these twelve, made habitual, put Track D at L3 — which was
the cheapest big win on the whole board.
