import AppDocument from '../app-document-list/AppDocument';
import { setLyricAppDocumentGetter } from '../app-document-list/appDocumentHelpers';
import type Slide from '../app-document-list/Slide';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import type { MimetypeNameType } from '../server/fileHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import LyricSlide, { LYRIC_SLIDE_TYPE_KEY } from './LyricSlide';
import { HEX_COLOR_BLACK } from '../others/color/colorHelpers';
import { tran } from '../lang/langHelpers';
import {
    genHtmlDefaultProps,
    type CanvasItemHtmlPropsType,
} from '../slide-editor/canvas/CanvasItemHtml';
import { type SrcData } from '../helper/FileSource';
import { type CanvasItemImagePropsType } from '../slide-editor/canvas/CanvasItemImage';
import { type OpenLyric } from 'open-lyric';
import { type CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';

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

    get canvasItemBounds() {
        const { width: displayWidth, height: displayHeight } = this.displayDim;
        const padding = (displayWidth * this.slidePaddingPercentage) / 100;
        const x = Math.round(padding);
        const y = Math.round(padding);
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
        const canvasItemBounds = this.canvasItemBounds;
        const canvasItemProps: CanvasItemImagePropsType = {
            id,
            top: canvasItemBounds.y,
            left: canvasItemBounds.x,
            rotate: 0,
            width: canvasItemBounds.width,
            height: canvasItemBounds.height,
            backgroundColor: `${HEX_COLOR_BLACK}00`,
            backdropFilter: 0,
            roundSizePercentage: 0,
            roundSizePixel: 0,
            type: 'image',
            locked: false,
            srcData,
            mediaWidth: canvasItemBounds.width,
            mediaHeight: canvasItemBounds.height,
        };
        return canvasItemProps;
    }

    genCanvasItemHtmlProps(id: number, html: string) {
        const canvasItemBounds = this.canvasItemBounds;
        const canvasItemProps: CanvasItemHtmlPropsType = {
            id,
            ...genHtmlDefaultProps(),
            top: canvasItemBounds.y,
            left: canvasItemBounds.x,
            rotate: 0,
            width: canvasItemBounds.width,
            height: canvasItemBounds.height,
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

    // Single construction point for every LyricSlide. `displayDim` hits
    // `getDefaultScreenDisplay()` on each read, so callers building a whole song
    // pass it in once instead of paying for it per slide.
    genLyricSlide(
        id: number,
        openLyricKey: string,
        canvasItems: CanvasItemPropsType[],
        displayDim = this.displayDim,
    ) {
        return new LyricSlide(
            this.filePath,
            {
                id,
                canvasItems,
                metadata: {
                    width: displayDim.width,
                    height: displayDim.height,
                },
                type: LYRIC_SLIDE_TYPE_KEY,
                stage: this.stage,
            },
            openLyricKey,
        );
    }

    genSlide(
        key: string,
        i: number,
        dataMap: Record<string, string>,
        displayDim = this.displayDim,
    ) {
        const srcData = dataMap[key];
        const canvasItemProps = this.genCanvasItemHtmlProps(
            i,
            typeof srcData === 'string' ? srcData : '',
        );
        return this.genLyricSlide(i, key, [canvasItemProps], displayDim);
    }

    extendExtraSlide(
        slides: LyricSlide[],
        dataMap: Record<string, string>,
        firstCanvasItemProps: CanvasItemPropsType | null = null,
    ) {
        const displayDim = this.displayDim;
        const extraSlides: LyricSlide[] = [
            this.genLyricSlide(
                0,
                'Info',
                firstCanvasItemProps === null ? [] : [firstCanvasItemProps],
                displayDim,
            ),
            this.genSlide('Info', 1, dataMap, displayDim),
            this.genLyricSlide(2, OPEN_LYRIC_NONE_KEY, [], displayDim),
        ];
        const newSlides = [...extraSlides, ...slides].map((slide, i) => {
            slide.id = i;
            return slide;
        });
        return newSlides;
    }

    async getOpenLyricPreviewer() {
        if (this.openLyric !== null) {
            return this.openLyric;
        }
        // Imported dynamically to keep this module out of the
        // `lyricHelpers → LyricAppDocumentStage0 → LyricAppDocumentStageAbstract
        // → LyricAppDocument` cycle. With a static import, any load order that
        // starts at `LyricAppDocument` re-enters the cycle and the stage class
        // dies on `class ... extends <TDZ>` ("Cannot access 'LyricAppDocument'
        // before initialization"). This is the only thing it needed from there.
        const { initOpenLyric } = await import('./lyricHelpers');
        const openLyric = await initOpenLyric(this.filePath, true);
        return openLyric;
    }

    async getSlidesQuick() {
        const openLyricPreviewer = await this.getOpenLyricPreviewer();
        const structure = openLyricPreviewer.getStructure();
        const displayDim = this.displayDim;
        const slides = structure.map((key, i) => {
            return this.genLyricSlide(i, key, [], displayDim);
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

// `appDocumentHelpers` cannot import this module (the `extends AppDocument`
// cycle), so the dependency is inverted: importing this module is what teaches
// `varyAppDocumentFromFilePath` how to resolve a `.owl` path.
setLyricAppDocumentGetter((filePath: string) => {
    return LyricAppDocument.getInstance(filePath);
});
