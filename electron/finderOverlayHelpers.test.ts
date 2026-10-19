import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('./protocolHelpers', () => ({
    genRouteUrl: (htmlFileFullName: string) => {
        return `https://localhost:3000/${htmlFileFullName}`;
    },
    genRoutProps: () => ({
        preloadFilePath: '/mock/preload.js',
        loadURL: vi.fn(),
    }),
}));

import {
    checkIsFindOverlayHost,
    closeFindOverlay,
    FIND_OVERLAY_HEIGHT,
    FIND_OVERLAY_WIDTH,
    getFindOverlayHostWebContents,
    getFindOverlayWebContents,
    openFindOverlay,
    setFindOverlayMounted,
    startFindOverlayDragging,
    stopFindOverlayDragging,
} from './finderOverlayHelpers';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

function createHostWindow(htmlFileFullName = 'presenter.html') {
    const win = createMockBrowserWindow();
    win.webContents.getURL.mockReturnValue(
        `https://localhost:3000/${htmlFileFullName}`,
    );
    return win;
}

function getLastView() {
    return electronMockState.webContentsViews.at(-1);
}

function fireViewEvent(view: any, eventName: string) {
    const call = view.webContents.on.mock.calls.find(([name]: [string]) => {
        return name === eventName;
    });
    expect(call).toBeDefined();
    call[1]();
}

describe('finderOverlayHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test.each([
        'presenter.html',
        'reader.html',
        'appDocumentEditor.html',
        'screen-mirror.html',
        'experiment.html',
        'setting.html',
        'about.html',
        'lwShare.html',
        'markdownPreview.html',
        'webEditor.html?file=x.html',
        'lyricEditor.html',
        'chatbot.html?uuid=chatbot',
        'aichat.html?uuid=aichat_1',
    ])('%s hosts the find bar', (page) => {
        expect(checkIsFindOverlayHost(createHostWindow(page) as any)).toBe(
            true,
        );
    });

    test.each([
        'screen.html?screenId=0',
        'camera-broker.html',
        'virtual-display.html',
        'bibleNote.html',
        'finder.html',
    ])('%s gets no find bar', (page) => {
        expect(checkIsFindOverlayHost(createHostWindow(page) as any)).toBe(
            false,
        );
    });

    test('a screen served by the mirror, a site and a blank page get none', () => {
        for (const url of [
            'http://127.0.0.1:39240/screen.html?screenId=0',
            'https://accounts.example.com/oauth/authorize',
            'about:blank',
            '',
        ]) {
            const win = createMockBrowserWindow();
            win.webContents.getURL.mockReturnValue(url);
            expect(checkIsFindOverlayHost(win as any)).toBe(false);
        }
    });

    test('pins a transparent view to the top-right of the host window', () => {
        const hostWin = createHostWindow();

        openFindOverlay(hostWin as any);
        const view = getLastView();

        expect(hostWin.contentView.addChildView).toHaveBeenCalledWith(view);
        expect(view.setBackgroundColor).toHaveBeenCalledWith('#00000000');
        expect(view.setBounds).toHaveBeenCalledWith({
            // content width 1200 − width − the 16px edge margin
            x: 1200 - FIND_OVERLAY_WIDTH - 16,
            y: 0,
            width: FIND_OVERLAY_WIDTH,
            height: FIND_OVERLAY_HEIGHT,
        });
        expect(view.webContents.loadURL).toHaveBeenCalledWith(
            'https://localhost:3000/finder.html',
        );
        closeFindOverlay(view.webContents);
    });

    test('a second open focuses the existing bar instead of stacking another', () => {
        const hostWin = createHostWindow();

        openFindOverlay(hostWin as any);
        const view = getLastView();
        setFindOverlayMounted(view.webContents, true);
        openFindOverlay(hostWin as any);

        expect(electronMockState.webContentsViews).toHaveLength(1);
        expect(view.webContents.send).toHaveBeenCalledWith(
            'main:app:focus-find',
        );
        closeFindOverlay(view.webContents);
    });

    // A loaded page that never mounted is a transparent, empty view: reusing it
    // meant every later press focused something invisible and nothing opened.
    test('a bar whose page never mounted is replaced on the next open', () => {
        const hostWin = createHostWindow();
        openFindOverlay(hostWin as any);
        const deadView = getLastView();

        openFindOverlay(hostWin as any);
        const freshView = getLastView();

        expect(freshView).not.toBe(deadView);
        expect(deadView.webContents.send).not.toHaveBeenCalled();
        expect(hostWin.contentView.removeChildView).toHaveBeenCalledWith(
            deadView,
        );
        expect(deadView.webContents.close).toHaveBeenCalledTimes(1);
        expect(hostWin.contentView.addChildView).toHaveBeenLastCalledWith(
            freshView,
        );
        expect(freshView.webContents.loadURL).toHaveBeenCalledWith(
            'https://localhost:3000/finder.html',
        );
        expect(getFindOverlayHostWebContents(deadView.webContents)).toBeNull();
        expect(getFindOverlayWebContents(hostWin.webContents as any)).toBe(
            freshView.webContents,
        );
        closeFindOverlay(freshView.webContents);
    });

    test('a bar still loading is left to finish instead of restarting', () => {
        const hostWin = createHostWindow();
        openFindOverlay(hostWin as any);
        const view = getLastView();
        view.webContents.isLoading.mockReturnValue(true);

        openFindOverlay(hostWin as any);

        expect(electronMockState.webContentsViews).toHaveLength(1);
        expect(view.webContents.close).not.toHaveBeenCalled();
        expect(view.webContents.send).not.toHaveBeenCalled();
        closeFindOverlay(view.webContents);
    });

    test.each(['did-start-loading', 'render-process-gone'])(
        '%s drops the mounted mark, so the next open replaces the bar',
        (eventName) => {
            const hostWin = createHostWindow();
            openFindOverlay(hostWin as any);
            const view = getLastView();
            setFindOverlayMounted(view.webContents, true);

            fireViewEvent(view, eventName);
            openFindOverlay(hostWin as any);

            expect(electronMockState.webContentsViews).toHaveLength(2);
            expect(view.webContents.send).not.toHaveBeenCalled();
            closeFindOverlay(getLastView().webContents);
        },
    );

    test('the page unmounting its bar counts as not drawn', () => {
        const hostWin = createHostWindow();
        openFindOverlay(hostWin as any);
        const view = getLastView();
        setFindOverlayMounted(view.webContents, true);
        setFindOverlayMounted(view.webContents, false);

        openFindOverlay(hostWin as any);

        expect(electronMockState.webContentsViews).toHaveLength(2);
        expect(() => {
            setFindOverlayMounted({ id: 997 } as any, true);
        }).not.toThrow();
        closeFindOverlay(getLastView().webContents);
    });

    test('maps the bar to the page it searches, both ways', () => {
        const hostWin = createHostWindow();

        openFindOverlay(hostWin as any);
        const view = getLastView();

        expect(getFindOverlayHostWebContents(view.webContents)).toBe(
            hostWin.webContents,
        );
        expect(getFindOverlayWebContents(hostWin.webContents as any)).toBe(
            view.webContents,
        );
        closeFindOverlay(view.webContents);
    });

    test('closing removes the view, clears the highlight and forgets the mapping', () => {
        const hostWin = createHostWindow();
        openFindOverlay(hostWin as any);
        const view = getLastView();

        closeFindOverlay(view.webContents);

        expect(hostWin.contentView.removeChildView).toHaveBeenCalledWith(view);
        expect(hostWin.webContents.stopFindInPage).toHaveBeenCalledWith(
            'clearSelection',
        );
        expect(hostWin.webContents.focus).toHaveBeenCalled();
        expect(getFindOverlayHostWebContents(view.webContents)).toBeNull();
    });

    test('dragging follows the cursor on the x axis and clamps to the window', () => {
        const hostWin = createHostWindow();
        openFindOverlay(hostWin as any);
        const view = getLastView();
        view.setBounds.mockClear();

        // Host content starts at screen x = 10; grabbed 24px into the bar.
        electronMockState.screen.getCursorScreenPoint.mockReturnValue({
            x: 410,
            y: 300,
        });
        startFindOverlayDragging(view.webContents, 24);
        vi.advanceTimersByTime(20);

        expect(view.setBounds).toHaveBeenCalledWith({
            x: 410 - 10 - 24,
            y: 0,
            width: FIND_OVERLAY_WIDTH,
            height: FIND_OVERLAY_HEIGHT,
        });

        // Dragged past the left edge -- the bar stops at the margin.
        electronMockState.screen.getCursorScreenPoint.mockReturnValue({
            x: -500,
            y: 300,
        });
        vi.advanceTimersByTime(20);
        expect(view.setBounds).toHaveBeenLastCalledWith(
            expect.objectContaining({ x: 16, y: 0 }),
        );

        stopFindOverlayDragging(view.webContents);
        view.setBounds.mockClear();
        vi.advanceTimersByTime(100);
        expect(view.setBounds).not.toHaveBeenCalled();

        closeFindOverlay(view.webContents);
    });

    test('closing while dragging stops the cursor polling', () => {
        const hostWin = createHostWindow();
        openFindOverlay(hostWin as any);
        const view = getLastView();

        startFindOverlayDragging(view.webContents, 10);
        closeFindOverlay(view.webContents);
        view.setBounds.mockClear();
        vi.advanceTimersByTime(200);

        expect(view.setBounds).not.toHaveBeenCalled();
    });

    // The find bar has two independent teardown triggers and both can fire for
    // the same overlay: close the bar, then close the window. That crashed the
    // MAIN process, because closing the view leaves its `webContents` behind.
    test('the window closing after the bar was closed tears down only once', () => {
        const hostWin = createHostWindow();
        openFindOverlay(hostWin as any);
        const view = getLastView();
        const viewWebContents = view.webContents;
        const closedCall = hostWin.on.mock.calls.find(([eventName]) => {
            return eventName === 'closed';
        });
        expect(closedCall).toBeDefined();
        const handleHostClosing = closedCall![1];

        closeFindOverlay(viewWebContents);

        expect(viewWebContents.close).toHaveBeenCalledTimes(1);
        // The listener is removed, so it cannot keep the dead overlay alive.
        expect(hostWin.off).toHaveBeenCalledWith('closed', handleHostClosing);

        // Even so, a listener the platform still holds must be harmless.
        (view as any).webContents = undefined;
        hostWin.isDestroyed.mockReturnValue(true);
        expect(() => {
            handleHostClosing();
        }).not.toThrow();
        expect(viewWebContents.close).toHaveBeenCalledTimes(1);
    });

    test('handles destroyed hosts, resize/focus events, and unknown overlays', () => {
        const destroyedHost = createHostWindow();
        destroyedHost.isDestroyed.mockReturnValue(true);
        expect(checkIsFindOverlayHost(destroyedHost as any)).toBe(false);

        const hostWin = createHostWindow();
        openFindOverlay(hostWin as any);
        const view = getLastView();
        const resize = hostWin.on.mock.calls.find(
            ([name]) => name === 'resize',
        )?.[1];
        const didFinishLoad = view.webContents.once.mock.calls.find(
            ([name]: [string]) => name === 'did-finish-load',
        )?.[1];
        view.setBounds.mockClear();
        resize();
        didFinishLoad();
        expect(view.setBounds).toHaveBeenCalledTimes(1);
        expect(view.webContents.focus).toHaveBeenCalledTimes(1);

        expect(getFindOverlayWebContents({ id: 999 } as any)).toBeNull();
        const unknown = { id: 998 } as any;
        expect(() => closeFindOverlay(unknown)).not.toThrow();
        expect(() => startFindOverlayDragging(unknown, 2)).not.toThrow();
        expect(() => stopFindOverlayDragging(unknown)).not.toThrow();

        startFindOverlayDragging(view.webContents, 10);
        hostWin.isDestroyed.mockReturnValue(true);
        vi.advanceTimersByTime(20);
        view.setBounds.mockClear();
        vi.advanceTimersByTime(100);
        expect(view.setBounds).not.toHaveBeenCalled();
    });
});
