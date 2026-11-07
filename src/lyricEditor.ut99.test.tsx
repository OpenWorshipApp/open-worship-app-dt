// @vitest-environment jsdom

import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `lyricEditor.tsx` is the one window that never goes through `run`: it mounts
// the Open Lyric dashboard by hand at module top level. Each test re-evaluates
// the entry (`vi.resetModules()`); every mock reads its state from this hoisted
// bundle, so the cached mock factories see each test's own objects.
const h = vi.hoisted(() => {
    const AppWindowToolsComp = () => null;
    const ChatbotButtonComp = ({ filePath }: { filePath: string }) => {
        return `robot for ${filePath}`;
    };
    return {
        AppWindowToolsComp,
        ChatbotButtonComp,
        createSync: vi.fn(),
        applyText: vi.fn(),
        sync: null as any,
        slot: null as any,
        isDarkMode: false,
        init: vi.fn(),
        getReactRoot: vi.fn(),
        rootRender: vi.fn(),
        getDashboardInstance: vi.fn(),
        getLyric: vi.fn(),
        getLyricAppDocument: vi.fn(),
        dashboard: null as any,
        editor: null as any,
        openLyric: null as any,
        lyric: null as any,
        lyricAppDocument: null as any,
    };
});

vi.mock('./bootstrapCss', () => ({}));
vi.mock('./boot', () => ({ init: h.init }));
vi.mock('./lyric-list/LyricAppDocument', () => ({
    default: { getInstance: h.getLyricAppDocument },
}));
vi.mock('./lyricEditorBoot', () => ({
    getDashboardInstance: h.getDashboardInstance,
    getLyric: h.getLyric,
}));
vi.mock('./others/AppWindowToolsComp', () => ({
    default: h.AppWindowToolsComp,
}));
vi.mock('./others/rootHelpers', () => ({ getReactRoot: h.getReactRoot }));
// The 🤖 left of Reset / Save and the editor following a song changed from
// outside (`lyricEditorChatbotSync.ts`, tested on its own).
vi.mock('./lyric-list/LyricEditorChatbotButtonComp', () => ({
    default: h.ChatbotButtonComp,
}));
vi.mock('./lyric-list/lyricEditorChatbotSync', () => ({
    applyLyricEditorText: h.applyText,
    createLyricEditorSync: h.createSync,
}));
vi.mock('./others/themeHelpers', () => ({
    checkIsDarkMode: () => h.isDarkMode,
}));

async function flush() {
    for (let i = 0; i < 12; i++) {
        await Promise.resolve();
    }
}

function useLyric(slideId: number | null) {
    h.getLyric.mockResolvedValue({
        lyric: h.lyric,
        content: '# Amazing Grace',
        slideId,
    });
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.resetModules();
    h.isDarkMode = false;
    h.slot = document.createElement('div');
    h.dashboard = {
        mount: vi.fn().mockResolvedValue(undefined),
        getSlot: vi.fn(() => h.slot),
        value: '# Amazing Grace',
        editor: null,
    };
    h.sync = { markSaved: vi.fn() };
    h.createSync.mockReturnValue(h.sync);
    h.applyText.mockReset().mockReturnValue(false);
    h.editor = { focusFence: vi.fn() };
    h.openLyric = {};
    h.lyric = {
        filePath: '/data/documents/Amazing Grace.lyric',
        setContent: vi.fn(),
        save: vi.fn(),
    };
    h.lyricAppDocument = {
        getSlidesQuick: vi.fn().mockResolvedValue([
            { id: 1, openLyricKey: 'verse-1' },
            { id: 3, openLyricKey: 'chorus-1' },
        ]),
    };
    h.init.mockResolvedValue(undefined);
    h.getReactRoot.mockReturnValue({ render: h.rootRender });
    h.getDashboardInstance.mockReturnValue({
        dashboard: h.dashboard,
        editor: h.editor,
        openLyric: h.openLyric,
    });
    h.getLyricAppDocument.mockReturnValue(h.lyricAppDocument);
    useLyric(null);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    consoleError.mockRestore();
    document.body.removeAttribute('data-theme');
    document.body.removeAttribute('data-bs-theme');
});

describe('lyricEditor.tsx', () => {
    test('a light app gets a light page', async () => {
        await import('./lyricEditor');
        expect(document.body.getAttribute('data-theme')).toBe('light');
        expect(document.body.getAttribute('data-bs-theme')).toBe('light');
    });

    test('a dark app gets a dark page', async () => {
        h.isDarkMode = true;
        await import('./lyricEditor');
        expect(document.body.getAttribute('data-theme')).toBe('dark');
        expect(document.body.getAttribute('data-bs-theme')).toBe('dark');
    });

    test('mounts the dashboard without waiting for init', async () => {
        h.init.mockReturnValue(new Promise(() => {}));
        await import('./lyricEditor');
        await flush();
        expect(h.dashboard.mount).toHaveBeenCalledOnce();
        expect(h.getReactRoot).not.toHaveBeenCalled();
    });

    test('draws the window tools in their own root once init is done', async () => {
        await import('./lyricEditor');
        await flush();
        expect(h.getReactRoot).toHaveBeenCalledExactlyOnceWith(
            'app-window-tools',
        );
        expect(h.rootRender).toHaveBeenCalledOnce();
        const tree = h.rootRender.mock.calls[0][0];
        expect(tree.type).toBe(StrictMode);
        expect(tree.props.children.type).toBe(h.AppWindowToolsComp);
    });

    test('a failed init is logged and the editor still opens', async () => {
        const error = new Error('settings unreadable');
        h.init.mockRejectedValue(error);
        await import('./lyricEditor');
        await flush();
        expect(consoleError).toHaveBeenCalledExactlyOnceWith(
            'Failed to mount the app window tools.',
            error,
        );
        expect(h.rootRender).not.toHaveBeenCalled();
        expect(h.dashboard.mount).toHaveBeenCalledOnce();
    });

    test('the dashboard loads the file content and saves through the lyric file', async () => {
        const order: string[] = [];
        h.lyric.setContent.mockImplementation(async (value: string) => {
            order.push(`set:${value}`);
        });
        h.lyric.save.mockImplementation(async () => {
            order.push('save');
        });
        await import('./lyricEditor');

        await expect(h.dashboard.loadValue()).resolves.toBe('# Amazing Grace');
        await h.dashboard.saveValue('# Amazing Grace (edited)');
        expect(order).toEqual(['set:# Amazing Grace (edited)', 'save']);
    });

    test('with no slide asked for, nothing is focused', async () => {
        useLyric(null);
        await import('./lyricEditor');
        await flush();
        expect(h.getLyricAppDocument).not.toHaveBeenCalled();
        expect(h.openLyric.value).toBeUndefined();
        expect(h.dashboard.isEditorOpened).toBeUndefined();
        expect(h.editor.focusFence).not.toHaveBeenCalled();
    });

    test('opens the editor on the slide the URL asked for', async () => {
        useLyric(3);
        await import('./lyricEditor');
        await flush();
        expect(h.openLyric.value).toBe('# Amazing Grace');
        expect(h.getLyricAppDocument).toHaveBeenCalledExactlyOnceWith(
            '/data/documents/Amazing Grace.lyric',
        );
        expect(h.lyricAppDocument.openLyric).toBe(h.openLyric);
        expect(h.dashboard.isEditorOpened).toBe(true);
        expect(h.editor.focusFence).toHaveBeenCalledExactlyOnceWith('chorus-1');
    });

    test('a slide id the song no longer has opens nothing', async () => {
        useLyric(99);
        await import('./lyricEditor');
        await flush();
        expect(h.lyricAppDocument.getSlidesQuick).toHaveBeenCalledOnce();
        expect(h.dashboard.isEditorOpened).toBeUndefined();
        expect(h.editor.focusFence).not.toHaveBeenCalled();
    });

    test('a dashboard that fails to mount is logged', async () => {
        const error = new Error('mount failed');
        h.dashboard.mount.mockRejectedValue(error);
        await import('./lyricEditor');
        await flush();
        expect(consoleError).toHaveBeenCalledExactlyOnceWith(
            'Failed to boot the Open Lyric dashboard.',
            error,
        );
    });

    test('once the dashboard is up, the editor follows the song and the 🤖 goes left of Reset / Save', async () => {
        h.editor.value = '';
        h.dashboard.editor = h.editor;
        await import('./lyricEditor');
        await flush();
        expect(h.createSync).toHaveBeenCalledOnce();
        const options = h.createSync.mock.calls[0][0];
        expect(options.lyric).toBe(h.lyric);
        expect(options.initialContent).toBe('# Amazing Grace');
        expect(options.getShown()).toBe('# Amazing Grace');
        options.setShown('# Changed');
        expect(h.editor.value).toBe('# Changed');
        expect(h.dashboard.getSlot).toHaveBeenCalledWith(0);
        await vi.waitFor(() => {
            expect(h.slot.textContent).toBe(
                'robot for /data/documents/Amazing Grace.lyric',
            );
        });
        expect(consoleError).not.toHaveBeenCalled();
    });

    test('a song with unsaved edits opens on its saved text, the edits on top', async () => {
        h.lyric.getJsonData = vi.fn(async (isOriginal: boolean) => {
            return isOriginal ? { content: '# Saved' } : null;
        });
        h.applyText.mockReturnValue(true);
        await import('./lyricEditor');
        await flush();
        // Clean is what is on disk; Reset / Save light up for the rest.
        await expect(h.dashboard.loadValue()).resolves.toBe('# Saved');
        expect(h.applyText).toHaveBeenCalledWith(null, '# Amazing Grace');
        expect(h.createSync.mock.calls[0][0].initialContent).toBe(
            '# Amazing Grace',
        );
    });

    test('a save says so to the sync, so the editor and the song agree again', async () => {
        await import('./lyricEditor');
        await flush();
        await h.dashboard.saveValue('# Saved');
        expect(h.sync.markSaved).toHaveBeenCalledWith('# Saved');
    });

    test('a lyric that cannot be opened stops the dashboard from mounting', async () => {
        h.getLyric.mockRejectedValue(new Error('Lyric file not specified'));
        await expect(import('./lyricEditor')).rejects.toThrow(
            'Lyric file not specified',
        );
        expect(h.dashboard.mount).not.toHaveBeenCalled();
    });
});
