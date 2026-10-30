// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isDarkMode: false,
}));

// The real theme module reaches the colour and drag helpers; only the mode
// flag is read here.
vi.mock('../../../others/themeHelpers', () => ({
    checkIsDarkMode: () => h.isDarkMode,
}));

import {
    genBoxEditorStyle,
    getRotatedResizeCursor,
    normalizeDegrees,
} from './boxEditorHelpers';

beforeEach(() => {
    h.isDarkMode = false;
});

describe('normalizeDegrees', () => {
    test.each([
        [45, 45],
        [360, 0],
        [725, 5],
        [-90, 270],
        [-720, 0],
    ])('%i deg is %i deg', (input, expected) => {
        expect(normalizeDegrees(input)).toBe(expected);
    });
});

describe('getRotatedResizeCursor', () => {
    test.each([
        ['top-mid', 0, 'n-resize'],
        ['right-top', 0, 'ne-resize'],
        ['right-mid', 0, 'e-resize'],
        ['right-bottom', 0, 'se-resize'],
        ['bottom-mid', 0, 's-resize'],
        ['left-bottom', 0, 'sw-resize'],
        ['left-mid', 0, 'w-resize'],
        ['left-top', 0, 'nw-resize'],
    ])('an unrotated %s handle shows %s', (handle, rotate, cursor) => {
        expect(getRotatedResizeCursor(handle, rotate)).toBe(cursor);
    });

    test.each([
        // A quarter turn moves every handle's cursor a quarter round.
        ['top-mid', 90, 'e-resize'],
        // 315 + 45 wraps past north back to it.
        ['left-top', 45, 'n-resize'],
        // Snapped to the nearest of the eight CSS cursors.
        ['right-bottom', 20, 'se-resize'],
        ['bottom-mid', 30, 'sw-resize'],
        ['left-mid', -100, 's-resize'],
    ])('a %s handle rotated %i deg shows %s', (handle, rotate, cursor) => {
        expect(getRotatedResizeCursor(handle, rotate)).toBe(cursor);
    });

    test('an unknown handle is treated as pointing north', () => {
        expect(getRotatedResizeCursor('not-a-handle', 0)).toBe('n-resize');
        expect(getRotatedResizeCursor('not-a-handle', 180)).toBe('s-resize');
    });
});

describe('genBoxEditorStyle', () => {
    function styleBlocks() {
        const markup = renderToStaticMarkup(genBoxEditorStyle());
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        return Array.from(holder.querySelectorAll('style')).map(
            (style) => style.textContent ?? '',
        );
    }

    test('ships the box chrome rules, blinking the edit outline only three times', () => {
        const [editorRules] = styleBlocks();
        expect(editorRules).toContain('.app-box-editor.editable');
        expect(editorRules).toContain('.editor-controller-box-chrome .object');
        // An endless paint animation would keep repainting an idle canvas.
        expect(editorRules).toContain('animation-iteration-count: 3');
        expect(editorRules).not.toMatch(
            /animation-iteration-count:\s*infinite/,
        );
        expect(editorRules).not.toMatch(/animation:[^;]*infinite/);
    });

    test('adds the hover text shadow in light mode only', () => {
        const light = styleBlocks();
        expect(light).toHaveLength(2);
        expect(light[1]).toContain('.shadow-caught-hover-pointer:hover');

        h.isDarkMode = true;
        const dark = styleBlocks();
        expect(dark).toHaveLength(2);
        expect(dark[1]).not.toContain('.shadow-caught-hover-pointer');
    });
});
