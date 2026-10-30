// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Each renderer entry is `init()` then a tree handed to `run()` or a root.
// These tests import the real entry files over stub components and check the
// order (no tree before the language is loaded where the entry waits for it),
// the tree each window mounts, and the fallbacks the entries promise.
const state = vi.hoisted(() => ({
    order: [] as string[],
    initMode: 'resolve' as 'resolve' | 'reject' | 'pending',
    lastInit: null as null | Promise<unknown>,
    initError: new Error('init failed'),
    run: vi.fn(),
    render: vi.fn(),
    rootIds: [] as (string | undefined)[],
    handleError: vi.fn(),
    hideAllScreens: vi.fn(),
    isMainWindow: true,
    forceReload: vi.fn(),
    plugLanguage: vi.fn(),
    plugAppFont: vi.fn(),
    appFontFamily: 'Battambang' as string | null,
    languageFont: null as null | {
        family: string;
        css: string;
        scriptPatternSource: string;
    },
    unicodeRange: 'U+1780-17FF' as string | null,
    setAppFontFamily: vi.fn(),
    setLanguageFont: vi.fn(),
    bibleNoteData: null as null | Record<string, unknown>,
    bibleNote: {
        render: vi.fn(),
        unmount: vi.fn(),
        searchText: vi.fn(),
    },
    menuHandlers: [] as ((event: unknown, data?: unknown) => void)[],
    initBibleNote: vi.fn(),
}));

function stub(name: string) {
    return {
        default: () => <i>{name}</i>,
    };
}
function layout(name: string) {
    return {
        default: ({ children }: { children?: ReactNode }) => (
            <div data-layout={name}>{children}</div>
        ),
    };
}

vi.mock('./bootstrapCss', () => ({}));
vi.mock('./boot', () => ({
    init: (callback?: () => unknown) => {
        state.order.push('init');
        if (state.initMode === 'pending') {
            state.lastInit = new Promise(() => {});
        } else if (state.initMode === 'reject') {
            state.lastInit = Promise.reject(state.initError);
        } else {
            state.lastInit = Promise.resolve(callback?.()).then(() => {
                state.order.push('init-done');
            });
        }
        return state.lastInit;
    },
}));
vi.mock('./others/main', () => ({
    run: (tree: ReactNode) => {
        state.order.push('run');
        state.run(tree);
    },
}));
vi.mock('./others/rootHelpers', () => ({
    getReactRoot: (id?: string) => {
        state.rootIds.push(id);
        return {
            render: (tree: ReactNode) => {
                state.order.push('render');
                state.render(tree);
            },
        };
    },
}));
vi.mock('./helper/errorHelpers', () => ({ handleError: state.handleError }));
vi.mock('./router/AppLayoutComp', () => layout('AppLayout'));
vi.mock('./router/PopupLayoutComp', () => layout('PopupLayout'));
vi.mock('./others/AppWindowToolsComp', () => stub('WindowTools'));
vi.mock('./presenter/AppPresenterComp', () => stub('Presenter'));
vi.mock('./screen-mirror/ScreenMirrorGuestComp', () =>
    stub('ScreenMirrorGuest'),
);
vi.mock('./background/web/WebEditorComp', () => stub('WebEditor'));
vi.mock('./others/AboutComp', () => stub('About'));
vi.mock('./app-document-editor/AppDocumentEditorComp', () =>
    stub('DocumentEditor'),
);
vi.mock('./lang/LangAppMenuComp', () => stub('LangMenu'));
vi.mock('./lwShare/LWShareAppComp', () => stub('LWShare'));
vi.mock('./markdown-preview/MarkdownPreviewAppComp', () =>
    stub('MarkdownPreview'),
);
vi.mock('./setting/SettingComp', () => stub('Setting'));
vi.mock('./setting/settingHelpers', () => ({
    forceReloadAppWindows: state.forceReload,
}));
vi.mock('./progress-bar/TopProgressBarComp', () => stub('ProgressBar'));
vi.mock('./toast/ToastComp', () => stub('Toast'));
vi.mock('./popup-widget/HandleAlertComp', () => stub('Alert'));
vi.mock('./context-menu/AppContextMenuComp', () => stub('ContextMenu'));
vi.mock('./bible-reader/BibleReaderComp', () => ({
    default: ({ flexSizeName }: { flexSizeName: string }) => (
        <i data-flex={flexSizeName}>BibleReader</i>
    ),
}));
vi.mock('./graph-view/GraphViewPanelsHostComp', () => stub('GraphPanels'));
vi.mock('./location-name-lookup/LocationNameDetailPanelsHostComp', () =>
    stub('LookupPanels'),
);
vi.mock('./setting/data-archive/DataArchiveAppMenuComp', () =>
    stub('ArchiveMenu'),
);
vi.mock('./resize-actor/flexSizeHelpers', () => ({
    resizeSettingNames: { bibleReader: 'bible-reader-main' },
}));
vi.mock('./_screen/screenHelpers', () => ({
    hideAllScreens: state.hideAllScreens,
}));
vi.mock('./server/appHelpers', () => ({
    checkIsMainWindow: () => state.isMainWindow,
}));
vi.mock('./chatbot/ChatbotAppComp', () => stub('Chatbot'));
vi.mock('./aichat/AiChatAppComp', () => stub('AiChat'));
vi.mock('./chatbot/chatWindowLanguage', () => ({
    plugChatWindowLanguage: () => {
        state.order.push('plug-language');
        state.plugLanguage();
    },
    plugChatWindowAppFont: async () => {
        state.plugAppFont();
    },
    readChatWindowAppFontFamily: async () => state.appFontFamily,
    readChatWindowLanguageFont: () => state.languageFont,
}));
vi.mock('./aichat/aiChatGuestFontHelpers', () => ({
    setAppFontFamily: state.setAppFontFamily,
    setLanguageFont: state.setLanguageFont,
    toUnicodeRange: () => state.unicodeRange,
}));
vi.mock('bible-note/styles.css', () => ({}));
vi.mock('./bible-list/note/NoteItemEditorPopupComp', () => ({
    default: ({ isReadOnly }: { isReadOnly: boolean }) => (
        <i data-read-only={String(isReadOnly)}>NoteItemEditor</i>
    ),
}));
vi.mock('./bible-list/note/bibleNoteHelpers', () => ({
    getBibleNoteData: async () => state.bibleNoteData,
    initBibleNote: state.initBibleNote,
}));
vi.mock('./lang/langHelpers', () => ({
    registerAppMenuClicked: (
        handler: (event: unknown, data?: unknown) => void,
    ) => {
        state.menuHandlers.push(handler);
    },
}));

function markupOf(tree: ReactNode) {
    return renderToStaticMarkup(<>{tree}</>);
}

async function settle() {
    await vi.waitFor(() => {
        expect(state.order).toContain('init-done');
    });
}

beforeEach(() => {
    vi.resetModules();
    state.order = [];
    state.initMode = 'resolve';
    state.lastInit = null;
    state.rootIds = [];
    state.isMainWindow = true;
    state.appFontFamily = 'Battambang';
    state.languageFont = null;
    state.unicodeRange = 'U+1780-17FF';
    state.bibleNoteData = null;
    state.menuHandlers = [];
    state.initBibleNote.mockImplementation(async () => state.bibleNote);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('windows that run inside the app layout', () => {
    test('the presenter waits for init, then mounts its page and the window tools', async () => {
        await import('./presenter');

        expect(state.order).toEqual(['init', 'init-done', 'run']);
        expect(markupOf(state.run.mock.calls[0][0])).toBe(
            '<div data-layout="AppLayout"><i>Presenter</i><i>WindowTools</i></div>',
        );
    });

    test('the screen-mirror guest has no app layout, only its console and the tools', async () => {
        await import('./screen-mirror');

        expect(state.order).toEqual(['init', 'init-done', 'run']);
        expect(markupOf(state.run.mock.calls[0][0])).toBe(
            '<i>ScreenMirrorGuest</i><i>WindowTools</i>',
        );
    });

    test('the web editor is a popup with the window tools', async () => {
        await import('./webEditor');

        expect(markupOf(state.run.mock.calls[0][0])).toBe(
            '<div data-layout="PopupLayout"><i>WebEditor</i><i>WindowTools</i></div>',
        );
    });

    test('the document editor loads its page after init and adds the language menu', async () => {
        await import('./appDocumentEditor');
        await settle();

        expect(state.order).toEqual(['init', 'run', 'init-done']);
        expect(markupOf(state.run.mock.calls[0][0])).toBe(
            '<div data-layout="AppLayout"><i>DocumentEditor</i><i>WindowTools</i><i>LangMenu</i></div>',
        );
    });
});

describe('windows drawn straight into a root', () => {
    test('the About window draws without waiting for init', async () => {
        state.initMode = 'pending';

        await import('./about');

        expect(state.order).toEqual(['init', 'render']);
        expect(markupOf(state.render.mock.calls[0][0])).toBe('<i>About</i>');
    });

    test('Local Web Share waits for init and draws its app with the tools', async () => {
        await import('./lwShare');

        expect(state.order).toEqual(['init', 'init-done', 'render']);
        expect(markupOf(state.render.mock.calls[0][0])).toBe(
            '<i>LWShare</i><i>WindowTools</i>',
        );
    });

    test('the Markdown preview waits for the language before drawing', async () => {
        await import('./markdownPreview');

        expect(state.order).toEqual(['init', 'init-done', 'render']);
        expect(markupOf(state.render.mock.calls[0][0])).toBe(
            '<i>MarkdownPreview</i>',
        );
    });
});

describe('Settings', () => {
    test('mounts the settings page with alerts, toasts and menus, and reloads the app windows on close', async () => {
        await import('./setting');
        await settle();

        expect(markupOf(state.run.mock.calls[0][0])).toBe(
            '<i>Setting</i><i>ProgressBar</i><i>Toast</i><i>Alert</i><i>ContextMenu</i><i>WindowTools</i>',
        );

        globalThis.dispatchEvent(new Event('beforeunload'));
        expect(state.forceReload).toHaveBeenCalledOnce();
    });
});

describe('the Bible Reader', () => {
    test('mounts the reader and its panels, and hides the screens a second later when it is the main window', async () => {
        vi.useFakeTimers();

        await import('./reader');

        expect(markupOf(state.run.mock.calls[0][0])).toBe(
            '<i data-flex="bible-reader-main">BibleReader</i><i>ProgressBar</i><i>Toast</i><i>ContextMenu</i><i>Alert</i><i>WindowTools</i><i>LookupPanels</i><i>GraphPanels</i><i>ArchiveMenu</i><i>LangMenu</i>',
        );
        expect(state.hideAllScreens).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1000);
        expect(state.hideAllScreens).toHaveBeenCalledOnce();
    });

    test('leaves the screens alone in a second reader window', async () => {
        vi.useFakeTimers();
        state.isMainWindow = false;

        await import('./reader');
        vi.advanceTimersByTime(1000);

        expect(state.hideAllScreens).not.toHaveBeenCalled();
    });
});

describe('the help window', () => {
    test('plugs the app language in before drawing', async () => {
        await import('./chatbot');
        await settle();

        expect(state.order).toEqual([
            'init',
            'plug-language',
            'render',
            'init-done',
        ]);
        expect(state.plugAppFont).toHaveBeenCalledOnce();
        expect(markupOf(state.render.mock.calls[0][0])).toBe('<i>Chatbot</i>');
    });

    test('still draws, in English, after reporting a failed init', async () => {
        state.initMode = 'reject';

        await import('./chatbot');

        await vi.waitFor(() => {
            expect(state.render).toHaveBeenCalledOnce();
        });
        expect(state.handleError).toHaveBeenCalledWith(state.initError);
        expect(state.plugLanguage).not.toHaveBeenCalled();
    });
});

describe('the AI Chat window', () => {
    test('hands the guest pages the app font and the language face for its letters only', async () => {
        state.languageFont = {
            family: 'Battambang',
            css: '@font-face{}',
            scriptPatternSource: '[\\u1780-\\u17FF]',
        };

        await import('./aichat');
        await settle();

        expect(state.plugLanguage).toHaveBeenCalledOnce();
        expect(state.setLanguageFont).toHaveBeenCalledWith({
            family: 'Battambang',
            css: '@font-face{}',
            unicodeRange: 'U+1780-17FF',
        });
        await vi.waitFor(() => {
            expect(state.setAppFontFamily).toHaveBeenCalledWith('Battambang');
        });
        expect(markupOf(state.render.mock.calls[0][0])).toBe('<i>AiChat</i>');
    });

    test('clears the guest language face when the language has none or no range', async () => {
        await import('./aichat');
        await settle();
        expect(state.setLanguageFont).toHaveBeenLastCalledWith(null);

        vi.resetModules();
        state.order = [];
        state.languageFont = {
            family: 'X',
            css: '',
            scriptPatternSource: '[a-z]',
        };
        state.unicodeRange = null;
        await import('./aichat');
        await settle();
        expect(state.setLanguageFont).toHaveBeenLastCalledWith(null);
    });

    test('still draws after reporting a failed init', async () => {
        state.initMode = 'reject';

        await import('./aichat');

        await vi.waitFor(() => {
            expect(state.render).toHaveBeenCalledOnce();
        });
        expect(state.handleError).toHaveBeenCalledWith(state.initError);
    });
});

describe('the Bible note editor window', () => {
    const noteData = {
        note: { id: 'note-1' },
        noteItem: { id: 'item-1' },
        isReadOnly: true,
        filePath: '/notes/a.json',
    };

    test('refuses to start without note data', async () => {
        await import('./bibleNote');

        // The entry's init callback is what throws.
        await expect(state.lastInit).rejects.toThrow(
            'No bible note data found',
        );
        expect(state.run).not.toHaveBeenCalled();
    });

    test('mounts the editor over the note, opens search from the menu, and unmounts with its element', async () => {
        state.bibleNoteData = noteData;

        await import('./bibleNote');
        await settle();

        expect(state.initBibleNote).toHaveBeenCalledWith(noteData);
        const tree = state.run.mock.calls[0][0];
        expect(markupOf(tree)).toContain(
            '<i data-read-only="true">NoteItemEditor</i><i>WindowTools</i>',
        );

        // A click on another feature's menu item carries no clickData.
        state.menuHandlers[0]({}, undefined);
        state.menuHandlers[0]({}, { isOpenSearch: false });
        expect(state.bibleNote.searchText).not.toHaveBeenCalled();
        state.menuHandlers[0]({}, { isOpenSearch: true });
        expect(state.bibleNote.searchText).toHaveBeenCalledWith('');

        // The root div hands itself to the editor and takes it back.
        const rootDiv = (tree as any).props.children[0];
        const element = document.createElement('div');
        expect(rootDiv.props.ref(null)).toBeUndefined();
        const cleanup = rootDiv.props.ref(element);
        expect(state.bibleNote.render).toHaveBeenCalledWith(element);
        cleanup();
        expect(state.bibleNote.unmount).toHaveBeenCalledOnce();
    });
});
