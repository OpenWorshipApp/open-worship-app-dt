import type { AnyObjectType } from '../../helper/typeHelpers';
import {
    getFreshAccessToken,
    SongSelectAuthError,
} from './songSelectAuthHelpers';
import { checkShouldUseSongSelectDevMock } from './songSelectDevMockHelpers';
import { getSongSelectSetting } from './songSelectSettingHelpers';

const SONG_SELECT_API_BASE_URL = 'https://api.ccli.com/ss/v2';
// Small on purpose: low-spec target machines, and the API rate limit is 100
// calls per 10 seconds.
export const SONG_SELECT_PAGE_SIZE = 10;

export class SongSelectApiError extends Error {
    readonly status: number;
    constructor(status: number) {
        super(`SongSelect API request failed with status ${status}`);
        this.status = status;
    }
}

export type SongSelectSearchRecordType = {
    id: string;
    title: string;
    songNumber: string;
    authors: string[];
    lyricsPreview: string;
    isPublicDomain: boolean;
    hasLyrics: boolean;
    isAuthorized: boolean;
};

export type SongSelectSearchPageType = {
    page: number;
    totalPages: number;
    totalRecords: number;
    records: SongSelectSearchRecordType[];
};

export type SongSelectLyricPartType = {
    partLabel: string;
    partType: string;
    partTypeNumber?: number;
    lyrics: string;
};

export type SongSelectLyricsType = {
    title: string;
    authors: string[];
    copyrights: string[];
    songNumber: string;
    lyricParts: SongSelectLyricPartType[];
};

function genHeaders(accessToken: string) {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Ocp-Apim-Subscription-Key': getSongSelectSetting().subscriptionKey,
    };
}

async function fetchSongSelectJson(
    pathAndQuery: string,
): Promise<AnyObjectType> {
    if (checkShouldUseSongSelectDevMock()) {
        const { respondSongSelectDevMock } =
            await import('./songSelectDevMockData');
        return await respondSongSelectDevMock(pathAndQuery);
    }
    const url = `${SONG_SELECT_API_BASE_URL}${pathAndQuery}`;
    let response = await fetch(url, {
        headers: genHeaders(await getFreshAccessToken()),
    });
    if (response.status === 401) {
        // The stored token may have been revoked before its expiry time —
        // force one refresh and retry once.
        response = await fetch(url, {
            headers: genHeaders(await getFreshAccessToken(true)),
        });
    }
    if (!response.ok) {
        throw new SongSelectApiError(response.status);
    }
    return await response.json();
}

function toAuthorList(authors: unknown): string[] {
    if (!Array.isArray(authors)) {
        return [];
    }
    return authors
        .map((author: any) => {
            if (typeof author === 'string') {
                return author;
            }
            return String(author?.label ?? author?.name ?? '');
        })
        .filter(Boolean);
}

function toSearchRecord(item: any): SongSelectSearchRecordType {
    return {
        id: String(item?.id ?? ''),
        title: String(item?.title ?? ''),
        songNumber: String(item?.songNumber ?? ''),
        authors: toAuthorList(item?.authors),
        lyricsPreview: String(item?.lyricsPreview ?? ''),
        isPublicDomain: item?.isPublicDomain === true,
        hasLyrics: item?.content?.lyrics?.exists === true,
        isAuthorized: item?.content?.lyrics?.isAuthorized === true,
    };
}

export async function searchSongs(
    query: string,
    pageNumber: number,
): Promise<SongSelectSearchPageType> {
    const params = new URLSearchParams({
        'filter[search]': query,
        'page[number]': String(pageNumber),
        'page[size]': String(SONG_SELECT_PAGE_SIZE),
        lyricspreview: 'true',
        'filter[musthavelyrics]': 'true',
    });
    const json = await fetchSongSelectJson(`/songs?${params}`);
    const pagination = json?.pagination ?? {};
    const results = Array.isArray(json?.data?.results) ? json.data.results : [];
    const pageSize = Number(pagination.pageSize) || SONG_SELECT_PAGE_SIZE;
    const totalRecords = Number(pagination.totalItems) || results.length;
    const totalPages =
        Number(pagination.lastPage) ||
        Math.max(1, Math.ceil(totalRecords / pageSize));
    return {
        page: Number(pagination.pageNumber) || pageNumber,
        totalPages,
        totalRecords,
        records: results.map(toSearchRecord),
    };
}

export async function getSongLyrics(
    songId: string,
): Promise<SongSelectLyricsType> {
    const json = await fetchSongSelectJson(
        `/songs/${encodeURIComponent(songId)}/lyrics`,
    );
    const data = json?.data ?? {};
    return {
        title: String(data.title ?? ''),
        authors: toAuthorList(data.authors),
        copyrights: (Array.isArray(data.copyrights) ? data.copyrights : []).map(
            String,
        ),
        songNumber: String(data.songNumber ?? ''),
        lyricParts: (Array.isArray(data.lyricParts) ? data.lyricParts : []).map(
            (part: any): SongSelectLyricPartType => {
                return {
                    partLabel: String(part?.partLabel ?? ''),
                    partType: String(part?.partType ?? ''),
                    partTypeNumber: Number(part?.partTypeNumber) || undefined,
                    lyrics: String(part?.lyrics ?? ''),
                };
            },
        ),
    };
}

export function toSongSelectErrorMessageKey(error: unknown): string {
    if (
        error instanceof SongSelectAuthError ||
        (error instanceof SongSelectApiError && error.status === 401)
    ) {
        return 'SongSelect sign-in expired, please sign in again in Settings';
    }
    if (error instanceof SongSelectApiError) {
        if (error.status === 403) {
            return 'Your account is not licensed for this content';
        }
        if (error.status === 429) {
            return 'Too many requests, please wait a moment';
        }
    }
    if (error instanceof TypeError) {
        return 'Could not reach SongSelect';
    }
    return 'SongSelect request failed';
}
