// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { BibleTextStyleViewType } from '../bibleTextStyleHelpers';

const h = vi.hoisted(() => ({
    // What the manager holds, i.e. what every screen is drawing.
    committed: {} as Record<string, unknown>,
    applyTextStyle: vi.fn(),
    broadcast: null as (() => void) | null,
}));

vi.mock('../managers/ScreenBibleManager', () => ({
    default: class ScreenBibleManager {
        static get textStyle() {
            return { ...h.committed };
        }
        static applyTextStyle(patch: Record<string, unknown>) {
            h.applyTextStyle(patch);
            Object.assign(h.committed, patch);
        }
    },
}));

vi.mock('../managers/screenEventHelpers', () => ({
    useScreenBibleManagerEvents: (
        _events: string[],
        _manager: unknown,
        callback: () => void,
    ) => {
        h.broadcast = callback;
    },
}));

import { useBibleTextStyleEditing } from './stylingHelpers';

describe('useBibleTextStyleEditing', () => {
    let container: HTMLDivElement;
    let root: Root;
    let view: BibleTextStyleViewType;
    let applyStyle: (patch: Record<string, unknown>) => void;

    function ProbeComp() {
        [view, applyStyle] = useBibleTextStyleEditing();
        return null;
    }

    beforeEach(async () => {
        vi.useFakeTimers();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.committed = { fontSize: 80, color: '#FFFFFF' };
        h.applyTextStyle.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => {
            root.render(<ProbeComp />);
        });
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
        container.remove();
        vi.useRealTimers();
    });

    test('opens on the style the screens are drawing', () => {
        expect(view.fontSize).toBe(80);
        expect(view.color).toBe('#FFFFFF');
        expect(h.applyTextStyle).not.toHaveBeenCalled();
    });

    test('the first change goes out at once', async () => {
        await act(async () => {
            applyStyle({ fontSize: 81 });
        });
        expect(h.applyTextStyle).toHaveBeenCalledTimes(1);
        expect(h.applyTextStyle).toHaveBeenLastCalledWith({ fontSize: 81 });
        expect(view.fontSize).toBe(81);
    });

    test('a drag draws every step and sends them as one', async () => {
        await act(async () => {
            applyStyle({ fontSize: 81 });
        });
        // Inside the window the first change opened: drawn, not yet sent.
        await act(async () => {
            applyStyle({ fontSize: 82 });
        });
        await act(async () => {
            applyStyle({ fontSize: 83, isBold: true });
        });
        expect(view.fontSize).toBe(83);
        expect(view.isBold).toBe(true);
        expect(h.applyTextStyle).toHaveBeenCalledTimes(1);

        await act(async () => {
            vi.advanceTimersByTime(80);
        });
        expect(h.applyTextStyle).toHaveBeenCalledTimes(2);
        expect(h.applyTextStyle).toHaveBeenLastCalledWith({
            fontSize: 83,
            isBold: true,
        });
    });

    test('a thumb being dragged is not pulled back by its own earlier commit', async () => {
        await act(async () => {
            applyStyle({ fontSize: 81 });
        });
        await act(async () => {
            applyStyle({ fontSize: 90 });
        });
        // The broadcast of the first commit lands while 90 is still waiting.
        await act(async () => {
            h.broadcast?.();
        });
        expect(view.fontSize).toBe(90);
    });

    test('follows a style changed somewhere else', async () => {
        // Ctrl+wheel on a mini screen, or the contrast fix a colour
        // background makes.
        h.committed = { fontSize: 120, color: '#000000' };
        await act(async () => {
            h.broadcast?.();
        });
        expect(view.fontSize).toBe(120);
        expect(view.color).toBe('#000000');
    });

    test('a change still waiting when the panel closes is not lost', async () => {
        await act(async () => {
            applyStyle({ fontSize: 81 });
        });
        await act(async () => {
            applyStyle({ fontSize: 95 });
        });
        await act(async () => {
            root.unmount();
        });
        vi.advanceTimersByTime(80);
        expect(h.applyTextStyle).toHaveBeenLastCalledWith({ fontSize: 95 });
        // Mounted again for `afterEach`, which unmounts what it finds.
        root = createRoot(container);
    });
});
