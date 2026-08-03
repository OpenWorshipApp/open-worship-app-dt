import AppDocument from '../app-document-list/AppDocument';
import type Slide from '../app-document-list/Slide';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import type { MimetypeNameType } from '../server/fileHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import LyricSlide from './LyricSlide';
import { HEX_COLOR_BLACK } from '../others/color/colorHelpers';
import { tran } from '../lang/langHelpers';
import {
    genHtmlDefaultProps,
    type CanvasItemHtmlPropsType,
} from '../slide-editor/canvas/CanvasItemHtml';
import { type SrcData } from '../helper/FileSource';
import { type CanvasItemImagePropsType } from '../slide-editor/canvas/CanvasItemImage';
import { initOpenLyric, LYRIC_SLIDE_TYPE_KEY } from './lyricHelpers';
import { type OpenLyric } from 'open-lyric';

export const OPEN_LYRIC_NONE_KEY = 'None';

export default class LyricAppDocument extends AppDocument {
    static readonly mimetypeName: MimetypeNameType = 'lyricAppDocument';
    public openLyric: OpenLyric | null = null;
    public isEditable = false;
    public slidePaddingPercentage = 1;
    public slideBackgroundAlpha: number = 0.5;
    public extraSlideFontSize: number = 45;
    public slideTheme: 'light' | 'dark' = 'light';
    stage = 0;

    get displayDim() {
        const display = getDefaultScreenDisplay();
        return { width: display.bounds.width, height: display.bounds.height };
    }

    get slideBounds() {
        const { width: displayWidth, height: displayHeight } = this.displayDim;
        const padding = (displayWidth * this.slidePaddingPercentage) / 100;
        const x = padding;
        const y = (displayHeight * this.slidePaddingPercentage) / 100;
        const width = Math.round(displayWidth - padding * 2);
        const height = Math.round(displayHeight - padding * 2);
        return {
            x,
            y,
            width,
            height,
        };
    }

    genCanvasItemImageProps(id: number, srcData: SrcData) {
        const slideBounds = this.slideBounds;
        const canvasItemProps: CanvasItemImagePropsType = {
            id,
            top: slideBounds.y,
            left: slideBounds.x,
            rotate: 0,
            width: slideBounds.width,
            height: slideBounds.height,
            backgroundColor: `${HEX_COLOR_BLACK}00`,
            backdropFilter: 0,
            roundSizePercentage: 0,
            roundSizePixel: 0,
            type: 'image',
            locked: false,
            srcData,
            mediaWidth: slideBounds.width,
            mediaHeight: slideBounds.height,
        };
        return canvasItemProps;
    }

    genCanvasItemHtmlProps(id: number, html: string) {
        const slideBounds = this.slideBounds;
        const canvasItemProps: CanvasItemHtmlPropsType = {
            id,
            ...genHtmlDefaultProps(),
            top: slideBounds.y,
            left: slideBounds.x,
            rotate: 0,
            width: slideBounds.width,
            height: slideBounds.height,
            backgroundColor: `${HEX_COLOR_BLACK}00`,
            backdropFilter: 0,
            roundSizePercentage: 0,
            roundSizePixel: 0,
            locked: true,
            html,
            type: 'html',
        };
        return canvasItemProps;
    }

    genSlide(key: string, i: number, dataMap: Record<string, string>) {
        const displayDim = this.displayDim;
        let srcData = dataMap[key];
        if (typeof srcData !== 'string') {
            srcData = '';
        }
        const canvasItemProps = this.genCanvasItemHtmlProps(i, srcData);
        return new LyricSlide(
            this.filePath,
            {
                id: i,
                canvasItems: [canvasItemProps],
                metadata: {
                    width: displayDim.width,
                    height: displayDim.height,
                    uuid: i.toString(),
                } as any,
                type: LYRIC_SLIDE_TYPE_KEY,
                stage: this.stage,
            },
            key,
        );
    }

    extendExtraSlide(
        slides: LyricSlide[],
        dataMap: Record<string, string>,
        firstCanvasItemProps: CanvasItemHtmlPropsType | null = null,
    ) {
        const displayDim = this.displayDim;
        const extraSlides: LyricSlide[] = [
            new LyricSlide(
                this.filePath,
                {
                    id: 0,
                    canvasItems:
                        firstCanvasItemProps === null
                            ? []
                            : [firstCanvasItemProps],
                    metadata: {
                        width: displayDim.width,
                        height: displayDim.height,
                        uuid: '0',
                    } as any,
                    type: LYRIC_SLIDE_TYPE_KEY,
                    stage: this.stage,
                },
                'Info',
            ),
            this.genSlide('Info', 1, dataMap),
            new LyricSlide(
                this.filePath,
                {
                    id: 2,
                    canvasItems: [],
                    metadata: {
                        width: displayDim.width,
                        height: displayDim.height,
                        uuid: '0',
                    } as any,
                    type: LYRIC_SLIDE_TYPE_KEY,
                    stage: this.stage,
                },
                OPEN_LYRIC_NONE_KEY,
            ),
        ];
        return [...extraSlides, ...slides].map((slide, i) => {
            slide.id = i;
            return slide;
        });
    }

    async getOpenLyricPreviewer() {
        if (this.openLyric !== null) {
            return this.openLyric;
        }
        const openLyric = await initOpenLyric(this.filePath, true);
        return openLyric;
    }

    async getSlidesQuick() {
        const openLyricPreviewer = await this.getOpenLyricPreviewer();
        const structure = openLyricPreviewer.getStructure();
        const slides = structure.map((key, i) => {
            return new LyricSlide(
                this.filePath,
                {
                    id: i,
                    canvasItems: [],
                    metadata: {
                        width: this.displayDim.width,
                        height: this.displayDim.height,
                        uuid: i.toString(),
                    } as any,
                    type: LYRIC_SLIDE_TYPE_KEY,
                    stage: this.stage,
                },
                key,
            );
        });
        return this.extendExtraSlide(slides, {});
    }
    async getSlides() {
        return this.getSlidesQuick();
    }

    async showContextMenu(event: any) {
        const menuItems: ContextMenuItemType[] = [
            {
                menuElement: tran('Reload'),
                onSelect: () => {
                    this.fileSource.fireUpdateEvent();
                },
            },
        ];
        showAppContextMenu(event, menuItems);
    }

    showSlideContextMenu(
        event: any,
        slide: Slide,
        extraMenuItems: ContextMenuItemType[] = [],
    ) {
        const menuItemOnScreens = genShowOnScreensContextMenu((event) => {
            ScreenVaryAppDocumentManager.handleSlideSelecting(
                event,
                slide.filePath,
                slide.toJson(),
                true,
            );
        });
        showAppContextMenu(event, [...menuItemOnScreens, ...extraMenuItems]);
    }

    async save(): Promise<boolean> {
        throw new Error('LyricAppDocument does not support saving slides.');
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }
}
