import {
    screen,
    WebContentsView,
    type BrowserWindow,
    type WebContents,
} from 'electron';

import { genWebPreferences } from './electronHelpers';
import { htmlFiles } from './fsServe';
import { genRouteUrl, genRoutProps } from './protocolHelpers';

/**
 * The find bar is a child `WebContentsView` pinned inside the window it
 * searches, not part of that window's page.
 *
 * That is not a styling preference, it is the whole point: `findInPage` walks
 * everything in a web contents -- nested iframes and `input` values included --
 * so a find bar living in the page always matches the query typed into itself.
 * Giving it its own web contents is the only thing that keeps it out of the
 * search, and it is how Chrome does it too.
 */
export const FIND_OVERLAY_WIDTH = 452;
export const FIND_OVERLAY_HEIGHT = 40;
const FIND_OVERLAY_EDGE_MARGIN = 16;
const DRAG_POLL_INTERVAL = 16;

type FindOverlayType = {
    view: WebContentsView;
    hostWin: BrowserWindow;
    left: number | null;
    dragGrabOffsetX: number | null;
    dragTimer: NodeJS.Timeout | null;
    isDestroyed: boolean;
    handleHostResizing: () => void;
    handleHostClosing: () => void;
};

const overlayByHostWindowId = new Map<number, FindOverlayType>();
const overlayByViewWebContentsId = new Map<number, FindOverlayType>();

function clampLeft(overlay: FindOverlayType, left: number) {
    const [contentWidth] = overlay.hostWin.getContentSize();
    const maxLeft = Math.max(
        0,
        contentWidth - FIND_OVERLAY_WIDTH - FIND_OVERLAY_EDGE_MARGIN,
    );
    return Math.round(
        Math.min(Math.max(left, FIND_OVERLAY_EDGE_MARGIN), maxLeft),
    );
}

function applyBounds(overlay: FindOverlayType) {
    const [contentWidth] = overlay.hostWin.getContentSize();
    const defaultLeft =
        contentWidth - FIND_OVERLAY_WIDTH - FIND_OVERLAY_EDGE_MARGIN;
    const left = clampLeft(overlay, overlay.left ?? defaultLeft);
    overlay.view.setBounds({
        x: left,
        y: 0,
        width: FIND_OVERLAY_WIDTH,
        height: FIND_OVERLAY_HEIGHT,
    });
}

function stopDragging(overlay: FindOverlayType) {
    if (overlay.dragTimer !== null) {
        clearInterval(overlay.dragTimer);
        overlay.dragTimer = null;
    }
    overlay.dragGrabOffsetX = null;
}

/**
 * Idempotent on purpose: the find bar has two independent teardown triggers --
 * the user closing the bar, and the host window closing -- and both can happen
 * to the same overlay in that order. The second call used to crash the MAIN
 * process on `overlay.view.webContents.id`, because closing a `WebContentsView`
 * leaves its `webContents` undefined.
 */
function destroyOverlay(overlay: FindOverlayType) {
    if (overlay.isDestroyed) {
        return;
    }
    overlay.isDestroyed = true;
    stopDragging(overlay);
    overlayByHostWindowId.delete(overlay.hostWin.id);
    // May already be gone when the window close arrives after a bar close.
    const viewWebContents = overlay.view.webContents;
    if (viewWebContents !== undefined) {
        overlayByViewWebContentsId.delete(viewWebContents.id);
    }
    overlay.hostWin.off('resize', overlay.handleHostResizing);
    // Named so it can be removed: a leaked `closed` listener is what kept the
    // dead overlay reachable and re-entered this function.
    overlay.hostWin.off('closed', overlay.handleHostClosing);
    if (!overlay.hostWin.isDestroyed()) {
        overlay.hostWin.contentView.removeChildView(overlay.view);
        if (!overlay.hostWin.webContents.isDestroyed()) {
            overlay.hostWin.webContents.stopFindInPage('clearSelection');
        }
    }
    if (viewWebContents !== undefined && !viewWebContents.isDestroyed()) {
        viewWebContents.close();
    }
}

// The windows whose content is worth a find bar. The screens are a projection,
// the bible note and the two code editors bring their own search, and the small
// info popups have nothing to find.
const FIND_OVERLAY_HOST_HTML_FILES = [
    htmlFiles.presenter,
    htmlFiles.appDocumentEditor,
    htmlFiles.reader,
    htmlFiles.setting,
];

export function checkIsFindOverlayHost(win: BrowserWindow) {
    if (win.isDestroyed()) {
        return false;
    }
    const url = win.webContents.getURL();
    return FIND_OVERLAY_HOST_HTML_FILES.some((htmlFileFullName) => {
        return url.includes(htmlFileFullName);
    });
}

/**
 * Open the find bar over `hostWin`, or -- when it is already open -- ask it to
 * take focus and re-select its query, the way a second `Ctrl/Cmd+F` behaves in
 * a browser.
 */
export function openFindOverlay(hostWin: BrowserWindow) {
    const existingOverlay = overlayByHostWindowId.get(hostWin.id);
    if (existingOverlay !== undefined) {
        existingOverlay.view.webContents.focus();
        existingOverlay.view.webContents.send('main:app:focus-find');
        return existingOverlay;
    }
    const routeProps = genRoutProps(htmlFiles.finder);
    // The same preferences every app window gets. A `WebContentsView` defaults
    // to a sandboxed, context-isolated renderer, where this app's preload dies
    // on `global is not defined` and the page never mounts.
    const view = new WebContentsView({
        webPreferences: genWebPreferences(routeProps.preloadFilePath),
    });
    // Without this the view paints an opaque white block behind the bar's
    // rounded corners.
    view.setBackgroundColor('#00000000');
    const overlay: FindOverlayType = {
        view,
        hostWin,
        left: null,
        dragGrabOffsetX: null,
        dragTimer: null,
        isDestroyed: false,
        handleHostResizing: () => {},
        handleHostClosing: () => {},
    };
    overlay.handleHostResizing = () => {
        applyBounds(overlay);
    };
    overlay.handleHostClosing = () => {
        destroyOverlay(overlay);
    };
    overlayByHostWindowId.set(hostWin.id, overlay);
    overlayByViewWebContentsId.set(view.webContents.id, overlay);
    hostWin.contentView.addChildView(view);
    applyBounds(overlay);
    hostWin.on('resize', overlay.handleHostResizing);
    hostWin.on('closed', overlay.handleHostClosing);
    view.webContents.loadURL(genRouteUrl(htmlFiles.finder));
    view.webContents.once('did-finish-load', () => {
        view.webContents.focus();
    });
    return overlay;
}

export function closeFindOverlay(webContents: WebContents) {
    const overlay = overlayByViewWebContentsId.get(webContents.id);
    if (overlay === undefined) {
        return;
    }
    destroyOverlay(overlay);
    if (!overlay.hostWin.isDestroyed()) {
        overlay.hostWin.webContents.focus();
    }
}

/**
 * The web contents the find bar searches: the page of the window it sits in.
 */
export function getFindOverlayHostWebContents(webContents: WebContents) {
    const overlay = overlayByViewWebContentsId.get(webContents.id);
    if (overlay === undefined || overlay.hostWin.isDestroyed()) {
        return null;
    }
    return overlay.hostWin.webContents;
}

export function getFindOverlayWebContents(hostWebContents: WebContents) {
    for (const overlay of overlayByHostWindowId.values()) {
        if (overlay.hostWin.webContents.id === hostWebContents.id) {
            return overlay.view.webContents;
        }
    }
    return null;
}

/**
 * Dragging is driven by the cursor position rather than by the bar's own
 * pointer events: the bar is only 452px wide, and the moment the pointer leaves
 * it the moves are delivered to the page underneath instead.
 */
export function startFindOverlayDragging(
    webContents: WebContents,
    grabOffsetX: number,
) {
    const overlay = overlayByViewWebContentsId.get(webContents.id);
    if (overlay === undefined) {
        return;
    }
    stopDragging(overlay);
    overlay.dragGrabOffsetX = grabOffsetX;
    overlay.dragTimer = setInterval(() => {
        if (overlay.hostWin.isDestroyed() || overlay.dragGrabOffsetX === null) {
            stopDragging(overlay);
            return;
        }
        const cursorPoint = screen.getCursorScreenPoint();
        const contentBounds = overlay.hostWin.getContentBounds();
        overlay.left = clampLeft(
            overlay,
            cursorPoint.x - contentBounds.x - overlay.dragGrabOffsetX,
        );
        applyBounds(overlay);
    }, DRAG_POLL_INTERVAL);
}

export function stopFindOverlayDragging(webContents: WebContents) {
    const overlay = overlayByViewWebContentsId.get(webContents.id);
    if (overlay === undefined) {
        return;
    }
    stopDragging(overlay);
}
