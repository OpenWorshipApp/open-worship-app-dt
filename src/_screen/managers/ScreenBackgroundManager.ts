import type { CSSProperties, MouseEvent } from 'react';

import type { DroppedDataType } from '../../helper/DragInf';
import { DragTypeEnum } from '../../helper/DragInf';
import { getImageDim, getVideoDim } from '../../helper/helpers';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { genHtmlBackground } from '../ScreenBackgroundComp';
import { getBackgroundSrcListOnScreenSetting } from '../screenHelpers';
import { handleError } from '../../helper/errorHelpers';
import {
    dirSourceSettingNames,
    screenManagerSettingNames,
} from '../../helper/constants';
import ScreenEventHandler from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import type ScreenEffectManager from './ScreenEffectManager';
import appProvider from '../../server/appProvider';
import { unlocking } from '../../server/unlockingHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import type {
    BackgroundDataType,
    BackgroundSrcType,
    BackgroundType,
    BasicScreenMessageType,
    ScreenMessageType,
    StyleAnimType,
} from '../screenTypeHelpers';
import { ANIM_END_DELAY_MILLISECOND } from '../transitionEffectHelpers';
import { getIsFadingAtTheEndSetting } from '../../background/videoBackgroundHelpers';
import { appLog } from '../../helper/loggerHelpers';

export type ScreenBackgroundManagerEventType = 'update';

const FADING_DURATION_SECOND = 3;
const FADING_DURATION_MILLISECOND = FADING_DURATION_SECOND * 1000;
export const BACKGROUND_VIDEO_FADING_SETTING_NAME =
    dirSourceSettingNames.BACKGROUND_VIDEO + '-fading-at-end';

export function getIsFadingAtEndSetting() {
    return getSetting(BACKGROUND_VIDEO_FADING_SETTING_NAME) !== 'false';
}

class ScreenBackgroundManager extends ScreenEventHandler<ScreenBackgroundManagerEventType> {
    static readonly eventNamePrefix: string = 'screen-bg-m';
    private _backgroundSrc: BackgroundSrcType | null = null;
    private _rootContainer: HTMLDivElement | null = null;
    effectManager: ScreenEffectManager;
    clearTracks = () => {};

    constructor(
        screenManagerBase: ScreenManagerBase,
        effectManager: ScreenEffectManager,
    ) {
        super(screenManagerBase);
        this.effectManager = effectManager;
        if (appProvider.isPagePresenter) {
            const allBackgroundSrcList = getBackgroundSrcListOnScreenSetting();
            this._backgroundSrc = allBackgroundSrcList[this.key] ?? null;
        }
        if (!appProvider.isPagePresenter) {
            this.sendSyncVideoTime = () => {};
        }
    }

    get isShowing() {
        return this.backgroundSrc !== null;
    }

    get rootContainer() {
        return this._rootContainer;
    }

    set rootContainer(rootContainer: HTMLDivElement | null) {
        this._rootContainer = rootContainer;
        this.render();
    }

    get backgroundSrc() {
        return this._backgroundSrc;
    }

    set backgroundSrc(backgroundSrc: BackgroundSrcType | null) {
        if (
            this.screenManagerBase.checkIsLockedWithMessage() ||
            checkAreObjectsEqual(this._backgroundSrc, backgroundSrc)
        ) {
            return;
        }
        this._backgroundSrc = backgroundSrc;
        this.render();
        unlocking(screenManagerSettingNames.BACKGROUND, () => {
            const allBackgroundSrcList = getBackgroundSrcListOnScreenSetting();
            if (backgroundSrc === null) {
                delete allBackgroundSrcList[this.key];
            } else {
                allBackgroundSrcList[this.key] = backgroundSrc;
            }
            const str = JSON.stringify(allBackgroundSrcList);
            setSetting(screenManagerSettingNames.BACKGROUND, str);
            this.fireUpdateEvent();
        });
        this.sendSyncScreen();
    }

    toSyncMessage(): BasicScreenMessageType {
        return {
            type: 'background',
            data: this.backgroundSrc,
        };
    }

    receiveSyncScreen(message: ScreenMessageType) {
        this.backgroundSrc = message.data;
    }

    sendSyncVideoTime(
        videoID: string,
        element: HTMLVideoElement | HTMLAudioElement,
        isFromAudio = false,
    ) {
        setTimeout(() => {
            this.screenManagerBase.sendScreenMessage(
                {
                    screenId: this.screenId,
                    type: 'background-video-time',
                    data: {
                        videoID,
                        videoTime: element.currentTime,
                        timestamp: Date.now(),
                        isFromAudio,
                    },
                },
                true,
            );
        }, 0);
    }

    setVideoCurrentTime(data: {
        videoID: string;
        videoTime: number;
        timestamp: number;
        isFromAudio: boolean;
    }) {
        const rootContainer = this.rootContainer;
        if (rootContainer === null) {
            return;
        }
        const { videoID, videoTime, timestamp, isFromAudio } = data;
        const videoElements = rootContainer.querySelectorAll<HTMLVideoElement>(
            `video#${videoID}`,
        );
        for (const videoElement of videoElements) {
            // Disable syncing when the video is in transition mode
            if (
                videoElement.currentTime < FADING_DURATION_SECOND ||
                videoElement.duration - videoElement.currentTime <
                    FADING_DURATION_SECOND
            ) {
                continue;
            }
            const latency = (Date.now() - timestamp) / 1000;
            const exactVideoTime = videoTime + latency;
            const timeDiff = videoElement.currentTime - exactVideoTime;
            // 24 fps, 1000/24 = 0.04166..., for 0.15 second threshold, it can be 3
            // frames, which is good enough for syncing video.
            if (Math.abs(timeDiff) > 0.15) {
                appLog(
                    'Syncing video time',
                    isFromAudio ? '(from audio)' : '',
                    timeDiff,
                    exactVideoTime,
                );
                videoElement.currentTime = exactVideoTime;
            }
        }
    }

    receiveSyncVideoTime(message: ScreenMessageType) {
        if (message.screenId !== this.screenId) {
            return;
        }
        const { data } = message;
        const { videoID, videoTime, timestamp } = data;
        if (
            !videoID ||
            typeof videoTime !== 'number' ||
            typeof timestamp !== 'number'
        ) {
            return;
        }
        this.setVideoCurrentTime(data);
    }

    static receiveSyncVideoTime(message: ScreenMessageType) {
        const { screenId } = message;
        const screenBackgroundManager = this.getInstance(screenId);
        if (screenBackgroundManager === null) {
            return;
        }
        screenBackgroundManager.receiveSyncVideoTime(message);
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenBackgroundManager.fireUpdateEvent();
    }

    static getBackgroundSrcListByType(backgroundType: BackgroundType) {
        const backgroundSrcList = getBackgroundSrcListOnScreenSetting();
        return Object.entries(backgroundSrcList).filter(
            ([_, backgroundSrc]) => {
                return backgroundSrc.type === backgroundType;
            },
        );
    }

    static getSelectBackgroundSrcList(
        src: string,
        backgroundType: BackgroundType,
    ) {
        const keyBackgroundSrcList =
            this.getBackgroundSrcListByType(backgroundType);
        return keyBackgroundSrcList.filter(([_, backgroundSrc]) => {
            return backgroundSrc.src === src;
        });
    }

    static async initBackgroundSrcDim(
        src: string,
        backgroundType: BackgroundType,
    ) {
        const backgroundSrc: BackgroundSrcType = {
            type: backgroundType,
            src,
        };
        const [width, height] = await this.extractDim(backgroundSrc);
        if (width !== undefined && height !== undefined) {
            backgroundSrc.width = width;
            backgroundSrc.height = height;
        }
        return backgroundSrc;
    }

    applyBackgroundSrcWithSyncGroup(backGroundSrc: BackgroundSrcType | null) {
        ScreenBackgroundManager.enableSyncGroup(this.screenId);
        this.backgroundSrc = backGroundSrc;
    }

    async applyBackgroundSrc(
        backgroundType: BackgroundType,
        data: BackgroundDataType,
    ) {
        if (data.src === null || this.backgroundSrc?.src === data.src) {
            this.applyBackgroundSrcWithSyncGroup(null);
        } else {
            const backgroundSrc =
                await ScreenBackgroundManager.initBackgroundSrcDim(
                    data.src,
                    backgroundType,
                );
            this.applyBackgroundSrcWithSyncGroup({
                ...backgroundSrc,
                scaleType: data.scaleType,
                extraStyle: data.extraStyle,
            });
        }
    }

    static async handleBackgroundSelecting(
        event: MouseEvent,
        backgroundType: BackgroundType,
        data: BackgroundDataType,
        isForceChoosing = false,
    ) {
        const screenIds = await this.chooseScreenIds(event, isForceChoosing);
        for (const screenId of screenIds) {
            const screenBackgroundManager = this.getInstance(screenId);
            screenBackgroundManager.applyBackgroundSrc(backgroundType, data);
        }
    }

    static async extractDim(
        backgroundSrc: BackgroundSrcType,
    ): Promise<[number | undefined, number | undefined]> {
        if (backgroundSrc.type === 'image') {
            try {
                return await getImageDim(backgroundSrc.src);
            } catch (error) {
                handleError(error);
            }
        } else if (backgroundSrc.type === 'video') {
            try {
                return await getVideoDim(backgroundSrc.src);
            } catch (error) {
                handleError(error);
            }
        }
        return [undefined, undefined];
    }

    removeOldElements(
        aminData: StyleAnimType,
        elements: HTMLElement[],
        clearTracks: () => void,
    ) {
        Promise.all(
            elements.map((element) => {
                return aminData.animOut(element);
            }),
        ).then(() => {
            for (const element of elements) {
                element.remove();
            }
            clearTracks();
        });
    }

    _checkIsVideoAudioPlaying(videoID: string) {
        const audioElements = document.querySelectorAll<HTMLAudioElement>(
            `audio[data-video-id="${videoID}"]`,
        );
        for (const audioElement of audioElements) {
            if (!audioElement.paused) {
                return true;
            }
        }
        return false;
    }

    _handleBackgroundVideo(container: HTMLDivElement) {
        const videoElement = container.querySelector('video[id^="video-"]');
        if (videoElement instanceof HTMLVideoElement === false) {
            return;
        }
        const fadeOutListener = async () => {
            if (!this._checkIsVideoAudioPlaying(videoElement.id)) {
                this.sendSyncVideoTime(videoElement.id, videoElement);
            }
            const duration = videoElement.duration;
            const isFadingAtTheEnd = getIsFadingAtTheEndSetting(
                videoElement.src,
            );
            if (
                !isFadingAtTheEnd ||
                !(
                    !(Number.isNaN(duration) || duration === Infinity) &&
                    duration - videoElement.currentTime <=
                        FADING_DURATION_SECOND
                )
            ) {
                return;
            }
            videoElement.removeEventListener('timeupdate', fadeOutListener);
            this.render({
                ...this.effectManager.styleAnimList.fade,
                animOut: async () => {
                    const duration =
                        FADING_DURATION_MILLISECOND +
                        ANIM_END_DELAY_MILLISECOND;
                    await new Promise<void>((resolve) => {
                        setTimeout(resolve, duration);
                    });
                },
                duration: FADING_DURATION_MILLISECOND,
            });
        };
        videoElement.addEventListener('timeupdate', fadeOutListener);
    }

    render(overrideAnimData?: StyleAnimType) {
        const rootContainer = this.rootContainer;
        if (rootContainer === null) {
            return;
        }
        const aminData = overrideAnimData ?? this.effectManager.styleAnim;
        if (this.backgroundSrc !== null) {
            const { newDiv, promise } = genHtmlBackground(
                this.screenId,
                this.backgroundSrc,
            );
            const childList = Array.from(rootContainer.children).filter(
                (element) => {
                    return element instanceof HTMLElement;
                },
            );
            promise.then((clearTracks) => {
                this._handleBackgroundVideo(newDiv);
                aminData.animIn(newDiv, rootContainer);
                this.removeOldElements(aminData, childList, this.clearTracks);
                this.clearTracks = clearTracks;
            });
        } else if (rootContainer.lastChild !== null) {
            const targetElement = rootContainer.lastChild as HTMLElement;
            this.removeOldElements(aminData, [targetElement], this.clearTracks);
        }
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

    async receiveScreenDropped({ type, item }: DroppedDataType) {
        const backgroundTypeMap: { [key: string]: BackgroundType } = {
            [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
            [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
            [DragTypeEnum.BACKGROUND_WEB]: 'web',
            [DragTypeEnum.BACKGROUND_CAMERA]: 'camera',
        };
        if (type in backgroundTypeMap) {
            const backgroundSrc =
                await ScreenBackgroundManager.initBackgroundSrcDim(
                    item.src,
                    backgroundTypeMap[type],
                );
            this.applyBackgroundSrcWithSyncGroup(backgroundSrc);
        } else if (type === DragTypeEnum.BACKGROUND_COLOR) {
            this.applyBackgroundSrcWithSyncGroup({
                type: 'color',
                src: item,
            });
        }
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenBackgroundManager = this.getInstance(screenId);
        screenBackgroundManager.receiveSyncScreen(message);
    }

    clear() {
        this.applyBackgroundSrcWithSyncGroup(null);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenBackgroundManager>(screenId);
    }
}

export default ScreenBackgroundManager;
