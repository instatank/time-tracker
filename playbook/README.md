# The Playbook — system map

**One paragraph:** This folder is the single source of truth for how Ankit's stack gets built — across DayOS (time-tracker), Cadence, BillOS, PartySpark, TradeGenie, Penalty-Shootout, Showcase, and every future project. It replaced three per-repo duplicates that rotted (`DayOS_cheatsheet.md`, Cadence's `working-with-claude.md`, DayOS's `sync-lessons.md` — all now stubs pointing here). Every doc here is **dual-audience**: an EXECUTE layer (mechanical steps for a Claude session) and an UNDERSTAND layer (why, for Ankit) in the same file, so they can't drift apart.

## Files

| File | What it is | Who reads it |
|---|---|---|
| `PLAYBOOK.md` | Global working rules + the consolidated transferable lessons | Both — every session, every repo |
| `SOP-ship.md` | The pre-push ship ritual (version bump + gates) | Both |
| `SOP-firebase-sync.md` | The rules for any code that writes synced data | Both |
| `SOP-deploy.md` | Every deploy surface per repo + platform gotchas | Both |
| `SOP-verify-on-phone.md` | The verification ladder; "done" requires a phone checklist | Both |
| `LEARNING_METHOD.md` | The Friction Ledger — how Ankit learns through building | **Ankit only** |
| `README.md` | This map + machine internals | Claude sessions |

## How sessions load this (machine internals)

- **If `/home/user/time-tracker` is cloned in the session:** read files directly from `time-tracker/playbook/`.
- **If not:** fetch via the GitHub tools — `get_file_contents` on `instatank/time-tracker`, path `playbook/<file>.md` (default branch `main`). All seven repos' CLAUDE.md files carry this pointer.
- **Per-repo machinery** (installed in each repo, thin and repo-specific only — no duplicated prose):
  - `.claude/skills/ship/SKILL.md` — that repo's ship ritual config (which file, which version key, which gate commands). The generic logic lives in `SOP-ship.md`; the skill holds only repo facts.
  - `.claude/skills/wrap/SKILL.md` — the session-wrap ritual (update handoff doc, append `LEARNINGS.md` friction cards, ask Ankit the two learning questions, quiz one old card).
  - `.claude/hooks/wrap-reminder.sh` + a `Stop` hook in `.claude/settings.json` — nudges the session (once per repo per day, max) to run `/wrap` if commits shipped but no wrap happened. The tooling triggers the ritual; nobody's memory does.
  - `LEARNINGS.md` — that repo's friction-card ledger, appended by `/wrap`, promoted weekly into `PLAYBOOK.md` (see `LEARNING_METHOD.md`).

## Updating the playbook

New lessons enter via a repo's `LEARNINGS.md` (captured by `/wrap` at session end), and get **promoted** here during the weekly synthesis (see `LEARNING_METHOD.md`). When promoting: dedupe against existing lessons — most "new" lessons are instances of an existing concept; extend that entry rather than adding a twin. Never fork a copy of any file here into another repo; update the pointer targets instead.
