import { describe, expect, test } from 'vitest';

import {
    devMockSongCatalog,
    respondSongSelectDevMock,
} from './songSelectDevMockData';

describe('songSelectDevMockData', () => {
    test('the catalog keeps both disabled-row demo states', () => {
        expect(devMockSongCatalog.some((song) => !song.isAuthorized)).toBe(
            true,
        );
        expect(devMockSongCatalog.some((song) => !song.hasLyrics)).toBe(true);
        // Every downloadable song must actually have lyric parts to serve.
        for (const song of devMockSongCatalog) {
            if (song.hasLyrics && song.isAuthorized) {
                expect(song.lyricParts.length).toBeGreaterThan(0);
            }
        }
    });

    test('search filters, paginates and mirrors the real API shape', async () => {
        const all: any = await respondSongSelectDevMock(
            '/songs?filter[search]=&page[number]=1&page[size]=10',
        );
        expect(all.pagination.totalItems).toBe(devMockSongCatalog.length);
        expect(all.pagination.lastPage).toBe(2);
        expect(all.data.results).toHaveLength(10);
        const first = all.data.results[0];
        expect(typeof first.content.lyrics.exists).toBe('boolean');
        expect(typeof first.content.lyrics.isAuthorized).toBe('boolean');

        const filtered: any = await respondSongSelectDevMock(
            '/songs?filter[search]=well+soul&page[number]=1&page[size]=10',
        );
        expect(filtered.data.results).toHaveLength(1);
        expect(filtered.data.results[0].title).toBe('It Is Well With My Soul');
    });

    test('lyrics come back for catalog and unknown ids alike', async () => {
        const known: any = await respondSongSelectDevMock(
            '/songs/mock-22025/lyrics',
        );
        expect(known.data.title).toBe('Amazing Grace');
        expect(known.data.lyricParts).toHaveLength(4);

        const unknown: any = await respondSongSelectDevMock(
            '/songs/no-such-id/lyrics',
        );
        expect(unknown.data.title).toBe('Unknown Mock Song');
        expect(unknown.data.lyricParts.length).toBeGreaterThan(0);
    });

    test('an unhandled path throws instead of returning junk', async () => {
        await expect(respondSongSelectDevMock('/albums?x=1')).rejects.toThrow(
            'Unknown SongSelect mock path',
        );
    });
});
