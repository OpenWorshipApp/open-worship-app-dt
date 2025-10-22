import { MouseEvent, CSSProperties } from 'react';

import { DroppedDataType } from '../../helper/DragInf';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { SlideType } from '../../app-document-list/Slide';
import { genPdfSlide } from '../../app-document-presenter/items/PdfSlideRenderComp';
import { genSlideHtml } from '../../app-document-presenter/items/SlideRendererComp';
import { screenManagerSettingNames } from '../../helper/constants';
import ScreenEventHandler from './ScreenEventHandler';
import ScreenManagerBase from './ScreenManagerBase';
import ScreenEffectManager from './ScreenEffectManager';
import { getAppDocumentListOnScreenSetting } from '../preview/screenPreviewerHelpers';
import { toKeyByFilePath } from '../../app-document-list/appDocumentHelpers';
import PdfSlide, { PdfSlideType } from '../../app-document-list/PdfSlide';
import appProvider from '../../server/appProvider';
import { applyAttachBackground } from './screenBackgroundHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import {
    VaryAppDocumentItemDataType,
    VaryAppDocumentItemType,
} from '../../app-document-list/appDocumentTypeHelpers';
import {
    BasicScreenMessageType,
    ScreenMessageType,
} from '../screenTypeHelpers';
import { VaryAppDocumentItemScreenDataType } from '../screenAppDocumentTypeHelpers';

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
    private _varyAppDocumentItemData: VaryAppDocumentItemScreenDataType | null =
        null;
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
            this._varyAppDocumentItemData = allSlideList[this.key] ?? null;
        }
    }

    get isShowing() {
        return this.varyAppDocumentItemData !== null;
    }

    get div() {
        return this._div;
    }

    set div(div: HTMLDivElement | null) {
        this._div = div;
        this.render();
    }

    get varyAppDocumentItemData() {
        return this._varyAppDocumentItemData;
    }

    static get isPdfFullWidth() {
        return checkIsPdfFullWidth();
    }

    static set isPdfFullWidth(isFullWidth: boolean) {
        setIsPdfFullWidth(isFullWidth);
    }

    set varyAppDocumentItemData(
        appDocumentItemData: VaryAppDocumentItemScreenDataType | null,
    ) {
        if (
            this.screenManagerBase.checkIsLockedWithMessage() ||
            checkAreObjectsEqual(
                this._varyAppDocumentItemData,
                appDocumentItemData,
            )
        ) {
            return;
        }
        if (appDocumentItemData !== null && appDocumentItemData.itemJson) {
            applyAttachBackground(
                this.screenId,
                appDocumentItemData.filePath,
                appDocumentItemData.itemJson.id,
            );
        }
        this._varyAppDocumentItemData = appDocumentItemData;
        unlocking(screenManagerSettingNames.VARY_APP_DOCUMENT, () => {
            const allSlideList = getAppDocumentListOnScreenSetting();
            if (appDocumentItemData === null) {
                delete allSlideList[this.key];
            } else {
                allSlideList[this.key] = appDocumentItemData;
            }
            const string = JSON.stringify(allSlideList);
            setSetting(screenManagerSettingNames.VARY_APP_DOCUMENT, string);
            this.fireUpdateEvent();
        });
        this.render();
        this.sendSyncScreen();
    }

    toSyncMessage() {
        return {
            type: 'vary-app-document',
            data: this.varyAppDocumentItemData,
        } as BasicScreenMessageType;
    }

    receiveSyncScreen(message: ScreenMessageType) {
        this.varyAppDocumentItemData = message.data;
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenVaryAppDocumentManager.fireUpdateEvent();
    }

    static getDataList(filePath?: string, varyAppDocumentItemId?: number) {
        const dataList = getAppDocumentListOnScreenSetting();
        return Object.entries(dataList).filter(([_, data]) => {
            if (filePath !== undefined && data.filePath !== filePath) {
                return false;
            }
            if (
                varyAppDocumentItemId !== undefined &&
                data.itemJson.id !== varyAppDocumentItemId
            ) {
                return false;
            }
            return true;
        });
    }

    applySlideSrcWithSyncGroup(
        varyAppDocumentItemScreenData: VaryAppDocumentItemScreenDataType | null,
    ) {
        ScreenVaryAppDocumentManager.enableSyncGroup(this.screenId);
        this.varyAppDocumentItemData = varyAppDocumentItemScreenData;
    }

    toSlideData(
        filePath: string,
        itemJson: VaryAppDocumentItemDataType,
    ): VaryAppDocumentItemScreenDataType {
        return { filePath, itemJson };
    }

    handleSlideSelecting(
        filePath: string,
        itemJson: VaryAppDocumentItemDataType,
    ) {
        const { varyAppDocumentItemData } = this;
        const selectedFilePath = varyAppDocumentItemData?.filePath ?? '';
        const selectedSlideId = varyAppDocumentItemData?.itemJson.id ?? -1;
        const selected = toKeyByFilePath(selectedFilePath, selectedSlideId);
        const willSelected = toKeyByFilePath(filePath, itemJson.id);
        const newSlideData =
            selected !== willSelected
                ? this.toSlideData(filePath, itemJson)
                : null;
        this.applySlideSrcWithSyncGroup(newSlideData);
    }

    static async handleSlideSelecting(
        event: MouseEvent,
        filePath: string,
        itemJson: VaryAppDocumentItemDataType,
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

    renderPdf(divHaftScale: HTMLDivElement, pdfImageData: PdfSlideType) {
        if (!pdfImageData.imagePreviewSrc) {
            return null;
        }
        const isFullWidth = checkIsPdfFullWidth();
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
        });
        const scale = this.screenManagerBase.width / width;
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
        if (this.varyAppDocumentItemData === null) {
            this.clearJunk(div);
            return;
        }
        const divContainer = document.createElement('div');
        const divHaftScale = document.createElement('div');
        divContainer.appendChild(divHaftScale);
        const { itemJson } = this.varyAppDocumentItemData;

        const target = PdfSlide.tryValidate(itemJson)
            ? this.renderPdf(divHaftScale, itemJson as PdfSlideType)
            : this.renderAppDocument(divHaftScale, itemJson as SlideType);
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
        const item: VaryAppDocumentItemType = droppedData.item;
        this.varyAppDocumentItemData = {
            filePath: item.filePath,
            itemJson: item.toJson(),
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
