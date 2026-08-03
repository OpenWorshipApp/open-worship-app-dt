import type { OpenLyricElementMapOptions } from 'open-lyric';

import { type SrcData } from '../helper/FileSource';
import LyricAppDocument from './LyricAppDocument';

export default abstract class LyricAppDocumentStageAbstract extends LyricAppDocument {

    get basicOpenLyricOptions(): OpenLyricElementMapOptions {
        return {
            type: 'html',
            isWithKeyNote: false,
            backgroundAlpha: this.slideBackgroundAlpha,
            theme: this.slideTheme,
            width: this.slideBounds.width,
            height: this.slideBounds.height,
            fontSize: this.slideFontSize ?? undefined,
        };
    }

    abstract get stageOpenLyricOptions(): OpenLyricElementMapOptions;

    get allOpenLyricOptions() {
        return {
            ...this.basicOpenLyricOptions,
            ...this.stageOpenLyricOptions,
        };
    }

    async getStageSlides(key?: string) {
        const openLyricPreviewer = await this.getOpenLyricPreviewer();
        if (key !== undefined) {
            const imageDataMap = await openLyricPreviewer.getElementMap({
                ...this.allOpenLyricOptions,
                key,
            });
            const slide = this.genSlide(key, -1, imageDataMap);
            return [slide];
        }

        const structure = openLyricPreviewer.getStructure();
        const [wholeImage, imageDataMap] = await Promise.all([
            openLyricPreviewer.getValue(this.basicOpenLyricOptions),
            openLyricPreviewer.getElementMap(this.allOpenLyricOptions),
        ]);
        const slides = structure.map((key, i) => {
            return this.genSlide(key, i + this.jumpIndex, imageDataMap);
        });
        const canvasItemProps = this.genCanvasItemProps(
            0,
            wholeImage as SrcData,
        );
        this.prependInfoSlide(slides, imageDataMap, canvasItemProps);
        return slides;
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
        const slides = await this.getSlides(slideQuick.openLyricKey);
        const slide = slides.find((slide) => slide.id === id) ?? null;
        if (slide === null) {
            return null;
        }
        slide.id = slideQuick.id;
        return slide;
    }
}
