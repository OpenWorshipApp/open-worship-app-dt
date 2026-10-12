// Types for `manualPage.mjs`, which is plain ESM like everything else under
// `tools/`. They exist because the chatbot window imports it from TypeScript:
// the copy of a guide page it reads off the repository has to be cleaned and
// dated exactly as the server cleans and dates the built-in one.

/** The day a manual page was generated (`2026-10-11`), or null. */
export function readManualPageDate(content: string): string | null;

/** The page with its front matter, robot blocks and picture marks taken out. */
export function toManualPageBody(content: string): string;
