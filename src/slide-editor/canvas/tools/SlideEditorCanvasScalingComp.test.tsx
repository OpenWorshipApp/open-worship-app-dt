// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    scale: 1,
    controller: null as any,
    range: null as any,
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

vi.mock('../CanvasController', () => ({
    defaultRangeSize: { size: 10, min: 1, max: 20, step: 1 },
    useCanvasControllerContext: () => h.controller,
}));

vi.mock('../canvasEventHelpers', () => ({
    useSlideCanvasScale: () => h.scale,
}));

vi.mock('../../../others/AppRangeComp', () => ({
    default: (props: any) => {
        h.range = props;
        return <input data-range="" readOnly value={props.value} />;
    },
}));

import SlideEditorCanvasScalingComp from './SlideEditorCanvasScalingComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => root.render(<SlideEditorCanvasScalingComp />));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.scale = 1;
    h.range = null;
    h.controller = { scale: 1, toCenterView: vi.fn() };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlideEditorCanvasScalingComp', () => {
    test('shows the zoom as a percentage over a slider in tenths', async () => {
        h.scale = 0.456;
        await render();

        expect(container.querySelector('span')?.textContent).toBe('46%');
        expect(container.querySelector('span')?.title).toBe('Canvas Scale');
        expect(h.range.value).toBeCloseTo(4.56);
        expect(h.range.title).toBe('Canvas Scale');
        expect(h.range.defaultSize).toEqual({
            size: 10,
            min: 1,
            max: 20,
            step: 1,
        });
    });

    test('moving the slider sets the canvas scale', async () => {
        await render();

        h.range.setValue(25);
        expect(h.controller.scale).toBe(2.5);
    });

    test('the center button recenters the canvas', async () => {
        await render();
        const button = container.querySelector<HTMLButtonElement>(
            'button[aria-label="Center view"]',
        )!;
        expect(button.title).toBe('Center view');

        await act(async () => button.click());
        expect(h.controller.toCenterView).toHaveBeenCalledOnce();
    });

    test('acts on the newest controller after a re-render', async () => {
        await render();
        const first = h.controller;
        h.controller = { scale: 1, toCenterView: vi.fn() };
        await render();

        h.range.setValue(5);
        await act(async () => container.querySelector('button')!.click());

        expect(h.controller.scale).toBe(0.5);
        expect(h.controller.toCenterView).toHaveBeenCalledOnce();
        expect(first.scale).toBe(1);
        expect(first.toCenterView).not.toHaveBeenCalled();
    });
});
