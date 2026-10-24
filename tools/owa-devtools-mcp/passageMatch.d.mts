// Types for `passageMatch.mjs`, which is plain ESM like everything else under
// `tools/`. They exist because the chatbot window imports it from TypeScript:
// the server quotes a page in a search hit and the window cuts a long page to
// what rides on a question, and both must read the page the same way.

/** One step, bullet or paragraph of a page, and where it starts in it. */
export type PassageType = {
    text: string;
    at: number;
};

/** Word groups: the asker's own word first, the app's words for it after. */
export type PassageTermsType = (string | string[])[];

export const EXCERPT_CHAR_LIMIT: number;

/** Whether a line opens a paragraph on a bold lead (wrapped or not). */
export function checkIsBoldLeadLine(line: string, nextLine?: string): boolean;

/** Lower case, labels out of their templates, words only. */
export function toPassageKey(text: string): string;

/** The page as passages, the lines each was wrapped over joined. */
export function toPassages(text: string): PassageType[];

/** Every passage that matches, best first. */
export function rankPassages(
    passages: PassageType[],
    terms?: PassageTermsType,
    anchors?: string[],
): { index: number; score: number }[];

/** The passage that answers, quoted whole and cut at a sentence. */
export function genPassageExcerpt(
    text: string,
    terms?: PassageTermsType,
    anchors?: string[],
): string;

/** A question's own words as term groups, the small words out. */
export function toQuestionTerms(text: string): string[][];

/**
 * A long page cut to its opening and the passages that match -- `isHead`
 * when its own first `limit` characters already carry the best one -- or
 * null when nothing on the page matches.
 */
export function clipPageToPassages(
    text: string,
    terms?: PassageTermsType,
    anchors?: string[],
    limit?: number,
    headLimit?: number,
): { text: string; isEndCut: boolean; isHead: boolean } | null;

/** A corpus row's control, menu item and keys, as words to look for. */
export function genQuestionAnchors(
    resources:
        | { find?: unknown; menu?: unknown; shortcut?: unknown }
        | null
        | undefined,
): string[];
