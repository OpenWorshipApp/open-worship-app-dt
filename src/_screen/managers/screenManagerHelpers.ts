import { getAllShowingScreenIds } from '../screenHelpers';
import ScreenManager from './ScreenManager';
import ScreenManagerBase from './ScreenManagerBase';
import {
    getAllScreenManagerBases,
    getScreenManagersInstanceSetting,
    saveScreenManagersSetting,
    cache,
    setScreenManagerBaseCache,
    getScreenManagerBase,
} from './screenManagerBaseHelpers';
import appProvider from '../../server/appProvider';
import { handleError } from '../../helper/errorHelpers';

export function screenManagerFromBase(
    screenManagerBase: ScreenManagerBase | null,
) {
    if (
        screenManagerBase === null ||
        !(screenManagerBase instanceof ScreenManager)
    ) {
        return null;
    }
    return screenManagerBase;
}

export function getScreenManagerByScreenId(screenId: number) {
    return screenManagerFromBase(getScreenManagerBase(screenId));
}

export function getScreenManagerByKey(screenKey: string) {
    const screenId = ScreenManagerBase.idFromKey(screenKey);
    if (screenId === null) {
        return null;
    }
    return getScreenManagerByScreenId(screenId);
}

function screenManagersFromBases(screenManagerBases: ScreenManagerBase[]) {
    return screenManagerBases.filter((screenManagerBase) => {
        return screenManagerBase instanceof ScreenManager;
    }) as any as ScreenManager[];
}

export function initNewScreenManager(screenId: number) {
    const screenManager = new ScreenManager(screenId);
    const screenManagersSetting = getScreenManagersInstanceSetting();
    const instanceSetting = screenManagersSetting.find((item) => {
        return item.screenId === screenId;
    });
    if (instanceSetting) {
        screenManager._isSelected = !!instanceSetting.isSelected;
        screenManager._isLocked = !!instanceSetting.isLocked;
        screenManager._stage = instanceSetting.stageNumber ?? 0;
        screenManager.colorNote = instanceSetting.colorNote ?? null;
    }
    return screenManager;
}

export function createScreenManager(screenId: number) {
    const key = screenId.toString();
    if (!cache.has(key)) {
        const screenManager = initNewScreenManager(screenId);
        setScreenManagerBaseCache(screenManager);
        saveScreenManagersSetting();
    }
    return cache.get(key) as ScreenManager;
}

export function genNewScreenManagerBase() {
    const screenManagers = getAllScreenManagers();
    const screenIds = new Set(
        screenManagers.map((screenManagerBase) => {
            return screenManagerBase.screenId;
        }),
    );
    let newScreenId = 0;
    while (screenIds.has(newScreenId)) {
        newScreenId++;
    }
    createScreenManager(newScreenId);
    ScreenManagerBase.fireInstanceEvent();
}

// Layers that persist their content per screen, and can therefore come back
// from a reload out of step with the rest of their color-note group. The focus
// manager is deliberately absent: spotlighting is a live press-and-hold state
// that is never persisted, so it is always empty at load.
function getContentLayers(screenManager: ScreenManager) {
    return [
        screenManager.screenBackgroundManager,
        screenManager.screenVaryAppDocumentManager,
        screenManager.screenBibleManager,
        screenManager.screenForegroundManager,
        screenManager.screenDrawManager,
    ];
}

// Elect the member carrying the most content, ties going to the lowest
// screenId (members arrive sorted). Deliberately NOT "lowest screenId wins":
// an empty member winning would wipe the whole group's slide/bible/drawing on
// every launch, which is far worse than the divergence being repaired.
function electGroupSyncSource(members: ScreenManager[]) {
    let sourceScreenManager: ScreenManager | null = null;
    let highestCount = 0;
    for (const screenManager of members) {
        const count = getContentLayers(screenManager).filter((layer) => {
            return layer.isShowing;
        }).length;
        if (count > highestCount) {
            highestCount = count;
            sourceScreenManager = screenManager;
        }
    }
    return sourceScreenManager;
}

// Every layer manager restores its own per-screen persisted state in its
// constructor, so a color-note sync group whose members drifted apart before
// the app closed comes back still drifted — the group looks joined but shows
// different content on each screen. Let the elected source broadcast its whole
// state to the group, which is exactly the path a live group sync takes.
//
// Locked groups are skipped: a lock means "freeze this screen's content", and
// the layer setters reject a sync with a toast each anyway.
async function reconcileScreenManagerGroups() {
    const groupMap = new Map<string, ScreenManager[]>();
    for (const screenManager of getAllScreenManagers()) {
        const colorNote = await screenManager.getColorNote();
        if (colorNote === null) {
            continue;
        }
        const members = groupMap.get(colorNote) ?? [];
        members.push(screenManager);
        groupMap.set(colorNote, members);
    }
    for (const members of groupMap.values()) {
        if (members.length < 2) {
            continue;
        }
        if (
            members.some((screenManager) => {
                return screenManager.isLocked;
            })
        ) {
            continue;
        }
        members.sort((screenManager1, screenManager2) => {
            return screenManager1.screenId - screenManager2.screenId;
        });
        const sourceScreenManager = electGroupSyncSource(members);
        if (sourceScreenManager === null) {
            // Whole group is empty; nothing to reconcile.
            continue;
        }
        await sourceScreenManager.sendSyncScreen();
        // Receiving a group sync marks the receiver's noSyncGroupMap so its own
        // echo doesn't bounce back. That flag is sticky, so leaving it set would
        // make this startup repair silently turn the group one-way — only the
        // source could push to the others for the rest of the session. Clear it
        // once the dispatch has settled (syncScreenManagerGroup is fired
        // without being awaited, hence the macrotask hop).
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        for (const screenManager of members) {
            screenManager.noSyncGroupMap.clear();
        }
    }
}

let isGroupReconcileScheduled = false;

function scheduleGroupReconcileOnce() {
    // Only the presenter owns the persisted state; output windows are fed by
    // the presenter's sync (and by their own 'init' re-sync request).
    if (isGroupReconcileScheduled || !appProvider.isPagePresenter) {
        return;
    }
    isGroupReconcileScheduled = true;
    // Deferred off the current task: the caller runs during render, and the
    // sync fires update events that other components subscribe to.
    setTimeout(() => {
        reconcileScreenManagerGroups().catch(handleError);
    }, 0);
}

export function getScreenManagersFromSetting() {
    const instanceSetting = getScreenManagersInstanceSetting();
    if (instanceSetting.length > 0) {
        for (const { screenId, isSelected } of instanceSetting as any[]) {
            const screenManagerBase = createScreenManager(screenId);
            screenManagerBase._isSelected = !!isSelected;
        }
    } else {
        createScreenManager(0);
    }
    const screenManagers = getAllScreenManagers();
    if (screenManagers.length === 1) {
        screenManagers[0]._isSelected = true;
    }
    scheduleGroupReconcileOnce();
    return screenManagers;
}

export function getAllScreenManagers(): ScreenManager[] {
    let cachedInstances = getAllScreenManagerBases();
    if (cachedInstances.length === 0) {
        cachedInstances = getAllShowingScreenIds().map((screenId) => {
            return createScreenManager(screenId);
        });
    }
    cachedInstances = cachedInstances.filter((screenManagerBase) => {
        return !screenManagerBase.isDeleted;
    });
    return screenManagersFromBases(cachedInstances);
}
