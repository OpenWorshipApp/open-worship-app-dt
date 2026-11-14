/**
 * A person, place or verse pressed in a window that hosts no detail panels
 * (the Markdown Preview) opens in the READER (2026-11-11, the user: _for
 * name/location-name/bible-verse have to open the floating panel in reader
 * page_). The window that shows it, in this order:
 *
 * 1. the main window, when it is on the Reader page;
 * 2. else a Bible Reader window opened beside it;
 * 3. else the main window on whatever page it shows. It is never moved off
 *    that page: a Presenter in the middle of a service stays where it is, and
 *    hosts the panel over it as it does for its own lookups.
 *
 * The chosen window is brought forward and handed the request
 * (`src/location-name-lookup/detailPanelRequestHelpers.ts`, whose test holds
 * the channels equal). What arrives crosses a process and is checked here
 * again, field by field, before it goes anywhere.
 */

import type { BrowserWindow } from 'electron';

import { htmlFiles } from './fsServe';

export const DETAIL_PANEL_REQUEST_CHANNEL = 'all:app:open-detail-panel';
export const DETAIL_PANEL_RENDERER_CHANNEL = 'main:app:open-detail-panel';

const MAX_TEXT_LENGTH = 200;
const MAX_BIBLE_KEY_LENGTH = 100;

export type DetailPanelRequestType = {
    kind: 'name' | 'location' | 'verse';
    target: string;
    name: string;
    bibleKey?: string;
};

function checkIsShortText(value: unknown, maxLength: number) {
    return (
        typeof value === 'string' &&
        value.trim() !== '' &&
        value.length <= maxLength
    );
}

export function toValidDetailPanelRequest(
    data: unknown,
): DetailPanelRequestType | null {
    if (data === null || typeof data !== 'object') {
        return null;
    }
    const { kind, target, name, bibleKey } = data as Record<string, unknown>;
    if (
        (kind !== 'name' && kind !== 'location' && kind !== 'verse') ||
        !checkIsShortText(target, MAX_TEXT_LENGTH) ||
        !checkIsShortText(name, MAX_TEXT_LENGTH)
    ) {
        return null;
    }
    const request: DetailPanelRequestType = {
        kind,
        target: target as string,
        name: name as string,
    };
    if (bibleKey !== undefined) {
        if (!checkIsShortText(bibleKey, MAX_BIBLE_KEY_LENGTH)) {
            return null;
        }
        if (kind === 'verse') {
            request.bibleKey = bibleKey as string;
        }
    }
    return request;
}

export type DetailPanelWindowEntryType<T> = {
    win: T;
    url: string;
    isMain: boolean;
};

function checkIsReaderUrl(url: string) {
    if (!URL.canParse(url)) {
        return false;
    }
    return new URL(url).pathname.split('/').pop() === htmlFiles.reader;
}

/** Pure: the window to open the panel in, or null when there is none. */
export function pickDetailPanelWindow<T>(
    entryList: readonly DetailPanelWindowEntryType<T>[],
): T | null {
    const mainEntry = entryList.find((entry) => entry.isMain) ?? null;
    if (mainEntry !== null && checkIsReaderUrl(mainEntry.url)) {
        return mainEntry.win;
    }
    const readerEntry = entryList.find((entry) => {
        return !entry.isMain && checkIsReaderUrl(entry.url);
    });
    if (readerEntry !== undefined) {
        return readerEntry.win;
    }
    return mainEntry?.win ?? null;
}

function checkIsLiveWindow(win: BrowserWindow) {
    return !win.isDestroyed() && !win.webContents.isDestroyed();
}

/** True when the request reached a window. */
export function openDetailPanelInReader(
    data: unknown,
    mainWin: BrowserWindow | null,
    windowList: readonly BrowserWindow[],
) {
    const request = toValidDetailPanelRequest(data);
    if (request === null) {
        return false;
    }
    const entryList = windowList.filter(checkIsLiveWindow).map((win) => {
        return {
            win,
            url: win.webContents.getURL(),
            isMain: win === mainWin,
        };
    });
    const win = pickDetailPanelWindow(entryList);
    if (win === null) {
        return false;
    }
    if (win.isMinimized()) {
        win.restore();
    }
    win.show();
    win.focus();
    win.webContents.send(DETAIL_PANEL_RENDERER_CHANNEL, request);
    return true;
}
