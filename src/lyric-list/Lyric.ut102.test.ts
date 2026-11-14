// @vitest-environment jsdom
//
// A song's own stage setting (its font, kept in the `.owl` file beside
// `content`): read and written through the editing history, validated on
// the way in, remembered for the stages that peek at it, and read through
// the reader `Lyric.ts` registers when it loads. The history, the file
// source and open-lyric are stood in for, as in the sibling suite.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    createNewFileDetailMock,
    editingHistoryGetInstanceMock,
    fileSourceGetInstanceMock,
    getMimetypeExtensionsMock,
    handleErrorMock,
} = vi.hoisted(() => ({
    createNewFileDetailMock: vi.fn(),
    editingHistoryGetInstanceMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(),
    handleErrorMock: vi.fn(),
}));

vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: { getInstance: editingHistoryGetInstanceMock },
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { deleteMetaDataFile: vi.fn() },
}));
vi.mock('../server/fileHelpers', () => ({
    createNewFileDetail: createNewFileDetailMock,
    getMimetypeExtensions: getMimetypeExtensionsMock,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: handleErrorMock }));
// Only the example chord sheet is read off `open-lyric` (browser-only).
vi.mock('open-lyric', () => ({
    MARCH_OF_GRACE_EXAMPLE: 'c1: mocked chord sheet',
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: fileSourceGetInstanceMock },
}));

import Lyric from './Lyric';
import {
    ensureLyricStageSetting,
    peekLyricSongFontFamily,
    resetLyricStageSettingMemo,
} from './lyricSongStageSettingHelpers';

type HistoryManagerType = {
    current: string | null;
    getOriginalData: () => Promise<string | null>;
    getCurrentHistory: () => Promise<string | null>;
    addHistory: (value: string) => void;
    addedList: string[];
};

const historyManagers = new Map<string, HistoryManagerType>();

function getHistoryManager(filePath: string) {
    let manager = historyManagers.get(filePath);
    if (manager === undefined) {
        const created: HistoryManagerType = {
            current: null,
            addedList: [],
            getOriginalData: async () => {
                return created.current;
            },
            getCurrentHistory: async () => {
                return created.current;
            },
            addHistory: (value: string) => {
                created.addedList.push(value);
                created.current = value;
            },
        };
        manager = created;
        historyManagers.set(filePath, manager);
    }
    return manager;
}

function putSong(filePath: string, extra: Record<string, unknown> = {}) {
    getHistoryManager(filePath).current = JSON.stringify({
        metadata: Lyric.getDefaultContentJsonData().metadata,
        content: 'v1: Amazing grace',
        ...extra,
    });
}

function readSong(filePath: string) {
    return JSON.parse(getHistoryManager(filePath).current ?? 'null');
}

beforeEach(() => {
    historyManagers.clear();
    resetLyricStageSettingMemo();
    getMimetypeExtensionsMock.mockReturnValue(['lyric']);
    fileSourceGetInstanceMock.mockImplementation((filePath: string) => ({
        filePath,
        fullName: filePath.split('/').at(-1) ?? filePath,
        extension: 'lyric',
    }));
    editingHistoryGetInstanceMock.mockImplementation((filePath: string) => {
        return getHistoryManager(filePath);
    });
    createNewFileDetailMock.mockResolvedValue('/docs/new.lyric');
});

describe('getStageSetting', () => {
    test("reads the song's own font, checked", async () => {
        putSong('/docs/a.lyric', { stageSetting: { fontFamily: 'Body Face' } });
        await expect(
            Lyric.getInstance('/docs/a.lyric').getStageSetting(),
        ).resolves.toEqual({ fontFamily: 'Body Face' });
    });

    test('a font that could not be a family name is no setting', async () => {
        putSong('/docs/b.lyric', {
            stageSetting: { fontFamily: 'Body; color: red' },
        });
        await expect(
            Lyric.getInstance('/docs/b.lyric').getStageSetting(),
        ).resolves.toBeNull();
    });

    test('a song with none, or one that cannot be read, has none', async () => {
        putSong('/docs/c.lyric');
        await expect(
            Lyric.getInstance('/docs/c.lyric').getStageSetting(),
        ).resolves.toBeNull();
        await expect(
            Lyric.getInstance('/docs/missing.lyric').getStageSetting(),
        ).resolves.toBeNull();
    });
});

describe('setStageSetting', () => {
    test('writes the font through the history, cleaned, and remembers it', async () => {
        const filePath = '/docs/set.lyric';
        putSong(filePath);
        const lyric = Lyric.getInstance(filePath);
        await lyric.setStageSetting({ fontFamily: '  "Body   Face" ' });
        const manager = getHistoryManager(filePath);
        expect(manager.addedList).toHaveLength(1);
        expect(readSong(filePath)).toMatchObject({
            content: 'v1: Amazing grace',
            stageSetting: { fontFamily: 'Body Face' },
        });
        // The stages need not read the file again after a write.
        expect(peekLyricSongFontFamily(filePath)).toBe('Body Face');
        await expect(lyric.getStageSetting()).resolves.toEqual({
            fontFamily: 'Body Face',
        });
    });

    test("null takes the song's own setting out of the file", async () => {
        const filePath = '/docs/clear.lyric';
        putSong(filePath, { stageSetting: { fontFamily: 'Body Face' } });
        const lyric = Lyric.getInstance(filePath);
        await lyric.setStageSetting(null);
        const song = readSong(filePath);
        expect('stageSetting' in song).toBe(false);
        expect(song.content).toBe('v1: Amazing grace');
        expect(peekLyricSongFontFamily(filePath)).toBeNull();
    });

    test('a font that is no family name is taken out the same way', async () => {
        const filePath = '/docs/bad.lyric';
        putSong(filePath, { stageSetting: { fontFamily: 'Body Face' } });
        await Lyric.getInstance(filePath).setStageSetting({
            fontFamily: 'x}{body',
        });
        expect('stageSetting' in readSong(filePath)).toBe(false);
        expect(peekLyricSongFontFamily(filePath)).toBeNull();
    });

    test('a song that cannot be read is left alone, and nothing is remembered', async () => {
        const filePath = '/docs/unread.lyric';
        await Lyric.getInstance(filePath).setStageSetting({
            fontFamily: 'Body Face',
        });
        expect(getHistoryManager(filePath).addedList).toEqual([]);
        expect(peekLyricSongFontFamily(filePath)).toBeNull();
    });
});

describe('createWithContent', () => {
    test('a song created with its font carries it in the same write', async () => {
        await Lyric.createWithContent('/docs', 'Grace', 'v1: Amazing grace', {
            fontFamily: 'Body Face',
        });
        const [, , dataText] = createNewFileDetailMock.mock.calls[0];
        const jsonData = JSON.parse(dataText);
        expect(jsonData.content).toBe('v1: Amazing grace');
        expect(jsonData.stageSetting).toEqual({ fontFamily: 'Body Face' });
        // Never through the editing history.
        expect(historyManagers.size).toBe(0);
    });

    test('a font that is no family name is not written at all', async () => {
        await Lyric.createWithContent('/docs', 'Grace', 'v1: Amazing grace', {
            fontFamily: 'Body; }',
        });
        const [, , dataText] = createNewFileDetailMock.mock.calls[0];
        expect('stageSetting' in JSON.parse(dataText)).toBe(false);
    });
});

describe('the reader Lyric registers for the stages', () => {
    test("the stages read a song's own font through it", async () => {
        const filePath = '/docs/stage.lyric';
        putSong(filePath, { stageSetting: { fontFamily: 'Song Face' } });
        await expect(ensureLyricStageSetting(filePath)).resolves.toBe(
            'Song Face',
        );
        expect(peekLyricSongFontFamily(filePath)).toBe('Song Face');
    });

    test('a song with no font of its own reads as none', async () => {
        const filePath = '/docs/plain.lyric';
        putSong(filePath);
        await expect(ensureLyricStageSetting(filePath)).resolves.toBeNull();
    });
});
