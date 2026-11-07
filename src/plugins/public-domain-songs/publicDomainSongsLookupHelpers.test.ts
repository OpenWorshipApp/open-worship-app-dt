// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

// The song builder's file-name rule lives in `fileHelpers`, whose module
// graph reads `appProvider` on load. Nothing else about either matters here.
vi.mock('../../server/appProvider', async () => {
    const { win32 } = await import('node:path');
    return {
        default: {
            isPageScreen: false,
            isPageReader: false,
            isMainPage: false,
            systemUtils: { isDev: false },
            sessionData: { defaultStorageDirPath: null },
            pathUtils: win32,
            messageUtils: { sendData: () => {}, sendDataSync: () => null },
        },
    };
});
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

import type { PublicDomainSongType } from './publicDomainSongsData';
import { publicDomainSongCatalog } from './publicDomainSongsData';
import {
    lookupPublicDomainSong,
    toComparableSongTitle,
} from './publicDomainSongsLookupHelpers';

// A hand-made catalog: the lookup is pure, so a case the 36 hymns do not
// happen to contain (a tie, a song without words) is built directly.
function genCatalogSong(
    title: string,
    verses: string[] = [`${title} first line`],
): PublicDomainSongType {
    return {
        id: title.toLowerCase().replace(/[^a-z]+/g, '-'),
        title,
        authors: ['Anonymous'],
        year: '1900',
        sources: [],
        verses,
        refrain: null,
    };
}

function findTitle(asked: string) {
    return lookupPublicDomainSong(publicDomainSongCatalog, asked).found?.title;
}

describe('toComparableSongTitle', () => {
    it('drops case, punctuation, apostrophes and a leading "the"', () => {
        expect(toComparableSongTitle("'Tis So Sweet to Trust in Jesus")).toBe(
            'tis so sweet to trust in jesus',
        );
        expect(toComparableSongTitle('The Doxology!')).toBe('doxology');
    });
});

describe('lookupPublicDomainSong', () => {
    it('finds a hymn by its exact title, in any case', () => {
        expect(findTitle('Amazing Grace')).toBe('Amazing Grace');
        expect(findTitle('amazing grace')).toBe('Amazing Grace');
        expect(findTitle('AMAZING GRACE!')).toBe('Amazing Grace');
    });

    it('writes the same document the plugin import writes', () => {
        const { found } = lookupPublicDomainSong(
            publicDomainSongCatalog,
            'Amazing Grace',
        );
        expect(found?.content).toContain('- Title: Amazing Grace');
        expect(found?.content).toContain('- Copyright: Public Domain');
        expect(found?.content).toContain('- Attachments: ');
        expect(found?.authors.length).toBeGreaterThan(0);
    });

    it('ignores the words people put around a title', () => {
        expect(findTitle('the hymn Amazing Grace')).toBe('Amazing Grace');
        expect(findTitle('Amazing Grace lyrics')).toBe('Amazing Grace');
        expect(findTitle('Amazing Grace by John Newton')).toBe('Amazing Grace');
    });

    it('finds a hymn by a shortened title, its first line or a bracket', () => {
        expect(findTitle('Holy Holy Holy')).toBe(
            'Holy, Holy, Holy! Lord God Almighty',
        );
        expect(findTitle('Amazing grace how sweet the sound')).toBe(
            'Amazing Grace',
        );
        expect(findTitle('Doxology')).toBe(
            'Doxology (Praise God, from Whom All Blessings Flow)',
        );
        expect(findTitle('Tis So Sweet to Trust in Jesus')).toBe(
            "'Tis So Sweet to Trust in Jesus",
        );
    });

    it('finds nothing for a song the collection does not hold', () => {
        const result = lookupPublicDomainSong(
            publicDomainSongCatalog,
            'Way Maker',
        );
        expect(result.found).toBeNull();
    });

    it('names the nearest titles rather than guessing on one word', () => {
        const result = lookupPublicDomainSong(publicDomainSongCatalog, 'Jesus');
        expect(result.found).toBeNull();
        expect(result.nearest.length).toBeGreaterThan(0);
        expect(result.nearest.length).toBeLessThanOrEqual(5);
    });

    it('an ask made only of filler words names nothing and suggests nothing', () => {
        expect(
            lookupPublicDomainSong(publicDomainSongCatalog, 'The hymn lyrics'),
        ).toEqual({ found: null, nearest: [] });
    });

    // Two hymns that both answer is a question for the person: the tied
    // titles come back, a weaker match does not, and nothing is written.
    it('a tie at the top is not a find', () => {
        const catalog = [
            genCatalogSong('Silent Night'),
            genCatalogSong('Silent Night (Stille Nacht)'),
            genCatalogSong('Night Silent Holy'),
            genCatalogSong('Abide with Me'),
        ];
        expect(lookupPublicDomainSong(catalog, 'Silent Night')).toEqual({
            found: null,
            nearest: ['Silent Night', 'Silent Night (Stille Nacht)'],
        });
    });

    it('a song with no words to write is not handed on as found', () => {
        const catalog = [genCatalogSong('Empty Hymn Tune', ['   ', ''])];
        expect(
            lookupPublicDomainSong(catalog, 'Empty Hymn Tune').found,
        ).toBeNull();
    });

    it('finds every hymn in the collection by its own title', () => {
        for (const song of publicDomainSongCatalog) {
            expect(findTitle(song.title), song.title).toBe(song.title);
        }
    });
});
