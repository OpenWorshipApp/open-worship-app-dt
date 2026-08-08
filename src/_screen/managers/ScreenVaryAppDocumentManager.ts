import type { MouseEvent, CSSProperties } from 'react';

import type { DroppedDataType } from '../../helper/DragInf';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { tran } from '../../lang/langHelpers';
import type { SlidePropsType } from '../../app-document-list/Slide';
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
import {
    checkIsCameraMediaElement,
    SlideCameraAttachment,
} from './slideCameraSyncHelpers';
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
import type { PdfSlidePropsType } from '../../app-document-list/PdfSlide';
import PdfSlide from '../../app-document-list/PdfSlide';
import type { PptxSlidePropsType } from '../../app-document-list/PptxSlide';
import PptxSlide from '../../app-document-list/PptxSlide';
import type { DocxSlidePropsType } from '../../app-document-list/DocxSlide';
import DocxSlide from '../../app-document-list/DocxSlide';
import appProvider from '../../server/appProvider';
import { applyAttachBackground } from './screenBackgroundHelpers';
import { unlocking } from '../../server/unlockingHelpers';
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
import {
    cancelScreenSlideMediaControl,
    stopScreenSlideMediaControl,
} from './screenSlideMediaControlHelpers';
import PptxAppDocument from '../../app-document-list/PptxAppDocument';
import DocxAppDocument from '../../app-document-list/DocxAppDocument';
import { showSimpleToast } from '../../toast/toastHelpers';
import { getBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';
import { cloneJson } from '../../helper/helpers';
import { handleError } from '../../helper/errorHelpers';
import { getTargetLyricSlideItemData } from '../../lyric-list/lyricSlideScreenHelpers';

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
    /**
     * The master's playback rate, when it is not the default 1.
     *
     * Rides the time message rather than getting one of its own because the two
     * are the same question: a follower cannot know where the master WILL be
     * without knowing how fast it is going. Left off at rate 1 so a sheet that
     * never touches the speed sends exactly the bytes it always did, and so an
     * older screen build ignores the field rather than mis-reading it.
     *
     * Without it a `Slide: Media Control` set to 2x would run the presenter at 2x
     * and the projection at 1x, and the 0.15s drift correction below would then
     * seek the projection forward on every single tick.
     */
    playbackRate?: number;
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
    // Live camera feeds in the currently-rendered slide, released before the
    // next render and on delete so the device light never stays on.
    private readonly cameraAttachment = new SlideCameraAttachment();
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

    async set_varySlideData(
        targetVarySlideData: VarySlideScreenDataType | null,
    ) {
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
        if (this.screenManagerBase.checkIsLockedWithMessage()) {
            return;
        }
        // Past the lock check, so the slide this screen is showing IS about to be
        // unselected — swapped for another or cleared away. A `Slide: Media
        // Control` armed for this screen is the RUN SHEET holding that slide's
        // media, so the sheet stops it here: every media of the outgoing slide is
        // paused and the controller disarmed, on exactly the screens the
        // controller's host resolved to (the slot map is keyed by screen).
        //
        // Asked BEFORE the guard below, and it is what makes a sheet that plays a
        // slide's audio able to move on at all: that guard refuses to tear down
        // playing media, which is right for media the OPERATOR started (there is a
        // click to undo, and the toast says so) and wrong for media the sheet
        // itself started on the line the operator is now leaving — the run would
        // simply wedge on it.
        const wasMediaControlled =
            !appProvider.isPageScreen && stopScreenSlideMediaControl(this);
        // Block only a swap to a *different* slide that would tear down media
        // currently playing on the presenter's mini screen. Clearing (null) is
        // an explicit stop and must go through — otherwise ScreenManager.clear()
        // would partially clear (bible/foreground/background gone, the playing
        // slide left behind). The projected screen (isPageScreen) must always
        // follow sync updates, so it is never blocked here.
        if (
            varySlideData !== null &&
            !appProvider.isPageScreen &&
            !wasMediaControlled &&
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
        // Past every early return, so this is the one point at which the slide on
        // this screen actually changes: anything a `Slide: Media Control` armed for
        // the outgoing slide has to go with it. A "pause at 1:10" left running
        // would pause whatever the operator put up in the meantime, and a
        // `timeupdate` watcher on a replaced element would hold that element — and
        // the slide behind it — for as long as the app ran.
        //
        // The unselect above has already done this for the presenter, where the
        // controllers live; this is what covers the projected screen, and it is
        // the backstop that keeps the disarm true of EVERY path through here
        // rather than of the one that also pauses.
        cancelScreenSlideMediaControl(this.screenId);
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

    /**
     * The awaitable form of the `varySlideData` setter. A setter cannot be
     * awaited, so anything that needs to know when the slide has actually
     * reached the screen — and only then do its follow-up work — calls this
     * instead of assigning.
     */
    async applyVarySlideData(
        targetVarySlideData: VarySlideScreenDataType | null,
    ) {
        if (
            targetVarySlideData === null ||
            targetVarySlideData.filePath === null ||
            targetVarySlideData.itemJson === null
        ) {
            await this.set_varySlideData(targetVarySlideData);
            return;
        }
        const targetItemJson = await getTargetLyricSlideItemData(
            targetVarySlideData.filePath,
            targetVarySlideData.itemJson as any,
            this.screenManagerBase.stage,
        );
        // A new object rather than writing `itemJson` back onto the argument:
        // the argument can be an entry of the memoized on-screen map (the
        // constructor seeds `_varySlideData` from it), and mutating it would
        // change what every later reader of that map sees.
        await this.set_varySlideData({
            ...targetVarySlideData,
            itemJson: targetItemJson,
        });
    }

    set varySlideData(targetVarySlideData: VarySlideScreenDataType | null) {
        this.applyVarySlideData(targetVarySlideData).catch(handleError);
    }

    /**
     * Re-run the currently presented slide through the stage-aware setter so it
     * is re-derived for `screenManagerBase.stage`, then re-rendered, persisted
     * and synced to the projected screen.
     *
     * Called when the screen's stage changes: the presented slide is a snapshot
     * derived for one specific stage (a lyric renders chords and section titles
     * only from stage 1 up), so without this the `St:` label moves while both
     * the mini preview and the projected output keep the previous stage's
     * layout. No-op when nothing is presented.
     */
    reapplyForStage() {
        const varySlideData = this._varySlideData;
        if (varySlideData === null) {
            return;
        }
        this.varySlideData = cloneJson(varySlideData);
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

    sendSyncVideoTime(
        videoId: string,
        videoTime: number,
        isPlaying: boolean,
        playbackRate?: number,
    ) {
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
                        // Omitted at the default so the common message is
                        // unchanged — see `SlideVideoTimeDataType.playbackRate`.
                        ...(playbackRate !== undefined && playbackRate !== 1
                            ? { playbackRate }
                            : {}),
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

    /**
     * EVERY media element of the rendered slide, whatever its sync id — including
     * a preview-only canvas `audio`, which has none.
     *
     * `getMediaElements` above answers "the element this sync message is about";
     * this answers "everything in this slide that can be played", which is what a
     * run sheet's `Slide: Media Control` acts on. Not memoized: a render replaces
     * these nodes, and a cached list would be one of detached elements.
     */
    getAllMediaElements(): HTMLMediaElement[] {
        const div = this.div;
        if (div === null) {
            return [];
        }
        return queryAllDeep(div, 'video, audio').filter(
            (element): element is HTMLMediaElement => {
                // A camera feed has no timeline: pausing it or setting a
                // playback rate on it (which is what `Slide: Media Control`
                // does with this list) would just freeze the picture.
                return (
                    element instanceof HTMLMediaElement &&
                    !checkIsCameraMediaElement(element)
                );
            },
        );
    }

    /** The rendered slide's YouTube embeds, for the same caller. */
    getSlideYouTubePlayers(): SlideYouTubePlayer[] {
        return this.youTubePlayers;
    }

    setVideoCurrentTime(data: SlideVideoTimeDataType) {
        const div = this.div;
        if (div === null) {
            return;
        }
        const { videoId, videoTime, timestamp, isPlaying, playbackRate } = data;
        const mediaElements = this.getMediaElements(videoId);
        // Absent means the default, not "leave it alone": a master that has gone
        // back to 1x stops sending the field, and a follower left at 2x would then
        // be corrected by a seek on every tick for ever.
        const targetPlaybackRate = playbackRate ?? 1;
        for (const mediaElement of mediaElements) {
            if (mediaElement.playbackRate !== targetPlaybackRate) {
                mediaElement.playbackRate = targetPlaybackRate;
            }
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
        const { videoId, videoTime, timestamp, isPlaying, playbackRate } = data;
        const player = this.youTubePlayers.find((item) => {
            return item.id === videoId;
        });
        if (player === undefined) {
            return;
        }
        // The player itself drops a repeat, so this costs a comparison on a tick
        // that changes nothing. Absent means the default rather than "leave it
        // alone", exactly as on the native path: a master that has gone back to 1x
        // stops sending the field.
        player.setPlaybackRate(playbackRate ?? 1);
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
        playbackRate?: number,
    ) {
        const data = {
            videoId,
            videoTime,
            timestamp: Date.now(),
            isPlaying,
            ...(playbackRate !== undefined ? { playbackRate } : {}),
        };
        this.sendSyncVideoTime(videoId, videoTime, isPlaying, playbackRate);
        this.setVideoCurrentTime(data);
    }

    async setSlideVideoCurrentTimeForce(
        videoId: string,
        videoTime: number,
        isPlaying: boolean,
        playbackRate?: number,
    ) {
        this.sendSyncVideoTime(videoId, videoTime, isPlaying, playbackRate);
        const managers = await this.getMemberInstances();
        for (const manager of managers) {
            manager.setVideoCurrentTimeForce(
                videoId,
                videoTime,
                isPlaying,
                playbackRate,
            );
        }
    }

    receiveSyncVideoTime(message: ScreenMessageType) {
        if (message.screenId !== this.screenId) {
            return;
        }
        const { data } = message;
        const { videoId, videoTime, timestamp, isPlaying, playbackRate } = data;
        if (
            !videoId ||
            typeof videoTime !== 'number' ||
            typeof timestamp !== 'number' ||
            typeof isPlaying !== 'boolean' ||
            // Optional, so only a PRESENT value has to be usable — a garbage rate
            // must not drop the time message it rode in on.
            (playbackRate !== undefined &&
                (typeof playbackRate !== 'number' ||
                    !Number.isFinite(playbackRate) ||
                    playbackRate <= 0))
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
        // Returns the apply promise so a caller that must not act until the
        // slide is actually on the screen can await it; assigning the setter
        // would hide that behind a fire-and-forget chain.
        return this.applyVarySlideData(varySlideScreenData);
    }

    toSlideData(filePath: string, itemJson: VarySlideDataType) {
        const data: VarySlideScreenDataType = {
            filePath,
            itemJson,
            isRenderFullWidth: checkIsPdfFullWidth(),
            virtualBackgroundColor: getPageBaseVirtualBackgroundColor(),
        };
        return data;
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
        presetScreenIds: number[] = [],
    ) {
        const screenIds = await this.chooseScreenIds(
            event,
            isForceChoosing,
            presetScreenIds,
        );
        for (const screenId of screenIds) {
            const screenVaryAppDocumentManager = this.getInstance(screenId);
            if (screenVaryAppDocumentManager === null) {
                showSimpleToast(
                    tran(
                        'Failed to sync slide. Please make sure the screen is open.',
                    ),
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
        pdfImageData: PdfSlidePropsType,
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

    renderPptx(divHaftScale: HTMLDivElement, pptxData: PptxSlidePropsType) {
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
        docxData: DocxSlidePropsType,
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
                    media.paused ||
                    // A live camera is never "paused", so without this skip,
                    // playing one slide's video would freeze the camera on
                    // every other screen for good.
                    checkIsCameraMediaElement(media)
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
            mediaElement.playbackRate,
        );
    };

    // The YouTube equivalents of the slide-media handlers above. The presenter
    // mini screen is the sound "master": when the operator plays a YouTube
    // embed there, all other slide media stops and the current time + play
    // state is broadcast so the projected screens (and grouped screens) follow.
    /**
     * The rate a YouTube embed is running at, as this window last set it.
     *
     * Carried on every message the three handlers below send, and not only when a
     * `Slide: Media Control` sets it: a slide holding ONLY a YouTube embed
     * broadcasts nothing else that knows the rate, so leaving it off would let the
     * next ordinary tick tell every follower to go back to 1x.
     */
    private getYouTubePlaybackRate(youTubeId: string) {
        return this.youTubePlayers.find((item) => {
            return item.id === youTubeId;
        })?.playbackRate;
    }

    private readonly handleSlideYouTubePlaying = async (
        youTubeId: string,
        currentTime: number,
    ) => {
        const groupManagers = new Set(await this.getMemberInstances());
        groupManagers.add(this);
        this.stopOtherPlayingSlideMedia(groupManagers, { youTubeId });
        void this.setSlideVideoCurrentTimeForce(
            youTubeId,
            currentTime,
            true,
            this.getYouTubePlaybackRate(youTubeId),
        );
    };

    private readonly handleSlideYouTubePausing = (
        youTubeId: string,
        currentTime: number,
    ) => {
        void this.setSlideVideoCurrentTimeForce(
            youTubeId,
            currentTime,
            false,
            this.getYouTubePlaybackRate(youTubeId),
        );
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
            this.getYouTubePlaybackRate(youTubeId),
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
            mediaElement.playbackRate,
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
            mediaElement.playbackRate,
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
            // A camera item is a LIVE device feed, not a file. This is the one
            // place its stream is opened — everywhere else it stays the static
            // placeholder — and it stays out of the whole sync path below: a
            // `blob:` src would key it differently in every window, and a
            // scrub bar / group pause makes no sense for something with no
            // timeline.
            if (checkIsCameraMediaElement(media)) {
                this.cameraAttachment.attach(media as HTMLVideoElement);
                continue;
            }
            media.loop = false;
            // A canvas audio item is preview-only: it is hidden on the
            // projected screen (loop above), so mirroring it there would only
            // download the file and broadcast a time message per `timeupdate`
            // for something nobody can see or hear. It takes no sync id and no
            // sync wiring — the operator clicks it on the mini screen and it
            // plays there, like a background audio. PPTX/DOCX embedded media
            // carries no such mark and keeps the full sync behaviour.
            if (media.hasAttribute(PREVIEW_ONLY_ATTR)) {
                if (!appProvider.isPageScreen) {
                    media.muted = false;
                    media.style.pointerEvents = 'auto';
                    media.addEventListener('play', handleMediaPlaying);
                    media.addEventListener('pause', handleMediaStopped);
                    media.addEventListener('ended', handleMediaStopped);
                }
                continue;
            }
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

    async renderAppDocument(
        divHaftScale: HTMLDivElement,
        itemJson: SlidePropsType,
    ) {
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
        // ABOVE the null guard, unlike `destroyYouTubePlayers` below: `set div`
        // calls `render()`, so a mini-screen host unmounting comes through here
        // with `div` already null and takes that early return. A camera left
        // running on that path keeps the device light on for ever.
        this.cameraAttachment.releaseAll();
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
                itemJson as PdfSlidePropsType,
                isRenderFullWidth,
                backgroundColor,
            );
        } else if (PptxSlide.tryValidate(itemJson)) {
            target = this.renderPptx(
                divHaftScale,
                itemJson as PptxSlidePropsType,
            );
        } else if (DocxSlide.tryValidate(itemJson)) {
            target = this.renderDocx(
                divHaftScale,
                itemJson as DocxSlidePropsType,
                isRenderFullWidth,
                backgroundColor,
            );
        } else {
            target = await this.renderAppDocument(
                divHaftScale,
                itemJson as SlidePropsType,
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
        await this.applySlideSrcWithSyncGroup(varySlideData);
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

    delete() {
        // Local teardown only — deliberately NOT clear(). clear() goes through
        // the varySlideData setter, which broadcasts to every screen sharing
        // this one's color note (deleting one screen blanked the group's slide)
        // and which a locked screen rejects, leaving the YouTube players' window
        // listeners alive. The persisted entry is dropped centrally by
        // deleteScreenPersistedData.
        this.destroyYouTubePlayers();
        this.cameraAttachment.releaseAll();
        if (this._div !== null) {
            this._div.replaceChildren();
            this._div = null;
        }
        this._varySlideData = null;
        super.delete();
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
