// Classic English hymns whose texts are in the public domain (authors dead
// well over 70 years; texts fetched from hymnary.org / The Cyber Hymnal /
// Wikisource / Timeless Truths, 2026-08-24). The catalog itself lives in
// `publicDomainSongsData.json` beside this file - it is embedded so hymns
// import with no account and no network, and loaded lazily behind the popup
// panel, so it costs nothing until the user actually opens it.

import publicDomainSongCatalogJson from './publicDomainSongsData.json';

// Where the text was taken from. Every link is written into the imported
// document's open-lyric `Attachments`, so a song always carries a way back to
// the page it was transcribed from.
export type PublicDomainSongSourceType = {
    // The attachment label - the site, not the song.
    title: string;
    // Absolute, protocol-based URL; open-lyric rejects anything else.
    url: string;
};

export type PublicDomainSongType = {
    id: string;
    title: string;
    authors: string[];
    // Publication year of the English text; display only.
    year: string;
    sources: PublicDomainSongSourceType[];
    // One string per verse, lines separated by \n.
    verses: string[];
    // Refrain lines, or null when the hymn has none.
    refrain: string | null;
};

export const publicDomainSongCatalog: PublicDomainSongType[] =
    publicDomainSongCatalogJson;
