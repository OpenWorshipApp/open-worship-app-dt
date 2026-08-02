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
import type LyricManager from './LyricManager';
import { tran } from '../lang/langHelpers';
import { type CanvasItemImagePropsType } from '../slide-editor/canvas/CanvasItemImage';
import { OpenLyric, type OpenLyricElementMapOptions } from 'open-lyric';
import { type SrcData } from '../helper/FileSource';

export default class LyricAppDocument extends AppDocument {
    static readonly mimetypeName: MimetypeNameType = 'lyricAppDocument';
    isEditable = false;
    lyricManager: LyricManager | null = null;
    public slidePaddingPercentage = 1;
    public slideBackgroundAlpha: number = 0.5;
    public slideFontSize: number | null = null;
    public isSlideImage = false;
    public slideTheme: 'light' | 'dark' = 'light';
    public stage = 0;

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

    get stage0OpenLyricImageGenOptions(): OpenLyricElementMapOptions {
        return {
            isPngImageData: true,
            isWithKeyNote: false,
            width: this.slideBounds.width,
            height: this.slideBounds.height,
            backgroundAlpha: this.slideBackgroundAlpha,
            fontSize: this.slideFontSize ?? undefined,
            theme: this.slideTheme,
            css: `
                .ol-song-view__section-body {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .ol-preview-lines {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    vertical-align: middle;
                }

                .ol-preview-lyric-segment__chord {
                    display: none;
                }

                .ol-song-view__section-title {
                    display: none;
                }

                .ol-song-view__info-card .ol-song-view__title {
                    font-size: 1.6em !important; 
                }
            `,
        };
    }

    get stage1OpenLyricImageGenOptions(): OpenLyricElementMapOptions {
        return {
            isPngImageData: true,
            isWithKeyNote: true,
            width: this.slideBounds.width,
            height: this.slideBounds.height,
            backgroundAlpha: this.slideBackgroundAlpha,
            fontSize: this.slideFontSize ?? undefined,
            theme: this.slideTheme,
            css: `
                .ol-song-view__info-card .ol-song-view__title {
                    font-size: 1.6em !important; 
                }
            `,
        };
    }

    private genCanvasItemImageProps(id: number, srcData: SrcData) {
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

    private genSlide(
        key: string,
        i: number,
        imageDataMap: Record<string, string>,
    ) {
        const displayDim = this.displayDim;
        const srcData = imageDataMap[key] as any;
        const canvasItemProps = this.genCanvasItemImageProps(i, srcData);
        return new LyricSlide(this.filePath, {
            id: i,
            canvasItems: [canvasItemProps],
            metadata: {
                width: displayDim.width,
                height: displayDim.height,
                uuid: i.toString(),
            } as any,
        });
    }

    private prependInfoSlide(
        slides: LyricSlide[],
        imageDataMap: Record<string, string>,
        firstCanvasItemProps: CanvasItemImagePropsType | null = null,
    ) {
        const displayDim = this.displayDim;
        slides.unshift(
            new LyricSlide(this.filePath, {
                id: 2,
                canvasItems: [],
                metadata: {
                    width: displayDim.width,
                    height: displayDim.height,
                    uuid: '0',
                } as any,
            }),
        );
        slides.unshift(this.genSlide('Info', 1, imageDataMap));
        slides.unshift(
            new LyricSlide(this.filePath, {
                id: 0,
                canvasItems:
                    firstCanvasItemProps === null ? [] : [firstCanvasItemProps],
                metadata: {
                    width: displayDim.width,
                    height: displayDim.height,
                    uuid: '0',
                } as any,
            }),
        );
    }

    async getStage0SlidesImages(openLyricPreviewer: OpenLyric) {
        const structure = openLyricPreviewer.getStructure();
        const imageDataMap = await openLyricPreviewer.getElementMap(
            this.stage0OpenLyricImageGenOptions,
        );
        const slides = structure.map((key, i) => {
            return this.genSlide(key, i + 3, imageDataMap);
        });
        this.prependInfoSlide(slides, imageDataMap);
        return slides;
    }

    async getStage1SlidesImages(openLyricPreviewer: OpenLyric) {
        const { width: displayWidth } = this.displayDim;

        const structure = openLyricPreviewer.getStructure();
        const [wholeImage, imageDataMap] = await Promise.all([
            openLyricPreviewer.getValue({
                isPngImageData: true,
                isWithKeyNote: true,
                width: displayWidth,
                backgroundAlpha: this.slideBackgroundAlpha,
                theme: this.slideTheme,
            }),
            openLyricPreviewer.getElementMap(
                this.stage1OpenLyricImageGenOptions,
            ),
        ]);
        const slides = structure.map((key, i) => {
            return this.genSlide(key, i + 3, imageDataMap);
        });
        const canvasItemProps = this.genCanvasItemImageProps(
            0,
            wholeImage as SrcData,
        );
        this.prependInfoSlide(slides, imageDataMap, canvasItemProps);
        return slides;
    }

    async getSlides() {
        const openLyricPreviewer =
            this.lyricManager?.openLyricPreviewer ?? new OpenLyric();
        if (this.isSlideImage) {
            if (this.stage === 0) {
                return this.getStage0SlidesImages(openLyricPreviewer);
            }
            return this.getStage1SlidesImages(openLyricPreviewer);
        }
        const structure = openLyricPreviewer.getStructure();
        const slides = structure.map((_, i) => {
            return new LyricSlide(this.filePath, {
                id: i,
                canvasItems: [],
                metadata: {
                    width: this.displayDim.width,
                    height: this.displayDim.height,
                    uuid: i.toString(),
                } as any,
            });
        });
        return slides;
    }

    async showContextMenu(event: any) {
        const lyricManager = this.lyricManager;
        if (lyricManager === null) {
            return;
        }
        const menuItems: ContextMenuItemType[] = [
            {
                menuElement: tran('Reload'),
                onSelect: () => {
                    lyricManager.fileSource.fireUpdateEvent();
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
