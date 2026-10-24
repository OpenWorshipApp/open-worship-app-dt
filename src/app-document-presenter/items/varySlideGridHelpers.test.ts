// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    toKeyByFilePath: (filePath: string, id: number) => `${filePath}:${id}`,
}));

vi.mock('../../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn(() => ({ fullName: 'deck.pptx' })),
        getInstanceBySrc: vi.fn(),
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

import PptxSlide from '../../app-document-list/PptxSlide';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import {
    genSlideHeightGetter,
    toVarySlideGridItemKey,
    toVarySlideGridItems,
} from './varySlideGridHelpers';

function genPptxSlide(id: number, subCount: number) {
    return new PptxSlide('/docs/deck.pptx', {
        id,
        htmlFilePath: `/deck/slide-${id}.html`,
        subHtmlFilePaths: Array.from({ length: subCount }, (_, i) => {
            return `/deck/slide-${id}-sub-${i}.html`;
        }),
        isDisabled: false,
        note: null,
        metadata: { width: 1280, height: 720 },
        images: [],
        videos: [],
        audios: [],
        type: 'pptx-slide',
    });
}

describe('toVarySlideGridItems', () => {
    test('gives every PPTX sub-slide a grid cell of its own', () => {
        const slides = [
            genPptxSlide(1, 0),
            genPptxSlide(2, 1),
            genPptxSlide(3, 2),
        ];

        const gridItems = toVarySlideGridItems(slides);

        // 1, 2, 2.01, 3, 3.01, 3.02 -- one cell per card the user sees, so a
        // row never squeezes a slide and its sub-slides into one column.
        expect(gridItems).toHaveLength(6);
        expect(
            gridItems.map((gridItem) => {
                return Math.round((gridItem.index + 1) * 100) / 100;
            }),
        ).toEqual([1, 2, 2.01, 3, 3.01, 3.02]);
        expect(gridItems[0].varySlide).toBe(slides[0]);
        expect(gridItems[1].varySlide).toBe(slides[1]);
        expect(gridItems[3].varySlide).toBe(slides[2]);
    });

    test('keeps the slide a sub-slide was cut from as its owner', () => {
        const slides = [genPptxSlide(2, 1)];

        const [ownCard, subCard] = toVarySlideGridItems(slides);

        expect(ownCard.ownerSlide).toBe(slides[0]);
        expect(ownCard.varySlide).toBe(ownCard.ownerSlide);
        expect(subCard.ownerSlide).toBe(slides[0]);
        expect(subCard.varySlide).not.toBe(slides[0]);
        expect(subCard.varySlide.id).toBe(slides[0].subSlides[0].id);
    });

    test('keys each cell by its own card, never by its owner', () => {
        const gridItems = toVarySlideGridItems([genPptxSlide(2, 2)]);
        const keys = gridItems.map(toVarySlideGridItemKey);

        expect(new Set(keys).size).toBe(3);
        expect(keys[0]).toBe('/docs/deck.pptx:2');
    });

    test('leaves a slide that is not PPTX as one cell', () => {
        const slide = {
            id: 7,
            filePath: '/docs/a.ows',
            width: 1920,
            height: 1080,
        } as unknown as VarySlideType;

        expect(toVarySlideGridItems([slide])).toEqual([
            { varySlide: slide, ownerSlide: slide, index: 0 },
        ]);
    });
});

describe('genSlideHeightGetter', () => {
    test('sizes a card body by the slide aspect ratio', () => {
        const getHeight = genSlideHeightGetter(320);

        expect(getHeight(genPptxSlide(1, 0))).toBe(180);
    });

    // A pane narrower than the zoom squeezes the card, and the body follows
    // the card: the row height has to as well, or an empty band opens under
    // every card (2026-10-06, a Stage Previewer pane at half width).
    test('follows a cell narrower than the thumbnail, less the card chrome', () => {
        const getHeight = genSlideHeightGetter(320);
        const slide = genPptxSlide(1, 0);
        expect(getHeight(slide, 326)).toBe(180);
        expect(getHeight(slide, 1000)).toBe(180);
        expect(getHeight(slide, 166)).toBe(90);
        expect(getHeight(slide, 4)).toBe(0);
    });
});
