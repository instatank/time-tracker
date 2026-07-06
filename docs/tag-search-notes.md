# Tag/Search evaluation — running notes

Working notes for the tagging/indexing/search test-and-improve project (started 2026-07-06).
One lesson per entry. Kept in the repo working tree; **not committed** until execution phases
are approved (every commit auto-ships to production via the claude/* → main auto-merge).

## Status

- **Phase B shipped** (2026-07-06, SW v135). B1: `#tag` queries now do exact tag
  matching (aligns search with filter pills — `#win` no longer surfaces `#winner`).
  B2: multi-word queries are order-independent AND (`meal launch` finds `launch … meal`).
  B3: removed the dead inline search-narrowing in `renderToday`/`renderJournal` that
  duplicated (and diverged from) the unified searcher. Verified: 19/19 browser assertions
  pass against the modified app. Phase A (tag-tokenizer fixes) intentionally skipped per
  founder — the split is minor and A was fix-forward-only anyway, so B stands alone.
- **Phase C shipped** (2026-07-06). Card tag pills are now tappable (`renderTagPills` →
  `tagPillTap`): tapping any `#tag` routes through the unified global search as an exact-tag
  query (so it agrees with the Journal filter pills — `#win` ≠ `#winner`), `stopPropagation`
  keeps the parent card's expand/edit tap from also firing. A removable **active-filter chip**
  (`activeTagFilterChipHtml`, prepended in `renderSearchResults`) sits atop the results,
  coloured to match the tag; one tap clears the filter via `closeGlobalSearch()`. Verified:
  9/9 browser assertions pass against the modified app (Playwright, Firebase-stubbed, SW-blocked).
- **Test harness still not committed to `tests/`.** The Phase C sim lives in the session
  scratchpad (`verify-phasec.mjs`); like the Phase B harness it needs a Playwright-gated runner
  (browser + module present only in this env) before `tests/*.mjs` can host it without breaking
  `scripts/check.sh` on a fresh machine. Documented pattern in the "Testing setup" lesson below.

## Lessons

- **Two tag tokenizers disagree.** Inline typing goes through `extractTags` (regex, ASCII-only,
  hyphen breaks the match) while the picker's custom input goes through `normalizeTag` (strips
  invalid chars). Typing `#side-project` stores `#side`; picking "side-project" stores
  `#sideproject`. Any fix must change BOTH functions together or the split persists.
  Verified by unit test on the extracted real functions.

- **Search and tag filters give different answers for the same tag.** Filter pills use exact
  membership (`tags.includes('#win')`); global search uses substring (`'#win'` also matches
  `#winner`). Verified in headless-browser test T3/T6.

- **Soft-deleted entries stay in project Related lists.** `getRelatedCapturesFor` (index.html
  ~8061) never filters `notTrashed`, so a trashed capture shows under its project for up to
  7 days. Verified in browser test T8 by soft-deleting a fixture capture through the real
  two-tap `deleteCapture` path.

- **Performance is a non-issue at personal scale — don't over-engineer.** Measured on the real
  app with 5,000 seeded captures: 12–16 ms per search keystroke, 8 ms journal render. A linear
  scan is the right architecture here; no inverted index needed.

- **renderJournal contains a second, dead search implementation.** It filters captures/dailies
  by query (~7151–7206) and then unconditionally short-circuits to `renderSearchResults()`
  (~7277) which redoes the search differently. Wasted work + divergence hazard.

- **Testing setup that works in this sandbox:** CDNs are unreachable, so Playwright must stub
  the five Firebase modules via `page.route`; service workers MUST be blocked
  (`newContext({ serviceWorkers: 'block' })`) because SW-originated fetches bypass route
  interception and hang the load. Chromium needs `--no-sandbox` here. `addInitScript` re-runs
  on every reload — seed localStorage only when a key is absent, or mid-test writes get wiped.
  Harness lives in the session scratchpad (`tagsearch/`), reusable pattern for future sims in
  `tests/`.

## Confirmed-good (don't "fix")

- Trash exclusion works in global search and journal filters (T3b, T6d).
- Search coverage is genuinely cross-collection: session text, learning takeaways,
  daily-journal task texts all match (T4a–c); voice-note titles + attachment titles are in
  the haystack by code read.
- Case-insensitive matching works both directions (T2b).
- `anchoredPreview` HTML-escapes properly — no injection via entry bodies (unit test).
- Tag save paths recompute `tags[]` on every edit (captures 12650–12670, blocks 11916,
  sessions 8558, learning 9186) — no stale-tag-after-edit bug found in code read.
