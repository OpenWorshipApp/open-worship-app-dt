import { CSSProperties } from 'react';

import { DragTypeEnum, DroppedDataType } from '../helper/DragInf';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { PdfImageDataType } from '../pdf/PdfController';
import SlideItem, { SlideItemType } from '../slide-list/SlideItem';
import { genPdfSlideItem } from '../slide-presenter/items/SlideItemPdfRender';
import { genHtmlSlideItem } from '../slide-presenter/items/SlideItemRenderer';
import appProviderScreen from './appProviderScreen';
import {
    BasicScreenMessageType, getSlideListOnScreenSetting, ScreenMessageType,
    SlideItemDataType,
} from './screenHelpers';
// TODO: cyclic dependency ScreenManager<->ScreenSlideManager
import ScreenTransitionEffect
    from './transition-effect/ScreenTransitionEffect';
import { TargetType } from './transition-effect/transitionEffectHelpers';
import { screenManagerSettingNames } from '../helper/constants';
import { chooseScreenManagerInstances } from './screenManagerHelpers';
import { unlocking } from '../server/appHelpers';
import ScreenEventHandler from './ScreenEventHandler';

export type ScreenSlideManagerEventType = 'update';

const PDF_FULL_WIDTH_SETTING_NAME = 'pdf-full-width';

export function checkIsPDFFullWidth() {
    const originalSettingName = getSetting(PDF_FULL_WIDTH_SETTING_NAME);
    return originalSettingName === 'true';
}
export function setIsPDFFullWidth(isPDFFullWidth: boolean) {
    setSetting(PDF_FULL_WIDTH_SETTING_NAME, `${isPDFFullWidth}`);
}

export default class ScreenSlideManager extends
    ScreenEventHandler<ScreenSlideManagerEventType> {

    static readonly eventNamePrefix: string = 'screen-slide-m';
    private _slideItemData: SlideItemDataType | null = null;
    private _div: HTMLDivElement | null = null;
    ptEffectTarget: TargetType = 'slide';

    constructor(screenId: number) {
        super(screenId);
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

    get ptEffect() {
        return ScreenTransitionEffect.getInstance(
            this.screenId, this.ptEffectTarget);
    }

    get slideItemData() {
        return this._slideItemData;
    }
    static get isPDFFullWidth() {
        return checkIsPDFFullWidth();
    }
    static set isPDFFullWidth(isFullWidth: boolean) {
        setIsPDFFullWidth(isFullWidth);
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
        this.applySlideItemSrcWithSyncGroup(
            selected !== willSelected ? {
                slideFilePath, slideItemJson,
            } : null
        );
    }

    static async handleSlideSelecting(
        event: React.MouseEvent<HTMLElement, MouseEvent>,
        slideFilePath: string, slideItemJson: SlideItemType,
        isForceChoosing = false,
    ) {
        const chosenScreenManagers = await chooseScreenManagerInstances(
            event, isForceChoosing,
        );
        chosenScreenManagers.forEach((screenManager) => {
            const { screenSlideManager } = screenManager;
            screenSlideManager.handleSlideSelecting(
                slideFilePath, slideItemJson,
            );
        });
    }

    renderPdf(div: HTMLDivElement, pdfImageData: PdfImageDataType) {
        Array.from(div.children).forEach((child) => {
            child.remove();
        });
        const isFullWidth = checkIsPDFFullWidth();
        const { src: pdfImageSrc } = pdfImageData;
        const content = genPdfSlideItem(pdfImageSrc, isFullWidth);
        const divContainer = document.createElement('div');
        Object.assign(divContainer.style, {
            width: '100%',
            height: '100%',
            overflow: isFullWidth ? 'auto' : 'hidden',
        });
        divContainer.appendChild(content);
        div.appendChild(divContainer);
    }

    renderHtml(div: HTMLDivElement, slideItemJson: SlideItemType) {
        const content = genHtmlSlideItem(slideItemJson.canvasItems);
        const divHaftScale = document.createElement('div');
        divHaftScale.appendChild(content);
        const parentWidth = this.screenManager.width;
        const parentHeight = this.screenManager.height;
        const width = slideItemJson.metadata.width;
        const height = slideItemJson.metadata.height;
        Object.assign(divHaftScale.style, {
            width: `${width}px`,
            height: `${height}px`,
            transform: 'translate(-50%, -50%)',
        });
        const scale = parentWidth / width;
        const divContainer = document.createElement('div');
        divContainer.appendChild(divHaftScale);
        Object.assign(divContainer.style, {
            position: 'absolute',
            width: `${parentWidth}px`,
            height: `${parentHeight}px`,
            transform: `scale(${scale},${scale}) translate(50%, 50%)`,
        });
        const childList = Array.from(div.children);
        div.appendChild(divContainer);
        this.ptEffect.styleAnim.animIn(divContainer).then(() => {
            childList.forEach((child) => {
                child.remove();
            });
            if (appProviderScreen.isScreen) {
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
        });
    }

    render() {
        if (this.div === null) {
            return;
        }
        if (this.slideItemData === null) {
            if (this.div.lastChild !== null) {
                const targetDiv = this.div.lastChild as HTMLDivElement;
                this.ptEffect.styleAnim.animOut(targetDiv).then(() => {
                    targetDiv.remove();
                });
            }
            return;
        }
        const { slideItemJson } = this.slideItemData;
        if (slideItemJson.pdfImageData) {
            this.renderPdf(this.div, slideItemJson.pdfImageData);
        } else {
            this.renderHtml(this.div, slideItemJson);
        }
    }

    get containerStyle(): CSSProperties {
        return {
            position: 'absolute',
            width: `${this.screenManager.width}px`,
            height: `${this.screenManager.height}px`,
            overflow: 'hidden',
        };
    }

    async receiveScreenDrag(droppedData: DroppedDataType) {
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
        const { screenSlideManager } = this.getScreenManager(screenId);
        screenSlideManager.receiveSyncScreen(message);
    }

    clear() {
        this.applySlideItemSrcWithSyncGroup(null);
    }
}
