import { describe, expect, test } from 'vitest';

import {
    checkIsBlankLeadSlide,
    filterSideCanvasItems,
    fitSlideIntoBox,
    genDocumentStageLayout,
    genStageIndexLabel,
    getDocumentStageDefinition,
    getStageSideOpacity,
    resolveStageSides,
    toStageDeck,
} from './documentStageHelpers';
import {
    BLANK_HTML_SLIDE_SRC,
    BLANK_IMAGE_SLIDE_SRC,
} from '../../app-document-list/blankSlideConstants';
import {
    genRowArrangement,
    PREVIOUS_NEXT_ARRANGEMENT,
} from '../../lyric-list/lyricLookAheadHelpers';

type FakeSlideType = {
    id: number;
    name: string;
    isDisabled: boolean;
    width: number;
    height: number;
    json: Record<string, unknown>;
    subSlides?: FakeSlideType[];
    toJson: () => Record<string, unknown>;
};

function genSlide(
    id: number,
    {
        name = '',
        isDisabled = false,
        json = {},
        subSlides,
    }: {
        name?: string;
        isDisabled?: boolean;
        json?: Record<string, unknown>;
        subSlides?: FakeSlideType[];
    } = {},
): any {
    const slide: FakeSlideType = {
        id,
        name,
        isDisabled,
        width: 1920,
        height: 1080,
        json: { id, ...json },
        toJson() {
            return this.json;
        },
    };
    if (subSlides !== undefined) {
        slide.subSlides = subSlides;
    }
    return slide;
}

describe('getDocumentStageDefinition', () => {
    test('stage 0 draws the slide as it is', () => {
        expect(getDocumentStageDefinition(0)).toBeNull();
    });

    test('anything that is not a stage number draws the slide as it is', () => {
        expect(getDocumentStageDefinition(-1)).toBeNull();
        expect(getDocumentStageDefinition(1.5)).toBeNull();
        expect(getDocumentStageDefinition(Number.NaN)).toBeNull();
    });

    test('stage 1 adds the count and nothing beside the slide', () => {
        expect(getDocumentStageDefinition(1)).toEqual({
            arrangement: null,
            isShowingIndex: true,
        });
    });

    test('stages 2 and 3 show the next one and two slides, not dimmed', () => {
        const stage2 = getDocumentStageDefinition(2);
        const stage3 = getDocumentStageDefinition(3);
        expect(stage2?.arrangement?.offsets).toEqual([1]);
        // Asked for at full opacity: no transparency on a coming slide.
        expect(stage2?.arrangement?.isDimmed).toBe(false);
        expect(getDocumentStageDefinition(3)?.arrangement?.isDimmed).toBe(
            false,
        );
        expect(stage2?.isShowingIndex).toBe(true);
        expect(stage3?.arrangement?.offsets).toEqual([1, 2]);
        expect(stage3?.isShowingIndex).toBe(true);
    });

    test('stage 4 is the next slide without the count', () => {
        const stage4 = getDocumentStageDefinition(4);
        expect(stage4?.arrangement?.offsets).toEqual([1]);
        expect(stage4?.isShowingIndex).toBe(false);
    });

    test('stage 5 is previous and next on a diagonal', () => {
        expect(getDocumentStageDefinition(5)?.arrangement).toBe(
            PREVIOUS_NEXT_ARRANGEMENT,
        );
    });

    test('stages past 5 fall back to stage 1, as songs do', () => {
        expect(getDocumentStageDefinition(6)).toBe(
            getDocumentStageDefinition(1),
        );
        expect(getDocumentStageDefinition(42)).toBe(
            getDocumentStageDefinition(1),
        );
    });
});

describe('checkIsBlankLeadSlide', () => {
    test('a PDF, PowerPoint or Word slide 0 is the blank lead', () => {
        expect(
            checkIsBlankLeadSlide(
                genSlide(0, {
                    json: { imagePreviewSrc: BLANK_IMAGE_SLIDE_SRC },
                }),
            ),
        ).toBe(true);
        expect(
            checkIsBlankLeadSlide(
                genSlide(0, { json: { htmlFilePath: BLANK_HTML_SLIDE_SRC } }),
            ),
        ).toBe(true);
    });

    test('a real slide 0 or a page is not', () => {
        expect(checkIsBlankLeadSlide(genSlide(0))).toBe(false);
        expect(
            checkIsBlankLeadSlide(
                genSlide(1, {
                    json: { imagePreviewSrc: BLANK_IMAGE_SLIDE_SRC },
                }),
            ),
        ).toBe(false);
    });
});

describe('toStageDeck', () => {
    test('walks the slides the way the arrow keys do', () => {
        const deck = toStageDeck([
            genSlide(1),
            genSlide(2, { isDisabled: true }),
            genSlide(3),
        ]);
        expect(deck.list.map((slide) => slide.id)).toEqual([1, 3]);
        expect(deck.indexById.get(3)).toBe(1);
        expect(deck.indexById.has(2)).toBe(false);
        expect(deck.total).toBe(2);
    });

    test('a PowerPoint slide steps through its animation steps in place', () => {
        const deck = toStageDeck([
            genSlide(1, { subSlides: [genSlide(1000), genSlide(1001)] }),
            genSlide(2),
        ]);
        expect(deck.list.map((slide) => slide.id)).toEqual([1, 1000, 1001, 2]);
        // The steps share their slide's number.
        expect(deck.numberById.get(1001)).toBe(1);
        expect(deck.numberById.get(2)).toBe(2);
        expect(deck.total).toBe(2);
    });

    test('the blank lead slide is walked but not counted', () => {
        const deck = toStageDeck([
            genSlide(0, { json: { imagePreviewSrc: BLANK_IMAGE_SLIDE_SRC } }),
            genSlide(1),
            genSlide(2),
        ]);
        expect(deck.list.map((slide) => slide.id)).toEqual([0, 1, 2]);
        expect(deck.numberById.has(0)).toBe(false);
        expect(deck.numberById.get(1)).toBe(1);
        expect(deck.total).toBe(2);
    });
});

describe('resolveStageSides', () => {
    const deck = toStageDeck([genSlide(1), genSlide(2), genSlide(3)]);

    test('finds the slides at each offset', () => {
        expect(
            resolveStageSides(deck, 1, [1, 2]).map((slide) => slide?.id),
        ).toEqual([2, 3]);
        expect(
            resolveStageSides(deck, 2, [-1, 1]).map((slide) => slide?.id),
        ).toEqual([1, 3]);
    });

    test('a slot off either end is empty', () => {
        expect(resolveStageSides(deck, 3, [1, 2])).toEqual([null, null]);
        expect(resolveStageSides(deck, 1, [-1])).toEqual([null]);
    });

    test('a slide that is not in the walk has nothing beside it', () => {
        expect(resolveStageSides(deck, 99, [1])).toEqual([null]);
    });
});

describe('genStageIndexLabel', () => {
    test('counts the slide among the document', () => {
        const slides = [genSlide(1), genSlide(2), genSlide(3)];
        const deck = toStageDeck(slides);
        expect(genStageIndexLabel(deck, slides[1])).toBe('2/3');
    });

    test('names the slide when it has a name', () => {
        const slides = [genSlide(1), genSlide(2, { name: ' Welcome ' })];
        const deck = toStageDeck(slides);
        expect(genStageIndexLabel(deck, slides[1])).toBe('Welcome · 2/2');
    });

    test('the blank lead slide has no count', () => {
        const blank = genSlide(0, {
            json: { htmlFilePath: BLANK_HTML_SLIDE_SRC },
        });
        const deck = toStageDeck([blank, genSlide(1)]);
        expect(genStageIndexLabel(deck, blank)).toBeNull();
    });
});

describe('filterSideCanvasItems', () => {
    test('keeps words and pictures, never anything that plays', () => {
        const items = [
            'text',
            'html',
            'image',
            'bible',
            'video',
            'audio',
            'youtube',
            'website',
            'camera',
        ].map((type) => ({ type }));
        expect(filterSideCanvasItems(items).map((item) => item.type)).toEqual([
            'text',
            'html',
            'image',
            'bible',
        ]);
    });
});

describe('genDocumentStageLayout', () => {
    test('with no arrangement the slide fills the stage', () => {
        const layout = genDocumentStageLayout(
            getDocumentStageDefinition(1)!,
            1920,
            1080,
        );
        expect(layout.current).toEqual({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        });
        expect(layout.sideList).toEqual([]);
        expect(layout.currentScale).toBe(1);
    });

    test('on a screen of another shape the slides grow to fill it', () => {
        // A 16:9 slide on a 16:10 screen: no band above the slide, none under
        // the next one, and both flush with the left edge.
        const layout = genDocumentStageLayout(
            getDocumentStageDefinition(2)!,
            1280,
            720,
            1494,
            934,
        );
        const next = layout.sideList[0];
        expect(layout.current.y).toBe(0);
        expect(next.y + next.height).toBeGreaterThanOrEqual(933);
        expect(next.y + next.height).toBeLessThanOrEqual(934);
        expect(layout.current.x).toBe(0);
        expect(next.x).toBe(0);
        // Bigger than the old fit-the-slide-first layout (0.6 of 840px tall).
        expect(layout.current.height).toBeGreaterThan(540);
        expect(layout.currentScale * 720).toBeCloseTo(layout.current.height, 0);
    });

    test('an arrangement gives one side box per offset', () => {
        const layout = genDocumentStageLayout(
            getDocumentStageDefinition(3)!,
            1920,
            1080,
        );
        expect(layout.sideList).toHaveLength(2);
        expect(layout.currentScale).toBeLessThan(1);
    });
});

describe('getStageSideOpacity', () => {
    test('a document stage draws every coming slide at full opacity', () => {
        for (const stage of [2, 3, 4, 5]) {
            const definition = getDocumentStageDefinition(stage)!;
            expect(getStageSideOpacity(definition, 1)).toBe(1);
            expect(getStageSideOpacity(definition, 2)).toBe(1);
        }
    });

    test('an arrangement that dims fades by distance', () => {
        const dimmed = {
            arrangement: { ...genRowArrangement([1, 2]), isDimmed: true },
            isShowingIndex: true,
        };
        expect(getStageSideOpacity(dimmed, 1)).toBe(0.5);
        expect(getStageSideOpacity(dimmed, 2)).toBe(0.35);
    });
});

describe('fitSlideIntoBox', () => {
    test('shrinks a slide of another shape to fit, centred', () => {
        const fit = fitSlideIntoBox(
            { x: 0, y: 0, width: 400, height: 225 },
            800,
            900,
        );
        expect(fit.scale).toBe(0.25);
        expect(fit.top).toBe(0);
        expect(fit.left).toBe(100);
    });

    test('a slide with no size is left alone', () => {
        expect(
            fitSlideIntoBox({ x: 0, y: 0, width: 400, height: 225 }, 0, 0),
        ).toEqual({ left: 0, top: 0, scale: 1 });
    });
});
