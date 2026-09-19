import appProvider from '../server/appProvider';
import type { MessageEventType } from '../server/appProvider';

export type LookupOptions = {
    forward?: boolean;
    findNext?: boolean;
    matchCase?: boolean;
};

export type FoundInPageResult = {
    activeMatchOrdinal: number;
    matches: number;
    finalUpdate: boolean;
};

/**
 * The find bar runs in its own `WebContentsView`, so every one of these goes
 * through the main process, which applies it to the PAGE of the window the bar
 * is pinned to. That separation is the point: `findInPage` matches everything
 * in a web contents, `input` values included, so a bar living in the page would
 * always find the query typed into itself.
 */
export function findString(text: string, options: LookupOptions = {}) {
    if (!text) {
        stopFindingString();
        return;
    }
    appProvider.messageUtils.sendData(
        'finder:app:search-in-page',
        text,
        options,
    );
}

export function stopFindingString(
    action:
        | 'clearSelection'
        | 'keepSelection'
        | 'activateSelection' = 'clearSelection',
) {
    appProvider.messageUtils.sendData('finder:app:stop-search-in-page', action);
}

export function closeFinder() {
    appProvider.messageUtils.sendData('finder:app:close');
}

export function startFinderDragging(grabOffsetX: number) {
    appProvider.messageUtils.sendData('finder:app:drag-start', grabOffsetX);
}

export function stopFinderDragging() {
    appProvider.messageUtils.sendData('finder:app:drag-stop');
}

function listenForMain<T>(channel: string, handler: (data: T) => void) {
    const callback = (_event: MessageEventType, data: T) => {
        handler(data);
    };
    appProvider.messageUtils.listenForData(channel, callback);
    return () => {
        appProvider.messageUtils.removeListener(channel, callback);
    };
}

/**
 * `findInPage` is a main-process API, so the match count comes back over IPC.
 * Returns the unregister function -- the listener list on the channel is global
 * and would otherwise grow with every mount.
 */
export function listenFoundInPage(
    handler: (result: FoundInPageResult) => void,
) {
    return listenForMain<FoundInPageResult>('main:app:found-in-page', handler);
}

/** Fired when `Ctrl/Cmd+F` is pressed again while the bar is already open. */
export function listenFocusFinder(handler: () => void) {
    return listenForMain('main:app:focus-find', handler);
}
