/**
 * CCLI (Christian Copyright Licensing International) Integration Types
 * 
 * This file defines types for interacting with CCLI SongSelect API
 * to search and import licensed worship songs.
 */

export type CCLISongType = {
    songId: string;
    title: string;
    author: string;
    copyright: string;
    ccliNumber: string;
    lyrics?: string;
    themes?: string[];
    keys?: string[];
    tempo?: string;
    timeSignature?: string;
    publisher?: string;
    verseOrder?: string[];
};

export type CCLISearchResultType = {
    songs: CCLISongType[];
    totalResults: number;
    page: number;
    pageSize: number;
};

export type CCLISearchParamsType = {
    query?: string;
    title?: string;
    author?: string;
    ccliNumber?: string;
    page?: number;
    pageSize?: number;
};

export type CCLICredentialsType = {
    subscriptionId: string;
    apiKey: string;
    useMockData?: boolean; // Developer mode: use mock data instead of real API
};

export type CCLIImportOptionsType = {
    includeChords?: boolean;
    includeVerseOrder?: boolean;
    autoFormat?: boolean;
};

/**
 * Extended metadata for lyrics imported from CCLI
 */
export type CCLILyricMetadataType = {
    ccliNumber?: string;
    ccliSongId?: string;
    title?: string;
    author?: string;
    copyright?: string;
    publisher?: string;
    importDate?: string;
    lastModified?: string;
};
