// @vitest-environment jsdom

import { act, Fragment, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The renderer entry files are tested on what they WIRE: `init` (boot.ts)
// first, then exactly these components in this order with these props, handed
// to `run` (others/main.tsx) or to a React root. Every module an entry imports
// is a small named stub here, and all state lives in this hoisted bundle, so
// `vi.resetModules()` before each test re-evaluates an entry against the same
// mocks (recipes.md §3: nothing here is read back from a mocked module).
const h = vi.hoisted(() => {
    const stub = (name: string) => {
        const comp = ({ children }: { children?: unknown }) => {
            return (children ?? null) as any;
        };
        Object.defineProperty(comp, 'name', { value: name });
        return comp;
    };
    return {
        events: [] as string[],
        callbackResult: undefined as unknown,
        isMainWindow: false,
        init: vi.fn(),
        run: vi.fn(),
        getReactRoot: vi.fn(),
        rootRender: vi.fn(),
        hideAllScreens: vi.fn(),
        forceReloadAppWindows: vi.fn(),
        handleError: vi.fn(),
        getBibleNoteData: vi.fn(),
        initBibleNote: vi.fn(),
        registerAppMenuClicked: vi.fn(),
        plugChatWindowLanguage: vi.fn(),
        plugChatWindowAppFont: vi.fn(),
        readChatWindowAppFontFamily: vi.fn(),
        readChatWindowLanguageFont: vi.fn(),
        setAppFontFamily: vi.fn(),
        setLanguageFont: vi.fn(),
        toUnicodeRange: vi.fn(),
        comps: {
            AboutComp: stub('AboutComp'),
            AiChatAppComp: stub('AiChatAppComp'),
            AppContextMenuComp: stub('AppContextMenuComp'),
            AppDocumentEditorComp: stub('AppDocumentEditorComp'),
            AppLayoutComp: stub('AppLayoutComp'),
            AppPresenterComp: stub('AppPresenterComp'),
            AppWindowToolsComp: stub('AppWindowToolsComp'),
            BibleReaderComp: stub('BibleReaderComp'),
            ChatbotAppComp: stub('ChatbotAppComp'),
            DataArchiveAppMenuComp: stub('DataArchiveAppMenuComp'),
            GraphViewPanelsHostComp: stub('GraphViewPanelsHostComp'),
            HandleAlertComp: stub('HandleAlertComp'),
            LangAppMenuComp: stub('LangAppMenuComp'),
            LocationNameDetailPanelsHostComp: stub(
                'LocationNameDetailPanelsHostComp',
            ),
            LWShareAppComp: stub('LWShareAppComp'),
            MarkdownPreviewAppComp: stub('MarkdownPreviewAppComp'),
            NoteItemEditorPopupComp: stub('NoteItemEditorPopupComp'),
            PopupLayoutComp: stub('PopupLayoutComp'),
            ScreenMirrorGuestComp: stub('ScreenMirrorGuestComp'),
            SettingComp: stub('SettingComp'),
            ToastComp: stub('ToastComp'),
            TopProgressBarComp: stub('TopProgressBarComp'),
            WebEditorComp: stub('WebEditorComp'),
        },
    };
});

vi.mock('./bootstrapCss', () => ({}));
vi.mock('bible-note/styles.css', () => ({}));
vi.mock('./boot', () => ({ init: h.init }));
vi.mock('./others/main', () => ({ run: h.run }));
vi.mock('./others/rootHelpers', () => ({ getReactRoot: h.getReactRoot }));
vi.mock('./_screen/screenHelpers', () => ({
    hideAllScreens: h.hideAllScreens,
}));
vi.mock('./resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { bibleReader: 'bible-reader' },
}));
vi.mock('./server/appHelpers', () => ({
    checkIsMainWindow: () => h.isMainWindow,
}));
vi.mock('./setting/settingHelpers', () => ({
    forceReloadAppWindows: h.forceReloadAppWindows,
}));
vi.mock('./helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./bible-list/note/bibleNoteHelpers', () => ({
    getBibleNoteData: h.getBibleNoteData,
    initBibleNote: h.initBibleNote,
}));
vi.mock('./lang/langHelpers', () => ({
    registerAppMenuClicked: h.registerAppMenuClicked,
}));
vi.mock('./chatbot/chatWindowLanguage', () => ({
    plugChatWindowLanguage: h.plugChatWindowLanguage,
    plugChatWindowAppFont: h.plugChatWindowAppFont,
    readChatWindowAppFontFamily: h.readChatWindowAppFontFamily,
    readChatWindowLanguageFont: h.readChatWindowLanguageFont,
}));
vi.mock('./aichat/aiChatGuestFontHelpers', () => ({
    setAppFontFamily: h.setAppFontFamily,
    setLanguageFont: h.setLanguageFont,
    toUnicodeRange: h.toUnicodeRange,
}));
vi.mock('./others/AboutComp', () => ({ default: h.comps.AboutComp }));
vi.mock('./aichat/AiChatAppComp', () => ({ default: h.comps.AiChatAppComp }));
vi.mock('./context-menu/AppContextMenuComp', () => ({
    default: h.comps.AppContextMenuComp,
}));
vi.mock('./app-document-editor/AppDocumentEditorComp', () => ({
    default: h.comps.AppDocumentEditorComp,
}));
vi.mock('./router/AppLayoutComp', () => ({ default: h.comps.AppLayoutComp }));
vi.mock('./presenter/AppPresenterComp', () => ({
    default: h.comps.AppPresenterComp,
}));
vi.mock('./others/AppWindowToolsComp', () => ({
    default: h.comps.AppWindowToolsComp,
}));
vi.mock('./bible-reader/BibleReaderComp', () => ({
    default: h.comps.BibleReaderComp,
}));
vi.mock('./chatbot/ChatbotAppComp', () => ({
    default: h.comps.ChatbotAppComp,
}));
vi.mock('./setting/data-archive/DataArchiveAppMenuComp', () => ({
    default: h.comps.DataArchiveAppMenuComp,
}));
vi.mock('./graph-view/GraphViewPanelsHostComp', () => ({
    default: h.comps.GraphViewPanelsHostComp,
}));
vi.mock('./popup-widget/HandleAlertComp', () => ({
    default: h.comps.HandleAlertComp,
}));
vi.mock('./lang/LangAppMenuComp', () => ({
    default: h.comps.LangAppMenuComp,
}));
vi.mock('./location-name-lookup/LocationNameDetailPanelsHostComp', () => ({
    default: h.comps.LocationNameDetailPanelsHostComp,
}));
vi.mock('./lwShare/LWShareAppComp', () => ({
    default: h.comps.LWShareAppComp,
}));
vi.mock('./markdown-preview/MarkdownPreviewAppComp', () => ({
    default: h.comps.MarkdownPreviewAppComp,
}));
vi.mock('./bible-list/note/NoteItemEditorPopupComp', () => ({
    default: h.comps.NoteItemEditorPopupComp,
}));
vi.mock('./router/PopupLayoutComp', () => ({
    default: h.comps.PopupLayoutComp,
}));
vi.mock('./screen-mirror/ScreenMirrorGuestComp', () => ({
    default: h.comps.ScreenMirrorGuestComp,
}));
vi.mock('./setting/SettingComp', () => ({ default: h.comps.SettingComp }));
vi.mock('./toast/ToastComp', () => ({ default: h.comps.ToastComp }));
vi.mock('./progress-bar/TopProgressBarComp', () => ({
    default: h.comps.TopProgressBarComp,
}));
vi.mock('./background/web/WebEditorComp', () => ({
    default: h.comps.WebEditorComp,
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const C = h.comps;

function childrenOf(element: any): any[] {
    const { children } = element.props;
    return Array.isArray(children) ? children : [children];
}

function typesOf(element: any) {
    return childrenOf(element).map((child) => {
        return child.type;
    });
}

async function flush() {
    for (let i = 0; i < 12; i++) {
        await Promise.resolve();
    }
}

// The help and AI Chat windows import their pages once `init` is done and
// the language plugins' files are in -- a module load later, not a microtask.
async function flushDrawn() {
    await vi.waitFor(() => {
        expect(h.rootRender).toHaveBeenCalled();
    });
    await flush();
}

/**
 * Imports an entry whose `init()` is held open, proves nothing is drawn while
 * the language is still loading, then lets `init` finish.
 */
async function importAfterInit(load: () => Promise<unknown>) {
    let resolveInit: () => void = () => {};
    h.init.mockImplementation(() => {
        h.events.push('init');
        return new Promise<void>((resolve) => {
            resolveInit = resolve;
        });
    });
    const loading = load();
    await vi.waitFor(() => {
        expect(h.init).toHaveBeenCalled();
    });
    await flush();
    expect(h.run).not.toHaveBeenCalled();
    expect(h.rootRender).not.toHaveBeenCalled();
    resolveInit();
    await loading;
}

beforeEach(() => {
    vi.resetModules();
    h.events.length = 0;
    h.callbackResult = undefined;
    h.isMainWindow = false;
    // Like the real `init`: everything is awaited, then `callback()` runs
    // WITHOUT being awaited. A rejected callback is kept for the test to read
    // (and marked handled so it is not reported as an unhandled rejection).
    h.init.mockImplementation(async (callback?: () => unknown) => {
        h.events.push('init');
        const result = callback?.();
        if (result instanceof Promise) {
            result.catch(() => {});
        }
        h.callbackResult = result;
    });
    h.run.mockImplementation(() => {
        h.events.push('run');
    });
    h.getReactRoot.mockImplementation((containerId?: string) => {
        h.events.push(`root:${containerId ?? 'default'}`);
        return { render: h.rootRender };
    });
    h.rootRender.mockImplementation(() => {
        h.events.push('render');
    });
    h.registerAppMenuClicked.mockImplementation(() => {
        h.events.push('menu');
    });
    h.plugChatWindowLanguage.mockImplementation(() => {
        h.events.push('language');
    });
    h.plugChatWindowAppFont.mockImplementation(async () => {
        h.events.push('app-font');
    });
    h.readChatWindowAppFontFamily.mockResolvedValue(null);
    h.readChatWindowLanguageFont.mockReturnValue(null);
    h.toUnicodeRange.mockReturnValue(null);
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('reader.tsx', () => {
    test('draws the Reader after init, then hides the screens in the main window', async () => {
        vi.useFakeTimers();
        h.isMainWindow = true;
        await importAfterInit(() => import('./reader'));

        expect(h.events).toEqual(['init', 'run']);
        const tree = h.run.mock.calls[0][0];
        expect(tree.type).toBe(Fragment);
        expect(typesOf(tree)).toEqual([
            C.BibleReaderComp,
            C.TopProgressBarComp,
            C.ToastComp,
            C.AppContextMenuComp,
            C.HandleAlertComp,
            C.AppWindowToolsComp,
            C.LocationNameDetailPanelsHostComp,
            C.GraphViewPanelsHostComp,
            C.DataArchiveAppMenuComp,
            C.LangAppMenuComp,
        ]);
        expect(childrenOf(tree)[0].props).toEqual({
            flexSizeName: 'bible-reader',
        });

        await vi.advanceTimersByTimeAsync(999);
        expect(h.hideAllScreens).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(h.hideAllScreens).toHaveBeenCalledOnce();
    });

    test('a Reader that is not the main window leaves the screens alone', async () => {
        vi.useFakeTimers();
        h.isMainWindow = false;
        await import('./reader');
        expect(h.run).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(5000);
        expect(h.hideAllScreens).not.toHaveBeenCalled();
    });
});

describe('entries that await init before run()', () => {
    test('presenter lays out the presenter and the window tools', async () => {
        await importAfterInit(() => import('./presenter'));
        const tree = h.run.mock.calls[0][0];
        expect(tree.type).toBe(C.AppLayoutComp);
        expect(typesOf(tree)).toEqual([
            C.AppPresenterComp,
            C.AppWindowToolsComp,
        ]);
    });

    test('screen-mirror draws the guest console without the app layout', async () => {
        await importAfterInit(() => import('./screen-mirror'));
        const tree = h.run.mock.calls[0][0];
        expect(tree.type).toBe(Fragment);
        expect(typesOf(tree)).toEqual([
            C.ScreenMirrorGuestComp,
            C.AppWindowToolsComp,
        ]);
    });

    test('webEditor wraps the web editor in the popup layout', async () => {
        await importAfterInit(() => import('./webEditor'));
        const tree = h.run.mock.calls[0][0];
        expect(tree.type).toBe(C.PopupLayoutComp);
        expect(typesOf(tree)).toEqual([C.WebEditorComp, C.AppWindowToolsComp]);
    });
});

describe('entries that pass run() to init as its callback', () => {
    test('setting draws Settings once the language loaded, and reloads the app windows as it closes', async () => {
        await import('./setting');
        await h.callbackResult;

        expect(h.events).toEqual(['init', 'run']);
        const tree = h.run.mock.calls[0][0];
        expect(tree.type).toBe(Fragment);
        expect(typesOf(tree)).toEqual([
            C.SettingComp,
            C.TopProgressBarComp,
            C.ToastComp,
            C.HandleAlertComp,
            C.AppContextMenuComp,
            C.AppWindowToolsComp,
        ]);

        expect(h.forceReloadAppWindows).not.toHaveBeenCalled();
        globalThis.dispatchEvent(new Event('beforeunload'));
        expect(h.forceReloadAppWindows).toHaveBeenCalledOnce();
    });

    test('appDocumentEditor lays out the editor, the tools and the language menu', async () => {
        await import('./appDocumentEditor');
        await h.callbackResult;

        expect(h.events).toEqual(['init', 'run']);
        const tree = h.run.mock.calls[0][0];
        expect(tree.type).toBe(C.AppLayoutComp);
        expect(typesOf(tree)).toEqual([
            C.AppDocumentEditorComp,
            C.AppWindowToolsComp,
            C.LangAppMenuComp,
        ]);
    });
});

describe('bibleNote.tsx', () => {
    test('refuses to draw a window that has no note to show', async () => {
        h.getBibleNoteData.mockResolvedValue(null);
        await import('./bibleNote');
        await expect(h.callbackResult).rejects.toThrow(
            'No bible note data found',
        );
        expect(h.initBibleNote).not.toHaveBeenCalled();
        expect(h.registerAppMenuClicked).not.toHaveBeenCalled();
        expect(h.run).not.toHaveBeenCalled();
    });

    test('mounts the note editor into its root and opens search only for an Open Search click', async () => {
        const bibleNote = {
            searchText: vi.fn(),
            render: vi.fn(),
            unmount: vi.fn(),
        };
        const noteData = {
            note: { id: 'note-1' },
            noteItem: { id: 'item-1' },
            isReadOnly: true,
            filePath: '/notes/a.own',
        };
        h.getBibleNoteData.mockResolvedValue(noteData);
        h.initBibleNote.mockResolvedValue(bibleNote);

        await import('./bibleNote');
        await h.callbackResult;

        expect(h.initBibleNote).toHaveBeenCalledExactlyOnceWith(noteData);
        // The menu listener is in place before anything is drawn.
        expect(h.events).toEqual(['init', 'menu', 'run']);
        const handleMenuClick = h.registerAppMenuClicked.mock.calls[0][0];
        // Every menu click lands here, including ones with no click data.
        handleMenuClick({}, undefined);
        handleMenuClick({}, {});
        handleMenuClick({}, { isOpenSearch: false });
        expect(bibleNote.searchText).not.toHaveBeenCalled();
        handleMenuClick({}, { isOpenSearch: true });
        expect(bibleNote.searchText).toHaveBeenCalledExactlyOnceWith('');

        const tree = h.run.mock.calls[0][0];
        expect(tree.type).toBe(C.PopupLayoutComp);
        const [noteRoot, editorPopup, windowTools] = childrenOf(tree);
        expect(noteRoot.type).toBe('div');
        expect(editorPopup.type).toBe(C.NoteItemEditorPopupComp);
        expect(editorPopup.props).toEqual({
            bibleNote,
            note: noteData.note,
            noteItem: noteData.noteItem,
            isReadOnly: true,
        });
        expect(windowTools.type).toBe(C.AppWindowToolsComp);

        // Drawn for real: the editor takes the element and lets it go again.
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        await act(async () => {
            root.render(tree);
        });
        const element = container.querySelector<HTMLDivElement>(
            'div#bible-note-root',
        );
        expect(element).not.toBeNull();
        expect(element!.className).toBe('app-selectable-text');
        expect(element!.style.position).toBe('absolute');
        expect(element!.style.overflow).toBe('hidden');
        expect(bibleNote.render).toHaveBeenCalledExactlyOnceWith(element);
        expect(bibleNote.unmount).not.toHaveBeenCalled();
        await act(async () => {
            root.unmount();
        });
        container.remove();
        expect(bibleNote.unmount).toHaveBeenCalledOnce();

        // A ref call with no element draws nothing.
        expect(noteRoot.props.ref(null)).toBeUndefined();
        expect(bibleNote.render).toHaveBeenCalledOnce();
    });
});

describe('entries that render into their own React root', () => {
    test('about draws at once, without waiting for the language', async () => {
        h.init.mockImplementation(() => {
            h.events.push('init');
            return new Promise(() => {});
        });
        await import('./about');

        expect(h.init).toHaveBeenCalledExactlyOnceWith();
        expect(h.events).toEqual(['init', 'root:default', 'render']);
        const tree = h.rootRender.mock.calls[0][0];
        expect(tree.type).toBe(StrictMode);
        expect(typesOf(tree)).toEqual([C.AboutComp]);
    });

    test('lwShare draws the share app and the window tools after init', async () => {
        await importAfterInit(() => import('./lwShare'));
        expect(h.events).toEqual(['init', 'root:default', 'render']);
        const tree = h.rootRender.mock.calls[0][0];
        expect(tree.type).toBe(StrictMode);
        expect(typesOf(tree)).toEqual([C.LWShareAppComp, C.AppWindowToolsComp]);
    });

    test('markdownPreview draws the preview after init and never calls run()', async () => {
        await importAfterInit(() => import('./markdownPreview'));
        expect(h.events).toEqual(['init', 'root:default', 'render']);
        expect(h.run).not.toHaveBeenCalled();
        const tree = h.rootRender.mock.calls[0][0];
        expect(tree.type).toBe(StrictMode);
        expect(typesOf(tree)).toEqual([C.MarkdownPreviewAppComp]);
    });
});

describe('chatbot.tsx', () => {
    test('plugs the language and the app font in before drawing', async () => {
        await import('./chatbot');
        await flushDrawn();

        expect(h.events).toEqual([
            'root:default',
            'init',
            'language',
            'app-font',
            'render',
        ]);
        const tree = h.rootRender.mock.calls[0][0];
        expect(tree.type).toBe(StrictMode);
        expect(typesOf(tree)).toEqual([C.ChatbotAppComp]);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('still draws, after reporting, when init fails', async () => {
        const error = new Error('language failed to load');
        h.init.mockRejectedValue(error);
        await import('./chatbot');
        await flushDrawn();

        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
        expect(h.plugChatWindowLanguage).not.toHaveBeenCalled();
        expect(h.rootRender).toHaveBeenCalledOnce();
    });
});

describe('aichat.tsx', () => {
    test('hands the sites the app font and the language face for its letters only', async () => {
        const font = {
            family: 'app-ScriptFace',
            css: '@font-face { font-family: app-ScriptFace; }',
            scriptPatternSource: '[\\u2600-\\u26FF]',
        };
        h.readChatWindowAppFontFamily.mockResolvedValue('Noto Serif');
        h.readChatWindowLanguageFont.mockReturnValue(font);
        h.toUnicodeRange.mockReturnValue('U+2600-26FF');

        await import('./aichat');
        await flushDrawn();

        expect(h.plugChatWindowLanguage).toHaveBeenCalledOnce();
        expect(h.plugChatWindowAppFont).toHaveBeenCalledOnce();
        expect(h.setAppFontFamily).toHaveBeenCalledExactlyOnceWith(
            'Noto Serif',
        );
        expect(h.toUnicodeRange).toHaveBeenCalledExactlyOnceWith(
            font.scriptPatternSource,
        );
        expect(h.setLanguageFont).toHaveBeenCalledExactlyOnceWith({
            family: font.family,
            css: font.css,
            unicodeRange: 'U+2600-26FF',
        });
        expect(h.events.indexOf('language')).toBeLessThan(
            h.events.indexOf('render'),
        );
        const tree = h.rootRender.mock.calls[0][0];
        expect(tree.type).toBe(StrictMode);
        expect(typesOf(tree)).toEqual([C.AiChatAppComp]);
    });

    test('gives the sites no language face for a language without one', async () => {
        h.readChatWindowLanguageFont.mockReturnValue(null);
        await import('./aichat');
        await flushDrawn();
        expect(h.toUnicodeRange).not.toHaveBeenCalled();
        expect(h.setLanguageFont).toHaveBeenCalledExactlyOnceWith(null);
        expect(h.rootRender).toHaveBeenCalledOnce();
    });

    test('gives the sites no language face when its letters name no range', async () => {
        h.readChatWindowLanguageFont.mockReturnValue({
            family: 'app-Font',
            css: '',
            scriptPatternSource: '[a-z]',
        });
        h.toUnicodeRange.mockReturnValue(null);
        await import('./aichat');
        await flushDrawn();
        expect(h.toUnicodeRange).toHaveBeenCalledExactlyOnceWith('[a-z]');
        expect(h.setLanguageFont).toHaveBeenCalledExactlyOnceWith(null);
    });

    test('still draws, after reporting, when init fails', async () => {
        const error = new Error('language failed to load');
        h.init.mockRejectedValue(error);
        await import('./aichat');
        await flushDrawn();
        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
        expect(h.setLanguageFont).not.toHaveBeenCalled();
        expect(h.rootRender).toHaveBeenCalledOnce();
    });
});
