---
name: archive-password-protection
description: Optional password protection wraps a finished archive in an OWAENC container; the kind stays in the name, detection is by magic, and the dialog is loaded on demand
metadata:
  type: project
---

Every export (`.owadata.tar`, `.owadoc/.owapf/.owbible/.owabn.tar.gz`) asks for an
optional password first. Empty is the default answer and writes byte-for-byte the bundle
that was always written; a password wraps that finished file whole in an `OWAENC`
container (`electron/archiveCryptoHelpers.ts`) and writes `<name>.<kind>.enc` instead.

**Why:** the archive formats themselves are untouched, so every bundle already on
someone's disk still imports and an unprotected export is unchanged. Added 2026-08-07.

**How to apply:**

- **The kind stays in the extension** (`.owapf.enc`, not a shared `.enc`), because every
  drop gate and file dialog decides where a bundle belongs from its NAME, synchronously,
  before any path is open. `checkIsArchiveFileFullName` accepts both shapes, so all three
  drop gates got the protected bundle for free.
- **But detection is by the container magic**, never the name — a bundle renamed by a
  mail client still opens, and a plain one renamed to `.enc` is never prompted for.
  Extensions route; the header decides.
- **The dialog is loaded on demand.** `src/popup-widget/ArchivePasswordComp.tsx` reaches
  React and `tran` (and through `tran` the whole language pack); the five archive modules
  import only `src/helper/archivePasswordHelpers.ts`, which `import()`s it at call time.
  A static edge here dragged the note editor's dependencies into the bible-note bundle
  helper and blew the test worker's heap.
- **`src/helper/archiveNameHelpers.ts` is a leaf** holding every naming/extension rule, so
  naming a bundle does not pull in `appArchiveHelpers`' collector graph.
  `appArchiveHelpers` re-exports it all; existing callers were untouched.
- **`genNextArchiveFilePath` is bounded now** (1000 tries). A mock that answered "taken"
  to everything spun it forever, growing a string each turn until the heap died.

**The bug this shipped with, and its shape:** a mismatched confirmation re-opens the
dialog, which hands over a FRESH closure while React keeps the component mounted with its
state. The reporting effect watched only the values, so it never fired again, the new
closure was never told anything, and a second Ok read the password as empty — which means
"no password" — and exported UNPROTECTED, silently. Fix: `onChange` is IN the effect's
dependency list, in `ArchivePasswordComp` *and* in `DataFolderSelectorComp`, which the
same recursive re-ask exposes. Do not "stabilise" either one back behind a ref.

**Two costs worth knowing:**

- A protected data archive is decrypted WHOLE before its manifest can be read, so the
  "unpack only `manifest.json`" fast path only survives for plain archives.
  `dataArchiveMenuHelpers.handleImporting` opens it ONCE and passes the plain path to both
  `readDataArchiveManifest` and `importDataArchive` — do not re-introduce a second open.
- A protected data export writes its plain tar to `<final>.part` BESIDE the destination,
  not in `%TEMP%`: this archive has no staging copy by design and can be gigabytes.

Container: 64-byte plaintext header (`OWAENC\0`, version, KDF id, log2N/r/p, salt, IV,
16-byte key check) + AES-256-GCM ciphertext + 16-byte tag at EOF. scrypt N=2^15, r=8, p=1
— about 130ms, and `maxmem` MUST be passed explicitly or node's 32MB default throws. The
key check is what makes a wrong password cost one derivation instead of reading the whole
file. Decrypt reads the tag out-of-band first, then streams
`createReadStream(start: 64, end: size - 17)` — `end` is INCLUSIVE, and a zero-byte
payload has no valid range at all and is handled separately.

Related: [[data-archive-owadata]], [[presenting-flow-archive-owapf]], [[document-archive-owadoc]],
[[tran-missing-key-throws-in-dev]].
