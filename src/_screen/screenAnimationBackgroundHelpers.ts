import {
    parseAnimation,
    toAnimationStillFill,
    type GlslAnimationType,
} from '../background/animationValueHelpers';
import { genFillBackground } from '../background/fillValueHelpers';
import { handleError } from '../helper/errorHelpers';

/**
 * A GLSL animation background's element (`genHtmlBackground`): a box holding
 * the animation's still gradient, a canvas over it.
 *
 * - Where it is presented (`isLive`, the screen window), the shader runs on
 *   the canvas (`glslAnimationRuntime`, loaded now and not before) and the
 *   gradient goes once the first frame is drawn -- a see-through ground
 *   then shows what is under the screen. Any failure puts the gradient
 *   back: a projector never goes see-through to the desktop because a
 *   graphics card said no.
 * - Everywhere else (a presenter's Mini Screen) one still frame is drawn on
 *   a small canvas by the shared renderer (`glslStillRenderer`): a preview
 *   is not worth a running shader on an old machine.
 *
 * The promise answers the function that lets go of it, as a camera's does.
 */

// A Mini Screen's still, in canvas pixels: it is drawn a few hundred wide.
const STILL_WIDTH = 480;

export function toGlslAnimation(src: string): GlslAnimationType | null {
    const animation = parseAnimation(src);
    return animation?.engine === 'glsl' ? animation : null;
}

export function genGlslAnimationElement(
    animation: GlslAnimationType,
    {
        isLive,
        width,
        height,
    }: { isLive: boolean; width: number; height: number },
): { element: HTMLDivElement; promise: Promise<() => void> } {
    const still = genFillBackground(toAnimationStillFill(animation));
    const element = document.createElement('div');
    Object.assign(element.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        background: still,
        opacity: `${animation.opacity / 100}`,
    });
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
        display: 'block',
        width: '100%',
        height: '100%',
    });
    element.appendChild(canvas);
    const fallBack = (error?: string) => {
        element.style.background = still;
        canvas.style.visibility = 'hidden';
        if (error !== undefined) {
            // English, for the log: the screen shows the gradient instead.
            console.warn(`GLSL animation background: ${error}`);
        }
    };
    if (isLive) {
        const promise = import('./glslAnimationRuntime')
            .then(({ startGlslAnimation }) => {
                const run = startGlslAnimation(canvas, animation, {
                    onFirstFrame: () => {
                        element.style.background = 'none';
                    },
                    onError: fallBack,
                });
                return run.stop;
            })
            .catch((error) => {
                handleError(error);
                fallBack();
                return () => {};
            });
        return { element, promise };
    }
    canvas.width = STILL_WIDTH;
    canvas.height = Math.max(
        1,
        Math.round((STILL_WIDTH * height) / Math.max(1, width)),
    );
    const promise = import('../background/glslStillRenderer')
        .then(({ queueGlslStill }) => {
            return queueGlslStill(animation, canvas, (isDrawn) => {
                if (isDrawn) {
                    element.style.background = 'none';
                } else {
                    fallBack();
                }
            });
        })
        .catch((error) => {
            handleError(error);
            fallBack();
            return () => {};
        });
    return { element, promise };
}
