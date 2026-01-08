/**
 * CCLI API Service Layer
 * 
 * Handles communication with CCLI SongSelect API for searching
 * and retrieving licensed worship song lyrics.
 */

import { handleError } from '../../helper/errorHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    CCLISongType,
    CCLISearchResultType,
    CCLISearchParamsType,
    CCLICredentialsType,
} from './ccliTypes';
import { getSetting } from '../../helper/settingHelpers';

// const CCLI_API_BASE_URL = 'https://songselect.ccli.com/api'; // For future API implementation
const CCLI_SETTINGS_KEY = 'ccli-credentials';

/**
 * Get stored CCLI credentials from settings
 */
export async function getCCLICredentials(): Promise<CCLICredentialsType | null> {
    try {
        const credentials = await getSetting(CCLI_SETTINGS_KEY);
        if (!credentials) {
            return null;
        }
        // Parse if it's a string, otherwise assume it's already an object
        if (typeof credentials === 'string') {
            return JSON.parse(credentials);
        }
        return credentials as CCLICredentialsType;
    } catch (error) {
        handleError(error);
        return null;
    }
}

/**
 * Check if CCLI credentials are configured
 */
export async function hasCCLICredentials(): Promise<boolean> {
    const credentials = await getCCLICredentials();

    // In developer mode (useMockData), credentials are optional according to the UI.
    // If we have settings and mock mode is enabled, treat credentials as present.
    if (credentials && credentials.useMockData) {
        return true;
    }

    // For real API usage, require both subscriptionId and apiKey to be non-empty.
    return credentials !== null &&
           !!credentials.subscriptionId &&
           credentials.subscriptionId.length > 0 &&
           !!credentials.apiKey &&
           credentials.apiKey.length > 0;
}

/**
 * Search for songs in CCLI SongSelect
 * 
 * Supports both mock data (developer mode) and real API integration.
 */
export async function searchCCLISongs(
    params: CCLISearchParamsType,
): Promise<CCLISearchResultType | null> {
    try {
        const credentials = await getCCLICredentials();
        
        if (!credentials) {
            showSimpleToast(
                'CCLI Authentication',
                'Please configure CCLI credentials in Settings',
            );
            return null;
        }

        // Use mock data in developer mode
        if (credentials.useMockData) {
            const mockResults: CCLISearchResultType = {
                songs: getMockSongs(params.query || ''),
                totalResults: getMockSongs(params.query || '').length,
                page: params.page || 1,
                pageSize: params.pageSize || 20,
            };
            return mockResults;
        }

        // Real API integration (to be implemented)
        // TODO: Implement actual CCLI API calls
        return await searchCCLIAPIReal(credentials, params);
    } catch (error) {
        handleError(error);
        showSimpleToast('CCLI Search Error', 'Failed to search CCLI songs');
        return null;
    }
}

/**
 * Get detailed song information including lyrics
 */
export async function getCCLISongDetails(
    songId: string,
): Promise<CCLISongType | null> {
    try {
        const credentials = await getCCLICredentials();
        
        if (!credentials) {
            return null;
        }

        // Use mock data in developer mode
        if (credentials.useMockData) {
            const mockSong = getMockSongDetails(songId);
            return mockSong;
        }

        // Real API integration (to be implemented)
        // TODO: Implement actual CCLI API call
        return await getCCLISongDetailsAPIReal(credentials, songId);
    } catch (error) {
        handleError(error);
        return null;
    }
}

/**
 * Mock data for development (remove when implementing actual API)
 */
function getMockSongs(query: string): CCLISongType[] {
    const allSongs: CCLISongType[] = [
        {
            songId: '7011306',
            title: 'Amazing Grace (My Chains Are Gone)',
            author: 'Chris Tomlin, John Newton, Louie Giglio',
            copyright: '© 2006 sixsteps Music',
            ccliNumber: '4768151',
            themes: ['Grace', 'Freedom', 'Redemption'],
            keys: ['G', 'A'],
            tempo: 'Mid-tempo',
            timeSignature: '3/4',
        },
        {
            songId: '7036288',
            title: '10,000 Reasons (Bless The Lord)',
            author: 'Jonas Myrin, Matt Redman',
            copyright: '© 2011 Atlas Mountain Songs',
            ccliNumber: '6016351',
            themes: ['Worship', 'Praise', 'Blessing'],
            keys: ['C', 'D'],
            tempo: 'Mid-tempo',
            timeSignature: '4/4',
        },
        {
            songId: '6127919',
            title: 'How Great Is Our God',
            author: 'Chris Tomlin, Ed Cash, Jesse Reeves',
            copyright: '© 2004 sixsteps Music',
            ccliNumber: '4348399',
            themes: ['Greatness of God', 'Worship', 'Majesty'],
            keys: ['C', 'D', 'E'],
            tempo: 'Moderate',
            timeSignature: '4/4',
        },
    ];

    if (!query) {
        return allSongs;
    }

    const lowerQuery = query.toLowerCase();
    return allSongs.filter(
        (song) =>
            song.title.toLowerCase().includes(lowerQuery) ||
            song.author.toLowerCase().includes(lowerQuery) ||
            song.ccliNumber.includes(query),
    );
}

function getMockSongDetails(songId: string): CCLISongType | null {
    const mockLyrics: { [key: string]: string } = {
        '7011306': '[Sample lyrics for Amazing Grace - full lyrics available with API]',
        '7036288': '[Sample lyrics for 10,000 Reasons - full lyrics available with API]',
        '6127919': '[Sample lyrics for How Great Is Our God - full lyrics available with API]',
    };

    const mockSong = getMockSongs('').find((s) => s.songId === songId);
    if (!mockSong) {
        return null;
    }

    return {
        ...mockSong,
        lyrics: mockLyrics[songId] || '',
        verseOrder: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus'],
    };
}

/**
 * Real CCLI API implementation for searching songs
 * Uses CCLI SongSelect API v2
 */
async function searchCCLIAPIReal(
    credentials: CCLICredentialsType,
    params: CCLISearchParamsType,
): Promise<CCLISearchResultType | null> {
    try {
        const baseUrl = 'https://api.ccli.com/v2';
        const searchParams = new URLSearchParams();
        
        // Build query parameters
        if (params.query) {
            searchParams.append('query', params.query);
        }
        if (params.title) {
            searchParams.append('title', params.title);
        }
        if (params.author) {
            searchParams.append('author', params.author);
        }
        if (params.ccliNumber) {
            searchParams.append('ccli_number', params.ccliNumber);
        }
        if (params.page) {
            searchParams.append('page', params.page.toString());
        }
        if (params.pageSize) {
            searchParams.append('page_size', params.pageSize.toString());
        }

        const url = `${baseUrl}/songs/search?${searchParams.toString()}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${credentials.apiKey}`,
                'X-CCLI-Subscription-Id': credentials.subscriptionId,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                showSimpleToast(
                    'Authentication Failed',
                    'Invalid CCLI credentials. Please check your Subscription ID and API Key.',
                );
                return null;
            } else if (response.status === 403) {
                showSimpleToast(
                    'Access Denied',
                    'Your subscription does not have API access enabled.',
                );
                return null;
            } else if (response.status === 429) {
                showSimpleToast(
                    'Rate Limit Exceeded',
                    'Too many requests. Please wait a moment and try again.',
                );
                return null;
            }
            
            throw new Error(`CCLI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Transform API response to our format
        const songs: CCLISongType[] = (data.songs || []).map((apiSong: any) => ({
            songId: apiSong.song_id?.toString() || apiSong.id?.toString() || '',
            title: apiSong.title || 'Untitled',
            author: apiSong.author || (apiSong.authors || []).join(', '),
            ccliNumber: apiSong.ccli_number || apiSong.song_number || '',
            copyright: apiSong.copyright || '',
            publisher: apiSong.publisher || '',
            themes: apiSong.themes || [],
            keys: apiSong.keys || [],
            tempo: apiSong.tempo,
            timeSignature: apiSong.time_signature || '',
            lyrics: apiSong.lyrics || undefined,
        }));

        return {
            songs,
            totalResults: data.total || songs.length,
            page: data.page || params.page || 1,
            pageSize: data.page_size || params.pageSize || 20,
        };
    } catch (error) {
        handleError(error);
        showSimpleToast(
            'Search Failed',
            'Failed to search CCLI songs. Please check your internet connection and credentials.',
        );
        return null;
    }
}

/**
 * Real CCLI API implementation for fetching song details with lyrics
 */
async function getCCLISongDetailsAPIReal(
    credentials: CCLICredentialsType,
    songId: string,
): Promise<CCLISongType | null> {
    try {
        const baseUrl = 'https://api.ccli.com/v2';
        const url = `${baseUrl}/songs/${songId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${credentials.apiKey}`,
                'X-CCLI-Subscription-Id': credentials.subscriptionId,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                showSimpleToast(
                    'Authentication Failed',
                    'Invalid CCLI credentials.',
                );
                return null;
            } else if (response.status === 404) {
                showSimpleToast(
                    'Song Not Found',
                    `Song with ID ${songId} not found.`,
                );
                return null;
            } else if (response.status === 429) {
                showSimpleToast(
                    'Rate Limit Exceeded',
                    'Too many requests. Please wait a moment and try again.',
                );
                return null;
            }
            
            throw new Error(`CCLI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Transform API response to our format
        const song: CCLISongType = {
            songId: data.song_id?.toString() || data.id?.toString() || '',
            title: data.title || 'Untitled',
            author: data.author || (data.authors || []).join(', '),
            ccliNumber: data.ccli_number || data.song_number || '',
            copyright: data.copyright || '',
            publisher: data.publisher || '',
            themes: data.themes || [],
            keys: data.keys || [],
            tempo: data.tempo,
            timeSignature: data.time_signature || '',
            lyrics: data.lyrics || '',
            verseOrder: data.verse_order || [],
        };

        return song;
    } catch (error) {
        handleError(error);
        showSimpleToast(
            'Failed to Load Song',
            'Could not retrieve song details from CCLI.',
        );
        return null;
    }
}
