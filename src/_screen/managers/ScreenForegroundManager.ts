import { CSSProperties, MouseEvent } from 'react';

import { setSetting } from '../../helper/settingHelpers';
import {
    genHtmlForegroundCountdown,
    genHtmlForegroundMarquee,
    genHtmlForegroundQuickText,
    genHtmlForegroundStopwatch,
    genHtmlForegroundTime,
    getCameraAndShowMedia,
} from '../screenForegroundHelpers';
import { getForegroundDataListOnScreenSetting } from '../screenHelpers';
import { screenManagerSettingNames } from '../../helper/constants';
import ScreenEventHandler from './ScreenEventHandler';
import ScreenManagerBase from './ScreenManagerBase';
import { unlocking } from '../../server/unlockingHelpers';
import {
    ForegroundDataType,
    BasicScreenMessageType,
    ScreenMessageType,
    ForegroundMarqueDataType,
    ForegroundCameraDataType,
    ForegroundCountdownDataType,
    ForegroundTimeDataType,
    ForegroundQuickTextDataType,
    ForegroundStopwatchDataType,
} from '../screenTypeHelpers';
import {
    checkAreObjectsEqual,
    checkIsItemInArray,
} from '../../server/comparisonHelpers';
import { OptionalPromise } from '../../helper/typeHelpers';
import ScreenEffectManager from './ScreenEffectManager';

export type ScreenForegroundEventType = 'update';

const containerMapper = new WeakMap<
    object,
    {
        container: HTMLElement;
        removeHandler: () => OptionalPromise<void>;
    }
>();
export default class ScreenForegroundManager extends ScreenEventHandler<ScreenForegroundEventType> {
    static readonly eventNamePrefix: string = 'screen-foreground-m';
    private _div: HTMLDivElement | null = null;
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
            ['countdownData', this.renderCountdown.bind(this)],
            ['stopwatchData', this.renderStopwatch.bind(this)],
            ['timeDataList', this.renderTime.bind(this)],
            ['marqueeData', this.renderMarquee.bind(this)],
            ['quickTextData', this.renderQuickText.bind(this)],
            ['cameraDataList', this.renderCamera.bind(this)],
        ]);
        this.setterMap = new Map<
            string,
            (data: any, isNoSyncGroup?: boolean) => void
        >([
            ['countdownData', this.setCountdownData.bind(this)],
            ['stopwatchData', this.setStopwatchData.bind(this)],
            ['timeDataList', this.setTimeDataList.bind(this)],
            ['marqueeData', this.setMarqueeData.bind(this)],
            ['quickTextData', this.setQuickTextData.bind(this)],
            ['cameraDataList', this.setCameraDataList.bind(this)],
        ]);
    }

    get styleAnimFade() {
        return this.effectManager.styleAnimList.fade;
    }

    static parseAllForegroundData(foregroundData: any) {
        const countdownData = foregroundData['countdownData'] ?? null;
        if (countdownData !== null) {
            countdownData.dateTime = new Date(countdownData.dateTime);
        }
        const stopwatchData = foregroundData['stopwatchData'] ?? null;
        if (stopwatchData !== null) {
            stopwatchData.dateTime = new Date(stopwatchData.dateTime);
        }
        const newForegroundData = {
            countdownData,
            stopwatchData,
            timeDataList: foregroundData['timeDataList'] ?? [],
            marqueeData: foregroundData['marqueeData'] ?? null,
            quickTextData: foregroundData['quickTextData'] ?? null,
            cameraDataList: foregroundData['cameraDataList'] ?? [],
        } as ForegroundDataType;
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
        if (data === null || !containerMapper.has(data)) {
            return;
        }
        const { removeHandler } = containerMapper.get(data)!;
        containerMapper.delete(data);
        removeHandler();
    }

    createDivContainer(
        data: any,
        removingHandler?: (container: HTMLElement) => Promise<void> | void,
    ): HTMLElement | null {
        const container = document.createElement('div');
        this.removeDivContainer(data);
        containerMapper.set(data, {
            container,
            removeHandler: async () => {
                await removingHandler?.(container);
                container.parentNode?.removeChild(container);
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
        unlocking(screenManagerSettingNames.FOREGROUND, () => {
            const allForegroundDataList =
                getForegroundDataListOnScreenSetting();
            allForegroundDataList[this.key] = this.foregroundData;
            const string = JSON.stringify(allForegroundDataList);
            setSetting(screenManagerSettingNames.FOREGROUND, string);
            this.fireUpdateEvent();
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
            callbackSave(this.getInstance(screenId));
        }
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
    static async setCountdown(
        event: MouseEvent,
        dateTime: Date | null,
        extraStyle: CSSProperties = {},
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const data =
                    dateTime !== null ? { dateTime, extraStyle } : null;
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
    static async setStopwatch(
        event: MouseEvent,
        dateTime: Date | null,
        extraStyle: CSSProperties = {},
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const stopwatchData =
                    dateTime !== null ? { dateTime, extraStyle } : null;
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
        if (checkIsItemInArray(data, this.foregroundData.timeDataList)) {
            return;
        }
        const dataList = [...this.foregroundData.timeDataList, data];
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

    renderMarquee(data: ForegroundMarqueDataType) {
        const { element, handleRemoving } = genHtmlForegroundMarquee(
            data,
            this.screenManagerBase,
        );
        const divContainer = this.createDivContainer(data, handleRemoving);
        divContainer!.appendChild(element);
    }
    setMarqueeData(
        data: ForegroundMarqueDataType | null,
        isNoSyncGroup = false,
    ) {
        this.applyForegroundDataWithSyncGroup(
            {
                ...this.foregroundData,
                marqueeData: data,
            },
            isNoSyncGroup,
        );
    }
    static async setMarquee(
        event: MouseEvent,
        text: string | null,
        extraStyle: CSSProperties = {},
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const marqueeData = text !== null ? { text, extraStyle } : null;
                screenForegroundManager.setMarqueeData(marqueeData);
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
    static async setQuickText(
        event: MouseEvent,
        htmlText: string | null,
        timeSecondDelay: number,
        timeSecondToLive: number,
        extraStyle: CSSProperties = {},
        isForceChoosing = false,
    ) {
        this.setData(
            event,
            (screenForegroundManager) => {
                const quickTextData =
                    htmlText !== null
                        ? {
                              htmlText,
                              timeSecondDelay,
                              timeSecondToLive,
                              extraStyle,
                          }
                        : null;
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
        getCameraAndShowMedia(
            {
                parentContainer: divContainer!,
                ...data,
            },
            this.styleAnimFade,
        ).then((clearTracks) => {
            store.clearCameraTracks = clearTracks ?? (() => {});
        });
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

    get containerStyle(): CSSProperties {
        return {
            pointerEvents: 'none',
            position: 'absolute',
            width: `${this.screenManagerBase.width}px`,
            height: `${this.screenManagerBase.height}px`,
            overflow: 'hidden',
        };
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenForegroundManager = this.getInstance(screenId);
        screenForegroundManager.receiveSyncScreen(message);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenForegroundManager>(screenId);
    }
}
