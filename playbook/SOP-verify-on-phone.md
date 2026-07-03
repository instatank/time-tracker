# SOP — Verify on phone ("don't trust agent self-report")

**Fires:** before any user-facing work is declared done, in every repo.
**Failure it prevents:** shipping features that pass every automated check and break on the real device. Proof it's needed: three Penalty-Shootout polish features passed headless tests and were disabled after one real playtest; multiple DayOS bugs "passed static checks and broke at runtime"; Cadence's SOP made this its #1 rule.

---

## EXECUTE

1. **Climb the verification ladder as far as the change allows — and say plainly which rung you reached:**
   - Rung 1 — *static:* syntax check / typecheck / build. (Proves the code parses. Nothing more.)
   - Rung 2 — *runtime:* actually exercise the changed flow — run the app, drive the feature, watch the console. For sync code: DevTools open, reload test AND cross-device test (they catch different bugs — Playbook L2).
   - Rung 3 — *device:* Ankit, on the iPhone, on the deployed URL. **This rung belongs to Ankit and cannot be claimed by a session.**
2. **Every handoff of user-facing work ends with a numbered phone checklist**, formatted so it can be executed in under 2 minutes:
   - Preamble: which URL/branch, and "pull-to-refresh once to bust the SW cache" where applicable.
   - 3–7 numbered steps, each a single tap/observation: "Tap X → you should see Y."
   - Each step names the failure it's probing ("if the sheet doesn't close, the optimistic-write fix didn't take").
   - Include one *negative* check where relevant (airplane mode / offline behaviour) for sync-touching changes.
3. **Never claim rung 3.** Statuses are: "verified at runtime, awaiting phone check" or "static only — untested at runtime (reason)." The words "works" or "done" without a rung attached are banned.
4. **Rejection rule (for Ankit):** work handed off without a checklist gets sent back. No exceptions — the checklist is the deliverable's receipt.

## UNDERSTAND

**Why agents overclaim:** "The agent's confidence is a function of static checks, not user experience" — your line, and it's structural, not a character flaw: a session literally cannot feel a janky animation, a keyboard covering a field, or a gesture that fights the iOS home-bar. Its checks see code; your phone sees the product. So the honest contract is: sessions climb rungs 1–2 and *say which rung they reached*; you own rung 3.

**Why the checklist beats "go test it":** an unstructured "check the app" produces an unfocused poke-around that misses the regression. A numbered checklist is the session converting its private knowledge — *what could this change have broken?* — into something you can execute without reading code. That conversion is the point: it's the same skill as a chef tasting the dish before it leaves the kitchen, except here the chef writes down exactly which bites to take.

**The EV framing:** a checklist costs the session 2 minutes to write and you 2 minutes to run. A false "done" costs a production bug found by you days later, plus a session of archaeology. This is the cheapest insurance in the whole playbook, which is why it's a hard gate and not a suggestion.
