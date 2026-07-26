/**
 * Constants and drawing helpers shared by the HTML-in-Canvas demos.
 */
import type { HicContextType } from './htmlInCanvasTypes';

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;
export const PREVIEW_WIDTH = 448;
export const PREVIEW_HEIGHT = 252;

export const COLOR = {
    bg: '#181a1b',
    panel: '#212425',
    panelSoft: '#2a2e30',
    border: '#3a3f41',
    text: '#e2e5e6',
    muted: '#8d9598',
    accent: '#4aa3ff',
    good: '#4cc38a',
    bad: '#e5646d',
    warn: '#e8b339',
};

export function checkIsSupported() {
    return (
        typeof CanvasRenderingContext2D !== 'undefined' &&
        'drawElementImage' in CanvasRenderingContext2D.prototype
    );
}

export function getHicContext(canvas: HTMLCanvasElement | null) {
    if (canvas === null) {
        return null;
    }
    return canvas.getContext('2d') as HicContextType | null;
}

export function toErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }
    return String(error);
}

/**
 * A subtree that has not been through a rendering update yet has no paint
 * record, and drawing it throws. That happens on the first frame or two after
 * mount and is expected; anything else is a real bug and is rethrown.
 */
export function runDrawGuarded(callback: () => void) {
    try {
        callback();
    } catch (error) {
        if (
            error instanceof DOMException &&
            error.message.includes('No cached paint record')
        ) {
            return;
        }
        throw error;
    }
}

/** Run `callback` inside 1920x1080 slide coordinates on any canvas size. */
export function withSlideSpace(
    context: HicContextType,
    canvas: HTMLCanvasElement,
    callback: () => void,
) {
    const scale = Math.min(
        canvas.width / SLIDE_WIDTH,
        canvas.height / SLIDE_HEIGHT,
    );
    context.save();
    context.scale(scale, scale);
    callback();
    context.restore();
}

export const easing = {
    linear: (k: number) => k,
    easeIn: (k: number) => Math.pow(k, 1.675),
    easeOut: (k: number) => 1 - Math.pow(1 - k, 1.675),
    easeInOut: (k: number) => 0.5 * (Math.sin((k - 0.5) * Math.PI) + 1),
};

// -------------------------------------------------------------------------
// Hooks
// -------------------------------------------------------------------------

/** Scale about the middle of the slide, the usual transition pivot. */
export function centeredScale(context: HicContextType, scale: number) {
    context.translate(SLIDE_WIDTH / 2, SLIDE_HEIGHT / 2);
    context.scale(scale, scale);
    context.translate(-SLIDE_WIDTH / 2, -SLIDE_HEIGHT / 2);
}
