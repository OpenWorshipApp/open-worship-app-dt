// Types for `manualPage.mjs`, which is plain ESM like everything else under
// `tools/`. They exist because the chatbot window imports it from TypeScript:
// the copy of a guide page it reads off the repository has to be cleaned and
// dated exactly as the server cleans and dates the built-in one.

/** The day a manual page was generated (`2026-10-11`), or null. */
export function readManualPageDate(content: string): string | null;

/** The page with its front matter, robot blocks and picture marks taken out. */
export function toManualPageBody(content: string): string;

/** The first words of the note `owa_help_page` ends a manual page with. */
export const FRESH_PAGE_NOTE_LEAD: string;

/** What a part of a long page ends with; nothing for the last part. */
export function genPagePartNote(part: number, total: number): string;

/** Where a part's "goes on" note starts, and which part of how many it is. */
export function readPagePartNote(
    text: string,
): { at: number; part: number; total: number } | null;

/** A page as a person is shown it: nothing of what was said to the model. */
export function toShownPage(text: string): string;
