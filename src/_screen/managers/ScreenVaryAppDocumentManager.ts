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
    handleMediaPlaying,
    handleMediaStopped,
} from '../../helper/audioControlHelpers';
import { genVideoIDFromSrc } from '../screenHelpers';
import ScreenEventHandler, {
    type GroupMembershipInf,
} from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import type ScreenEffectManager from './ScreenEffectManager';
import { getAppDocumentListOnScreenSetting } from '../preview/screenPreviewerHelpers';
import { toKeyByFilePath } from '../../app-document-list/appDocumentHelpers';
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

class ScreenVaryAppDocumentManager
    extends ScreenEventHandler<ScreenVaryAppDocumentManagerEventType>
    implements GroupMembershipInf
{
    static readonly eventNamePrefix: string = 'screen-vary-app-document-m';
    private _varySlideData: VarySlideScreenDataType | null = null;
    private _div: HTMLDivElement | null = null;
    private readonly syncAdjustedMediaElements =
        new WeakSet<HTMLMediaElement>();
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

    set varySlideData(varySlideData: VarySlideScreenDataType | null) {
        if (
            this.screenManagerBase.checkIsLockedWithMessage() ||
            checkAreObjectsEqual(this._varySlideData, varySlideData)
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
        const { varySlideData } = this;
        const selectedFilePath = varySlideData?.filePath ?? '';
        const selectedSlideId = varySlideData?.itemJson.id ?? -1;
        const selected = toKeyByFilePath(selectedFilePath, selectedSlideId);
        const willSelected = toKeyByFilePath(filePath, itemJson.id);
        const newSlideData =
            selected === willSelected
                ? null
                : this.toSlideData(filePath, itemJson);
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

    renderPptx(
        divHaftScale: HTMLDivElement,
        pptxData: PptxSlideType,
        virtualBackgroundColor: string | null,
    ) {
        const content = genPptxSlide(
            pptxData.html,
            pptxData.htmlFilePath,
            pptxData.metadata.width,
            pptxData.metadata.height,
        );
        // Give embedded video/audio native controls on the mini screen and
        // the play/pause/time sync wiring, mirroring regular slides.
        this.cleanupSlideContent(content);
        if (virtualBackgroundColor !== null) {
            content.style.backgroundColor = virtualBackgroundColor;
        }
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

    private readonly handleSlideMediaPlaying = async (event: Event) => {
        const mediaElement = event.currentTarget as HTMLMediaElement;
        handleMediaPlaying(event);
        if (mediaElement instanceof HTMLVideoElement) {
            this.setSlideVideoBadgeVisibility(mediaElement, false);
        }
        // Same rule as the background audio handlers: starting one slide's
        // media stops the media playing on other slides/screens. The
        // initiating manager is skipped so a slide that embeds both a video
        // and an audio (a PPTX renders its audio as a muted-less <video>) can
        // play them together. A group member's copy of this same element keeps
        // its screen driven by this instance, so its pause must not broadcast
        // a pause back to the group.
        const groupManagers = new Set(await this.getMemberInstances());
        groupManagers.add(this);
        for (const manager of ScreenVaryAppDocumentManager.getAllInstances()) {
            const div = manager.div;
            if (div === null || manager === this) {
                continue;
            }
            for (const media of queryAllDeep(div, 'video, audio')) {
                if (
                    media instanceof HTMLMediaElement === false ||
                    media === mediaElement ||
                    media.paused
                ) {
                    continue;
                }
                if (
                    groupManagers.has(manager) &&
                    media.id === mediaElement.id
                ) {
                    media.dataset.pausedByGroupSync = '1';
                }
                media.pause();
            }
        }
        void this.setSlideVideoCurrentTimeForce(
            mediaElement.id,
            mediaElement.currentTime,
            true,
        );
    };

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
            target = this.renderPptx(
                divHaftScale,
                itemJson as PptxSlideType,
                backgroundColor,
            );
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
}

export default ScreenVaryAppDocumentManager;
