# The Friction Ledger — how you learn through building

**This doc is for you alone.** Claude sessions read it only to know what questions to ask you at wrap time. It designs how you grasp, retain, and grow — in minutes per session, hooked into the tooling so nothing depends on your memory. The end state it builds toward: you predicting failures before a session hits them, and needing the checklists less, not more.

## The core idea

You don't learn from sessions. You learn from **frictions** — the moments something broke, hung, duplicated, or silently lied. Your history proves it: every rule you actually *know* (bundled fixes break things, the phone is the truth, compiles ≠ works) came from a specific painful incident, not from reading. So the method's unit is one friction → one **concept card**, and everything else is machinery to make cards stick and transfer.

**One concept per friction, not per session.** A session with three frictions yields up to three cards; a smooth session yields zero, and zero is a valid answer — padding kills the signal.

## The concept card

Cards live in each repo's `LEARNINGS.md`, appended by `/wrap`. Format:

```
### [date] — [short name of what broke]
- What happened: one sentence, plain language.
- Concept: the transferable idea, named. (Usually an instance of a PLAYBOOK entry — link it.)
- In my words: ← YOUR one-sentence teach-back, recorded verbatim.
- Where else: ← YOUR answer to "where else in my stack could this same thing bite?"
- Quiz question: a prediction question a future wrap can ask you.
- Internalized: no | streak 1/2 | YES (date) — two correct answers on separate days retires it.
```

The two arrowed fields are the learning. If a session writes the whole card itself, it's documentation; if *you* fill those two lines, it's memory.

## The routine (all of it, and where the tooling drives it)

**1. Pre-build prediction — 1 sentence, before new work starts.** When you kick off a feature, say: *"my guess: the risk here is ___."* The session logs it and checks it at wrap. Right or wrong doesn't matter — the act of predicting is what converts you from passenger to pilot, and calibration comes free over time. (Sessions are instructed to invite this; skip it freely on trivial tasks.)

**2. Session wrap — 2–3 minutes, triggered by tooling, not memory.** The `/wrap` skill (backed by a Stop-hook nudge, so it fires even when everyone forgets) does the log-keeping itself — handoff doc, LEARNINGS append — and then asks **you** exactly three things:
   - **Teach-back:** "One sentence, your words: what's the concept behind today's friction?" (Fills *In my words*. If you can't say it, the session re-explains and you try again — that loop IS the learning.)
   - **Transfer:** "Where else in your stack could this same failure occur?" (Fills *Where else*. This question is the whole reason one project's pain protects the other six.)
   - **Quiz — one old card:** the session picks your oldest non-internalized card and asks its prediction question, e.g. *"You're adding a synced 'tags' field to Cadence. What breaks if you forget the seeder gate?"* Answer correctly → streak +1. Two correct on separate days → the card is marked internalized and retires from rotation. **This is the graduation mechanism: retired cards are things you no longer need the checklist for.**

**3. Weekly synthesis — ~10 minutes, one paste.** Once a week (pick a fixed slot — end of your Friday session works), paste this into any session:

> *Weekly synthesis: read every repo's LEARNINGS.md for entries since [date]. For each: tell me which existing PLAYBOOK concept it's an instance of, or make the case it's genuinely new. Promote accordingly (extend the existing entry or add a new card), dedupe, and show me the diff. Then: glance at the model inventory in SOP-deploy.md for anything nearing retirement. End with the one question you'd quiz me on from this week.*

   You read the diff and answer one question. That's the whole ritual. It keeps the playbook alive, catches the next model retirement, and gives you one more spaced repetition.

**4. Graduation to invariants — when a card bites twice.** A concept that appears in two frictions has proven docs aren't enough for it. At that point ask the session to move it *into the machinery*: a check in the ship gate, a throw in the code, a hook. (Playbook L11.) Your fluency ladder, explicitly: **felt it → can say it → can predict it → machine enforces it → I design for it up front.** The ledger tracks where each concept sits.

## Why this survives contact with a busy founder

- Nothing here is a separate habit: the wrap is hook-triggered, the questions come to you, the synthesis is one paste. Your total cost: ~3 min/session + 10 min/week.
- It gets *lighter* over time, not heavier: internalized cards retire; the quiz rotation shrinks as you grow. A method that accumulates obligations dies; this one is designed to empty itself.
- It matches how you already think: EV per question. Teach-back and transfer are the two highest-retention moves known (self-explanation + application), bought for two sentences.

## The self-test that matters

You've internalized a concept when you can **predict the failure before the session hits it** — the pre-build prediction starts matching reality. Watch for the first time you say "careful, this write path — how do we find out if it fails silently?" *before* Claude flags it. That's the metric. Not how many cards you have; how many you've retired.

---

## Worked example — a real lesson, end to end

This is the BillOS optimistic-write lesson, walked through the full method with your actual history, so you can see what each stage looks like:

**The friction (real, March–June 2026):** BillOS froze twice — a receipt stuck at "Uploading 100%", a bill stuck on "Saving…". Cause: with Firestore offline persistence, `await setDoc` waits for the *server's* acknowledgment, but the local cache had already saved; the UI was blocking on a promise that could stall forever.

**The card, as `/wrap` would have written it:**

```
### 2026-05-14 — Bill save hung on "Saving…"
- What happened: the save spinner waited for Firestore's server ack, which stalls
  offline — but the local cache had already saved the bill instantly.
- Concept: local truth vs server truth (PLAYBOOK L1) — never block UI on a server
  acknowledgment when the local write is already committed.
- In my words: "the app already saved it on my phone; waiting for the cloud to
  agree just freezes me for no benefit."          ← your teach-back
- Where else: "DayOS voice-note saves? Cadence finishing a workout?"  ← your transfer
- Quiz question: "You add a 'pause bill' button that awaits updateDoc before
  closing the sheet. What happens on a weak connection?"
- Internalized: no
```

**The quiz, at a later wrap:** *"You add a 'pause bill' button that awaits updateDoc before closing the sheet — what happens on a weak connection?"* Correct answer: *"the sheet hangs even though the pause already saved locally — issue the write, close immediately, toast only on real failure."* Streak 1. Correct again next week → retired.

**The payoff — already real, not hypothetical:** the concept *predicted* the third instance before it fired. BillOS's Pause/Cancel/Reactivate buttons still `await`ed their `updateDoc` — the diagnosis existed in your own handoff notes, found by asking "where else does this pattern exist?", which is exactly the transfer question above. It was fixed in this session (2026-07-02) before any user ever hit it. One friction, internalized, protected a code path you never had to debug.

**The graduation:** it bit twice, so it stopped being a note: it's now Playbook L1, wired into `SOP-firebase-sync.md`'s EXECUTE layer, checked whenever a session touches a write path. You'll know you've reached the top of the ladder the day you review a new feature plan and say, unprompted: "that spinner waits on the server, doesn't it?"
