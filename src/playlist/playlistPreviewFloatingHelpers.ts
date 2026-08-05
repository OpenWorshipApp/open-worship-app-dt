import { useCallback, useSyncExternalStore } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import { handleError } from '../helper/errorHelpers';
import type PlaylistItem from './PlaylistItem';
import { toPlaylistSettingName } from './playlistHelpers';

// Which playlist the floating full-preview widget is showing, if any. A shared
// store (rather than per-row state) keeps exactly one widget open no matter how
// many playlists are listed.
const listeners = new Set<() => void>();
const state: { filePath: string | null } = { filePath: null };

export function getPlaylistPreviewFilePath() {
    return state.filePath;
}

export function setPlaylistPreviewFilePath(filePath: string | null) {
    if (state.filePath === filePath) {
        return;
    }
    state.filePath = filePath;
    // Closing the widget, or pointing it at another playlist, ends the run the
    // remembered element belonged to — keeping it would leave the next-key
    // stepping from an element that is no longer listed.
    clearPlaylistPreviewSelectedItem();
    for (const listener of listeners) {
        listener();
    }
}

export function togglePlaylistPreviewFilePath(filePath: string) {
    setPlaylistPreviewFilePath(state.filePath === filePath ? null : filePath);
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function usePlaylistPreviewFilePath() {
    return useSyncExternalStore(
        subscribe,
        getPlaylistPreviewFilePath,
        getPlaylistPreviewFilePath,
    );
}

/**
 * Which elements are folded away in the preview, remembered per playlist file.
 *
 * One setting per PLAYLIST, holding the COLLAPSED keys only — not one setting
 * per element. Settings are files, read synchronously from render bodies and
 * cached in a handful of slots, so a key per element would mean a file read per
 * element on open and would evict everything else from that cache; and since
 * elements start expanded, the common case writes nothing at all.
 */
const COLLAPSING_SETTING_PREFIX = 'playlist-preview-collapsed';
const collapsingListeners = new Set<() => void>();
// Exactly one preview widget is open at a time, so this deliberately holds ONE
// playlist's parsed keys rather than a map that would grow per playlist visited.
const collapsingCache: { filePath: string | null; keys: Set<string> } = {
    filePath: null,
    keys: new Set(),
};

function toCollapsingSettingName(playlistFilePath: string) {
    return toPlaylistSettingName(COLLAPSING_SETTING_PREFIX, playlistFilePath);
}

// Read once per playlist and kept in memory afterwards: nothing else writes
// this setting, so re-reading it on every render would be pure I/O.
function readCollapsedKeys(playlistFilePath: string) {
    if (collapsingCache.filePath === playlistFilePath) {
        return collapsingCache.keys;
    }
    const keys = new Set<string>();
    const rawSetting = getSetting(toCollapsingSettingName(playlistFilePath));
    if (rawSetting) {
        try {
            const parsed = JSON.parse(rawSetting);
            if (Array.isArray(parsed)) {
                for (const key of parsed) {
                    if (typeof key === 'string') {
                        keys.add(key);
                    }
                }
            }
        } catch (error) {
            handleError(error);
        }
    }
    collapsingCache.filePath = playlistFilePath;
    collapsingCache.keys = keys;
    return keys;
}

/**
 * Identifies WHICH element the state belongs to, not where it sits: keyed by
 * the element itself so reordering the playlist does not shuffle which previews
 * are folded. Two identical entries in one playlist therefore fold together —
 * the same trade-off the tree rows already make.
 */
export function toPlaylistPreviewItemKey(playlistItem: PlaylistItem) {
    return [
        playlistItem.type,
        playlistItem.itemFilePath,
        playlistItem.id,
        playlistItem.stage,
        // The stored entries that are not file references (backgrounds, bible
        // items, foregrounds) are told apart only by their captured label. An
        // action has no captured label — its title is translated on the fly, so
        // its stored id is used instead and a folded run sheet survives the
        // language being switched.
        playlistItem.isAction ? playlistItem.data : playlistItem.title,
    ].join('|');
}

export function checkIsPlaylistPreviewItemExpanded(
    playlistFilePath: string,
    itemKey: string,
) {
    return !readCollapsedKeys(playlistFilePath).has(itemKey);
}

function writeCollapsedKeys(playlistFilePath: string, keys: Set<string>) {
    collapsingCache.filePath = playlistFilePath;
    collapsingCache.keys = keys;
    const settingName = toCollapsingSettingName(playlistFilePath);
    if (keys.size === 0) {
        // Everything is expanded again — drop the file instead of leaving an
        // empty one behind for every playlist ever previewed.
        removeSetting(settingName);
    } else {
        setSetting(settingName, JSON.stringify(Array.from(keys)));
    }
    for (const listener of collapsingListeners) {
        listener();
    }
}

export function setPlaylistPreviewItemCollapsed(
    playlistFilePath: string,
    itemKey: string,
    isCollapsed: boolean,
) {
    const keys = new Set(readCollapsedKeys(playlistFilePath));
    if (isCollapsed) {
        keys.add(itemKey);
    } else {
        keys.delete(itemKey);
    }
    writeCollapsedKeys(playlistFilePath, keys);
}

/**
 * Fold every listed element away, or unfold them all, in one write.
 *
 * Takes the keys of the elements that are actually LISTED rather than merging
 * into what was already stored: folding everything away therefore stores exactly
 * the current run sheet, so entries that have since been removed from the
 * playlist stop being carried in the setting for good.
 */
export function setAllPlaylistPreviewItemsCollapsed(
    playlistFilePath: string,
    itemKeys: string[],
    isCollapsed: boolean,
) {
    writeCollapsedKeys(
        playlistFilePath,
        isCollapsed ? new Set(itemKeys) : new Set<string>(),
    );
}

function subscribeCollapsing(listener: () => void) {
    collapsingListeners.add(listener);
    return () => {
        collapsingListeners.delete(listener);
    };
}

// Stamped on each element's box so the widget can scroll the element the
// next-key just moved to into view without keeping a ref per element.
export const PLAYLIST_PREVIEW_ITEM_INDEX_KEY = 'data-playlist-preview-index';

/**
 * WHICH element the preview is currently "on", so a next-key knows where to
 * step from. One slot for the one open widget, held in memory only: this is
 * where a run has got to right now, not something to restore days later.
 *
 * The position is kept ALONGSIDE the key rather than instead of it: two
 * identical entries in one playlist share a key (see
 * `toPlaylistPreviewItemKey`), so stepping off the second one would otherwise
 * jump back to the first. The key is what survives a reorder, so it is the
 * fallback when the position no longer holds it.
 */
const selectingListeners = new Set<() => void>();
const selectingState: {
    filePath: string | null;
    itemKey: string | null;
    index: number;
} = { filePath: null, itemKey: null, index: -1 };

function notifySelecting() {
    for (const listener of selectingListeners) {
        listener();
    }
}

export function clearPlaylistPreviewSelectedItem() {
    if (selectingState.itemKey === null && selectingState.filePath === null) {
        return;
    }
    selectingState.filePath = null;
    selectingState.itemKey = null;
    selectingState.index = -1;
    notifySelecting();
}

export function setPlaylistPreviewSelectedItem(
    playlistFilePath: string,
    itemKey: string,
    index: number,
) {
    if (
        selectingState.filePath === playlistFilePath &&
        selectingState.itemKey === itemKey &&
        selectingState.index === index
    ) {
        return;
    }
    selectingState.filePath = playlistFilePath;
    selectingState.itemKey = itemKey;
    selectingState.index = index;
    notifySelecting();
}

export function getPlaylistPreviewSelectedItemKey(playlistFilePath: string) {
    return selectingState.filePath === playlistFilePath
        ? selectingState.itemKey
        : null;
}

/**
 * Where the remembered element sits in the list as it stands NOW, or -1 when
 * nothing is remembered (or what was remembered has been removed).
 */
export function resolvePlaylistPreviewSelectedIndex(
    playlistFilePath: string,
    playlistItems: PlaylistItem[],
) {
    const itemKey = getPlaylistPreviewSelectedItemKey(playlistFilePath);
    if (itemKey === null) {
        return -1;
    }
    const { index } = selectingState;
    const itemAtIndex = playlistItems[index];
    if (
        itemAtIndex !== undefined &&
        toPlaylistPreviewItemKey(itemAtIndex) === itemKey
    ) {
        return index;
    }
    return playlistItems.findIndex((playlistItem) => {
        return toPlaylistPreviewItemKey(playlistItem) === itemKey;
    });
}

/**
 * The next element the run can move to, or -1 at the end of the list.
 *
 * Deliberately does NOT wrap: a run sheet is walked once, top to bottom, and
 * silently going back to element 1 after the last one would put the wrong thing
 * on a live screen. What cannot reach a screen at all (an audio track, a damaged
 * entry) is stepped OVER rather than stopped on — stopping there would read as
 * the key having died; a clear action DOES reach one, so the run stops there and
 * clears. A document holds no screen payload of its own, so it only
 * counts while `checkIsEnterable` says its slides are loaded and can be walked.
 */
export function findNextPlaylistPreviewIndex(
    playlistItems: PlaylistItem[],
    fromIndex: number,
    checkIsEnterable?: (index: number) => boolean,
) {
    for (let i = fromIndex + 1; i < playlistItems.length; i++) {
        if (playlistItems[i].isScreenReachable || checkIsEnterable?.(i)) {
            return i;
        }
    }
    return -1;
}

/**
 * The next slide INSIDE an element, or -1 when the one given is its last.
 *
 * Same no-wrap rule as the elements above it, and disabled slides are skipped
 * exactly as the presenter's own stepping skips them. `fromIndex` of -1 (nothing
 * of this element is showing yet) therefore answers with its first slide.
 */
export function findNextPlaylistPreviewChildIndex(
    varySlides: { isDisabled: boolean }[],
    fromIndex: number,
) {
    for (let i = fromIndex + 1; i < varySlides.length; i++) {
        if (!varySlides[i].isDisabled) {
            return i;
        }
    }
    return -1;
}

/**
 * How an element that holds SEVERAL slides advances to its next one.
 *
 * The stepping lives with the component that loaded those slides — it is the
 * only thing holding them, and only while the element is unfolded — so this is a
 * registration rather than a store of slides: nothing here keeps a document in
 * memory after its preview is folded away or the widget is closed.
 *
 * Keyed by the element's position, which is what the key handler has; a stepper
 * re-registers itself when the list is re-read and the position moves.
 */
export type PlaylistPreviewChildSteppingType = (
    event: MouseEvent,
    isEntering: boolean,
) => boolean;
const childSteppingMap = new Map<number, PlaylistPreviewChildSteppingType>();

export function registerPlaylistPreviewChildStepping(
    index: number,
    stepping: PlaylistPreviewChildSteppingType,
) {
    childSteppingMap.set(index, stepping);
    return () => {
        // Only if it is still ours: a re-register for the same position from the
        // element that replaced this one must not be dropped by our cleanup.
        if (childSteppingMap.get(index) === stepping) {
            childSteppingMap.delete(index);
        }
    };
}

export function checkPlaylistPreviewHasChildren(index: number) {
    return childSteppingMap.has(index);
}

/**
 * True when the element moved on to a next slide of its own. `isEntering` marks
 * the run crossing INTO this element, which always starts it at its first slide.
 */
export function stepPlaylistPreviewChild(
    index: number,
    event: MouseEvent,
    isEntering: boolean,
) {
    return childSteppingMap.get(index)?.(event, isEntering) ?? false;
}

function subscribeSelecting(listener: () => void) {
    selectingListeners.add(listener);
    return () => {
        selectingListeners.delete(listener);
    };
}

export function usePlaylistPreviewSelectedItemKey(playlistFilePath: string) {
    const getSnapshot = () => {
        return getPlaylistPreviewSelectedItemKey(playlistFilePath);
    };
    return useSyncExternalStore(subscribeSelecting, getSnapshot, getSnapshot);
}

/**
 * How many of the LISTED elements are folded away — 0 means there is nothing
 * for "expand all" to do, and `itemKeys.length` means the same for "collapse
 * all".
 *
 * A plain number rather than the pair of flags it feeds, because
 * `useSyncExternalStore` compares snapshots by identity and a fresh object every
 * render would loop forever. Counted against the caller's keys instead of the
 * stored set's size: two identical entries share one key, so the stored size
 * alone would under-count them.
 */
export function usePlaylistPreviewCollapsedCount(
    playlistFilePath: string,
    itemKeys: string[],
) {
    const currentRef = useAppCurrentRef({ playlistFilePath, itemKeys });
    const getSnapshot = () => {
        const current = currentRef.current;
        const collapsedKeys = readCollapsedKeys(current.playlistFilePath);
        // The usual case, and the one worth keeping free: nothing is folded, so
        // there is no need to walk the list at all.
        if (collapsedKeys.size === 0) {
            return 0;
        }
        let count = 0;
        for (const itemKey of current.itemKeys) {
            if (collapsedKeys.has(itemKey)) {
                count += 1;
            }
        }
        return count;
    };
    return useSyncExternalStore(subscribeCollapsing, getSnapshot, getSnapshot);
}

// Handed the key rather than the element: the caller already needs it (to mark
// the element's box and to answer the next-key), and deriving it twice per
// element per render is a string join a long run sheet does not need to pay for.
export function usePlaylistPreviewItemExpanding(
    playlistFilePath: string,
    itemKey: string,
): [boolean, () => void] {
    const getSnapshot = () => {
        return checkIsPlaylistPreviewItemExpanded(playlistFilePath, itemKey);
    };
    const isExpanded = useSyncExternalStore(
        subscribeCollapsing,
        getSnapshot,
        getSnapshot,
    );
    const currentRef = useAppCurrentRef({
        playlistFilePath,
        itemKey,
        isExpanded,
    });
    const handleToggling = useCallback(() => {
        const current = currentRef.current;
        setPlaylistPreviewItemCollapsed(
            current.playlistFilePath,
            current.itemKey,
            current.isExpanded,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return [isExpanded, handleToggling];
}
