/**
 * Shape of the slim in-text lookup index, kept in its own leaf module so the
 * builder and the consumers can share it without either pulling the other in.
 */
export type LookupTextIndexType = {
    version: number;
    // Record ids are interned: every list below holds indices into this.
    ids: string[];
    names: { [needle: string]: number[] };
    locations: { [needle: string]: number[] };
    verseNames: { [shortVerse: string]: number[] };
    verseLocations: { [shortVerse: string]: number[] };
};

/**
 * Display data for the interned records, written as a SIDECAR file rather than
 * folded into the index above.
 *
 * The index is subscribed by every KJV verse view on screen, so anything added
 * to it is resident for every reader whether or not they ever ask to see a
 * record's name. Only the "who and where is in what I am reading" tab needs the
 * labels, so it pays for them alone and drops them when it unmounts.
 *
 * Every array is parallel to `LookupTextIndexType.ids`. Both files come out of
 * one build pass, so they cannot disagree; a length mismatch means a
 * hand-edited or half-written file and is rejected rather than mis-indexed.
 */
export type LookupRecordLabelsType = {
    version: number;
    // The record's display name.
    labels: string[];
    // The record's ENGLISH name, shown beside a translated label the way a
    // bible book reads `លោកុប្បត្តិ (Genesis)`. Empty for every record when the
    // sidecar is the English one — its labels already ARE the English names —
    // and for a record the translation does not cover, whose label stayed
    // English. Still written in full so the array can never mis-index.
    kjvNames: string[];
    // `MentionNameType` for a name record, '' for a location.
    types: string[];
    // One-line description, reference tokens stripped and truncated.
    titles: string[];
};

// Bumped whenever the generated shape or the needle derivation changes, so a
// cache written by an older build is rejected instead of silently misused.
// Shared by BOTH files: they are written together and expire together.
export const LOOKUP_TEXT_INDEX_VERSION = 3;

/**
 * The surface forms of every interned record in ONE non-English language, so a
 * bible in that language can be decorated the way the KJV already is.
 *
 * A THIRD file rather than a field on either of the two above, for the reason
 * that split them in the first place: the index is language-independent and the
 * labels sidecar is a quarter of a megabyte of prose no verse view reads, while
 * this is the only per-language thing a verse view does need. Written per
 * language and aligned to the same English id list, so `needles[i]` is the
 * translated name of the record `LookupTextIndexType.ids[i]` names.
 *
 * Matching translated text cannot work the way English does — see
 * `verseTextTranslatedHelpers` — so this is keyed by RECORD rather than by
 * needle: the matcher starts from the handful of records a verse or chapter
 * attests and looks for those, instead of scanning the text against every form
 * in the dataset.
 */
export type LookupTextNeedlesType = {
    version: number;
    /**
     * Parallel to `LookupTextIndexType.ids`. Empty for a record the translation
     * does not cover, and still written in full so the array can never
     * mis-index.
     *
     * A record with more than one form (an old name, or a bare name under a
     * disambiguator) carries them joined by `NEEDLE_SEPARATOR`. One flat array
     * of strings rather than 3 568 nested arrays is the shape that costs the
     * least to hold, and only the few records a verse attests are ever split.
     */
    needles: string[];
};

// A name cannot contain a newline, and the builder strips every character that
// could be confused for one.
export const NEEDLE_SEPARATOR = '\n';
