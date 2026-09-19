import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getFreshAccessTokenMock, devMockState } = vi.hoisted(() => ({
    getFreshAccessTokenMock: vi.fn(),
    devMockState: { isOn: false },
}));

vi.mock('./songSelectAuthHelpers', () => {
    class SongSelectAuthError extends Error {}
    return {
        getFreshAccessToken: getFreshAccessTokenMock,
        SongSelectAuthError,
    };
});

vi.mock('./songSelectSettingHelpers', () => ({
    getSongSelectSetting: () => ({ subscriptionKey: 'sub-key-1' }),
}));

// The real module imports appProvider, which touches `document` at load time
// and dies in this node-env test.
vi.mock('./songSelectDevMockHelpers', () => ({
    checkShouldUseSongSelectDevMock: () => devMockState.isOn,
}));

import { SongSelectAuthError } from './songSelectAuthHelpers';
import {
    getSongLyrics,
    searchSongs,
    SongSelectApiError,
    toSongSelectErrorMessageKey,
} from './songSelectApiHelpers';

function genJsonResponse(json: any, status = 200) {
    return new Response(JSON.stringify(json), { status });
}

const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    getFreshAccessTokenMock.mockReset();
    getFreshAccessTokenMock.mockResolvedValue('access-1');
    devMockState.isOn = false;
});

describe('searchSongs', () => {
    test('sends both credentials and the documented query params', async () => {
        fetchMock.mockResolvedValue(
            genJsonResponse({
                pagination: {
                    pageSize: 10,
                    pageNumber: 2,
                    totalItems: 25,
                    lastPage: 3,
                },
                data: {
                    results: [
                        {
                            id: 'id-1',
                            title: 'Amazing Grace',
                            songNumber: 22025,
                            authors: ['John Newton', { label: 'Someone' }],
                            isPublicDomain: true,
                            lyricsPreview: 'Amazing grace | how sweet',
                            content: {
                                lyrics: { exists: true, isAuthorized: false },
                            },
                        },
                    ],
                },
            }),
        );
        const result = await searchSongs('amazing grace', 2);
        const [calledUrl, init] = fetchMock.mock.calls[0];
        const url = new URL(calledUrl);
        expect(url.origin + url.pathname).toBe(
            'https://api.ccli.com/ss/v2/songs',
        );
        expect(url.searchParams.get('filter[search]')).toBe('amazing grace');
        expect(url.searchParams.get('page[number]')).toBe('2');
        expect(url.searchParams.get('page[size]')).toBe('10');
        expect(url.searchParams.get('lyricspreview')).toBe('true');
        expect(url.searchParams.get('filter[musthavelyrics]')).toBe('true');
        expect(init.headers.Authorization).toBe('Bearer access-1');
        expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('sub-key-1');
        expect(result.page).toBe(2);
        expect(result.totalPages).toBe(3);
        expect(result.totalRecords).toBe(25);
        expect(result.records).toEqual([
            {
                id: 'id-1',
                title: 'Amazing Grace',
                songNumber: '22025',
                authors: ['John Newton', 'Someone'],
                lyricsPreview: 'Amazing grace | how sweet',
                isPublicDomain: true,
                hasLyrics: true,
                isAuthorized: false,
            },
        ]);
    });

    test('derives total pages when the API omits lastPage', async () => {
        fetchMock.mockResolvedValue(
            genJsonResponse({
                pagination: { pageSize: 10, pageNumber: 1, totalItems: 11 },
                data: { results: [] },
            }),
        );
        const result = await searchSongs('x', 1);
        expect(result.totalPages).toBe(2);
    });

    test('retries once with a forced refresh on 401', async () => {
        fetchMock
            .mockResolvedValueOnce(genJsonResponse({}, 401))
            .mockResolvedValueOnce(
                genJsonResponse({
                    pagination: {},
                    data: { results: [] },
                }),
            );
        getFreshAccessTokenMock
            .mockResolvedValueOnce('stale')
            .mockResolvedValueOnce('fresh');
        const result = await searchSongs('x', 1);
        expect(result.totalRecords).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(getFreshAccessTokenMock).toHaveBeenNthCalledWith(2, true);
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
            'Bearer fresh',
        );
    });

    test('a second 401 surfaces as an api error', async () => {
        fetchMock.mockResolvedValue(genJsonResponse({}, 401));
        await expect(searchSongs('x', 1)).rejects.toBeInstanceOf(
            SongSelectApiError,
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe('getSongLyrics', () => {
    test('maps the lyric parts payload', async () => {
        fetchMock.mockResolvedValue(
            genJsonResponse({
                data: {
                    title: 'Amazing Grace',
                    authors: ['John Newton'],
                    copyrights: ['Public Domain'],
                    songNumber: 22025,
                    lyricParts: [
                        {
                            partLabel: 'Verse 1',
                            partType: 'Verse',
                            partTypeNumber: 1,
                            lyrics: 'line one',
                        },
                    ],
                },
            }),
        );
        const lyrics = await getSongLyrics('id 1');
        expect(fetchMock.mock.calls[0][0]).toBe(
            'https://api.ccli.com/ss/v2/songs/id%201/lyrics',
        );
        expect(lyrics).toEqual({
            title: 'Amazing Grace',
            authors: ['John Newton'],
            copyrights: ['Public Domain'],
            songNumber: '22025',
            lyricParts: [
                {
                    partLabel: 'Verse 1',
                    partType: 'Verse',
                    partTypeNumber: 1,
                    lyrics: 'line one',
                },
            ],
        });
    });
});

describe('dev mock mode', () => {
    test('serves canned search data with no network or token use', async () => {
        devMockState.isOn = true;
        const result = await searchSongs('amazing grace', 1);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(getFreshAccessTokenMock).not.toHaveBeenCalled();
        expect(result.totalRecords).toBe(1);
        expect(result.records[0].title).toBe('Amazing Grace');
        expect(result.records[0].isPublicDomain).toBe(true);
    });

    test('paginates the full canned catalog', async () => {
        devMockState.isOn = true;
        const pageOne = await searchSongs('', 1);
        expect(pageOne.totalRecords).toBe(13);
        expect(pageOne.totalPages).toBe(2);
        expect(pageOne.records).toHaveLength(10);
        const pageTwo = await searchSongs('', 2);
        expect(pageTwo.page).toBe(2);
        expect(pageTwo.records).toHaveLength(3);
    });

    test('serves canned lyric parts for a catalog song', async () => {
        devMockState.isOn = true;
        const lyrics = await getSongLyrics('mock-22025');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(lyrics.title).toBe('Amazing Grace');
        expect(lyrics.copyrights).toEqual(['Public Domain']);
        expect(lyrics.lyricParts.length).toBeGreaterThan(0);
        expect(lyrics.lyricParts[0].partType).toBe('Verse');
    });
});

describe('toSongSelectErrorMessageKey', () => {
    test('maps error kinds onto the toast keys', () => {
        expect(toSongSelectErrorMessageKey(new SongSelectAuthError())).toBe(
            'SongSelect sign-in expired, please sign in again in Settings',
        );
        expect(toSongSelectErrorMessageKey(new SongSelectApiError(401))).toBe(
            'SongSelect sign-in expired, please sign in again in Settings',
        );
        expect(toSongSelectErrorMessageKey(new SongSelectApiError(403))).toBe(
            'Your account is not licensed for this content',
        );
        expect(toSongSelectErrorMessageKey(new SongSelectApiError(429))).toBe(
            'Too many requests, please wait a moment',
        );
        expect(toSongSelectErrorMessageKey(new TypeError('fetch failed'))).toBe(
            'Could not reach SongSelect',
        );
        expect(toSongSelectErrorMessageKey(new SongSelectApiError(500))).toBe(
            'SongSelect request failed',
        );
        expect(toSongSelectErrorMessageKey(new Error('other'))).toBe(
            'SongSelect request failed',
        );
    });
});
