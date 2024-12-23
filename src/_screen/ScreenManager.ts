import { createContext, use } from 'react';

import EventHandler from '../event/EventHandler';
import { DragTypeEnum, DroppedDataType } from '../helper/DragInf';
import { getWindowDim } from '../helper/helpers';
import { log } from '../helper/loggerHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import ScreenAlertManager from './ScreenAlertManager';
import ScreenBackgroundManager from './ScreenBackgroundManager';
import ScreenFullTextManager from './ScreenFullTextManager';
import {
    getAllDisplays, getAllShowingScreenIds, getScreenManagersInstanceSetting,
    hideScreen, ScreenMessageType, setDisplay, showScreen,
    TypeScreenManagerSettingType,
} from './screenHelpers';
import ScreenManagerInf from './ScreenManagerInf';
import ScreenSlideManager from './ScreenSlideManager';
import ScreenTransitionEffect from
    './transition-effect/ScreenTransitionEffect';
import { screenManagerSettingNames } from '../helper/constants';
import { unlocking } from '../server/appHelpers';
import ColorNoteInf from '../helper/ColorNoteInf';

export type ScreenManagerEventType = (
    'instance' | 'update' | 'visible' | 'display-id' | 'resize'
);
const settingName = 'screen-display-';

export const ScreenManagerContext = createContext<ScreenManager | null>(null);
export function useScreenManagerContext(): ScreenManager {
    const screenManager = use(ScreenManagerContext);
    if (screenManager === null) {
        throw new Error(
            'useScreenManager must be used within a ScreenManager ' +
            'Context Provider',
        );
    }
    return screenManager;
}

const cache = new Map<string, any>();
export default class ScreenManager
    extends EventHandler<ScreenManagerEventType>
    implements ScreenManagerInf, ColorNoteInf {

    static readonly eventNamePrefix: string = 'screen-m';
    readonly screenBackgroundManager: ScreenBackgroundManager;
    readonly screenSlideManager: ScreenSlideManager;
    readonly screenFullTextManager: ScreenFullTextManager;
    readonly screenAlertManager: ScreenAlertManager;
    readonly screenId: number;
    isDeleted: boolean;
    width: number;
    height: number;
    name: string;
    private _isSelected: boolean = false;
    private _isShowing: boolean;
    private _colorNote: string | null = null;
    noSyncGroupMap: Map<string, boolean>;

    constructor(screenId: number) {
        super();
        this.isDeleted = false;
        const dim = getWindowDim();
        this.width = dim.width;
        this.height = dim.height;
        this.screenId = screenId;
        this.noSyncGroupMap = new Map();
        this.name = `screen-${screenId}`;
        this.screenBackgroundManager = new ScreenBackgroundManager(screenId);
        this.screenSlideManager = new ScreenSlideManager(screenId);
        this.screenFullTextManager = new ScreenFullTextManager(screenId);
        this.screenAlertManager = new ScreenAlertManager(screenId);
        const ids = getAllShowingScreenIds();
        this._isShowing = ids.some((id) => {
            return id === screenId;
        });
        const screenManagersSetting = getScreenManagersInstanceSetting();
        const instanceSetting = screenManagersSetting.find((item) => {
            return item.screenId === screenId;
        });
        if (instanceSetting) {
            this._isSelected = instanceSetting.isSelected;
            this._colorNote = instanceSetting.colorNote;
        }
    }

    async getColorNote() {
        return this._colorNote;
    }

    async setColorNote(color: string | null) {
        this._colorNote = color;
        await ScreenManager.saveScreenManagersSetting();
        ScreenBackgroundManager.enableSyncGroup(this.screenId);
        ScreenSlideManager.enableSyncGroup(this.screenId);
        ScreenFullTextManager.enableSyncGroup(this.screenId);
        ScreenAlertManager.enableSyncGroup(this.screenId);
        this.sendSyncScreen();
    }

    checkIsSyncGroupEnabled(Class: { eventNamePrefix: string }) {
        const key = Class.eventNamePrefix;
        return !this.noSyncGroupMap.get(key);
    }

    get key() {
        return this.screenId.toString();
    }

    get displayId() {
        return ScreenManager.getDisplayIdByScreenId(this.screenId);
    }

    set displayId(id: number) {
        setSetting(`${settingName}-pid-${this.screenId}`, id.toString());
        if (this.isShowing) {
            setDisplay({
                screenId: this.screenId,
                displayId: id,
            });
        }
        const data = {
            screenId: this.screenId,
            displayId: id,
        };
        this.addPropEvent('display-id', data);
        ScreenManager.addPropEvent('display-id', data);
    }
    get isSelected() {
        return this._isSelected;
    }
    set isSelected(isSelected: boolean) {
        this._isSelected = isSelected;
        ScreenManager.saveScreenManagersSetting();
        this.fireInstanceEvent();
    }
    get isShowing() {
        return this._isShowing;
    }
    set isShowing(isShowing: boolean) {
        this._isShowing = isShowing;
        if (isShowing) {
            this.show();
        } else {
            this.hide();
        }
        this.fireVisibleEvent();
    }
    sendSyncScreen() {
        ScreenTransitionEffect.sendSyncScreen();
        this.screenBackgroundManager.sendSyncScreen();
        this.screenSlideManager.sendSyncScreen();
        this.screenFullTextManager.sendSyncScreen();
        this.screenAlertManager.sendSyncScreen();
        ScreenFullTextManager.sendSynTextStyle();
    }
    show() {
        return showScreen({
            screenId: this.screenId,
            displayId: this.displayId,
        });
    }
    hide() {
        hideScreen(this.screenId);
    }

    fireUpdateEvent() {
        this.addPropEvent('update');
        ScreenManager.fireUpdateEvent();
    }
    static fireUpdateEvent() {
        this.addPropEvent('update');
    }
    fireInstanceEvent() {
        this.addPropEvent('instance');
        ScreenManager.fireInstanceEvent();
    }
    static fireInstanceEvent() {
        this.addPropEvent('instance');
    }
    fireVisibleEvent() {
        this.addPropEvent('visible');
        ScreenManager.fireVisibleEvent();
    }
    static fireVisibleEvent() {
        this.addPropEvent('visible');
    }
    fireResizeEvent() {
        this.addPropEvent('resize');
        ScreenManager.fireVisibleEvent();
    }
    static fireResizeEvent() {
        this.addPropEvent('resize');
    }
    clear() {
        this.screenBackgroundManager.clear();
        this.screenFullTextManager.clear();
        this.screenSlideManager.clear();
        this.screenAlertManager.clear();
        this.fireUpdateEvent();
    }
    async delete() {
        this.isDeleted = true;
        this.clear();
        this.hide();
        cache.delete(this.key);
        await ScreenManager.saveScreenManagersSetting(this.screenId);
        this.fireInstanceEvent();
    }

    receiveScreenDropped(droppedData: DroppedDataType) {
        if ([
            DragTypeEnum.BACKGROUND_COLOR,
            DragTypeEnum.BACKGROUND_IMAGE,
            DragTypeEnum.BACKGROUND_VIDEO,
        ].includes(droppedData.type)) {
            this.screenBackgroundManager.receiveScreenDropped(droppedData);
        } else if (droppedData.type === DragTypeEnum.SLIDE_ITEM) {
            this.screenSlideManager.receiveScreenDropped(droppedData);
        } else if ([
            DragTypeEnum.BIBLE_ITEM,
            DragTypeEnum.LYRIC_ITEM,
        ].includes(droppedData.type)) {
            this.screenFullTextManager.receiveScreenDropped(droppedData);
        } else {
            log(droppedData);
        }
    }

    static getDefaultScreenDisplay() {
        const { primaryDisplay, displays } = getAllDisplays();
        return displays.find((display) => {
            return display.id !== primaryDisplay.id;
        }) || primaryDisplay;
    }

    static getDisplayById(displayId: number) {
        const { displays } = getAllDisplays();
        return displays.find((display) => {
            return display.id === displayId;
        })?.id ?? 0;
    }

    static getDisplayByScreenId(screenId: number) {
        const displayId = this.getDisplayIdByScreenId(screenId);
        const { displays } = getAllDisplays();
        return displays.find((display) => {
            return display.id === displayId;
        }) || this.getDefaultScreenDisplay();
    }

    static getDisplayIdByScreenId(screenId: number) {
        const defaultDisplay = ScreenManager.getDefaultScreenDisplay();
        const str = getSetting(`${settingName}-pid-${screenId}`,
            defaultDisplay.id.toString());
        if (isNaN(parseInt(str))) {
            return defaultDisplay.id;
        }
        const id = parseInt(str);
        const { displays } = getAllDisplays();
        return displays.find((display) => {
            return display.id === id;
        })?.id ?? defaultDisplay.id;
    }

    static getSyncGroupScreenEventHandler(message: ScreenMessageType) {
        const { type } = message;
        if (type === 'background') {
            return ScreenBackgroundManager;
        } else if (type === 'slide') {
            return ScreenSlideManager;
        } else if (type === 'full-text') {
            return ScreenFullTextManager;
        } else if (type === 'alert') {
            return ScreenAlertManager;
        }
        return null;
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const ScreenHandler = this.getSyncGroupScreenEventHandler(message);
        if (ScreenHandler !== null) {
            return ScreenHandler.receiveSyncScreen(message);
        }
        const { type, data, screenId } = message;
        const screenManager = this.getInstance(screenId);
        if (screenManager === null) {
            return;
        }
        if (type === 'init') {
            screenManager.sendSyncScreen();
        } else if (type === 'visible') {
            screenManager.isShowing = data?.isShowing;
        } else if (type === 'effect') {
            ScreenTransitionEffect.receiveSyncScreen(message);
        } else if (type === 'full-text-scroll') {
            ScreenFullTextManager.receiveSyncScroll(message);
        } else if (type === 'full-text-selected-index') {
            ScreenFullTextManager.receiveSyncSelectedIndex(message);
        } else if (type === 'full-text-text-style') {
            ScreenFullTextManager.receiveSyncTextStyle(message);
        } else {
            log(message);
        }
    }

    static getSelectedScreenManagerInstances() {
        return Array.from(cache.values()).filter((screenManager) => {
            return screenManager.isSelected;
        });
    }

    static getScreenManagersSetting() {
        const instanceSetting = getScreenManagersInstanceSetting();
        if (instanceSetting.length > 0) {
            instanceSetting.forEach(({ screenId, isSelected }: any) => {
                if (typeof screenId === 'number') {
                    const screenManager = this.createInstance(screenId);
                    screenManager._isSelected = !!isSelected;
                }
            });
        } else {
            this.createInstance(0);
        }
        const screenManagers = this.getAllInstances();
        if (screenManagers.length === 1) {
            screenManagers[0]._isSelected = true;
        }
        return screenManagers;
    }
    static saveScreenManagersSetting(deletedScreenId?: number) {
        return unlocking(
            screenManagerSettingNames.MANAGERS, async () => {
                const newInstanceSetting: TypeScreenManagerSettingType[] = [];
                for (const screenManager of this.getAllInstances()) {
                    const colorNote = await screenManager.getColorNote();
                    newInstanceSetting.push({
                        screenId: screenManager.screenId,
                        isSelected: screenManager.isSelected,
                        colorNote,
                    });
                }
                let instanceSetting = getScreenManagersInstanceSetting();
                instanceSetting = instanceSetting.map((item) => {
                    return newInstanceSetting.find((newItem) => {
                        return newItem.screenId === item.screenId;
                    }) || item;
                });
                for (const newItem of newInstanceSetting) {
                    if (!instanceSetting.some((item) => {
                        return item.screenId === newItem.screenId;
                    })) {
                        instanceSetting.push(newItem);
                    }
                }
                if (deletedScreenId !== undefined) {
                    instanceSetting = instanceSetting.filter((item) => {
                        return item.screenId !== deletedScreenId;
                    });
                }
                setSetting(
                    screenManagerSettingNames.MANAGERS,
                    JSON.stringify(instanceSetting),
                );
            },
        );
    }

    static getInstanceByKey(key: string) {
        const screenId = parseInt(key);
        return this.getInstance(screenId);
    }

    static getAllInstances(): ScreenManager[] {
        let cachedInstances = Array.from(cache.values());
        if (cachedInstances.length === 0) {
            cachedInstances = getAllShowingScreenIds().map((screenId) => {
                return this.createInstance(screenId);
            });
        }
        return cachedInstances.filter((screenManager) => {
            return !screenManager.isDeleted;
        });
    }

    static async getAllInstancesByColorNote(
        colorNote: string | null, excludeScreenIds: number[] = [],
    ): Promise<ScreenManager[]> {
        if (colorNote === null) {
            return [];
        }
        const allInstances = this.getAllInstances();
        const instances: ScreenManager[] = [];
        for (const screenManager of allInstances) {
            if (excludeScreenIds.includes(screenManager.screenId)) {
                continue;
            }
            const note = await screenManager.getColorNote();
            if (note === colorNote) {
                instances.push(screenManager);
            }
        }
        return instances;
    }

    static createInstance(screenId: number) {
        const key = screenId.toString();
        if (!cache.has(key)) {
            const screenManager = new ScreenManager(screenId);
            cache.set(key, screenManager);
            ScreenManager.saveScreenManagersSetting();
            screenManager.fireUpdateEvent();
            const {
                screenBackgroundManager, screenSlideManager,
                screenFullTextManager, screenAlertManager,
            } = screenManager;
            screenBackgroundManager.fireUpdateEvent();
            screenSlideManager.fireUpdateEvent();
            screenFullTextManager.fireUpdateEvent();
            screenAlertManager.fireUpdateEvent();
        }
        return cache.get(key) as ScreenManager;
    }

    static getInstance(screenId: number) {
        const key = screenId.toString();
        if (cache.has(key)) {
            return cache.get(key) as ScreenManager;
        }
        return null;
    }

    static genNewInstance() {
        const screenManagers = ScreenManager.getAllInstances();
        const screenIds = screenManagers.map((screenManager) => {
            return screenManager.screenId;
        });
        let newScreenId = 0;
        while (screenIds.includes(newScreenId)) {
            newScreenId++;
        }
        this.createInstance(newScreenId);
        this.fireInstanceEvent();
    }

    static async syncGroup(message: ScreenMessageType) {
        const currentScreenManager = this.getInstance(
            message.screenId,
        );
        if (currentScreenManager === null || currentScreenManager.isDeleted) {
            return;
        }
        const colorNote = await currentScreenManager.getColorNote();
        const screenManagers = await ScreenManager.getAllInstancesByColorNote(
            colorNote, [currentScreenManager.screenId],
        );
        screenManagers.forEach((screenManager) => {
            const newMessage: ScreenMessageType = {
                ...message,
                screenId: screenManager.screenId,
            };
            const ScreenHandler = this.getSyncGroupScreenEventHandler(
                newMessage,
            );
            if (ScreenHandler !== null) {
                if (!currentScreenManager.checkIsSyncGroupEnabled(
                    ScreenHandler,
                )) {
                    return;
                }
                ScreenHandler.disableSyncGroup(currentScreenManager.screenId);
                ScreenHandler.receiveSyncScreen(newMessage);
            }
        });
    }

    static createGhostInstance() {
        const ghostScreenManager = new ScreenManager(new Date().getTime());
        ghostScreenManager.isDeleted = true;
        return ghostScreenManager;
    }
}
