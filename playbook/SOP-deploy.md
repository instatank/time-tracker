# SOP — Deploy surfaces per repo (+ Vercel/Firebase gotchas)

**Fires:** after any push (step 6 of `SOP-ship.md`), and whenever changing env vars, rules, crons, functions, or branch config.
**Failure it prevents:** "I pushed, so it's live" — false in every repo here. One BillOS change can require up to five separate surfaces. Missed surfaces cost you: a silently-rejected cron (half a day), `permission-denied` from undeployed Storage rules, a Vercel production branch that silently stayed on Preview.

---

## EXECUTE

### Deploy surface map

| Repo | App deploy | Rules | Functions/cron | Notes |
|---|---|---|---|---|
| time-tracker (DayOS) | push `claude/*` → Action auto-merges to `main` → Vercel | **Storage rules: `firebase deploy --only storage` — manual, Vercel never does it** | `api/cron-reminders.mjs` via `vercel.json` cron | Hobby plan = max **one cron/day**; sub-daily schedules are **silently rejected and block the deploy** |
| BillOS | push to production branch `claude/design-system` → Vercel (NOT `main`) | Firestore rules + indexes + functions: GitHub Action `firebase-deploy.yml`; **Storage rules: in the Action as of 2026-07 (was manual)** | Functions via the same Action; may fail on missing IAM roles — the Action log names them | If Vercel shows new commits as "Preview": disconnect + reconnect the git integration (it caches the production branch at connect time) |
| Cadence | push → Vercel | Firestore rules manual via `firebase deploy` | — | Schema migrations: bump `_meta.version` + seeder gate together |
| PartySpark | PR → protected `main` → Vercel prod; branch push → preview | — | Serverless `api/*` deploy with the app | Preview URLs have Deployment Protection (ignore the manifest 401) |
| TradeGenie | push `main` → Vercel prod (standing authorization; never push red) | Firestore via service account envs | — | |
| Penalty-Shootout | push → Vercel | — (Firebase only arrives at Milestone 8) | — | |

### Env-var change ritual (Vercel, any repo)

1. Dashboard → Settings → Environment Variables. 2. **Tick all three environments** (Production + Preview + Development) — preview deploys need them too. 3. **Redeploy without build cache** (Deployments → ⋯ → Redeploy → untick "Use existing Build Cache") — env changes don't take effect otherwise. 4. Server-side secrets never carry `VITE_`/`NEXT_PUBLIC_` prefixes (Playbook L7).

### External model/API inventory (check during weekly synthesis — Playbook L6)

| Where | Model/API | Watch for |
|---|---|---|
| PartySpark `api/_lib/handlers-custom.ts` | `claude-haiku-4-5` | Anthropic deprecation notices |
| PartySpark `api/_lib/handlers-gemini.ts` | `gemini-2.5-flash` | Google retirement schedule (2.0 already burned us) |
| PartySpark `api/_lib/handlers-image.ts` | `gemini-3-pro-image` (stable — bumped 2026-07-02 from preview) | billing balance: empty account 404s image gen |
| BillOS `api/extract.js` | `claude-sonnet-4-6` | Anthropic deprecations |
| DayOS `api/ai/claude.mjs` | (check current) | Anthropic deprecations |
| TradeGenie `lib/transcript-processor.ts` | `ANTHROPIC_MODEL` env (default `claude-sonnet-4-6`) | Anthropic deprecations |

**Rule: no `-preview`/`-beta`/`-exp` model id ever ships to production.**

## UNDERSTAND

**The core concept — one push is not one deploy:** your stack has several *control planes*: Vercel deploys the app, the Firebase CLI deploys security rules, GitHub Actions deploy functions, the Vercel dashboard owns env vars, and Google owns model lifetimes. A git push only moves the first one. Every "it should be live but isn't" incident in your history is one of the other planes not being told. The fix isn't memorizing five rituals — it's the habit of asking, after any push: *"which other control planes does this change touch?"* — and this table is the answer sheet.

**Why the gotchas are worth knowing cold:** each row above is a place where the platform fails *silently* (Rule 4's theme): the cron that's rejected without an error message, the branch config cached at connect time, the env var that doesn't apply until an uncached rebuild, the rules that were never deployed. Platforms optimize for not scaring you; your job is to know where they hide the truth. When something's not live, walk the table top to bottom — it's a 60-second diagnosis instead of a half-day one, and you've already paid the half-day once.
