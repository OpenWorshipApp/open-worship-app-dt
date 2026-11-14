/**
 * What an assistant's show put on the screens, kept so an undo takes it off
 * (2026-11-13, EC-540).
 *
 * A foreground change is backed up as the session's SETTINGS (`runBackedUp`
 * in `agentForegroundHelpers.ts`, `app-setting` restores). An undo of a start
 * put those back and left the overlay up: the countdown a volunteer had just
 * undone ran on, on the wall, owned by no session any more. So a show also
 * keeps the screens -- each slot of the component's list on each screen that
 * the show changed, with what it held before (`screen-foreground` restores,
 * `diffForegroundSlots`) -- and an undo puts that back: the overlay off, or
 * the one it replaced up again; an undo of the undo puts the show back.
 *
 * A Long Text Show is drawn in the text layer a Bible passage is drawn in, not
 * in a foreground list, so its show keeps that layer instead (`screen-text`
 * restores, EC-550): the text off, or the verse or text it replaced up again
 * -- only while the layer still holds what the show left there.
 *
 * Imported lazily, by `agentBackupHelpers.ts` and `agentForegroundHelpers.ts`,
 * and it reads a saved list back through the foreground manager lazily too.
 */
import {
    getAllScreenManagers,
    getScreenManagerByScreenId,
} from '../_screen/managers/screenManagerHelpers';
import type ScreenManager from '../_screen/managers/ScreenManager';
import type { ForegroundDataType } from '../_screen/screenTypeHelpers';
import type { ForegroundComponentKeyType } from '../presenter-foreground/foregroundComponentKeys';
import appProvider from '../server/appProvider';
import {
    type AgentRestoreType,
    type AgentScreenListType,
    type AgentTextLayerType,
    checkIsScreenRestore,
    diffForegroundSlots,
    diffTextLayers,
    mergeForegroundSlot,
    toForegroundItemKey,
    toTextLayerKey,
} from './agentBackupPlanHelpers';

type ScreenRestoreType = Extract<
    AgentRestoreType,
    { type: 'screen-foreground' | 'screen-text' }
>;

// With a screen's own controls and layers (`owa_screen_edit`), which
// `agentScreenControlRestoreHelpers.ts` puts back: the same page and lock
// rules hold an undo of them.
type CheckedScreenRestoreType = Extract<
    AgentRestoreType,
    {
        type:
            | 'screen-foreground'
            | 'screen-text'
            | 'screen-setting'
            | 'screen-layer'
            | 'screen-presence';
    }
>;

// The list each component's overlays are held in on a screen. A Long Text
// Show is not here: it is drawn by its own manager, in the text layer.
const FOREGROUND_LIST_KEY_MAP: Partial<
    Record<ForegroundComponentKeyType, keyof ForegroundDataType>
> = {
    countdown: 'countdownDataList',
    stopwatch: 'stopwatchDataList',
    time: 'timeDataList',
    'marquee-top': 'marqueeTopDataList',
    'marquee-bottom': 'marqueeBottomDataList',
    'quick-text': 'quickTextDataList',
    message: 'messageDataList',
    camera: 'cameraDataList',
    screen: 'screenDataList',
    web: 'webDataList',
    video: 'videoDataList',
    image: 'imageDataList',
};

export function toForegroundListKey(widget: ForegroundComponentKeyType) {
    return FOREGROUND_LIST_KEY_MAP[widget] ?? null;
}

function toJsonItems(items: unknown[]): unknown[] {
    return JSON.parse(JSON.stringify(items ?? []));
}

/** Every live screen's items of one list, as JSON, at this moment. */
export function captureForegroundLists(
    listKey: keyof ForegroundDataType,
): AgentScreenListType[] {
    return getAllScreenManagers()
        .filter((screenManager) => {
            return !screenManager.isDeleted;
        })
        .map((screenManager) => {
            return {
                screenId: screenManager.screenId,
                items: toJsonItems(
                    screenManager.screenForegroundManager.foregroundData[
                        listKey
                    ] as unknown[],
                ),
            };
        });
}

/** The restores that take back what happened to the screens in between. */
export function diffCapturedForeground(
    widget: ForegroundComponentKeyType,
    listKey: keyof ForegroundDataType,
    beforeList: AgentScreenListType[],
) {
    return diffForegroundSlots(
        listKey,
        beforeList,
        captureForegroundLists(listKey),
        widget,
    );
}

/** Every live screen's text layer, as JSON, at this moment. */
export function captureTextLayers(): AgentTextLayerType[] {
    return getAllScreenManagers()
        .filter((screenManager) => {
            return !screenManager.isDeleted;
        })
        .map((screenManager) => {
            return {
                screenId: screenManager.screenId,
                data: toJsonData(
                    screenManager.screenLongTextManager.screenViewData,
                ),
            };
        });
}

function toJsonData(data: unknown): unknown {
    return data === null || data === undefined
        ? null
        : JSON.parse(JSON.stringify(data));
}

type CapturedScreensType =
    | { textList: AgentTextLayerType[] }
    | { listKey: keyof ForegroundDataType; beforeList: AgentScreenListType[] }
    | null;

/**
 * What a change to `widget` can do to the screens, read before it: the
 * component's list, or the text layer for a Long Text Show. `null` for a
 * component that is on no screen of its own.
 */
export function captureWidgetScreens(
    widget: ForegroundComponentKeyType,
): CapturedScreensType {
    if (widget === 'long-text') {
        return { textList: captureTextLayers() };
    }
    const listKey = toForegroundListKey(widget);
    return listKey === null
        ? null
        : { listKey, beforeList: captureForegroundLists(listKey) };
}

/** The restores that take back what the change did to them, read after. */
export function diffWidgetScreens(
    widget: ForegroundComponentKeyType,
    captured: CapturedScreensType,
): AgentRestoreType[] {
    if (captured === null) {
        return [];
    }
    if ('textList' in captured) {
        return diffTextLayers(captured.textList, captureTextLayers(), widget);
    }
    return diffCapturedForeground(
        widget,
        captured.listKey,
        captured.beforeList,
    );
}

function pickScreenRestores(restores: AgentRestoreType[]) {
    return restores.filter((restore): restore is CheckedScreenRestoreType => {
        return checkIsScreenRestore(restore);
    });
}

// What a locked screen refuses: whatever goes onto it, Line Sync, whose
// setter asks the lock too, and being taken away. Its card's other controls
// -- the group, the display, a transition, the tick -- stay pressable on a
// locked screen.
function checkIsRefusedWhenLocked(restore: CheckedScreenRestoreType) {
    return restore.type !== 'screen-setting' || restore.field === 'line-sync';
}

// The layers a screen holds something in: what it shows when it is on.
function checkHoldsAnything(screenManager: ScreenManager) {
    return [
        screenManager.screenBackgroundManager,
        screenManager.screenVaryAppDocumentManager,
        screenManager.screenLongTextManager,
        screenManager.screenForegroundManager,
        screenManager.screenDrawManager,
    ].some((layerManager) => {
        return layerManager.isShowing;
    });
}

/**
 * Why a screen a change added cannot be taken away by its undo, or `null`:
 * turned on, or holding anything, since -- it is somebody's screen now
 * (2026-11-14, EC-630). Its lock is the lock check's.
 */
function genScreenInUseReason(restores: CheckedScreenRestoreType[]) {
    for (const restore of restores) {
        if (restore.type !== 'screen-presence' || restore.present) {
            continue;
        }
        const screenManager = findLiveManager(restore.screenId);
        if (screenManager === null) {
            continue;
        }
        if (screenManager.isShowing) {
            return (
                `Screen ${restore.screenId} has been turned on since it was ` +
                'added, so the undo leaves it: turn it off first, or remove ' +
                "it with Delete in its Mini Screen card's menu. Nothing was " +
                'changed.'
            );
        }
        if (checkHoldsAnything(screenManager)) {
            return (
                `Screen ${restore.screenId} holds something since it was ` +
                'added, so the undo leaves it: clear it first, or remove it ' +
                "with Delete in its Mini Screen card's menu. Nothing was " +
                'changed.'
            );
        }
    }
    return null;
}

function findLiveManager(screenId: number) {
    const screenManager = getScreenManagerByScreenId(screenId);
    return screenManager === null || screenManager.isDeleted
        ? null
        : screenManager;
}

/**
 * Why an undo that changes a screen cannot run here, before anything of it
 * is put back -- or `null`. Asked first so an undo is all or nothing: half of
 * one, the session back and its overlay still up, is the fault itself.
 */
export function checkScreenRestores(restores: AgentRestoreType[]) {
    const screenRestoreList = pickScreenRestores(restores);
    if (screenRestoreList.length === 0) {
        return null;
    }
    if (!appProvider.isPagePresenter) {
        return (
            'This change put something on a screen, and the screens are ' +
            'changed from the Presenter page; the main window is not on it. ' +
            'Switch it to the Presenter, then undo again. Nothing was changed.'
        );
    }
    // A screen this undo unlocks is unlocked before anything goes onto it
    // (`sortRestoresForUndo`), so its lock now refuses nothing.
    const unlockedIdSet = new Set<number>();
    for (const restore of screenRestoreList) {
        if (
            restore.type === 'screen-setting' &&
            restore.field === 'lock' &&
            restore.value === false &&
            restore.screenId !== undefined
        ) {
            unlockedIdSet.add(restore.screenId);
        }
    }
    const lockedIdSet = new Set<number>();
    for (const restore of screenRestoreList) {
        if (
            restore.screenId === undefined ||
            !checkIsRefusedWhenLocked(restore) ||
            unlockedIdSet.has(restore.screenId)
        ) {
            continue;
        }
        if (findLiveManager(restore.screenId)?.isLocked) {
            lockedIdSet.add(restore.screenId);
        }
    }
    if (lockedIdSet.size === 0) {
        return genScreenInUseReason(screenRestoreList);
    }
    return (
        `Screen ${[...lockedIdSet].join(' and ')} is locked, so it refuses a ` +
        'change. The lock button is on its Mini Screen card; unlock it, then ' +
        'undo again. Nothing was changed.'
    );
}

/** What the restore's slot holds now: an undo of the undo puts it back. */
export function snapshotScreenRestore(
    restore: ScreenRestoreType,
): ScreenRestoreType {
    const screenManager = findLiveManager(restore.screenId);
    if (restore.type === 'screen-text') {
        // Put back only over what this undo leaves there.
        return {
            ...restore,
            data: toJsonData(
                screenManager?.screenLongTextManager.screenViewData,
            ),
            expect: toTextLayerKey(restore.data),
        };
    }
    const list = (screenManager?.screenForegroundManager.foregroundData[
        restore.listKey as keyof ForegroundDataType
    ] ?? []) as unknown[];
    return {
        ...restore,
        items: toJsonItems(
            list.filter((item) => {
                return toForegroundItemKey(item) === restore.itemKey;
            }),
        ),
    };
}

/**
 * The slot as it was, on its screen, through the list's own setter -- drawn,
 * saved and sent to the screen's sync group like any show. A screen that is
 * gone has nothing on it to take off.
 */
export async function applyScreenRestore(restore: ScreenRestoreType) {
    const screenManager = findLiveManager(restore.screenId);
    if (screenManager === null) {
        return;
    }
    if (restore.type === 'screen-text') {
        const textManager = screenManager.screenLongTextManager;
        // A verse or another text put up since stays: only what the change
        // left there is taken back.
        if (toTextLayerKey(textManager.screenViewData) !== restore.expect) {
            return;
        }
        textManager.applyFullDataSrcWithSyncGroup(
            toJsonData(restore.data) as typeof textManager.screenViewData,
        );
        return;
    }
    const { default: ScreenForegroundManager } =
        await import('../_screen/managers/ScreenForegroundManager');
    const manager = screenManager.screenForegroundManager;
    const listKey = restore.listKey as keyof ForegroundDataType;
    const setter = manager.setterMap.get(listKey);
    if (setter === undefined) {
        return;
    }
    // Read back the way a saved screen is: a countdown's `dateTime` is a Date
    // again, not the text the backup kept.
    const items = ScreenForegroundManager.parseAllForegroundData({
        [listKey]: toJsonItems(restore.items),
    })[listKey] as unknown[];
    setter(
        mergeForegroundSlot(
            (manager.foregroundData[listKey] ?? []) as unknown[],
            restore.itemKey,
            items,
        ),
    );
}
