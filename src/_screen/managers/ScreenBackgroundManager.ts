import type { CSSProperties, MouseEvent } from 'react';

import type { DroppedDataType } from '../../helper/DragInf';
import { DragTypeEnum } from '../../helper/DragInf';
import { getImageDim, getVideoDim } from '../../helper/helpers';
import { tran } from '../../lang/langHelpers';
import { getSetting } from '../../helper/settingHelpers';
import { genHtmlBackground } from '../ScreenBackgroundComp';
import { getBackgroundSrcListOnScreenSetting } from '../screenHelpers';
import { handleError } from '../../helper/errorHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    dirSourceSettingNames,
    screenManagerSettingNames,
} from '../../helper/constants';
import ScreenEventHandler, {
    type GroupMembershipInf,
} from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import type ScreenEffectManager from './ScreenEffectManager';
import appProvider from '../../server/appProvider';
import {
    collectLiveOnScreenMap,
    persistOnScreenEntry,
} from './onScreenSettingPersistHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import type {
    BackgroundDataType,
    BackgroundSrcType,
    BackgroundType,
    BasicScreenMessageType,
    ScreenMessageType,
    StyleAnimType,
} from '../screenTypeHelpers';
import { getIsFadingAtTheEndSetting } from '../../background/videoBackgroundHelpers';
import { appLog } from '../../helper/loggerHelpers';

export type ScreenBackgroundManagerEventType = 'update' | 'color-set';

const FADING_DURATION_SECOND = 3;
export const BACKGROUND_VIDEO_FADING_SETTING_NAME =
    dirSourceSettingNames.BACKGROUND_VIDEO + '-fading-at-end';

export function getIsFadingAtEndSetting() {
    return getSetting(BACKGROUND_VIDEO_FADING_SETTING_NAME) !== 'false';
}

class ScreenBackgroundManager
    extends ScreenEventHandler<ScreenBackgroundManagerEventType>
    implements GroupMembershipInf
{
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
        if (backgroundSrc?.type === 'color') {
            this.addPropEvent('color-set', backgroundSrc.src);
        }
        this.render();
        persistOnScreenEntry({
            lockKey: screenManagerSettingNames.BACKGROUND,
            settingName: screenManagerSettingNames.BACKGROUND,
            key: this.key,
            value: backgroundSrc,
            readMap: getBackgroundSrcListOnScreenSetting,
            collectLive: () => {
                return collectLiveOnScreenMap(
                    ScreenBackgroundManager.getAllInstancesBase<ScreenBackgroundManager>(),
                    (instance) => {
                        return instance.backgroundSrc;
                    },
                );
            },
            onDone: () => {
                this.fireUpdateEvent();
            },
        });
        this.sendSyncScreen();
    }

    async getMemberInstances(): Promise<ScreenBackgroundManager[]> {
        return [];
    }
    async getMemberIds(): Promise<number[]> {
        return [];
    }
    async checkIsMainInstance(): Promise<boolean> {
        return false;
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
        videoId: string,
        videoTime: number,
        isFromScreen: boolean,
    ) {
        setTimeout(() => {
            this.screenManagerBase.sendScreenMessage(
                {
                    screenId: this.screenId,
                    type: 'background-video-time',
                    data: {
                        videoId,
                        videoTime,
                        timestamp: Date.now(),
                        isFromScreen,
                    },
                },
                true,
            );
        }, 0);
    }

    setVideoCurrentTime(data: {
        videoId: string;
        videoTime: number;
        timestamp: number;
        isFromScreen: boolean;
    }) {
        // If audio is playing for the video, it means the video time is
        // controlled by the audio.
        if (data.isFromScreen && this._checkIsVideoAudioPlaying(data.videoId)) {
            return;
        }
        const rootContainer = this.rootContainer;
        if (rootContainer === null) {
            return;
        }
        const { videoId, videoTime, timestamp, isFromScreen } = data;
        const videoElements = rootContainer.querySelectorAll<HTMLVideoElement>(
            `video#${videoId}`,
        );
        const timeThreshold = FADING_DURATION_SECOND + 0.1;
        for (const videoElement of videoElements) {
            // Disable syncing when the video is in transition mode
            if (
                videoElement.currentTime < timeThreshold ||
                videoElement.duration - videoElement.currentTime < timeThreshold
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
                    isFromScreen ? '(from screen)' : '',
                    `Screen ID: ${this.screenId}`,
                    timeDiff.toFixed(4),
                    exactVideoTime.toFixed(4),
                );
                videoElement.currentTime = exactVideoTime;
            }
        }
    }

    setVideoCurrentTimeForce(videoId: string, videoTime: number) {
        // Should be from presenter to screen
        this.sendSyncVideoTime(videoId, videoTime, false);
        this.setVideoCurrentTime({
            videoId,
            videoTime,
            timestamp: Date.now(),
            isFromScreen: false,
        });
    }

    async setBackgroundVideoCurrentTimeForce(
        videoId: string,
        videoTime: number,
        isSyncingGroup: boolean,
    ) {
        if (isSyncingGroup && !(await this.checkIsMainInstance())) {
            // An instance with smaller screenId is the main instance to sync
            // to, to avoid loop syncing
            return;
        }
        const groupScreenManagers = await this.getMemberInstances();
        if (!isSyncingGroup) {
            groupScreenManagers.push(this);
        }
        for (const screenBackgroundManager of groupScreenManagers) {
            screenBackgroundManager.setVideoCurrentTimeForce(
                videoId,
                videoTime,
            );
        }
    }

    receiveSyncVideoTime(message: ScreenMessageType) {
        if (message.screenId !== this.screenId) {
            return;
        }
        const { data } = message;
        const { videoId, videoTime, timestamp, isFromScreen } = data;
        if (
            !videoId ||
            typeof videoTime !== 'number' ||
            typeof timestamp !== 'number' ||
            typeof isFromScreen !== 'boolean'
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
            if (screenBackgroundManager === null) {
                showSimpleToast(
                    tran(
                        'Failed to apply to screen. Please make sure the screen is open.',
                    ),
                    tran('Error'),
                );
                continue;
            }
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

    _checkIsVideoAudioPlaying(videoId: string) {
        const audioElements = document.querySelectorAll<HTMLAudioElement>(
            `audio[data-video-id="${videoId}"]`,
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
        videoElement.dataset.ignoreMediaGuarding = 'true';
        const fadeOutListener = async () => {
            const videoId = videoElement.id;
            const currentTime = videoElement.currentTime;
            // Should sync from screen to main to audience glitching on user's side.
            if (appProvider.isPageScreen) {
                this.sendSyncVideoTime(videoId, currentTime, true);
            } else {
                // TODO: should follow screen's instance
                this.setBackgroundVideoCurrentTimeForce(
                    videoId,
                    currentTime,
                    true,
                );
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
            await this._fadeOverVideoLoop(container, videoElement);
        };
        videoElement.addEventListener('timeupdate', fadeOutListener);
    }

    /**
     * The end-of-clip fade, done on the element that is already playing.
     *
     * This used to call `render()`, which builds a whole new background from
     * `genHtmlBackground` -- a fresh `<video src=...>`. Chromium does not cache
     * a `file://` media resource, so every loop re-read the clip from byte 0:
     * measured on a live screen, 37 full `range: bytes=0-` fetches of one
     * 2.6 MB background in a few minutes, about 470 MB an hour for ONE clip on
     * ONE screen. A church looping a 100 MB HD background re-read 100 MB every
     * loop, for the whole service, on the low-spec machines this app is for.
     *
     * None of that bought anything: the element already carries `loop`, so it
     * restarts itself. The re-render existed only to dip the opacity across
     * the wrap. So dip the opacity across the wrap, and read nothing.
     */
    async _fadeOverVideoLoop(
        container: HTMLElement,
        videoElement: HTMLVideoElement,
    ) {
        const rootContainer = this.rootContainer;
        if (rootContainer === null || !container.isConnected) {
            return;
        }
        const fadeAnim = this.effectManager.styleAnimList.fade;
        // `animIn` treats whatever sits on `style.opacity` as the value the
        // element ASKED for and restores it at the end -- and `animOut` leaves
        // a `0` there. Carry the authored value across by hand, or the
        // background fades back in to fully transparent and stays there.
        const authoredOpacity = container.style.opacity || '1';
        await fadeAnim.animOut(container);
        // The clip's own `loop` has wrapped it back to the start by now.
        if (!container.isConnected) {
            return;
        }
        container.style.opacity = authoredOpacity;
        await fadeAnim.animIn(container, rootContainer);
        // Re-arm for the next lap, unless the background was swapped while
        // the fade was in flight -- that swap built its own element and armed
        // its own listener.
        if (container.isConnected && videoElement.isConnected) {
            this._handleBackgroundVideo(container as HTMLDivElement);
        }
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
        if (screenBackgroundManager === null) {
            // English on purpose: this receiver also runs in the screen
            // window, and a `tran()` there before its language data has loaded
            // throws in dev (see `ScreenCloseButtonComp`).
            showSimpleToast(
                'Failed to apply to screen. Please make sure the screen is open.',
                'error',
            );
            return;
        }
        screenBackgroundManager.receiveSyncScreen(message);
    }

    clear() {
        this.applyBackgroundSrcWithSyncGroup(null);
    }

    delete() {
        // Local teardown only — deliberately NOT clear(). clear() routes through
        // the backgroundSrc setter, which broadcasts to every screen sharing
        // this one's color note (so deleting one screen blanked the whole
        // group's background) and which a locked screen rejects outright,
        // leaving its camera tracks running and its entry on disk. The persisted
        // entry is dropped centrally by deleteScreenPersistedData.
        this.clearTracks();
        this.clearTracks = () => {};
        if (this._rootContainer !== null) {
            this._rootContainer.replaceChildren();
            this._rootContainer = null;
        }
        this._backgroundSrc = null;
        super.delete();
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenBackgroundManager>(screenId);
    }
}

export default ScreenBackgroundManager;
