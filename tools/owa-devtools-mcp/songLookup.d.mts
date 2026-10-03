// Only what a TypeScript caller reads off the song lookup: the first words of
// the two lines the offline bot reads back, so the renderer's prefixes can be
// pinned to the real ones, and the formatter the tests drive.

export declare const SONG_NOT_FOUND_PREFIX: string;

export declare const SONG_YOURS_PREFIX: string;

export declare function formatSongLookup(value: unknown): string;
