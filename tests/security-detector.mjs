// Behavioural sim + corpus for the secret detector (docs/security-audit.md Phase 1).
//
// WHY THIS FILE EXISTS
// The detector's whole job is to answer "is there a credential sitting in my
// journal?" — a question nothing in DayOS could answer before. A detector with
// no corpus is a detector nobody can tune, so the corpus is the spec: ~30 true
// positives and ~40 true negatives drawn from the shapes DayOS data ACTUALLY
// takes (hashtags, uid() ids, Firestore doc ids, git SHAs, IST timestamps,
// pasted base64 image data, the public Firebase Web API key, and English
// sentences that merely MENTION a password).
//
// TUNING DOCTRINE (docs/security-audit.md → "Detector tuning doctrine"):
// this detector feeds the READ-ONLY, batch-reviewed Security Check sweep, so it
// is deliberately tuned for SENSITIVITY — a false positive costs one glance, a
// miss costs a leaked credential. That is the opposite of the CI gitleaks gate,
// which blocks a merge and is therefore tuned tight. Do not "fix" a noisy
// worded rule here by making it stricter without re-reading that section.
//
// Like tests/tag-tokenizer.mjs, this extracts the REAL source out of index.html
// (between the BEGIN/END sentinels) rather than testing a copy, so drift fails
// the gate. No browser, no network. `node tests/security-detector.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const START = '// ── BEGIN secret-detector ──';
const END   = '// ── END secret-detector ──';
const i0 = html.indexOf(START);
const i1 = html.indexOf(END);
if (i0 === -1 || i1 === -1 || i1 < i0) {
  throw new Error('FAIL: could not find the secret-detector sentinels in index.html');
}
const detectorSrc = html.slice(i0, i1);

const { scanText, maskSecret, shannonEntropy } = new Function(
  detectorSrc + '\nreturn { scanText, maskSecret, shannonEntropy };'
)();

let failed = 0;
const pass = (name) => console.log(`ok   ${name}`);
const fail = (name, detail) => { failed++; console.error(`FAIL ${name}: ${detail}`); };

// ── The Firebase Web API key that ships in index.html by design ───────────
// Public app identifier, not a credential (docs/security-audit.md, "Verified
// clean" #1). It must never be reported — not by the AIza rule, and not by the
// high-entropy rule either.
const FIREBASE_WEB_KEY = 'AIzaSy' + 'AxVCwVHFxRSHNXDhAoCGhj4Y1yfs6qUks';

// ── PEM block, split so this test file is not itself a gitleaks finding ───
const PEM = [
  '-----BEGIN RSA PRIVATE ' + 'KEY-----',
  'MIIEowIBAAKCAQEA3Tz2mr7SZiAMfQyuvBjM9OiJjRazXBZ1BjP5CE/Wm/Rr500P',
  'RK+Lh9x5eJPo5CAZ3/ANBE0sTK0ZsDGMak2m1g7oruI3dY3VHqIxFTz0Ta1d+NAj',
  '-----END RSA PRIVATE ' + 'KEY-----',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────
// TRUE POSITIVES — every one of these MUST produce at least one finding of
// the named kind. Values are fabricated / documentation samples, never real.
// ─────────────────────────────────────────────────────────────────────────
const TRUE_POSITIVES = [
  // — shaped —
  ['anthropic-key',     'proxy fallback key sk-ant-' + 'api03-AbCdEf1234567890AbCdEf1234567890AbCdEf1234567890-QwErTyAA saved here for now'],
  ['github-token',      'old PAT ghp_' + 'AbCdEf1234567890AbCdEf1234567890Ab from the backup incident'],
  ['github-token',      'oauth token gho_' + '1234567890AbCdEf1234567890AbCdEfGh'],
  ['github-token',      'ghs_' + 'ZzYyXx1234567890AbCdEf1234567890Ab (server-to-server)'],
  ['github-token',      'fine-grained github_pat_' + '11ABCDEFG0aBcDeFgHiJk_lMnOpQrStUvWxYz1234567890abcdefghij'],
  ['aws-access-key-id', 'AWS console login uses AKIA' + 'IOSFODNN7EXAMPLE'],
  ['aws-access-key-id', 'temp creds ASIA' + 'IOSFODNN7EXAMPLE from the sts call'],
  ['aws-secret-key',    'and the secret half wJalrXUtnFEMI/K7MDENG/' + 'bPxRfiCYEXAMPLEKEY'],
  ['google-api-key',    'maps key AIza' + 'SyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY for the side project'],
  ['slack-token',       'bot token xoxb-' + '123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'],
  ['slack-token',       'user token xoxp-' + '987654321098-9876543210987-ZyXwVuTsRqPoNmLkJiHgFeDc'],
  ['jwt',               'session eyJ' + 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'],
  ['private-key',       'deploy key pasted below\n' + PEM],
  ['private-key',       'partial paste\n-----BEGIN OPENSSH PRIVATE ' + 'KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAAB'],
  ['stripe-live-key',   'billing sk_live_' + '51H8xKfL2eZvKYlo2C0abcdefghij do not lose this'],
  ['high-entropy',      'db password blob Xq7Pv2Lm9Rt4Ws8Zn1Kd6Yb3Hc5Jf0Ga'],
  ['high-entropy',      'token from the dashboard: f4Kd9Lq2Xr7Bn3Vt8Mw1Zc6Ph5Js0Yg'],

  // — worded —
  ['password',       'the wifi password is Tr0ub4dor&3 for the flat'],
  ['password',       'password was changed to hunter2guess last week'],
  ['password',       'router admin password: n3wp4ss99'],
  ['passwd',         'passwd correcthorse9 on the old laptop'],
  ['pwd',            'pwd: b4tteryStaple'],
  ['pin',            'atm pin is 4417, do not forget again'],
  ['otp',            'otp 883921 from the bank, expires in 10 min'],
  ['cvv',            'card ending 4412, cvv 421'],
  ['seed-phrase',    'seed phrase: witch collapse practice feed shame open despair creek'],
  ['recovery-code',  'recovery code 8H2K-9QLM saved from the account page'],
  ['backup-code',    'backup codes from google: 11223344 55667788'],
  ['api-key',        'need to rotate the api key for the weather service'],
  ['secret',         'the cron secret is s3cr3t-value-here'],
  ['2fa-code',       '2fa code 449281 texted at 9pm'],
  ['account-number', 'account number 0021 4455 7788 for the transfer'],
  ['aadhaar',        'aadhaar 4321 8765 0912 needed for the KYC form'],
  ['pan-number',     'pan number ABCDE1234F for the tax filing'],
];

// ─────────────────────────────────────────────────────────────────────────
// TRUE NEGATIVES — real DayOS content shapes that must produce ZERO findings.
// These are the reason the sweep stays readable; every one of them would
// otherwise show up on the founder's screen on every scan, forever.
// ─────────────────────────────────────────────────────────────────────────
const TRUE_NEGATIVES = [
  // hashtags + ordinary journal prose
  '#deepwork #win morning block on the detector, felt sharp',
  '#1% better today — shipped the tag tokenizer fix',
  '#sideproject session: rewrote the sync checklist',
  'Deep work 09:00-11:30 on the security sweep',
  'Read 40 pages of Deep Work — takeaway: attention is a muscle',
  'Rated the day 4 stars, energy was high after the walk',

  // sentences that MENTION a password but contain none
  'need to reset my password tomorrow',
  'changed my password today, felt overdue',
  'forgot the password again, third time this month',
  'the password reset flow is broken on mobile',
  'a password manager is worth setting up properly',
  'talked to R about password hygiene for the team',
  'the secret sauce is just showing up every day',
  'talked about api security with the group',

  // near-miss keywords that must not trip the worded rules
  'spinning up a new project this week',
  'pinned the note to the top of the journal',
  'the output was clean on the first run',
  'pan fried rice for lunch, quick and good',
  'panic about the deadline, then it passed',
  'bank account balance check done for the month',
  '#recovery day, legs still sore from Tuesday',
  'backup ran fine last night, no errors',
  'my CV was updated with the new project',

  // ids, hashes, paths, timestamps
  'firestore doc id Kx8mQ2vB7nL4pR9tW3yZ for that capture',
  'local id m3k9x2p1a4b7c written by uid()',
  'device id 9f2c1e64-3b7a-4d58-9e01-6c8d5a4b2f13',
  'fixed in da960543f2b1c7e8a9d0b4c6e5f7a8b9c0d1e2f3',
  'short sha a3d16bf on main',
  'block id default-morning-routine-2026-08-17 created by the auto-creator',
  'path users/abc123/blocks/m3k9x2p1a4b7c in firestore',
  'timestamp 2026-08-17T10:30:00.000+05:30 IST',
  'entry dated 2026-08-17, logged at 22:14',
  'storage key dayos_blocks_v1 and dayos_weekly_reviews_v1',

  // URLs, files, contact details
  'deployed to https://time-tracker-7a7l.vercel.app after the merge',
  'chart lib https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'mailed ankitanand25@gmail.com the summary',
  'attachment screenshot-2026-08-17-at-10.30.15.png added to the note',
  'voice note titled Morning dump 2026-08-17',

  // shaped-lookalikes that are not secrets
  'we call the proxy with sk-ant keys held in Vercel env',
  'version string abc.def.ghi in the changelog',
  'supercalifragilisticexpialidocious was the word of the day',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1 placeholder row in the sheet',

  // the public Firebase Web API key — by design, in the page already.
  // Both the AIza rule AND the high-entropy rule must stay silent on it.
  FIREBASE_WEB_KEY,
  'firebase web config ships ' + FIREBASE_WEB_KEY + ' in the page, public by design',

  // pasted base64 image data (attachments paste this shape constantly)
  'pasted a screenshot: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj',

  // empty / trivial
  '',
  '   ',
  'ok',
];

// ── Run the corpus ───────────────────────────────────────────────────────
for (const [kind, text] of TRUE_POSITIVES) {
  const hits = scanText(text);
  const got = hits.map(h => h.kind);
  if (got.includes(kind)) pass(`TP ${kind}`);
  else fail(`TP ${kind}`, `expected a "${kind}" finding, got [${got.join(', ') || 'none'}]`);
}

for (const text of TRUE_NEGATIVES) {
  const hits = scanText(text);
  const label = `TN ${JSON.stringify(text.slice(0, 46))}`;
  if (hits.length === 0) pass(label);
  else fail(label, `expected no findings, got ${JSON.stringify(hits.map(h => `${h.kind}:${h.masked}`))}`);
}

console.log(`\n— corpus: ${TRUE_POSITIVES.length} true positives, ${TRUE_NEGATIVES.length} true negatives —\n`);

// ── Invariants that matter more than any single corpus row ───────────────

// 1. The raw secret must NEVER appear in a finding's `masked` field, and never
//    in the `line` field for a SHAPED finding (the line is masked in place).
//    Worded findings deliberately carry the whole raw line — that wording IS
//    the evidence, and it never leaves the device.
{
  const raw = 'ghp_' + 'AbCdEf1234567890AbCdEf1234567890Ab';
  const hits = scanText('token ' + raw + ' pasted from the terminal');
  const h = hits.find(x => x.kind === 'github-token');
  if (!h) fail('mask/github-token', 'no finding');
  else if (h.masked.includes(raw)) fail('mask/masked-field', 'masked field contained the raw secret');
  else if (h.line.includes(raw)) fail('mask/line-field', 'line field contained the raw shaped secret');
  else pass('mask: shaped secret absent from masked AND line');
}

// 2. Masking shows first 4 + last 2 characters only.
{
  const s = 'ABCDEFGHIJKLMNOP';
  const m = maskSecret(s);
  if (!m.startsWith('ABCD')) fail('mask/first4', `got ${m}`);
  else if (!m.endsWith('OP')) fail('mask/last2', `got ${m}`);
  else if (m.includes('EFGHIJKLMN')) fail('mask/middle', `middle not hidden: ${m}`);
  else pass('mask: first 4 + last 2 only');
}

// 3. Short strings reveal nothing at all — 4+2 would be the whole string.
{
  const m = maskSecret('abc123');
  if (/[a-z0-9]/i.test(m)) fail('mask/short', `short value leaked: ${m}`);
  else pass('mask: <=6 chars fully hidden');
}

// 4. Findings carry usable offsets and a category.
{
  const text = 'line one\nthe wifi password is Tr0ub4dor&3\nline three';
  const h = scanText(text).find(x => x.kind === 'password');
  if (!h) fail('shape/offsets', 'no password finding');
  else if (h.category !== 'worded') fail('shape/category', `got ${h.category}`);
  else if (text.slice(h.start, h.end).length === 0) fail('shape/span', 'empty span');
  else if (h.line !== 'the wifi password is Tr0ub4dor&3') fail('shape/line', `got ${JSON.stringify(h.line)}`);
  else pass('shape: {kind, category, masked, line, start, end} on the right line');
}

// 5. Categories are exactly the two the doctrine tunes separately.
{
  const hits = scanText('ghp_' + 'AbCdEf1234567890AbCdEf1234567890Ab and the pin is 4417');
  const cats = [...new Set(hits.map(h => h.category))].sort();
  if (JSON.stringify(cats) !== JSON.stringify(['shaped', 'worded'])) {
    fail('categories', `got ${JSON.stringify(cats)}`);
  } else pass('categories: shaped + worded, tuned separately');
}

// 6. A shaped secret is reported ONCE, not once per overlapping rule
//    (the high-entropy rule overlaps almost every other shaped rule).
{
  const hits = scanText('key AIza' + 'SyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY here');
  if (hits.length !== 1) fail('dedupe', `expected 1 finding, got ${hits.length}: ${hits.map(h => h.kind)}`);
  else pass('dedupe: overlapping shaped rules collapse to one finding');
}

// 7. Non-string / null input is safe — the sweep walks user data of every shape.
{
  const bad = [null, undefined, 42, {}, [], true];
  const ok = bad.every(v => Array.isArray(scanText(v)) && scanText(v).length === 0);
  if (!ok) fail('input/robust', 'non-string input did not return []');
  else pass('input: null/undefined/non-string return []');
}

// 8. Entropy helper behaves (guards the high-entropy rule's threshold).
{
  if (!(shannonEntropy('aaaaaaaaaaaaaaaa') < 1)) fail('entropy/low', 'repeated char scored high');
  else if (!(shannonEntropy('Xq7Pv2Lm9Rt4Ws8Zn1Kd6Yb3Hc5Jf0Ga') > 4)) fail('entropy/high', 'random string scored low');
  else pass('entropy: low for repeats, high for random');
}

// 9. Multiple distinct secrets in one entry are all reported.
{
  const hits = scanText(
    'ghp_' + 'AbCdEf1234567890AbCdEf1234567890Ab\n' +
    'AKIA' + 'IOSFODNN7EXAMPLE\n' +
    'the wifi password is Tr0ub4dor&3'
  );
  const kinds = new Set(hits.map(h => h.kind));
  if (kinds.size !== 3) fail('multi', `expected 3 kinds, got ${[...kinds].join(', ')}`);
  else pass('multi: three secrets in one entry all reported');
}

// 10. Findings come back in document order, so the UI can trust the ordering.
{
  const hits = scanText('otp 112233 then later the pin is 4417 and cvv 421');
  const sorted = hits.every((h, i) => i === 0 || hits[i - 1].start <= h.start);
  if (!sorted) fail('order', 'findings not in document order');
  else pass('order: findings sorted by position');
}

if (failed) { console.error(`\n${failed} security-detector assertion(s) failed`); process.exit(1); }
console.log('\nsecurity-detector: all assertions passed');
