import { useSyncExternalStore } from 'react';

import {
    MIN_THUMBNAIL_SCALE,
    THUMBNAIL_WIDTH_SETTING_NAME,
} from './appDocumentTypeHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import { toFilePathSettingName } from '../helper/settingHelpers';
import appProvider from '../server/appProvider';

/**
 * Which documents have a floating slides preview open.
 *
 * Unlike the playlist preview — deliberately ONE widget wherever it is opened
 * from — a document preview is per file: the whole point is looking at several
 * documents at once. Still at most one widget per file, because two previews of
 * one document would fight over the same persisted rect and the same zoom key.
 *
 * In memory only. Nothing is reopened on the next launch: the widgets each hold
 * a document's slides, and restoring a set of them would put that cost on every
 * start. What IS remembered, per file, is where the widget sat and how far it
 * was zoomed, so reopening one puts it back as it was left.
 */
const listeners = new Set<() => void>();

// An ARRAY that is REPLACED, never mutated: `useSyncExternalStore` compares
// snapshots by identity, so building a fresh array per read would re-render
// forever.
let openedFilePaths: string[] = [];

function getOpenedFilePaths() {
    return openedFilePaths;
}

function notifyListeners() {
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function checkIsAppDocumentPreviewOpened(filePath: string) {
    return openedFilePaths.includes(filePath);
}

export function openAppDocumentPreviewFloating(filePath: string) {
    if (openedFilePaths.includes(filePath)) {
        return;
    }
    openedFilePaths = [...openedFilePaths, filePath];
    notifyListeners();
}

export function closeAppDocumentPreviewFloating(filePath: string) {
    if (!openedFilePaths.includes(filePath)) {
        return;
    }
    openedFilePaths = openedFilePaths.filter((openedFilePath) => {
        return openedFilePath !== filePath;
    });
    notifyListeners();
}

export function toggleAppDocumentPreviewFloating(filePath: string) {
    if (openedFilePaths.includes(filePath)) {
        closeAppDocumentPreviewFloating(filePath);
    } else {
        openAppDocumentPreviewFloating(filePath);
    }
}

export function useOpenedAppDocumentPreviewFilePaths() {
    return useSyncExternalStore(
        subscribe,
        getOpenedFilePaths,
        getOpenedFilePaths,
    );
}

/**
 * A boolean for ONE file rather than the whole list, so opening a widget
 * re-renders only the row it belongs to.
 */
export function useIsAppDocumentPreviewOpened(filePath: string) {
    const getSnapshot = () => {
        return openedFilePaths.includes(filePath);
    };
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const PREVIEW_RECT_SETTING_PREFIX = 'app-document-preview-rect';

export function toAppDocumentPreviewRectSettingName(filePath: string) {
    return toFilePathSettingName(PREVIEW_RECT_SETTING_PREFIX, filePath);
}

export function toAppDocumentPreviewScaleSettingName(filePath: string) {
    return toFilePathSettingName(THUMBNAIL_WIDTH_SETTING_NAME, filePath);
}

// What the slide list already renders at when nothing is stored, so a freshly
// opened widget matches the main panel instead of starting pinned to the
// smallest thumbnail.
export const DEFAULT_PREVIEW_THUMBNAIL_SCALE = MIN_THUMBNAIL_SCALE + 10;

// Ctrl on Windows/Linux, ⌘ on mac — the same modifier pair the playlist drag
// rules read, so one habit works across the app.
export const OPEN_SLIDES_PREVIEW_SHORTCUT_LABEL = appProvider.systemUtils.isMac
    ? '⌘ + Click'
    : 'Ctrl + Click';

/**
 * The `Open Slides Preview` entry, shared by every kind of Documents row.
 *
 * Disabled — rather than hidden — for the document the main previewer is
 * already showing: a document is previewed in one place, and a greyed-out entry
 * says so where a missing one would just look inconsistent.
 */
export function genOpenSlidesPreviewContextMenu(
    filePath: string,
    isSelected: boolean,
): ContextMenuItemType {
    return {
        childBefore: genContextMenuItemIcon('window-stack'),
        menuElement: tran('Open Slides Preview'),
        disabled: isSelected,
        // The tooltip is where the click shortcut is discovered. NOT the
        // `context-menu-shortcut-key` badge every keyboard shortcut uses: that
        // one is positioned over the right end of the label, which is fine for
        // `Ctrl + S` and unreadable under a label this long (longer still in
        // Khmer).
        title: isSelected
            ? tran('Already showing in the main previewer')
            : `${tran('Open Slides Preview')} (${OPEN_SLIDES_PREVIEW_SHORTCUT_LABEL})`,
        onSelect: () => {
            toggleAppDocumentPreviewFloating(filePath);
        },
    };
}

/**
 * Ctrl/⌘ + click on a Documents row as the shortcut for the context menu's
 * `Open Slides Preview`. Returns whether the click was consumed, so a row's
 * normal handler bails before selecting the document.
 *
 * Same rule as the greyed-out menu entry: the selected document is already in
 * the main previewer and never gets a second widget — the click is still
 * consumed, otherwise a modified click would silently do the plain thing.
 */
export function checkHandleOpenSlidesPreviewClicking(
    event: { ctrlKey?: boolean; metaKey?: boolean } | undefined,
    filePath: string,
    isSelected: boolean,
) {
    if (!event?.ctrlKey && !event?.metaKey) {
        return false;
    }
    if (!isSelected) {
        toggleAppDocumentPreviewFloating(filePath);
    }
    return true;
}
