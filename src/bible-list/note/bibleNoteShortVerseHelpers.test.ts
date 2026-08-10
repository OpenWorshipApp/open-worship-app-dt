// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    dirSourceGetInstanceMock: vi.fn(),
    getFilePathsMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    notifyElementHighlightMock: vi.fn(),
    noteFromFilePathMock: vi.fn(),
    getAllShortVersesFromTextMock: vi.fn((_text: string): string[] => []),
}));

// the real package drags lexical/excalidraw into jsdom (canvas getContext is
// not implemented there); this also proves the on-demand import is reached
vi.mock('bible-note', () => ({
    BibleNote: {
        getAllShortVersesFromText: h.getAllShortVersesFromTextMock,
    },
}));
vi.mock('../../helper/DirSource', () => ({
    default: { getInstance: h.dirSourceGetInstanceMock },
}));
vi.mock('../../helper/FileSource', () => ({
    default: { getInstance: h.fileSourceGetInstanceMock },
}));
// the real module observes `document.body` and registers an IPC listener while
// it loads, neither of which this has anything to say about
vi.mock('../../helper/domHelpers', () => ({
    notifyElementHighlight: h.notifyElementHighlightMock,
    escapeSelectorValue: (value: string) => value,
}));
vi.mock('./Note', () => ({
    default: {
        fromFilePath: h.noteFromFilePathMock,
        mimetypeName: 'note',
    },
}));

import { dirSourceSettingNames } from '../../helper/constants';
import {
    getShortVerses,
    revealBibleNoteRefs,
    toShortVerseNoteRefs,
} from './bibleNoteShortVerseHelpers';

function setupNoteFiles(
    filePaths: string[] | null,
    jsonDataMap: Record<string, any> = {},
) {
    h.dirSourceGetInstanceMock.mockResolvedValue({
        getFilePaths: h.getFilePathsMock,
    });
    h.getFilePathsMock.mockResolvedValue(filePaths);
    h.fileSourceGetInstanceMock.mockImplementation((filePath: string) => ({
        src: `src:${filePath}`,
        name: filePath.split('/').pop()?.replace('.own', ''),
        readFileJsonData: async () => jsonDataMap[filePath] ?? null,
    }));
}

describe('bible-list/note bibleNoteShortVerseHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.getAllShortVersesFromTextMock.mockReturnValue([]);
        h.noteFromFilePathMock.mockResolvedValue(null);
        document.body.innerHTML = '';
    });

    describe('getShortVerses', () => {
        test('lists the short verses of every item of every note', async () => {
            setupNoteFiles(['/notes/a.own', '/notes/b.own'], {
                '/notes/a.own': {
                    items: [
                        { content: 'about Genesis 1:1', metadata: { id: 1 } },
                        { content: 'no verse here', metadata: { id: 2 } },
                    ],
                },
                '/notes/b.own': { items: [] },
            });
            h.getAllShortVersesFromTextMock.mockImplementation(
                (text: string) => {
                    return text.includes('Genesis 1:1') ? ['GEN 1:1'] : [];
                },
            );

            expect(await getShortVerses()).toEqual({
                '/notes/a.own': [
                    { id: 1, shortVerses: ['GEN 1:1'] },
                    { id: 2, shortVerses: [] },
                ],
                '/notes/b.own': [],
            });
            expect(h.dirSourceGetInstanceMock).toHaveBeenCalledWith(
                dirSourceSettingNames.BIBLE_NOTES,
            );
            expect(h.getFilePathsMock).toHaveBeenCalledWith('note');
        });

        test('is empty when the notes directory yields no file', async () => {
            setupNoteFiles(null);
            expect(await getShortVerses()).toEqual({});
        });

        test('tolerates unreadable and malformed note files', async () => {
            setupNoteFiles(['/notes/unreadable.own', '/notes/malformed.own'], {
                '/notes/malformed.own': { items: 'not-a-list' },
            });
            expect(await getShortVerses()).toEqual({
                '/notes/unreadable.own': [],
                '/notes/malformed.own': [],
            });
        });

        test('skips items missing their content or their id', async () => {
            setupNoteFiles(['/notes/a.own'], {
                '/notes/a.own': {
                    items: [
                        null,
                        { metadata: { id: 1 } },
                        { content: 'orphan' },
                        { content: 'kept', metadata: { id: 2 } },
                    ],
                },
            });
            h.getAllShortVersesFromTextMock.mockReturnValue(['GEN 1:1']);
            expect(await getShortVerses()).toEqual({
                '/notes/a.own': [{ id: 2, shortVerses: ['GEN 1:1'] }],
            });
            expect(h.getAllShortVersesFromTextMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('toShortVerseNoteRefs', () => {
        test('turns note -> verses inside out into verse -> notes', () => {
            expect(
                toShortVerseNoteRefs({
                    '/notes/a.own': [
                        { id: 1, shortVerses: ['GEN 1:1', 'GEN 1:2'] },
                        { id: 2, shortVerses: ['GEN 1:1'] },
                    ],
                    '/notes/b.own': [{ id: 9, shortVerses: ['GEN 1:2'] }],
                    '/notes/empty.own': [],
                }),
            ).toEqual({
                'GEN 1:1': ['/notes/a.own@1', '/notes/a.own@2'],
                'GEN 1:2': ['/notes/a.own@1', '/notes/b.own@9'],
            });
        });
    });

    describe('revealBibleNoteRefs', () => {
        function getHighlightedElements() {
            return h.notifyElementHighlightMock.mock.calls.map(
                ([elementGetter]) => elementGetter(),
            );
        }

        function setupDom() {
            h.fileSourceGetInstanceMock.mockImplementation(
                (filePath: string) => ({
                    src: `src:${filePath}`,
                    name: filePath.split('/').pop()?.replace('.own', ''),
                }),
            );
            document.body.innerHTML = `
                <div id="file-a" data-file-item-file-src="src:/notes/a.own">
                </div>
                <div id="file-b" data-file-item-file-src="src:/notes/b.own">
                </div>
                <li id="item-a-1" data-note-item-id="a-1"></li>
                <li id="item-a-2" data-note-item-id="a-2"></li>
                <li id="item-b-9" data-note-item-id="b-9"></li>
            `;
        }

        test('points at the note file and the note item of each ref', async () => {
            setupDom();
            h.noteFromFilePathMock.mockResolvedValue({ isOpened: true });

            expect(
                await revealBibleNoteRefs(['/notes/a.own@2', '/notes/b.own@9']),
            ).toBe(2);
            expect(
                getHighlightedElements().map((element) => element?.id),
            ).toEqual(['file-a', 'item-a-2', 'file-b', 'item-b-9']);
        });

        test('opens each note file once, however many items match', async () => {
            setupDom();
            h.noteFromFilePathMock.mockResolvedValue({ isOpened: true });

            expect(
                await revealBibleNoteRefs(['/notes/a.own@1', '/notes/a.own@2']),
            ).toBe(1);
            expect(h.noteFromFilePathMock).toHaveBeenCalledTimes(1);
            expect(
                getHighlightedElements().map((element) => element?.id),
            ).toEqual(['file-a', 'item-a-1', 'item-a-2']);
        });

        test('scrolls to the first file and item only', async () => {
            setupDom();
            h.noteFromFilePathMock.mockResolvedValue({ isOpened: true });

            await revealBibleNoteRefs(['/notes/a.own@1', '/notes/a.own@2']);
            const moveToViewList = h.notifyElementHighlightMock.mock.calls.map(
                ([_elementGetter, options]) => options?.moveToView,
            );
            // undefined leaves `notifyElementHighlight` to scroll it in itself
            expect(moveToViewList[0]).toBeUndefined();
            expect(moveToViewList[1]).toBeUndefined();
            expect(moveToViewList[2]).toBeInstanceOf(Function);
        });

        test('opens a collapsed note file so its items exist', async () => {
            setupDom();
            const setIsOpenedMock = vi.fn(async () => true);
            h.noteFromFilePathMock.mockResolvedValue({
                isOpened: false,
                setIsOpened: setIsOpenedMock,
            });

            await revealBibleNoteRefs(['/notes/a.own@2']);
            expect(setIsOpenedMock).toHaveBeenCalledWith(true);
        });

        test('leaves an already open note file alone', async () => {
            setupDom();
            const setIsOpenedMock = vi.fn(async () => true);
            h.noteFromFilePathMock.mockResolvedValue({
                isOpened: true,
                setIsOpened: setIsOpenedMock,
            });

            await revealBibleNoteRefs(['/notes/a.own@2']);
            expect(setIsOpenedMock).not.toHaveBeenCalled();
        });

        test('ignores refs without a usable note item id', async () => {
            setupDom();
            expect(await revealBibleNoteRefs(['', '/notes/a.own', 'x@y'])).toBe(
                0,
            );
            expect(h.notifyElementHighlightMock).not.toHaveBeenCalled();
        });

        test('keeps an id off the end of a path holding an @', async () => {
            setupDom();
            h.noteFromFilePathMock.mockResolvedValue({ isOpened: true });

            await revealBibleNoteRefs(['/note@s/a.own@2']);
            expect(h.fileSourceGetInstanceMock).toHaveBeenCalledWith(
                '/note@s/a.own',
            );
        });
    });
});
