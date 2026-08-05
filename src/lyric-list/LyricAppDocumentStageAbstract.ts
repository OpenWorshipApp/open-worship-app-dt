import type {
    OpenLyricElementMapOptions,
    OpenLyricValueOptions,
} from 'open-lyric';

import { type SrcData } from '../helper/FileSource';
import LyricAppDocument, { OPEN_LYRIC_NONE_KEY } from './LyricAppDocument';
import { type AnyObjectType } from '../helper/typeHelpers';
import { unlockingCacher } from '../server/unlockingHelpers';
import CacheManager from '../others/CacheManager';
import {
    DEFAULT_OPEN_LYRIC_FONT_SIZE,
    getOpenLyricFontSetting,
} from './lyricHelpers';

// Entries hold a whole song's rendered HTML, so keep the window short.
const cacheManager = new CacheManager<any>(3 * 60); // 3 minutes
export default abstract class LyricAppDocumentStageAbstract extends LyricAppDocument {
    get basicOpenLyricOptions() {
        const options: OpenLyricElementMapOptions = {
            type: 'html',
            isWithKeyNote: false,
            backgroundAlpha: this.slideBackgroundAlpha,
            theme: this.slideTheme,
            width: this.slideBounds.width,
            height: this.slideBounds.height,
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

    // `getOpenLyricPreviewer()` re-reads the lyric file and every language
    // module, so it must stay INSIDE the callback: `unlockingCacher` only runs
    // the callback on a cache miss, whereas awaiting the previewer up front made
    // every cache hit pay the full init cost.
    getElementMap(options: OpenLyricElementMapOptions) {
        return unlockingCacher<AnyObjectType>(
            this.genCacheKey('get-element-map', options),
            async () => {
                const openLyricPreviewer = await this.getOpenLyricPreviewer();
                return await openLyricPreviewer.getElementMap(options);
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

        const [wholeImage, dataMap] = await Promise.all([
            this.getValue(this.basicOpenLyricOptions),
            this.getElementMap(this.allOpenLyricOptions),
        ]);
        const displayDim = this.displayDim;
        const slides = structure.map((key, i) => {
            return this.genSlide(key, i, dataMap, displayDim);
        });
        const canvasItemProps = this.genCanvasItemHtmlProps(
            0,
            wholeImage as SrcData,
        );
        return this.extendExtraSlide(slides, dataMap, canvasItemProps);
    }

    async getSlides(key?: string) {
        return this.getStageSlides(key);
    }

    async getSlideById(id: number) {
        const slidesQuick = await this.getSlidesQuick();
        const slideQuick = slidesQuick.find((slide) => slide.id === id) ?? null;
        if (slideQuick === null) {
            return null;
        }
        const key = slideQuick.openLyricKey;
        const slides = await this.getSlides(key);
        const slide =
            slides.find((slide) => slide.openLyricKey === key) ?? null;
        if (slide === null) {
            return null;
        }
        slide.id = slideQuick.id;
        return slide;
    }
}
