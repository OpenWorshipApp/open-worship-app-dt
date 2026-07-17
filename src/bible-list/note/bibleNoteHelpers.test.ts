// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getDirPathBySettingNameMock: vi.fn(),
    getParamFileFullNameMock: vi.fn(),
    getParamIdNumMock: vi.fn(),
    handleErrorMock: vi.fn(),
    sendDataMock: vi.fn(),
    watchMock: vi.fn(),
    homeGetItemMock: vi.fn(),
    homeSetItemMock: vi.fn(),
    homeRemoveItemMock: vi.fn(),
    pathJoinMock: vi.fn((...p: string[]) => p.join('/')),
    pathResolveMock: vi.fn((p: string) => `/abs/${p}`),
    fsExistSyncMock: vi.fn(() => true),
    getAppFilePathFromFileMock: vi.fn(),
    noteFromFilePathMock: vi.fn(),
    getAllLangsAsyncMock: vi.fn(),
    getCurrentLocaleMock: vi.fn(() => 'en'),
    initLangCssMock: vi.fn(),
    showFileOrDirExplorerMock: vi.fn(),
    genTimeoutAttemptMock: vi.fn(() => (fn: any) => fn()),
    bibleItemFromTitleTextMock: vi.fn(),
    showBibleKeyOptionMock: vi.fn(),
    getSettingMock: vi.fn(),
    setSettingMock: vi.fn(),
    getBibleFontFamilyMock: vi.fn(async () => 'FontFam'),
}));

vi.mock('../../helper/DirSource', () => ({
    default: { getDirPathBySettingName: h.getDirPathBySettingNameMock },
}));
vi.mock('../../helper/domHelpers', () => ({
    getParamFileFullName: h.getParamFileFullNameMock,
    getParamIdNum: h.getParamIdNumMock,
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: h.handleErrorMock,
}));
vi.mock('../../server/appProvider', () => ({
    default: {
        windowTitle: 'OWA',
        messageUtils: { sendData: h.sendDataMock },
        fileUtils: { watch: h.watchMock },
    },
}));
vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: h.homeGetItemMock,
        setItem: h.homeSetItemMock,
        removeItem: h.homeRemoveItemMock,
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    pathJoin: h.pathJoinMock,
    pathResolve: h.pathResolveMock,
    fsExistSync: h.fsExistSyncMock,
}));
vi.mock('../../helper/localFileHelpers', () => ({
    getAppFilePathFromFile: h.getAppFilePathFromFileMock,
}));
vi.mock('./Note', () => ({
    default: { fromFilePath: h.noteFromFilePathMock },
}));
vi.mock('../../lang/langHelpers', () => ({
    getAllLangsAsync: h.getAllLangsAsyncMock,
    getCurrentLocale: h.getCurrentLocaleMock,
    initLangCss: h.initLangCssMock,
}));
vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: h.showFileOrDirExplorerMock,
}));
vi.mock('../../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: h.genTimeoutAttemptMock,
}));
vi.mock('../BibleItem', () => ({
    default: { fromTitleText: h.bibleItemFromTitleTextMock },
}));
vi.mock('../../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: h.showBibleKeyOptionMock,
}));
vi.mock('../../helper/settingHelpers', () => ({
    getSetting: h.getSettingMock,
    setSetting: h.setSettingMock,
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: h.getBibleFontFamilyMock,
}));

import {
    BIBLE_KEY_SETTING_NAME,
    getBibleNoteConstructor,
    getBibleNoteData,
    getBibleNoteSelectedBibleKey,
    initBibleNote,
} from './bibleNoteHelpers';

async function flush() {
    await new Promise((r) => setTimeout(r, 5));
}

describe('bible-list/note bibleNoteHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.genTimeoutAttemptMock.mockReturnValue((fn: any) => fn());
        h.fsExistSyncMock.mockReturnValue(true);
        h.pathJoinMock.mockImplementation((...p: string[]) => p.join('/'));
        h.pathResolveMock.mockImplementation((p: string) => `/abs/${p}`);
        h.getBibleFontFamilyMock.mockResolvedValue('FontFam');
    });

    afterEach(() => {
        delete (globalThis as any).AppBibleNote;
    });

    test('getBibleNoteSelectedBibleKey falls back to KJV', () => {
        h.getSettingMock.mockReturnValue(null);
        expect(getBibleNoteSelectedBibleKey()).toBe('KJV');
        expect(h.getSettingMock).toHaveBeenCalledWith(BIBLE_KEY_SETTING_NAME);
        h.getSettingMock.mockReturnValue('ESV');
        expect(getBibleNoteSelectedBibleKey()).toBe('ESV');
    });

    test('getBibleNoteConstructor waits for the global constructor', async () => {
        class Fake {}
        (globalThis as any).AppBibleNote = Fake;
        expect(await getBibleNoteConstructor()).toBe(Fake);
    });

    test('getBibleNoteConstructor polls until the constructor appears', async () => {
        class Fake {}
        setTimeout(() => {
            (globalThis as any).AppBibleNote = Fake;
        }, 120);
        expect(await getBibleNoteConstructor()).toBe(Fake);
    });

    describe('initBibleNote', () => {
        let capturedConfig: any;
        let capturedWatchCb: any;

        class FakeBibleNote {
            _content = 'stored';
            isFocusing = false;
            constructor(config: any) {
                capturedConfig = config;
            }
            getIsFocusing() {
                return this.isFocusing;
            }
            get content() {
                return this._content;
            }
            set content(v: string) {
                this._content = v;
            }
        }

        function genNoteItem(overrides: any = {}) {
            return {
                id: 7,
                title: 'Note Title',
                content: 'note content',
                ...overrides,
            };
        }

        async function setupInit(noteItem = genNoteItem()) {
            (globalThis as any).AppBibleNote = FakeBibleNote;
            h.getAllLangsAsyncMock.mockResolvedValue([
                {
                    locale: 'en',
                    langCode: 'en',
                    checkIsThisLang: () => false,
                },
                {
                    locale: 'km',
                    langCode: 'km',
                    fontFamily: 'KhmerFont',
                    stickyNoteFontFamily: 'KhmerSticky',
                    checkIsThisLang: (t: string) => t.includes('x'),
                },
            ]);
            h.getCurrentLocaleMock.mockReturnValue('en');
            h.watchMock.mockImplementation((_p: any, _o: any, cb: any) => {
                capturedWatchCb = cb;
            });
            const note = {
                filePath: '/notes/a.note',
                reload: vi.fn(async () => {}),
                getItemById: vi.fn(() => ({ id: 7, content: 'reloaded' })),
                updateAndSaveNoteItem: vi.fn(async () => true),
            };
            const bibleNote = await initBibleNote({
                note: note as any,
                noteItem: noteItem as any,
            });
            return { note, bibleNote, noteItem };
        }

        test('builds the bible note and initializes non-current langs', async () => {
            await setupInit();
            expect(capturedConfig).toBeDefined();
            // only the non-current locale gets initLangCss
            expect(h.initLangCssMock).toHaveBeenCalledTimes(1);
            expect(capturedConfig.editorExtraFontFamilies).toEqual([
                ['KhmerFont', 'km'],
            ]);
            expect(capturedConfig.stickyNoteExtraFontFamilies).toEqual([
                'KhmerSticky',
            ]);
        });

        test('loadData and saveData proxy the note item', async () => {
            const { note, noteItem } = await setupInit();
            expect(capturedConfig.loadData()).toBe('note content');
            // unchanged data is a no-op
            await capturedConfig.saveData('note content');
            expect(note.updateAndSaveNoteItem).not.toHaveBeenCalled();
            // changed data persists
            await capturedConfig.saveData('new data');
            expect(noteItem.content).toBe('new data');
            expect(note.updateAndSaveNoteItem).toHaveBeenCalledWith(
                noteItem,
                true,
            );
        });

        test('loadData returns null for empty content', async () => {
            await setupInit(genNoteItem({ content: '' }));
            expect(capturedConfig.loadData()).toBeNull();
        });

        test('getLangCode detects language or defaults to en', async () => {
            await setupInit();
            expect(capturedConfig.getLangCode('has x here')).toBe('km');
            expect(capturedConfig.getLangCode('plain')).toBe('en');
        });

        test('print sends the print message', async () => {
            await setupInit();
            capturedConfig.print();
            expect(h.sendDataMock).toHaveBeenCalledWith('all:app:print');
        });

        test('shortToVerseData resolves verse data or null', async () => {
            await setupInit();
            h.bibleItemFromTitleTextMock.mockResolvedValue({
                bibleKey: 'KJV',
                toTitle: async () => 'Genesis 1:1',
                toFullText: async () => '(1) In the beginning',
            });
            h.getSettingMock.mockReturnValue('ESV');
            const data = await capturedConfig.shortToVerseData('Genesis 1:1');
            expect(data).toEqual({
                title: 'Genesis 1:1',
                fullText: '(1) In the beginning',
                style: { fontFamily: 'FontFam' },
            });

            h.bibleItemFromTitleTextMock.mockResolvedValue(null);
            expect(await capturedConfig.shortToVerseData('bad')).toBeNull();
        });

        test('verseFullTextToListShorts expands a verse range', async () => {
            await setupInit();
            h.bibleItemFromTitleTextMock.mockResolvedValue({
                target: {
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: 1,
                    verseEnd: 3,
                },
            });
            const shorts = await capturedConfig.verseFullTextToListShorts(
                'Genesis 1:1-3\n(1) text',
            );
            expect(shorts).toEqual(['GEN 1:1', 'GEN 1:2', 'GEN 1:3']);

            h.bibleItemFromTitleTextMock.mockResolvedValue(null);
            expect(
                await capturedConfig.verseFullTextToListShorts('bad\n'),
            ).toBeNull();
        });

        test('changeBibleKey returns null when no key prefix matches', async () => {
            await setupInit();
            expect(
                await capturedConfig.changeBibleKey({}, 'no prefix here'),
            ).toBeNull();
        });

        test('changeBibleKey returns null when the bible item is missing', async () => {
            await setupInit();
            h.bibleItemFromTitleTextMock.mockResolvedValue(null);
            expect(
                await capturedConfig.changeBibleKey({}, '(KJV) Genesis 1:1'),
            ).toBeNull();
        });

        test('changeBibleKey returns null when the key is unchanged', async () => {
            await setupInit();
            h.bibleItemFromTitleTextMock.mockResolvedValue({
                bibleKey: 'KJV',
            });
            h.showBibleKeyOptionMock.mockImplementation(
                (_e: any, cb: (k: string) => void) => cb('KJV'),
            );
            expect(
                await capturedConfig.changeBibleKey({}, '(KJV) Genesis 1:1'),
            ).toBeNull();
        });

        test('changeBibleKey applies a new key and returns data', async () => {
            await setupInit();
            const bibleItem: any = {
                bibleKey: 'KJV',
                toTitleWithBibleKey: async () => '(ESV) Genesis 1:1',
                toFullText: async () => 'text',
            };
            h.bibleItemFromTitleTextMock.mockResolvedValue(bibleItem);
            h.showBibleKeyOptionMock.mockImplementation(
                (_e: any, cb: (k: string) => void) => cb('ESV'),
            );
            const result = await capturedConfig.changeBibleKey(
                {},
                '(KJV) Genesis 1:1',
            );
            expect(result).toEqual({
                title: '(ESV) Genesis 1:1',
                fullText: 'text',
                style: { fontFamily: 'FontFam' },
            });
            expect(bibleItem.bibleKey).toBe('ESV');
        });

        test('excalidraw library helpers read and write settings', async () => {
            await setupInit();
            h.getSettingMock.mockReturnValue(null);
            expect(capturedConfig.excalidrawLoadLibrariesFileList()).toEqual(
                [],
            );

            h.getSettingMock.mockReturnValue(JSON.stringify(['a.lib', 5]));
            expect(capturedConfig.excalidrawLoadLibrariesFileList()).toEqual([
                'a.lib',
            ]);

            h.getSettingMock.mockReturnValue('{bad-json');
            expect(capturedConfig.excalidrawLoadLibrariesFileList()).toEqual(
                [],
            );

            // save appends unless already present
            h.getSettingMock.mockReturnValue(JSON.stringify(['a.lib']));
            capturedConfig.excalidrawSaveLibrariesFile('a.lib');
            expect(h.setSettingMock).not.toHaveBeenCalled();
            capturedConfig.excalidrawSaveLibrariesFile('b.lib');
            expect(h.setSettingMock).toHaveBeenCalledWith(
                'excalidraw-libraries',
                JSON.stringify(['b.lib', 'a.lib']),
            );

            capturedConfig.excalidrawClearLibrariesFileList();
            expect(h.setSettingMock).toHaveBeenCalledWith(
                'excalidraw-libraries',
                null,
            );
        });

        test('resolveFilePath validates existence', async () => {
            await setupInit();
            h.getAppFilePathFromFileMock.mockReturnValue(null);
            expect(await capturedConfig.resolveFilePath({})).toBeNull();

            h.getAppFilePathFromFileMock.mockReturnValue('rel/path');
            h.fsExistSyncMock.mockReturnValue(false);
            expect(await capturedConfig.resolveFilePath({})).toBeNull();

            h.fsExistSyncMock.mockReturnValue(true);
            expect(await capturedConfig.resolveFilePath({})).toBe(
                '/abs/rel/path',
            );
        });

        test('revealFile opens the explorer', async () => {
            await setupInit();
            capturedConfig.revealFile('/some/file');
            expect(h.showFileOrDirExplorerMock).toHaveBeenCalledWith(
                '/some/file',
            );
        });

        test('file watch reloads and syncs on change events', async () => {
            const { note } = await setupInit();
            // non-change events are ignored
            await capturedWatchCb('rename');
            expect(note.reload).not.toHaveBeenCalled();
            // change events reload and copy new content
            await capturedWatchCb('change');
            await flush();
            expect(note.reload).toHaveBeenCalled();
        });

        test('file watch skips when the item is unchanged or missing', async () => {
            (globalThis as any).AppBibleNote = FakeBibleNote;
            h.getAllLangsAsyncMock.mockResolvedValue([]);
            h.getCurrentLocaleMock.mockReturnValue('en');
            h.watchMock.mockImplementation((_p: any, _o: any, cb: any) => {
                capturedWatchCb = cb;
            });
            const note = {
                filePath: '/notes/a.note',
                reload: vi.fn(async () => {}),
                getItemById: vi.fn(() => null),
                updateAndSaveNoteItem: vi.fn(),
            };
            await initBibleNote({
                note: note as any,
                noteItem: genNoteItem() as any,
            });
            await capturedWatchCb('change');
            await flush();
            expect(note.getItemById).toHaveBeenCalled();
        });

        test('storageManager proxies the app home storage', async () => {
            await setupInit();
            capturedConfig.storageManager.setSetting('k', 'v');
            expect(h.homeSetItemMock).toHaveBeenCalledWith('k', 'v');
            capturedConfig.storageManager.getSetting('k');
            expect(h.homeGetItemMock).toHaveBeenCalledWith('k');
            capturedConfig.storageManager.deleteSetting('k');
            expect(h.homeRemoveItemMock).toHaveBeenCalledWith('k');
        });

        test('file watch waits while the editor is focused', async () => {
            vi.useFakeTimers();
            try {
                const { note, bibleNote } = await setupInit();
                (bibleNote as any).isFocusing = true;
                await capturedWatchCb('change');
                await vi.advanceTimersByTimeAsync(3_000);
                expect(note.reload).toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        });

        test('handles a watch registration error', async () => {
            (globalThis as any).AppBibleNote = FakeBibleNote;
            h.getAllLangsAsyncMock.mockResolvedValue([]);
            h.watchMock.mockImplementation(() => {
                throw new Error('watch failed');
            });
            await initBibleNote({
                note: {
                    filePath: '/notes/a.note',
                    reload: vi.fn(),
                    getItemById: vi.fn(),
                } as any,
                noteItem: genNoteItem() as any,
            });
            expect(h.handleErrorMock).toHaveBeenCalled();
        });
    });

    describe('getBibleNoteData', () => {
        test('sets the document title and returns note data', async () => {
            h.getParamFileFullNameMock.mockReturnValue('note.note');
            h.getDirPathBySettingNameMock.mockReturnValue('/notes');
            h.fsExistSyncMock.mockReturnValue(true);
            h.getParamIdNumMock.mockReturnValue(7);
            h.noteFromFilePathMock.mockResolvedValue({
                fileSource: { name: 'MyNote' },
                getItemById: vi.fn(() => ({ title: 'Item Title' })),
            });
            const data = await getBibleNoteData();
            expect(data).not.toBeNull();
            expect(document.title).toContain('MyNote: Item Title');
        });

        test('returns null when the note file name is missing', async () => {
            h.getParamFileFullNameMock.mockReturnValue(null);
            expect(await getBibleNoteData()).toBeNull();
            expect(h.handleErrorMock).toHaveBeenCalled();
        });

        test('returns null when the directory is not set', async () => {
            h.getParamFileFullNameMock.mockReturnValue('note.note');
            h.getDirPathBySettingNameMock.mockReturnValue(null);
            expect(await getBibleNoteData()).toBeNull();
        });

        test('returns null when the file does not exist', async () => {
            h.getParamFileFullNameMock.mockReturnValue('note.note');
            h.getDirPathBySettingNameMock.mockReturnValue('/notes');
            h.fsExistSyncMock.mockReturnValue(false);
            expect(await getBibleNoteData()).toBeNull();
        });

        test('returns null when the note cannot be loaded', async () => {
            h.getParamFileFullNameMock.mockReturnValue('note.note');
            h.getDirPathBySettingNameMock.mockReturnValue('/notes');
            h.fsExistSyncMock.mockReturnValue(true);
            h.noteFromFilePathMock.mockResolvedValue(null);
            expect(await getBibleNoteData()).toBeNull();
        });

        test('returns null when the note item id is missing', async () => {
            h.getParamFileFullNameMock.mockReturnValue('note.note');
            h.getDirPathBySettingNameMock.mockReturnValue('/notes');
            h.fsExistSyncMock.mockReturnValue(true);
            h.noteFromFilePathMock.mockResolvedValue({
                fileSource: { name: 'MyNote' },
                getItemById: vi.fn(() => ({ title: 'T' })),
            });
            h.getParamIdNumMock.mockReturnValue(null);
            expect(await getBibleNoteData()).toBeNull();
        });

        test('returns null when the note item is not found', async () => {
            h.getParamFileFullNameMock.mockReturnValue('note.note');
            h.getDirPathBySettingNameMock.mockReturnValue('/notes');
            h.fsExistSyncMock.mockReturnValue(true);
            h.getParamIdNumMock.mockReturnValue(7);
            h.noteFromFilePathMock.mockResolvedValue({
                fileSource: { name: 'MyNote' },
                getItemById: vi.fn(() => null),
            });
            expect(await getBibleNoteData()).toBeNull();
        });
    });
});
