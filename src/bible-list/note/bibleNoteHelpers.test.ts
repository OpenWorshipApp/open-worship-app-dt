// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getDirPathBySettingNameMock: vi.fn(),
    getParamFileFullNameMock: vi.fn(),
    getParamIdNumMock: vi.fn(),
    getBibleNotePreviewFilePathMock: vi.fn(),
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
    noteFromFilePathEditingMock: vi.fn(),
    getAllLangsAsyncMock: vi.fn(),
    getCurrentLocaleMock: vi.fn(() => 'en'),
    initLangCssMock: vi.fn(),
    initAllLangCssMock: vi.fn(),
    showFileOrDirExplorerMock: vi.fn(),
    genTimeoutAttemptMock: vi.fn(() => (fn: any) => fn()),
    bibleItemFromTitleTextMock: vi.fn(),
    showBibleKeyOptionMock: vi.fn(),
    getSettingMock: vi.fn(),
    setSettingMock: vi.fn(),
    getBibleFontFamilyMock: vi.fn(async () => 'FontFam'),
    getLangDataAsyncMock: vi.fn(),
    acquireLookupDataMock: vi.fn(async () => ({
        namesLookupManager: {},
        locationsLookupManager: {},
    })),
}));

// the real package drags lexical/excalidraw into jsdom (canvas getContext is
// not implemented there), so the constructor is faked at the module boundary
const bn = vi.hoisted(() => {
    const state: { capturedConfig: any } = { capturedConfig: undefined };
    class FakeBibleNote {
        _content = 'stored';
        isFocusing = false;
        constructor(config: any) {
            state.capturedConfig = config;
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
        isReadOnly = false;
    }
    return { state, FakeBibleNote };
});
vi.mock('bible-note', () => ({
    BibleNote: bn.FakeBibleNote,
}));

vi.mock('../../helper/DirSource', () => ({
    default: { getDirPathBySettingName: h.getDirPathBySettingNameMock },
}));
vi.mock('../../helper/domHelpers', () => ({
    getParamFileFullName: h.getParamFileFullNameMock,
    getParamIdNum: h.getParamIdNumMock,
}));
vi.mock('./bibleNotePreviewHelpers', () => ({
    getBibleNotePreviewFilePath: h.getBibleNotePreviewFilePathMock,
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: h.handleErrorMock,
}));
vi.mock('../../server/appProvider', () => ({
    default: {
        windowTitle: 'OWA',
        messageUtils: { sendData: h.sendDataMock },
        fileUtils: { watch: h.watchMock },
        // `appHooks` reads this at module load; without it any real import
        // that reaches it dies while the suite is still being collected
        systemUtils: { isDev: false },
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
    pathBasename: (p: string) => p.slice(p.lastIndexOf('/') + 1),
    pathJoin: h.pathJoinMock,
    pathResolve: h.pathResolveMock,
    fsExistSync: h.fsExistSyncMock,
}));
vi.mock('../../helper/localFileHelpers', () => ({
    getAppFilePathFromFile: h.getAppFilePathFromFileMock,
}));
vi.mock('./Note', () => ({
    default: {
        fromFilePath: h.noteFromFilePathMock,
        fromFilePathEditing: h.noteFromFilePathEditingMock,
    },
}));
vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getAllLangsAsync: h.getAllLangsAsyncMock,
    getCurrentLocale: h.getCurrentLocaleMock,
    getLangDataAsync: h.getLangDataAsyncMock,
    initLangCss: h.initLangCssMock,
    initAllLangCss: h.initAllLangCssMock,
    tran: (text: string) => text,
}));
// Real implementation fetches ~34MB of lookup JSON and dynamically imports the
// `bible-note` package; only the managers it hands to the editor matter here.
// `acquireLookupData` (not `getLookupDataCached`) is what the editor takes, so
// that its copy is the same one the lookup UI holds rather than a second one.
vi.mock('../../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: h.acquireLookupDataMock,
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
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: h.getSettingMock,
        setItem: h.setSettingMock,
    },
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: h.getBibleFontFamilyMock,
}));

import {
    BIBLE_KEY_SETTING_NAME,
    checkIsEmptyNoteContent,
    getBibleNoteData,
    getBibleNoteSelectedBibleKey,
    initBibleNote,
    toEditorContent,
    toStoredContent,
} from './bibleNoteHelpers';

const EMPTY_ROOT_CONTENT = JSON.stringify({
    root: {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
    },
});

async function flush() {
    await new Promise((r) => setTimeout(r, 5));
}

describe('bible-list/note bibleNoteHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.genTimeoutAttemptMock.mockReturnValue((fn: any) => fn());
        // An ordinary note window unless a test says otherwise.
        h.getBibleNotePreviewFilePathMock.mockReturnValue(null);
        // An editable window reads its EDITING head; the fixtures describe one
        // note, so the head read simply follows the file read.
        h.noteFromFilePathEditingMock.mockImplementation((filePath: string) => {
            return h.noteFromFilePathMock(filePath);
        });
        h.fsExistSyncMock.mockReturnValue(true);
        h.pathJoinMock.mockImplementation((...p: string[]) => p.join('/'));
        h.pathResolveMock.mockImplementation((p: string) => `/abs/${p}`);
        h.getBibleFontFamilyMock.mockResolvedValue('FontFam');
        h.getLangDataAsyncMock.mockResolvedValue({
            getLookupData: async () => ({ namesMap: {}, locationsMap: {} }),
        });
    });

    afterEach(() => {
        bn.state.capturedConfig = undefined;
    });

    test('getBibleNoteSelectedBibleKey falls back to KJV', () => {
        h.getSettingMock.mockReturnValue(null);
        expect(getBibleNoteSelectedBibleKey()).toBe('KJV');
        expect(h.getSettingMock).toHaveBeenCalledWith(BIBLE_KEY_SETTING_NAME);
        h.getSettingMock.mockReturnValue('ESV');
        expect(getBibleNoteSelectedBibleKey()).toBe('ESV');
    });

    describe('initBibleNote', () => {
        let capturedConfig: any;
        let capturedWatchCb: any;

        function genNoteItem(overrides: any = {}) {
            return {
                id: 7,
                title: 'Note Title',
                content: 'note content',
                ...overrides,
            };
        }

        async function setupInit(
            noteItem = genNoteItem(),
            isReadOnly: boolean | undefined = undefined,
        ) {
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
                reloadEditing: vi.fn(async () => {}),
                getItemById: vi.fn(() => ({ id: 7, content: 'reloaded' })),
                updateNoteItem: vi.fn(),
                addItemEditingHistory: vi.fn(async () => {}),
                updateAndSaveNoteItem: vi.fn(async () => true),
            };
            const bibleNote = await initBibleNote({
                note: note as any,
                noteItem: noteItem as any,
                isReadOnly,
            });
            capturedConfig = bn.state.capturedConfig;
            return { note, bibleNote, noteItem };
        }

        test('builds the bible note and initializes non-current langs', async () => {
            await setupInit();
            expect(capturedConfig).toBeDefined();
            // every locale's css is injected in one go, not per non-current one
            expect(h.initAllLangCssMock).toHaveBeenCalledTimes(1);
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
            expect(note.addItemEditingHistory).not.toHaveBeenCalled();
            // changed data goes into the EDITING HISTORY, never the file
            await capturedConfig.saveData('new data');
            expect(noteItem.content).toBe('new data');
            expect(note.updateNoteItem).toHaveBeenCalledWith(noteItem, true);
            expect(note.addItemEditingHistory).toHaveBeenCalledWith(noteItem);
            expect(note.updateAndSaveNoteItem).not.toHaveBeenCalled();
        });

        test('a read-only note is locked and never saved', async () => {
            const { note, noteItem, bibleNote } = await setupInit(
                genNoteItem(),
                true,
            );
            expect((bibleNote as any).isReadOnly).toBe(true);
            await capturedConfig.saveData('new data');
            expect(noteItem.content).toBe('note content');
            expect(note.addItemEditingHistory).not.toHaveBeenCalled();
        });

        test('an ordinary note is not locked', async () => {
            const { bibleNote } = await setupInit();
            expect((bibleNote as any).isReadOnly).toBe(false);
        });

        test('a read-only note follows its file without waiting', async () => {
            vi.useFakeTimers();
            try {
                const { note, noteItem, bibleNote } = await setupInit(
                    genNoteItem(),
                    true,
                );
                (bibleNote as any).isFocusing = true;
                await capturedWatchCb('change');
                // No 3s grace: there is no typing in a preview to protect.
                await vi.advanceTimersByTimeAsync(0);
                // A preview follows the FILE; only an editable window has an
                // editing head of its own to follow.
                expect(note.reload).toHaveBeenCalled();
                expect(note.reloadEditing).not.toHaveBeenCalled();
                expect(bibleNote.content).toBe('reloaded');
                expect(noteItem.content).toBe('reloaded');
                expect(note.updateAndSaveNoteItem).not.toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        });

        // NOT null: null tells the composer to leave the root alone, and what
        // the package then puts there is its own Genesis 1 playground demo.
        test('loadData opens empty content on one empty paragraph', async () => {
            await setupInit(genNoteItem({ content: '' }));
            const loaded = JSON.parse(capturedConfig.loadData());
            expect(loaded.root.children).toHaveLength(1);
            expect(loaded.root.children[0].type).toBe('paragraph');
        });

        // A root with no children is what the editor refuses to load back
        // (Lexical error #38), which left the note window blank for good.
        test('loadData never hands back a childless root', async () => {
            await setupInit(genNoteItem({ content: EMPTY_ROOT_CONTENT }));
            const loaded = JSON.parse(capturedConfig.loadData());
            expect(loaded.root.children.length).toBeGreaterThan(0);
        });

        test('saveData stores a childless root as no content', async () => {
            const { note, noteItem } = await setupInit();
            await capturedConfig.saveData(EMPTY_ROOT_CONTENT);
            expect(noteItem.content).toBe('');
            expect(note.addItemEditingHistory).toHaveBeenCalled();
            // and an item already emptied is not written again
            note.addItemEditingHistory.mockClear();
            await capturedConfig.saveData(EMPTY_ROOT_CONTENT);
            expect(note.addItemEditingHistory).not.toHaveBeenCalled();
        });

        test('file watch empties rather than loading a childless root', async () => {
            const { note, bibleNote } = await setupInit();
            note.getItemById.mockReturnValue({
                id: 7,
                content: EMPTY_ROOT_CONTENT,
            });
            await capturedWatchCb('change');
            await flush();
            expect(JSON.parse(bibleNote.content).root.children).toHaveLength(1);
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
                '[]',
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
            expect(note.reloadEditing).toHaveBeenCalled();
            expect(note.reload).not.toHaveBeenCalled();
        });

        test('file watch skips when the item is unchanged or missing', async () => {
            h.getAllLangsAsyncMock.mockResolvedValue([]);
            h.getCurrentLocaleMock.mockReturnValue('en');
            h.watchMock.mockImplementation((_p: any, _o: any, cb: any) => {
                capturedWatchCb = cb;
            });
            const note = {
                filePath: '/notes/a.note',
                reload: vi.fn(async () => {}),
                reloadEditing: vi.fn(async () => {}),
                getItemById: vi.fn(() => null),
                updateNoteItem: vi.fn(),
                addItemEditingHistory: vi.fn(async () => {}),
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
                expect(note.reloadEditing).toHaveBeenCalled();
            } finally {
                vi.useRealTimers();
            }
        });

        test('handles a watch registration error', async () => {
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
        test('a preview opens the named file, read-only', async () => {
            h.getBibleNotePreviewFilePathMock.mockReturnValue(
                '/elsewhere/GEN.1.own',
            );
            h.fsExistSyncMock.mockReturnValue(true);
            h.getParamIdNumMock.mockReturnValue(7);
            h.noteFromFilePathMock.mockResolvedValue({
                fileSource: { name: 'GEN.1' },
                getItemById: vi.fn(() => ({ title: 'Item Title' })),
            });
            const data = await getBibleNoteData();
            expect(data?.isReadOnly).toBe(true);
            expect(h.noteFromFilePathEditingMock).not.toHaveBeenCalled();
            // Found by its full path, not looked up in the notes folder.
            expect(h.noteFromFilePathMock).toHaveBeenCalledWith(
                '/elsewhere/GEN.1.own',
            );
            expect(h.getDirPathBySettingNameMock).not.toHaveBeenCalled();
            expect(document.title).toContain('GEN.1: Item Title (Read-only)');
        });

        test('a verse item is never opened in the editor', async () => {
            h.getParamFileFullNameMock.mockReturnValue('note.note');
            h.getDirPathBySettingNameMock.mockReturnValue('/notes');
            h.fsExistSyncMock.mockReturnValue(true);
            h.getParamIdNumMock.mockReturnValue(7);
            h.noteFromFilePathMock.mockResolvedValue({
                fileSource: { name: 'MyNote' },
                getItemById: vi.fn(() => ({ title: 'T', isVerseItem: true })),
            });
            expect(await getBibleNoteData()).toBeNull();
        });

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
            expect(data?.isReadOnly).toBe(false);
            // Unsaved text comes back with the window, so it opens on the head
            expect(h.noteFromFilePathEditingMock).toHaveBeenCalledWith(
                '/notes/note.note',
            );
            expect(document.title).toContain('MyNote: Item Title');
            expect(document.title).not.toContain('Read-only');
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

describe('checkIsEmptyNoteContent', () => {
    test('an empty string and a childless root are empty', () => {
        expect(checkIsEmptyNoteContent('')).toBe(true);
        expect(checkIsEmptyNoteContent('   ')).toBe(true);
        expect(checkIsEmptyNoteContent(EMPTY_ROOT_CONTENT)).toBe(true);
    });

    test('a root with a child is not empty', () => {
        expect(
            checkIsEmptyNoteContent(
                JSON.stringify({
                    root: { children: [{ type: 'paragraph' }] },
                }),
            ),
        ).toBe(false);
    });

    test('anything that is not an editor state is left alone', () => {
        expect(checkIsEmptyNoteContent('GEN 3:20')).toBe(false);
        expect(checkIsEmptyNoteContent('{oops')).toBe(false);
        expect(checkIsEmptyNoteContent('null')).toBe(false);
    });

    test('the two conversions are a round trip', () => {
        expect(toStoredContent(EMPTY_ROOT_CONTENT)).toBe('');
        expect(toStoredContent('real text')).toBe('real text');
        expect(toEditorContent('real text')).toBe('real text');
        expect(checkIsEmptyNoteContent(toEditorContent(''))).toBe(false);
    });

    // The editor's autocomplete draws the rest of a word as a token node the
    // user has not typed; the editor serializes whatever state it is in, so it
    // reached the note's history and, on a Save, the file. A real note was
    // found holding one as its only pending change.
    describe('the ghost suggestion node', () => {
        const withGhost = (text: string) => {
            return JSON.stringify({
                root: {
                    children: [
                        {
                            type: 'paragraph',
                            children: [
                                { type: 'text', text },
                                {
                                    type: 'autocomplete',
                                    text: 'list (TAB)',
                                    mode: 'token',
                                    uuid: 'terfi',
                                },
                            ],
                        },
                    ],
                },
            });
        };

        test('never reaches what is stored', () => {
            const stored = toStoredContent(withGhost('make a '));
            expect(stored).not.toContain('autocomplete');
            expect(stored).toContain('make a ');
            expect(JSON.parse(stored).root.children[0].children).toHaveLength(
                1,
            );
        });

        test('a note already holding one opens without it', () => {
            expect(toEditorContent(withGhost('make a '))).not.toContain(
                'autocomplete',
            );
        });

        test('the words the user typed are untouched', () => {
            const plain = JSON.stringify({
                root: {
                    children: [
                        {
                            type: 'paragraph',
                            children: [
                                { type: 'text', text: 'about autocomplete' },
                            ],
                        },
                    ],
                },
            });
            // The guard looks for a quoted node type, so the word in somebody's
            // own sentence is neither matched nor rewritten.
            expect(toStoredContent(plain)).toBe(plain);
        });

        test('content that is not an editor state is left alone', () => {
            expect(toStoredContent('"autocomplete" oops {')).toBe(
                '"autocomplete" oops {',
            );
        });
    });

    // Long content is never parsed -- an empty state cannot be long, and a
    // 60KB note would otherwise be parsed on every autosave.
    test('long content is not parsed', () => {
        const longChildless = JSON.stringify({
            root: { children: [], padding: 'x'.repeat(600) },
        });
        expect(checkIsEmptyNoteContent(longChildless)).toBe(false);
    });
});
