// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    initMode: 'resolve' as 'resolve' | 'reject',
    initError: new Error('settings unreadable'),
    isDarkMode: true,
    rootIds: [] as (string | undefined)[],
    render: vi.fn(),
    dashboard: null as any,
    editor: { focusFence: vi.fn() },
    openLyric: { value: null as string | null },
    lyric: {
        filePath: '/docs/Amazing Grace.own',
        setContent: vi.fn(),
        save: vi.fn(),
    },
    content: 'title: Amazing Grace',
    slideId: 7 as number | null,
    mountError: null as Error | null,
    slides: [] as { id: number; openLyricKey: string }[],
    lyricAppDocument: { openLyric: null as unknown, getSlidesQuick: vi.fn() },
    getDocument: vi.fn(),
}));

vi.mock('./bootstrapCss', () => ({}));
vi.mock('./boot', () => ({
    init: () =>
        state.initMode === 'reject'
            ? Promise.reject(state.initError)
            : Promise.resolve(),
}));
vi.mock('./others/AppWindowToolsComp', () => ({
    default: () => <i>WindowTools</i>,
}));
vi.mock('./others/rootHelpers', () => ({
    getReactRoot: (id?: string) => {
        state.rootIds.push(id);
        return { render: state.render };
    },
}));
vi.mock('./others/themeHelpers', () => ({
    checkIsDarkMode: () => state.isDarkMode,
}));
vi.mock('./lyricEditorBoot', () => ({
    getDashboardInstance: () => ({
        dashboard: state.dashboard,
        editor: state.editor,
        openLyric: state.openLyric,
    }),
    getLyric: async () => ({
        lyric: state.lyric,
        content: state.content,
        slideId: state.slideId,
    }),
}));
vi.mock('./lyric-list/LyricAppDocument', () => ({
    default: { getInstance: state.getDocument },
}));

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.resetModules();
    state.initMode = 'resolve';
    state.isDarkMode = true;
    state.rootIds = [];
    state.slideId = 7;
    state.mountError = null;
    state.slides = [
        { id: 6, openLyricKey: 'v1' },
        { id: 7, openLyricKey: 'c1' },
    ];
    state.openLyric = { value: null };
    state.lyricAppDocument = {
        openLyric: null,
        getSlidesQuick: vi.fn(async () => state.slides),
    };
    state.getDocument.mockImplementation(() => state.lyricAppDocument);
    state.dashboard = {
        isEditorOpened: false,
        loadValue: null,
        saveValue: null,
        mount: vi.fn(async () => {
            if (state.mountError !== null) {
                throw state.mountError;
            }
        }),
    };
    document.body.removeAttribute('data-theme');
    document.body.removeAttribute('data-bs-theme');
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    consoleError.mockRestore();
});

describe('lyric editor window', () => {
    test('themes the body, loads and saves through the lyric, and opens the slide asked for', async () => {
        await import('./lyricEditor');

        expect(document.body.getAttribute('data-theme')).toBe('dark');
        expect(document.body.getAttribute('data-bs-theme')).toBe('dark');
        expect(await state.dashboard.loadValue()).toBe('title: Amazing Grace');
        await state.dashboard.saveValue('title: New');
        expect(state.lyric.setContent).toHaveBeenCalledWith('title: New');
        expect(state.lyric.save).toHaveBeenCalledOnce();

        await vi.waitFor(() => {
            expect(state.editor.focusFence).toHaveBeenCalledWith('c1');
        });
        expect(state.dashboard.isEditorOpened).toBe(true);
        expect(state.openLyric.value).toBe('title: Amazing Grace');
        expect(state.getDocument).toHaveBeenCalledWith(
            '/docs/Amazing Grace.own',
        );
        expect(state.lyricAppDocument.openLyric).toBe(state.openLyric);

        // The window tools are mounted into their own container after init.
        await vi.waitFor(() => {
            expect(state.render).toHaveBeenCalledOnce();
        });
        expect(state.rootIds).toEqual(['app-window-tools']);
        expect(renderToStaticMarkup(state.render.mock.calls[0][0])).toBe(
            '<i>WindowTools</i>',
        );
    });

    test('opens no slide when none was asked for or it no longer exists', async () => {
        state.isDarkMode = false;
        state.slideId = null;
        await import('./lyricEditor');
        await vi.waitFor(() => {
            expect(state.dashboard.mount).toHaveBeenCalledOnce();
        });
        expect(document.body.getAttribute('data-theme')).toBe('light');
        expect(state.getDocument).not.toHaveBeenCalled();

        vi.resetModules();
        state.slideId = 99;
        await import('./lyricEditor');
        await vi.waitFor(() => {
            expect(state.lyricAppDocument.getSlidesQuick).toHaveBeenCalled();
        });
        await Promise.resolve();
        expect(state.editor.focusFence).not.toHaveBeenCalled();
        expect(state.dashboard.isEditorOpened).toBe(false);
    });

    test('keeps the editor when the window tools or the dashboard fail, and logs why', async () => {
        state.initMode = 'reject';
        state.mountError = new Error('dashboard failed');

        await import('./lyricEditor');

        await vi.waitFor(() => {
            expect(consoleError).toHaveBeenCalledTimes(2);
        });
        expect(consoleError).toHaveBeenCalledWith(
            'Failed to mount the app window tools.',
            state.initError,
        );
        expect(consoleError).toHaveBeenCalledWith(
            'Failed to boot the Open Lyric dashboard.',
            state.mountError,
        );
        expect(state.render).not.toHaveBeenCalled();
    });
});
