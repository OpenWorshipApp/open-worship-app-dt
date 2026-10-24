import type { CompiledVerseType } from './bibleRenderHelpers';

// A leaf: the copy menu's More… formats verses with it without bringing the
// renderer's whole graph into its tests.

// How each verse of a copied text is numbered: `(16): For God…` (the
// default), `16: For God…`, or not at all.
export type BibleVerseNumberStyleType = 'parenthesis' | 'colon' | 'none';

export function toVerseListText(
    verseTextList: Pick<CompiledVerseType, 'localeVerse' | 'text'>[],
    verseNumberStyle: BibleVerseNumberStyleType = 'parenthesis',
) {
    return verseTextList
        .map(({ localeVerse, text }) => {
            if (verseNumberStyle === 'none') {
                return text;
            }
            if (verseNumberStyle === 'colon') {
                return `${localeVerse}: ${text}`;
            }
            return `(${localeVerse}): ${text}`;
        })
        .join(' ');
}
