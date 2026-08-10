// @vitest-environment jsdom
// jsdom both for the viewport the rects are measured against and because
// `floatingWidgetHelpers` pulls in `settingHelpers` → `appProvider`, which
// touches `document` at module scope.

import { describe, expect, test } from 'vitest';

import {
    getMaximizedWidgetRect,
    toggleMaximizedWidgetRect,
} from './floatingWidgetHelpers';

// Mirrors `getViewportSize`; jsdom lays nothing out, so `clientWidth` is 0 and
// the `innerWidth` fallback is what actually answers.
const VIEWPORT_WIDTH =
    globalThis.document.documentElement.clientWidth ||
    globalThis.window.innerWidth;
const VIEWPORT_HEIGHT =
    globalThis.document.documentElement.clientHeight ||
    globalThis.window.innerHeight;
const VIEWPORT_PADDING = 8;

const SMALL_RECT = { left: 120, top: 90, width: 340, height: 260 };

describe('floating widget maximize', () => {
    test('maximized fills the viewport minus the shared padding', () => {
        expect(getMaximizedWidgetRect()).toEqual({
            left: VIEWPORT_PADDING,
            top: VIEWPORT_PADDING,
            width: VIEWPORT_WIDTH - VIEWPORT_PADDING * 2,
            height: VIEWPORT_HEIGHT - VIEWPORT_PADDING * 2,
        });
    });

    test('an option cap does not hold the maximized size back', () => {
        const { rect } = toggleMaximizedWidgetRect(SMALL_RECT, null, {
            maxWidth: 400,
            maxHeight: 300,
        });

        expect(rect).toEqual(getMaximizedWidgetRect());
    });

    test('the first toggle maximizes and remembers where it came from', () => {
        const { rect, restoreRect } = toggleMaximizedWidgetRect(
            SMALL_RECT,
            null,
            {},
        );

        expect(rect).toEqual(getMaximizedWidgetRect());
        expect(restoreRect).toEqual(SMALL_RECT);
    });

    test('the second toggle puts back the remembered rect and clears the flag', () => {
        const maximized = toggleMaximizedWidgetRect(SMALL_RECT, null, {});
        const restored = toggleMaximizedWidgetRect(
            maximized.rect,
            maximized.restoreRect,
            {},
        );

        expect(restored.rect).toEqual(SMALL_RECT);
        expect(restored.restoreRect).toBeNull();
    });

    test('a remembered rect that no longer fits is clamped on the way back', () => {
        const offscreenRect = {
            left: VIEWPORT_WIDTH + 400,
            top: VIEWPORT_HEIGHT + 400,
            width: 340,
            height: 260,
        };
        const { rect } = toggleMaximizedWidgetRect(
            getMaximizedWidgetRect(),
            offscreenRect,
            {},
        );

        expect(rect).toEqual({
            left: VIEWPORT_WIDTH - 340 - VIEWPORT_PADDING,
            top: VIEWPORT_HEIGHT - 260 - VIEWPORT_PADDING,
            width: 340,
            height: 260,
        });
    });
});
