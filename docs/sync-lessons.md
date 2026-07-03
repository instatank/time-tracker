# Superseded — moved to the shared playbook

This doc's contents were consolidated on 2026-07-02 into the cross-project playbook, which is now the single source of truth (duplicates rot — this repo's handoff doc once drifted ~60 versions stale, so per-repo copies of shared lessons are deliberately gone):

- **`playbook/SOP-firebase-sync.md`** — the full sync contract: the six wiring sites, the optimistic-write pattern, the reload-vs-cross-device test gate, "static checks pass ≠ sync works".
- **`playbook/PLAYBOOK.md`** — lessons L1 (optimistic writes), L2 (sync completeness + tombstones + `_synced`), L3 (deterministic IDs).

If this repo isn't the one you're working in, fetch those files from `instatank/time-tracker` (path `playbook/`) via the GitHub tools. The pre-2026-07 content of this file is preserved in git history.
