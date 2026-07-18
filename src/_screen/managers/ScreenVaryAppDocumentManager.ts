import type { MouseEvent, CSSProperties } from 'react';

import type { DroppedDataType } from '../../helper/DragInf';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import type { SlideType } from '../../app-document-list/Slide';
import type { CanvasItemBiblePropsType } from '../../slide-editor/canvas/CanvasItemBibleItem';
import { genPdfSlide } from '../../app-document-presenter/items/PdfSlideRenderComp';
import { genPptxSlide } from '../../app-document-presenter/items/PptxSlideRenderComp';
import { genDocxSlide } from '../../app-document-presenter/items/DocxSlideRenderComp';
import { genSlideHtml } from '../../app-document-presenter/items/SlideRendererComp';
import {
    screenManagerSettingNames,
    PREVIEW_ONLY_ATTR,
} from '../../helper/constants';
import { playMediaElement } from '../../helper/mediaHelpers';
import {
    checkMediaPlaying,
    handleMediaPlaying,
    handleMediaStopped,
} from '../../helper/mediaControlHelpers';
import { genVideoIDFromSrc } from '../screenHelpers';
import {
    checkIsYouTubeSyncIframe,
    genYouTubeSyncId,
    SlideYouTubePlayer,
} from './slideYouTubeSyncHelpers';
import ScreenEventHandler, {
    type GroupMembershipInf,
} from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import type ScreenEffectManager from './ScreenEffectManager';
import { getAppDocumentListOnScreenSetting } from '../preview/screenPreviewerHelpers';
import {
    BLANK_HTML_SLIDE_SRC,
    BLANK_IMAGE_SLIDE_SRC,
} from '../../app-document-list/appDocumentHelpers';
import type { PdfSlideType } from '../../app-document-list/PdfSlide';
import PdfSlide from '../../app-document-list/PdfSlide';
import type { PptxSlideType } from '../../app-document-list/PptxSlide';
import PptxSlide from '../../app-document-list/PptxSlide';
import type { DocxSlideType } from '../../app-document-list/DocxSlide';
import DocxSlide from '../../app-document-list/DocxSlide';
import appProvider from '../../server/appProvider';
import { applyAttachBackground } from './screenBackgroundHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import type {
    VarySlideDataType,
    VarySlideType,
} from '../../app-document-list/appDocumentTypeHelpers';
import type {
    BasicScreenMessageType,
    ScreenMessageType,
} from '../screenTypeHelpers';
import type { VarySlideScreenDataType } from '../screenAppDocumentTypeHelpers';
import { PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME } from '../screenAppDocumentTypeHelpers';
import { registerScrollingSyncEvent } from './screenEventHelpers';
import PptxAppDocument from '../../app-document-list/PptxAppDocument';
import DocxAppDocument from '../../app-document-list/DocxAppDocument';
import { showSimpleToast } from '../../toast/toastHelpers';
import { getBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';
import { cloneJson } from '../../helper/helpers';

function queryAllDeep(root: ParentNode, selector: string): Element[] {
    const results = Array.from(root.querySelectorAll(selector));
    for (const element of Array.from(root.querySelectorAll('*'))) {
        if (element instanceof HTMLElement && element.shadowRoot !== null) {
            results.push(...queryAllDeep(element.shadowRoot, selector));
        }
    }
    return results;
}

// The sync id must be identical in every window for the same media file. Both
// the presenter and the screen rebase the slide HTML against the same file
// path, so the resolved `src` (or the first `<source>`) matches everywhere.
function getMediaSyncSrc(media: HTMLMediaElement): string {
    if (media.src) {
        return media.src;
    }
    const sourceSrc = media
        .querySelector<HTMLSourceElement>('source[src]')
        ?.getAttribute('src');
    return sourceSrc ?? media.currentSrc;
}

export type ScreenVaryAppDocumentManagerEventType = 'update';

const PDF_FULL_WIDTH_SETTING_NAME = 'pdf-full-width';

export function checkIsPdfFullWidth() {
    const originalSettingName = getSetting(PDF_FULL_WIDTH_SETTING_NAME);
    return originalSettingName === 'true';
}
export function setIsPdfFullWidth(isRenderFullWidth: boolean) {
    setSetting(PDF_FULL_WIDTH_SETTING_NAME, `${isRenderFullWidth}`);
}

export function getPageBaseVirtualBackgroundColor(): string | null {
    return getSetting(PAGE_BASE_VIRTUAL_BG_COLOR_SETTING_NAME) || null;
}

type SlideVideoTimeDataType = {
    videoId: string;
    videoTime: number;
    timestamp: number;
    isPlaying: boolean;
};

// Seeking a YouTube embed re-buffers, so followers only correct their time when
// they drift past this (a much looser bound than the 0.15s used for a native
// `<video>`, whose `.currentTime` seek is instant).
const YOUTUBE_SYNC_SEEK_THRESHOLD_SECONDS = 0.75;

class ScreenVaryAppDocumentManager
    extends ScreenEventHandler<ScreenVaryAppDocumentManagerEventType>
    implements GroupMembershipInf
{
    static readonly eventNamePrefix: string = 'screen-vary-app-document-m';
    private _varySlideData: VarySlideScreenDataType | null = null;
    private _div: HTMLDivElement | null = null;
    private readonly syncAdjustedMediaElements =
        new WeakSet<HTMLMediaElement>();
    // Live YouTube embeds in the currently-rendered slide. Rebuilt on every
    // render and torn down before the next one so their window `message`
    // listeners never leak.
    private youTubePlayers: SlideYouTubePlayer[] = [];
    effectManager: ScreenEffectManager;

    constructor(
        screenManagerBase: ScreenManagerBase,
        effectManager: ScreenEffectManager,
    ) {
        super(screenManagerBase);
        this.effectManager = effectManager;
        if (appProvider.isPagePresenter) {
            const allSlideList = getAppDocumentListOnScreenSetting();
            this._varySlideData = allSlideList[this.key] ?? null;
        }
    }

    get isShowing() {
        return this.varySlideData !== null;
    }

    get div() {
        return this._div;
    }

    set div(div: HTMLDivElement | null) {
        this._div = div;
        this.render();
    }

    get varySlideData() {
        return this._varySlideData;
    }

    set varySlideData(targetVarySlideData: VarySlideScreenDataType | null) {
        const varySlideData =
            targetVarySlideData !== null
                ? cloneJson(targetVarySlideData)
                : null;

        if (varySlideData !== null) {
            const { itemJson } = varySlideData;
            if (
                varySlideData.virtualBackgroundColor &&
                ((itemJson as any).htmlFilePath === BLANK_HTML_SLIDE_SRC ||
                    (itemJson as any).imagePreviewSrc === BLANK_IMAGE_SLIDE_SRC)
            ) {
                varySlideData.virtualBackgroundColor = null;
            }
        }
        // Re-selecting the same slide is a no-op; short-circuit before any
        // guard toast so a redundant click stays silent.
        if (checkAreObjectsEqual(this._varySlideData, varySlideData)) {
            return;
        }
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        // Block only a swap to a *different* slide that would tear down media
        // currently playing on the presenter's mini screen. Clearing (null) is
        // an explicit stop and must go through — otherwise ScreenManager.clear()
        // would partially clear (bible/foreground/background gone, the playing
        // slide left behind). The projected screen (isPageScreen) must always
        // follow sync updates, so it is never blocked here.
        if (
            varySlideData !== null &&
            !appProvider.isPageScreen &&
            this.checkIsMediaPlaying()
        ) {
            return;
        }
        if (!appProvider.isPageScreen && varySlideData?.itemJson) {
            applyAttachBackground(
                this.screenId,
                varySlideData.filePath,
                varySlideData.itemJson.id,
            );
        }
        this._varySlideData = varySlideData;
        unlocking(screenManagerSettingNames.VARY_APP_DOCUMENT, () => {
            const allSlideList = getAppDocumentListOnScreenSetting();
            if (varySlideData === null) {
                delete allSlideList[this.key];
            } else {
                allSlideList[this.key] = varySlideData;
            }
            const string = JSON.stringify(allSlideList);
            setSetting(screenManagerSettingNames.VARY_APP_DOCUMENT, string);
            this.fireUpdateEvent();
        });
        this.render();
        this.sendSyncScreen();
    }

    toSyncMessage(): BasicScreenMessageType {
        return {
            type: 'vary-app-document',
            data: this.varySlideData,
        };
    }

    receiveSyncScreen(message: ScreenMessageType) {
        this.varySlideData = message.data;
    }

    async getMemberInstances(): Promise<ScreenVaryAppDocumentManager[]> {
        return [];
    }
    async getMemberIds(): Promise<number[]> {
        return [];
    }
    async checkIsMainInstance(): Promise<boolean> {
        return false;
    }

    sendSyncVideoTime(videoId: string, videoTime: number, isPlaying: boolean) {
        setTimeout(() => {
            this.screenManagerBase.sendScreenMessage(
                {
                    screenId: this.screenId,
                    type: 'vary-app-document-video-time',
                    data: {
                        videoId,
                        videoTime,
                        timestamp: Date.now(),
                        isPlaying,
                    },
                },
                true,
            );
        }, 0);
    }

    getMediaElements(videoId: string): HTMLMediaElement[] {
        const div = this.div;
        if (div === null) {
            return [];
        }
        // PPTX/DOCX slides mount their media inside a shadow root, so the
        // lookup must pierce shadow boundaries and cover both video and audio.
        return queryAllDeep(div, `video#${videoId}, audio#${videoId}`).filter(
            (element): element is HTMLMediaElement => {
                return element instanceof HTMLMediaElement;
            },
        );
    }

    setVideoCurrentTime(data: SlideVideoTimeDataType) {
        const div = this.div;
        if (div === null) {
            return;
        }
        const { videoId, videoTime, timestamp, isPlaying } = data;
        const mediaElements = this.getMediaElements(videoId);
        for (const mediaElement of mediaElements) {
            if (appProvider.isPageScreen) {
                // The screen follows the mini screen's play state; sound
                // stays on the presenter side, the screen keeps muted.
                if (isPlaying && mediaElement.paused) {
                    playMediaElement(mediaElement);
                } else if (!isPlaying && !mediaElement.paused) {
                    mediaElement.pause();
                }
            }
            const latency = isPlaying ? (Date.now() - timestamp) / 1000 : 0;
            const exactVideoTime = videoTime + latency;
            // 24 fps, 1000/24 = 0.04166..., for 0.15 second threshold, it can
            // be 3 frames, which is good enough for syncing video.
            if (Math.abs(mediaElement.currentTime - exactVideoTime) > 0.15) {
                // Prevent the timeupdate emitted by this sync correction from
                // being broadcast back to the group.
                this.syncAdjustedMediaElements.add(mediaElement);
                mediaElement.currentTime = exactVideoTime;
            }
        }
        this.applyYouTubeSync(data);
    }

    // A YouTube embed follows the same sync data as a slide `<video>`: the
    // projected screen mirrors the master's play/pause (staying muted), and any
    // follower seeks only when it has drifted enough to be worth re-buffering.
    private applyYouTubeSync(data: SlideVideoTimeDataType) {
        const { videoId, videoTime, timestamp, isPlaying } = data;
        const player = this.youTubePlayers.find((item) => {
            return item.id === videoId;
        });
        if (player === undefined) {
            return;
        }
        if (appProvider.isPageScreen) {
            if (isPlaying && !player.isPlaying) {
                // Only the master (the first-clicked mini) keeps sound; the
                // projected screen is always silent. Re-mute right before it
                // starts in case the setup-time mute landed before the player
                // was ready.
                player.mute();
                player.play();
            } else if (!isPlaying && player.isPlaying) {
                player.pause();
            }
        }
        const latency = isPlaying ? (Date.now() - timestamp) / 1000 : 0;
        const exactVideoTime = videoTime + latency;
        if (
            Math.abs(player.getCurrentTime() - exactVideoTime) >
            YOUTUBE_SYNC_SEEK_THRESHOLD_SECONDS
        ) {
            player.seekTo(exactVideoTime);
        }
    }

    setVideoCurrentTimeForce(
        videoId: string,
        videoTime: number,
        isPlaying: boolean,
    ) {
        const data = {
            videoId,
            videoTime,
            timestamp: Date.now(),
            isPlaying,
        };
        this.sendSyncVideoTime(videoId, videoTime, isPlaying);
        this.setVideoCurrentTime(data);
    }

    async setSlideVideoCurrentTimeForce(
        videoId: string,
        videoTime: number,
        isPlaying: boolean,
    ) {
        this.sendSyncVideoTime(videoId, videoTime, isPlaying);
        const managers = await this.getMemberInstances();
        for (const manager of managers) {
            manager.setVideoCurrentTimeForce(videoId, videoTime, isPlaying);
        }
    }

    receiveSyncVideoTime(message: ScreenMessageType) {
        if (message.screenId !== this.screenId) {
            return;
        }
        const { data } = message;
        const { videoId, videoTime, timestamp, isPlaying } = data;
        if (
            !videoId ||
            typeof videoTime !== 'number' ||
            typeof timestamp !== 'number' ||
            typeof isPlaying !== 'boolean'
        ) {
            return;
        }
        this.setVideoCurrentTime(data);
    }

    static receiveSyncVideoTime(message: ScreenMessageType) {
        const { screenId } = message;
        const screenVaryAppDocumentManager = this.getInstance(screenId);
        if (screenVaryAppDocumentManager === null) {
            return;
        }
        screenVaryAppDocumentManager.receiveSyncVideoTime(message);
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenVaryAppDocumentManager.fireUpdateEvent();
    }

    static getDataList(filePath?: string, varySlideId?: number) {
        const dataList = getAppDocumentListOnScreenSetting();
        return Object.entries(dataList).filter(([_, data]) => {
            if (filePath !== undefined && data.filePath !== filePath) {
                return false;
            }
            if (varySlideId !== undefined && data.itemJson.id !== varySlideId) {
                return false;
            }
            return true;
        });
    }

    applySlideSrcWithSyncGroup(
        varySlideScreenData: VarySlideScreenDataType | null,
    ) {
        ScreenVaryAppDocumentManager.enableSyncGroup(this.screenId);
        this.varySlideData = varySlideScreenData;
    }

    toSlideData(
        filePath: string,
        itemJson: VarySlideDataType,
    ): VarySlideScreenDataType {
        return {
            filePath,
            itemJson,
            isRenderFullWidth: checkIsPdfFullWidth(),
            virtualBackgroundColor: getPageBaseVirtualBackgroundColor(),
        };
    }

    handleSlideSelecting(filePath: string, itemJson: VarySlideDataType) {
        const newSlideData = this.toSlideData(filePath, itemJson);
        this.applySlideSrcWithSyncGroup(newSlideData);
    }

    static async handleSlideSelecting(
        event: MouseEvent,
        filePath: string,
        itemJson: VarySlideDataType,
        isForceChoosing = false,
    ) {
        const screenIds = await this.chooseScreenIds(event, isForceChoosing);
        for (const screenId of screenIds) {
            const screenVaryAppDocumentManager = this.getInstance(screenId);
            if (screenVaryAppDocumentManager === null) {
                showSimpleToast(
                    'Failed to sync slide. Please make sure the screen is open.',
                    'error',
                );
                continue;
            }
            screenVaryAppDocumentManager.handleSlideSelecting(
                filePath,
                itemJson,
            );
        }
    }

    renderPdf(
        divHaftScale: HTMLDivElement,
        pdfImageData: PdfSlideType,
        isFullWidth: boolean,
        virtualBackgroundColor: string | null,
    ) {
        if (!pdfImageData.imagePreviewSrc) {
            return null;
        }
        const content = genPdfSlide(pdfImageData.imagePreviewSrc, isFullWidth);
        const { width, height } = pdfImageData.metadata;
        if (!isFullWidth && width > 0 && height > 0) {
            // size to the page box so the background color paints only the
            // page area, leaving the screen background visible around it
            if (virtualBackgroundColor !== null) {
                content.style.backgroundColor = virtualBackgroundColor;
            }
            Object.assign(divHaftScale.style, {
                width: `${width}px`,
                height: `${height}px`,
                overflow: 'hidden',
                transform: 'translate(-50%, -50%)',
            });
            const scale = Math.min(
                this.screenManagerBase.width / width,
                this.screenManagerBase.height / height,
            );
            return { content, scale };
        }
        if (isFullWidth && virtualBackgroundColor !== null) {
            content.style.backgroundColor = virtualBackgroundColor;
        }
        Object.assign(divHaftScale.style, {
            width: '100%',
            height: '100%',
            overflow: isFullWidth ? 'auto' : 'hidden',
            transform: 'translate(-50%, -50%)',
        });
        return { content, scale: 1 };
    }

    renderPptx(divHaftScale: HTMLDivElement, pptxData: PptxSlideType) {
        const content = genPptxSlide(
            pptxData.html,
            pptxData.htmlFilePath,
            pptxData.metadata.width,
            pptxData.metadata.height,
        );
        // Give embedded video/audio native controls on the mini screen and
        // the play/pause/time sync wiring, mirroring regular slides.
        this.cleanupSlideContent(content);
        const { width, height } = pptxData.metadata;
        Object.assign(divHaftScale.style, {
            width: `${width}px`,
            height: `${height}px`,
            transform: 'translate(-50%, -50%)',
            overflow: 'hidden',
        });
        const scale = Math.min(
            this.screenManagerBase.width / width,
            this.screenManagerBase.height / height,
        );
        return { content, scale };
    }

    renderDocx(
        divHaftScale: HTMLDivElement,
        docxData: DocxSlideType,
        isFullWidth: boolean,
        virtualBackgroundColor: string | null,
    ) {
        const parentWidth = this.screenManagerBase.width;
        const content = genDocxSlide(
            docxData.html,
            docxData.htmlFilePath,
            docxData.metadata.width,
            docxData.metadata.height,
            parentWidth,
            isFullWidth,
        );
        // Give embedded video/audio native controls on the mini screen and
        // the play/pause/time sync wiring, mirroring regular slides.
        this.cleanupSlideContent(content);
        if (virtualBackgroundColor !== null) {
            content.style.backgroundColor = virtualBackgroundColor;
        }
        const { width, height } = docxData.metadata;
        if (isFullWidth) {
            Object.assign(divHaftScale.style, {
                width: '100%',
                height: '100%',
                transform: 'translate(-50%, -50%)',
                overflow: 'auto',
            });
            return { content, scale: 1 };
        }
        Object.assign(divHaftScale.style, {
            width: `${width}px`,
            height: `${height}px`,
            transform: 'translate(-50%, -50%)',
            overflow: 'hidden',
        });
        const scale = Math.min(
            this.screenManagerBase.width / width,
            this.screenManagerBase.height / height,
        );
        return { content, scale };
    }

    private setSlideVideoBadgeVisibility(
        videoElement: HTMLVideoElement,
        isVisible: boolean,
    ) {
        const badge = videoElement.parentElement?.querySelector(
            `[${PREVIEW_ONLY_ATTR}]`,
        );
        if (badge instanceof HTMLElement || badge instanceof SVGElement) {
            badge.style.display = isVisible ? '' : 'none';
        }
    }

    // Same rule as the background audio handlers: starting one slide's media
    // stops the media playing on other slides/screens so only one thing makes
    // sound. The initiating manager is skipped so a slide that embeds both a
    // video and an audio (a PPTX renders its audio as a muted-less <video>) can
    // play them together. A group member's copy of the SAME media keeps its
    // screen driven by this instance, so its pause is flagged and must not
    // broadcast a pause back to the group. This covers both native `<video>`/
    // `<audio>` and YouTube embeds so the two never sound at once.
    private stopOtherPlayingSlideMedia(
        groupManagers: Set<ScreenVaryAppDocumentManager>,
        initiator: {
            mediaElement?: HTMLMediaElement;
            youTubeId?: string;
        },
    ) {
        for (const manager of ScreenVaryAppDocumentManager.getAllInstances()) {
            const div = manager.div;
            if (div === null || manager === this) {
                continue;
            }
            for (const media of queryAllDeep(div, 'video, audio')) {
                if (
                    media instanceof HTMLMediaElement === false ||
                    media === initiator.mediaElement ||
                    media.paused
                ) {
                    continue;
                }
                if (
                    groupManagers.has(manager) &&
                    initiator.mediaElement !== undefined &&
                    media.id === initiator.mediaElement.id
                ) {
                    media.dataset.pausedByGroupSync = '1';
                }
                media.pause();
            }
            for (const player of manager.youTubePlayers) {
                if (!player.isPlaying) {
                    continue;
                }
                if (
                    groupManagers.has(manager) &&
                    initiator.youTubeId !== undefined &&
                    player.id === initiator.youTubeId
                ) {
                    player.pausedBySync = true;
                }
                player.pause();
            }
        }
    }

    private readonly handleSlideMediaPlaying = async (event: Event) => {
        const mediaElement = event.currentTarget as HTMLMediaElement;
        handleMediaPlaying(event);
        if (mediaElement instanceof HTMLVideoElement) {
            this.setSlideVideoBadgeVisibility(mediaElement, false);
        }
        const groupManagers = new Set(await this.getMemberInstances());
        groupManagers.add(this);
        this.stopOtherPlayingSlideMedia(groupManagers, { mediaElement });
        void this.setSlideVideoCurrentTimeForce(
            mediaElement.id,
            mediaElement.currentTime,
            true,
        );
    };

    // The YouTube equivalents of the slide-media handlers above. The presenter
    // mini screen is the sound "master": when the operator plays a YouTube
    // embed there, all other slide media stops and the current time + play
    // state is broadcast so the projected screens (and grouped screens) follow.
    private readonly handleSlideYouTubePlaying = async (
        youTubeId: string,
        currentTime: number,
    ) => {
        const groupManagers = new Set(await this.getMemberInstances());
        groupManagers.add(this);
        this.stopOtherPlayingSlideMedia(groupManagers, { youTubeId });
        void this.setSlideVideoCurrentTimeForce(youTubeId, currentTime, true);
    };

    private readonly handleSlideYouTubePausing = (
        youTubeId: string,
        currentTime: number,
    ) => {
        void this.setSlideVideoCurrentTimeForce(youTubeId, currentTime, false);
    };

    private readonly handleSlideYouTubeTimeUpdate = (
        youTubeId: string,
        currentTime: number,
        isPlaying: boolean,
    ) => {
        void this.setSlideVideoCurrentTimeForce(
            youTubeId,
            currentTime,
            isPlaying,
        );
    };

    private destroyYouTubePlayers() {
        for (const player of this.youTubePlayers) {
            player.destroy();
        }
        this.youTubePlayers = [];
    }

    private setupYouTubePlayer(iframe: HTMLIFrameElement) {
        const youTubeId = genYouTubeSyncId(iframe);
        iframe.id = youTubeId;
        const isScreen = appProvider.isPageScreen;
        // The projected screen is a muted follower and never broadcasts, so it
        // passes no callbacks and mutes itself as soon as the player is ready —
        // sound stays on the presenter mini, exactly like a slide video. The
        // presenter mini is a potential master and keeps its sound.
        const player = new SlideYouTubePlayer(
            iframe,
            youTubeId,
            isScreen
                ? {}
                : {
                      onPlay: (currentTime) => {
                          void this.handleSlideYouTubePlaying(
                              youTubeId,
                              currentTime,
                          );
                      },
                      onPause: (currentTime) => {
                          this.handleSlideYouTubePausing(
                              youTubeId,
                              currentTime,
                          );
                      },
                      onTimeUpdate: (currentTime, isPlaying) => {
                          this.handleSlideYouTubeTimeUpdate(
                              youTubeId,
                              currentTime,
                              isPlaying,
                          );
                      },
                  },
            { muteOnReady: isScreen },
        );
        this.youTubePlayers.push(player);
    }

    private readonly handleSlideMediaPausing = (event: Event) => {
        const mediaElement = event.currentTarget as HTMLMediaElement;
        handleMediaStopped(event);
        if (mediaElement instanceof HTMLVideoElement) {
            this.setSlideVideoBadgeVisibility(mediaElement, true);
        }
        if (mediaElement.dataset.pausedByGroupSync !== undefined) {
            delete mediaElement.dataset.pausedByGroupSync;
            return;
        }
        void this.setSlideVideoCurrentTimeForce(
            mediaElement.id,
            mediaElement.currentTime,
            false,
        );
    };

    private readonly handleSlideMediaTimeUpdate = (event: Event) => {
        const mediaElement = event.currentTarget as HTMLMediaElement;
        if (this.syncAdjustedMediaElements.has(mediaElement)) {
            this.syncAdjustedMediaElements.delete(mediaElement);
            return;
        }
        if (mediaElement.dataset.pausedByGroupSync !== undefined) {
            // `pause()` fires a trailing timeupdate before the pause event;
            // this one belongs to a group takeover, so do not broadcast.
            return;
        }
        void this.setSlideVideoCurrentTimeForce(
            mediaElement.id,
            mediaElement.currentTime,
            !mediaElement.paused,
        );
    };

    cleanupSlideContent(content: HTMLDivElement) {
        if (appProvider.isPageScreen) {
            // Only elements opted in as preview-only (e.g. the video play
            // badge), never every `svg`: canvas items draw their own icons
            // (e.g. the bible item's book icon) as inline svg.
            for (const element of queryAllDeep(
                content,
                `[${PREVIEW_ONLY_ATTR}]`,
            )) {
                if (
                    element instanceof HTMLElement ||
                    element instanceof SVGElement
                ) {
                    element.style.display = 'none';
                }
            }
        }
        for (const media of queryAllDeep(content, 'video, audio')) {
            if (media instanceof HTMLMediaElement === false) {
                continue;
            }
            media.loop = false;
            media.id = genVideoIDFromSrc(getMediaSyncSrc(media));
            if (appProvider.isPageScreen) {
                // No auto-play: hold the first frame, muted. Playback is
                // driven from a mini screen and the sound stays there.
                media.muted = true;
                media.preload = 'auto';
            } else {
                media.muted = false;
                media.controls = true;
                // The canvas/pptx render disables pointer events on its
                // wrapper; re-enable them for the native controls.
                media.style.pointerEvents = 'auto';
                media.addEventListener('play', this.handleSlideMediaPlaying);
                media.addEventListener('pause', this.handleSlideMediaPausing);
                media.addEventListener('ended', this.handleSlideMediaPausing);
                media.addEventListener(
                    'timeupdate',
                    this.handleSlideMediaTimeUpdate,
                );
            }
        }
        // Embedded YouTube/website items (iframes) render non-interactive so
        // the slide editor can still drag their box. A YouTube embed is wired
        // for group-sync (play from the mini screen, follow on the projected
        // screen); a plain website iframe just becomes interactive on the mini
        // screen. The big screen holds both non-interactive, the same way a
        // slide video is controlled from the mini screen and not the output.
        for (const iframe of queryAllDeep(content, 'iframe')) {
            if (iframe instanceof HTMLIFrameElement === false) {
                continue;
            }
            if (checkIsYouTubeSyncIframe(iframe)) {
                if (!appProvider.isPageScreen) {
                    iframe.style.pointerEvents = 'auto';
                }
                this.setupYouTubePlayer(iframe);
            } else if (!appProvider.isPageScreen) {
                iframe.style.pointerEvents = 'auto';
            }
        }
    }

    async getRenderingItemJson(
        item: VarySlideType,
    ): Promise<VarySlideDataType> {
        if (PptxSlide.checkIsThisType(item) && item.html === undefined) {
            const pptxSlide = await PptxAppDocument.getInstance(
                item.filePath,
            ).getItemById(item.id);
            return (pptxSlide?.toJson() ?? item.toJson()) as VarySlideDataType;
        }
        if (DocxSlide.checkIsThisType(item) && item.html === undefined) {
            const docxSlide = await DocxAppDocument.getInstance(
                item.filePath,
            ).getItemById(item.id);
            return (docxSlide?.toJson() ?? item.toJson()) as VarySlideDataType;
        }
        return item.toJson() as VarySlideDataType;
    }

    async renderAppDocument(divHaftScale: HTMLDivElement, itemJson: SlideType) {
        // A bible key's @font-face is injected per window when its language
        // data loads. This also runs in the screen window, where
        // `AppDocument.getSlides` never did that, so resolve the fonts here
        // before generating the HTML. Imported dynamically because a static
        // import changes the module evaluation order on the screen page and
        // trips a circular-import TDZ crash.
        const bibleKeys = new Set<string>();
        for (const canvasItem of itemJson.canvasItems) {
            if (canvasItem.type !== 'bible') {
                continue;
            }
            const { bibleKeys: itemBibleKeys } =
                canvasItem as CanvasItemBiblePropsType;
            for (const bibleKey of itemBibleKeys ?? []) {
                bibleKeys.add(bibleKey);
            }
        }
        if (bibleKeys.size > 0) {
            await Promise.all(
                Array.from(bibleKeys).map((bibleKey) => {
                    return getBibleFontFamily(bibleKey);
                }),
            );
        }
        const content = genSlideHtml(itemJson.canvasItems);
        this.cleanupSlideContent(content);
        const { width, height } = itemJson.metadata;
        Object.assign(divHaftScale.style, {
            width: `${width}px`,
            height: `${height}px`,
            transform: 'translate(-50%, -50%)',
            overflow: 'hidden',
        });
        const scale = Math.min(
            this.screenManagerBase.width / width,
            this.screenManagerBase.height / height,
        );
        return { content, scale };
    }

    async clearJunk(div: HTMLDivElement) {
        if (div.lastChild === null) {
            return;
        }
        const targetDiv = div.lastChild as HTMLDivElement;
        await this.effectManager.styleAnim.animOut(targetDiv);
        targetDiv.remove();
    }

    async render() {
        if (this.div === null) {
            return;
        }
        // Tear down the previous slide's YouTube players (and their window
        // `message` listeners) before rendering the next slide; the new content
        // registers fresh ones in `cleanupSlideContent`.
        this.destroyYouTubePlayers();
        const div = this.div;
        if (this.varySlideData === null) {
            this.clearJunk(div);
            return;
        }
        const divContainer = document.createElement('div');
        const divHaftScale = document.createElement('div');
        divHaftScale.classList.add('half-scale-container');
        divContainer.appendChild(divHaftScale);
        registerScrollingSyncEvent(divHaftScale, (scroll) => {
            this.sendSyncScrollPercentage('.half-scale-container', scroll);
        });

        const { itemJson, isRenderFullWidth, virtualBackgroundColor } =
            this.varySlideData;
        const backgroundColor = virtualBackgroundColor ?? null;

        let target;
        if (PdfSlide.tryValidate(itemJson)) {
            target = this.renderPdf(
                divHaftScale,
                itemJson as PdfSlideType,
                isRenderFullWidth,
                backgroundColor,
            );
        } else if (PptxSlide.tryValidate(itemJson)) {
            target = this.renderPptx(divHaftScale, itemJson as PptxSlideType);
        } else if (DocxSlide.tryValidate(itemJson)) {
            target = this.renderDocx(
                divHaftScale,
                itemJson as DocxSlideType,
                isRenderFullWidth,
                backgroundColor,
            );
        } else {
            target = await this.renderAppDocument(
                divHaftScale,
                itemJson as SlideType,
            );
        }
        if (target === null) {
            return;
        }
        for (const child of Array.from(div.children)) {
            this.effectManager.styleAnim
                .animOut(child as HTMLDivElement)
                .then(() => {
                    child.remove();
                });
        }
        divHaftScale.appendChild(target.content);
        Object.assign(divContainer.style, {
            position: 'absolute',
            width: `${this.screenManagerBase.width}px`,
            height: `${this.screenManagerBase.height}px`,
            transform: `scale(${target.scale},${target.scale}) translate(50%, 50%)`,
        });
        this.effectManager.styleAnim.animIn(divContainer, div);
    }

    get containerStyle(): CSSProperties {
        return {
            position: 'absolute',
            width: `${this.screenManagerBase.width}px`,
            height: `${this.screenManagerBase.height}px`,
            overflow: 'hidden',
        };
    }

    async receiveScreenDropped(droppedData: DroppedDataType) {
        const item: VarySlideType = droppedData.item;
        const itemJson = await this.getRenderingItemJson(item);
        const varySlideData = {
            filePath: item.filePath,
            itemJson,
            isRenderFullWidth: checkIsPdfFullWidth(),
            virtualBackgroundColor: getPageBaseVirtualBackgroundColor(),
        };
        this.applySlideSrcWithSyncGroup(varySlideData);
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenVaryAppDocumentManager = this.getInstance(screenId);
        if (screenVaryAppDocumentManager === null) {
            showSimpleToast(
                'Failed to sync slide. Please make sure the screen is open.',
                'error',
            );
            return;
        }
        screenVaryAppDocumentManager.receiveSyncScreen(message);
    }

    clear() {
        this.applySlideSrcWithSyncGroup(null);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenVaryAppDocumentManager>(screenId);
    }

    static getAllInstances() {
        return super.getAllInstancesBase<ScreenVaryAppDocumentManager>();
    }

    checkIsMediaPlaying(isWithMessage = true) {
        if (this.div === null) {
            return false;
        }
        return checkMediaPlaying({
            targetElement: this.div,
            withMessage: isWithMessage,
        });
    }
}

export default ScreenVaryAppDocumentManager;
