# Attachments (Photos · Files · Screenshots · Voice) — Portable Implementation Guide

> **What this is.** A distilled, paste-ready guide to adding "attach a photo / file /
> screenshot / voice note to an entry" to another app, based on a working
> implementation. It captures the architecture, the reusable patterns, and — most
> importantly — the **non-obvious traps** (especially on iOS PWAs) that cost the most
> iterations. Hand this to an AI coding agent as context, or use it as a human spec.
>
> **How to use with an agent.** Paste this whole file in and say: *"Implement
> attachments for &lt;my app&gt; following this guide. My stack is &lt;X&gt;. Start by
> confirming the data model and the sync-merge gate (section 9) before writing UI."*
>
> **Stack assumptions.** The reference implementation uses **Firebase Storage +
> Firestore** in a no-build vanilla-JS PWA. Section 16 explains how to adapt the
> Firebase-specific parts to S3/Supabase/etc. The *principles* are stack-agnostic.

---

## 1. The one decision that makes everything else easy

**Model every attachment as one generic item with a `kind` discriminator, stored as an
array embedded on the parent record — not as its own collection/table.**

```
attachment = {
  id,            // uuid
  kind,          // 'image' | 'file' | 'voice'  (add more later)
  url,           // download URL
  storagePath,   // bucket path, for deletion: users/{uid}/attachments/{id}.{ext}
  title,         // editable; defaults to the original filename
  mime,          // e.g. application/pdf
  size,          // bytes
  ext,           // normalized lowercase extension
  createdAt,     // ISO timestamp
  deletedAt?,    // ISO — soft-delete tombstone (see §8)
  // voice-only extras: durationSec
}
```

Why this wins:
- **One pipeline for all modalities.** Upload, sync, soft-delete, trash, search, and
  rendering are written **once**. Adding "camera" or "drawing" later is a new capture
  button + a `kind` — not a new subsystem.
- **No new sync code per modality.** Because the array rides *inside* the parent record,
  every existing save/sync path carries it for free (see §9).
- **Don't over-split by kind.** Resist separate `photos[]`, `files[]`, `voiceNotes[]`
  arrays. We started that way (voice was built first as its own thing) and the
  per-modality duplication compounded fast. One `attachments[]` with `kind` is the move.

> If you already shipped voice notes as their own array, you can keep them and add a
> generic `attachments[]` alongside — don't risk migrating live user data. Just design
> the generic system so voice *could* fold in later.

---

## 2. The capture → store → render pipeline (mental model)

Every modality is the same three steps; only the **first** and **last** differ:

```
CAPTURE (varies)            STORE (identical)              RENDER (varies by kind)
─────────────────           ──────────────────            ───────────────────────
file picker / camera   ─┐
photo library          ─┤   compress? → upload blob  →    image → <img> thumbnail grid
clipboard paste        ─┼─→ → get {url, storagePath} →    file  → row (icon+name+size)
voice recorder         ─┘   → push onto attachments[]      voice → play/pause row
                            → persist parent (sync)
```

So when adding a modality, you only write a capture entry point and a render branch.
The middle never changes.

---

## 3. Upload (Firebase reference implementation)

Use **resumable** uploads with progress (files are far bigger than you expect; mobile
networks drop). Enforce a client-side **size cap** (we used 25 MB).

```js
const ATTACH_MAX_BYTES = 25 * 1024 * 1024;

// Generic — works for a File or a Blob.
function uploadBlobAttachment(blob, ext, mime, onProgress) {
  return new Promise((resolve, reject) => {
    const id = uid();
    const safeExt = (ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `users/${user.uid}/attachments/${id}.${safeExt}`;
    const ref = storageRef(storage, path);
    // IMPORTANT (iOS): store INLINE. Do NOT set Content-Disposition:attachment.
    // See §13 — attachment disposition makes iOS Safari show a blank page.
    const task = uploadBytesResumable(ref, blob, { contentType: mime || 'application/octet-stream' });
    task.on('state_changed',
      s => onProgress && s.totalBytes && onProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)),
      reject,
      async () => { try { resolve({ id, url: await getDownloadURL(task.snapshot.ref), storagePath: path, mime, size: blob.size, ext: safeExt }); } catch (e) { reject(e); } }
    );
  });
}
```

Show progress inline in the attachment list (a tiny bar in the row). One shared
"upload runner" keeps every modality consistent:

```js
async function runAttachUpload(ctx, blob, ext, mime, kind, title) {
  // 1. flag uploading + re-render (shows progress row)
  // 2. const item = { ...await uploadBlobAttachment(...), kind, title, createdAt: now() }
  // 3. push onto the active draft array (or, on a "new entry" surface, create the parent)
  // 4. persist/sync the parent; re-render
}
```

---

## 4. Image compression (do this — it's the difference between cheap and expensive)

Phone photos are 3–12 MB. Downscale + re-encode to JPEG **client-side before upload**.
This keeps storage/bandwidth small and keeps the parent record tiny (you store only the
URL). Honor EXIF orientation or portrait photos upload sideways.

```js
async function compressImage(file, maxDim = 1600, quality = 0.82) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } // EXIF
  catch { bmp = await createImageBitmap(file); }
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error('encode failed');
  return { blob, ext: 'jpg', mime: 'image/jpeg' };
}
```

Gotchas:
- **HEIC** (iPhone photos): `createImageBitmap` can't decode HEIC off-Safari → wrap in
  try/catch and **fall back to uploading the original** untouched.
- **Transparency / screenshots**: JPEG drops alpha (PNG screenshots get a black
  background on transparent areas). For a bills app this is usually fine; if not,
  keep PNGs as PNG when small.

---

## 5. Clipboard paste = the realistic "screenshot" feature

There is **no API for a web/PWA app to capture the device screen**. What users actually
want when they say "screenshot" is: take an OS screenshot, then **paste it** (⌘/Ctrl+V).
That's a one-listener feature and reuses the image pipeline:

```js
document.addEventListener('paste', (e) => {
  const ctx = activePasteCtx();           // which entry/surface is open? null = ignore
  if (!ctx) return;
  for (const it of (e.clipboardData?.items || [])) {
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      e.preventDefault();                  // only preventDefault for an image; text falls through
      processImageFile(ctx, it.getAsFile(), 'Pasted image');
      return;
    }
  }
});
```

Reality check: **great on desktop Chrome/Safari, spotty on mobile.** Don't over-invest in
mobile paste.

---

## 6. The "Add" menu UX (avoid toolbar sprawl)

Use a **single** "➕ Add" button per surface that opens a small action sheet listing every
modality (Voice · Take photo · Photo library · Attach file). Don't litter the UI with one
button per type — we did that first (separate "Add voice note" + "Add file" buttons) and
later collapsed them into one menu; the single menu is cleaner and grows for free.

**Critical implementation detail:** if your entry editor is itself a modal/sheet, the Add
menu must be a **standalone overlay, NOT another instance of your sheet component** — many
sheet systems close all other sheets when one opens, which would tear down the entry form
underneath. Make the menu its own fixed overlay with its own backdrop and a high z-index.

One hidden `<input type="file">` per capture mode, reconfigured per choice:
- Attach file: `<input type="file">`
- Photo library: `<input type="file" accept="image/*">`
- Take photo: `<input type="file" accept="image/*" capture="environment">`  ← native OS camera, **no custom camera UI needed**

---

## 7. Rendering: images as thumbnails, files as rows

Split `attachments[]` by kind at render time:
- **images** → a wrapped thumbnail grid (`<img loading="lazy">`, fixed square,
  `object-fit:cover`, a small ✕ in the corner). `loading="lazy"` matters if your app
  re-renders large DOM chunks.
- **files** → a row: type-icon (pick by mime/ext) + filename + size + ✕.
- **voice** → a row with play/pause and a live elapsed-time readout.

Tapping an image/file opens it (see the big §13 on *how* to open, which is the hard part).

---

## 8. Soft-delete + Trash + sweep (don't hard-delete on tap)

Tapping ✕ should **stamp `deletedAt`**, not remove. Filter soft-deleted items out of every
render with a helper (`live(arr) = arr.filter(a => !a.deletedAt)`), list them in a
**Trash** screen with restore / delete-forever, and run a **sweep on startup** that
hard-deletes anything older than a TTL (we used 7 days). Hard-delete is: remove from the
array → delete the storage blob → persist parent.

This is cheap to add if you build it in from the start and miserable to retrofit.

---

## 9. ⚠️ The sync gate — verify this BEFORE writing any UI

The whole "no new sync code" win depends on **one assumption**: that your save/sync/merge
paths serialize the **whole record**, so a new `attachments[]` field rides along
automatically.

**Before building, audit every path that writes or merges the parent record:**
per-write save, initial sign-in merge, manual push, manual pull, offline reconciliation.
Confirm each does a whole-object write/merge (e.g. `setDoc(ref, record)` and
`map[id] = remoteRecord`) and does **not** enumerate a fixed list of fields. If any path
hand-picks fields, add `attachments` to it or it will **silently vanish across devices** —
the worst kind of bug because it looks fine on the device that created it.

This 10-minute check is the single highest-leverage step. Do it first.

---

## 10. Storage security rules (don't skip — bigger/arbitrary files raise the stakes)

Lock writes to the user's own folder and cap size server-side. Firebase example:

```
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read:   if request.auth != null && request.auth.uid == userId;
      allow write:  if request.auth != null && request.auth.uid == userId
                    && request.resource.size < 50 * 1024 * 1024;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Gotcha:** these rules are **not** deployed by your web host (Vercel/Netlify). Deploy
them separately (`firebase deploy --only storage`) or paste in the Firebase console. If
you forget, uploads to a new path silently fail with permission-denied.

---

## 11. 🍎 THE iOS OPENING SAGA — read this before you write "open attachment"

> This was ~80% of the total debugging time. Getting *upload* working is easy. Getting a
> tapped file to actually **open/preview** across desktop **and** an installed iOS PWA is
> the hard part. Here is the decision tree we converged on after many wrong turns.

### What does NOT work (and why)
- **`window.open(url)` / `<a target=_blank>` for non-image files** → on an installed iOS
  PWA this bounces you out to the **full Safari app**, and for files the browser can't
  render it lands on a **blank page** (often showing the raw storage URL — a useful
  diagnostic: *if you see the storage domain on a blank page, the app opened the URL
  directly instead of handling it*).
- **Forcing download via `<a download>` / hidden iframe on iOS** → iOS PWAs **cannot**
  download this way. Silently does nothing. (Works fine on desktop.)
- **`Content-Disposition: attachment`** → makes desktop download nicely, but makes **iOS
  Safari render a blank page**. So **store files INLINE** (just set `contentType`) and
  handle desktop download client-side instead. This conflict is the core tension.
- **PDF in an `<iframe>` on iOS** → iOS does **not** render PDFs inside iframes (blank).
  Only top-level navigation or a viewer renders them.
- **Embedded web viewers don't cover everything** → Google Docs Viewer / Microsoft Office
  viewer render PDF + MS Office, but **cannot** render **Apple iWork** (`.numbers`,
  `.pages`, `.key`). Those are previewable **only** by iOS Quick Look (i.e. a native open).

### What DOES work — the routing we shipped

```
on tap:
  if iOS (incl. installed PWA):
     image                          → in-app overlay with <img>
     pdf / doc/docx/xls/xlsx/ppt/pptx/txt/csv  → in-app overlay with an embedded
                                                  viewer iframe (Google/Microsoft)
     everything else (.numbers/.pages/.key, zip, unknown)
                                    → native open (lets iOS Quick Look preview it;
                                      this one does leave to Safari — unavoidable,
                                      because only the OS can read those types)
  else (desktop / Android):
     image / pdf  → open in a new tab (browser previews natively)
     other files  → download: fetch() the bytes → object URL → <a download> with the
                    real filename (works because it's same-origin blob)
```

Detect iOS robustly (iPadOS masquerades as Mac):
```js
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
```

### The in-app viewer overlay (keeps previews inside the PWA)
A fullscreen overlay (its own element, high z-index) with a title bar (✕ + an
"Open ↗" external fallback) and a body that is either `<img>` or
`<iframe src="https://docs.google.com/viewer?embedded=true&url=ENCODED">`. Always include
the "Open ↗" escape hatch — embedded viewers occasionally say "no preview." The embedded
viewer fetches your file server-side, so the URL must be publicly reachable (a tokenized
Firebase download URL is).

### Net rules of thumb
1. **Store inline**, never `Content-Disposition: attachment`.
2. **Branch on platform** (iOS vs desktop) *and* on **type**.
3. **iOS = preview, not download.** Desktop = download for non-previewable.
4. **iWork/unknown on iOS** can only go to native Quick Look. Accept the Safari handoff
   for those; you cannot embed them.
5. Always provide an **external "Open" fallback**.

---

## 12. 🍎 iOS PWA staleness — your fixes won't appear, and it's not your code

Installed iOS PWAs cache **aggressively**. You will deploy a fix, test on your iPhone, and
see **no change** — because it's serving an old build. This burned multiple cycles
("still broken!" when the fix was actually live). Mitigations:

- **No-cache headers** on the HTML shell and the service worker so the device always
  revalidates. On Vercel (`vercel.json`):
  ```json
  { "headers": [
    { "source": "/sw.js",     "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }] },
    { "source": "/",          "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }] },
    { "source": "/index.html","headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }] }
  ]}
  ```
- **Service worker** should `skipWaiting()` on install and, on activate, wipe old caches +
  `clients.claim()` + reload open windows.
- **Bump a visible version string** every ship so you can *confirm on-device* which build
  you're testing. Flying blind on "is this the new code?" wastes hours.
- **Force-update ritual for the user:** fully close the PWA from the app switcher and
  reopen (often **twice**); worst case, remove from home screen and re-add.
- When debugging "still broken on iPhone," **confirm the running version first** before
  assuming the fix is wrong.

---

## 13. Cost / quota awareness
- Free Firebase tier is small (~5 GB stored, ~1 GB/day egress). Images and especially
  video eat it fast. Compression (§4) + the size cap are what keep you inside it.
- **Defer video** unless you must — huge files, slow uploads, needs a player.
- **Skip building a custom in-app camera** — `<input capture>` gives the polished native
  camera for free.

---

## 14. Build order (so you never debug two unknowns at once)
1. **Audit the sync-merge paths (§9).** Gate everything on this.
2. Data model + generic helpers + upload (one modality: plain files first).
3. The "Add" overflow menu + hidden inputs.
4. Rendering (rows, then image thumbnails).
5. Soft-delete + Trash + sweep + search-by-filename.
6. Storage security rules.
7. **The open/preview logic + iOS routing (§11)** — budget real time here; it's the hard
   part, not the upload.
8. Photos (compression) → camera → clipboard paste.
9. No-cache headers + version string (§12) *early*, so iOS testing isn't a black box.

---

## 15. Pitfalls checklist (paste into your PR description)
- [ ] Verified **every** sync/merge path carries unknown fields (whole-object). (§9)
- [ ] Storage rules deployed **separately** from the web host. (§10)
- [ ] Files stored **inline** (no `Content-Disposition: attachment`). (§11)
- [ ] Open logic **branches on iOS vs desktop AND on type**; iWork → native. (§11)
- [ ] In-app viewer has an **"Open externally" fallback**. (§11)
- [ ] Images **compressed + EXIF-oriented**, HEIC falls back to original. (§4)
- [ ] Size cap enforced client-side; resumable upload with progress. (§3)
- [ ] Soft-delete + Trash + TTL sweep + blob cleanup on hard-delete. (§8)
- [ ] No-cache headers + visible version string for iOS PWA testing. (§12)
- [ ] Re-test on a **real iPhone in the installed PWA**, not just desktop Safari.

---

## 16. Adapting to a non-Firebase backend
The architecture is backend-agnostic; only three touchpoints are Firebase-specific:
- **Blob storage** (`uploadBlobAttachment`): swap for S3 presigned PUT, Supabase Storage,
  Cloudinary, etc. You still need: a stored path for deletion, a readable URL, and ideally
  resumable + progress. Keep storing files **inline** (set the object's content-type, not
  a forced download disposition) for the iOS reasons in §11.
- **Record persistence/sync** (the embedded array): any DB works — the §9 rule
  ("whole-record writes carry the array") is what matters, not the engine.
- **Security rules**: re-express §10 in your platform's terms (S3 bucket policy / IAM,
  Supabase RLS, etc.) — per-user path isolation + a size cap.
The **iOS open/preview logic (§11) and PWA-staleness fixes (§12) are entirely
client-side and transfer unchanged** regardless of backend. They are the real prize here.
