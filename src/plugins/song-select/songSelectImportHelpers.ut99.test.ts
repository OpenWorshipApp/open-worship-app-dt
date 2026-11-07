// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// The import pipeline end to end, with every edge it crosses faked: the
// SongSelect API (no network), the open-lyric mapping (heavy, and tested on
// its own in `songSelectLyricHelpers.test.ts`), the file system behind
// `FileSource`, and `Lyric.createWithContent` (no file is written).
const { mocks } = vi.hoisted(() => ({
    mocks: {
        getSongLyrics: vi.fn(),
        songSelectLyricsToMarkdown: vi.fn(),
        createWithContent: vi.fn(),
        genNextFilePath: vi.fn(),
        showProgressBar: vi.fn(),
        hideProgressBar: vi.fn(),
        showSimpleToast: vi.fn(),
        handleError: vi.fn(),
    },
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            // The base name without its extension, as `FileSource.name` is.
            name: filePath
                .split('/')
                .at(-1)!
                .replace(/\.[^.]+$/, ''),
            genNextFilePath: () => mocks.genNextFilePath(filePath),
        }),
    },
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: (...args: any[]) => mocks.handleError(...args),
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../server/fileHelpers', () => ({
    getMimetypeExtensions: (mimetypeName: string) => {
        return mimetypeName === 'lyric' ? ['owl'] : [];
    },
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../../progress-bar/progressBarHelpers', () => ({
    showProgressBar: (...args: any[]) => mocks.showProgressBar(...args),
    hideProgressBar: (...args: any[]) => mocks.hideProgressBar(...args),
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: (...args: any[]) => mocks.showSimpleToast(...args),
}));
vi.mock('./songSelectApiHelpers', () => ({
    getSongLyrics: (...args: any[]) => mocks.getSongLyrics(...args),
    toSongSelectErrorMessageKey: (error: any) => {
        return error?.message === 'unauthorized'
            ? 'SongSelect sign-in expired, please sign in again in Settings'
            : 'SongSelect request failed';
    },
}));
vi.mock('./songSelectLyricHelpers', () => ({
    sanitizeFileName: (name: string) => {
        return name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'SongSelect Song';
    },
    songSelectLyricsToMarkdown: (...args: any[]) => {
        return mocks.songSelectLyricsToMarkdown(...args);
    },
}));
vi.mock('../../lyric-list/Lyric', () => ({
    default: {
        createWithContent: (...args: any[]) => mocks.createWithContent(...args),
    },
}));

import { importSongSelectSongToDirectory } from './songSelectImportHelpers';

const TITLE = 'Import From SongSelect';
const MARKDOWN = '# Amazing Grace\n\n```ol:Verse 1\nAmazing grace\n```\n';
const RECORD = {
    id: '22025',
    title: 'Amazing Grace (My Chains Are Gone)',
    songNumber: '4768151',
    authors: ['Chris Tomlin', 'John Newton'],
    lyricsPreview: 'Amazing grace how sweet the sound',
    isPublicDomain: false,
    hasLyrics: true,
    isAuthorized: true,
};

function genLyricsData(title: string) {
    return {
        title,
        authors: RECORD.authors,
        copyrights: ['Public Domain'],
        songNumber: RECORD.songNumber,
        lyricParts: [
            {
                partLabel: 'Verse 1',
                partType: 'verse',
                partTypeNumber: 1,
                lyrics: 'Amazing grace',
            },
        ],
    };
}

let fireUpdateEvent: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fireUpdateEvent = vi.fn();
    mocks.getSongLyrics.mockResolvedValue(genLyricsData('Amazing Grace'));
    mocks.songSelectLyricsToMarkdown.mockReturnValue(MARKDOWN);
    // One song of that name is already in the folder.
    mocks.genNextFilePath.mockImplementation(async (filePath: string) => {
        return filePath.replace(/\.owl$/, ' (1).owl');
    });
    mocks.createWithContent.mockImplementation(async () => {
        return { fireUpdateEvent };
    });
});

describe('importSongSelectSongToDirectory', () => {
    test('a song is downloaded, written under a free name and announced', async () => {
        await expect(
            importSongSelectSongToDirectory('/songs', RECORD),
        ).resolves.toBe(true);
        expect(mocks.getSongLyrics).toHaveBeenCalledExactlyOnceWith('22025');
        expect(mocks.songSelectLyricsToMarkdown).toHaveBeenCalledWith(
            genLyricsData('Amazing Grace'),
        );
        // The lyrics' own title names the file, next to the one already there.
        expect(mocks.genNextFilePath).toHaveBeenCalledExactlyOnceWith(
            '/songs/Amazing Grace.owl',
        );
        expect(mocks.createWithContent).toHaveBeenCalledExactlyOnceWith(
            '/songs',
            'Amazing Grace (1)',
            MARKDOWN,
        );
        // The list shows the new file at once.
        expect(fireUpdateEvent).toHaveBeenCalledTimes(1);
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            TITLE,
            'Lyric document created successfully',
        );
        expect(mocks.showProgressBar).toHaveBeenCalledExactlyOnceWith(
            'song-select-import-22025',
        );
        expect(mocks.hideProgressBar).toHaveBeenCalledExactlyOnceWith(
            'song-select-import-22025',
        );
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('the search record names the file when the lyrics carry no title', async () => {
        mocks.getSongLyrics.mockResolvedValue(genLyricsData(''));
        await importSongSelectSongToDirectory('/songs', RECORD);
        expect(mocks.genNextFilePath).toHaveBeenCalledWith(
            '/songs/Amazing Grace (My Chains Are Gone).owl',
        );
        expect(mocks.createWithContent).toHaveBeenCalledWith(
            '/songs',
            'Amazing Grace (My Chains Are Gone) (1)',
            MARKDOWN,
        );
    });

    test('a song with no lyrics is refused before anything is written', async () => {
        mocks.songSelectLyricsToMarkdown.mockReturnValue(null);
        await expect(
            importSongSelectSongToDirectory('/songs', RECORD),
        ).resolves.toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            TITLE,
            'This song has no lyrics to import',
        );
        expect(mocks.genNextFilePath).not.toHaveBeenCalled();
        expect(mocks.createWithContent).not.toHaveBeenCalled();
        expect(mocks.hideProgressBar).toHaveBeenCalledWith(
            'song-select-import-22025',
        );
    });

    test('a file that could not be created is not announced as created', async () => {
        mocks.createWithContent.mockResolvedValue(null);
        await expect(
            importSongSelectSongToDirectory('/songs', RECORD),
        ).resolves.toBe(false);
        expect(fireUpdateEvent).not.toHaveBeenCalled();
        // The download worked and the WRITE failed, so it says that -- as the
        // public-domain import does. It said "SongSelect request failed"
        // (found by UT-85, 2026-11-03).
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            TITLE,
            'Failed to create lyric document',
        );
        expect(mocks.hideProgressBar).toHaveBeenCalledTimes(1);
    });

    test('a failed download is reported in its own words and the bar still goes', async () => {
        const error = new Error('unauthorized');
        mocks.getSongLyrics.mockRejectedValue(error);
        await expect(
            importSongSelectSongToDirectory('/songs', RECORD),
        ).resolves.toBe(false);
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            TITLE,
            'SongSelect sign-in expired, please sign in again in Settings',
        );
        expect(mocks.songSelectLyricsToMarkdown).not.toHaveBeenCalled();
        expect(mocks.createWithContent).not.toHaveBeenCalled();
        expect(mocks.hideProgressBar).toHaveBeenCalledExactlyOnceWith(
            'song-select-import-22025',
        );
    });
});
