# Sync lessons from DayOS

A paste-ready briefing for an agent building Firestore sync in another project. Distilled from ~10 commits of stabilization work on DayOS — most bugs were data-shape, not architecture.

DayOS is **single-user / multi-device** (one Firebase Auth user, phone + mac). Multi-user adds another layer on top of these lessons; both are covered below.

---

## Universal — every Firestore sync system

**1. Static checks pass ≠ sync works.** A missing import (`onSnapshot` in our case) silently aborted `initialSync` mid-function via a `ReferenceError` thrown BEFORE the merge ran. Watchdog flipped the indicator green at 12s. Nothing actually merged. Reading the browser console is a mandatory diagnostic input — never trust "JS OK + tests pass" as a sync verdict.

**2. Every collection where users can delete needs tombstones.** Without them, the "remote first, then local extras" merge silently resurrects deletions whenever the loader runs before the user's `setDoc` has propagated. We added tombstones for blocks, captures, sessions, learning, AND the `meta/projects` list-doc. Each one bit us in turn.

**3. `_synced=false` flag pattern is non-negotiable.** Mark items dirty on local save; flip to `true` only after cloud verify. Loader's merge respects this: dirty-local wins (re-pushed), synced items defer to cloud on conflict. Without this, a stale-loader-after-edit race silently overwrites recent edits.

**4. Don't let cleanup writes overwrite meta state.** We had a sign-in cleanup batch re-pushing `meta/projects` and `meta/tag_history` from local. If the loader for projects hadn't completed yet, the batch pushed stale state to cloud and clobbered fresh edits from the other device. Per-write sync paths are sufficient — don't add cleanup batches that re-push things already pushed at write time.

**5. Background loaders need a second render after settle.** Critical-path read flips "synced ✓" fast for UX. Background loaders complete later. Fire `Promise.allSettled().then(() => render())` after the fast path — otherwise the page shows stale globals on whichever tab the loader's data feeds.

**6. Watchdogs hide bugs, they don't fix them.** A 12s "if still 'syncing', flip to 'ok'" timeout is a fine UX safety net, but if it's firing routinely, *that* is the bug. We had multiple cycles of "looks synced, isn't" because the watchdog masked the real cause.

**7. Verify by reload, then by cross-device.** If reload shows stale data, the bug is in `initialSync`. If cross-device shows stale data, the bug is in the per-write sync path. They're different bugs and need different fixes — don't conflate them.

---

## Multi-user-specific (what DayOS didn't deal with)

**8. `onSnapshot` is mandatory, not optional.** Reload-driven sync is OK for one user across devices. Multi-user requires live subscriptions on every collaboratively-edited collection — users will not refresh to see each other's edits, and "tab focus pull" feels broken at second-user latency.

**9. Last-write-wins is rarely the right merge.** Two people editing the same field 200ms apart will silently overwrite each other. For free-text fields: CRDTs (Yjs / Automerge) or field-level merge with conflict markers. For structured fields: Firestore transactions for serialised updates. Pick deliberately, don't default to "last write wins" because it's the easiest.

**10. Firestore Security Rules are now critical, not boilerplate.** Single-user is `request.auth.uid == userId`. Multi-user is document-membership (`request.auth.uid in resource.data.members`) or role-based. Silent permission-denied is the worst possible error class. Test rules in the Firebase emulator BEFORE writing client code that depends on them.

**11. Presence + edit indicators.** If two users can edit the same doc concurrently, surface it visually ("Alice is editing this"). Firestore has no native presence — you'll write heartbeats + TTL. Consider Realtime Database alongside Firestore just for presence (its `onDisconnect` handler is genuinely useful here).

**12. Conflict isn't only simultaneous edits.** "User A deleted X while User B was editing X" needs deliberate handling — tombstones interact with edit-in-progress UI, otherwise B silently loses their work. Decide the policy upfront ("delete wins" / "edit wins" / "B sees a 'just deleted' notice") and code for it.

**13. Audit trail from day one.** `lastModifiedBy: uid` field + an `events/` subcollection logging changes. Without this, "who changed X?" is impossible to debug. Cheap upfront, painful to retrofit.

**14. Cross-user verification is the real gate.** Two browser sessions, two different test users, scripted edits, assert convergence. Static tests cannot model this. Make this a hard gate before any "done" — same way DayOS now requires phone+mac verification.

---

## Bottom line for the agent on the other project

- Don't ship without tombstones on every deletable collection.
- Don't ship without `_synced` flag dirty-tracking on every write.
- Don't ship without `onSnapshot` for collaboratively-edited collections.
- Don't ship without Security Rules tested in the emulator.
- Don't conflate static-test-green with cross-user-correct.
- Expect 5–10 reproducer-driven iterations before sync feels solid.

---

*Captured from DayOS sync work, May 2026. Drop into a fresh agent's context at session start when building sync on a new project.*
