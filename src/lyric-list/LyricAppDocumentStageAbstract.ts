import type {
    OpenLyricElementMapOptions,
    OpenLyricValueOptions,
} from 'open-lyric';

import { type SrcData } from '../helper/FileSource';
import LyricAppDocument, { OPEN_LYRIC_NONE_KEY } from './LyricAppDocument';
import { type AnyObjectType } from '../helper/typeHelpers';
import { unlocking } from '../server/unlockingHelpers';
import CacheManager from '../others/CacheManager';
import { DEFAULT_OPEN_LYRIC_FONT_SIZE } from './lyricHelpers';

const cacheManager = new CacheManager<any>(3 * 60); // 5 minutes
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
        const openLyric = this.openLyric;
        if (openLyric !== null) {
            const currentFontSize = Number.parseInt(
                openLyric.fontSize.split('px')[0],
            );
            options.fontSize =
                (Number.isNaN(currentFontSize)
                    ? DEFAULT_OPEN_LYRIC_FONT_SIZE
                    : currentFontSize) + this.extraSlideFontSize;
            if (openLyric.fontFamily) {
                options.fontFamily = openLyric.fontFamily;
            }
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

    getElementMap(options: OpenLyricElementMapOptions) {
        const cachedKey = this.genCacheKey('get-element-map', options);
        return unlocking<AnyObjectType>(cachedKey, async () => {
            const openLyricPreviewer = await this.getOpenLyricPreviewer();
            const cachedValue = await cacheManager.get(cachedKey);
            if (cachedValue !== null) {
                return cachedValue;
            }

            const elementMap = await openLyricPreviewer.getElementMap(options);
            await cacheManager.set(cachedKey, elementMap);
            return elementMap;
        });
    }

    getValue(options: OpenLyricValueOptions) {
        const cachedKey = this.genCacheKey('get-value', options);
        return unlocking<string>(cachedKey, async () => {
            const openLyricPreviewer = await this.getOpenLyricPreviewer();
            const cachedValue = await cacheManager.get(cachedKey);
            if (cachedValue !== null) {
                return cachedValue;
            }

            const elementMap = await openLyricPreviewer.getValue(options);
            await cacheManager.set(cachedKey, elementMap);
            return elementMap;
        });
    }

    async getStageSlides(key?: string) {
        const openLyricPreviewer = await this.getOpenLyricPreviewer();
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

        const structure = openLyricPreviewer.getStructure();

        const [wholeImage, dataMap] = await Promise.all([
            this.getValue(this.basicOpenLyricOptions),
            this.getElementMap(this.allOpenLyricOptions),
        ]);
        const slides = structure.map((key, i) => {
            return this.genSlide(key, i, dataMap);
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
