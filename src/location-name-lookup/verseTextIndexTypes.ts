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
