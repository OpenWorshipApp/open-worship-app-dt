// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getDashboardInstance, getLyric } from './lyricEditorBoot';

// The Open Lyric dashboard window is wired by hand, not by `boot`/`run`. Every
// import is mocked (the real setting-name constants excepted) so each test sees
// what the wiring does: what is installed, constructed, connected and themed,
// and which lyric file the window opens.
const h = vi.hoisted(() => {
    const events: string[] = [];
    const instances = {
        dashboards: [] as any[],
        editors: [] as any[],
        openLyrics: [] as any[],
        markdownManagers: [] as any[],
        players: [] as any[],
        editorPlugins: [] as any[],
    };
    class Editor {
        static installShellStyle() {
            events.push('style:Editor');
        }
        static installShellMarkup(...args: unknown[]) {
            events.push(`markup:Editor${JSON.stringify(args)}`);
        }
        options: unknown;
        plugins: [string, unknown][] = [];
        verticalLines: unknown[] = [];
        constructor(options: unknown) {
            this.options = options;
            instances.editors.push(this);
        }
        addPlugin(name: string, plugin: unknown) {
            this.plugins.push([name, plugin]);
        }
        setVerticalLines(lines: unknown) {
            this.verticalLines.push(lines);
        }
    }
    class OpenLyric {
        static installShellStyle() {
            events.push('style:OpenLyric');
        }
        static installShellMarkup(...args: unknown[]) {
            events.push(`markup:OpenLyric${JSON.stringify(args)}`);
        }
        plugins: [string, unknown][] = [];
        constructor() {
            instances.openLyrics.push(this);
        }
        addPlugin(name: string, plugin: unknown) {
            this.plugins.push([name, plugin]);
        }
    }
    class OpenLyricMarkdownManager {
        static installShellStyle() {
            events.push('style:OpenLyricMarkdownManager');
        }
        static installShellMarkup(...args: unknown[]) {
            events.push(
                `markup:OpenLyricMarkdownManager${JSON.stringify(args)}`,
            );
        }
        constructor() {
            instances.markdownManagers.push(this);
        }
    }
    class OpenLyricDashboard {
        static installShellStyle() {
            events.push('style:OpenLyricDashboard');
        }
        static installShellMarkup(...args: unknown[]) {
            events.push(`markup:OpenLyricDashboard${JSON.stringify(args)}`);
        }
        options: any;
        isWeb: boolean;
        constructor(options: any) {
            this.options = options;
            this.isWeb = options.isWeb;
            instances.dashboards.push(this);
        }
    }
    class EditorOpenLyricPlugin {
        constructor() {
            instances.editorPlugins.push(this);
        }
    }
    class OpenLyricPluginPlayer {
        constructor() {
            instances.players.push(this);
        }
    }
    return {
        events,
        instances,
        classes: {
            Editor,
            OpenLyric,
            OpenLyricMarkdownManager,
            OpenLyricDashboard,
            EditorOpenLyricPlugin,
            OpenLyricPluginPlayer,
        },
        isDarkMode: false,
        windowTitle: 'Open Worship',
        installOpenLyricPrintPopupHandler: vi.fn(),
        applyOpenLyricTheme: vi.fn(),
        registerEventListener: vi.fn(),
        getAllLangsAsync: vi.fn(),
        initLangCss: vi.fn(),
        genOpenLyricFontFaces: vi.fn(),
        getParamFileFullName: vi.fn(),
        getParamIdNum: vi.fn(),
        getDirPathBySettingName: vi.fn(),
        fsExistSync: vi.fn(),
        getInstance: vi.fn(),
    };
});

vi.mock('open-lyric', () => ({
    Editor: h.classes.Editor,
    OpenLyric: h.classes.OpenLyric,
    OpenLyricMarkdownManager: h.classes.OpenLyricMarkdownManager,
    OpenLyricDashboard: h.classes.OpenLyricDashboard,
    EditorOpenLyricPlugin: h.classes.EditorOpenLyricPlugin,
}));
vi.mock('open-lyric-plugin-player', () => ({
    OpenLyricPluginPlayer: h.classes.OpenLyricPluginPlayer,
}));
vi.mock('./helper/DirSource.ts', () => ({
    default: { getDirPathBySettingName: h.getDirPathBySettingName },
}));
vi.mock('./helper/domHelpers.ts', () => ({
    getParamFileFullName: h.getParamFileFullName,
    getParamIdNum: h.getParamIdNum,
}));
vi.mock('./lyric-list/Lyric.ts', () => ({
    default: { getInstance: h.getInstance },
}));
vi.mock('./server/fileHelpers.ts', () => ({
    pathJoin: (...parts: string[]) => {
        return parts.join('/');
    },
    fsExistSync: h.fsExistSync,
}));
vi.mock('./server/appProvider.ts', () => ({
    default: {
        get windowTitle() {
            return h.windowTitle;
        },
    },
}));
vi.mock('./lang/langHelpers.ts', () => ({
    genOpenLyricFontFaces: h.genOpenLyricFontFaces,
    getAllLangsAsync: h.getAllLangsAsync,
    initLangCss: h.initLangCss,
}));
vi.mock('./lyric-list/lyricHelpers.ts', () => ({
    applyOpenLyricTheme: h.applyOpenLyricTheme,
}));
vi.mock('./lyric-list/lyricPrintHelpers.ts', () => ({
    installOpenLyricPrintPopupHandler: h.installOpenLyricPrintPopupHandler,
}));
vi.mock('./others/themeHelpers.tsx', () => ({
    checkIsDarkMode: () => h.isDarkMode,
    THEME_CHANGE_EVENT: 'app:theme-changed',
}));
vi.mock('./event/EventHandler.ts', () => ({
    default: { registerEventListener: h.registerEventListener },
}));

const LIGHT_LINE = 'rgba(0, 0, 0, 0.1)';
const DARK_LINE = 'rgba(255, 255, 255, 0.1)';

function verticalLines(color: string) {
    return [
        { characters: 40, color },
        { characters: 60, color },
        { width: 2, characters: 70, color },
    ];
}

async function flush() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

beforeEach(() => {
    h.events.length = 0;
    for (const list of Object.values(h.instances)) {
        list.length = 0;
    }
    h.isDarkMode = false;
    h.windowTitle = 'Open Worship';
    h.installOpenLyricPrintPopupHandler.mockImplementation(() => {
        h.events.push('print-popup-handler');
    });
    h.getAllLangsAsync.mockResolvedValue([]);
});

describe('getDashboardInstance', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.dataset.olRef = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    test('installs the print handler, every shell style, then every shell markup', () => {
        getDashboardInstance();
        expect(h.events).toEqual([
            'print-popup-handler',
            'style:OpenLyricDashboard',
            'style:Editor',
            'style:OpenLyricMarkdownManager',
            'style:OpenLyric',
            'markup:OpenLyricDashboard[{"includeRawTextImport":true}]',
            'markup:Editor[]',
            'markup:OpenLyricMarkdownManager[]',
            'markup:OpenLyric[]',
        ]);
    });

    test('builds one dashboard in the app container and connects its parts', () => {
        const result = getDashboardInstance();

        expect(h.instances.dashboards).toHaveLength(1);
        const [dashboard] = h.instances.dashboards;
        expect(dashboard.options).toEqual({ container, isWeb: true });
        // Built as the web shell, then told it lives in the desktop app.
        expect(dashboard.isWeb).toBe(false);

        const [openLyric] = h.instances.openLyrics;
        const [markdownManager] = h.instances.markdownManagers;
        const [editor] = h.instances.editors;
        expect(dashboard.openLyric).toBe(openLyric);
        expect(dashboard.openLyricMarkdownManager).toBe(markdownManager);
        expect(dashboard.editor).toBe(editor);
        expect(editor.options).toEqual({ selectionState: true });
        expect(openLyric.plugins).toEqual([['player', h.instances.players[0]]]);
        expect(editor.plugins).toEqual([
            ['open-lyric', h.instances.editorPlugins[0]],
        ]);
        expect(result).toEqual({
            dashboard,
            editor,
            openLyric,
            openLyricMarkdownManager: markdownManager,
        });
    });

    test('themes the dashboard and draws light vertical guides in a light app', () => {
        const { dashboard, editor } = getDashboardInstance();
        expect(h.applyOpenLyricTheme).toHaveBeenCalledExactlyOnceWith(
            dashboard,
        );
        expect((editor as any).verticalLines).toEqual([
            verticalLines(LIGHT_LINE),
        ]);
    });

    test('re-themes and redraws the guides when the app theme changes', () => {
        const { dashboard, editor } = getDashboardInstance();
        expect(h.registerEventListener).toHaveBeenCalledOnce();
        const [eventNames, onThemeChange] =
            h.registerEventListener.mock.calls[0];
        expect(eventNames).toEqual(['app:theme-changed']);

        h.isDarkMode = true;
        onThemeChange();
        expect(h.applyOpenLyricTheme).toHaveBeenCalledTimes(2);
        expect(h.applyOpenLyricTheme).toHaveBeenLastCalledWith(dashboard);
        expect((editor as any).verticalLines).toEqual([
            verticalLines(LIGHT_LINE),
            verticalLines(DARK_LINE),
        ]);
    });

    test('hands every language its Open Lyric plugins and its CSS', async () => {
        const khmer = { locale: 'km-KH', initOpenLyricPlugins: vi.fn() };
        const english = { locale: 'en-US' };
        h.getAllLangsAsync.mockResolvedValue([khmer, english]);

        const { editor, openLyric, openLyricMarkdownManager } =
            getDashboardInstance();
        await flush();

        expect(khmer.initOpenLyricPlugins).toHaveBeenCalledExactlyOnceWith({
            editor,
            openLyric,
            openLyricMarkdownManager,
            // This window's own registry, for a language plugin's Open Lyric
            // half to register into.
            openLyricInternal: expect.anything(),
            genOpenLyricFontFaces: h.genOpenLyricFontFaces,
        });
        expect(h.initLangCss.mock.calls).toEqual([[khmer], [english]]);
    });

    test('refuses a page that has no app container', () => {
        container.remove();
        expect(() => {
            getDashboardInstance();
        }).toThrow('Root element not found');
        expect(h.instances.dashboards).toHaveLength(0);
        expect(h.registerEventListener).not.toHaveBeenCalled();
    });
});

describe('getLyric', () => {
    const originalUrl = globalThis.location.href;
    const lyric = {
        fileSource: { name: 'Amazing Grace' },
        getContent: vi.fn(),
    };

    beforeEach(() => {
        globalThis.history.replaceState(
            null,
            '',
            '/lyricEditor.html?file=Amazing%20Grace.lyric&id=3',
        );
        h.getParamFileFullName.mockReturnValue('Amazing Grace.lyric');
        h.getParamIdNum.mockReturnValue(3);
        h.getDirPathBySettingName.mockReturnValue('/data/documents');
        h.fsExistSync.mockReturnValue(true);
        h.getInstance.mockReturnValue(lyric);
        lyric.getContent.mockResolvedValue('# Amazing Grace');
    });

    afterEach(() => {
        globalThis.history.replaceState(null, '', originalUrl);
        document.title = '';
    });

    test('opens the lyric the URL names in the documents folder and titles the window after it', async () => {
        const result = await getLyric();

        const url = globalThis.location.href;
        expect(url).toContain('?file=Amazing%20Grace.lyric&id=3');
        expect(h.getParamFileFullName).toHaveBeenCalledExactlyOnceWith(url);
        expect(h.getDirPathBySettingName).toHaveBeenCalledExactlyOnceWith(
            'select-dir-app-document',
        );
        expect(h.fsExistSync).toHaveBeenCalledExactlyOnceWith(
            '/data/documents/Amazing Grace.lyric',
        );
        expect(h.getInstance).toHaveBeenCalledExactlyOnceWith(
            '/data/documents/Amazing Grace.lyric',
        );
        expect(document.title).toBe('Open Worship - (Amazing Grace)');
        expect(h.getParamIdNum).toHaveBeenCalledExactlyOnceWith(url);
        expect(result).toEqual({
            lyric,
            content: '# Amazing Grace',
            slideId: 3,
        });
    });

    test('passes a missing slide id through as null', async () => {
        h.getParamIdNum.mockReturnValue(null);
        const result = await getLyric();
        expect(result.slideId).toBeNull();
    });

    test('refuses a URL that names no lyric file', async () => {
        h.getParamFileFullName.mockReturnValue(null);
        await expect(getLyric()).rejects.toThrow('Lyric file not specified');
        expect(h.getDirPathBySettingName).not.toHaveBeenCalled();
    });

    test('refuses when no documents folder is set', async () => {
        h.getDirPathBySettingName.mockReturnValue(null);
        await expect(getLyric()).rejects.toThrow('Documents directory not set');
        expect(h.fsExistSync).not.toHaveBeenCalled();
    });

    test('refuses a lyric file that is not on disk', async () => {
        h.fsExistSync.mockReturnValue(false);
        await expect(getLyric()).rejects.toThrow(
            'Lyric file not found: Amazing Grace.lyric',
        );
        expect(h.getInstance).not.toHaveBeenCalled();
        expect(document.title).toBe('');
    });
});
