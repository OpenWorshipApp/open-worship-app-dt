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
import { type LyricGrowRoomType } from './lyricBoxGrowHelpers';
import { resolveLiveOpenLyric } from './lyricWarmSlidesHelpers';
import { genLyricReloadContextMenuItem } from './lyricContextMenuHelpers';
import { openPopupLyricEditorWindow } from './lyricEditorHelpers';
import Lyric from './Lyric';
import {
    expandLyricAtomSteps,
    genLyricPlaySteps,
    type LyricLineType,
    type LyricRepeatType,
} from './lyricStructureHelpers';
import {
    getIsLyricAtomMode,
    getLyricAtomLineCounts,
} from './lyricAtomModeHelpers';

// Where the box starts along one axis, given the room left beside it (the
// whole margin of that axis): flush at the start, flush at the end, or
// centred. Anything unknown is centred, the default.
function toBoxOffset(alignment: string | undefined, room: number) {
    if (alignment === 'start' || alignment === 'left') {
        return 0;
    }
    if (alignment === 'end' || alignment === 'right') {
        return room;
    }
    return room / 2;
}

export const OPEN_LYRIC_NONE_KEY = 'None';
export const OPEN_LYRIC_FIRST_KEY = 'First';
export const OPEN_LYRIC_INFO_KEY = 'Info';

export default class LyricAppDocument extends AppDocument {
    static readonly mimetypeName: MimetypeNameType = 'lyricAppDocument';
    public isEditable = false;

    public openLyric: OpenLyric | null = null;

    /**
     * How this stage renders its slides — margin, background opacity, font
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

    /**
     * Every line of a part its own slide (`lyricAtomModeHelpers`). One setting
     * for every song and stage, read at call time like `stageStyle`.
     */
    get isAtomMode() {
        return getIsLyricAtomMode();
    }

    /**
     * The song's play order as this document's slides stand for it: one step
     * per Structure step (`genLyricPlaySteps`), and in Atom Mode one per LINE
     * of each step's part. The full deck and the quick list both build from
     * this, which is what keeps an id meaning the same slide in both.
     */
    async genPlaySteps(
        openLyricPreviewer: OpenLyric,
        isAtomMode = this.isAtomMode,
    ) {
        const playSteps = genLyricPlaySteps(openLyricPreviewer);
        if (!isAtomMode) {
            return playSteps;
        }
        const lineCounts = await getLyricAtomLineCounts(openLyricPreviewer);
        return expandLyricAtomSteps(playSteps, lineCounts);
    }

    get displayDim() {
        const display = getDefaultScreenDisplay();
        return { width: display.bounds.width, height: display.bounds.height };
    }

    get canvasItemBounds() {
        const { width: displayWidth, height: displayHeight } = this.displayDim;
        const stageStyle = this.stageStyle;
        // Each margin is the share of its own axis left outside the box (see
        // `LyricStageStyleType`), so the box is never bigger than the slide
        // and never negative, whatever the slider says.
        const boxWidth =
            (displayWidth * (100 - stageStyle.marginHorizontalPercentage)) /
            100;
        const boxHeight =
            (displayHeight * (100 - stageStyle.marginVerticalPercentage)) / 100;
        // The margins give the box its SIZE, which Position never changes;
        // it only moves it. Middle center (the default) splits the margin
        // evenly; any other cell slides the same box until it touches the
        // edge(s) the cell names. Only `x` / `y` move, so the open-lyric
        // render (sized by `width` / `height`) is never redone.
        const x = Math.round(
            toBoxOffset(
                stageStyle.boxHorizontalAlignment,
                displayWidth - boxWidth,
            ),
        );
        const y = Math.round(
            toBoxOffset(
                stageStyle.boxVerticalAlignment,
                displayHeight - boxHeight,
            ),
        );
        const width = Math.round(boxWidth);
        const height = Math.round(boxHeight);
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

    // `canvasItemBounds` for the same reason as `genCanvasItemBoundsProps`'s:
    // a whole song builds one of these per verse, and per look-ahead box.
    // `lyricGrowRoom` only for a part drawn in the stage's own box, never for
    // a look-ahead box laid beside others.
    genCanvasItemHtmlProps(
        id: number,
        html: string,
        canvasItemBounds = this.canvasItemBounds,
        lyricGrowRoom?: LyricGrowRoomType,
    ) {
        const canvasItemProps: CanvasItemHtmlPropsType = {
            ...genHtmlDefaultProps(),
            ...this.genCanvasItemBoundsProps(id, true, canvasItemBounds),
            html,
            type: 'html',
        };
        if (lyricGrowRoom !== undefined) {
            canvasItemProps.lyricGrowRoom = lyricGrowRoom;
        }
        return canvasItemProps;
    }

    /**
     * The slide left above and below the stage's box: a part taller than the
     * box grows into it (`lyricBoxGrowHelpers`), so the stage's Position
     * decides which way -- up from the bottom, down from the top, both ways
     * from the centre -- and the slide's edge is the limit.
     */
    genLyricGrowRoom(
        displayDim: { height: number },
        canvasItemBounds: { y: number; height: number },
    ): LyricGrowRoomType {
        return {
            up: Math.max(0, canvasItemBounds.y),
            down: Math.max(
                0,
                displayDim.height -
                    canvasItemBounds.y -
                    canvasItemBounds.height,
            ),
        };
    }

    // Single construction point for every LyricSlide. `displayDim` hits
    // `getDefaultScreenDisplay()` on each read, so callers building a whole song
    // pass it in once instead of paying for it per slide. `openLyricIndex`,
    // `openLyricRepeat` and `openLyricLine` are last because only the slides
    // that stand for a verse of the song have them — everything else takes
    // the defaults.
    genLyricSlide(
        id: number,
        openLyricKey: string,
        canvasItems: CanvasItemPropsType[],
        displayDim = this.displayDim,
        openLyricIndex = -1,
        openLyricRepeat: LyricRepeatType | null = null,
        openLyricLine: LyricLineType | null = null,
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
            openLyricIndex,
            openLyricRepeat,
            openLyricLine,
        );
    }

    // `srcData` is the part's markup unless the caller hands a piece of it --
    // one LINE of the part, in Atom Mode.
    genSlide(
        key: string,
        i: number,
        dataMap: Record<string, string>,
        displayDim = this.displayDim,
        openLyricIndex = -1,
        openLyricRepeat: LyricRepeatType | null = null,
        canvasItemBounds = this.canvasItemBounds,
        openLyricLine: LyricLineType | null = null,
        srcData: unknown = dataMap[key],
    ) {
        const canvasItemProps = this.genCanvasItemHtmlProps(
            i,
            typeof srcData === 'string'
                ? this.genSlideHtml(
                      srcData,
                      key,
                      openLyricIndex,
                      openLyricRepeat,
                      openLyricLine,
                  )
                : '',
            canvasItemBounds,
            this.genLyricGrowRoom(displayDim, canvasItemBounds),
        );
        return this.genLyricSlide(
            i,
            key,
            [canvasItemProps],
            displayDim,
            openLyricIndex,
            openLyricRepeat,
            openLyricLine,
        );
    }

    // The part's markup as ONE slide shows it. `dataMap` is the cached
    // whole-song render shared by every play of a part, so anything that differs
    // per slide (a repeat's `(2/3)`) is added here, never written into the map.
    genSlideHtml(
        html: string,
        _openLyricKey: string,
        _openLyricIndex: number,
        _openLyricRepeat: LyricRepeatType | null,
        _openLyricLine: LyricLineType | null = null,
    ) {
        return html;
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
        // A blank after the song's last part too, as after its title: the
        // words leave the screen when the song ends, before any attachment.
        // Added here, which both the full deck and the quick list go through,
        // so an id names the same slide in each. A song with no parts already
        // ends on the None above.
        const endSlides: LyricSlide[] =
            slides.length > 0
                ? [this.genLyricSlide(-1, OPEN_LYRIC_NONE_KEY, [], displayDim)]
                : [];
        const newSlides = [...extraSlides, ...slides, ...endSlides].map(
            (slide, i) => {
                slide.id = i;
                return slide;
            },
        );
        return newSlides;
    }

    /**
     * The `OpenLyric` this document derives its slides from, when one is live:
     * the song's previewer's, held while its slides pane is mounted, else the
     * one assigned to this document (see `resolveLiveOpenLyric` for the
     * order). A stage no pane shows — a screen on `St: 2` under a stage-0
     * pane — has none of its own, so it used to re-read and re-parse the song
     * on every click.
     */
    get liveOpenLyric() {
        return resolveLiveOpenLyric(this.filePath, this.openLyric);
    }

    async getOpenLyricPreviewer() {
        const liveOpenLyric = this.liveOpenLyric;
        if (liveOpenLyric !== null) {
            // Deliberately NOT re-read from disk here. This sits on the
            // per-slide path (`getSlidesQuick` calls it on every render of
            // every stage pane), and a re-read costs a history-head lookup, a
            // `JSON.parse` of the whole document and — through the `value`
            // setter — a full open-lyric re-parse. Whoever OWNS the shared
            // instance keeps it current instead, on the file's `update` event:
            // see `LyricManager.refreshOpenLyricContent`.
            return liveOpenLyric;
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

    // Must list the same slides, in the same order, as the stage's full
    // `getStageSlides`: ids are positions, and `getSlideById` and the lyric
    // editor's `?id=` both turn an id into a part through this list.
    // `isAtomMode` is a parameter so the Atom Mode toggle can list the deck
    // as it was and as it will be (`lyricAtomModeScreenHelpers`).
    async getSlidesQuick(isAtomMode = this.isAtomMode) {
        const openLyricPreviewer = await this.getOpenLyricPreviewer();
        const playSteps = await this.genPlaySteps(
            openLyricPreviewer,
            isAtomMode,
        );
        const displayDim = this.displayDim;
        const slides = playSteps.map((step, i) => {
            return this.genLyricSlide(
                i,
                step.key,
                [],
                displayDim,
                step.structureIndex,
                step.repeat,
                step.line ?? null,
            );
        });
        return this.extendExtraSlide(slides, {});
    }
    async getSlides() {
        return this.getSlidesQuick();
    }

    async showContextMenu(
        event: any,
        extraMenuItems: ContextMenuItemType[] = [],
    ) {
        const menuItems: ContextMenuItemType[] = [
            genLyricReloadContextMenuItem(() => {
                this.fileSource.fireUpdateEvent();
            }),
            ...extraMenuItems,
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

    /**
     * Nothing to drop: the derived-slide cache belongs to the STAGE subclass
     * (`LyricAppDocumentStageAbstract`), which is what caches anything. Defined
     * here so a caller holding the base type can say "this changed" without
     * first asking which kind of lyric document it has.
     */
    clearCache() {}
}

// `appDocumentHelpers` cannot import this module (the `extends AppDocument`
// cycle), so the dependency is inverted: importing this module is what teaches
// `varyAppDocumentFromFilePath` how to resolve a `.owl` path.
setLyricAppDocumentGetter((filePath: string) => {
    return LyricAppDocument.getInstance(filePath);
});
