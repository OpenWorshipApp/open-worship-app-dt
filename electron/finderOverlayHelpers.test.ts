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

describe('finderOverlayHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('only app pages host the find bar', () => {
        expect(checkIsFindOverlayHost(createHostWindow() as any)).toBe(true);
        expect(
            checkIsFindOverlayHost(createHostWindow('setting.html') as any),
        ).toBe(true);
        expect(
            checkIsFindOverlayHost(createHostWindow('screen.html') as any),
        ).toBe(false);
        expect(
            checkIsFindOverlayHost(createHostWindow('bibleNote.html') as any),
        ).toBe(false);
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
        openFindOverlay(hostWin as any);

        expect(electronMockState.webContentsViews).toHaveLength(1);
        expect(view.webContents.send).toHaveBeenCalledWith(
            'main:app:focus-find',
        );
        closeFindOverlay(view.webContents);
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
});
