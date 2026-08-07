import type {
    OpenLyricAttachment,
    OpenLyricElementMapOptions,
    OpenLyricValueOptions,
} from 'open-lyric';

import LyricAppDocument, { OPEN_LYRIC_NONE_KEY } from './LyricAppDocument';
import { type AnyObjectType } from '../helper/typeHelpers';
import { unlockingCacher } from '../server/unlockingHelpers';
import CacheManager from '../others/CacheManager';
import {
    DEFAULT_OPEN_LYRIC_FONT_SIZE,
    getOpenLyricFontSetting,
} from './lyricHelpers';
import type LyricSlide from './LyricSlide';
import { type CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';
import CanvasItemYouTube from '../slide-editor/canvas/CanvasItemYouTube';

// Entries hold a whole song's rendered HTML, so keep the window short.
const cacheManager = new CacheManager<any>(3 * 60); // 3 minutes
export default abstract class LyricAppDocumentStageAbstract extends LyricAppDocument {
    get basicOpenLyricOptions() {
        const canvasItemBounds = this.canvasItemBounds;
        const options: OpenLyricElementMapOptions = {
            type: 'html',
            isWithKeyNote: false,
            backgroundAlpha: this.slideBackgroundAlpha,
            theme: this.slideTheme,
            width: canvasItemBounds.width,
            height: canvasItemBounds.height,
            isShowingAttachments: false,
        };
        // `this.openLyric` is only ever assigned by `LyricSlidesPreviewerComp`,
        // so it is null in every renderer where that component has not mounted
        // (the screen window, a stage instance built on demand). Falling back to
        // the persisted setting keeps the projected slide at the same size as
        // the previewer instead of open-lyric's 16px default.
        const openLyric = this.openLyric;
        const savedFont = getOpenLyricFontSetting();
        const currentFontSize =
            openLyric === null
                ? savedFont.fontSize
                : Number.parseInt(openLyric.fontSize.split('px')[0]);
        options.fontSize =
            (Number.isNaN(currentFontSize)
                ? DEFAULT_OPEN_LYRIC_FONT_SIZE
                : currentFontSize) + this.extraSlideFontSize;
        const fontFamily = openLyric?.fontFamily || savedFont.fontFamily;
        if (fontFamily) {
            options.fontFamily = fontFamily;
        }
        return options;
    }

    abstract get stageOpenLyricOptions(): OpenLyricElementMapOptions;

    get allOpenLyricOptions() {
        return {
            ...this.basicOpenLyricOptions,
            ...this.stageOpenLyricOptions,
        };
    }

    genCacheKey(prefix: string, options: AnyObjectType) {
        const sortedKeys = Object.keys(options).sort();
        const keyParts = sortedKeys
            .map((key) => {
                const value = options[key];
                return `${key}:${JSON.stringify(value)}`;
            })
            .concat([`filePath:${this.filePath}`, `stage:${this.stage}`]);
        return `${prefix}|${keyParts.join('|')}`;
    }

    abstract cleanDataMap(dataMap: AnyObjectType): void;

    // `getOpenLyricPreviewer()` re-reads the lyric file and every language
    // module, so it must stay INSIDE the callback: `unlockingCacher` only runs
    // the callback on a cache miss, whereas awaiting the previewer up front made
    // every cache hit pay the full init cost.
    getElementMap(options: OpenLyricElementMapOptions) {
        return unlockingCacher<AnyObjectType>(
            this.genCacheKey('get-element-map', options),
            async () => {
                const openLyricPreviewer = await this.getOpenLyricPreviewer();
                const dataMap = await openLyricPreviewer.getElementMap(options);
                this.cleanDataMap(dataMap);
                return dataMap;
            },
            cacheManager,
        );
    }

    getValue(options: OpenLyricValueOptions) {
        return unlockingCacher<string>(
            this.genCacheKey('get-value', options),
            async () => {
                const openLyricPreviewer = await this.getOpenLyricPreviewer();
                return await openLyricPreviewer.getValue(options);
            },
            cacheManager,
        );
    }

    abstract getFirstCanvasItemProps(): Promise<CanvasItemPropsType | null>;

    setCanvasItemBounds(canvasItemProps: CanvasItemPropsType) {
        const canvasItemBounds = this.canvasItemBounds;
        Object.assign(canvasItemProps, {
            top: canvasItemBounds.y,
            left: canvasItemBounds.x,
            width: canvasItemBounds.width,
            height: canvasItemBounds.height,
        });
    }

    genSlidesFromAttachments(attachments: OpenLyricAttachment[]) {
        const displayDim = this.displayDim;
        const slides: LyricSlide[] = attachments.map((attachment) => {
            const canvasItemPropsList: CanvasItemPropsType[] = [];
            const { title, type, link } = attachment;
            // 'youtube' | 'audio' | 'video' | 'pdf' | 'image' | 'other'
            if (type === 'youtube') {
                const canvasItem = CanvasItemYouTube.genCanvasItem(link, 0, 0);
                const canvasItemJson = canvasItem.toJson();
                canvasItemPropsList.push(canvasItemJson);
            } else {
                console.log(type, link);
            }
            canvasItemPropsList.forEach((canvasItemJson) => {
                this.setCanvasItemBounds(canvasItemJson);
            });
            return this.genLyricSlide(
                -1,
                title,
                canvasItemPropsList,
                displayDim,
            );
        });
        return slides;
    }

    async getStageSlides(key?: string) {
        // Only the whole-song branch below needs the previewer instance; the
        // single-key branch is served from the element-map cache, so resolving
        // it up front would re-read the file for nothing.
        if (key !== undefined) {
            if (key === OPEN_LYRIC_NONE_KEY) {
                const slide = this.genSlide(key, -1, {});
                return [slide];
            }
            const dataMap = await this.getElementMap({
                ...this.allOpenLyricOptions,
                key,
            });
            const slide = this.genSlide(key, -1, dataMap);
            return [slide];
        }

        const openLyricPreviewer = await this.getOpenLyricPreviewer();
        const structure = openLyricPreviewer.getStructure();

        const [canvasItemProps, dataMap] = await Promise.all([
            this.getFirstCanvasItemProps(),
            this.getElementMap(this.allOpenLyricOptions),
        ]);
        const displayDim = this.displayDim;
        const slides = structure.map((key, i) => {
            return this.genSlide(key, i, dataMap, displayDim);
        });
        const newSlides = this.extendExtraSlide(
            slides,
            dataMap,
            canvasItemProps,
        );
        const attachments = openLyricPreviewer.getAttachments();
        const attachmentSlides = this.genSlidesFromAttachments(attachments);
        const lastSlideId = newSlides.length - 1;
        attachmentSlides.forEach((slide, i) => {
            slide.id = lastSlideId + 1 + i;
        });
        newSlides.push(...attachmentSlides);
        return newSlides;
    }

    async getSlides(key?: string) {
        return this.getStageSlides(key);
    }

    async getSlideById(id: number) {
        const slidesQuick = await this.getSlidesQuick();
        const slideQuick = slidesQuick.find((slide) => slide.id === id) ?? null;
        if (slideQuick === null) {
            // The quick list is `structure` alone, so it cannot see the slides
            // this stage APPENDS — the attachment slides (`genSlidesFromAttachments`)
            // and whatever `extendExtraSlide` adds, which are numbered after the
            // structure's own. A playlist stores a lyric slide by id, and an id
            // from up there missed here and left the entry unreadable: the row
            // previewed "Fail to read file data" and presented nothing at all.
            // Falling back to the full list is the slow path on purpose — it
            // renders the whole song — but it only runs for those few ids.
            return await this.getSlideByIdSlow(id);
        }
        const key = slideQuick.openLyricKey;
        const slides = await this.getSlides(key);
        const slide =
            slides.find((slide) => slide.openLyricKey === key) ?? null;
        if (slide === null) {
            return await this.getSlideByIdSlow(id);
        }
        slide.id = slideQuick.id;
        return slide;
    }

    private async getSlideByIdSlow(id: number) {
        const slides = await this.getSlides();
        return slides.find((slide) => slide.id === id) ?? null;
    }
}
