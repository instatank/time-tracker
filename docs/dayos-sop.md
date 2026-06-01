# DayOS — what I learned building it

A 1-page note to my future self. No jargon. What I'd tell myself starting the next project.

---

## What this was
A personal time + journaling app I use every day. Single web file, runs in a browser, syncs between my phone and Mac. Built with Claude over several sessions.

---

## The 6 things I'd tell myself on day one

**1. The phone is the source of truth.**
"It works on my Mac" means nothing. Most of my hardest bugs only showed up on iPhone — the keyboard pushed things around, inputs got too tall, buttons disappeared. Test on the device I actually use, first. Same for sync — refreshing the same tab tells me nothing; I have to check the OTHER device.

**2. Small changes, one at a time.**
Every time Claude bundled "while we're here, also fix X" into a feature, something broke. Two bugs in one commit = double the time to figure out which is which. Make one thing different, look at it, then make the next thing different.

**3. Ship the ugly version first.**
I kept trying to design things in my head before seeing them on screen. Wrong move. The right move was: tell Claude the rough idea, ship it, open it on my phone, then say "make this smaller, move that left." 80% of my decisions only made sense AFTER I could see the first cut live.

**4. Describe symptoms, not causes.**
When I said "I think this is the iOS zoom thing causing it," I led Claude in a direction. Sometimes wrong. The fastest debugging happened when I just said "the box gets taller when I tap the search" and let Claude diagnose. Don't lead the witness.

**5. Push back the moment Claude misreads me.**
Twice this session, Claude solved the wrong problem because it heard me differently than I meant. Both times I said "no, I meant THIS" and we moved on in 30 seconds. If I'd let it slide, we'd have built the wrong thing.

**6. "Done" means tested on the actual flow.**
Code compiling ≠ feature working. The "I picked it up on the couch and tried it" test is the real test.

---

## Working with Claude — what stuck

- **Ask plain-English questions when unsure.** "Is this necessary?" saved me from publishing security rules I didn't actually need.
- **Pause for clarifications when scope balloons.** When voice notes needed to land on 5 surfaces, Claude asked "one at a time, or all at once?" That pause prevented an hour of wasted work.
- **Trade-offs are MY decisions, not Claude's.** Claude can list 3 options + their costs. I pick. Every time I caught myself thinking "just pick whatever's best," I was outsourcing something I should own.
- **The session-opening context line matters.** "Read these three files first" turned chaotic resumes into clean ones. Without it, Claude rediscovers everything badly.

---

## My pre-ship checklist

Before I say "done," I confirm:
- [ ] Tested on my phone (not the laptop)
- [ ] Tested on a second device — OR closed and reopened in a fresh tab
- [ ] State doesn't leak between sessions (close the modal, reopen — still right?)
- [ ] No "while I'm here" cleanups bundled in
- [ ] Things that were broken before are still broken the same way (no surprise side-effects)
- [ ] Hard refresh forces the new version to actually load (cache busting is real)

---

## What surprised me

- **Most "bugs" were tiny.** Forgot a cache bump. Forgot to reset a variable between modal openings. Missed a single CSS rule. The big architecture stuff was rarely the problem.
- **Iteration speed beats planning.** I wanted to design the perfect DFT box up front. We redesigned it 5 times in 30 minutes once I just looked at it on my phone after each change. Way faster.
- **What looks like a security hole often isn't.** The Firebase API key in the code looked alarming. Not actually a problem — it's a public identifier, the real protection is elsewhere. Always check before panicking.
- **Removing a feature is harder than adding one.** Killing auto-sleep meant 3 separate decisions: stop creating new ones, what about existing data, what about today's already-created ones. "Just remove it" became a 3-question conversation.
- **Voice notes (the basic version) was a day, not a week.** I expected more complexity. A simple record-and-attach approach got me 99% of what I wanted.

---

## Starter rules for my next project

1. Start with the smallest version that's actually useful. Not the elegant one. The crude one.
2. Get it onto my phone within day one. Even if it looks bad.
3. Then USE it. Not "test it." Find what's annoying. Fix that next.
4. Tiny commits. If a single change touches more than 2-3 surfaces, split it.
5. Write down the surprises as they happen. Future me will hit them again.
6. Don't outsource design decisions to Claude. Outsource the *implementation*, keep the *taste*.

---

*This is what I'd hand a friend before they started building something like this.*
