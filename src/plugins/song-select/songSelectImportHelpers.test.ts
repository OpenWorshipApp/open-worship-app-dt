// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { SongSelectSearchRecordType } from './songSelectApiHelpers';

const state = vi.hoisted(() => ({
    existing: new Set<string>(),
    lyrics: null as null | { title: string },
    lyricsError: null as Error | null,
    markdown: '# Song' as string | null,
    created: [] as { dirPath: string; name: string; markdown: string }[],
    createResult: 'file' as 'file' | 'null',
    progress: [] as string[],
    fireUpdateEvent: vi.fn(),
    toast: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            name: filePath.split('/').pop(),
            genNextFilePath: async () =>
                state.existing.has(filePath)
                    ? filePath.replace(/\.own$/, ' (1).own')
                    : filePath,
        }),
    },
}));
vi.mock('../../lyric-list/Lyric', () => ({
    default: {
        createWithContent: async (
            dirPath: string,
            name: string,
            markdown: string,
        ) => {
            state.created.push({ dirPath, name, markdown });
            return state.createResult === 'null'
                ? null
                : { fireUpdateEvent: state.fireUpdateEvent };
        },
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    getMimetypeExtensions: () => ['own'],
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: state.toast }));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: state.handleError,
}));
vi.mock('../../progress-bar/progressBarHelpers', () => ({
    showProgressBar: (key: string) => state.progress.push(`show:${key}`),
    hideProgressBar: (key: string) => state.progress.push(`hide:${key}`),
}));
vi.mock('./songSelectApiHelpers', () => ({
    getSongLyrics: async (id: string) => {
        state.progress.push(`fetch:${id}`);
        if (state.lyricsError !== null) {
            throw state.lyricsError;
        }
        return state.lyrics;
    },
    toSongSelectErrorMessageKey: (error: Error) => `mapped: ${error.message}`,
}));
vi.mock('./songSelectLyricHelpers', () => ({
    sanitizeFileName: (name: string) => name.replaceAll(':', ''),
    songSelectLyricsToMarkdown: () => state.markdown,
}));

import { importSongSelectSongToDirectory } from './songSelectImportHelpers';

const TITLE = 'Import From SongSelect';
const record = {
    id: '7001',
    title: 'Record Title',
} as SongSelectSearchRecordType;

beforeEach(() => {
    state.existing = new Set();
    state.lyrics = { title: 'How Great: Thou Art' };
    state.lyricsError = null;
    state.markdown = '# How Great Thou Art';
    state.created = [];
    state.createResult = 'file';
    state.progress = [];
});

describe('importing a SongSelect song', () => {
    test('downloads the lyrics under the progress bar and writes a lyric document', async () => {
        const isDone = await importSongSelectSongToDirectory(
            '/data/Documents',
            record,
        );

        expect(isDone).toBe(true);
        expect(state.progress).toEqual([
            'show:song-select-import-7001',
            'fetch:7001',
            'hide:song-select-import-7001',
        ]);
        expect(state.created).toEqual([
            {
                dirPath: '/data/Documents',
                name: 'How Great Thou Art.own',
                markdown: '# How Great Thou Art',
            },
        ]);
        expect(state.fireUpdateEvent).toHaveBeenCalledOnce();
        expect(state.toast).toHaveBeenCalledWith(
            TITLE,
            'Lyric document created successfully',
        );
    });

    test('names the file after the record when the lyrics carry no title, beside an existing one', async () => {
        state.lyrics = { title: '' };
        state.existing.add('/data/Documents/Record Title.own');

        await importSongSelectSongToDirectory('/data/Documents', record);

        expect(state.created[0].name).toBe('Record Title (1).own');
    });

    test('creates nothing for a song with no lyrics', async () => {
        state.markdown = null;

        const isDone = await importSongSelectSongToDirectory(
            '/data/Documents',
            record,
        );

        expect(isDone).toBe(false);
        expect(state.created).toHaveLength(0);
        expect(state.toast).toHaveBeenCalledWith(
            TITLE,
            'This song has no lyrics to import',
        );
        expect(state.progress.at(-1)).toBe('hide:song-select-import-7001');
    });

    test('says the request failed when the document could not be written', async () => {
        state.createResult = 'null';

        const isDone = await importSongSelectSongToDirectory(
            '/data/Documents',
            record,
        );

        expect(isDone).toBe(false);
        expect(state.fireUpdateEvent).not.toHaveBeenCalled();
        expect(state.toast).toHaveBeenCalledWith(
            TITLE,
            'SongSelect request failed',
        );
    });

    test('reports a failed download in the words its error maps to and always hides the progress bar', async () => {
        state.lyricsError = new Error('401');

        const isDone = await importSongSelectSongToDirectory(
            '/data/Documents',
            record,
        );

        expect(isDone).toBe(false);
        expect(state.handleError).toHaveBeenCalledWith(state.lyricsError);
        expect(state.toast).toHaveBeenCalledWith(TITLE, 'mapped: 401');
        expect(state.progress).toEqual([
            'show:song-select-import-7001',
            'fetch:7001',
            'hide:song-select-import-7001',
        ]);
    });
});
