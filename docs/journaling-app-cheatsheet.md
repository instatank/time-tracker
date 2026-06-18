# Cheat sheet for the next journaling app

A briefing to drop into a fresh agent's context at session start. It distills what worked
over many sessions building **DayOS** — a personal time + journaling PWA — so the new app
("Trade Genie", a trading journal) gets a much shorter learning and implementation curve.

The two apps are cousins: both are journals. Lots of entries, lots of thought dumps, lots of
organization needed, and the same trap — features pile up until the thing feels noisy and
cumbersome. Everything below is aimed at avoiding that.

---

## The founder you're building for (read this first)

- **Non-technical founder learning by building.** Explain in plain English. One sentence
  before any terminal command saying what it does and why. No jargon without a quick gloss.
- **Taste is the founder's; implementation is yours.** When there's a real trade-off, list
  2–3 options with their costs and let the founder pick. Don't silently choose for them, and
  don't outsource design taste back to them either — show them something on screen to react to.
- **Push back fast when you've misread the ask.** Solving the wrong problem politely is still
  the wrong problem. Confirm the intent in one line, then go.
- **The phone is the source of truth.** "Works on the laptop" means nothing. The real test is
  "I picked it up on the couch and used it." Build and verify mobile-first.

---

## Core working principles (these saved the most time)

1. **Ship the ugly version first, then react to it on screen.** ~80% of good design decisions
   only become obvious *after* seeing the crude first cut live. Don't design in your head.
2. **One change at a time.** No "while we're here, also fix X." Two changes in one commit means
   double the time to find which one broke. If a change touches more than 2–3 surfaces, split it.
3. **Describe symptoms, not causes.** When the founder says "the box gets taller when I tap
   search," diagnose it yourself — don't let a guessed cause ("must be the zoom thing") lead you.
4. **"Done" = tested on the real flow**, not "code compiles." Reopen the modal, reload the tab,
   check the other device.
5. **Removing a feature is harder than adding one.** Killing something is usually 3 decisions:
   stop creating new ones, what about existing data, what about ones already created today.
6. **Most bugs are tiny.** Forgot a cache bump, didn't reset a variable between modal openings,
   missed one CSS rule. The architecture is rarely the problem. Check the small stuff first.

---

## The UX patterns we landed on (steal these directly)

These are the conventions DayOS converged on after lots of iteration. They map cleanly onto a
trading journal.

- **One "+" button → a small picker → the right modal.** Don't scatter "Add X" buttons across
  the app. A single + opens a short dropdown of entry types; tapping one opens its modal. Keeps
  the surface calm no matter how many entry types exist behind it. (For a trading journal the
  picker might be: Trade, Pre-market plan, Trade review, Quick note, etc.)
- **Bottom-sheet modals, not full pages.** Entries happen in sheets that slide up over the
  current view (`.open` class toggles them). Lighter-weight than navigating away.
- **Few top-level tabs, clear names.** DayOS has four: Today, Journal, Projects, Trends. Resist
  adding a fifth. Group, don't multiply. (Trade Genie equivalent might be: Today, Journal,
  Setups/Strategies, Stats.)
- **Autosave the long-form stuff; explicit Save only for quick structured adds.** Journal-style
  entries (free text, reviews) autosave: debounced ~30s on typing, immediate on blur / pill tap /
  closing the modal. "Cancel" becomes "Close." Short structured entries keep an explicit Save.
- **Soft-delete everything, with a Trash + restore.** Tapping × stamps `deletedAt` rather than
  destroying. A Trash screen (multi-select, restore, delete-forever) plus an auto-sweep that
  hard-deletes after ~7 days. Lets the founder be fearless about deleting.
- **Tags via inline `#hashtags`.** Parse `#tag` out of any text → lowercased filter pills. A few
  reserved tags surface as special filters. Cheap, flexible, no separate tagging UI. (Trading:
  `#breakout`, `#fomo`, `#revenge`, `#a+setup`, ticker tags, etc.)
- **Voice notes = record + attach, nothing fancy.** A basic record→upload→attach flow got ~99%
  of the value in about a day. Don't over-build it.

---

## On trimming & minimalism (the thing you're struggling with)

This is the hardest part and the most important for Trade Genie right now. What worked for DayOS:

- **The Today/home screen is sacred. Keep it nearly empty.** It should answer "what now?" at a
  glance, not show every feature. Power features live one tap deeper.
- **Every feature must earn its pixels on the main surfaces.** If a thing is used weekly, it does
  not belong on the daily view. Demote it into a sheet, a sub-tab, or Settings.
- **Compute, don't store-and-show.** Derived views (totals, streaks, computed categories) are
  calculated at render time and shown only where relevant — they don't add permanent clutter.
- **Trim by *demoting*, not just deleting.** Most "too crowded" fixes are moving a control off
  the hot path (into the + picker, a sub-tab, or Settings), not removing the capability.
- **One primary action per screen.** If a screen has five equally-weighted buttons, the founder
  freezes. Pick the one that matters; make the rest secondary or hidden behind a tap.
- **When in doubt, ship the leaner version and let the founder ask for more.** Adding back is
  cheap; clawing back clutter is expensive.

---

## The AI pattern (it transfers almost 1:1)

DayOS has exactly three AI features and a clean, cheap architecture behind them. The shape is
directly reusable for a trading journal.

**Architecture:** one serverless route, several "tasks." Client POSTs `{ task, input, ctx }`.
The server verifies the user's auth token, looks up the task in a registry, builds a system
prompt, calls the model, returns text + usage. No SDKs, no dependencies — just `fetch`. Auth
on the route matters: it protects your model spend from anyone who finds the URL.

**The three tasks (and their trading-journal analogues):**

- **Extract structured items from a dump** — DayOS turns a voice/text dump into time-block
  proposals. Trading: turn a "here's how the session went" dump into individual trade entries
  or a structured review.
- **Organize / tighten rambly text** — clean up Thoughts/Reflection into tight bullets while
  *preserving every idea and every `#hashtag` verbatim*. Cut words, not content. Trading: tidy
  up trade rationales and post-session reflections.
- **Extract actionable tasks** — pull a checklist out of a brain-dump, filtering out rumination.
  Trading: pull "rules to follow tomorrow" / action items out of a review.

**The non-negotiable rule across all of them: AI proposes, human commits.** Nothing auto-saves.
Every proposal shows as a card/pill the founder accepts (✓), edits (✎), or rejects (✕) before it
persists. The founder flagged the data-integrity risk of auto-accept early — don't add a
"high-confidence auto-save" shortcut.

**Tuning:** when output is "too verbose / too terse / missing X," **change the prompt only** —
don't swap models or bolt on post-processing. Structure prompts as positive rules + explicit
do/don't lists + worked examples; the model responds well to anti-examples. Test by re-running
the same input. Use a capable model for judgment-heavy tasks (structured extraction, nuanced
filtering); a cheaper one is fine only where the task is mechanical. Always use the latest
Claude models, and keep a hard spend cap on the account.

---

## If/when you add cross-device sync (Firestore lessons)

DayOS is single-user, multi-device (phone + laptop). These bit us in order, every one a real
data-loss bug — not theory:

- **Tombstones on every deletable collection.** Without them, a loader that runs before a delete
  has propagated will silently resurrect deleted items.
- **A `_synced` dirty flag on every write.** Mark dirty on local save; flip to true only after
  cloud confirms. On conflict, dirty-local wins; synced items defer to cloud. Skipping this lets
  a stale loader overwrite a fresh edit.
- **Static checks passing ≠ sync works.** A missing import once silently aborted the merge while
  the UI cheerfully showed "synced ✓." Read the console; verify by *reload* and by the *other
  device*, not by refreshing the same tab.
- **Reload-stale and cross-device-stale are different bugs** (loader bug vs per-write-sync bug).
  Don't conflate them.
- A public Firebase API key in client code is **not** a leak — it's a public identifier; real
  protection is in Security Rules. Check before panicking about "exposed keys."

(If Trade Genie ever goes multi-user, last-write-wins is almost never right and Security Rules
become critical — ask for the fuller multi-user notes then.)

---

## Pre-ship checklist

- [ ] Tested on the phone, not just the laptop
- [ ] Reopened the modal / reloaded a fresh tab — no leftover state leaking between sessions
- [ ] No "while I'm here" cleanups bundled into the change
- [ ] Things that were broken before are still broken the *same* way (no surprise side-effects)
- [ ] A hard refresh actually loads the new version (cache-busting is real on PWAs)
- [ ] One change; if it grew to touch 4+ surfaces, it should have been split

---

*Distilled from DayOS. Hand it to the agent at the start of a Trade Genie session so it inherits
the taste and the scar tissue instead of rediscovering both.*
