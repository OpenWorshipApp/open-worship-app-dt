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
