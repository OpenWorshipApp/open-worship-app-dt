import AppDocument from '../app-document-list/AppDocument';
import {
    genEditSlideContextMenuItem,
    setLyricAppDocumentGetter,
} from '../app-document-list/appDocumentHelpers';
import type Slide from '../app-document-list/Slide';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import type { MimetypeNameType } from '../server/fileHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import LyricSlide, { LYRIC_SLIDE_TYPE_KEY } from './LyricSlide';
import type { AppColorType } from '../others/color/colorHelpers';
import { HEX_COLOR_BLACK } from '../others/color/colorHelpers';
import { tran } from '../lang/langHelpers';
import {
    genHtmlDefaultProps,
    type CanvasItemHtmlPropsType,
} from '../slide-editor/canvas/CanvasItemHtml';
import { type SrcData } from '../helper/FileSource';
import { type CanvasItemImagePropsType } from '../slide-editor/canvas/CanvasItemImage';
import { type OpenLyric } from 'open-lyric';
import {
    type CanvasItemBoxPropsType,
    type CanvasItemPropsType,
} from '../slide-editor/canvas/CanvasItem';
import { getLyricStageStyle } from './lyricStageStyleHelpers';
import { openPopupLyricEditorWindow } from './lyricEditorHelpers';
import Lyric from './Lyric';

export const OPEN_LYRIC_NONE_KEY = 'None';
export const OPEN_LYRIC_FIRST_KEY = 'First';
export const OPEN_LYRIC_INFO_KEY = 'Info';

export default class LyricAppDocument extends AppDocument {
    static readonly mimetypeName: MimetypeNameType = 'lyricAppDocument';
    public isEditable = false;

    public openLyric: OpenLyric | null = null;

    /**
     * How this stage renders its slides — padding, background opacity, font
     * boost, theme and the operator's own CSS.
     *
     * These were four hard-coded fields nobody ever assigned, so every song on
     * every stage looked the same. Reading the setting here is what lets the
     * Stage Previewer's gear panel restyle a stage.
     *
     * A GETTER, not a field, and that is load-bearing: `stage` below is a class
     * FIELD that `LyricAppDocumentStage1` OVERRIDES with its own. Derived-class
     * fields initialize AFTER the base's, so a base-class field initializer
     * reading `this.stage` would see `0` even on a stage-1 instance and every
     * stage would silently share stage 0's style. A getter is evaluated at call
     * time instead. Nothing in this hierarchy reads it during construction (no
     * constructor body touches it, and `canvasItemBounds` /
     * `basicOpenLyricOptions` are getters too) — keep it that way.
     */
    get stageStyle() {
        return getLyricStageStyle(this.stage);
    }

    stage = 0;

    get displayDim() {
        const display = getDefaultScreenDisplay();
        return { width: display.bounds.width, height: display.bounds.height };
    }

    get canvasItemBounds() {
        const { width: displayWidth, height: displayHeight } = this.displayDim;
        const padding =
            (displayWidth * this.stageStyle.paddingPercentage) / 100;
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

    // The box every lyric canvas item gets: it fills the slide's content
    // bounds, so nothing is ever measured or positioned per item. `canvasItemBounds`
    // reads `displayDim` twice and each read hits `getDefaultScreenDisplay()`,
    // so callers building several items in a row pass it in once (same reason
    // as `genLyricSlide`'s `displayDim` parameter).
    genCanvasItemBoundsProps(
        id: number,
        locked: boolean,
        canvasItemBounds = this.canvasItemBounds,
    ): CanvasItemBoxPropsType {
        return {
            id,
            top: canvasItemBounds.y,
            left: canvasItemBounds.x,
            rotate: 0,
            width: canvasItemBounds.width,
            height: canvasItemBounds.height,
            backgroundColor: `${HEX_COLOR_BLACK}00` as AppColorType,
            backdropFilter: 0,
            roundSizePercentage: 0,
            roundSizePixel: 0,
            locked,
        };
    }

    genCanvasItemImageProps(id: number, srcData: SrcData) {
        const canvasItemBounds = this.canvasItemBounds;
        const canvasItemProps: CanvasItemImagePropsType = {
            ...this.genCanvasItemBoundsProps(id, false, canvasItemBounds),
            type: 'image',
            srcData,
            mediaWidth: canvasItemBounds.width,
            mediaHeight: canvasItemBounds.height,
        };
        return canvasItemProps;
    }

    genCanvasItemHtmlProps(id: number, html: string) {
        const canvasItemProps: CanvasItemHtmlPropsType = {
            ...genHtmlDefaultProps(),
            ...this.genCanvasItemBoundsProps(id, true),
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
                OPEN_LYRIC_FIRST_KEY,
                firstCanvasItemProps === null ? [] : [firstCanvasItemProps],
                displayDim,
            ),
            this.genSlide(OPEN_LYRIC_INFO_KEY, 1, dataMap, displayDim),
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
        const menuItems: ContextMenuItemType[] = [
            genEditSlideContextMenuItem(() => {
                openPopupLyricEditorWindow(
                    Lyric.getInstance(slide.filePath),
                    slide.id,
                );
            }),
            ...menuItemOnScreens,
            ...extraMenuItems,
        ];
        showAppContextMenu(event, menuItems);
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
