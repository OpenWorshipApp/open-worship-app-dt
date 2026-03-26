import type { MouseEvent, CSSProperties } from 'react';

import type { DroppedDataType } from '../../helper/DragInf';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import type { SlideType } from '../../app-document-list/Slide';
import { genPdfSlide } from '../../app-document-presenter/items/PdfSlideRenderComp';
import { genPptxSlide } from '../../app-document-presenter/items/PptxSlideRenderComp';
import { genSlideHtml } from '../../app-document-presenter/items/SlideRendererComp';
import { screenManagerSettingNames } from '../../helper/constants';
import ScreenEventHandler from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import type ScreenEffectManager from './ScreenEffectManager';
import { getAppDocumentListOnScreenSetting } from '../preview/screenPreviewerHelpers';
import { toKeyByFilePath } from '../../app-document-list/appDocumentHelpers';
import type { PdfSlideType } from '../../app-document-list/PdfSlide';
import PdfSlide from '../../app-document-list/PdfSlide';
import type { PptxSlideType } from '../../app-document-list/PptxSlide';
import PptxSlide from '../../app-document-list/PptxSlide';
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
import { registerScrollingSyncEvent } from './screenEventHelpers';

export type ScreenVaryAppDocumentManagerEventType = 'update';

const PDF_FULL_WIDTH_SETTING_NAME = 'pdf-full-width';

export function checkIsPdfFullWidth() {
    const originalSettingName = getSetting(PDF_FULL_WIDTH_SETTING_NAME);
    return originalSettingName === 'true';
}
export function setIsPdfFullWidth(isPdfFullWidth: boolean) {
    setSetting(PDF_FULL_WIDTH_SETTING_NAME, `${isPdfFullWidth}`);
}

class ScreenVaryAppDocumentManager extends ScreenEventHandler<ScreenVaryAppDocumentManagerEventType> {
    static readonly eventNamePrefix: string = 'screen-vary-app-document-m';
    private _varySlideData: VarySlideScreenDataType | null = null;
    private _div: HTMLDivElement | null = null;
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
        return { filePath, itemJson, isPdfFullWidth: checkIsPdfFullWidth() };
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
    ) {
        if (!pdfImageData.imagePreviewSrc) {
            return null;
        }
        const content = genPdfSlide(pdfImageData.imagePreviewSrc, isFullWidth);
        const parentWidth = this.screenManagerBase.width;
        const width = parentWidth;
        Object.assign(divHaftScale.style, {
            width: '100%',
            height: '100%',
            overflow: isFullWidth ? 'auto' : 'hidden',
            transform: 'translate(-50%, -50%)',
        });
        const scale = parentWidth / width;
        return { content, scale };
    }

    renderPptx(divHaftScale: HTMLDivElement, pptxData: PptxSlideType) {
        const content = genPptxSlide(
            pptxData.htmlFilePath,
            pptxData.metadata.width,
            pptxData.metadata.height,
        );
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

    cleanupSlideContent(content: HTMLDivElement) {
        if (!appProvider.isPageScreen) {
            return;
        }
        for (const child of Array.from(content.children)) {
            for (const svg of child.querySelectorAll('svg')) {
                svg.style.display = 'none';
            }
            for (const video of child.querySelectorAll('video')) {
                video.loop = false;
                video.muted = false;
                video.play();
            }
        }
    }

    renderAppDocument(divHaftScale: HTMLDivElement, itemJson: SlideType) {
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

    render() {
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

        const { itemJson, isPdfFullWidth } = this.varySlideData;

        let target;
        if (PdfSlide.tryValidate(itemJson)) {
            target = this.renderPdf(
                divHaftScale,
                itemJson as PdfSlideType,
                isPdfFullWidth,
            );
        } else if (PptxSlide.tryValidate(itemJson)) {
            target = this.renderPptx(divHaftScale, itemJson as PptxSlideType);
        } else {
            target = this.renderAppDocument(
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
        this.varySlideData = {
            filePath: item.filePath,
            itemJson: item.toJson(),
            isPdfFullWidth: checkIsPdfFullWidth(),
        };
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenVaryAppDocumentManager = this.getInstance(screenId);
        screenVaryAppDocumentManager.receiveSyncScreen(message);
    }

    clear() {
        this.applySlideSrcWithSyncGroup(null);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenVaryAppDocumentManager>(screenId);
    }
}

export default ScreenVaryAppDocumentManager;
