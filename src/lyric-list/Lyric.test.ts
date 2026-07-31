import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    createNewFileDetailMock,
    deleteMetaDataFileMock,
    editingHistoryGetInstanceMock,
    fileSourceGetInstanceMock,
    getMimetypeExtensionsMock,
    handleErrorMock,
} = vi.hoisted(() => ({
    createNewFileDetailMock: vi.fn(),
    deleteMetaDataFileMock: vi.fn(),
    editingHistoryGetInstanceMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(),
    handleErrorMock: vi.fn(),
}));

vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: { getInstance: editingHistoryGetInstanceMock },
}));

vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { deleteMetaDataFile: deleteMetaDataFileMock },
}));

vi.mock('../server/fileHelpers', () => ({
    createNewFileDetail: createNewFileDetailMock,
    getMimetypeExtensions: getMimetypeExtensionsMock,
}));

vi.mock('../helper/errorHelpers', () => ({ handleError: handleErrorMock }));

vi.mock('../helper/FileSource', () => ({
    default: { getInstance: fileSourceGetInstanceMock },
}));

import Lyric from './Lyric';

function createHistoryManager() {
    let currentHistory: string | null = null;
    return {
        __setCurrentHistory(value: string | null) {
            currentHistory = value;
        },
        getOriginalData: vi.fn(async () => currentHistory),
        getCurrentHistory: vi.fn(async () => currentHistory),
        addHistory: vi.fn((value: string) => {
            currentHistory = value;
        }),
        save: vi.fn(async () => true),
        discard: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
    };
}

const historyManagers = new Map<
    string,
    ReturnType<typeof createHistoryManager>
>();

function getHistoryManager(filePath: string) {
    if (!historyManagers.has(filePath)) {
        historyManagers.set(filePath, createHistoryManager());
    }
    return historyManagers.get(filePath)!;
}

describe('Lyric', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        historyManagers.clear();
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

    test('rejects data without lyric content', () => {
        const metadata = Lyric.getDefaultContentJsonData().metadata;

        expect(() => {
            Lyric.validate({ metadata, content: 'l1: line' });
        }).not.toThrow();
        expect(() => {
            Lyric.validate({ metadata });
        }).toThrow(/Invalid lyric data json/);
    });

    test('a new lyric starts from the default chord sheet', async () => {
        const defaultJsonData = Lyric.getDefaultContentJsonData();

        expect(defaultJsonData.content).toContain('c1:');
        expect(defaultJsonData.metadata.app).toBeTypeOf('string');

        await expect(Lyric.create('/docs', 'song')).resolves.toEqual(
            expect.objectContaining({ filePath: '/docs/new.lyric' }),
        );
        // compare the parsed payload, not the serialized string: `initDate` is
        // stamped from `new Date()` on every call, so the two default json
        // objects differ whenever the millisecond ticks between them
        expect(createNewFileDetailMock).toHaveBeenCalledWith(
            '/docs',
            'song',
            expect.any(String),
            'lyric',
        );
        const [, , dataText] = createNewFileDetailMock.mock.calls[0];
        expect(JSON.parse(dataText)).toEqual({
            ...defaultJsonData,
            metadata: {
                ...defaultJsonData.metadata,
                initDate: expect.any(String),
            },
        });
    });

    test('reads and writes the lyric body through the history', async () => {
        const filePath = '/docs/song.lyric';
        const lyric = Lyric.getInstance(filePath);
        expect(Lyric.getInstance(filePath)).toBe(lyric);

        // nothing saved yet: an empty body and the default metadata
        await expect(lyric.getContent()).resolves.toBe('');
        await expect(lyric.getMetadata()).resolves.toEqual({
            app: 'open-worship',
            fileVersion: 1,
            initDate: '',
        });

        const metadata = Lyric.getDefaultContentJsonData().metadata;
        getHistoryManager(filePath).__setCurrentHistory(
            JSON.stringify({ metadata, content: 'l1: first line' }),
        );

        await expect(lyric.getContent()).resolves.toBe('l1: first line');
        await expect(lyric.getMetadata()).resolves.toEqual(metadata);

        await lyric.setContent('l1: second line');
        await expect(lyric.getContent()).resolves.toBe('l1: second line');
    });

    test('setting content on an unreadable lyric is a no-op', async () => {
        const lyric = Lyric.getInstance('/docs/broken.lyric');
        const historyManager = getHistoryManager('/docs/broken.lyric');

        await lyric.setContent('l1: ignored');

        expect(historyManager.addHistory).not.toHaveBeenCalled();
    });

    test('saving writes the current history verbatim', async () => {
        const filePath = '/docs/save.lyric';
        const lyric = Lyric.getInstance(filePath);
        const historyManager = getHistoryManager(filePath);

        await expect(lyric.save()).resolves.toBe(true);

        const [sanitize] = historyManager.save.mock.calls[0] as unknown as [
            (dataText: string) => string,
        ];
        expect(sanitize('{"content":"kept"}')).toBe('{"content":"kept"}');
    });
});
