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

// Bumped whenever the generated shape or the needle derivation changes, so a
// cache written by an older build is rejected instead of silently misused.
export const LOOKUP_TEXT_INDEX_VERSION = 1;
