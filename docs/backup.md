# Backup — the offsite copy, and the restore

Shipped 2026-09-05. Code: `api/backup.mjs` (server), the **Settings → Backup**
block in `index.html` (client), `tests/backup.mjs` + `tests/backup-restore.mjs`.

Before this, DayOS had **no backup at all** and no way to get data back in. The
journal existed in exactly two places — this device's `localStorage` and one
Firestore database behind one Google account — and every copy was live: delete
something and it was deleted everywhere, 7-day Trash aside. There was no
export, so there was also nothing to restore from.

## The shape of it

**Unattended half.** A Vercel cron hits `/api/backup` daily at 20:00 UTC
(01:30 IST — after the day is written up). It reads the whole journal out of
Firestore and commits it as one JSON file into a **separate, private GitHub
repository**. Nothing is committed on a day the journal did not change.

**Recovery half.** Settings → Backup restores from a backup file. It **never
deletes**, and by default only writes entries that are **missing**.

## Why GitHub, having measured first

A block is a few hundred bytes; a capture a couple of KB. A year of daily
journaling is single-digit megabytes and stays that way. At that size every
"real" backup product solves a problem this app does not have, and the four
things that do matter are: it costs nothing, it is somewhere else entirely from
Firebase and Vercel, it keeps every past version with no retention policy to
maintain, and the founder can recover it **from a browser** — which is his only
interface. Git history gives all four for free. A commit a day of a file this
size is noise on any storage measure.

That measurement is also what killed incremental backups, compression and
retention pruning before any of them were written.

## Why it reads Firestore, not the device

DayOS's order of truth is module vars → `localStorage` → Firestore mirror. The
mirror is the only copy that is cross-device, always current, and reachable
without anyone opening the app — which is the entire point of an *unattended*
backup. Reading the device would mean the backup only happens when the founder
remembers to visit a screen, and that is the failure this removes.

## Why it discovers collections instead of listing them

CLAUDE.md's new-collection checklist already has six items, and "silent
cross-device data loss" is what happens when one is missed. A hardcoded
collection list here would have been a seventh — and the one whose failure you
only discover on the day you need it. `/api/backup` therefore walks whatever is
actually in Firestore (`listCollectionIds` on `users/{uid}`, then every
document in each). A collection added next year is in the backup the day it
ships, with nobody having to remember this file exists.

`devices` is the one deliberate exclusion: push tokens regenerate on every app
load, are per-device state nobody would want restored, and are the only
collection whose contents are credentials.

**The one place a list still exists** is `BACKUP_COLLECTIONS` in `index.html`,
because the client cannot ask Firestore what collections exist
(`listCollectionIds` is admin-only). That asymmetry is the drift risk, and it
is handled by *showing* it rather than hoping: the Backup panel compares the
collections in the live backup against the keys it knows and names any it does
not, and a restore writes unknown collections to Firestore anyway rather than
dropping them.

## The guards

A backup system's own worst failure is quietly destroying what it protects —
overwriting a good copy with an empty or truncated one. Each of these refuses
the run and leaves the previous backup untouched:

1. **Public repo.** Re-checked on **every** run, not once at setup: a repo can
   be flipped public later, and a personal journal in a public repo is worse
   than having no backup at all.
2. **Bad read.** If the Firestore walk errored, found no user, or returned zero
   records, the run refuses. A snapshot assembled from a failed read looks
   exactly like a snapshot of a deleted journal.
3. **Shrink.** If the journal holds less than half what the last backup held,
   the run refuses. `?force=1` pushes a deliberate deletion through; the
   scheduled run can never force.
4. **Unchanged.** Keyed on a hash of the **data**, not the record counts —
   editing a note changes no count and must still be captured — and not of the
   file, whose `exportedAt` would make every single day look like a change.

## The database holds more than one account

The walk covers the whole database, so the backup contains **every account that
has ever signed into this app** — not just the founder's. The first live run
found two: the real journal (2,058 records across 13 collections) and a second
uid holding 16 blocks. That is expected rather than alarming: the app is
publicly reachable and Firebase Auth lets any Google account sign in and create
its own data under its own uid, which the Firestore rules scope correctly.

It did produce a real bug on day one. The Settings panel took
`Object.values(users)[0]` — whichever account Firestore listed first — so a
complete 2,074-record backup reported **"Contents: blocks 16"**. Nothing was
wrong with the backup; the panel was reading a stranger's row and presenting it
as the founder's journal, which is worse than showing nothing, because it would
have him believe 16 blocks was everything he had.

Fixed to key off the signed-in uid, and it does **not** fall back to `[0]` when
that uid is absent — that would reintroduce the same bug wearing a different
hat. It says "not found in the backup" instead. The other account is now named
on screen with its record count rather than silently folded in, because "someone
else has signed into my app" is something you want to be told. Pinned by four
assertions in `tests/backup-restore.mjs`, confirmed able to fail by putting the
`[0]` back.

## What is NOT backed up, and this is said on screen too

**Voice-note audio and attached image/files.** Those bytes live in Firebase
Storage, which is the same failure domain this backup exists to escape. What
the backup does carry is a **manifest**: every voice note and attachment by
filename, title, size, date and the entry it belonged to. After a total loss
you would know exactly what existed — you would not have the audio.

This was a deliberate stopping point, not an oversight — but **one half of the
reasoning turned out to be wrong, and the measurement says so.** The argument
was "binaries in git is the known-bad pattern, and a year of audio would outgrow
the repo." The first real backup measured the actual media: **8 items, 1.8 MB
total.** At that size the repo argument does not hold at all; only the
binaries-in-git preference does, and that alone is not enough to leave
irreplaceable audio unprotected.

So this should be revisited, and the number is now shown on the panel rather
than left as an assumption. The manifest was built so that adding a byte mirror
is a small change. Also excluded: `dayos_experiments_v1` (Optional features),
which is local-only by design and never reaches Firestore.

## Auth — two callers, two credentials, no open path

- The **scheduler** holds `CRON_SECRET`; Vercel injects it on the scheduled
  invocation.
- The **founder**, in a browser, holds a Firebase ID token — verified by
  `verifyFirebaseToken` imported from `api/ai/claude.mjs`. **One token verifier
  in this codebase, not two:** a second copy would be the two-tokenizer mistake
  in new clothes, and the copy nobody tests is the one that drifts.

An earlier draft left `?status=1` unauthenticated on the grounds that record
counts are only metadata. True, and still the wrong call — the verifier already
existed and cost nothing to reuse.

An unrecognised query parameter is a **400**, not a fall-through: the
fall-through case is a typo like `?staus=1` quietly running a full backup when
the caller asked to read a number.

## Verification, honestly

`tests/backup.mjs` (73 assertions) drives the **whole run** — OAuth, the
Firestore walk, every guard, the git data API commit sequence, and all six auth
outcomes including a forged ID token — against a fake Google and a fake GitHub.
`tests/backup-restore.mjs` extracts the real `BACKUP_COLLECTIONS` out of
`index.html`, seeds a fully populated device, exports, wipes, restores, and
demands every field back. That guard was confirmed able to fail: breaking one
`fromDocs` turns it red.

**What none of that can cover** is whether Google and GitHub behave the way
this code believes they do — the real service account, the real token and the
real private repo only exist in the deployment. That is what the **"Back up now
/ check it works"** button is for. Same answer as TradeGenie's "Test AI
connection": when a claim needs real credentials, ship the check.

## Setup (browser steps — one time)

1. **github.com → New repository.** Name it `dayos-backups`. Set it to
   **Private**. Do not add a README. Create.
2. **github.com → Settings (your profile, top-right) → Developer settings →
   Personal access tokens → Fine-grained tokens → Generate new token.**
   - Repository access: **Only select repositories** → `dayos-backups`.
   - Permissions → Repository permissions → **Contents: Read and write**.
   - Generate, and copy the token.
3. **vercel.com → the `dayos` project → Settings → Environment Variables.** Add
   two, for Production:
   - `BACKUP_GITHUB_REPO` = `instatank/dayos-backups` (owner **and** repo — just
     `dayos-backups` is the one mistake with no error message, so the panel
     calls it out separately)
   - `BACKUP_GITHUB_TOKEN` = the token from step 2
4. Redeploy (Vercel → Deployments → the latest → Redeploy), so the new
   variables are picked up.
5. In DayOS: **Settings → Backup → "Back up now / check it works."** It should
   say "Backed up N records". The panel then shows the repo, the record counts
   and how long ago the last backup ran.

`CRON_SECRET` and `FIREBASE_SERVICE_ACCOUNT` are already set — the reminder
cron and the AI proxy use them.

## Restoring

1. Open the backup repo on GitHub, open `dayos-backup.json`, download it.
2. DayOS → **Settings → Backup → Choose a backup file…** → pick it.
3. Read the preview (how many records, from when), then **Restore**.
4. Leave "overwrite entries that already exist" **off** unless you specifically
   want to roll entries back to the backup's version and discard later edits.

**One wrinkle the restore screen calls out.** The `meta` collection is
configuration — project list, tag history, Day Score tiles, check-in metrics,
daily defaults — and those documents *always exist*, holding defaults even on a
fresh install. So "only put back what is missing" correctly finds nothing
missing and leaves them alone. Bringing your own settings back needs the
overwrite tick. Entries (blocks, captures, journals, sessions, learning) are
unaffected and restore normally.

`HOW-TO-RESTORE.md` is written into the backup repo on every run, so these
instructions exist beside the data even if this codebase does not.

## Deliberately not done

- **A second backup destination.** One that works beats two half-configured.
- **Encrypting the file.** It would make the "open it in a browser and read it"
  recovery path impossible, and the repo is private.
- **Pruning history.** Git already stores this at a size that will never matter.
- **Auto-restoring an empty database.** A blank journal is not always a
  disaster, and an app that refills itself unasked is a worse problem than one
  that waits.
- **Backing up Storage bytes.** The manifest is the honest half-measure and is
  labelled as one everywhere it appears — but see above: the sizing argument
  against it did not survive contact with the real data (1.8 MB), so this is a
  live candidate rather than a settled no.
