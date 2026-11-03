import { sanitizeFindingText } from '../lang/langHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleStyleHelpers';
import type { BibleFindForType } from './bibleFindHelpers';
import { calcPerPage, toFindWildCardText } from './bibleFindHelpers';

// What the SQLite find and the plain fallback find (`PlainFindHandler`) share:
// reading a find request into a page window plus a `LIKE`-style needle, the
// shape of a found row. Suggestion ranking is in `suggestionWordHelpers`.

export const DEFAULT_ROW_LIMIT = 20;

export async function prepareFindQuery(
    bibleKey: string,
    findData: BibleFindForType,
) {
    // TODO: use dictionary to break text text to words.
    // e.g: Khmer language has no space between words so we need to break it to words
    const { text } = findData;
    if (!text) {
        return null;
    }
    let { fromLineNumber, toLineNumber } = findData;
    if (fromLineNumber === undefined || toLineNumber === undefined) {
        fromLineNumber = 0;
        toLineNumber = DEFAULT_ROW_LIMIT - 1;
    }
    const locale = await getBibleLocale(bibleKey);
    const sText = (await sanitizeFindingText(locale, text)) ?? text;
    const wildCardText = toFindWildCardText(locale, sText);
    if (wildCardText === null) {
        // The query holds nothing this bible's script can match, so there
        // is no query to run: `null` puts the view on the same "No data
        // available" state an empty box does, instead of scanning all
        // 31,000 verses to answer that every one of them matched.
        return null;
    }
    const count = calcPerPage(toLineNumber, fromLineNumber);
    if (count < 1) {
        throw new Error(`Invalid line number ${JSON.stringify(findData)}`);
    }
    return { fromLineNumber, toLineNumber, count, wildCardText };
}

/** A stored verse row, `BOOK.chapter:verse=>text`, as the find shows it. */
export function toFoundVerseItem(text: string) {
    const splitted = text.split('=>');
    return {
        uniqueKey: crypto.randomUUID(),
        text: `${splitted[0]}:${splitted[1]}`,
    };
}
