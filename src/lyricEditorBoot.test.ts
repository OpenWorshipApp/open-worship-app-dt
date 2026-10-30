// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => {
    const installed: string[] = [];
    const instances: Record<string, any[]> = {};
    function record(name: string, instance: any) {
        (instances[name] ??= []).push(instance);
    }
    class OpenLyricDashboard {
        static installShellStyle() {
            installed.push('dashboard-style');
        }
        static installShellMarkup(options: unknown) {
            installed.push(`dashboard-markup:${JSON.stringify(options)}`);
        }
        isWeb: boolean;
        openLyric: unknown = null;
        editor: unknown = null;
        openLyricMarkdownManager: unknown = null;
        constructor(
            public options: { container: HTMLElement; isWeb: boolean },
        ) {
            this.isWeb = options.isWeb;
            record('dashboard', this);
        }
    }
    class Editor {
        static installShellStyle() {
            installed.push('editor-style');
        }
        static installShellMarkup() {
            installed.push('editor-markup');
        }
        plugins: [string, unknown][] = [];
        verticalLines: unknown[] = [];
        constructor(public options: unknown) {
            record('editor', this);
        }
        addPlugin(name: string, plugin: unknown) {
            this.plugins.push([name, plugin]);
        }
        setVerticalLines(lines: unknown[]) {
            this.verticalLines.push(lines);
        }
    }
    class OpenLyricMarkdownManager {
        static installShellStyle() {
            installed.push('markdown-style');
        }
        static installShellMarkup() {
            installed.push('markdown-markup');
        }
        constructor() {
            record('markdown', this);
        }
    }
    class OpenLyric {
        static installShellStyle() {
            installed.push('open-lyric-style');
        }
        static installShellMarkup() {
            installed.push('open-lyric-markup');
        }
        plugins: [string, unknown][] = [];
        constructor() {
            record('openLyric', this);
        }
        addPlugin(name: string, plugin: unknown) {
            this.plugins.push([name, plugin]);
        }
    }
    class EditorOpenLyricPlugin {}
    class OpenLyricPluginPlayer {}
    return {
        installed,
        instances,
        classes: {
            OpenLyricDashboard,
            Editor,
            OpenLyricMarkdownManager,
            OpenLyric,
            EditorOpenLyricPlugin,
            OpenLyricPluginPlayer,
        },
        isDarkMode: false,
        themeListeners: [] as [string[], () => void][],
        applyTheme: vi.fn(),
        installPrint: vi.fn(),
        langDataList: [] as any[],
        initLangCss: vi.fn(),
        fileParam: 'Amazing Grace.own' as string | null,
        idParam: 3 as number | null,
        dirPath: '/data/Documents' as string | null,
        existingFiles: new Set<string>(),
        lyricContent: 'title: Amazing Grace',
        getLyricInstance: vi.fn(),
    };
});

vi.mock('open-lyric', () => ({
    Editor: state.classes.Editor,
    OpenLyric: state.classes.OpenLyric,
    OpenLyricMarkdownManager: state.classes.OpenLyricMarkdownManager,
    OpenLyricDashboard: state.classes.OpenLyricDashboard,
    EditorOpenLyricPlugin: state.classes.EditorOpenLyricPlugin,
}));
vi.mock('open-lyric-plugin-player', () => ({
    OpenLyricPluginPlayer: state.classes.OpenLyricPluginPlayer,
}));
vi.mock('./helper/constants.ts', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'app-document-dir' },
}));
vi.mock('./helper/DirSource.ts', () => ({
    default: {
        getDirPathBySettingName: (name: string) =>
            name === 'app-document-dir' ? state.dirPath : null,
    },
}));
vi.mock('./helper/domHelpers.ts', () => ({
    getParamFileFullName: () => state.fileParam,
    getParamIdNum: () => state.idParam,
}));
vi.mock('./lyric-list/Lyric.ts', () => ({
    default: { getInstance: state.getLyricInstance },
}));
vi.mock('./server/fileHelpers.ts', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    fsExistSync: (filePath: string) => state.existingFiles.has(filePath),
}));
vi.mock('./server/appProvider.ts', () => ({
    default: { windowTitle: 'Open Worship' },
}));
vi.mock('./lang/langHelpers.ts', () => ({
    genOpenLyricFontFaces: () => '@font-face {}',
    getAllLangsAsync: async () => state.langDataList,
    initLangCss: state.initLangCss,
}));
vi.mock('./lyric-list/lyricHelpers.ts', () => ({
    applyOpenLyricTheme: state.applyTheme,
}));
vi.mock('./lyric-list/lyricPrintHelpers.ts', () => ({
    installOpenLyricPrintPopupHandler: state.installPrint,
}));
vi.mock('./others/themeHelpers.tsx', () => ({
    THEME_CHANGE_EVENT: 'app:theme-changed',
    checkIsDarkMode: () => state.isDarkMode,
}));
vi.mock('./event/EventHandler.ts', () => ({
    default: {
        registerEventListener: (events: string[], listener: () => void) => {
            state.themeListeners.push([events, listener]);
        },
    },
}));

import { getDashboardInstance, getLyric } from './lyricEditorBoot';

beforeEach(() => {
    state.installed.length = 0;
    for (const key of Object.keys(state.instances)) {
        delete state.instances[key];
    }
    state.isDarkMode = false;
    state.themeListeners = [];
    state.langDataList = [];
    state.fileParam = 'Amazing Grace.own';
    state.idParam = 3;
    state.dirPath = '/data/Documents';
    state.existingFiles = new Set(['/data/Documents/Amazing Grace.own']);
    state.getLyricInstance.mockImplementation((filePath: string) => ({
        filePath,
        fileSource: { name: 'Amazing Grace' },
        getContent: async () => state.lyricContent,
    }));
    document.body.innerHTML = '<div data-ol-ref="app"></div>';
    document.title = 'Open Worship';
});

afterEach(() => {
    document.body.innerHTML = '';
});

async function flush() {
    for (let index = 0; index < 6; index++) {
        await Promise.resolve();
    }
}

describe('lyric editor dashboard', () => {
    test('installs every shell, wires the plugins and mounts on the app container', async () => {
        const initPlugins = vi.fn();
        state.langDataList = [
            { locale: 'km', initOpenLyricPlugins: initPlugins },
            { locale: 'en' },
        ];

        const { dashboard, editor, openLyric, openLyricMarkdownManager } =
            getDashboardInstance() as any;

        expect(state.installPrint).toHaveBeenCalledOnce();
        expect(state.installed).toEqual([
            'dashboard-style',
            'editor-style',
            'markdown-style',
            'open-lyric-style',
            'dashboard-markup:{"includeRawTextImport":true}',
            'editor-markup',
            'markdown-markup',
            'open-lyric-markup',
        ]);
        expect(dashboard.options.container).toBe(
            document.querySelector('[data-ol-ref="app"]'),
        );
        // Built as a web dashboard, then switched off it for the desktop app.
        expect(dashboard.options.isWeb).toBe(true);
        expect(dashboard.isWeb).toBe(false);
        expect(dashboard.openLyric).toBe(openLyric);
        expect(dashboard.editor).toBe(editor);
        expect(dashboard.openLyricMarkdownManager).toBe(
            openLyricMarkdownManager,
        );
        expect(openLyric.plugins[0][0]).toBe('player');
        expect(openLyric.plugins[0][1]).toBeInstanceOf(
            state.classes.OpenLyricPluginPlayer,
        );
        expect(editor.options).toEqual({ selectionState: true });
        expect(editor.plugins[0][0]).toBe('open-lyric');

        await flush();
        expect(initPlugins).toHaveBeenCalledWith(
            expect.objectContaining({
                editor,
                openLyric,
                openLyricMarkdownManager,
            }),
        );
        expect(state.initLangCss).toHaveBeenCalledTimes(2);
    });

    test('draws light guide lines, then re-themes on a theme change', () => {
        const { dashboard, editor } = getDashboardInstance() as any;

        expect(state.applyTheme).toHaveBeenCalledWith(dashboard);
        expect(editor.verticalLines[0]).toEqual([
            { characters: 40, color: 'rgba(0, 0, 0, 0.1)' },
            { characters: 60, color: 'rgba(0, 0, 0, 0.1)' },
            { width: 2, characters: 70, color: 'rgba(0, 0, 0, 0.1)' },
        ]);

        const [events, listener] = state.themeListeners[0];
        expect(events).toEqual(['app:theme-changed']);
        state.isDarkMode = true;
        listener();
        expect(state.applyTheme).toHaveBeenCalledTimes(2);
        expect(editor.verticalLines[1][0]).toEqual({
            characters: 40,
            color: 'rgba(255, 255, 255, 0.1)',
        });
    });

    test('refuses to start without the app container', () => {
        document.body.innerHTML = '';

        expect(() => getDashboardInstance()).toThrow('Root element not found');
    });
});

describe('lyric to edit', () => {
    test('reads the file named in the address and titles the window with it', async () => {
        const result = await getLyric();

        expect(state.getLyricInstance).toHaveBeenCalledWith(
            '/data/Documents/Amazing Grace.own',
        );
        expect(result.content).toBe('title: Amazing Grace');
        expect(result.slideId).toBe(3);
        expect(document.title).toBe('Open Worship - (Amazing Grace)');
    });

    test('says which piece is missing when the file cannot be found', async () => {
        state.fileParam = null;
        await expect(getLyric()).rejects.toThrow('Lyric file not specified');

        state.fileParam = 'Amazing Grace.own';
        state.dirPath = null;
        await expect(getLyric()).rejects.toThrow('Documents directory not set');

        state.dirPath = '/data/Documents';
        state.existingFiles.clear();
        await expect(getLyric()).rejects.toThrow(
            'Lyric file not found: Amazing Grace.own',
        );
        expect(state.getLyricInstance).not.toHaveBeenCalled();
    });
});
