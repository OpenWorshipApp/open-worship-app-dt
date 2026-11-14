// The signs Unicode calls INVISIBLE STACKERS (`Indic_Syllabic_Category` =
// `Invisible_Stacker` in its `IndicSyllabicCategory.txt`): a sign that sets
// the NEXT consonant under the one before it, so the two are one cluster on
// the page while `Intl.Segmenter` -- which has no conjunct rule for these
// scripts -- hands them out as two graphemes. A script's subscript sign is one.
// They are a property of scripts, not words of any language, so they are
// listed here by code point; a cluster that ends in one belongs with what
// follows it.
const INVISIBLE_STACKER_CODE_POINT_SET = new Set([
    0x1039, 0x17d2, 0x1a60, 0x1bab, 0xaaf6, 0x10a3f, 0x11133, 0x1193e, 0x11d45,
    0x11d97, 0x11f42,
]);

/** Whether `text` ends in a sign that joins it to the next letter. */
export function checkEndsWithInvisibleStacker(text: string) {
    let index = text.length - 1;
    const lastUnit = text.charCodeAt(index);
    // The second half of a surrogate pair: the sign starts one unit back.
    if (index > 0 && lastUnit >= 0xdc00 && lastUnit <= 0xdfff) {
        index -= 1;
    }
    return INVISIBLE_STACKER_CODE_POINT_SET.has(text.codePointAt(index) ?? -1);
}

/** `text` with any such signs at its end taken off. */
export function trimTrailingInvisibleStackers(text: string) {
    let trimmed = text;
    while (trimmed !== '' && checkEndsWithInvisibleStacker(trimmed)) {
        const lastUnit = trimmed.charCodeAt(trimmed.length - 1);
        const isPairEnd =
            trimmed.length > 1 && lastUnit >= 0xdc00 && lastUnit <= 0xdfff;
        trimmed = trimmed.slice(0, isPairEnd ? -2 : -1);
    }
    return trimmed;
}

// One segmenter for the life of the page: a constant, not a cache.
let graphemeSegmenter: Intl.Segmenter | null | undefined;

function getGraphemeSegmenter() {
    if (graphemeSegmenter === undefined) {
        graphemeSegmenter =
            typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
                ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
                : null;
    }
    return graphemeSegmenter;
}

const MARK_PATTERN = /^\p{M}/u;

/**
 * Whether `index` in `text` falls between two letter clusters: a letter
 * with its marks is one cluster, and so is a letter set under the one
 * before it (after an invisible stacker). Only the line holding `index`
 * is segmented, a line break being an edge always. With no segmenter, an
 * edge is any place but before a mark, inside a surrogate pair or after a
 * stacker.
 */
export function checkIsClusterEdge(text: string, index: number) {
    if (index <= 0 || index >= text.length) {
        return true;
    }
    if (text[index - 1] === '\n' || text[index] === '\n') {
        return true;
    }
    if (
        checkEndsWithInvisibleStacker(text.slice(Math.max(0, index - 2), index))
    ) {
        return false;
    }
    const segmenter = getGraphemeSegmenter();
    if (segmenter === null) {
        const unit = text.charCodeAt(index);
        return (
            !(unit >= 0xdc00 && unit <= 0xdfff) &&
            !MARK_PATTERN.test(text.slice(index, index + 2))
        );
    }
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const lineEnd = text.indexOf('\n', index);
    const offset = index - lineStart;
    const segment = segmenter
        .segment(text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd))
        .containing(offset);
    return segment !== undefined && segment.index === offset;
}
