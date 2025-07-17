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
        screenManager._stageNumber = instanceSetting.stageNumber ?? 0;
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
    const screenIds = screenManagers.map((screenManagerBase) => {
        return screenManagerBase.screenId;
    });
    let newScreenId = 0;
    while (screenIds.includes(newScreenId)) {
        newScreenId++;
    }
    createScreenManager(newScreenId);
    ScreenManagerBase.fireInstanceEvent();
}

export function getScreenManagersFromSetting() {
    const instanceSetting = getScreenManagersInstanceSetting();
    if (instanceSetting.length > 0) {
        instanceSetting.forEach(({ screenId, isSelected }: any) => {
            const screenManagerBase = createScreenManager(screenId);
            screenManagerBase._isSelected = !!isSelected;
        });
    } else {
        createScreenManager(0);
    }
    const screenManagers = getAllScreenManagers();
    if (screenManagers.length === 1) {
        screenManagers[0]._isSelected = true;
    }
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
