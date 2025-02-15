import { CSSProperties } from 'react';

import { DragTypeEnum, DroppedDataType } from '../../helper/DragInf';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import SlideItem, { SlideItemType } from '../../slide-list/SlideItem';
import {
    genPdfSlideItem,
} from '../../slide-presenter/items/SlideItemPdfRender';
import {
    genHtmlSlideItem,
} from '../../slide-presenter/items/SlideItemRenderer';
import appProviderScreen from '../appProviderScreen';
import {
    BasicScreenMessageType, ScreenMessageType, SlideItemDataType,
} from '../screenHelpers';
import { screenManagerSettingNames } from '../../helper/constants';
import { unlocking } from '../../server/appHelpers';
import ScreenEventHandler from './ScreenEventHandler';
import ScreenManagerBase from './ScreenManagerBase';
import ScreenEffectManager from './ScreenEffectManager';
import { getSlideListOnScreenSetting } from '../preview/screenPreviewerHelpers';

export type ScreenSlideManagerEventType = 'update';

const PDF_FULL_WIDTH_SETTING_NAME = 'pdf-full-width';

export function checkIsPdfFullWidth() {
    const originalSettingName = getSetting(PDF_FULL_WIDTH_SETTING_NAME);
    return originalSettingName === 'true';
}
export function setIsPdfFullWidth(isPdfFullWidth: boolean) {
    setSetting(PDF_FULL_WIDTH_SETTING_NAME, `${isPdfFullWidth}`);
}

export default class ScreenSlideManager extends
    ScreenEventHandler<ScreenSlideManagerEventType> {

    static readonly eventNamePrefix: string = 'screen-slide-m';
    private _slideItemData: SlideItemDataType | null = null;
    private _div: HTMLDivElement | null = null;
    slideEffectManager: ScreenEffectManager;

    constructor(
        screenManagerBase: ScreenManagerBase,
        slideEffectManager: ScreenEffectManager,
    ) {
        super(screenManagerBase);
        this.slideEffectManager = slideEffectManager;
        if (appProviderScreen.isPagePresenter) {
            const allSlideList = getSlideListOnScreenSetting();
            this._slideItemData = allSlideList[this.key] || null;
        }
    }

    get isShowing() {
        return this.slideItemData !== null;
    }

    get div() {
        return this._div;
    }

    set div(div: HTMLDivElement | null) {
        this._div = div;
        this.render();
    }

    get slideItemData() {
        return this._slideItemData;
    }
    static get isPdfFullWidth() {
        return checkIsPdfFullWidth();
    }
    static set isPdfFullWidth(isFullWidth: boolean) {
        setIsPdfFullWidth(isFullWidth);
    }
    set slideItemData(slideItemData: SlideItemDataType | null) {
        this._slideItemData = slideItemData;
        unlocking(screenManagerSettingNames.SLIDE, () => {
            const allSlideList = getSlideListOnScreenSetting();
            if (slideItemData === null) {
                delete allSlideList[this.key];
            } else {
                allSlideList[this.key] = slideItemData;
            }
            const string = JSON.stringify(allSlideList);
            setSetting(screenManagerSettingNames.SLIDE, string);
        });
        this.render();
        this.sendSyncScreen();
        this.fireUpdateEvent();
    }

    toSyncMessage() {
        return {
            type: 'slide',
            data: this.slideItemData,
        } as BasicScreenMessageType;
    }

    receiveSyncScreen(message: ScreenMessageType) {
        this.slideItemData = message.data;
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenSlideManager.fireUpdateEvent();
    }

    static getDataList(slideFilePath?: string, slideItemId?: number) {
        const dataList = getSlideListOnScreenSetting();
        return Object.entries(dataList).filter(([_, data]) => {
            if (
                slideFilePath !== undefined &&
                data.slideFilePath !== slideFilePath
            ) {
                return false;
            }
            if (
                slideItemId !== undefined &&
                data.slideItemJson.id !== slideItemId
            ) {
                return false;
            }
            return true;
        });
    }

    applySlideItemSrcWithSyncGroup(slideItemData: SlideItemDataType | null) {
        ScreenSlideManager.enableSyncGroup(this.screenId);
        this.slideItemData = slideItemData;
    }

    toSlideItemData(
        slideFilePath: string, slideItemJson: SlideItemType,
    ): SlideItemDataType {
        return { slideFilePath, slideItemJson };
    }

    handleSlideSelecting(slideFilePath: string, slideItemJson: SlideItemType) {
        const { slideItemData } = this;
        const selectedSlideFilePath = slideItemData?.slideFilePath ?? '';
        const selectedSlideItemId = slideItemData?.slideItemJson.id ?? '';
        const selected = (
            `${selectedSlideFilePath}${SlideItem.KEY_SEPARATOR}` +
            `${selectedSlideItemId}`
        );
        const willSelected = (
            `${slideFilePath}${SlideItem.KEY_SEPARATOR}${slideItemJson.id}`
        );
        const newSlideData = selected !== willSelected ? this.toSlideItemData(
            slideFilePath, slideItemJson,
        ) : null;
        this.applySlideItemSrcWithSyncGroup(newSlideData);
    }

    static async handleSlideSelecting(
        event: React.MouseEvent<HTMLElement, MouseEvent>,
        slideFilePath: string, slideItemJson: SlideItemType,
        isForceChoosing = false,
    ) {
        const screenIds = await this.chooseScreenIds(event, isForceChoosing);
        screenIds.forEach((screenId) => {
            const screenSlideManager = this.getInstance(screenId);
            screenSlideManager.handleSlideSelecting(
                slideFilePath, slideItemJson,
            );
        });
    }

    renderPdf(divHaftScale: HTMLDivElement, pdfImageData: SlideItemType) {
        if (!pdfImageData.imagePreviewSrc) {
            return null;
        }
        const isFullWidth = checkIsPdfFullWidth();
        const content = genPdfSlideItem(
            pdfImageData.imagePreviewSrc, isFullWidth,
        );
        const parentWidth = this.screenManagerBase.width;
        const width = parentWidth;
        Object.assign(divHaftScale.style, {
            width: '100%', height: '100%',
            overflow: isFullWidth ? 'auto' : 'hidden',
            transform: 'translate(-50%, -50%)',
        });
        const scale = parentWidth / width;
        return { content, scale };
    }

    cleanupSlideContent(content: HTMLDivElement) {
        if (!appProviderScreen.isScreen) {
            return;
        }
        Array.from(content.children).forEach((child) => {
            child.querySelectorAll('svg').forEach((svg) => {
                svg.style.display = 'none';
            });
            child.querySelectorAll('video').forEach((video) => {
                video.loop = false;
                video.muted = false;
                video.play();
            });
        });
    }

    renderHtml(divHaftScale: HTMLDivElement, slideItemJson: SlideItemType) {
        const content = genHtmlSlideItem(slideItemJson.canvasItems);
        this.cleanupSlideContent(content);
        const { width, height } = slideItemJson.metadata;
        Object.assign(divHaftScale.style, {
            width: `${width}px`, height: `${height}px`,
            transform: 'translate(-50%, -50%)',
        });
        const scale = this.screenManagerBase.width / width;
        return { content, scale };
    }

    async clearJung(div: HTMLDivElement) {
        if (div.lastChild === null) {
            return;
        }
        const targetDiv = div.lastChild as HTMLDivElement;
        await this.slideEffectManager.styleAnim.animOut(targetDiv);
        targetDiv.remove();
    }

    render() {
        if (this.div === null) {
            return;
        }
        const div = this.div;
        if (this.slideItemData === null) {
            this.clearJung(div);
            return;
        }
        const divContainer = document.createElement('div');
        const divHaftScale = document.createElement('div');
        divContainer.appendChild(divHaftScale);
        const { slideItemJson } = this.slideItemData;

        const target = (
            slideItemJson.isPdf ? this.renderPdf(
                divHaftScale, slideItemJson,
            ) : this.renderHtml(divHaftScale, slideItemJson)
        );
        if (target === null) {
            return;
        }
        Array.from(div.children).forEach(async (child) => {
            await this.slideEffectManager.styleAnim.animOut(
                child as HTMLDivElement,
            );
            child.remove();
        });
        div.appendChild(divContainer);
        divHaftScale.appendChild(target.content);
        Object.assign(divContainer.style, {
            position: 'absolute',
            width: `${this.screenManagerBase.width}px`,
            height: `${this.screenManagerBase.height}px`,
            transform: (
                `scale(${target.scale},${target.scale}) translate(50%, 50%)`
            ),
        });
        this.slideEffectManager.styleAnim.animIn(divContainer);
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
        if (droppedData.type === DragTypeEnum.SLIDE_ITEM) {
            const slideItem = droppedData.item as SlideItem;
            this.slideItemData = {
                slideFilePath: slideItem.filePath,
                slideItemJson: slideItem.toJson(),
            };
        }
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenSlideManager = this.getInstance(screenId);
        screenSlideManager.receiveSyncScreen(message);
    }

    clear() {
        this.applySlideItemSrcWithSyncGroup(null);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenSlideManager>(screenId);
    }
}
