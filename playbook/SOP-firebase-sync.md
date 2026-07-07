# SOP — Firebase sync contract

**Fires:** whenever code adds a new synced collection/field, or touches any write path in a Firebase-backed app (DayOS, BillOS, Cadence; the pattern applies to any future Firestore app).
**Failure it prevents:** silent cross-device data loss, and frozen UI on stalled writes. This is the most expensive bug class in your history: "we added tombstones for blocks, captures, sessions, learning, AND meta/projects — each one bit us in turn" (DayOS), and the optimistic-write hang bit BillOS twice with a third latent instance found by inspection.
**Supersedes:** `time-tracker/docs/sync-lessons.md` (now a stub pointing here).

---

## EXECUTE

### A. New synced collection or field — the six wiring sites (all of them, no exceptions)

1. **Per-write sync function** — writes the doc to Firestore after local save (e.g. `syncBlockDoc`).
2. **`initialSync` merge** — the sign-in merge must include the collection (local + remote merged, then written back).
3. **Force-push path** (`forcePushToCloud` or repo equivalent) includes it.
4. **Force-pull path** (`forcePullFromCloud` or repo equivalent) includes it.
5. **Tombstones** for hard deletes — a delete without a tombstone resurrects on the next device sync.
6. **`_synced` dirty flag** (or repo equivalent) so offline writes retry.

Repo variants: Cadence — anything mutating user state must be added to the `setDoc` call in `saveState()`, and every schema migration bumps `_meta.version` + changelog + the seeder gate in `index.html` **together**. BillOS — bill-doc fields ride `attachments[]`-style embedded arrays; see `SYNC.md` for the cross-user gate.

**DayOS only — a 7th site:** the personal AI agent reads DayOS's Firestore as a second-brain memory bank (read-only service account). Its data contract lives in `docs/second-brain-integration.md` — if the schema change touches a collection, field, or invariant listed there, **update that doc in the same commit** (and flag the agent repo if a collection was added/renamed). Field renames are address changes (L5): they break the consumer silently.

### B. Any write that a UI waits on

Apply Playbook L1: issue the write, update the UI immediately, `.catch` → toast. Never gate a modal close or spinner on `await setDoc/updateDoc` under offline persistence. Exception: true transactions (BillOS Mark Paid) stay awaited.

### C. The test gate (before claiming sync works)

1. **DevTools console open for all of it** — permission-denied and swallowed `ReferenceError`s are invisible from the UI.
2. **Reload test:** write → reload the page → data present? *Stale after reload = `initialSync` bug.*
3. **Cross-device test:** write on device A → appears on device B? *Stale across devices = per-write bug.* These are different bugs — do not conflate them.
4. **Delete test:** delete on A → stays deleted on B after B syncs (tombstone check).
5. **Offline test:** write in airplane mode → comes back online → syncs (`_synced` retry check).
6. Expect 5–10 reproducer-driven iterations before sync feels solid. Budget for it; don't declare victory at 2.

### D. Rules deploys

Firestore/Storage rules are a separate deploy surface — see `SOP-deploy.md`. A `permission-denied` in the console usually means rules weren't deployed, not that the code is wrong.

## UNDERSTAND

**The core concept — distributed truth:** once data lives in more than one place (your phone, your laptop, Firestore), "saved" stops being one fact and becomes an agreement that six different code paths have to keep. Each wiring site above is one clause of that agreement; miss any clause and the failure is *silent* — nothing errors, data just quietly diverges until you notice a note missing weeks later. That's why this is a contract, not a checklist you can partially apply.

**Why the reload/cross-device distinction matters to you personally:** it turns "sync is broken" (undebugable feeling) into a one-question diagnosis you can run yourself: *where is it stale?* After reload → the sign-in merge path. Across devices → the per-write path. You've conflated these before and the doc that untangled it called them "different bugs" for a reason — knowing which one you're looking at halves the search space before a session even starts.

**Why optimistic writes (L1) lives here too:** the same offline-persistence machinery that makes sync resilient makes `await` on writes dishonest — the local cache has already committed; the promise is waiting for a server that might be unreachable. Trust the local truth, verify the server truth in the background, shout only on genuine failure. That's also, not coincidentally, how good teams operate.
