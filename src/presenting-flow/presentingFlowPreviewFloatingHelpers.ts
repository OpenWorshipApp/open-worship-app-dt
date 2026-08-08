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
import { notifyPresentingFlowRunSelectionChanged } from './presentingFlowAutoNextHelpers';
import type PresentingFlowItem from './PresentingFlowItem';
import { toPresentingFlowSettingName } from './presentingFlowHelpers';

/**
 * WHICH presenting flows have a floating full-preview widget open.
 *
 * One widget per FILE, and several at once: a service is built out of more than
 * one run sheet often enough — the songs in one, the sermon in another — and
 * before this, opening the second silently closed the first and threw away where
 * its run had got to. Still at most one per file, because two widgets on one
 * presenting flow would fight over the same persisted rect, the same folding and
 * the same cursor.
 *
 * An ARRAY that is REPLACED, never mutated: `useSyncExternalStore` compares
 * snapshots by identity, so building a fresh array per read would re-render
 * forever. The same shape the documents panel's floating previews use.
 *
 * In memory only, and nothing is reopened on the next launch: each widget holds
 * the slides of whatever it has unfolded, and restoring a set of them would put
 * that cost on every start.
 */
const listeners = new Set<() => void>();
let openedFilePaths: string[] = [];

export function getPresentingFlowPreviewFilePaths() {
    return openedFilePaths;
}

function notifyListeners() {
    for (const listener of listeners) {
        listener();
    }
}

export function checkIsPresentingFlowPreviewOpened(filePath: string) {
    return openedFilePaths.includes(filePath);
}

export function openPresentingFlowPreviewFilePath(filePath: string) {
    if (openedFilePaths.includes(filePath)) {
        return;
    }
    openedFilePaths = [...openedFilePaths, filePath];
    notifyListeners();
}

export function closePresentingFlowPreviewFilePath(filePath: string) {
    if (!openedFilePaths.includes(filePath)) {
        return;
    }
    openedFilePaths = openedFilePaths.filter((openedFilePath) => {
        return openedFilePath !== filePath;
    });
    forgetPresentingFlowPreviewState(filePath);
    notifyListeners();
}

/**
 * Drop everything held in memory for ONE presenting flow's preview.
 *
 * Closing a widget ends THAT run — the remembered element belonged to it, and
 * keeping it would leave the next-key stepping from an element that is no longer
 * listed. Its folding goes too: that lives in a setting, so reopening reads it
 * back for the cost of one file read, and a session that opened a dozen sheets
 * must not keep a set of keys for every one of them.
 */
export function forgetPresentingFlowPreviewState(filePath: string) {
    clearPresentingFlowPreviewSelectedItem(filePath);
    collapsingCacheMap.delete(filePath);
    childSteppingMap.delete(filePath);
}

export function togglePresentingFlowPreviewFilePath(filePath: string) {
    if (openedFilePaths.includes(filePath)) {
        closePresentingFlowPreviewFilePath(filePath);
    } else {
        openPresentingFlowPreviewFilePath(filePath);
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function usePresentingFlowPreviewFilePaths() {
    return useSyncExternalStore(
        subscribe,
        getPresentingFlowPreviewFilePaths,
        getPresentingFlowPreviewFilePaths,
    );
}

/**
 * A boolean for ONE presenting flow rather than the whole list, so opening a
 * widget re-renders only the row it was opened from.
 */
export function useIsPresentingFlowPreviewOpened(filePath: string) {
    const getSnapshot = () => {
        return openedFilePaths.includes(filePath);
    };
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Which elements are folded away in the preview, remembered per presenting flow file.
 *
 * One setting per PRESENTING_FLOW, holding the COLLAPSED keys only — not one setting
 * per element. Settings are files, read synchronously from render bodies and
 * cached in a handful of slots, so a key per element would mean a file read per
 * element on open and would evict everything else from that cache; and since
 * elements start expanded, the common case writes nothing at all.
 */
const COLLAPSING_SETTING_PREFIX = 'presenting-flow-preview-collapsed';
const collapsingListeners = new Set<() => void>();
// One entry per OPEN widget, dropped again by `closePresentingFlowPreviewFilePath`
// — a map that merely grew per presenting flow ever visited would hold a set of
// keys for every sheet of a long session.
const collapsingCacheMap = new Map<string, Set<string>>();

function toCollapsingSettingName(presentingFlowFilePath: string) {
    return toPresentingFlowSettingName(
        COLLAPSING_SETTING_PREFIX,
        presentingFlowFilePath,
    );
}

// Read once per presenting flow and kept in memory afterwards: nothing else writes
// this setting, so re-reading it on every render would be pure I/O.
function readCollapsedKeys(presentingFlowFilePath: string) {
    const cachedKeys = collapsingCacheMap.get(presentingFlowFilePath);
    if (cachedKeys !== undefined) {
        return cachedKeys;
    }
    const keys = new Set<string>();
    const rawSetting = getSetting(
        toCollapsingSettingName(presentingFlowFilePath),
    );
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
    collapsingCacheMap.set(presentingFlowFilePath, keys);
    return keys;
}

/**
 * Identifies WHICH element the state belongs to, not where it sits: keyed by
 * the element itself so reordering the presenting flow does not shuffle which previews
 * are folded. Two identical entries in one presenting flow therefore fold together —
 * the same trade-off the tree rows already make.
 */
export function toPresentingFlowPreviewItemKey(
    presentingFlowItem: PresentingFlowItem,
) {
    return [
        presentingFlowItem.type,
        presentingFlowItem.itemFilePath,
        presentingFlowItem.id,
        presentingFlowItem.stage,
        // The stored entries that are not file references (backgrounds, bible
        // items, foregrounds) are told apart only by their captured label. An
        // action has no captured label — its title is translated on the fly, so
        // its stored id is used instead and a folded run sheet survives the
        // language being switched. A RUN action carries what it is ARMED with
        // too: two timeouts armed differently are two different lines of the
        // sheet, whether they were armed with seconds, with a time of day or —
        // uniquely per sheet, so it tells any two of them apart — with a
        // shortcut.
        presentingFlowItem.isRunAction
            ? `${presentingFlowItem.data}-${presentingFlowItem.actionKey ?? presentingFlowItem.actionTime ?? presentingFlowItem.actionNumber}`
            : presentingFlowItem.isAction
              ? presentingFlowItem.data
              : presentingFlowItem.title,
    ].join('|');
}

export function checkIsPresentingFlowPreviewItemExpanded(
    presentingFlowFilePath: string,
    itemKey: string,
) {
    return !readCollapsedKeys(presentingFlowFilePath).has(itemKey);
}

function writeCollapsedKeys(presentingFlowFilePath: string, keys: Set<string>) {
    collapsingCacheMap.set(presentingFlowFilePath, keys);
    const settingName = toCollapsingSettingName(presentingFlowFilePath);
    if (keys.size === 0) {
        // Everything is expanded again — drop the file instead of leaving an
        // empty one behind for every presenting flow ever previewed.
        removeSetting(settingName);
    } else {
        setSetting(settingName, JSON.stringify(Array.from(keys)));
    }
    for (const listener of collapsingListeners) {
        listener();
    }
}

export function setPresentingFlowPreviewItemCollapsed(
    presentingFlowFilePath: string,
    itemKey: string,
    isCollapsed: boolean,
) {
    const keys = new Set(readCollapsedKeys(presentingFlowFilePath));
    if (isCollapsed) {
        keys.add(itemKey);
    } else {
        keys.delete(itemKey);
    }
    writeCollapsedKeys(presentingFlowFilePath, keys);
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
export function expandPresentingFlowPreviewItem(
    presentingFlowFilePath: string,
    itemKey: string,
) {
    if (
        checkIsPresentingFlowPreviewItemExpanded(
            presentingFlowFilePath,
            itemKey,
        )
    ) {
        return;
    }
    setPresentingFlowPreviewItemCollapsed(
        presentingFlowFilePath,
        itemKey,
        false,
    );
}

/**
 * Fold every listed element away, or unfold them all, in one write.
 *
 * Takes the keys of the elements that are actually LISTED rather than merging
 * into what was already stored: folding everything away therefore stores exactly
 * the current run sheet, so entries that have since been removed from the
 * presenting flow stop being carried in the setting for good.
 */
export function setAllPresentingFlowPreviewItemsCollapsed(
    presentingFlowFilePath: string,
    itemKeys: string[],
    isCollapsed: boolean,
) {
    writeCollapsedKeys(
        presentingFlowFilePath,
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
export function bringPresentingFlowRunElementToView(element: Element) {
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
export const PRESENTING_FLOW_PREVIEW_ITEM_INDEX_KEY =
    'data-presenting-flow-preview-index';

/**
 * WHICH element each open preview is currently "on", so a next-key knows where to
 * step from. One slot PER OPEN WIDGET, held in memory only: this is where a run
 * has got to right now, not something to restore days later, and two sheets open
 * side by side are two runs that must not read each other's cursor.
 *
 * The position is kept ALONGSIDE the key rather than instead of it: two
 * identical entries in one presenting flow share a key (see
 * `toPresentingFlowPreviewItemKey`), so stepping off the second one would otherwise
 * jump back to the first. The key is what survives a reorder, so it is the
 * fallback when the position no longer holds it.
 *
 * `childId` is the same answer one level down — WHICH slide of the selected
 * element the run is on. ONE slot per widget, not one per element: a run has one
 * position, and crossing into an element always restarts it at its first slide
 * anyway (`isEntering`), so remembering where each element was left would be
 * remembering something nothing ever reads back.
 *
 * Deliberately NOT derived from what is on a screen. Several elements can be
 * live at once — the same document may even be listed twice, or be live from
 * the presenter's own list — and the screens cannot say which of those the
 * operator is walking. This is the panel's own cursor, held for as long as its
 * widget is open and forgotten with it.
 */
type PresentingFlowPreviewSelectingType = {
    itemKey: string;
    index: number;
    childId: number | null;
};
const selectingListeners = new Set<() => void>();
const selectingStateMap = new Map<string, PresentingFlowPreviewSelectingType>();

function notifySelectingListeners() {
    for (const listener of selectingListeners) {
        listener();
    }
}

/**
 * The cursor of ONE run MOVED. Told to the panel's own subscribers, and to that
 * run's clock — a `Next: Timeout` is cancelled by the run going somewhere and by
 * nothing else, and a `Next: Interval` starts its count again from there. This is
 * the one place that knows the cursor moved at all, so it is the one place either
 * can be answered from without guessing at raw clicks and keys.
 *
 * Named with the presenting flow it belongs to, so stepping one open sheet leaves
 * the clock of another one ticking.
 *
 * Not to be used for a REPAIR — writing back the position a reorder shifted the
 * same element to is not the run going anywhere, and a countdown must survive the
 * sheet being tidied underneath it. That one notifies the listeners only.
 */
function notifySelecting(presentingFlowFilePath: string) {
    notifySelectingListeners();
    notifyPresentingFlowRunSelectionChanged(presentingFlowFilePath);
}

export function clearPresentingFlowPreviewSelectedItem(
    presentingFlowFilePath: string,
) {
    clearPendingPresentingFlowPreviewChildEntry(presentingFlowFilePath);
    if (!selectingStateMap.has(presentingFlowFilePath)) {
        return;
    }
    selectingStateMap.delete(presentingFlowFilePath);
    notifySelecting(presentingFlowFilePath);
}

export function setPresentingFlowPreviewSelectedItem(
    presentingFlowFilePath: string,
    itemKey: string,
    index: number,
) {
    // Whatever the last landing was still waiting for, it is not what the run is
    // doing now. Dropped before the early return as well: landing on the element
    // the cursor is ALREADY on (a jump, or a shortcut pressed twice) is still a
    // fresh landing, and it will make its own ask.
    clearPendingPresentingFlowPreviewChildEntry(presentingFlowFilePath);
    const selectingState = selectingStateMap.get(presentingFlowFilePath);
    if (
        selectingState !== undefined &&
        selectingState.itemKey === itemKey &&
        selectingState.index === index
    ) {
        return;
    }
    // The run moved to another element, so the slide it was on is not where it
    // is any more. Dropped here rather than left to the element that owned it:
    // that element may well be folded away, or no longer listed at all.
    selectingStateMap.set(presentingFlowFilePath, {
        itemKey,
        index,
        childId: null,
    });
    notifySelecting(presentingFlowFilePath);
}

export function getPresentingFlowPreviewSelectedItemKey(
    presentingFlowFilePath: string,
) {
    return selectingStateMap.get(presentingFlowFilePath)?.itemKey ?? null;
}

/**
 * Whether the run is on THIS element — its position included, not its key alone.
 *
 * Two identical entries in one presenting flow share a key, so a key-only answer marks
 * BOTH of them and the operator is shown two cursors with no way to tell which
 * one a press will step. The position is the only thing that tells them apart,
 * which is why it is stored alongside the key in the first place.
 *
 * A reorder therefore un-marks the element until the next press, which
 * `resolvePresentingFlowPreviewSelectedIndex` repairs by writing the position it found
 * the key at. Briefly marking nothing is the right way round: marking the wrong
 * copy is what a run cannot afford.
 */
export function checkIsPresentingFlowPreviewItemSelected(
    presentingFlowFilePath: string,
    itemKey: string,
    index: number,
) {
    const selectingState = selectingStateMap.get(presentingFlowFilePath);
    return (
        selectingState !== undefined &&
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
export function setPresentingFlowPreviewSelectedChild(
    presentingFlowFilePath: string,
    itemKey: string,
    index: number,
    childId: number | null,
) {
    const selectingState = selectingStateMap.get(presentingFlowFilePath);
    if (
        !checkIsPresentingFlowPreviewItemSelected(
            presentingFlowFilePath,
            itemKey,
            index,
        ) ||
        selectingState === undefined ||
        selectingState.childId === childId
    ) {
        return;
    }
    selectingState.childId = childId;
    notifySelecting(presentingFlowFilePath);
}

export function getPresentingFlowPreviewSelectedChildId(
    presentingFlowFilePath: string,
    itemKey: string,
    index: number,
) {
    return checkIsPresentingFlowPreviewItemSelected(
        presentingFlowFilePath,
        itemKey,
        index,
    )
        ? (selectingStateMap.get(presentingFlowFilePath)?.childId ?? null)
        : null;
}

/**
 * Where the remembered slide sits in the element's slides as they stand NOW, or
 * -1 when nothing is remembered (or what was remembered has been edited away).
 *
 * By id rather than position, the same way the element cursor is by key: a slide
 * added ahead of it must not shift the run onto its neighbour.
 */
export function resolvePresentingFlowPreviewSelectedChildIndex(
    presentingFlowFilePath: string,
    itemKey: string,
    index: number,
    varySlides: { id: number }[],
) {
    const childId = getPresentingFlowPreviewSelectedChildId(
        presentingFlowFilePath,
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
export function resolvePresentingFlowPreviewSelectedIndex(
    presentingFlowFilePath: string,
    presentingFlowItems: PresentingFlowItem[],
) {
    const selectingState = selectingStateMap.get(presentingFlowFilePath);
    if (selectingState === undefined) {
        return -1;
    }
    const { itemKey, index } = selectingState;
    const itemAtIndex = presentingFlowItems[index];
    if (
        itemAtIndex !== undefined &&
        toPresentingFlowPreviewItemKey(itemAtIndex) === itemKey
    ) {
        return index;
    }
    const foundIndex = presentingFlowItems.findIndex((presentingFlowItem) => {
        return toPresentingFlowPreviewItemKey(presentingFlowItem) === itemKey;
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
 * unfolds what it lands on instead (`expandPresentingFlowPreviewItem`).
 */
export function findNextPresentingFlowPreviewIndex(
    presentingFlowItems: PresentingFlowItem[],
    fromIndex: number,
) {
    for (let i = fromIndex + 1; i < presentingFlowItems.length; i++) {
        if (!presentingFlowItems[i].isDisabled) {
            return i;
        }
    }
    return -1;
}

/**
 * The shortcuts this run sheet answers to, in the order the sheet lists them.
 *
 * DEDUPED, first line wins — the same answer `PresentingFlowItem.bindCcSources` gives
 * two entries sharing a uuid, and for the same reason: `PresentingFlow` refuses to
 * write a shortcut that is already taken, so a repeat here is a hand-edited file
 * or an imported archive, and the honest reading of two lines answering to one
 * key is the first of them. Without it the widget would also register the same
 * key twice and render two rows under one React key.
 *
 * Only unique WITHIN a sheet: two sheets open side by side may well answer to the
 * same key, and each widget gates its own on holding focus
 * (`checkIsPresentingFlowRunKeyOwned`), so the one the operator is working in is
 * the one that moves.
 *
 * PARKED lines are left out rather than registered and then ignored: a shortcut
 * that swallowed a key press and did nothing is worse than one that never took
 * the key, and parking a line is the operator saying it takes no part in the run.
 */
export function collectPresentingFlowRunShortcutKeys(
    presentingFlowItems: PresentingFlowItem[] | null | undefined,
): string[] {
    if (!presentingFlowItems?.length) {
        return [];
    }
    const shortcutKeys: string[] = [];
    for (const presentingFlowItem of presentingFlowItems) {
        const { actionKey } = presentingFlowItem;
        if (
            actionKey !== null &&
            !presentingFlowItem.isDisabled &&
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
export function findPresentingFlowRunShortcutUuid(
    presentingFlowItems: PresentingFlowItem[] | null | undefined,
    shortcutKey: string,
): string | null {
    if (!presentingFlowItems?.length) {
        return null;
    }
    for (const presentingFlowItem of presentingFlowItems) {
        if (
            presentingFlowItem.actionKey === shortcutKey &&
            !presentingFlowItem.isDisabled &&
            presentingFlowItem.uuid !== null
        ) {
            return presentingFlowItem.uuid;
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
 * which `checkIsDisabled` answers for — the presenting flow knows that, the slide
 * itself does not.
 */
export function findNextPresentingFlowPreviewChildIndex(
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
 * Keyed by the presenting flow and then by the element's position, which is what
 * that widget's key handler has; a stepper re-registers itself when the list is
 * re-read and the position moves. The presenting flow is part of the key because
 * two open sheets both have an element 3, and one sheet's next-key must never
 * walk the other's document.
 */
export type PresentingFlowPreviewChildSteppingType = (
    event: MouseEvent,
    isEntering: boolean,
) => boolean;
const childSteppingMap = new Map<
    string,
    Map<number, PresentingFlowPreviewChildSteppingType>
>();

/**
 * The run has landed on an element whose slides are not there YET.
 *
 * Unfolding a document mounts its preview, which then reads its slides off disk —
 * so at the moment of landing there is nothing registered to step into, and the
 * run would sit on the element's header having shown nothing. This remembers the
 * ask; `registerPresentingFlowPreviewChildStepping` answers it as soon as the slides
 * arrive.
 *
 * ONE slot per open widget, exactly like the cursor it belongs to, and cleared
 * the moment that cursor moves anywhere else: an ask that outlived its landing
 * would put a slide on a live screen the next time the operator happened to
 * unfold that element by hand.
 */
const pendingChildEntryMap = new Map<
    string,
    {
        index: number;
        event: MouseEvent;
    }
>();

function clearPendingPresentingFlowPreviewChildEntry(
    presentingFlowFilePath: string,
) {
    pendingChildEntryMap.delete(presentingFlowFilePath);
}

export function requestPresentingFlowPreviewChildEntry(
    presentingFlowFilePath: string,
    index: number,
    event: MouseEvent,
) {
    pendingChildEntryMap.set(presentingFlowFilePath, { index, event });
}

export function registerPresentingFlowPreviewChildStepping(
    presentingFlowFilePath: string,
    index: number,
    stepping: PresentingFlowPreviewChildSteppingType,
) {
    let steppingMap = childSteppingMap.get(presentingFlowFilePath);
    if (steppingMap === undefined) {
        steppingMap = new Map();
        childSteppingMap.set(presentingFlowFilePath, steppingMap);
    }
    steppingMap.set(index, stepping);
    const pending = pendingChildEntryMap.get(presentingFlowFilePath);
    if (pending !== undefined && pending.index === index) {
        clearPendingPresentingFlowPreviewChildEntry(presentingFlowFilePath);
        // One macrotask later: this runs from the child's own mount effect, and
        // what it does is dispatch a real click onto a card — which presents,
        // and which must not run inside the render commit that has only just put
        // those cards in the DOM.
        setTimeout(() => {
            // Still the element the cursor is on? A second landing between the
            // slides being asked for and arriving has already taken over.
            if (
                childSteppingMap.get(presentingFlowFilePath)?.get(index) ===
                stepping
            ) {
                stepping(pending.event, true);
            }
        }, 0);
    }
    return () => {
        // Only if it is still ours: a re-register for the same position from the
        // element that replaced this one must not be dropped by our cleanup.
        const currentMap = childSteppingMap.get(presentingFlowFilePath);
        if (currentMap?.get(index) !== stepping) {
            return;
        }
        currentMap.delete(index);
        // The last unfolded document of this sheet has gone: drop its map rather
        // than leaving an empty one per presenting flow ever previewed.
        if (currentMap.size === 0) {
            childSteppingMap.delete(presentingFlowFilePath);
        }
    };
}

/**
 * True when the element moved on to a next slide of its own. `isEntering` marks
 * the run crossing INTO this element, which always starts it at its first slide.
 */
export function stepPresentingFlowPreviewChild(
    presentingFlowFilePath: string,
    index: number,
    event: MouseEvent,
    isEntering: boolean,
) {
    return (
        childSteppingMap.get(presentingFlowFilePath)?.get(index)?.(
            event,
            isEntering,
        ) ?? false
    );
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
export function usePresentingFlowPreviewIsItemSelected(
    presentingFlowFilePath: string,
    itemKey: string,
    index: number,
) {
    const getSnapshot = () => {
        return checkIsPresentingFlowPreviewItemSelected(
            presentingFlowFilePath,
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
export function usePresentingFlowPreviewIsChildSelected(
    presentingFlowFilePath: string,
    itemKey: string | null,
    index: number,
    childId: number,
) {
    const getSnapshot = () => {
        if (itemKey === null) {
            return false;
        }
        return (
            getPresentingFlowPreviewSelectedChildId(
                presentingFlowFilePath,
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
export function usePresentingFlowPreviewCollapsedCount(
    presentingFlowFilePath: string,
    itemKeys: string[],
) {
    const currentRef = useAppCurrentRef({ presentingFlowFilePath, itemKeys });
    const getSnapshot = () => {
        const current = currentRef.current;
        const collapsedKeys = readCollapsedKeys(current.presentingFlowFilePath);
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
export function usePresentingFlowPreviewItemExpanding(
    presentingFlowFilePath: string,
    itemKey: string,
): [boolean, () => void] {
    const getSnapshot = () => {
        return checkIsPresentingFlowPreviewItemExpanded(
            presentingFlowFilePath,
            itemKey,
        );
    };
    const isExpanded = useSyncExternalStore(
        subscribeCollapsing,
        getSnapshot,
        getSnapshot,
    );
    const currentRef = useAppCurrentRef({
        presentingFlowFilePath,
        itemKey,
        isExpanded,
    });
    const handleToggling = useCallback(() => {
        const current = currentRef.current;
        setPresentingFlowPreviewItemCollapsed(
            current.presentingFlowFilePath,
            current.itemKey,
            current.isExpanded,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return [isExpanded, handleToggling];
}

// Where each open widget remembers its size and location. Per FILE, so a second
// sheet opened beside the first does not land on top of it and drag one of them
// does not move the other. Under the prefix the single widget used, so the
// cleanup that runs when a presenting flow is deleted picks these up too.
const PREVIEW_RECT_SETTING_PREFIX =
    'floating-widget-rect-presenting-flow-preview';

export function toPresentingFlowPreviewRectSettingName(filePath: string) {
    return toPresentingFlowSettingName(PREVIEW_RECT_SETTING_PREFIX, filePath);
}
