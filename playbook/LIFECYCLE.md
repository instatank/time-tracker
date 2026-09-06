# LIFECYCLE — expand, prove, cut

**Scope:** every repo, but written against the two apps actually running the experiment —
DayOS (`time-tracker`) and TradeGenie.
**Relationship to other docs:** `PLAYBOOK.md` is *how* we build (working rules).
`NORTH_STAR.md` is *why*. This file is **what survives** — the rules that decide whether a
feature gets built, kept, merged, or deleted. Where it and a repo's CLAUDE.md disagree about
the mechanism, the repo wins; about the *decision procedure*, this file wins.
**Format:** EXECUTE (mechanical, for a session) + UNDERSTAND (the reasoning, for Ankit).

---

## 0. The strategy, and the hole in it

The founder's strategy, in his words:

> *"Try out different features, see what works, what doesn't, and what breaks everything.
> Once all of that is done, clean it up, delete, and simplify. That way we've tested all
> possibilities out, and then we're just clearing up the noise and really stripping it down
> to the essentials."*

That is a good strategy and this file exists to make it executable. It has one hole and one
missing precondition, both of which have to be named before anything else in here works.

**The hole: neither app measures use.** Verified 2026-09-06 — DayOS has no feature-usage
instrumentation (`projectUsageCounts` and `collectAllTagsInUse` count *records per project or
tag*, not invocations of a feature); TradeGenie has none either, and no toggle system at all.
So "decide what graduates based on how much it's being used" is currently decided by founder
recall. Recall is reliable for the loud cases — the add-picker had eight rows and he knew he
used three — and unreliable for exactly the cases that matter most: a feature used rarely but
valuably (kill it and you'll miss it in six weeks), and a feature never *discovered* (reads
identically to "unwanted"). **Instrumentation is Phase 0. It is not optional and it comes
before any further elimination pass.**

**The missing precondition: cutting later only works if adding was cheap to reverse.**
Deleting a screen does not delete the Firestore collection it forced, the enum values now
sitting on 400 records, the sync path, the backup entry, or the contract in
`docs/second-brain-integration.md`. DayOS's CLAUDE.md already names this as the
characteristic failure of the contraction phase. Generalised, it is a rule for the
*expansion* phase: **the exit cost of a feature is decided when you build it, not when you
cut it.** An expansion phase that ignores reversibility manufactures debt that the
contraction phase cannot clear — you end up with a minimal UI sitting on a maximal schema,
which is the worst of both.

---

# Part 1 — The model

## 1.1 The phase belongs to the FEATURE, not the app

The instinct is "DayOS is in contraction, TradeGenie is in expansion." That is true as a
*bias* and false as a *rule*. DayOS shipped offsite backup last week — that feature is one
week old and has never been reviewed; it is in expansion. TradeGenie's capture pipeline is
ten months old, heavily used, and already had its "Note type" dropdown cut — that is
contraction, inside an app nominally in phase 1.

So every feature carries its own stage:

| Stage | Name | What it means | Gate to leave |
|---|---|---|---|
| **S0** | **Sketch** | Proposed, not built. Has a written kill criterion and an exit cost. | Founder says build it |
| **S1** | **Trial** | Built, behind a toggle, **off by default**, instrumented, has an expiry date. | A fair trial (§R4) + census verdict |
| **S2** | **Default** | Toggle exists but defaults **on**. Still deletable in one commit. | Two consecutive censuses at "keep" |
| **S3** | **Core** | Toggle deleted, one code path, permanent. Cutting it is a project. | Only via an explicit Cut decision |
| **X** | **Cut** | Merged, deleted, or demoted. Recorded in the Removed ledger. | — |

S1→S2 is the graduation the founder described. S2→S3 is the one that actually costs
something, because it is where the second code path goes away and the feature stops being
cheap to reverse. **Most features should die at S1 or S2. S3 should be a short list.**

## 1.2 The app phase sets the default answer, nothing more

| | Default answer to "should we add this?" | Default answer to "can this be merged?" | Census ratchet |
|---|---|---|---|
| **DayOS — contraction** | **No**, unless it replaces something | **Yes, try** | Every census must cut or merge ≥1 thing |
| **TradeGenie — expansion** | **Yes**, if reversible (§R2) | Ask anyway | Every census must *name* ≥1 cut candidate |

That is the whole difference. A cut in TradeGenie does not wait for a phase change — it waits
for evidence. What waits for the phase change is the *sweeping* minimalist pass.

## 1.3 Four exits, ranked

When a feature fails its criterion, the options in order of preference:

1. **Merge** — the thing stays reachable, the surface shrinks. *Nothing is lost.* The
   2026-08-30 add-picker work is the reference: 8 rows → 3, every option rehomed onto the
   screen it belonged to. **Always the first thing to try.**
2. **Delete** — the thing goes, UI + data + docs (§R6). Honest and cheap to reason about.
3. **Demote** — S2 → S1, or move behind a fold. Legitimate for something genuinely used
   *sometimes*; a lazy default otherwise, because it keeps the second code path.
4. **Keep as is** — requires a stated reason at census, not silence.

**Prefer merging over deleting; prefer deleting over hiding.** A menu that duplicates a
choice its destination already presents is pure cost.

---

# Part 2 — The rules

## R1 — Pre-register the kill criterion. No birth certificate, no build.

**EXECUTE:** Before writing code for anything at S0, append a row to that repo's feature
ledger (`docs/experiments.md` in DayOS; `docs/lifecycle.md` in TradeGenie) with:

```
id:            short stable key, used by the toggle AND the usage counter
stage:         S0
built:         YYYY-MM-DD
one-liner:     what it does, in the founder's language
earns-its-place-if:  <a falsifiable condition, with a number and a date>
exit-cost:     REVERSIBLE | STICKY | STRUCTURAL   (see R2)
touches-data:  no | <collection/key/enum it adds>
review-on:     YYYY-MM-DD  (built + 6 weeks, or built + 2 censuses)
```

`earns-its-place-if` must be falsifiable. "If it's useful" is not a criterion. "Used ≥8 times
in 30 days, or used at all in the week after a losing streak" is.

**UNDERSTAND:** This is pre-registration, borrowed from clinical trials for exactly the
reason trials use it: a criterion written *after* you see the result is a criterion you
rationalise. You built the thing; you will want it to have earned its place. Writing the
number down at birth is the only cheap defence against your own sunk cost — and it costs one
line at the moment you are most able to write it honestly.

## R2 — Rank the exit cost before you build, and let it veto the build

Three classes:

- **REVERSIBLE** — render-only, reads existing state, one injection site, no new field, no new
  collection, no new enum value written to records. *Deleting it is a diff.* All three current
  DayOS toggles are this.
- **STICKY** — adds a field to an existing record, or a value to an enum records now carry.
  Deleting the UI leaves the field on real data forever. Needs a migration story written at
  S0 or it is not a trial, it is a commitment.
- **STRUCTURAL** — new collection, new sync path, new backup entry, new external contract
  (`second-brain-integration.md`), new cron. **This is never an experiment.** It is an
  architecture change and gets the full treatment: acceptance criteria, silent-failure
  question, sync checklist. DayOS's CLAUDE.md already says this about toggles; it is true of
  every addition, toggle or not.

**EXECUTE:** In the expansion phase, a REVERSIBLE feature needs no argument. A STICKY one
needs the migration story. A STRUCTURAL one needs the founder to say yes to the *permanence*,
not just the feature. If an idea can be built REVERSIBLE by narrowing it, build the narrow
version first — the narrow version is the experiment, and the full one is what graduation buys.

**UNDERSTAND:** This is the rule that makes the founder's whole strategy work. "Add
everything, cut later" is only rational if cutting is actually possible. Rank the exit cost up
front and the expansion phase stops silently issuing debt that the contraction phase can't
repay. It also converts a lot of "should we build this?" arguments into "build the reversible
half and find out", which is faster than arguing.

## R3 — Instrument at the entry point, or it doesn't ship

**EXECUTE:** Every feature at S1 or S2 records its own use, keyed by the same `id` as its
toggle. One call at the point of *deliberate use* — not at render.

- **DayOS:** `noteUse('<id>')` → `dayos_feature_usage_v1` = `{ [id]: { n, last, first } }`.
  Local-only, same as the toggles, same reasoning: no new collection, no sync checklist entry,
  no backup change. Wrapped in try/catch — **a counter must never break a render.** Coalesce
  writes (one localStorage write per interaction, not per keystroke).
- **TradeGenie:** counters on `appSettings/singleton` (already request-cached via
  `getSettings()`), bumped inside the server action or the `force-dynamic` page that
  represents deliberate use. **Count acts, not renders** — a page render is a navigation, a
  server action is a decision. Never load-bearing: failure is swallowed, the action proceeds.

Nothing leaves the device or the founder's own Firestore. No third-party analytics, ever —
that is settled by `docs/security-audit.md`'s doctrine and not reopened here.

**UNDERSTAND:** You cannot run the strategy you described without this, and you have been
running it on memory. Memory is a biased instrument: it over-weights what you used yesterday
and what annoys you, and it has no record at all of the feature you forgot exists. Counting is
cheap; guessing is what costs you a feature you'd have kept.

## R4 — Non-use is only evidence after a fair trial

**EXECUTE:** A feature may not be cut *for non-use* unless all three hold:

1. It was **on by default** (S2) or its entry point was visible on a main screen, for the
   whole window.
2. The window is ≥ 30 days **and** ≥ 1 full census cycle.
3. The founder was reminded it exists at least once (the census report counts).

If any fail, the verdict is **"no fair trial — promote to S2 and re-review"**, not "cut".
A feature can still be cut for *cost* (it's in the way, it duplicates something) at any time —
that is a different argument and doesn't need usage data.

**UNDERSTAND:** Off-by-default plus "you never used it" is a rigged trial: you're measuring
discoverability and calling it value. This rule is what stops the census quietly killing the
good hidden features and keeping the mediocre prominent ones — which is the exact failure mode
of every "we looked at the numbers" product cull.

## R5 — Toggles are a standing cost. Budget them.

**EXECUTE:** **Cap: 4 toggles per app.** Every entry is a permanent second code path — two
render branches, two states to reason about, two things to test. Adding a fifth requires
either retiring one in the same commit, or a written justification in the census. DayOS went
6 → 3 in one pass; three is healthy, six was not.

**UNDERSTAND:** A toggle feels free because it defers a decision. It isn't — it charges rent
in complexity every time anyone touches that screen, forever, and the interest is paid by the
next session that has to reason about a code path nobody has looked at in months.

## R6 — Deleting UI is not deleting the feature. Check three places.

**EXECUTE:** Every cut checks:

1. **UI** — render fns, helpers, CSS block, sheets/components, wiring sites. *Grep every
   symbol before deleting it* — the ledger's delete-list is a starting point, not an
   authority (`_dayHasContent` was sitting inside the Journal Heatmap while On This Day
   depended on it).
2. **Data** — the `localStorage` key, the Firestore collection, the enum value already on
   records, the tombstone list, the backup manifest, the restore half. State explicitly
   whether orphaned data is being kept (fine, say so) or removed (needs a migration).
3. **Docs** — the feature ledger's Removed section, CLAUDE.md, and for anything synced,
   `docs/second-brain-integration.md` **in the same commit**.

**UNDERSTAND:** This is the characteristic failure of a contraction phase, the way duplicate
auto-blocks were the characteristic failure of the expansion phase. The screen goes, everyone
declares victory, and the schema keeps the scar.

## R7 — Prove reachability before removing any entry point

**EXECUTE:** Before deleting a button, menu row, or link: demonstrate the destination is still
reachable another way, and **write where it went into a comment at the deletion site.** Both
2026-08-30 removals did this (`ai-switch-btn` inside the Log Activity sheet;
`openAttachMenu('capture')` inside the capture sheet).

**UNDERSTAND:** Merging and orphaning look identical in a diff. The comment is what tells the
next session which one happened.

## R8 — The ratchet: a census in a contracting app must cut something

**EXECUTE:** In an app whose phase is contraction, a census that produces zero merges and zero
deletions is not a completed census. Either something goes, or the report states plainly that
the app has reached its floor — and then the phase changes, on the record.

**UNDERSTAND:** Without a ratchet, "we're in the contraction phase" becomes a thing you say
rather than a thing you do. The review turns into a status meeting and the surface grows
anyway. One forced cut per cycle is small enough to always be possible and large enough to
compound.

## R9 — A toggled feature owns no helper another feature uses

**EXECUTE:** If a helper is shared, it lives outside the toggle's block, in a clearly named
shared section, with a comment naming both consumers. Check this at build time, not at delete
time.

**UNDERSTAND:** Already learned the hard way in DayOS. Restated here because it is the single
thing that turns a five-minute delete into an outage.

## R10 — Surface budgets make contraction falsifiable

**EXECUTE:** Contraction toward "minimal" is unfalsifiable without a number. **Adopted
2026-09-06** — the founder took the recommended numbers rather than setting his own, which
makes them a starting hypothesis, not a verdict. Any census may revise a budget; say why in
the report, so a budget that keeps moving to accommodate the surface is visible as such.

| Surface | Now (measured 2026-09-06) | Budget |
|---|---|---|
| DayOS — nav tabs | 4 | 4 (hold) |
| DayOS — Settings rows | 15 | 10 |
| DayOS — toggles | 3 | ≤4 |
| DayOS — Today-page interactive elements | *not yet counted* | count first, then set |
| TradeGenie — primary nav | 5 | 5 (hold) |
| TradeGenie — "More" nav | 10 | 6 by end of contraction |
| TradeGenie — routes | 22 | not yet — expansion phase |

Over budget is not an emergency; it is the census's first agenda item.

**UNDERSTAND:** "Strip it down to the essentials" is a direction, not a target. A number turns
each census from a taste conversation into a check you can fail — and gives the ratchet
something to aim at.

---

# Part 3 — The Census (the loop)

**Cadence:** monthly, per app. Offset the two by a fortnight so no session does both.

**EXECUTE — a census is one session that produces one report and nothing else. No code.**

1. Read the repo's feature ledger and its CLAUDE.md.
2. Read the usage counters. For each feature: uses in window, last used, days since built.
3. Produce this table, one row per feature at S1/S2, plus any S3 the founder flagged:

| id | stage | uses (30d) | last used | criterion | met? | fair trial? | recommendation |
|---|---|---|---|---|---|---|---|

4. For each recommendation give the **default action** and what it costs — Merge into what,
   Delete what, Demote why. Merge is checked first, every time (§1.3).
5. Apply §R8's ratchet. Name the over-budget surfaces from §R10.
6. **Ask the founder at most one question**, per `LEARNING_METHOD.md` v2 — the single
   genuinely ambiguous call, as multiple choice, with the visible consequence of each option.
   Everything else takes its default.
7. Output goes in the ledger with the date. The *next* census reads it, which is what makes
   "two consecutive keeps" (S2→S3) a real gate rather than a vibe.

**What a census must never do:** cut a feature that failed §R4's fair trial; cut on a
criterion invented during the census; bundle a code change into the report.

**Automating it:** this is a real candidate for a monthly Routine that fires a fresh session
with the standing prompt (Part 4, Prompt C). Worth doing *after* one census has been run by
hand and the report format has survived contact. Not before.

---

# Part 4 — Applying it to the two apps

## DayOS (`time-tracker`) — contraction, needs Phase 0 first

Already has: the toggle system (`FEATURE_TOGGLES`, `featureEnabled`,
`dayos_experiments_v1`), the ledger (`docs/experiments.md`) with a Removed section, and a
contraction phase declared in CLAUDE.md. It is the reference implementation of the mechanism.

Missing: usage counters (§R3), kill criteria on the three live toggles (§R1, retro-fitted),
and stage labels (§1.1).

**Trimming continues in parallel with Phase 0** — the founder's call, 2026-09-06, and the
right one: an app in contraction that stops cutting for a month to build a measuring device
has swapped one kind of inaction for another. What the counters change is not *whether* you
cut, but *which argument* you are allowed to use:

- **Cost** — it is in the way, it duplicates a choice its destination already presents, it
  costs a tap that buys nothing. Needs no data, has never needed data, and is what every
  2026-08-30 cut actually ran on. Available today.
- **Non-use** — you don't use it. Needs a fair trial and a counter (§R4). Not available until
  the counters have run a cycle.

**Every removal records which of the two it used**, in the `docs/experiments.md` Removed
ledger, in the same line that says where the feature went. That is the whole enforcement
mechanism and it costs three words. It exists because the two arguments are easy to blur in
the moment — "I never use it" and "it's in the way" feel like the same sentence — and the
ledger is where a census can see whether every cut this quarter was filed as cost, which
would mean the distinction has quietly become a formality.

## TradeGenie — expansion, and a straight port would be wrong

The founder's ask is "replicate the experiments system." Port the **discipline**; adapt the
**mechanism**. A copy of the DayOS implementation would be wrong three ways:

| | DayOS | TradeGenie | Why it differs |
|---|---|---|---|
| Storage | `localStorage`, per device, unsynced | `appSettings/singleton` in Firestore | TG renders on the server; there is no client state to read a flag from, and one trader on one journal has no "per device" concept worth having |
| Gate | `featureEnabled(k)` inline in a render string | `featureEnabled(k, settings)` server-side, settings already request-cached | TG's pages are server components; `getSettings()` is already loaded on every render |
| Screen | Settings → 🎛 Optional features | `/settings` → same, owner-only | TG has a read-only viewer role; toggling is a POST and is already blocked for viewers by `middleware.ts` — no new check needed |
| Ledger | `docs/experiments.md` | new `docs/lifecycle.md` | Same shape: active table + Removed ledger + exact delete-lists |

**The rule TradeGenie needs that DayOS doesn't:** it already has two trimming mechanisms —
collapsed "advanced/optional" folds and the "More" nav — and a third would collide with them.
Draw the line explicitly:

- A **fold** hides complexity *within a feature that is staying*. Presentation. Cheap.
- The **"More" nav** hides a *destination* that is staying. Presentation. Cheap.
- A **toggle** governs whether a feature *exists at all*. Lifecycle. Costs a code path.

**Never use a toggle for something a fold would do.** The "exhaustive but lean" pattern in
TradeGenie's CLAUDE.md stays exactly as it is; toggles sit above it, not instead of it.

Also worth saying plainly: TradeGenie being "in phase 1" does not defer all cutting. The
`transcriptType` dropdown was already cut, correctly, mid-expansion. What defers is the
sweeping pass, not individual honesty.

---

# Part 5 — The prompts

Three standing prompts. A, then B, then C on a monthly cycle.

## Prompt A — DayOS Phase 0 (instrumentation + retro-fit)

> Read `playbook/LIFECYCLE.md` first, then this repo's CLAUDE.md and `docs/experiments.md`.
>
> This is Phase 0 of the lifecycle framework: DayOS decides what graduates and what gets cut
> based on usage, and currently measures none. Build the measurement. Change no feature.
>
> 1. Add `noteUse(id)` writing `dayos_feature_usage_v1` = `{ [id]: { n, first, last } }` —
>    local-only, never synced, wrapped in try/catch so a counter can never break a render,
>    coalesced so one deliberate interaction is one write. Keyed by the same ids as
>    `FEATURE_TOGGLES`.
> 2. Instrument the three live toggles (`onthisday`, `threeAdd`, `daybar`) at their point of
>    deliberate use, not at render — plus these core surfaces so the census has a baseline to
>    compare against: each nav tab, the + picker's three rows, search, the DFT strip, each
>    Settings row, Weekly/Monthly review, and each AI feature.
> 3. Surface it: a read-only "Usage" section in Settings → Optional features showing uses and
>    last-used per id, so the founder can see what the census will see. Zero writes from that
>    screen.
> 4. Retro-fit a birth certificate (§R1) onto the three live toggles in `docs/experiments.md`
>    — including a falsifiable `earns-its-place-if` for each, proposed by you and flagged for
>    the founder to correct — and add the stage column (§1.1).
> 5. Run `bash scripts/check.sh`, bump `sw.js`, use `/ship`.
>
> Do not cut, merge, or change any feature in this pass. Report what you instrumented, what
> you deliberately did not, and one thing about the framework that turned out to be wrong when
> it met the code.

## Prompt B — TradeGenie: the lifecycle mechanism, adapted

> Read `playbook/LIFECYCLE.md` (in `instatank/time-tracker`, path `playbook/LIFECYCLE.md`)
> first, then this repo's CLAUDE.md and `PROJECT_BRIEF.md`.
>
> TradeGenie needs the discipline DayOS has — a feature lifecycle with toggles, usage
> evidence, and a ledger — but **not** a copy of its implementation. Part 4 of LIFECYCLE.md
> spells out the three differences (server-side settings, not localStorage; owner-only writes,
> already covered by `middleware.ts`; toggles must not collide with the existing fold and
> "More" nav patterns). Read that section before designing anything.
>
> Build:
> 1. `featureFlags` on `appSettings/singleton` + `featureEnabled(key, settings)` read
>    server-side through the existing request-cached `getSettings()`. Default off.
> 2. A `FEATURE_TOGGLES` catalog with the same fields DayOS's carries, plus `stage` and
>    `exitCost` from LIFECYCLE.md §R1/§R2.
> 3. Usage counters on the same document, bumped inside server actions — **acts, not
>    renders** — never load-bearing, failure swallowed.
> 4. `/settings` → "Optional features", owner-only, listing each flag with its usage and
>    last-used.
> 5. `docs/lifecycle.md` — the ledger: active table, Removed section, exact delete-lists per
>    feature.
> 6. Nothing existing gets put behind a flag in this pass. The mechanism ships empty except
>    for one genuinely optional existing feature that you propose and the founder confirms.
>
> Gate: `typecheck` + `lint` + `test` + `build` + `smoke`, and add a unit test that a flag
> defaulting to off leaves every current page byte-identical. Report honestly, including
> anything in LIFECYCLE.md that does not fit this codebase.

## Prompt C — the standing monthly census

> Read `playbook/LIFECYCLE.md` Part 3, then this repo's feature ledger and CLAUDE.md.
>
> Run the monthly census for <APP>. **Produce a report. Write no feature code.**
>
> Table every feature at S1/S2 with: uses in the last 30 days, last used, its pre-registered
> criterion, whether it was met, whether it got a fair trial (§R4), and your recommendation.
> Check Merge before Delete before Demote, every time (§1.3). Apply the ratchet (§R8) if this
> app is contracting, and name any surface over its budget (§R10).
>
> Ask the founder **at most one** question — the single genuinely ambiguous call, multiple
> choice, with the consequence of each option stated. Everything else takes its default.
>
> Append the report to the ledger under today's date, so the next census can read it.

---

# UNDERSTAND — the five ideas, for Ankit

1. **Pre-registration.** Write down what would make you cut a feature *before* you build it.
   The criterion you invent afterwards is one you'll bend, because by then you own the thing.
   Same reason drug trials register their endpoint before the data comes in.

2. **Reversibility is the tax that makes "add everything" affordable.** Your strategy is
   sound, but it silently assumes cutting is easy. It's easy for render-only features and
   expensive for anything that touched the schema. Ranking that up front is what stops you
   arriving at the contraction phase with a minimal screen sitting on a maximal database.

3. **Absence of evidence isn't evidence of absence.** A feature nobody used might be a feature
   nobody found. Off-by-default plus "you never used it" measures discoverability and calls
   it value. Hence the fair-trial rule: promote it, make it visible, *then* count.

4. **Ratchets beat intentions.** "We're in the contraction phase" is a statement about mood
   until a rule forces one cut per cycle. One is small enough to always be possible and, over
   a year, is twelve.

5. **The phase is a property of the feature.** The single most useful correction to the plan
   as you described it. "TradeGenie is in phase 1" is a default bias, not a permission slip
   for its ten-month-old features to skip review — and "DayOS is contracting" doesn't mean
   last week's backup feature is due for a trim.
