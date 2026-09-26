import type { CSSProperties, MouseEvent } from 'react';

import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import {
    genHtmlForegroundMessage,
    genHtmlForegroundCountdown,
    genHtmlForegroundImage,
    genHtmlForegroundMarquee,
    genHtmlForegroundQuickText,
    genHtmlForegroundStopwatch,
    genHtmlForegroundTime,
    genHtmlForegroundVideo,
    genHtmlForegroundWeb,
} from '../screenForegroundHelpers';
import { getForegroundDataListOnScreenSetting } from '../screenHelpers';
import { screenManagerSettingNames } from '../../helper/constants';
import ScreenEventHandler from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import {
    collectLiveOnScreenMap,
    persistOnScreenEntry,
} from './onScreenSettingPersistHelpers';
import type {
    ForegroundMessageDataType,
    ForegroundDataType,
    BasicScreenMessageType,
    ScreenMessageType,
    ForegroundMarqueeDataType,
    MarqueePositionType,
    ForegroundCameraDataType,
    ForegroundCountdownDataType,
    ForegroundImageDataType,
    ForegroundTimeDataType,
    ForegroundQuickTextDataType,
    ForegroundStopwatchDataType,
    ForegroundVideoDataType,
    ForegroundWebDataType,
} from '../screenTypeHelpers';
import { DEFAULT_MARQUEE_SPEED_PERCENTAGE } from '../screenTypeHelpers';
import {
    checkAreObjectsEqual,
    checkIsItemInArray,
} from '../../server/comparisonHelpers';
import type { OptionalPromise } from '../../helper/typeHelpers';
import type ScreenEffectManager from './ScreenEffectManager';
import type { TransitionEffectType } from '../transitionEffectHelpers';
import { getCameraAndShowMedia } from '../../helper/cameraHelpers';

export type ScreenForegroundEventType = 'update';

/**
 * The id carried by the one item the panel's "show all in turn" button
 * puts up. It stands for the WHOLE set rather than for any one editor, so
 * it can never collide with an editor's own id.
 */
export const MESSAGE_ALL_ID = 'message-all';

/**
 * The session part of a single-slot overlay's datum, and NOTHING when there is
 * no session to name.
 *
 * The Default session's id is the empty string, so writing it out would leave
 * every ordinary datum carrying one more key than the one a restored screen
 * reads back from disk -- and `checkAreObjectsEqual` counts keys, so the
 * overlay would be torn down and rebuilt on the first update after a restore.
 */
function toSessionIdPart(sessionId?: string) {
    return sessionId === undefined || sessionId === '' ? {} : { id: sessionId };
}

/**
 * The messages on a screen, read out of a saved foreground entry.
 *
 * It also folds in everything this slot has been. `Alert` and `Announcements`
 * shipped as separate widgets and were merged into one `messageData`; that in
 * turn became a LIST, because a session holds several message editors and each
 * one can be on a screen by itself. A screen that still has an older entry on
 * disk keeps what it was showing -- a silently dropped one is a message the
 * operator left up and cannot find to take down.
 */
function toMessageDataList(foregroundData: any): any[] {
    const messageDataList = foregroundData['messageDataList'] ?? null;
    if (Array.isArray(messageDataList)) {
        return messageDataList;
    }
    const messageData = foregroundData['messageData'] ?? null;
    if (messageData !== null) {
        return [{ id: MESSAGE_ALL_ID, ...messageData }];
    }
    const alertData = foregroundData['alertData'] ?? null;
    if (alertData !== null) {
        return [
            {
                id: MESSAGE_ALL_ID,
                textList: [alertData.text ?? ''],
                intervalSecond: null,
                extraStyle: alertData.extraStyle,
            },
        ];
    }
    const announcementData = foregroundData['announcementData'] ?? null;
    if (announcementData !== null) {
        return [
            {
                id: MESSAGE_ALL_ID,
                textList: announcementData.textList ?? [],
                intervalSecond: announcementData.intervalSecond ?? null,
                extraStyle: announcementData.extraStyle,
            },
        ];
    }
    return [];
}

export default class ScreenForegroundManager extends ScreenEventHandler<ScreenForegroundEventType> {
    static readonly eventNamePrefix: string = 'screen-foreground-m';
    private _div: HTMLDivElement | null = null;
    // Per-instance: sync-grouped screens share the SAME foreground-data object
    // references, so a module-level map keyed by data would let one screen's
    // render evict another screen's container. Each screen owns its containers.
    private readonly containerMapper = new WeakMap<
        object,
        {
            container: HTMLElement;
            removeHandler: () => OptionalPromise<void>;
        }
    >();
    foregroundData: ForegroundDataType;
    rendererMap: Map<string, (data: any) => void>;
    setterMap: Map<string, (data: any, isNoSyncGroup?: boolean) => void>;
    effectManager: ScreenEffectManager;

    constructor(
        screenManagerBase: ScreenManagerBase,
        effectManager: ScreenEffectManager,
    ) {
        super(screenManagerBase);
        this.effectManager = effectManager;

        const allForegroundDataList = getForegroundDataListOnScreenSetting();
        const foregroundData = allForegroundDataList[this.key] ?? {};
        this.foregroundData =
            ScreenForegroundManager.parseAllForegroundData(foregroundData);
        this.rendererMap = new Map<string, (data: any) => void>([
            ['messageDataList', this.renderMessage.bind(this)],
            ['countdownData', this.renderCountdown.bind(this)],
            ['stopwatchData', this.renderStopwatch.bind(this)],
            ['timeDataList', this.renderTime.bind(this)],
            ['marqueeTopData', this.renderMarqueeTop.bind(this)],
            ['marqueeBottomData', this.renderMarqueeBottom.bind(this)],
            ['quickTextData', this.renderQuickText.bind(this)],
            ['cameraDataList', this.renderCamera.bind(this)],
            ['webDataList', this.renderWeb.bind(this)],
            ['videoDataList', this.renderVideo.bind(this)],
            ['imageDataList', this.renderImage.bind(this)],
        ]);
        this.setterMap = new Map<
            string,
            (data: any, isNoSyncGroup?: boolean) => void
        >([
            ['messageDataList', this.setMessageDataList.bind(this)],
            ['countdownData', this.setCountdownData.bind(this)],
            ['stopwatchData', this.setStopwatchData.bind(this)],
            ['timeDataList', this.setTimeDataList.bind(this)],
            ['marqueeTopData', this.setMarqueeTopData.bind(this)],
            ['marqueeBottomData', this.setMarqueeBottomData.bind(this)],
            ['quickTextData', this.setQuickTextData.bind(this)],
            ['cameraDataList', this.setCameraDataList.bind(this)],
            ['webDataList', this.setWebDataList.bind(this)],
            ['videoDataList', this.setVideoDataList.bind(this)],
            ['imageDataList', this.setImageDataList.bind(this)],
        ]);
    }

    get styleAnimFade() {
        return this.effectManager.styleAnimList.fade;
    }

    /**
     * The animation ONE overlay comes in with.
     *
     * The media widgets each choose their own per session, so this reads the
     * datum first; anything without a choice falls back to the layer's own
     * effect, and that to `fade`, which is what every foreground item used to
     * be hardcoded to.
     */
    styleAnimFor(data: { transitionEffect?: TransitionEffectType } | null) {
        const chosen = data?.transitionEffect ?? this.effectManager.effectType;
        return (
            this.effectManager.styleAnimList[chosen] ??
            this.effectManager.styleAnimList.fade
        );
    }

    static parseAllForegroundData(foregroundData: any): ForegroundDataType {
        // Rehydrated into NEW objects rather than by writing `dateTime` back
        // onto the argument. The argument is an entry of the on-screen
        // foreground map, which is memoized and shared — mutating it in place
        // turned the stored ISO string into a `Date` for every later reader.
        const rawCountdownData = foregroundData['countdownData'] ?? null;
        const countdownData =
            rawCountdownData === null
                ? null
                : {
                      ...rawCountdownData,
                      dateTime: new Date(rawCountdownData.dateTime),
                  };
        const rawStopwatchData = foregroundData['stopwatchData'] ?? null;
        const stopwatchData =
            rawStopwatchData === null
                ? null
                : {
                      ...rawStopwatchData,
                      dateTime: new Date(rawStopwatchData.dateTime),
                  };
        const newForegroundData = {
            // Defaulted to `null` like every other slot, and that is
            // load-bearing rather than tidiness: `isShowing` asks
            // `data !== null` of every value, so a key left `undefined` by an
            // older saved entry would report the foreground as showing for
            // ever -- lighting the Clear Foreground button on an empty screen.
            messageDataList: toMessageDataList(foregroundData),
            countdownData,
            stopwatchData,
            timeDataList: foregroundData['timeDataList'] ?? [],
            marqueeTopData: foregroundData['marqueeTopData'] ?? null,
            marqueeBottomData: foregroundData['marqueeBottomData'] ?? null,
            quickTextData: foregroundData['quickTextData'] ?? null,
            cameraDataList: foregroundData['cameraDataList'] ?? [],
            webDataList: foregroundData['webDataList'] ?? [],
            videoDataList: foregroundData['videoDataList'] ?? [],
            imageDataList: foregroundData['imageDataList'] ?? [],
        };
        return newForegroundData;
    }

    get isShowing() {
        return Object.values(this.foregroundData).some((data) => {
            if (Array.isArray(data)) {
                return data.length > 0;
            }
            return data !== null;
        });
    }

    get div(): HTMLDivElement {
        return this._div ?? document.createElement('div');
    }

    set div(div: HTMLDivElement | null) {
        if (this._div === div) {
            return;
        }
        this._div = div;
        this.render();
    }

    removeDivContainer(data: any) {
        if (data === null || !this.containerMapper.has(data)) {
            return;
        }
        const { removeHandler } = this.containerMapper.get(data)!;
        this.containerMapper.delete(data);
        removeHandler();
    }

    /**
     * The wrapper a widget is mounted into. It is deliberately left UNSTYLED:
     * a widget's `mix-blend-mode` blends with whatever is painted below it in
     * the nearest ancestor STACKING CONTEXT, and the background, the slide and
     * the bible view are only reachable while neither this div nor
     * `#foreground` makes one. Giving it a `z-index`, `isolation`, `opacity`
     * below 1, a `filter`, a `transform` or `will-change` would turn every
     * blend mode into a silent no-op.
     */
    createDivContainer(
        data: any,
        removingHandler?: (container: HTMLElement) => Promise<void> | void,
    ): HTMLElement | null {
        const container = document.createElement('div');
        this.removeDivContainer(data);
        this.containerMapper.set(data, {
            container,
            removeHandler: async () => {
                await removingHandler?.(container);
                container.remove();
            },
        });
        this.div.appendChild(container);
        return container;
    }

    _getDiff(oldData: any, newData: any) {
        const toRemoveDataList = [];
        const toRenderDataList = [];
        if (oldData !== newData) {
            if (oldData === null && newData !== null) {
                toRenderDataList.push(newData);
            } else if (oldData !== null && newData === null) {
                toRemoveDataList.push(oldData);
            } else if (Array.isArray(oldData)) {
                for (const newItem of newData) {
                    if (!checkIsItemInArray(newItem, oldData)) {
                        toRenderDataList.push(newItem);
                    }
                }
                for (const oldItem of oldData) {
                    if (!checkIsItemInArray(oldItem, newData)) {
                        toRemoveDataList.push(oldItem);
                    }
                }
            } else if (!checkAreObjectsEqual(oldData, newData)) {
                toRemoveDataList.push(oldData);
                toRenderDataList.push(newData);
            }
        }
        return {
            toRemoveDataList,
            toRenderDataList,
        };
    }
    compareAndRender(oldData: any, newData: any, render: (data: any) => void) {
        const { toRemoveDataList, toRenderDataList } = this._getDiff(
            oldData,
            newData,
        );
        for (const data of toRemoveDataList) {
            this.removeDivContainer(data);
        }
        for (const data of toRenderDataList) {
            render(data);
        }
        if (toRemoveDataList.length + toRenderDataList.length > 0) {
            return newData;
        }
        return oldData;
    }

    saveForegroundData() {
        persistOnScreenEntry({
            lockKey: screenManagerSettingNames.FOREGROUND,
            settingName: screenManagerSettingNames.FOREGROUND,
            key: this.key,
            value: this.foregroundData,
            readMap: getForegroundDataListOnScreenSetting,
            collectLive: () => {
                return collectLiveOnScreenMap(
                    ScreenForegroundManager.getAllInstancesBase<ScreenForegroundManager>(),
                    (instance) => {
                        return instance.foregroundData;
                    },
                );
            },
            onDone: () => {
                this.fireUpdateEvent();
            },
        });
        this.sendSyncScreen();
    }

    toSyncMessage(): BasicScreenMessageType {
        return {
            type: 'foreground',
            data: this.foregroundData,
        };
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenForegroundManager.fireUpdateEvent();
    }

    static async setData(
        event: MouseEvent,
        callback: (screenForegroundManager: ScreenForegroundManager) => void,
        isForceChoosing: boolean,
    ) {
        const callbackSave = async (
            screenForegroundManager: ScreenForegroundManager,
        ) => {
            callback(screenForegroundManager);
            screenForegroundManager.saveForegroundData();
        };
        const screenIds = await this.chooseScreenIds(event, isForceChoosing);
        for (const screenId of screenIds) {
            const screenForegroundManager = this.getInstance(screenId);
            if (screenForegroundManager === null) {
                showSimpleToast(
                    tran(
                        'Failed to apply to screen. Please make sure the screen is open.',
                    ),
                    tran('Error'),
                );
                continue;
            }
            callbackSave(screenForegroundManager);
        }
    }

    renderMessage(data: ForegroundMessageDataType) {
        const { handleAdding, handleRemoving } = genHtmlForegroundMessage(
            data,
            this.styleAnimFade,
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        handleAdding(divContainer!);
    }
    setMessageDataList(
        dataList: ForegroundMessageDataType[],
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                messageDataList: dataList,
            },
            isNoSyncGroup,
        );
    }
    /**
     * Put one editor's message up, REPLACING whatever that same editor had on
     * this screen. Keyed by id like `addTimeData`: editing a message that is
     * already showing and pressing Show again must change that one rather than
     * stack a second copy of it on the screen.
     */
    addMessageData(data: ForegroundMessageDataType, isNoSyncGroup = false) {
        const existingData = this.foregroundData.messageDataList.find(
            (item) => {
                return item.id === data.id;
            },
        );
        if (
            existingData !== undefined &&
            checkAreObjectsEqual(existingData, data)
        ) {
            return;
        }
        const dataList = existingData
            ? this.foregroundData.messageDataList.map((item) => {
                  return item.id === data.id ? data : item;
              })
            : [...this.foregroundData.messageDataList, data];
        this.setMessageDataList(dataList, isNoSyncGroup);
    }
    removeMessageData(id: string, isNoSyncGroup = false) {
        const dataList = this.foregroundData.messageDataList.filter((item) => {
            return item.id !== id;
        });
        this.setMessageDataList(dataList, isNoSyncGroup);
    }
    static async addMessageData(
        event: MouseEvent,
        data: ForegroundMessageDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.addMessageData(data);
            },
            isForceChoosing,
        );
    }

    renderCountdown(data: ForegroundCountdownDataType) {
        const { handleAdding, handleRemoving } = genHtmlForegroundCountdown(
            data,
            this.styleAnimFade,
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        handleAdding(divContainer!);
    }
    setCountdownData(
        data: ForegroundCountdownDataType | null,
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                countdownData: data,
            },
            isNoSyncGroup,
        );
    }
    /**
     * `sessionId` rides LAST and optional on purpose: the panel passes which of
     * its sessions is putting this up, and everything else that starts a
     * countdown -- a dropped run-sheet row, the assistant -- carries no session
     * at all and must keep the call it already makes.
     */
    static async setCountdown(
        event: MouseEvent,
        dateTime: Date | null,
        extraStyle: CSSProperties = {},
        isForceChoosing = false,
        sessionId?: string,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const data = dateTime
                    ? { ...toSessionIdPart(sessionId), dateTime, extraStyle }
                    : null;
                screenForegroundManager.setCountdownData(data);
            },
            isForceChoosing,
        );
    }

    renderStopwatch(data: ForegroundStopwatchDataType) {
        const { handleAdding, handleRemoving } = genHtmlForegroundStopwatch(
            data,
            this.styleAnimFade,
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        handleAdding(divContainer!);
    }
    setStopwatchData(
        data: ForegroundStopwatchDataType | null,
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                stopwatchData: data,
            },
            isNoSyncGroup,
        );
    }
    /** `sessionId` -- see `setCountdown`. */
    static async setStopwatch(
        event: MouseEvent,
        dateTime: Date | null,
        extraStyle: CSSProperties = {},
        isForceChoosing = false,
        sessionId?: string,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const stopwatchData =
                    dateTime === null
                        ? null
                        : {
                              ...toSessionIdPart(sessionId),
                              dateTime,
                              extraStyle,
                          };
                screenForegroundManager.setStopwatchData(stopwatchData);
            },
            isForceChoosing,
        );
    }

    renderTime(data: ForegroundTimeDataType) {
        const { handleAdding, handleRemoving } = genHtmlForegroundTime(
            data,
            this.styleAnimFade,
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        handleAdding(divContainer!);
    }
    setTimeDataList(dataList: ForegroundTimeDataType[], isNoSyncGroup = false) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                timeDataList: dataList,
            },
            isNoSyncGroup,
        );
    }
    addTimeData(data: ForegroundTimeDataType, isNoSyncGroup = false) {
        const existingData = this.foregroundData.timeDataList.find((item) => {
            return item.id === data.id;
        });
        if (
            existingData !== undefined &&
            checkAreObjectsEqual(existingData, data)
        ) {
            return;
        }
        const dataList = existingData
            ? this.foregroundData.timeDataList.map((item) => {
                  return item.id === data.id ? data : item;
              })
            : [...this.foregroundData.timeDataList, data];
        this.setTimeDataList(dataList, isNoSyncGroup);
    }
    removeTimeData(data: ForegroundTimeDataType, isNoSyncGroup = false) {
        const dataList = this.foregroundData.timeDataList.filter((item) => {
            return !checkAreObjectsEqual(item, data);
        });
        this.setTimeDataList(dataList, isNoSyncGroup);
    }
    static async addTimeData(
        event: MouseEvent,
        data: ForegroundTimeDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.addTimeData(data);
            },
            isForceChoosing,
        );
    }
    static async removeTimeData(
        event: MouseEvent,
        data: ForegroundTimeDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.removeTimeData(data);
            },
            isForceChoosing,
        );
    }

    renderMarquee(
        data: ForegroundMarqueeDataType,
        position: MarqueePositionType,
    ) {
        const { element, handleRemoving } = genHtmlForegroundMarquee(
            data,
            this.screenManagerBase,
            position,
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        divContainer!.appendChild(element);
    }
    renderMarqueeTop(data: ForegroundMarqueeDataType) {
        this.renderMarquee(data, 'top');
    }
    renderMarqueeBottom(data: ForegroundMarqueeDataType) {
        this.renderMarquee(data, 'bottom');
    }
    setMarqueeTopData(
        data: ForegroundMarqueeDataType | null,
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                marqueeTopData: data,
            },
            isNoSyncGroup,
        );
    }
    setMarqueeBottomData(
        data: ForegroundMarqueeDataType | null,
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                marqueeBottomData: data,
            },
            isNoSyncGroup,
        );
    }
    /** `sessionId` -- see `setCountdown`. */
    static async setMarqueeTop(
        event: MouseEvent,
        text: string | null,
        extraStyle: CSSProperties = {},
        speedPercentage = DEFAULT_MARQUEE_SPEED_PERCENTAGE,
        isForceChoosing = false,
        sessionId?: string,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const marqueeTopData =
                    text === null
                        ? null
                        : {
                              ...toSessionIdPart(sessionId),
                              text,
                              speedPercentage,
                              extraStyle,
                          };
                screenForegroundManager.setMarqueeTopData(marqueeTopData);
            },
            isForceChoosing,
        );
    }
    /** `sessionId` -- see `setCountdown`. */
    static async setMarqueeBottom(
        event: MouseEvent,
        text: string | null,
        extraStyle: CSSProperties = {},
        speedPercentage = DEFAULT_MARQUEE_SPEED_PERCENTAGE,
        isForceChoosing = false,
        sessionId?: string,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const marqueeBottomData =
                    text === null
                        ? null
                        : {
                              ...toSessionIdPart(sessionId),
                              text,
                              speedPercentage,
                              extraStyle,
                          };
                screenForegroundManager.setMarqueeBottomData(marqueeBottomData);
            },
            isForceChoosing,
        );
    }

    renderQuickText(data: ForegroundQuickTextDataType) {
        const { handleAdding, handleRemoving } = genHtmlForegroundQuickText(
            data,
            this.styleAnimFade,
            () => {
                this.setQuickTextData(null);
            },
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        handleAdding(divContainer!);
    }
    setQuickTextData(
        data: ForegroundQuickTextDataType | null,
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                quickTextData: data,
            },
            isNoSyncGroup,
        );
    }
    /** `sessionId` -- see `setCountdown`. */
    static async setQuickText(
        event: MouseEvent,
        htmlText: string | null,
        timeSecondDelay: number,
        timeSecondToLive: number,
        extraStyle: CSSProperties = {},
        isForceChoosing = false,
        sessionId?: string,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const quickTextData =
                    htmlText === null
                        ? null
                        : {
                              ...toSessionIdPart(sessionId),
                              htmlText,
                              timeSecondDelay,
                              timeSecondToLive,
                              extraStyle,
                          };
                screenForegroundManager.setQuickTextData(quickTextData);
            },
            isForceChoosing,
        );
    }

    renderCamera(data: ForegroundCameraDataType) {
        const store = {
            clearCameraTracks: () => ({}) as OptionalPromise<void>,
        };
        const divContainer = this.createDivContainer(data, async () => {
            await store.clearCameraTracks();
        });
        const newData = {
            parentContainer: divContainer!,
            ...data,
        };
        getCameraAndShowMedia(newData, this.styleAnimFor(data)).then(
            (clearTracks) => {
                store.clearCameraTracks = clearTracks ?? (() => {});
            },
        );
    }
    setCameraDataList(
        dataList: ForegroundCameraDataType[],
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                cameraDataList: dataList,
            },
            isNoSyncGroup,
        );
    }
    addCameraData(data: ForegroundCameraDataType, isNoSyncGroup = false) {
        if (checkIsItemInArray(data, this.foregroundData.cameraDataList)) {
            return;
        }
        const dataList = [...this.foregroundData.cameraDataList, data];
        this.setCameraDataList(dataList, isNoSyncGroup);
    }
    removeCameraData(data: ForegroundCameraDataType, isNoSyncGroup = false) {
        const dataList = this.foregroundData.cameraDataList.filter((item) => {
            return !checkAreObjectsEqual(item, data);
        });
        this.setCameraDataList(dataList, isNoSyncGroup);
    }
    static async addCameraData(
        event: MouseEvent,
        data: ForegroundCameraDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.addCameraData(data);
            },
            isForceChoosing,
        );
    }
    static async removeCameraData(
        event: MouseEvent,
        data: ForegroundCameraDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.removeCameraData(data);
            },
            isForceChoosing,
        );
    }

    renderWeb(data: ForegroundWebDataType) {
        const { handleAdding, handleRemoving } = genHtmlForegroundWeb(
            data,
            this.styleAnimFor(data),
            {
                width: this.screenManagerBase.width,
                height: this.screenManagerBase.height,
            },
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        handleAdding(divContainer!);
    }
    setWebDataList(dataList: ForegroundWebDataType[], isNoSyncGroup = false) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                webDataList: dataList,
            },
            isNoSyncGroup,
        );
    }
    addWebData(data: ForegroundWebDataType, isNoSyncGroup = false) {
        if (checkIsItemInArray(data, this.foregroundData.webDataList)) {
            return;
        }
        const dataList = [...this.foregroundData.webDataList, data];
        this.setWebDataList(dataList, isNoSyncGroup);
    }
    removeWebData(data: ForegroundWebDataType, isNoSyncGroup = false) {
        const dataList = this.foregroundData.webDataList.filter((item) => {
            return !checkAreObjectsEqual(item, data);
        });
        this.setWebDataList(dataList, isNoSyncGroup);
    }
    static async addWebData(
        event: MouseEvent,
        data: ForegroundWebDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.addWebData(data);
            },
            isForceChoosing,
        );
    }
    static async removeWebData(
        event: MouseEvent,
        data: ForegroundWebDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.removeWebData(data);
            },
            isForceChoosing,
        );
    }

    renderVideo(data: ForegroundVideoDataType) {
        const { handleAdding, handleRemoving } = genHtmlForegroundVideo(
            data,
            this.styleAnimFor(data),
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        handleAdding(divContainer!);
    }
    setVideoDataList(
        dataList: ForegroundVideoDataType[],
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                videoDataList: dataList,
            },
            isNoSyncGroup,
        );
    }
    addVideoData(data: ForegroundVideoDataType, isNoSyncGroup = false) {
        if (checkIsItemInArray(data, this.foregroundData.videoDataList)) {
            return;
        }
        const dataList = [...this.foregroundData.videoDataList, data];
        this.setVideoDataList(dataList, isNoSyncGroup);
    }
    removeVideoData(data: ForegroundVideoDataType, isNoSyncGroup = false) {
        const dataList = this.foregroundData.videoDataList.filter((item) => {
            return !checkAreObjectsEqual(item, data);
        });
        this.setVideoDataList(dataList, isNoSyncGroup);
    }
    static async addVideoData(
        event: MouseEvent,
        data: ForegroundVideoDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.addVideoData(data);
            },
            isForceChoosing,
        );
    }
    static async removeVideoData(
        event: MouseEvent,
        data: ForegroundVideoDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.removeVideoData(data);
            },
            isForceChoosing,
        );
    }

    renderImage(data: ForegroundImageDataType) {
        const { handleAdding, handleRemoving } = genHtmlForegroundImage(
            data,
            this.styleAnimFor(data),
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        handleAdding(divContainer!);
    }
    setImageDataList(
        dataList: ForegroundImageDataType[],
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                imageDataList: dataList,
            },
            isNoSyncGroup,
        );
    }
    addImageData(data: ForegroundImageDataType, isNoSyncGroup = false) {
        if (checkIsItemInArray(data, this.foregroundData.imageDataList)) {
            return;
        }
        const dataList = [...this.foregroundData.imageDataList, data];
        this.setImageDataList(dataList, isNoSyncGroup);
    }
    removeImageData(data: ForegroundImageDataType, isNoSyncGroup = false) {
        const dataList = this.foregroundData.imageDataList.filter((item) => {
            return !checkAreObjectsEqual(item, data);
        });
        this.setImageDataList(dataList, isNoSyncGroup);
    }
    static async addImageData(
        event: MouseEvent,
        data: ForegroundImageDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.addImageData(data);
            },
            isForceChoosing,
        );
    }
    static async removeImageData(
        event: MouseEvent,
        data: ForegroundImageDataType,
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                screenForegroundManager.removeImageData(data);
            },
            isForceChoosing,
        );
    }

    receiveSyncScreen(message: ScreenMessageType) {
        const data: ForegroundDataType = message.data;
        for (const [key, setter] of this.setterMap.entries()) {
            setter(data[key as keyof ForegroundDataType] ?? null, true);
        }
        this.fireUpdateEvent();
    }

    render() {
        for (const [key, render] of this.rendererMap.entries()) {
            const data = this.foregroundData[key as keyof ForegroundDataType];
            if (data === null) {
                continue;
            }
            if (Array.isArray(data)) {
                for (const item of data) {
                    render(item);
                }
            } else {
                render(data);
            }
        }
    }

    applyForegroundDataWithSyncGroup(
        newForegroundData: ForegroundDataType,
        isNoSyncGroup = false,
    ) {
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        if (!isNoSyncGroup) {
            ScreenForegroundManager.enableSyncGroup(this.screenId);
        }
        for (const [key, oldData] of Object.entries(this.foregroundData)) {
            let newData = newForegroundData[key as keyof ForegroundDataType];
            const render = this.rendererMap.get(key) ?? null;
            if (render === null) {
                continue;
            }
            newData = this.compareAndRender(oldData, newData, render);
            Object.assign(this.foregroundData, {
                [key as keyof ForegroundDataType]: newData,
            });
        }
        this.saveForegroundData();
    }

    clear() {
        this.applyForegroundDataWithSyncGroup(
            ScreenForegroundManager.parseAllForegroundData({}),
            true,
        );
    }

    delete() {
        // Local teardown only — deliberately NOT clear(). clear() ends in
        // saveForegroundData, which both re-writes this screen's entry and
        // broadcasts to the color-note group, and it bails out entirely on a
        // locked screen — leaving the countdown's rAF loop, the camera's media
        // tracks and the web widgets alive for a screen that no longer exists.
        // Removing the containers directly runs each widget's own remove
        // handler, which is what actually stops them.
        for (const [key, data] of Object.entries(this.foregroundData)) {
            if (!this.rendererMap.has(key)) {
                continue;
            }
            if (Array.isArray(data)) {
                for (const item of data) {
                    this.removeDivContainer(item);
                }
            } else {
                this.removeDivContainer(data);
            }
        }
        this.foregroundData = ScreenForegroundManager.parseAllForegroundData(
            {},
        );
        this._div = null;
        super.delete();
    }

    get containerStyle(): CSSProperties {
        return {
            pointerEvents: 'none',
            // `absolute`, NOT the stylesheet's `fixed`, and with no `z-index`:
            // `position: fixed` makes a stacking context, which would cut every
            // blended widget off from the layers underneath it (see
            // `createDivContainer`). The px dimensions are the other reason --
            // the same markup is mounted in the CSS-scaled mini preview.
            position: 'absolute',
            width: `${this.screenManagerBase.width}px`,
            height: `${this.screenManagerBase.height}px`,
            overflow: 'hidden',
            // Pinned, not inherited: this same foreground markup is mounted in
            // two documents with different ambient CSS. The presenter loads
            // bootstrap (`body { line-height: 1.5 }`, unitless so it inherits
            // through the mini-screen's shadow root) while screen.html loads
            // only screen.scss, leaving `line-height: normal`. For fonts with
            // tall metrics that diverges badly — Battambang's `normal` is ~1.81,
            // so every widget's line box was ~20% taller on the real screen than
            // in the preview.
            // `normal` (the font's own metrics) is the side to standardise on:
            // 1.5 is too tight for Khmer, whose stacked subscripts overflow the
            // line box and get cut by the `overflow: hidden` above.
            lineHeight: 'normal',
        };
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenForegroundManager = this.getInstance(screenId);
        if (screenForegroundManager === null) {
            // English on purpose: this receiver also runs in the screen
            // window, and a `tran()` there before its language data has loaded
            // throws in dev (see `ScreenCloseButtonComp`).
            showSimpleToast(
                'Failed to apply to screen. Please make sure the screen is open.',
                'error',
            );
            return;
        }
        screenForegroundManager.receiveSyncScreen(message);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenForegroundManager>(screenId);
    }
}
