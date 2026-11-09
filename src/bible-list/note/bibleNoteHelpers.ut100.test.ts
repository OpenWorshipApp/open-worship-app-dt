// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A note window's editing history handed over on demand (the footer's 🤖),
// a change the help window put in that the editor never handed back, and
// the ¶ view or a block link changed by another window -- the window mounts
// again, what was typed kept first. The same mock surface as
// `bibleNoteHelpers.test.ts`: the `bible-note` editor is a fake.
vi.mock('../../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));

const h = vi.hoisted(() => ({
    headChangedListeners: [] as ((filePath: string) => void)[],
    homeItems: new Map<string, string>(),
    // The debounced history write: held until a test runs it.
    attempts: [] as (() => unknown)[],
}));

const bn = vi.hoisted(() => {
    const state: { capturedConfig: any } = { capturedConfig: undefined };
    class FakeBibleNote {
        _content = 'stored';
        isReadOnly = false;
        constructor(config: any) {
            state.capturedConfig = config;
        }
        getIsFocusing() {
            return false;
        }
        get content() {
            return this._content;
        }
        set content(value: string) {
            // An editor that never hands a change back through `saveData`.
            this._content = value;
        }
    }
    return { state, FakeBibleNote };
});
vi.mock('bible-note', () => ({
    BibleNote: bn.FakeBibleNote,
}));
vi.mock('../../helper/DirSource', () => ({
    default: { getDirPathBySettingName: vi.fn() },
}));
vi.mock('../../helper/domHelpers', () => ({
    getParamFileFullName: vi.fn(),
    getParamIdNum: vi.fn(),
    getParamKeyValue: () => null,
}));
vi.mock('./bibleNotePreviewHelpers', () => ({
    getBibleNotePreviewFilePath: () => null,
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));
vi.mock('../../server/appProvider', () => ({
    default: {
        windowTitle: 'OWA',
        messageUtils: { sendData: vi.fn() },
        fileUtils: { watch: () => {} },
        systemUtils: { isDev: false },
    },
}));
vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => h.homeItems.get(key) ?? null,
        setItem: (key: string, value: string) => h.homeItems.set(key, value),
        removeItem: (key: string) => h.homeItems.delete(key),
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    pathBasename: (p: string) => p.slice(p.lastIndexOf('/') + 1),
    pathJoin: (...p: string[]) => p.join('/'),
    pathResolve: (p: string) => `/abs/${p}`,
    fsExistSync: () => true,
    toPathCompareKey: (p: string) => p.toLowerCase(),
}));
vi.mock('./noteHeadChangeHelpers', () => ({
    registerNoteHeadChangedListener: (listener: (filePath: string) => void) => {
        h.headChangedListeners.push(listener);
        return () => {};
    },
}));
vi.mock('../../helper/localFileHelpers', () => ({
    getAppFilePathFromFile: vi.fn(),
}));
vi.mock('./Note', () => ({
    default: { fromFilePath: vi.fn(), fromFilePathEditing: vi.fn() },
}));
vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getAllLangsAsync: async () => [
        { locale: 'en-US', langCode: 'en', checkIsThisLang: () => false },
    ],
    getCurrentLocale: () => 'en-US',
    getLangDataAsync: async () => null,
    initLangCss: () => {},
    initAllLangCss: async () => {},
    tran: (text: string) => text,
}));
vi.mock('../../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: async () => ({
        namesLookupManager: {},
        locationsLookupManager: {},
    }),
}));
vi.mock('../../server/appHelpers', () => ({
    showFileOrDirExplorer: vi.fn(),
}));
vi.mock('../../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => unknown) => {
        h.attempts.push(callback);
    },
}));
vi.mock('../../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: vi.fn(),
}));
vi.mock('../BibleItem', () => ({
    default: { fromTitleText: vi.fn() },
}));
vi.mock('../../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: vi.fn(),
}));
vi.mock('../../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
}));
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { getItem: () => null, setItem: () => {} },
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: async () => 'FontFam',
}));

import { flushBibleNoteHistory, initBibleNote } from './bibleNoteHelpers';
import { getNoteWindowController } from './noteWindowControllerHelpers';

function genNote() {
    return {
        filePath: '/notes/a.note',
        reload: vi.fn(async () => {}),
        reloadEditing: vi.fn(async () => {}),
        getItemById: vi.fn(() => ({ id: 7, content: 'reloaded' })),
        updateNoteItem: vi.fn(),
        addItemEditingHistory: vi.fn(async () => {}),
        updateAndSaveNoteItem: vi.fn(async () => true),
    };
}

async function setupInit() {
    const note = genNote();
    const noteItem = { id: 7, title: 'Grace', content: 'note content' };
    const bibleNote = await initBibleNote({
        note: note as any,
        noteItem: noteItem as any,
    });
    return { note, noteItem, bibleNote, config: bn.state.capturedConfig };
}

beforeEach(() => {
    h.headChangedListeners.length = 0;
    h.homeItems.clear();
    h.attempts = [];
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('flushBibleNoteHistory', () => {
    test('writes the typing the debounce still holds, once', async () => {
        const { note, noteItem, config } = await setupInit();
        await config.saveData('typed a word');
        // Held by the debounce: nothing in the history yet.
        expect(h.attempts).toHaveLength(1);
        expect(note.addItemEditingHistory).not.toHaveBeenCalled();

        await flushBibleNoteHistory();

        expect(note.addItemEditingHistory).toHaveBeenCalledExactlyOnceWith(
            noteItem,
        );
        expect(noteItem.content).toBe('typed a word');
        // Nothing left to write.
        await flushBibleNoteHistory();
        expect(note.addItemEditingHistory).toHaveBeenCalledOnce();
    });
});

describe('a change the help window put into the editor', () => {
    test('an editor that never hands it back is answered "not changed" after the wait', async () => {
        vi.useFakeTimers();
        const { note, noteItem } = await setupInit();
        const controller = getNoteWindowController()!;

        const written = controller.writeContent('from the chat');
        await vi.advanceTimersByTimeAsync(2_999);
        let isSettled = false;
        void written.then(() => {
            isSettled = true;
        });
        await vi.advanceTimersByTimeAsync(0);
        expect(isSettled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);

        expect(await written).toBe(false);
        expect(noteItem.content).toBe('note content');
        expect(note.addItemEditingHistory).not.toHaveBeenCalled();
    });
});

describe('the editor’s own keys changed by another window', () => {
    test('the window keeps what was typed, then mounts again', async () => {
        const order: string[] = [];
        vi.stubGlobal('location', {
            ...globalThis.location,
            reload: () => {
                order.push('reload');
            },
        });
        const { note, noteItem, config } = await setupInit();
        note.addItemEditingHistory.mockImplementation(async () => {
            order.push('history');
        });
        await config.saveData('typed before the change');
        expect(h.headChangedListeners).toHaveLength(1);

        // The help window turned the ¶ view on for this editor.
        h.homeItems.set(
            'lexical-playground-settings',
            '{"showInvisibleCharacters":true}',
        );
        h.headChangedListeners[0]('/notes/a.note');
        await vi.waitFor(() => {
            expect(order).toEqual(['history', 'reload']);
        });

        expect(note.addItemEditingHistory).toHaveBeenCalledWith(noteItem);
        // Mounted again rather than read in place.
        expect(note.reloadEditing).not.toHaveBeenCalled();
    });
});
