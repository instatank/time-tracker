# Tag/Search evaluation — running notes

Working notes for the tagging/indexing/search test-and-improve project (started 2026-07-06).
One lesson per entry. Kept in the repo working tree; **not committed** until execution phases
are approved (every commit auto-ships to production via the claude/* → main auto-merge).

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
