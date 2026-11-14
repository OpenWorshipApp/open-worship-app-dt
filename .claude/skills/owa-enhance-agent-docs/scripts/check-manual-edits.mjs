// The readers' door to `apply-manual-edits.mjs`: the very same checks --
// every `old` once in its document, no two edits overlapping, every evidence
// quote really in the file it names -- and never a write, whatever is passed.
//
//   node .../check-manual-edits.mjs <edits.json>
//
// A reader is told to check its proposals until they print `0 problem(s)`.
// On 2026-11-10 the auto-mode permission check refused `apply-manual-edits.mjs`
// to 7 of 22 readers, with `--apply` or without -- the name says it writes --
// and each wrote its own copy of the checks instead, which proves nothing
// about the real ones (`AD-25`). This file holds no checks of its own, so the
// two can never disagree; the writer still runs the applier.
//
// Exit code: 0 when nothing is wrong, 1 otherwise. Nothing is written.

globalThis.__OWA_MANUAL_EDITS_CHECK_ONLY = true;
await import('./apply-manual-edits.mjs');
