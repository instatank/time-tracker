# Sensitive-data audit — DayOS

**Date:** 2026-08-15 · **Against:** commit `f0755bf` · **Scope:** DayOS app, repo,
and serverless functions. The second brain (VPS mirror + `instatank/2ndbrain`
backup repo) is deliberately **out of scope here** — it's Phase 4.

Background: the 2026-07-16 incident (see `LEARNINGS.md`) — GitHub push protection
caught personal access tokens inside the second brain's first backup. They were
deleted at source. Push protection only recognises *shaped* secrets (`ghp_…`,
`AKIA…`); a free-text password has no shape and would not have been caught.
**Nothing in DayOS has ever scanned for either.** The current status of the data
is therefore *unverified*, not *clean*.

---

## The copy graph

One sentence typed into DayOS lands in up to seven places. This is why "delete
the note" is never the whole fix.

| # | Where | What lives there | Reach |
|---|---|---|---|
| 1 | Device | `localStorage`, plain text, on every signed-in device | On device |
| 2 | Firestore | `users/{uid}/…` + `projectRefs/{uid}/…` (an 80-char `preview` — a second copy of the first line) | Cloud |
| 3 | Firebase Storage | Voice notes + attachments. A *spoken* password is as exposed as a typed one and no text scanner finds it | Cloud |
| 4 | Trash | Soft-deleted entries stay live in Firestore for `TRASH_TTL_MS` (7 days) with `deletedAt` set | Cloud |
| 5 | Anthropic API | `organize` / `extract-tasks` / `extract-blocks` / `summarize-review` send up to 6,000 chars of raw entry text | Leaves you |
| 6 | Second-brain VPS | Pulls Firestore every ~2h, writes plain markdown to disk | Leaves you |
| 7 | `2ndbrain` git repo | Nightly backup. Git keeps history — a committed secret survives history even after the file is cleaned | Leaves you |

Cleaning DayOS does **not** reach back and clean hops 6 and 7.

---

## Verified clean (7)

1. **No secrets in code or history.** Working tree + all 386 commits across all
   branches scanned for Anthropic / GitHub / AWS / Slack keys, PATs, JWTs and
   private-key blocks. Nothing. The `AIzaSy…` string in `index.html` is the
   Firebase **Web API key** — a public app identifier, not a credential; it is
   meant to ship in the page.
2. **Server secrets are in env vars.** `ANTHROPIC_API_KEY`,
   `FIREBASE_SERVICE_ACCOUNT`, `CRON_SECRET` read from Vercel's environment;
   never hardcoded, never echoed in a response or error.
3. **AI proxy authenticates properly.** `api/ai/claude.mjs` verifies the Firebase
   ID token's RSA signature, `iss`, `aud`, `exp` and `iat` before spending the
   Claude key. Not an open endpoint.
4. **Storage rules are correct and versioned.** `storage.rules` scopes read /
   write / delete to `users/{uid}/**` with a 50 MB cap, and lives in the repo.
   This is the pattern the Firestore rules are missing.
5. **Push notifications leak nothing.** The 23:30 IST reminder body is fixed text
   (`"Anything to capture before tomorrow?"`). No entry content on the lock screen.
6. **Service worker caches no data.** `sw.js` does no fetch interception and wipes
   all caches on activate. No stale offline copy of the journal.
7. **Delete-forever deletes the media.** `hardDelete*` paths call `deleteObject`
   on the Storage blob (`deleteVoiceBlob` / `deleteAttachmentBlob`), so the file
   and its download link genuinely die.

---

## Gaps

### Serious

**S1 — Nothing anywhere looks for secrets.**
No detection at input, at save, before AI send, or at rest. This is the exact
hole the July incident fell through and it is still open. Today there is no way
to answer "is there a password in my journal?" short of reading every entry.
→ Phases 1 + 3.

**S2 — `firestore.rules` is not in the repo.**
`firebase.json` declares Storage rules only. The rules preventing another
signed-in Google account from reading `users/{yourUid}/…` exist *only* in the
Firebase Console: unreviewable, unbacked-up, not redeployable from code, and a
console mis-edit would be silent. Sign-in is open to any Google account, so
those rules are the only thing standing between a stranger's session and the
data. → Phase 4 (but verify the live rules in the console **today**).

### Weaknesses

**W1 — Storage download URLs are permanent public links.**
`getDownloadURL` returns `…?alt=media&token=…`. Anyone with that URL reads the
file with no sign-in, forever; Storage rules do not apply to it. These URLs are
stored *inside Firestore documents*, so they travel wherever the data travels
(VPS mirror, backup repo). Mitigation: prefer `getBlob`, or rotate tokens.
Confirm in Phase 4 whether the mirror writes these URLs out.

**W2 — Soft delete ≠ deleted.** Tapping × leaves the entry fully readable in
Firestore for 7 days, while the second brain pulls every 2h. For a secret, the
default path is the wrong one. → Phase 2 adds purge-now.

**W3 — AI proxy has no allowlist or rate limit.** It accepts any valid token
from the Firebase project, and sign-in is open to all Google accounts. A stranger
who signs in can spend the Anthropic key. Not a data leak (uid-isolated) — a
bill. Fix: one-line uid allowlist + per-user daily cap. → Phase 4.

**W4 — No CSP; Chart.js loads from a CDN with no integrity hash.** A compromised
CDN could read every entry in memory and in `localStorage` and exfiltrate it.
Low likelihood, total impact. Fix: SRI hash or self-host, plus a CSP. → Phase 4.

---

## Can't be checked from code — console tasks

- **Live Firestore rules.** Confirm `users/{uid}` *and* `projectRefs/{uid}` both
  require `request.auth.uid == uid`, and no test-mode `allow … if request.time <`
  rule survives.
- **Firebase Web API key restrictions.** Google Cloud Console → Credentials.
  Should be limited to the app's domains.
- **Who else has signed in.** Authentication → Users. Decide whether to restrict
  sign-in to one address.
- **Anthropic retention terms** for the raw journal text the AI features send.

---

## Detector tuning doctrine — founder ruling, 2026-08-16

**Every phase below inherits this.** Precision is set per *surface*, by whether a
false alarm interrupts him or waits for him — not once, globally, for the whole
project.

| Surface | Interrupts? | Tune for |
|---|---|---|
| CI gitleaks (blocks a merge) | Blocks work | **Near-zero false alarms.** Second layer — push protection already has the shaped secrets, so its real job is the worded rules. A blocked merge he doesn't believe just teaches him to bypass the gate, and then it catches nothing. |
| In-app save-time warning + pre-AI-send check (Phase 3) | Mid-sentence | **Strictest precision of all.** "Wrong twice and I'll dismiss it reflexively forever, including the time it's right." |
| In-app Security Check sweep (Phase 1) | Never — read-only, batch-reviewed | **Be sensitive.** "A false positive costs me one glance, a miss costs a leaked credential." |

*Numbering note:* he referred to the sweep as "Phase 4" and the save-time /
pre-AI-send check as "Phase 6". This doc's plan has four phases, where the sweep
is **Phase 1** and the save-time + pre-AI-send checks are **Phase 3**; the table
uses this doc's numbers. If a separate six-phase plan exists elsewhere, reconcile
the two before building — the surfaces are what matter, not the labels.

**Keep the two categories tuned separately — never average them.**

- **Shaped** secrets (`ghp_`, `AKIA`, `sk-ant-`) are precise by nature. Treat a
  hit as a *finding* and act on it.
- **Worded** secrets are inherently fuzzy. Tuning these to zero false positives
  deletes the category — and the category is the only reason a detector exists
  here at all beyond what push protection already does. Surface worded hits as
  **"worth a look"**, not as alarms.

*Engineering note on the seam:* a blocking CI gate has no "worth a look" tier —
gitleaks fails the job on any rule that fires, so in CI both categories currently
carry alarm weight, which is why the shipped worded rules are tuned tight. The
two-tier split becomes real in the Phase 1 sweep, where a read-only batch view
can rank findings instead of blocking. Build the tiering there, not in CI.

---

## Plan

**Phase 1 — Find out (read-only, changes nothing).**
Settings → Security check. Sweeps every collection — blocks, captures, daily
journals, sessions, learning, EOD, DFTs, weekly/monthly reviews, *plus* trashed
items, voice-note titles and attachment filenames — for:
- *shaped* secrets: Anthropic / GitHub / AWS / Google / Slack keys, JWTs,
  private-key blocks, high-entropy strings;
- *worded* secrets: "password is", "pin", "otp", "cvv", "seed phrase",
  "recovery code", "api key", with the surrounding line.

Each hit shows entry + date + masked match, tap to open. Runs entirely in the
browser on data already on the device. Nothing sent, nothing modified.

**Phase 2 — Clean up.** Per-finding **Redact** (replace the matched span, keep
the entry) or **Delete forever** (skip Trash — hard delete + tombstone + cloud
verify). Plus **Empty trash now**. Plus a rotate-these list, because redacting
here does not reach the VPS or the backup repo's history.

**Phase 3 — Prevent.** Same detector at save time → a sheet offering *Redact it*
/ *Save anyway* (never blocks). Warn before flagged text is sent to Claude.
Scheduled quiet re-scan so drift is caught in days.

**Phase 4 — Structural.** `firestore.rules` into the repo + `firebase.json`;
uid allowlist + daily cap on the AI proxy; SRI/self-host Chart.js + CSP; move
attachments off permanent token URLs. Then, separately, the second brain.

---

## Shipped — repo-side guardrail (2026-08-16)

Ahead of the phases above, the *repository* side is now closed. This covers the
laptop → public repo → Vercel path only; it does nothing about what is already
inside Firestore, which is still what Phases 1–4 are for.

- `.gitignore` covers env files, service-account JSON, `*.pem` / `*.key` /
  `*.p12`, firebase artifacts and OS noise. `.claude/settings.local.json` is
  untracked — it was machine-specific and carried local filesystem paths.
- `.github/workflows/ci.yml` runs `scripts/check.sh` on every push and PR.
- `.github/workflows/secret-scan.yml` runs gitleaks on the pushed commit range,
  with `--redact` so a caught secret is never reprinted into this public repo's
  Actions logs.
- Both routes into `main` — the PR path and the direct `claude/**` sync — wait
  for those two checks before merging.
- `.gitleaks.toml` extends the stock ruleset with the **worded** secrets push
  protection structurally cannot see, since it only matches shaped tokens.
  Tuned to sit quiet on prose: the separator must follow the keyword
  immediately, and the value must carry a digit. An all-letters phrase written
  out in prose is still missed — closing that would mean flagging ordinary
  English, and a scanner that cries wolf is one you stop reading.

## Principle

From `LEARNINGS.md`, 2026-07-16: **"notes apps copy; vaults don't."** Everything
above is that sentence made structural — detection so you can see what got
copied, purging so deletion is real, and a nudge at the moment of typing, the
only point in the graph where a secret still lives in exactly one place.
