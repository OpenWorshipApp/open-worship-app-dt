// Types for `destructiveLabel.mjs`, which is plain ESM like everything else
// under `tools/`. Only what TypeScript imports is declared: an app test holds a
// control's words against the SAME patterns the firewall refuses by, so a label
// that would lock the assistant out (the Stage Previewer's "Remove Stage 3",
// which only hid a pane) fails a test instead of a session.

export const DESTRUCTIVE_LABEL_PATTERNS: RegExp[];
