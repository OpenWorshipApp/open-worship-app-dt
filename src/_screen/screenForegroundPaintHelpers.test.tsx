// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fill Show and Animation Show on the foreground layer: the box each one is
// drawn in, when it moves, and what it lets go of when it comes off.
const state = vi.hoisted(() => {
    return {
        keyframes: vi.fn(),
        stop: vi.fn(),
        glsl: [] as { isLive: boolean; width: number; height: number }[],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false, isWindows: false, isMac: false },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
// Neither renderer reads a file, plays media or captures a page.
vi.mock('../helper/FileSource', () => ({ default: {} }));
vi.mock('../helper/mediaHelpers', () => ({
    playMediaElement: vi.fn(),
    releaseMediaElement: vi.fn(),
}));
vi.mock('../background/RenderBackgroundWebIframeComp', () => ({
    default: () => null,
}));
vi.mock('./managers/screenWebsiteHelpers', () => ({
    genWebScreenShotElement: vi.fn(),
}));
vi.mock('../background/cssAnimationLayerHelpers', async (importOriginal) => {
    const original: any = await importOriginal();
    return { ...original, ensureCssAnimationKeyframes: state.keyframes };
});
vi.mock('./screenAnimationBackgroundHelpers', async (importOriginal) => {
    const original: any = await importOriginal();
    return {
        ...original,
        genGlslAnimationElement: (
            _animation: unknown,
            options: { isLive: boolean; width: number; height: number },
        ) => {
            state.glsl.push(options);
            const element = document.createElement('div');
            element.className = 'glsl-stand-in';
            return { element, promise: Promise.resolve(state.stop) };
        },
    };
});

import {
    genHtmlForegroundAnimation,
    genHtmlForegroundFill,
} from './screenForegroundHelpers';
import {
    FILL_BUILT_IN_PATTERN_MAP,
    FILL_BUILT_IN_GRADIENT_MAP,
} from '../background/fillBuiltInHelpers';
import { genFillMotionPlan, parseFill } from '../background/fillValueHelpers';

const CSS_SRC =
    'css?name=bokeh&colors=1E3A8A-F59E0B-FFFFFF&speed=normal&density=normal';
const CSS_SCREEN_BLEND_SRC = `${CSS_SRC}&blend=screen`;
const GLSL_SRC =
    'glsl?name=plasma&colors=0F172A-7C3AED&speed=normal&quality=normal';
const DIM = { width: 1920, height: 1080 };

const MOVING_FILL_SRC = [
    ...FILL_BUILT_IN_GRADIENT_MAP.dark,
    ...FILL_BUILT_IN_PATTERN_MAP.dark,
].find((src) => {
    const fill = parseFill(src);
    return fill !== null && genFillMotionPlan(fill) !== null;
})!;

function genAnim() {
    return {
        animIn: vi.fn(
            async (element: HTMLElement, parentContainer: HTMLElement) => {
                parentContainer.appendChild(element);
            },
        ),
        animOut: vi.fn(async (element: HTMLElement) => {
            element.remove();
        }),
        duration: 0,
    } as any;
}

async function mount(
    handler: { handleAdding: (parent: HTMLElement) => Promise<void> },
    animData: any,
) {
    const parent = document.createElement('div');
    await handler.handleAdding(parent);
    expect(animData.animIn).toHaveBeenCalledTimes(1);
    return parent.firstElementChild as HTMLElement;
}

beforeEach(() => {
    state.keyframes.mockClear();
    state.stop.mockClear();
    state.glsl = [];
});

describe('Fill Show on the foreground', () => {
    it('is drawn in a box the shape of the screen, sized by its session', async () => {
        const animData = genAnim();
        const handler = genHtmlForegroundFill(
            {
                src: '#1E3A8A',
                extraStyle: { width: '40%', opacity: 0.5, height: '10px' },
            } as any,
            animData,
            DIM,
            false,
        );
        const box = await mount(handler, animData);
        expect(box.style.position).toBe('absolute');
        // The session's width wins over the box's whole width...
        expect(box.style.width).toBe('40%');
        expect(box.style.opacity).toBe('0.5');
        // ...but a height of its own never does: the screen's shape does.
        expect(box.style.height).toBe('auto');
        expect(box.style.getPropertyValue('aspect-ratio')).toBe('1920 / 1080');
        const paint = box.firstElementChild as HTMLElement;
        expect(paint.style.position).toBe('absolute');
        expect(paint.style.width).toBe('100%');
        expect(paint.style.height).toBe('100%');
        expect(paint.style.background).not.toBe('');
    });

    it('goes where Properties pins it, the right or the bottom included', async () => {
        const placedAnim = genAnim();
        const placed = await mount(
            genHtmlForegroundFill(
                {
                    src: '#1E3A8A',
                    extraStyle: {
                        position: 'absolute',
                        right: '0px',
                        bottom: '0px',
                        width: '50%',
                    },
                } as any,
                placedAnim,
                DIM,
                false,
            ),
            placedAnim,
        );
        expect(placed.style.right).toBe('0px');
        expect(placed.style.bottom).toBe('0px');
        expect(placed.style.left).toBe('');
        expect(placed.style.top).toBe('');
        // With nothing placing it -- a run-sheet row from before Properties
        // -- it covers the screen from its top left.
        const wholeAnim = genAnim();
        const whole = await mount(
            genHtmlForegroundFill(
                { src: '#1E3A8A' } as any,
                wholeAnim,
                DIM,
                false,
            ),
            wholeAnim,
        );
        expect(whole.style.left).toBe('0px');
        expect(whole.style.top).toBe('0px');
        expect(whole.style.width).toBe('100%');
    });

    it('moves only in the screen window, still in every preview', async () => {
        expect(MOVING_FILL_SRC).toBeDefined();
        const stillAnim = genAnim();
        const still = await mount(
            genHtmlForegroundFill(
                { src: MOVING_FILL_SRC } as any,
                stillAnim,
                DIM,
                false,
            ),
            stillAnim,
        );
        expect(still.querySelector('.app-fill-motion')).toBeNull();
        const movingAnim = genAnim();
        const moving = await mount(
            genHtmlForegroundFill(
                { src: MOVING_FILL_SRC } as any,
                movingAnim,
                DIM,
                true,
            ),
            movingAnim,
        );
        expect(moving.querySelector('.app-fill-motion')).not.toBeNull();
    });

    it('comes off through its transition', async () => {
        const animData = genAnim();
        const handler = genHtmlForegroundFill(
            { src: '#1E3A8A' } as any,
            animData,
            DIM,
            false,
        );
        const box = await mount(handler, animData);
        await handler.handleRemoving();
        expect(animData.animOut).toHaveBeenCalledWith(box);
        expect(box.isConnected).toBe(false);
    });

    it('draws nothing for a value that is not a fill', async () => {
        const animData = genAnim();
        const box = await mount(
            genHtmlForegroundFill(
                { src: 'url(http://example.com/x.png)' } as any,
                animData,
                DIM,
                false,
            ),
            animData,
        );
        const paint = box.firstElementChild as HTMLElement;
        expect(paint.style.background).toBe('');
        expect(paint.children.length).toBe(0);
    });
});

describe('Animation Show on the foreground', () => {
    it('a CSS one is still in a preview, its keyframes never added there', async () => {
        const animData = genAnim();
        const box = await mount(
            genHtmlForegroundAnimation(
                { src: CSS_SRC } as any,
                animData,
                DIM,
                false,
            ),
            animData,
        );
        expect(box.querySelector('.app-anim-box')).not.toBeNull();
        expect(box.querySelector('.app-anim-moving')).toBeNull();
        expect(state.keyframes).not.toHaveBeenCalled();
    });

    it('a CSS one moves on the screen, with its keyframes added once asked', async () => {
        const animData = genAnim();
        const box = await mount(
            genHtmlForegroundAnimation(
                { src: CSS_SRC } as any,
                animData,
                DIM,
                true,
            ),
            animData,
        );
        expect(box.querySelector('.app-anim-moving')).not.toBeNull();
        expect(state.keyframes).toHaveBeenCalledWith(document);
    });

    it('lifts its own blend onto the box unless the session chose one', async () => {
        const ownAnim = genAnim();
        const own = await mount(
            genHtmlForegroundAnimation(
                { src: CSS_SCREEN_BLEND_SRC } as any,
                ownAnim,
                DIM,
                false,
            ),
            ownAnim,
        );
        expect(own.style.mixBlendMode).toBe('screen');
        const chosenAnim = genAnim();
        const chosen = await mount(
            genHtmlForegroundAnimation(
                {
                    src: CSS_SCREEN_BLEND_SRC,
                    extraStyle: { mixBlendMode: 'multiply' },
                } as any,
                chosenAnim,
                DIM,
                false,
            ),
            chosenAnim,
        );
        expect(chosen.style.mixBlendMode).toBe('multiply');
        const plainAnim = genAnim();
        const plain = await mount(
            genHtmlForegroundAnimation(
                { src: CSS_SRC } as any,
                plainAnim,
                DIM,
                false,
            ),
            plainAnim,
        );
        expect(plain.style.mixBlendMode).toBe('');
    });

    it('a shader is live on the screen alone, and lets go of it when it comes off', async () => {
        const previewAnim = genAnim();
        await mount(
            genHtmlForegroundAnimation(
                { src: GLSL_SRC } as any,
                previewAnim,
                DIM,
                false,
            ),
            previewAnim,
        );
        const animData = genAnim();
        const handler = genHtmlForegroundAnimation(
            { src: GLSL_SRC } as any,
            animData,
            DIM,
            true,
        );
        const box = await mount(handler, animData);
        expect(state.glsl).toEqual([
            { isLive: false, width: 1920, height: 1080 },
            { isLive: true, width: 1920, height: 1080 },
        ]);
        expect(box.querySelector('.glsl-stand-in')).not.toBeNull();
        expect(state.stop).not.toHaveBeenCalled();
        await handler.handleRemoving();
        expect(animData.animOut).toHaveBeenCalledWith(box);
        expect(state.stop).toHaveBeenCalledTimes(1);
    });
});
