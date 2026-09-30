import { describe, expect, it } from 'vitest';

import {
    checkIsSameRowRange,
    genRowMetrics,
    toColumnCount,
    toRowCount,
    toRowIndexOfItem,
    toRowRange,
} from './virtualRowsHelpers';

describe('genRowMetrics with one height for every row', () => {
    it('answers by arithmetic and allocates nothing', () => {
        const metrics = genRowMetrics(100000, 24);
        expect(metrics.totalHeight).toBe(2400000);
        expect(metrics.startOf(0)).toBe(0);
        expect(metrics.startOf(99999)).toBe(2399976);
        expect(metrics.heightOf(5)).toBe(24);
        expect(metrics.indexAt(0)).toBe(0);
        expect(metrics.indexAt(23)).toBe(0);
        expect(metrics.indexAt(24)).toBe(1);
        expect(metrics.indexAt(2399999)).toBe(99999);
    });

    it('clamps anything outside the list', () => {
        const metrics = genRowMetrics(3, 10);
        expect(metrics.indexAt(-50)).toBe(0);
        expect(metrics.indexAt(1e9)).toBe(2);
        expect(metrics.startOf(-4)).toBe(0);
        expect(metrics.startOf(99)).toBe(20);
    });

    it('survives a zero height instead of dividing by it', () => {
        const metrics = genRowMetrics(4, 0);
        expect(metrics.totalHeight).toBe(4);
        expect(metrics.indexAt(2)).toBe(2);
    });

    it('is empty for an empty list', () => {
        const metrics = genRowMetrics(0, 30);
        expect(metrics.totalHeight).toBe(0);
        expect(metrics.count).toBe(0);
        expect(metrics.indexAt(10)).toBe(0);
    });
});

describe('genRowMetrics with a height per row', () => {
    it('adds the heights up and finds the row at an offset', () => {
        // 10, 20, 10, 20 ... starts: 0, 10, 30, 40, 60
        const metrics = genRowMetrics(4, (index) => {
            return index % 2 === 0 ? 10 : 20;
        });
        expect(metrics.totalHeight).toBe(60);
        expect(metrics.startOf(0)).toBe(0);
        expect(metrics.startOf(1)).toBe(10);
        expect(metrics.startOf(2)).toBe(30);
        expect(metrics.startOf(3)).toBe(40);
        expect(metrics.heightOf(1)).toBe(20);
        expect(metrics.indexAt(0)).toBe(0);
        expect(metrics.indexAt(9)).toBe(0);
        expect(metrics.indexAt(10)).toBe(1);
        expect(metrics.indexAt(29)).toBe(1);
        expect(metrics.indexAt(30)).toBe(2);
        expect(metrics.indexAt(59)).toBe(3);
    });

    it('finds every boundary of a long uneven list', () => {
        const count = 1000;
        const heightOf = (index: number) => {
            return 10 + (index % 7);
        };
        const metrics = genRowMetrics(count, heightOf);
        for (let index = 0; index < count; index++) {
            const start = metrics.startOf(index);
            expect(metrics.indexAt(start)).toBe(index);
            expect(metrics.indexAt(start + metrics.heightOf(index) - 1)).toBe(
                index,
            );
        }
    });
});

describe('toColumnCount', () => {
    it('fits what fits', () => {
        expect(toColumnCount(800, 100)).toBe(8);
        expect(toColumnCount(850, 100)).toBe(8);
        expect(toColumnCount(99, 100)).toBe(1);
    });

    it('counts the gap between items but not after the last one', () => {
        expect(toColumnCount(320, 100, 10)).toBe(3);
        expect(toColumnCount(319, 100, 10)).toBe(2);
    });

    it('never asks for less than one column', () => {
        expect(toColumnCount(0, 100)).toBe(1);
        expect(toColumnCount(500, 0)).toBe(1);
        expect(toColumnCount(-10, -10)).toBe(1);
    });
});

describe('toRowRange', () => {
    const metrics = genRowMetrics(100, 50);

    it('takes the rows the band touches plus the overscan', () => {
        expect(
            toRowRange({
                metrics,
                visibleTop: 100,
                visibleBottom: 300,
                overscan: 0,
            }),
        ).toEqual({ first: 2, last: 6 });
        expect(
            toRowRange({
                metrics,
                visibleTop: 100,
                visibleBottom: 300,
                overscan: 2,
            }),
        ).toEqual({ first: 0, last: 8 });
    });

    it('stays inside the list at both ends', () => {
        expect(
            toRowRange({
                metrics,
                visibleTop: -500,
                visibleBottom: 40,
                overscan: 5,
            }),
        ).toEqual({ first: 0, last: 5 });
        expect(
            toRowRange({
                metrics,
                visibleTop: 4900,
                visibleBottom: 9000,
                overscan: 5,
            }),
        ).toEqual({ first: 93, last: 99 });
    });

    it('renders nothing when there is nothing to show', () => {
        expect(
            toRowRange({
                metrics: genRowMetrics(0, 50),
                visibleTop: 0,
                visibleBottom: 500,
                overscan: 2,
            }),
        ).toEqual({ first: 0, last: -1 });
    });

    it('renders nothing when the visible band is inside out', () => {
        // What a list hidden behind another panel reports -- the bug that made
        // the Foreground slide show draw an empty box.
        expect(
            toRowRange({
                metrics,
                visibleTop: 300,
                visibleBottom: 100,
                overscan: 2,
            }),
        ).toEqual({ first: 0, last: -1 });
    });
});

describe('row bookkeeping', () => {
    it('counts rows and places an item in one', () => {
        expect(toRowCount(0, 5)).toBe(0);
        expect(toRowCount(5, 5)).toBe(1);
        expect(toRowCount(6, 5)).toBe(2);
        expect(toRowCount(7, 0)).toBe(7);
        expect(toRowIndexOfItem(0, 5)).toBe(0);
        expect(toRowIndexOfItem(4, 5)).toBe(0);
        expect(toRowIndexOfItem(5, 5)).toBe(1);
    });

    it('compares ranges', () => {
        expect(
            checkIsSameRowRange({ first: 1, last: 4 }, { first: 1, last: 4 }),
        ).toBe(true);
        expect(
            checkIsSameRowRange({ first: 1, last: 4 }, { first: 1, last: 5 }),
        ).toBe(false);
    });
});
