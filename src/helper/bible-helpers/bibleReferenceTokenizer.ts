/**
 * Reads the RANGE forms of a typed bible reference: a passage crossing
 * chapters (`John 1:2-3:4`), an open start (`John 1:-3`) and a range of whole
 * chapters (`John 1-3`).
 *
 * Every other form — `John 3:16`, `John 3:16-18`, `John 3:16-`, `John 3:`,
 * `John 3`, a book alone — is deliberately NOT claimed here: it keeps the
 * parser it has always had (`regexTitleMap` in `bibleLogicHelpers2`), so
 * nothing a volunteer already types changes meaning.
 *
 * Pure and import-free: the digits a reference may be written in are handed
 * in as a pattern (`toBibleDigitPattern`), since a Bible may number its
 * verses in digits of its own.
 */

export type BibleRangeTokensType = {
    book: string;
    // Raw, still in the Bible's own digits: only the Bible can read them.
    chapter: string;
    // `null`: from the start of the chapter.
    verseStart: string | null;
    // `null`: the passage ends in `chapter`.
    chapterEnd: string | null;
    // `null`: to the end of its chapter.
    verseEnd: string | null;
    // `John 1-3`: no colon anywhere, so the numbers are chapters — except in
    // a one-chapter book (`Jude 1-3`), where a citation means verses. Only
    // the resolved book can say which.
    isWithoutColon: boolean;
};

function escapeRegExp(text: string) {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * One digit, as a regex fragment: any script's decimal digit, plus whatever
 * the Bible itself numbers with.
 */
export function toBibleDigitPattern(numList: string[] | null = null) {
    const extraList = (numList ?? []).filter((digit) => {
        return digit !== '' && !/^\p{Nd}$/u.test(digit);
    });
    if (extraList.length === 0) {
        return String.raw`\p{Nd}`;
    }
    return String.raw`(?:\p{Nd}|${extraList.map(escapeRegExp).join('|')})`;
}

// Hyphen, non-breaking hyphen, figure dash, en and em dash, horizontal bar,
// minus, and their small/fullwidth forms: what a reference pasted from a
// document or a phone keyboard separates its range with.
const DASH_VARIANTS = String.raw`[‐-―−﹘﹣－]`;

/**
 * Spells a range the one way the tokenizer reads it. Each pass touches only
 * numbers and the separators BETWEEN numbers, so a book name — `1. Mose`, with
 * a dot followed by a space — is never rewritten.
 */
export function normalizeBibleReferenceText(
    text: string,
    digitPattern = toBibleDigitPattern(),
) {
    const D = digitPattern;
    const separator = String.raw`[:\-]`;
    // `18–19`, `18 — 19`
    text = text.replaceAll(
        new RegExp(String.raw`(?<=${D}|:)\s*${DASH_VARIANTS}+\s*`, 'gu'),
        '-',
    );
    text = text.replaceAll('：', ':');
    // `1:2 to 3:4`, `1 through 3`, `1:2 thru 3:4`
    text = text.replaceAll(
        new RegExp(
            String.raw`(?<=${D}|:)\s+(?:to|through|thru)\s+(?=${D})`,
            'giu',
        ),
        '-',
    );
    // `1 : 2 - 3 : 4`
    text = text.replaceAll(
        new RegExp(
            String.raw`(?<=${D}|${separator})\s*(${separator})\s*` +
                String.raw`(?=${D}|${separator}|$)`,
            'gu',
        ),
        '$1',
    );
    // `១៨.៣៣-១៩.១៦`: the dot as the chapter-verse separator, which the older
    // pass converts only once. A dot followed by a space is a book's own.
    text = text.replaceAll(
        new RegExp(String.raw`(?<=${D})\.(?=${D})`, 'gu'),
        ':',
    );
    text = text.replaceAll(
        new RegExp(String.raw`(?<=${D})\.(?=-|$)`, 'gu'),
        ':',
    );
    // `John 3,16-4,2`: the comma as the separator, the way much of Europe
    // writes it — only where nothing else separates chapter and verse.
    if (!text.includes(':')) {
        text = text.replaceAll(
            new RegExp(String.raw`(?<=${D})\s*,\s*(?=${D})`, 'gu'),
            ':',
        );
    }
    // `1:2--3:4`
    text = text.replaceAll(/-{2,}/g, '-');
    return text;
}

/**
 * Whether any word of a normalized text is a range this module reads:
 * `John 1:2-3:4 (esv)` holds one beside the version naming its Bible.
 */
export function checkHasBibleRangeReference(
    text: string,
    digitPattern = toBibleDigitPattern(),
) {
    return text.split(/\s+/).some((word) => {
        return tokenizeBibleRangeReference(`_ ${word}`, digitPattern) !== null;
    });
}

/**
 * The range tokens of a normalized reference, or `null` when it is no range
 * form this module owns — including every form the legacy parser reads.
 */
export function tokenizeBibleRangeReference(
    text: string,
    digitPattern = toBibleDigitPattern(),
): BibleRangeTokensType | null {
    const splitMatch = /^(.+)\s(\S+)$/u.exec(text.trim());
    if (splitMatch === null) {
        return null;
    }
    const book = splitMatch[1].trim();
    const reference = splitMatch[2];
    const D = digitPattern;
    // start chapter, its colon, start verse; then after ONE dash: an end
    // chapter or verse, its colon, a stray dash (`3:-3`), an end verse.
    const rangeMatch = new RegExp(
        String.raw`^(${D}+)(?:(:)(${D}+)?)?-` +
            String.raw`(?:(${D}+)(?:(:)-?(${D}+)?)?)?$`,
        'u',
    ).exec(reference);
    if (rangeMatch === null) {
        return null;
    }
    const [, chapter, colonStart, verseStart, endPart, colonEnd, verseEnd] =
        rangeMatch;
    const genTokens = (
        tokens: Omit<BibleRangeTokensType, 'book' | 'chapter'>,
    ): BibleRangeTokensType => {
        return { book, chapter, ...tokens };
    };
    if (colonStart !== undefined) {
        if (colonEnd !== undefined) {
            // `1:2-3:4`, `1:-2:`, `1:4-3:-3`
            return genTokens({
                verseStart: verseStart ?? null,
                chapterEnd: endPart,
                verseEnd: verseEnd ?? null,
                isWithoutColon: false,
            });
        }
        if (verseStart !== undefined) {
            // `1:2-3` and `1:2-`: the legacy parser's.
            return null;
        }
        // `1:-3` from the first verse; `1:-` the whole chapter.
        return genTokens({
            verseStart: null,
            chapterEnd: null,
            verseEnd: endPart ?? null,
            isWithoutColon: false,
        });
    }
    if (colonEnd !== undefined) {
        // `1-3:5`, `1-3:`
        return genTokens({
            verseStart: null,
            chapterEnd: endPart,
            verseEnd: verseEnd ?? null,
            isWithoutColon: false,
        });
    }
    // `1-3`, and `1-`: chapter 1, whole.
    return genTokens({
        verseStart: null,
        chapterEnd: endPart ?? null,
        verseEnd: null,
        isWithoutColon: true,
    });
}
