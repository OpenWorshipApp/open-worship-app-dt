import type { CSSProperties, MouseEvent } from 'react';

import type { DroppedDataType } from '../../helper/DragInf';
import { DragTypeEnum } from '../../helper/DragInf';
import { getImageDim, getVideoDim } from '../../helper/helpers';
import { tran } from '../../lang/langHelpers';
import { getSetting } from '../../helper/settingHelpers';
import { genHtmlBackground } from '../ScreenBackgroundComp';
import { getBackgroundSrcListOnScreenSetting } from '../screenHelpers';
import { checkIsSoundHere } from '../screenSoundHelpers';
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
import { stampBackgroundTransition } from '../../background/backgroundTransitionHelpers';
import {
    getStyleAnimForNode,
    TRANSITION_DATASET_KEY,
    type TransitionEffectType,
} from '../transitionEffectHelpers';
import {
    playMediaElement,
    releaseMediaElement,
} from '../../helper/mediaHelpers';
import { appLog } from '../../helper/loggerHelpers';

export type ScreenBackgroundManagerEventType = 'update' | 'color-set';

const FADING_DURATION_SECOND = 3;
// `HAVE_CURRENT_DATA`: the element has a frame to show. The
// end-of-clip crossfade waits for that much and no more -- anything
// longer eats the slack the fade itself needs.
const VIDEO_HAVE_CURRENT_DATA = 2;
const VIDEO_NETWORK_EMPTY = 0;
const VIDEO_LOOP_PICTURE_TIMEOUT_MILLISECOND = 1000;
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
    // A background video's sound on a virtual display's page: whether the
    // presenter's audio for it is playing, at what level, and which of the
    // loop's two copies is the one being heard.
    private videoSound: {
        videoId: string;
        isPlaying: boolean;
        volume: number;
    } | null = null;
    private soundingVideo: HTMLVideoElement | null = null;
    // Bumped by every `render`; only the latest one puts its background up.
    private renderGeneration = 0;
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

    /**
     * Let go of the mini preview's root when it unmounts -- its rendering was
     * turned off, or its panel closed. Dropping the reference alone would
     * leave what it holds RUNNING in a detached div: a looping clip still
     * decoding and firing `timeupdate`, a camera still open. So it is torn
     * down here; `backgroundSrc` stays, and the next root renders it again.
     *
     * The root's content goes whichever root it is -- it is leaving the
     * document either way. The reference and the camera go only if it is
     * still the root this manager holds: a card remounted for a colour-note
     * change attaches its new root before the old one's cleanup runs (see
     * `ScreenDrawManager.releaseDiv`), and that render has already stopped the
     * old camera. Never on the projected screen, whose layers are the window
     * itself.
     */
    releaseRootContainer(rootContainer: HTMLDivElement) {
        if (appProvider.isPageScreen) {
            return;
        }
        for (const videoElement of rootContainer.querySelectorAll('video')) {
            releaseMediaElement(videoElement);
        }
        rootContainer.replaceChildren();
        if (this._rootContainer !== rootContainer) {
            return;
        }
        this._rootContainer = null;
        this.clearTracks();
        this.clearTracks = () => {};
    }

    get backgroundSrc() {
        return this._backgroundSrc;
    }

    set backgroundSrc(targetBackgroundSrc: BackgroundSrcType | null) {
        // Every way a background goes up meets here -- a tile, Show on
        // Screens, a colour, a drop, a run sheet row, a slide's attached
        // background, a background slide show, a sync group -- so this is
        // where its own transition (else its tab's) is put on it, on the
        // presenter, BEFORE the equality check: stamped, it compares equal to
        // the same background already up. The screen window keeps the one it
        // was handed.
        const backgroundSrc =
            targetBackgroundSrc !== null && !appProvider.isPageScreen
                ? stampBackgroundTransition(targetBackgroundSrc)
                : targetBackgroundSrc;
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

    // The presenter's audio for a background video, as a screen on a virtual
    // display hears it: only that page ever unmutes its video.
    sendSyncVideoSound(videoId: string, isPlaying: boolean, volume: number) {
        this.screenManagerBase.sendScreenMessage(
            {
                screenId: this.screenId,
                type: 'background-video-sound',
                data: { videoId, isPlaying, volume },
            },
            true,
        );
    }

    applyVideoSound(soundingVideo?: HTMLVideoElement) {
        const rootContainer = this.rootContainer;
        if (!appProvider.isPageScreen || rootContainer === null) {
            return;
        }
        if (soundingVideo !== undefined) {
            this.soundingVideo = soundingVideo;
        }
        const sound = this.videoSound;
        const isSoundHere = checkIsSoundHere(this.screenManagerBase);
        const videos = [
            ...rootContainer.querySelectorAll<HTMLVideoElement>(
                'video[id^="video-"]',
            ),
        ];
        const sounding =
            this.soundingVideo?.isConnected &&
            videos.includes(this.soundingVideo)
                ? this.soundingVideo
                : (videos.find((video) => !video.paused) ?? null);
        for (const video of videos) {
            const isOn =
                isSoundHere &&
                sound !== null &&
                sound.isPlaying &&
                sound.videoId === video.id &&
                video === sounding;
            video.muted = !isOn;
            if (sound !== null && sound.videoId === video.id) {
                video.volume = sound.volume;
            }
        }
    }

    receiveSyncVideoSound(message: ScreenMessageType) {
        const { videoId, isPlaying, volume } = message.data ?? {};
        if (
            typeof videoId !== 'string' ||
            typeof isPlaying !== 'boolean' ||
            typeof volume !== 'number' ||
            !(volume >= 0 && volume <= 1)
        ) {
            return;
        }
        this.videoSound = { videoId, isPlaying, volume };
        this.applyVideoSound();
    }

    static receiveSyncVideoSound(message: ScreenMessageType) {
        this.getInstance(message.screenId)?.receiveSyncVideoSound(message);
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
                // The parked half of an end-of-clip crossfade is already
                // invisible, and `animOut` puts `opacity: 1` on before it
                // starts -- fading it out would bring a frozen first frame
                // INTO view on its way to being hidden.
                if (element.style.opacity === '0') {
                    return Promise.resolve();
                }
                // It leaves the way it came in (see `TRANSITION_DATASET_KEY`);
                // `aminData` only for a node nothing tagged.
                return getStyleAnimForNode(
                    element,
                    this.effectManager.styleAnimList,
                    aminData,
                ).animOut(element);
            }),
        ).then(() => {
            for (const element of elements) {
                // Taking a media element out of the document does not hand its
                // player back -- only the load algorithm does, and Chromium
                // refuses to make any more once a frame holds a thousand. A
                // fading video background holds TWO of them.
                const videoElements =
                    element.querySelectorAll<HTMLVideoElement>(
                        'video[id^="video-"]',
                    );
                for (const videoElement of videoElements) {
                    releaseMediaElement(videoElement);
                }
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
        if (getIsFadingAtTheEndSetting(videoElement.src)) {
            // Built NOW, while the clip still has its whole length to get a
            // first frame ready. The crossfade below has to have a picture to
            // bring in; a copy made at the moment the fade starts is black.
            this._ensureVideoLoopTwin(container, videoElement);
        }
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
     * The other half of the end-of-clip crossfade: a second copy of the
     * background, hidden and paused at its first frame, that the laps hand
     * over between.
     *
     * Built ONCE per background and then swapped lap after lap, which is what
     * makes the crossfade affordable. `render()` used to build a fresh
     * `<video src=...>` for every lap, and Chromium does not cache a `file://`
     * media resource: 37 full `range: bytes=0-` fetches of one 2.6 MB
     * background in a few minutes, about 470 MB an hour for ONE clip on ONE
     * screen, and a church looping a 100 MB HD background re-read it every
     * lap for the whole service. Two elements taking turns cost two reads for
     * the life of the background instead of one per lap.
     */
    _ensureVideoLoopTwin(
        container: HTMLElement,
        videoElement: HTMLVideoElement,
    ) {
        const rootContainer = this.rootContainer;
        if (rootContainer === null) {
            return null;
        }
        // The node `animIn` put in the root: `container` itself, or the
        // `.zoom-container` a zoom transition wrapped it in. Comparing with
        // `container` alone adopted that wrapper -- the clip still playing --
        // as its own twin, and the second lap faded in a node whose picture
        // had been parked at opacity 0: a blank background.
        const ownNode = this._toRootLevelNode(container);
        for (const child of rootContainer.children) {
            if (
                child === ownNode ||
                !(child instanceof HTMLElement) ||
                // Already claimed by a background swap in flight.
                child.dataset.owaBackgroundRemoving === 'true'
            ) {
                continue;
            }
            const childVideo = child.querySelector<HTMLVideoElement>(
                'video[id^="video-"]',
            );
            if (childVideo !== null && childVideo.src === videoElement.src) {
                return { twin: child, twinVideo: childVideo };
            }
        }
        const twin = container.cloneNode(true) as HTMLElement;
        const twinVideo = twin.querySelector<HTMLVideoElement>(
            'video[id^="video-"]',
        );
        if (twinVideo === null) {
            return null;
        }
        // It waits its turn: `autoplay` would start it a whole lap early.
        twinVideo.autoplay = false;
        twinVideo.muted = true;
        twinVideo.preload = 'auto';
        twinVideo.dataset.ignoreMediaGuarding = 'true';
        twin.style.opacity = '0';
        // Underneath whatever is showing -- `animIn` appends, so the copy
        // coming in is always the last child.
        rootContainer.insertBefore(twin, rootContainer.firstChild);
        twinVideo.pause();
        return { twin, twinVideo };
    }

    _waitForVideoPicture(videoElement: HTMLVideoElement) {
        if (
            videoElement.readyState >= VIDEO_HAVE_CURRENT_DATA ||
            // Nothing is being loaded, so there is nothing to wait for.
            videoElement.networkState === VIDEO_NETWORK_EMPTY
        ) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            const finish = () => {
                clearTimeout(timeoutId);
                videoElement.removeEventListener('loadeddata', finish);
                resolve();
            };
            const timeoutId = setTimeout(
                finish,
                VIDEO_LOOP_PICTURE_TIMEOUT_MILLISECOND,
            );
            videoElement.addEventListener('loadeddata', finish);
        });
    }

    /**
     * The end-of-clip crossfade: the second copy starts from frame 0 and
     * fades IN over the clip that is still playing its last seconds, so the
     * wrap is covered and the audience never sees the screen go blank.
     *
     * The copy coming in is the ONLY one that moves. Stacked, what the
     * audience sees is `new * a + old * (1 - a)`, which holds still only
     * while `old` stays opaque: fading both at once dips through black in the
     * middle, and fading one element out and then back in -- what this did
     * once the re-render was taken out of it -- goes all the way to black and
     * back, which is the blank at the end of every clip.
     */
    async _fadeOverVideoLoop(
        container: HTMLElement,
        videoElement: HTMLVideoElement,
    ) {
        const rootContainer = this.rootContainer;
        if (rootContainer === null || !container.isConnected) {
            return;
        }
        const twinData = this._ensureVideoLoopTwin(container, videoElement);
        if (twinData === null) {
            return;
        }
        const { twin, twinVideo } = twinData;
        // Parked and brought back as the node in the ROOT -- the zoom wrapper
        // when the background zoomed in -- so the picture inside it is never
        // the thing left at opacity 0.
        const outgoingNode = this._toRootLevelNode(container);
        // What the element asked for before the fade borrowed its opacity: a
        // foreground Opacity slider writes it straight onto `style.opacity`
        // through `extraStyle`. A node parked by an earlier lap remembers its
        // own (a zoom wrapper rests at none at all).
        const restOpacity =
            twin.dataset.owaRestOpacity ?? (container.style.opacity || '1');
        twinVideo.currentTime = 0;
        await this._waitForVideoPicture(twinVideo);
        if (!container.isConnected || !twin.isConnected) {
            return;
        }
        await playMediaElement(twinVideo);
        // The copy coming in is the one heard from now on.
        this.applyVideoSound(twinVideo);
        twin.style.opacity = restOpacity;
        await this.effectManager.styleAnimList.fade.animIn(twin, rootContainer);
        if (!twin.isConnected) {
            return;
        }
        // The lap is a crossfade whatever the background came in with, but
        // the background still LEAVES the way it came in: the twin takes the
        // outgoing node's tag -- unless that was a zoom and the twin is a
        // plain copy with no wrapper to zoom.
        const enteredWith = outgoingNode.dataset[TRANSITION_DATASET_KEY];
        if (
            enteredWith !== undefined &&
            (enteredWith !== 'zoom' ||
                twin.classList.contains('zoom-container'))
        ) {
            twin.dataset[TRANSITION_DATASET_KEY] = enteredWith;
        }
        // The clip that just ended is covered now, so park it as the copy the
        // NEXT lap brings in -- paused, back at its first frame, and reading
        // nothing until then.
        videoElement.pause();
        videoElement.currentTime = 0;
        outgoingNode.dataset.owaRestOpacity = outgoingNode.style.opacity;
        outgoingNode.style.opacity = '0';
        this._handleBackgroundVideo(twin as HTMLDivElement);
    }

    /**
     * `node`, or the ancestor of it that is a direct child of the root -- the
     * thing a transition appended and the thing that is swapped out.
     */
    _toRootLevelNode(node: HTMLElement): HTMLElement {
        const rootContainer = this.rootContainer;
        let current = node;
        while (
            current.parentElement !== null &&
            current.parentElement !== rootContainer
        ) {
            current = current.parentElement;
        }
        return current.parentElement === rootContainer ? current : node;
    }

    /**
     * The background's own transition when it carries one (it or its tab
     * overrides the screen), else the screen's `Background:` effect.
     */
    genStyleAnimFor(transitionEffect?: TransitionEffectType) {
        return (
            (transitionEffect === undefined
                ? undefined
                : this.effectManager.styleAnimList[transitionEffect]) ??
            this.effectManager.styleAnim
        );
    }

    /**
     * Only the latest render puts its background up. What is in the root is
     * read NOW but the new copy goes in a microtask later (a camera much
     * later), so two renders in one tick -- the root attached and the
     * background set together, as a screen page does on load -- each saw an
     * empty root and BOTH copies went in, playing on top of each other. At
     * the end of a lap each took the other for its crossfade twin and parked
     * it, until every copy sat at opacity 0: the wallpaper showed through
     * most of every lap on the projected screen, a browser watching a virtual
     * display and its MP4. A render overtaken is dropped, so a background
     * cleared in the meantime does not come back either.
     */
    render(overrideAnimData?: StyleAnimType) {
        const generation = ++this.renderGeneration;
        const rootContainer = this.rootContainer;
        if (rootContainer === null) {
            return;
        }
        const aminData =
            overrideAnimData ??
            this.genStyleAnimFor(this.backgroundSrc?.transitionEffect);
        const childList = Array.from(rootContainer.children).filter(
            (element) => {
                return element instanceof HTMLElement;
            },
        );
        for (const element of childList) {
            // Claimed by this swap. A background showing a fading video holds
            // TWO elements, so both go -- and neither may be adopted as the
            // incoming background's second copy while it is on its way out.
            element.dataset.owaBackgroundRemoving = 'true';
        }
        if (this.backgroundSrc !== null) {
            const { newDiv, promise } = genHtmlBackground(
                this.screenId,
                this.backgroundSrc,
            );
            promise.then((clearTracks) => {
                if (
                    this.rootContainer !== rootContainer ||
                    generation !== this.renderGeneration
                ) {
                    // Let go of (or replaced) while it was getting ready --
                    // a camera opening, or another render in the same tick:
                    // whatever holds the background now has rendered it.
                    for (const videoElement of newDiv.querySelectorAll(
                        'video',
                    )) {
                        releaseMediaElement(videoElement);
                    }
                    clearTracks();
                    return;
                }
                this._handleBackgroundVideo(newDiv);
                aminData.animIn(newDiv, rootContainer);
                this.removeOldElements(aminData, childList, this.clearTracks);
                this.clearTracks = clearTracks;
            });
        } else if (childList.length > 0) {
            this.removeOldElements(aminData, childList, this.clearTracks);
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
