// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../server/fileHelpers', () => ({
    isSupportedMimetype: vi.fn(() => true),
}));

import { genFittedHtmlBoxLayout } from './canvasBoxLayoutHelpers';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 800;
// margin = min(1000, 800) * 0.04
const MARGIN = 32;
const MAX_WIDTH = CANVAS_WIDTH - MARGIN * 2; // 936
const MAX_HEIGHT = CANVAS_HEIGHT - MARGIN * 2; // 736

const style = { html: '<div>verse</div>', fontSize: 45, fontFamily: null };

// jsdom performs no layout, so stand in for it: the taller the text, the
// narrower the box it was measured at.
function stubMeasuredHeights(heightByWidth: Record<number, number>) {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get() {
            const width = Number.parseInt(this.style.width);
            return heightByWidth[width] ?? 0;
        },
    });
}

afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
});

describe('genFittedHtmlBoxLayout', () => {
    test('picks the narrowest width whose text fits, and centers it', () => {
        stubMeasuredHeights({
            468: 900, // 0.5 -> too tall
            562: 800, // 0.6 -> too tall
            655: 600, // 0.7 -> fits
        });

        const layout = genFittedHtmlBoxLayout(
            style,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            null,
        );

        expect(layout).toEqual({
            width: 655,
            height: 600,
            left: Math.round((CANVAS_WIDTH - 655) / 2),
            top: Math.round((CANVAS_HEIGHT - 600) / 2),
        });
    });

    test('fills the canvas when the text fits at no width', () => {
        stubMeasuredHeights({});
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get: () => MAX_HEIGHT + 1,
        });

        const layout = genFittedHtmlBoxLayout(
            style,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            null,
        );

        expect(layout).toEqual({
            width: MAX_WIDTH,
            height: MAX_HEIGHT,
            left: MARGIN,
            top: MARGIN,
        });
    });

    test('never collapses to nothing when the text cannot be measured', () => {
        stubMeasuredHeights({});

        const layout = genFittedHtmlBoxLayout(
            style,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            null,
        );

        expect(layout?.height).toBe(style.fontSize * 2);
    });

    test('centers the box on the cursor when one is given', () => {
        stubMeasuredHeights({ 468: 400 });

        const layout = genFittedHtmlBoxLayout(
            style,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            {
                x: 500,
                y: 400,
            },
        );

        expect(layout).toEqual({
            width: 468,
            height: 400,
            left: 500 - 468 / 2,
            top: 400 - 400 / 2,
        });
    });

    test('keeps a cursor-placed box inside the canvas', () => {
        stubMeasuredHeights({ 468: 400 });

        const layout = genFittedHtmlBoxLayout(
            style,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            {
                x: CANVAS_WIDTH,
                y: 0,
            },
        );

        expect(layout).toEqual({
            width: 468,
            height: 400,
            left: CANVAS_WIDTH - 468 - MARGIN,
            top: MARGIN,
        });
    });
});
