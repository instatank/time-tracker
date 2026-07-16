# Second-brain integration — the Firestore data contract

DayOS is a **memory bank** for the founder's personal AI agent (the Telegram
bot in `instatank/instatank42`). The agent's sync job (`dayos_sync.py` over
there) reads this app's Firestore data with a **read-only service account**
and mirrors it into plain markdown on the agent's server. Full architecture:
`instatank42/docs/SECOND_BRAIN.md`.

This doc is the **contract**: what the consumer reads and which invariants it
relies on. **If a schema change touches anything below, update this doc in the
same commit** — it's part of the sync checklist in `playbook/SOP-firebase-sync.md`.

*How the consumer organizes this data* (tag views, open-loops ledger,
metrics table, AI syntheses) is planned in
`instatank42/docs/DAYOS_ORGANIZATION.md` — deliberately built entirely from
the fields already listed below, so it adds **no** new requirements on this
app. Nothing in that plan changes this contract.

## How the consumer connects

- Auth: Firebase **service-account** JWT → Firestore REST API — the exact
  pattern `api/cron-reminders.mjs` already uses. No client SDK, no rules
  involvement (service accounts bypass security rules by design).
- Access is **read-only by code**: the agent has no write path to Firestore.
  It never creates, edits, or deletes DayOS documents.
- Frequency: recent-window pull every ~2h + one full re-pull daily. Read
  volume is far under the Firestore free tier.
- The uid is auto-discovered via a collection-group query on `devices`
  (fallback `blocks`) — fine while the project has one user.

## Collections the consumer reads (all under `users/{uid}/` unless noted)

| Collection | Doc id | Fields relied on |
|---|---|---|
| `blocks` | random | `date` (YYYY-MM-DD), `start_time` (HH:MM), `duration_min`, `category`, `label`, `note`, `energy_level`, `projectTag`, `tags[]`, `voiceNotes[]`, `deletedAt?` |
| `captures` | random | `timestamp` (IST ISO), `type` (`note`/`daily`/`project` + legacy), `body`, `project_tag`, `tags[]`, `voiceNotes[]`, `attachments[]`, `deletedAt?` |
| `dailyJournal` | `YYYY-MM-DD` | `date`, `thoughts`, `reflection`, `tasks[{text, completed}]`, `entertainmentCap`, `tags[]`, `voiceNotes[]`, `attachments[]`, `deletedAt?` |
| `sessions` | random | `projectName`, `date`, `before`, `during`, `after`, `durationMin`, `done[]`, `pending[]`, `learned[]`, `tags[]`, `deletedAt?` |
| `learning` | random | `sourceName`, `sourceType`, `takeaway`, `fullNotes`, `tags[]`, `date`, `createdAt`, `deletedAt?` |
| `ratings` | `YYYY-MM-DD` | `rating` (1–5) |
| `life_ratings` | `YYYY-MM-DD` | `{metricId: 1–5}` (labels from `meta/lifecheck`) |
| `eod` | `YYYY-MM-DD` | `text` |
| `dfts` | `YYYY-MM-DD` | `text`, `status` (`pending`/`done`/`skipped`) |
| `weeklyReviews` | week-start date (**Sunday**) | all fields rendered generically; `aiSummary` rendered as prose |
| `monthlyReviews` | `YYYY-MM` | same as weekly |
| `meta` | fixed ids | `projects.list[]` (canonical project names), `lifecheck.metrics[{id,label}]`; others ignored today |
| `projectRefs/{uid}/{slug}` (top-level) | `{sourceType}_{sourceId}` | currently NOT consumed (entries are matched by tags directly); listed for completeness |

Not read at all: `devices` (except uid discovery), `dismissals`,
`meta/tag_history`, `meta/adherence`, `meta/dayscore`, `meta/defaultBlocks*`.

## Invariants the consumer depends on

1. **Soft delete = `deletedAt` (ISO string) on the doc** — consumer hides
   those everywhere, same as the UI. Hard-deletes just disappear; the daily
   full re-pull converges on them.
2. **All dates/times are IST strings** — `date` = `YYYY-MM-DD`, `timestamp` =
   IST ISO. String comparison is date comparison (this is what makes cheap
   incremental pulls possible: range filters on `date`/`timestamp`).
3. **Tags are stored lowercased WITH the leading `#`** (e.g. `"#win"`), and a
   tag matching a project slug links the entry to that project.
4. **Weeks start on Sunday** (`getWeekStart`) — weekly rollups and
   `weeklyReviews` keys both use the Sunday date.
5. **Voice notes / attachments live as embedded arrays on the parent doc**,
   with their own `deletedAt`. The consumer reads only titles/filenames
   (searchable pointers) — never the Storage binaries.
6. **Block categories** come from `CATS` (`deep_work`, `learning`, `practice`,
   `routine`, `leisure`, `leaks`) + legacy `sleep`. Sleep is excluded from
   waking-hour totals. New categories degrade gracefully (rendered by id) but
   deserve a heads-up in this doc anyway.

Renames of any field above are **address changes, not label changes**
(playbook L5) — they break the consumer silently. Additive fields are always
safe: unknown fields are ignored, and review docs render generically.

## What this means when changing DayOS

- Adding a **new collection** the agent should know about → add it to the
  table above + tell the agent repo (its `dayos_sync.py` lists collections
  explicitly).
- Renaming/removing a **field in the table** → coordinate both repos in the
  same change window; the agent fails soft (missing data in digests) rather
  than loudly, which is exactly why this doc exists.
- Changing **soft-delete, tag format, timezone, or week-start semantics** →
  that's a breaking change to invariants 1–4; don't do it casually.
