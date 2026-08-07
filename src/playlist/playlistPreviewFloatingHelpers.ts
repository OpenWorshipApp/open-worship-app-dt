import { useCallback, useSyncExternalStore } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';
import { findVerticalScrollingParent } from '../helper/domHelpers';
import {
    bringDomToCenterView,
    bringDomToNearestView,
    checkIsVerticalAtBottom,
} from '../helper/helpers';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import { handleError } from '../helper/errorHelpers';
import { notifyPlaylistRunSelectionChanged } from './playlistAutoNextHelpers';
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
        // language being switched. A RUN action carries what it is ARMED with
        // too: two timeouts armed differently are two different lines of the
        // sheet, whether they were armed with seconds, with a time of day or —
        // uniquely per sheet, so it tells any two of them apart — with a
        // shortcut.
        playlistItem.isRunAction
            ? `${playlistItem.data}-${playlistItem.actionKey ?? playlistItem.actionTime ?? playlistItem.actionNumber}`
            : playlistItem.isAction
              ? playlistItem.data
              : playlistItem.title,
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
 * Unfold what the run has just landed on, and nothing else.
 *
 * The run never stops on something folded away: folding is how the operator
 * READS a long sheet, and it must not decide what takes part in the service.
 * Whatever the run reaches is therefore opened — the same as if they had clicked
 * its chevron, setting and all, so it STAYS open afterwards.
 *
 * A no-op when it is already open, which is the overwhelmingly common case:
 * writing the setting again would rewrite the file and re-render every element of
 * the sheet on every single step.
 */
export function expandPlaylistPreviewItem(
    playlistFilePath: string,
    itemKey: string,
) {
    if (checkIsPlaylistPreviewItemExpanded(playlistFilePath, itemKey)) {
        return;
    }
    setPlaylistPreviewItemCollapsed(playlistFilePath, itemKey, false);
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

/**
 * Put what the run just moved to where the operator can see it.
 *
 * `nearest` as a rule: the least scrolling that works, so a run sheet does not
 * jump about under the operator. But `nearest` on something hanging off the
 * BOTTOM leaves it flush against the bottom edge with nothing of the sheet below
 * it — and what comes next is exactly what an operator needs to see while the run
 * is moving. That one is CENTRED instead.
 *
 * Measured against the box that really scrolls: the preview's own container is
 * the full height of the run sheet, and the floating widget's body is what
 * scrolls it, so asking the container would answer "never off the bottom".
 */
export function bringPlaylistRunElementToView(element: Element) {
    if (element instanceof HTMLElement) {
        const scrollingParent = findVerticalScrollingParent(element);
        if (
            scrollingParent !== null &&
            checkIsVerticalAtBottom(scrollingParent, element)
        ) {
            bringDomToCenterView(element);
            return;
        }
    }
    bringDomToNearestView(element);
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
 *
 * `childId` is the same answer one level down — WHICH slide of the selected
 * element the run is on. ONE slot, not one per element: the run has one
 * position, and crossing into an element always restarts it at its first slide
 * anyway (`isEntering`), so remembering where each element was left would be
 * remembering something nothing ever reads back.
 *
 * Deliberately NOT derived from what is on a screen. Several elements can be
 * live at once — the same document may even be listed twice, or be live from
 * the presenter's own list — and the screens cannot say which of those the
 * operator is walking. This is the panel's own cursor, held in memory for as
 * long as it is open on one playlist and forgotten with it.
 */
const selectingListeners = new Set<() => void>();
const selectingState: {
    filePath: string | null;
    itemKey: string | null;
    index: number;
    childId: number | null;
} = { filePath: null, itemKey: null, index: -1, childId: null };

function notifySelectingListeners() {
    for (const listener of selectingListeners) {
        listener();
    }
}

/**
 * The cursor MOVED. Told to the panel's own subscribers, and to the run's clock —
 * a `Next: Timeout` is cancelled by the run going somewhere and by nothing else,
 * and a `Next: Interval` starts its count again from there. This is the one place
 * that knows the cursor moved at all, so it is the one place either can be
 * answered from without guessing at raw clicks and keys.
 *
 * Not to be used for a REPAIR — writing back the position a reorder shifted the
 * same element to is not the run going anywhere, and a countdown must survive the
 * sheet being tidied underneath it. That one notifies the listeners only.
 */
function notifySelecting() {
    notifySelectingListeners();
    notifyPlaylistRunSelectionChanged();
}

export function clearPlaylistPreviewSelectedItem() {
    clearPendingPlaylistPreviewChildEntry();
    if (
        selectingState.itemKey === null &&
        selectingState.filePath === null &&
        selectingState.childId === null
    ) {
        return;
    }
    selectingState.filePath = null;
    selectingState.itemKey = null;
    selectingState.index = -1;
    selectingState.childId = null;
    notifySelecting();
}

export function setPlaylistPreviewSelectedItem(
    playlistFilePath: string,
    itemKey: string,
    index: number,
) {
    // Whatever the last landing was still waiting for, it is not what the run is
    // doing now. Dropped before the early return as well: landing on the element
    // the cursor is ALREADY on (a jump, or a shortcut pressed twice) is still a
    // fresh landing, and it will make its own ask.
    clearPendingPlaylistPreviewChildEntry();
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
    // The run moved to another element, so the slide it was on is not where it
    // is any more. Dropped here rather than left to the element that owned it:
    // that element may well be folded away, or no longer listed at all.
    selectingState.childId = null;
    notifySelecting();
}

export function getPlaylistPreviewSelectedItemKey(playlistFilePath: string) {
    return selectingState.filePath === playlistFilePath
        ? selectingState.itemKey
        : null;
}

/**
 * Whether the run is on THIS element — its position included, not its key alone.
 *
 * Two identical entries in one playlist share a key, so a key-only answer marks
 * BOTH of them and the operator is shown two cursors with no way to tell which
 * one a press will step. The position is the only thing that tells them apart,
 * which is why it is stored alongside the key in the first place.
 *
 * A reorder therefore un-marks the element until the next press, which
 * `resolvePlaylistPreviewSelectedIndex` repairs by writing the position it found
 * the key at. Briefly marking nothing is the right way round: marking the wrong
 * copy is what a run cannot afford.
 */
export function checkIsPlaylistPreviewItemSelected(
    playlistFilePath: string,
    itemKey: string,
    index: number,
) {
    return (
        selectingState.filePath === playlistFilePath &&
        selectingState.itemKey === itemKey &&
        selectingState.index === index
    );
}

/**
 * Point the run at a slide INSIDE the element it is already on.
 *
 * Refuses anything else: the element cursor is what says where the run is, and
 * an element that is not it — one re-rendering, or folding away, or the second
 * copy of the very same document — must not be able to move the cursor out from
 * under the operator. A click gets this right on its own, the element's own
 * capture handler having moved the element cursor here on the way down before
 * this is reached.
 */
export function setPlaylistPreviewSelectedChild(
    playlistFilePath: string,
    itemKey: string,
    index: number,
    childId: number | null,
) {
    if (
        !checkIsPlaylistPreviewItemSelected(playlistFilePath, itemKey, index) ||
        selectingState.childId === childId
    ) {
        return;
    }
    selectingState.childId = childId;
    notifySelecting();
}

export function getPlaylistPreviewSelectedChildId(
    playlistFilePath: string,
    itemKey: string,
    index: number,
) {
    return checkIsPlaylistPreviewItemSelected(playlistFilePath, itemKey, index)
        ? selectingState.childId
        : null;
}

/**
 * Where the remembered slide sits in the element's slides as they stand NOW, or
 * -1 when nothing is remembered (or what was remembered has been edited away).
 *
 * By id rather than position, the same way the element cursor is by key: a slide
 * added ahead of it must not shift the run onto its neighbour.
 */
export function resolvePlaylistPreviewSelectedChildIndex(
    playlistFilePath: string,
    itemKey: string,
    index: number,
    varySlides: { id: number }[],
) {
    const childId = getPlaylistPreviewSelectedChildId(
        playlistFilePath,
        itemKey,
        index,
    );
    if (childId === null) {
        return -1;
    }
    return varySlides.findIndex((varySlide) => {
        return varySlide.id === childId;
    });
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
    const foundIndex = playlistItems.findIndex((playlistItem) => {
        return toPlaylistPreviewItemKey(playlistItem) === itemKey;
    });
    // The list was reordered under the run, so the stored position now points at
    // something else. Repaired rather than merely answered: the position is what
    // tells two identical entries apart when the element is marked, and left
    // stale it would keep marking neither of them.
    if (foundIndex !== -1 && foundIndex !== index) {
        selectingState.index = foundIndex;
        // The listeners only: the run is on the very element it was on, at a
        // position something else moved it to.
        notifySelectingListeners();
    }
    return foundIndex;
}

/**
 * The next element the run can move to, or -1 at the end of the list.
 *
 * Deliberately does NOT wrap: a run sheet is walked once, top to bottom, and
 * silently going back to element 1 after the last one would put the wrong thing
 * on a live screen.
 *
 * **PARKED is the only reason to step over a line.** Everything else is stopped
 * on, whatever it is and whatever state the panel happens to be in: content is
 * shown, a screen action is run, a run action is fired, a document is entered and
 * walked slide by slide, and the two that do nothing at all (an audio track,
 * which is played from its own panel, and a damaged entry) still take the cursor
 * so the operator can see where the run has got to.
 *
 * Earlier this also required a document to be UNFOLDED — its stepper is only
 * registered while its preview is open — which meant a run sheet folded down for
 * reading silently jumped over its songs. Being folded is how the operator is
 * READING the sheet; it says nothing about what is in the run, so the landing
 * unfolds what it lands on instead (`expandPlaylistPreviewItem`).
 */
export function findNextPlaylistPreviewIndex(
    playlistItems: PlaylistItem[],
    fromIndex: number,
) {
    for (let i = fromIndex + 1; i < playlistItems.length; i++) {
        if (!playlistItems[i].isDisabled) {
            return i;
        }
    }
    return -1;
}

/**
 * The shortcuts this run sheet answers to, in the order the sheet lists them.
 *
 * DEDUPED, first line wins — the same answer `PlaylistItem.bindCcSources` gives
 * two entries sharing a uuid, and for the same reason: `Playlist` refuses to
 * write a shortcut that is already taken, so a repeat here is a hand-edited file
 * or an imported archive, and the honest reading of two lines answering to one
 * key is the first of them. Without it the widget would also register the same
 * key twice and render two rows under one React key.
 *
 * PARKED lines are left out rather than registered and then ignored: a shortcut
 * that swallowed a key press and did nothing is worse than one that never took
 * the key, and parking a line is the operator saying it takes no part in the run.
 */
export function collectPlaylistRunShortcutKeys(
    playlistItems: PlaylistItem[] | null | undefined,
): string[] {
    if (!playlistItems?.length) {
        return [];
    }
    const shortcutKeys: string[] = [];
    for (const playlistItem of playlistItems) {
        const { actionKey } = playlistItem;
        if (
            actionKey !== null &&
            !playlistItem.isDisabled &&
            !shortcutKeys.includes(actionKey)
        ) {
            shortcutKeys.push(actionKey);
        }
    }
    return shortcutKeys;
}

/**
 * Which LINE a shortcut names, by the uuid the run is then sent to — the same
 * identity a `Jump to` aims at, so one press and one jump land the same way.
 *
 * Null when nothing answers to it any more: the sheet is re-read on every change,
 * but a press can still arrive between the line being removed and the widget
 * re-rendering.
 */
export function findPlaylistRunShortcutUuid(
    playlistItems: PlaylistItem[] | null | undefined,
    shortcutKey: string,
): string | null {
    if (!playlistItems?.length) {
        return null;
    }
    for (const playlistItem of playlistItems) {
        if (
            playlistItem.actionKey === shortcutKey &&
            !playlistItem.isDisabled &&
            playlistItem.uuid !== null
        ) {
            return playlistItem.uuid;
        }
    }
    return null;
}

/**
 * The next slide INSIDE an element, or -1 when the one given is its last.
 *
 * Same no-wrap rule as the elements above it, and disabled slides are skipped
 * exactly as the presenter's own stepping skips them. `fromIndex` of -1 (nothing
 * of this element is showing yet) therefore answers with its first slide.
 *
 * Two ways a slide can be parked, and both are skipped: the DOCUMENT's own flag
 * (`isDisabled`, what the presenter reads) and the run sheet's per-slide one,
 * which `checkIsDisabled` answers for — the playlist knows that, the slide
 * itself does not.
 */
export function findNextPlaylistPreviewChildIndex(
    varySlides: { isDisabled: boolean }[],
    fromIndex: number,
    checkIsDisabled?: (index: number) => boolean,
) {
    for (let i = fromIndex + 1; i < varySlides.length; i++) {
        if (!varySlides[i].isDisabled && !checkIsDisabled?.(i)) {
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

/**
 * The run has landed on an element whose slides are not there YET.
 *
 * Unfolding a document mounts its preview, which then reads its slides off disk —
 * so at the moment of landing there is nothing registered to step into, and the
 * run would sit on the element's header having shown nothing. This remembers the
 * ask; `registerPlaylistPreviewChildStepping` answers it as soon as the slides
 * arrive.
 *
 * ONE slot, exactly like the cursor it belongs to, and cleared the moment the
 * cursor moves anywhere else: an ask that outlived its landing would put a slide
 * on a live screen the next time the operator happened to unfold that element by
 * hand.
 */
let pendingChildEntry: {
    index: number;
    event: MouseEvent;
} | null = null;

function clearPendingPlaylistPreviewChildEntry() {
    pendingChildEntry = null;
}

export function requestPlaylistPreviewChildEntry(
    index: number,
    event: MouseEvent,
) {
    pendingChildEntry = { index, event };
}

export function registerPlaylistPreviewChildStepping(
    index: number,
    stepping: PlaylistPreviewChildSteppingType,
) {
    childSteppingMap.set(index, stepping);
    const pending = pendingChildEntry;
    if (pending !== null && pending.index === index) {
        clearPendingPlaylistPreviewChildEntry();
        // One macrotask later: this runs from the child's own mount effect, and
        // what it does is dispatch a real click onto a card — which presents,
        // and which must not run inside the render commit that has only just put
        // those cards in the DOM.
        setTimeout(() => {
            // Still the element the cursor is on? A second landing between the
            // slides being asked for and arriving has already taken over.
            if (childSteppingMap.get(index) === stepping) {
                stepping(pending.event, true);
            }
        }, 0);
    }
    return () => {
        // Only if it is still ours: a re-register for the same position from the
        // element that replaced this one must not be dropped by our cleanup.
        if (childSteppingMap.get(index) === stepping) {
            childSteppingMap.delete(index);
        }
    };
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

/**
 * Whether the run is on this element. A boolean rather than the remembered key,
 * so only the two elements the cursor left and landed on re-render — the key
 * changes for every element at once.
 */
export function usePlaylistPreviewIsItemSelected(
    playlistFilePath: string,
    itemKey: string,
    index: number,
) {
    const getSnapshot = () => {
        return checkIsPlaylistPreviewItemSelected(
            playlistFilePath,
            itemKey,
            index,
        );
    };
    return useSyncExternalStore(subscribeSelecting, getSnapshot, getSnapshot);
}

/**
 * Whether THIS slide is the one the run is on — a boolean, not the remembered
 * id, on purpose.
 *
 * One subscription per card, but the snapshot only flips for the two cards the
 * cursor left and landed on, so a step re-renders two of them. Answering with
 * the id instead would change every card's snapshot at once and re-render a
 * whole long document on every press.
 *
 * `itemKey` of null is the caller saying this card has no cursor of its own (a
 * single-slide entry, whose own label already carries the element cursor).
 */
export function usePlaylistPreviewIsChildSelected(
    playlistFilePath: string,
    itemKey: string | null,
    index: number,
    childId: number,
) {
    const getSnapshot = () => {
        if (itemKey === null) {
            return false;
        }
        return (
            getPlaylistPreviewSelectedChildId(
                playlistFilePath,
                itemKey,
                index,
            ) === childId
        );
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
