import { describe, expect, it } from 'vitest';

import {
    computeSsim,
    pickSampleSlideNumbers,
    summarizeLikeness,
    toLikenessPercent,
    toLumaPlane,
} from './slideLikenessRules';

const WIDTH = 32;
const HEIGHT = 24;

function genPlane(paint: (x: number, y: number) => number) {
    const plane = new Float32Array(WIDTH * HEIGHT);
    for (let y = 0; y < HEIGHT; y += 1) {
        for (let x = 0; x < WIDTH; x += 1) {
            plane[y * WIDTH + x] = paint(x, y);
        }
    }
    return plane;
}

// A white slide with a dark box on it, as a title shape might be.
function paintBox(x: number, y: number, left = 8) {
    return x >= left && x < left + 12 && y >= 6 && y < 16 ? 20 : 250;
}

describe('toLumaPlane', () => {
    it('reads each pixel’s brightness and leaves the alpha out', () => {
        const plane = toLumaPlane(
            [255, 255, 255, 0, 0, 0, 0, 255, 255, 0, 0, 255],
            3,
            1,
        );
        expect(plane[0]).toBeCloseTo(255, 3);
        expect(plane[1]).toBe(0);
        expect(plane[2]).toBeCloseTo(0.299 * 255, 3);
    });
});

describe('computeSsim', () => {
    it('is 1 for the same picture', () => {
        const plane = genPlane((x, y) => {
            return paintBox(x, y);
        });
        expect(computeSsim(plane, plane, WIDTH, HEIGHT)).toBeCloseTo(1, 6);
    });

    it('falls as a shape moves away from where it was', () => {
        const made = genPlane((x, y) => {
            return paintBox(x, y);
        });
        const nearScore = computeSsim(
            made,
            genPlane((x, y) => {
                return paintBox(x, y, 9);
            }),
            WIDTH,
            HEIGHT,
        );
        const farScore = computeSsim(
            made,
            genPlane((x, y) => {
                return paintBox(x, y, 16);
            }),
            WIDTH,
            HEIGHT,
        );
        expect(nearScore).toBeLessThan(1);
        expect(farScore).toBeLessThan(nearScore);
    });

    it('calls a slide with its shape missing unlike', () => {
        const made = genPlane((x, y) => {
            return paintBox(x, y);
        });
        const blank = genPlane(() => {
            return 250;
        });
        expect(computeSsim(made, blank, WIDTH, HEIGHT)).toBeLessThan(0.9);
    });

    it('refuses two pictures of different sizes', () => {
        expect(() => {
            return computeSsim(new Float32Array(4), new Float32Array(6), 2, 2);
        }).toThrow();
    });

    it('counts a picture smaller than a window as one window', () => {
        const plane = new Float32Array([10, 20, 30, 40]);
        expect(computeSsim(plane, plane, 2, 2)).toBeCloseTo(1, 6);
    });
});

describe('pickSampleSlideNumbers', () => {
    it('takes every slide of a short deck', () => {
        expect(pickSampleSlideNumbers(3, 8)).toEqual([1, 2, 3]);
    });

    it('spreads the sample from the first slide to the last', () => {
        const picked = pickSampleSlideNumbers(73, 8);
        expect(picked).toHaveLength(8);
        expect(picked[0]).toBe(1);
        expect(picked[picked.length - 1]).toBe(73);
        expect([...picked].sort((a, b) => a - b)).toEqual(picked);
    });

    it('takes nothing of nothing, and one of one', () => {
        expect(pickSampleSlideNumbers(0, 8)).toEqual([]);
        expect(pickSampleSlideNumbers(5, 0)).toEqual([]);
        expect(pickSampleSlideNumbers(5, 1)).toEqual([1]);
    });
});

describe('summarizeLikeness', () => {
    it('gives the mean and the least alike slide', () => {
        expect(
            summarizeLikeness([
                { slide: 1, score: 0.999 },
                { slide: 4, score: 0.95 },
                { slide: 9, score: 0.991 },
            ]),
        ).toEqual({
            percent: 98,
            lowestSlide: 4,
            lowestPercent: 95,
            measuredSlides: [1, 4, 9],
            slidePercents: [
                { slide: 1, percent: 99.9 },
                { slide: 4, percent: 95 },
                { slide: 9, percent: 99.1 },
            ],
        });
    });

    it('has nothing to say of nothing measured', () => {
        expect(summarizeLikeness([])).toBeNull();
    });

    it('keeps a percentage between 0 and 100', () => {
        expect(toLikenessPercent(1.2)).toBe(100);
        expect(toLikenessPercent(-0.3)).toBe(0);
        expect(toLikenessPercent(0.98765)).toBe(98.8);
    });
});
