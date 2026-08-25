import type { AnyObjectType } from '../../helper/typeHelpers';

// Canned api.ccli.com/ss/v2 payloads served in dev when the SongSelect mock is
// enabled (see songSelectDevMockHelpers.ts). Shapes mirror the real API so the
// normal parsing in songSelectApiHelpers runs unchanged. Loaded lazily — this
// catalog never reaches memory unless the mock is actually used.

const MOCK_LATENCY_MILLISECONDS = 200;

type DevMockLyricPartType = {
    partLabel: string;
    partType: string;
    partTypeNumber?: number;
    lyrics: string;
};

type DevMockSongType = {
    id: string;
    title: string;
    songNumber: string;
    authors: string[];
    isPublicDomain: boolean;
    hasLyrics: boolean;
    isAuthorized: boolean;
    lyricsPreview: string;
    lyricParts: DevMockLyricPartType[];
};

function genSimpleLyricParts(title: string): DevMockLyricPartType[] {
    return [
        {
            partLabel: 'Verse 1',
            partType: 'Verse',
            partTypeNumber: 1,
            lyrics:
                `This is mock verse one of ${title}\n` +
                'Serving canned lyrics for the dev build\n' +
                'No CCLI account was involved\n' +
                'In the making of this song',
        },
        {
            partLabel: 'Chorus',
            partType: 'Chorus',
            lyrics:
                'Sing the mock chorus, data from the catalog\n' + `${title}`,
        },
        {
            partLabel: 'Verse 2',
            partType: 'Verse',
            partTypeNumber: 2,
            lyrics:
                'Mock verse two keeps the structure honest\n' +
                'Verse and chorus and verse again',
        },
    ];
}

export const devMockSongCatalog: DevMockSongType[] = [
    {
        id: 'mock-22025',
        title: 'Amazing Grace',
        songNumber: '22025',
        authors: ['John Newton'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Amazing grace how sweet the sound',
        lyricParts: [
            {
                partLabel: 'Verse 1',
                partType: 'Verse',
                partTypeNumber: 1,
                lyrics:
                    'Amazing grace how sweet the sound\n' +
                    'That saved a wretch like me\n' +
                    'I once was lost but now am found\n' +
                    'Was blind but now I see',
            },
            {
                partLabel: 'Verse 2',
                partType: 'Verse',
                partTypeNumber: 2,
                lyrics:
                    "'Twas grace that taught my heart to fear\n" +
                    'And grace my fears relieved\n' +
                    'How precious did that grace appear\n' +
                    'The hour I first believed',
            },
            {
                partLabel: 'Verse 3',
                partType: 'Verse',
                partTypeNumber: 3,
                lyrics:
                    'Through many dangers toils and snares\n' +
                    'I have already come\n' +
                    "'Tis grace hath brought me safe thus far\n" +
                    'And grace will lead me home',
            },
            {
                partLabel: 'Verse 4',
                partType: 'Verse',
                partTypeNumber: 4,
                lyrics:
                    "When we've been there ten thousand years\n" +
                    'Bright shining as the sun\n' +
                    "We've no less days to sing God's praise\n" +
                    "Than when we'd first begun",
            },
        ],
    },
    {
        id: 'mock-25376',
        title: 'It Is Well With My Soul',
        songNumber: '25376',
        authors: ['Horatio Spafford', 'Philip Bliss'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'When peace like a river attendeth my way',
        // Deliberately exercises the whole mapping table: numbered verses,
        // chorus, bridge, an Ending (mapped to Outro) and an unknown "Misc"
        // partType (falls back to a Breakdown fence with a comment).
        lyricParts: [
            {
                partLabel: 'Verse 1',
                partType: 'Verse',
                partTypeNumber: 1,
                lyrics:
                    'When peace like a river attendeth my way\n' +
                    'When sorrows like sea billows roll\n' +
                    'Whatever my lot Thou hast taught me to say\n' +
                    'It is well it is well with my soul',
            },
            {
                partLabel: 'Chorus',
                partType: 'Chorus',
                lyrics:
                    'It is well with my soul\n' +
                    'It is well it is well with my soul',
            },
            {
                partLabel: 'Verse 2',
                partType: 'Verse',
                partTypeNumber: 2,
                lyrics:
                    'My sin oh the bliss of this glorious thought\n' +
                    'My sin not in part but the whole\n' +
                    'Is nailed to the cross and I bear it no more\n' +
                    'Praise the Lord praise the Lord O my soul',
            },
            {
                partLabel: 'Bridge',
                partType: 'Bridge',
                partTypeNumber: 1,
                lyrics:
                    'And Lord haste the day when my faith shall be sight\n' +
                    'The clouds be rolled back as a scroll',
            },
            {
                partLabel: 'Ending',
                partType: 'Ending',
                lyrics: 'It is well with my soul',
            },
            {
                partLabel: 'Misc 1',
                partType: 'Misc',
                partTypeNumber: 1,
                lyrics: 'Repeat the chorus quietly a cappella',
            },
        ],
    },
    {
        id: 'mock-1156245',
        title: 'Holy Holy Holy',
        songNumber: '1156245',
        authors: ['Reginald Heber', 'John Dykes'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Holy holy holy Lord God Almighty',
        lyricParts: genSimpleLyricParts('Holy Holy Holy'),
    },
    {
        id: 'mock-30639',
        title: 'Be Thou My Vision',
        songNumber: '30639',
        authors: ['Traditional Irish'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Be Thou my vision O Lord of my heart',
        lyricParts: genSimpleLyricParts('Be Thou My Vision'),
    },
    {
        id: 'mock-18723',
        title: 'Great Is Thy Faithfulness',
        songNumber: '18723',
        authors: ['Thomas Chisholm', 'William Runyan'],
        isPublicDomain: false,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Great is Thy faithfulness O God my Father',
        lyricParts: genSimpleLyricParts('Great Is Thy Faithfulness'),
    },
    {
        id: 'mock-22324',
        title: 'Blessed Assurance',
        songNumber: '22324',
        authors: ['Fanny Crosby', 'Phoebe Knapp'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Blessed assurance Jesus is mine',
        lyricParts: genSimpleLyricParts('Blessed Assurance'),
    },
    {
        id: 'mock-27714',
        title: 'What A Friend We Have In Jesus',
        songNumber: '27714',
        authors: ['Joseph Scriven', 'Charles Converse'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'What a friend we have in Jesus',
        lyricParts: genSimpleLyricParts('What A Friend We Have In Jesus'),
    },
    {
        id: 'mock-108389',
        title: 'Come Thou Fount of Every Blessing',
        songNumber: '108389',
        authors: ['Robert Robinson', 'John Wyeth'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Come Thou fount of every blessing',
        lyricParts: genSimpleLyricParts('Come Thou Fount of Every Blessing'),
    },
    {
        id: 'mock-40588',
        title: 'Rock of Ages',
        songNumber: '40588',
        authors: ['Augustus Toplady', 'Thomas Hastings'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Rock of ages cleft for me',
        lyricParts: genSimpleLyricParts('Rock of Ages'),
    },
    {
        id: 'mock-14181',
        title: 'How Great Thou Art',
        songNumber: '14181',
        authors: ['Stuart K. Hine'],
        isPublicDomain: false,
        hasLyrics: true,
        // Demo of the disabled download button: lyrics exist but this fake
        // account is not licensed for them.
        isAuthorized: false,
        lyricsPreview: 'O Lord my God when I in awesome wonder',
        lyricParts: [],
    },
    {
        id: 'mock-56204',
        title: 'Doxology',
        songNumber: '56204',
        authors: ['Thomas Ken', 'Louis Bourgeois'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Praise God from whom all blessings flow',
        lyricParts: genSimpleLyricParts('Doxology'),
    },
    {
        id: 'mock-90210',
        title: 'Instrumental Reflection',
        songNumber: '90210',
        authors: ['Mock Ensemble'],
        isPublicDomain: false,
        // Demo of the other disabled state: no lyrics exist at all.
        hasLyrics: false,
        isAuthorized: true,
        lyricsPreview: '',
        lyricParts: [],
    },
    {
        id: 'mock-41067',
        title: 'Nearer My God To Thee',
        songNumber: '41067',
        authors: ['Sarah Adams', 'Lowell Mason'],
        isPublicDomain: true,
        hasLyrics: true,
        isAuthorized: true,
        lyricsPreview: 'Nearer my God to Thee nearer to Thee',
        lyricParts: genSimpleLyricParts('Nearer My God To Thee'),
    },
];

function checkIsMatchingQuery(song: DevMockSongType, query: string) {
    const haystack = `${song.title} ${song.authors.join(' ')}`.toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((token) => {
            return haystack.includes(token);
        });
}

function genSearchResponse(searchParams: URLSearchParams): AnyObjectType {
    const query = searchParams.get('filter[search]') ?? '';
    const pageNumber = Math.max(
        1,
        Number(searchParams.get('page[number]')) || 1,
    );
    const pageSize = Math.max(1, Number(searchParams.get('page[size]')) || 10);
    const matched = devMockSongCatalog.filter((song) => {
        return checkIsMatchingQuery(song, query);
    });
    const results = matched
        .slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
        .map((song) => {
            return {
                id: song.id,
                title: song.title,
                songNumber: song.songNumber,
                authors: [...song.authors],
                lyricsPreview: song.lyricsPreview,
                isPublicDomain: song.isPublicDomain,
                content: {
                    lyrics: {
                        exists: song.hasLyrics,
                        isAuthorized: song.isAuthorized,
                    },
                },
            };
        });
    return {
        pagination: {
            pageSize,
            pageNumber,
            totalItems: matched.length,
            lastPage: Math.max(1, Math.ceil(matched.length / pageSize)),
        },
        data: { results },
    };
}

function genLyricsResponse(songId: string): AnyObjectType {
    const song = devMockSongCatalog.find(({ id }) => {
        return id === songId;
    });
    const title = song?.title || 'Unknown Mock Song';
    return {
        data: {
            title,
            authors: song ? [...song.authors] : ['Mock Author'],
            copyrights: song?.isPublicDomain
                ? ['Public Domain']
                : ['© 2026 Mock Music Publishing'],
            songNumber: song?.songNumber ?? '0',
            lyricParts: song?.lyricParts.length
                ? song.lyricParts.map((part) => ({ ...part }))
                : genSimpleLyricParts(title),
        },
    };
}

export async function respondSongSelectDevMock(
    pathAndQuery: string,
): Promise<AnyObjectType> {
    // Small artificial latency so loading states are visible in dev.
    await new Promise((resolve) => {
        setTimeout(resolve, MOCK_LATENCY_MILLISECONDS);
    });
    const url = new URL(pathAndQuery, 'https://songselect.mock');
    const lyricsMatch = url.pathname.match(/^\/songs\/([^/]+)\/lyrics$/);
    if (lyricsMatch !== null) {
        return genLyricsResponse(decodeURIComponent(lyricsMatch[1]));
    }
    if (url.pathname === '/songs') {
        return genSearchResponse(url.searchParams);
    }
    throw new Error(`Unknown SongSelect mock path: ${url.pathname}`);
}
