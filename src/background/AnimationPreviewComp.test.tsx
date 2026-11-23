// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    runs: [] as { canvas: HTMLCanvasElement; stop: () => void }[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../_screen/ScreenBackgroundAnimationComp', async () => {
    const { createElement } = await import('react');
    return {
        default: () => {
            return createElement('i', { 'data-testid': 'css-layers' });
        },
    };
});
vi.mock('../_screen/glslAnimationRuntime', () => ({
    startGlslAnimation: (canvas: HTMLCanvasElement) => {
        const run = { canvas, stop: vi.fn() };
        h.runs.push(run);
        return { stop: run.stop };
    },
}));

import AnimationPreviewComp from './AnimationPreviewComp';
import { listAnimationCategorySamples } from './animationBuiltInHelpers';

let root: Root;
let container: HTMLDivElement;

async function render(src: string) {
    await act(async () => {
        root.render(
            createElement(AnimationPreviewComp, { src, isMoving: true }),
        );
    });
    // The runtime is a dynamic import: let it resolve and start the run.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    h.runs.length = 0;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('AnimationPreviewComp, a moving shader', () => {
    it('runs a changed shader on a new canvas, not the one the last run lost', async () => {
        // A stopped run hands its WebGL context back (`loseContext`), and
        // that canvas's `getContext` answers the same lost one forever: the
        // Edit Code preview went blank after the first change.
        const [first, second] =
            listAnimationCategorySamples('sunday-worship').glsl;
        await render(first.src);
        expect(h.runs).toHaveLength(1);
        await render(second.src);
        expect(h.runs).toHaveLength(2);
        expect(h.runs[0].stop).toHaveBeenCalledTimes(1);
        expect(h.runs[1].canvas).not.toBe(h.runs[0].canvas);
        expect(h.runs[0].canvas.isConnected).toBe(false);
        expect(h.runs[1].canvas.isConnected).toBe(true);
    });
});

describe('AnimationPreviewComp, a CSS tile', () => {
    const findLayers = () => {
        return container.querySelector('[data-testid="css-layers"]');
    };

    it('lays out its effect only once it has been scrolled to', async () => {
        const callbackList: IntersectionObserverCallback[] = [];
        vi.stubGlobal(
            'IntersectionObserver',
            class {
                constructor(callback: IntersectionObserverCallback) {
                    callbackList.push(callback);
                }
                observe() {}
                disconnect() {}
            },
        );
        const [snow] = listAnimationCategorySamples('christmas').css;
        await act(async () => {
            root.render(
                createElement(AnimationPreviewComp, {
                    src: snow.src,
                    isDrawnInView: true,
                }),
            );
        });
        expect(findLayers()).toBeNull();
        expect(callbackList).toHaveLength(1);
        await act(async () => {
            callbackList[0](
                [{ isIntersecting: true } as IntersectionObserverEntry],
                {} as IntersectionObserver,
            );
        });
        expect(findLayers()).not.toBeNull();
    });

    it('lays it out at once where nobody asked it to wait', async () => {
        const [snow] = listAnimationCategorySamples('christmas').css;
        await act(async () => {
            root.render(createElement(AnimationPreviewComp, { src: snow.src }));
        });
        expect(findLayers()).not.toBeNull();
    });
});
