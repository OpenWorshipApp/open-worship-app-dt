import { DragTypeEnum, DroppedDataType } from '../../helper/DragInf';
import { log } from '../../helper/loggerHelpers';
import ScreenForegroundManager from './ScreenForegroundManager';
import ScreenBackgroundManager from './ScreenBackgroundManager';
import ScreenBibleManager from './ScreenBibleManager';
import ScreenVaryAppDocumentManager from './ScreenVaryAppDocumentManager';
import ScreenEffectManager from './ScreenEffectManager';
import {
    deleteScreenManagerBaseCache,
    getAllScreenManagerBases,
    getScreenManagerBase,
    saveScreenManagersSetting,
} from './screenManagerBaseHelpers';
import ScreenManagerBase from './ScreenManagerBase';
import { RegisteredEventType } from '../../event/EventHandler';
import appProvider from '../../server/appProvider';
import { ScreenMessageType } from '../screenTypeHelpers';

export default class ScreenManager extends ScreenManagerBase {
    readonly screenBackgroundManager: ScreenBackgroundManager;
    readonly screenVaryAppDocumentManager: ScreenVaryAppDocumentManager;
    readonly screenBibleManager: ScreenBibleManager;
    readonly screenOtherManager: ScreenForegroundManager;
    readonly varyAppDocumentEffectManager: ScreenEffectManager;
    readonly backgroundEffectManager: ScreenEffectManager;
    private readonly registeredEventListeners: RegisteredEventType<any, any>[];

    constructor(screenId: number) {
        super(screenId);
        this.varyAppDocumentEffectManager = new ScreenEffectManager(
            this,
            'vary-app-document',
        );
        this.backgroundEffectManager = new ScreenEffectManager(
            this,
            'background',
        );
        this.screenBackgroundManager = new ScreenBackgroundManager(
            this,
            this.backgroundEffectManager,
        );
        this.screenVaryAppDocumentManager = new ScreenVaryAppDocumentManager(
            this,
            this.varyAppDocumentEffectManager,
        );
        this.screenBibleManager = new ScreenBibleManager(this);
        this.screenOtherManager = new ScreenForegroundManager(this);
        this.registeredEventListeners = [];
        this.registeredEventListeners.push(
            ...this.screenVaryAppDocumentManager.registerEventListener(
                ['update'],
                () => {
                    if (this.screenVaryAppDocumentManager.isShowing) {
                        this.screenBibleManager.clear();
                    }
                },
            ),
            ...this.screenBibleManager.registerEventListener(['update'], () => {
                if (this.screenBibleManager.isShowing) {
                    this.screenVaryAppDocumentManager.clear();
                }
            }),
        );
    }

    get isLocked() {
        return super.isLocked;
    }

    set isLocked(isLocked: boolean) {
        super.isLocked = isLocked;
        saveScreenManagersSetting().then(() => {
            this.fireInstanceEvent();
        });
    }

    get isSelected() {
        return super.isSelected;
    }

    set isSelected(isSelected: boolean) {
        super.isSelected = isSelected;
        saveScreenManagersSetting().then(() => {
            this.fireInstanceEvent();
        });
    }

    async setColorNote(color: string | null) {
        await super.setColorNote(color);
        await saveScreenManagersSetting();
        this.fireUpdateEvent();
    }

    sendSyncScreen() {
        ScreenBibleManager.sendSynTextStyle();
        this.backgroundEffectManager.sendSyncScreen();
        this.screenBackgroundManager.sendSyncScreen();
        this.screenOtherManager.sendSyncScreen();
        this.screenVaryAppDocumentManager.sendSyncScreen();
        this.varyAppDocumentEffectManager.sendSyncScreen();
        this.screenBibleManager.sendSyncScreen();
    }

    clear() {
        this.screenBibleManager.clear();
        this.screenVaryAppDocumentManager.clear();
        this.screenOtherManager.clear();
        this.screenBackgroundManager.clear();
        this.fireUpdateEvent();
    }

    async delete() {
        this.isDeleted = true;
        this.hide();
        this.registeredEventListeners.forEach(({ eventName, listener }) => {
            this.removeOnEventListener(eventName, listener);
        });
        this.clear();
        this.varyAppDocumentEffectManager.delete();
        this.backgroundEffectManager.delete();
        this.screenBackgroundManager.delete();
        this.screenVaryAppDocumentManager.delete();
        this.screenBibleManager.delete();
        this.screenOtherManager.delete();
        deleteScreenManagerBaseCache(this.key);
        await saveScreenManagersSetting(this.screenId);
        this.fireInstanceEvent();
    }

    receiveScreenDropped(droppedData: DroppedDataType) {
        if (
            [
                DragTypeEnum.BACKGROUND_COLOR,
                DragTypeEnum.BACKGROUND_IMAGE,
                DragTypeEnum.BACKGROUND_VIDEO,
            ].includes(droppedData.type)
        ) {
            this.screenBackgroundManager.receiveScreenDropped(droppedData);
        } else if (
            [DragTypeEnum.SLIDE, DragTypeEnum.PDF_SLIDE].includes(
                droppedData.type,
            )
        ) {
            this.screenVaryAppDocumentManager.receiveScreenDropped(droppedData);
        } else if (
            [DragTypeEnum.BIBLE_ITEM, DragTypeEnum.LYRIC_ITEM].includes(
                droppedData.type,
            )
        ) {
            this.screenBibleManager.receiveScreenDropped(droppedData);
        } else {
            log(droppedData);
        }
    }

    static getSyncGroupScreenEventHandler(message: ScreenMessageType) {
        const { type } = message;
        if (type === 'background') {
            return ScreenBackgroundManager;
        } else if (type === 'vary-app-document') {
            return ScreenVaryAppDocumentManager;
        } else if (type === 'bible-screen-view') {
            return ScreenBibleManager;
        } else if (type === 'alert') {
            return ScreenForegroundManager;
        }
        return null;
    }

    static applyScreenManagerSyncScreen(message: ScreenMessageType) {
        const ScreenHandler = this.getSyncGroupScreenEventHandler(message);
        if (ScreenHandler !== null) {
            return ScreenHandler.receiveSyncScreen(message);
        }
        const { type, data, screenId } = message;
        const screenManagerBase = getScreenManagerBase(screenId);
        if (screenManagerBase === null) {
            return;
        }
        if (type === 'init') {
            screenManagerBase.sendSyncScreen();
        } else if (type === 'visible') {
            screenManagerBase.isShowing = data?.isShowing;
        } else if (type === 'effect') {
            ScreenEffectManager.receiveSyncScreen(message);
        } else if (type === 'bible-screen-view-scroll') {
            ScreenBibleManager.receiveSyncScroll(message);
        } else if (type === 'bible-screen-view-selected-index') {
            ScreenBibleManager.receiveSyncSelectedIndex(message);
        } else if (type === 'bible-screen-view-text-style') {
            ScreenBibleManager.receiveSyncTextStyle(message);
        } else {
            log(message);
        }
    }

    static initReceiveScreenMessage() {
        const messageUtils = appProvider.messageUtils;
        const channel = messageUtils.channels.screenMessageChannel;
        messageUtils.listenForData(channel, (_, message: ScreenMessageType) => {
            this.applyScreenManagerSyncScreen(message);
        });
    }

    static async getAllScreenManagersByColorNote(
        colorNote: string | null,
        excludeScreenIds: number[] = [],
    ): Promise<ScreenManagerBase[]> {
        if (colorNote === null) {
            return [];
        }
        const allScreenManagers = getAllScreenManagerBases();
        const instances: ScreenManagerBase[] = [];
        for (const screenManager of allScreenManagers) {
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

    static async syncScreenManagerGroup(message: ScreenMessageType) {
        const currentScreenManager = getScreenManagerBase(message.screenId);
        if (currentScreenManager === null || currentScreenManager.isDeleted) {
            return;
        }
        const colorNote = await currentScreenManager.getColorNote();
        const screenManagers = await this.getAllScreenManagersByColorNote(
            colorNote,
            [currentScreenManager.screenId],
        );
        screenManagers.forEach((screenManagerBase) => {
            const newMessage: ScreenMessageType = {
                ...message,
                screenId: screenManagerBase.screenId,
            };
            const ScreenHandler =
                this.getSyncGroupScreenEventHandler(newMessage);
            if (ScreenHandler !== null) {
                if (
                    !currentScreenManager.checkIsSyncGroupEnabled(ScreenHandler)
                ) {
                    return;
                }
                screenManagerBase.noSyncGroupMap.set(
                    ScreenHandler.eventNamePrefix,
                    true,
                );
                ScreenHandler.receiveSyncScreen(newMessage);
            }
        });
    }

    sendScreenMessage(message: ScreenMessageType, isForce?: boolean) {
        if (appProvider.isPageScreen && !isForce) {
            return;
        }
        const messageUtils = appProvider.messageUtils;
        const channel = messageUtils.channels.screenMessageChannel;
        const isSent = messageUtils.sendDataSync(channel, {
            ...message,
            isScreen: appProvider.isPageScreen,
        });
        console.assert(isSent, JSON.stringify({ channel, message }));
        ScreenManager.syncScreenManagerGroup(message);
    }

    createScreenManagerBaseGhost(screenId: number) {
        const ghostScreenManager = new ScreenManager(screenId);
        ghostScreenManager.isDeleted = true;
        return ghostScreenManager;
    }

    getScreenManagerBaseForce(screenId: number) {
        const screenManagerBase = getScreenManagerBase(screenId);
        if (
            screenManagerBase === null ||
            !(screenManagerBase instanceof ScreenManager)
        ) {
            return this.createScreenManagerBaseGhost(screenId);
        }
        return screenManagerBase;
    }
}
