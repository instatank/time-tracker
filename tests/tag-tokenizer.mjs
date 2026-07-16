// Behavioural sim for the unified tag tokenizer (SW v137).
//
// Both tag-entry paths — inline #hashtags (extractTags) and the picker's
// custom input (normalizeTag) — must produce the SAME stored form, because
// tags are load-bearing for Journal filter pills, project linking, exact-tag
// search, AND the second-brain mirror's per-tag views. They historically
// diverged on hyphens/non-ASCII (docs/tag-search-notes.md). This sim extracts
// the REAL functions out of index.html (so it catches drift, not a copy) and
// asserts the two paths agree.
//
// Runs in scripts/check.sh with no browser/network. `node tests/tag-tokenizer.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function grab(name, sig) {
  const re = new RegExp('function ' + name + '\\(' + sig + '\\) \\{[\\s\\S]*?\\n\\}');
  const m = html.match(re);
  if (!m) throw new Error(`FAIL: could not extract ${name}() from index.html`);
  return m[0];
}

const src = [
  grab('canonicalTagBody', 'body'),
  grab('extractTags', 'text'),
  grab('normalizeTag', 'raw'),
  'return { canonicalTagBody, extractTags, normalizeTag };',
].join('\n');
// eslint-disable-next-line no-new-func
const { extractTags, normalizeTag } = new Function(src)();

let failed = 0;
const eq = (got, want, name) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { failed++; console.error(`FAIL ${name}: got ${g} want ${w}`); }
  else console.log(`ok   ${name}`);
};

// Inline path
eq(extractTags('a #win today'), ['#win'], 'inline plain');
eq(extractTags('did #side-project work'), ['#sideproject'], 'inline hyphen collapses');
eq(extractTags('#1% better every day'), ['#1%'], 'inline #1% special');
eq(extractTags('#Two Words here'), ['#twowords'], 'inline CapCase continuation');
eq(extractTags('#win, then #insight.'), ['#win', '#insight'], 'inline punctuation ends tag');
eq(extractTags('#win #win'), ['#win'], 'inline dedupe');
eq(extractTags('# nothing here'), [], 'inline bare hash ignored');

// Picker path
eq(normalizeTag('side-project'), '#sideproject', 'picker hyphen collapses');
eq(normalizeTag('#dft'), '#dft', 'picker keeps leading hash');
eq(normalizeTag('##win'), '#win', 'picker strips extra hashes');
eq(normalizeTag('deep_work'), '#deep_work', 'picker underscore kept');
eq(normalizeTag('   '), '', 'picker empty → empty');

// The invariant that matters: the two paths must AGREE.
for (const raw of ['side-project', 'deep-work-block', 'café', 'a-b-c']) {
  eq(extractTags('#' + raw)[0] || '', normalizeTag(raw), `paths agree on "${raw}"`);
}

if (failed) { console.error(`\n${failed} tag-tokenizer assertion(s) failed`); process.exit(1); }
console.log('\ntag-tokenizer: all assertions passed');
