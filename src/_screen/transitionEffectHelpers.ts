import type { CSSProperties } from 'react';
import { useState } from 'react';

import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import type ScreenEffectManager from './managers/ScreenEffectManager';
import type { StyleAnimType, PTFEventType } from './screenTypeHelpers';

const ZOOM_CONTAINER_CLASS = 'zoom-container';
export const ANIM_END_DELAY_MILLISECOND = 500;

/**
 * `data-owa-transition` on the node an `animIn` actually appended -- the
 * element itself, or the `.zoom-container` zoom wrapped it in -- naming the
 * effect it came in with.
 *
 * A layer can now hold items that came in with DIFFERENT effects (a slide, a
 * document, a background tab or one tile can each override the screen), and
 * the effects do not mix: `zoom` wraps its element and every other effect
 * leaves a wrapper alone, so animating the outgoing node with the INCOMING
 * effect cut it instantly whenever one side was a zoom. Each item therefore
 * leaves the way it came in (`getStyleAnimForNode`).
 */
export const TRANSITION_DATASET_KEY = 'owaTransition';

function tagTransitionNode(node: HTMLElement, effect: string) {
    node.dataset[TRANSITION_DATASET_KEY] = effect;
}

/**
 * The animation a node on its way out should use: the one it came in with,
 * or `fallback` (the layer's own effect) for a node rendered before any node
 * was tagged.
 */
export function getStyleAnimForNode(
    node: Element,
    styleAnimList: Record<string, StyleAnimType>,
    fallback: StyleAnimType,
): StyleAnimType {
    const effect =
        node instanceof HTMLElement
            ? node.dataset[TRANSITION_DATASET_KEY]
            : undefined;
    return (
        (effect === undefined ? undefined : styleAnimList[effect]) ?? fallback
    );
}

function checkIsZoomContainer(targetElement: HTMLElement): boolean {
    return targetElement.classList.contains(ZOOM_CONTAINER_CLASS);
}

/**
 * The node `zoom` animates for `targetElement`: its `.zoom-container`. A
 * caller hands over whatever it appended, which for a foreground overlay is
 * the inner element, never the wrapper zoom put around it.
 */
function toZoomTarget(targetElement: HTMLElement): HTMLElement {
    if (checkIsZoomContainer(targetElement)) {
        return targetElement;
    }
    const parentElement = targetElement.parentElement;
    if (parentElement !== null && checkIsZoomContainer(parentElement)) {
        return parentElement;
    }
    return targetElement;
}

const easingFunctions = {
    linear: (k: number) => {
        return k;
    },
    'ease-in': (k: number) => {
        return Math.pow(k, 1.675);
    },
    'ease-out': (k: number) => {
        return 1 - Math.pow(1 - k, 1.675);
    },
    'ease-in-out': (k: number) => {
        return 0.5 * (Math.sin((k - 0.5) * Math.PI) + 1);
    },
};

export type EasingFuncType = keyof typeof easingFunctions;

export type GenAnimPropsType = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};

function genCssProps(duration: number) {
    const cssProps: CSSProperties = {
        animationDuration: `${Math.round(duration / 1000)}s`,
        animationFillMode: 'forwards',
    };
    return cssProps;
}

/**
 * A cut, both ways. It used to fade the outgoing item for a second, so "No
 * Transition" still left the old slide showing through the new one.
 */
function none(_prefix: string): StyleAnimType {
    const anim: StyleAnimType = {
        duration: 0,
        styleText: '',
        animIn: (targetElement: HTMLElement, parentElement: HTMLElement) => {
            parentElement.appendChild(targetElement);
            tagTransitionNode(targetElement, 'none');
            return Promise.resolve();
        },
        animOut: (_targetElement: HTMLElement) => {
            return Promise.resolve();
        },
    };
    return anim;
}

function fade(prefix: string) {
    const uniqueId = crypto.randomUUID();
    const animationNameIn = `${prefix}-animation-fade-${uniqueId}-in`;
    const animationNameOut = `${prefix}-animation-fade-${uniqueId}-out`;
    // TODO: fix backdrop filter stop working during animation
    const styleText = `
            @keyframes ${animationNameIn} {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            @keyframes ${animationNameOut} {
                from {
                    opacity: 1;
                }
                to {
                    opacity: 0;
                }
            }
        `;
    const anim: StyleAnimType = {
        duration: 1000,
        styleText,
        animIn: (targetElement: HTMLElement, parentElement: HTMLElement) => {
            return new Promise((resolve) => {
                // What the element asked for before the fade borrowed its
                // opacity. A foreground widget's Opacity slider writes it
                // straight onto `style.opacity` through `extraStyle`, and
                // restoring a flat `1` here put every widget back to fully
                // opaque one second after it appeared.
                const authoredOpacity = targetElement.style.opacity || '1';
                parentElement.appendChild(targetElement);
                tagTransitionNode(targetElement, 'fade');
                Object.assign(targetElement.style, {
                    ...genCssProps(anim.duration),
                    animationName: animationNameIn,
                    opacity: 0,
                });
                setTimeout(() => {
                    if (
                        targetElement.style.animationName === animationNameOut
                    ) {
                        // Already on its way out: nothing to settle, but an
                        // awaiting caller (Quick Text waits out its entrance)
                        // must not be left hanging.
                        resolve();
                        return;
                    }
                    Object.assign(targetElement.style, {
                        animationName: '',
                        opacity: authoredOpacity,
                    });
                    resolve();
                }, anim.duration + ANIM_END_DELAY_MILLISECOND);
            });
        },
        animOut: (targetElement: HTMLElement) => {
            return new Promise((resolve) => {
                Object.assign(targetElement.style, {
                    ...genCssProps(anim.duration),
                    animationName: animationNameOut,
                    opacity: 1,
                });
                setTimeout(() => {
                    Object.assign(targetElement.style, {
                        opacity: '0',
                    });
                    resolve();
                }, anim.duration + ANIM_END_DELAY_MILLISECOND);
            });
        },
    };
    return anim;
}

function move() {
    const movingMaker = ({
        from,
        to,
        durationMil,
        easing,
        callback,
    }: {
        from: number;
        to: number;
        durationMil: number;
        easing?: EasingFuncType;
        callback: (n: number, isDone?: boolean) => void;
    }) => {
        const distDiff = to - from;
        const easeFn = easingFunctions[easing ?? 'ease-in'];
        const startTime = Date.now();
        const step = () => {
            const timeNow = Date.now();
            const elapsed = timeNow - startTime;
            const factor = elapsed / durationMil;
            if (factor >= 1) {
                callback(to, true);
                return;
            }
            const newPos = from + easeFn(Math.abs(factor)) * distDiff;
            callback(newPos);
            globalThis.requestAnimationFrame(step);
        };
        globalThis.requestAnimationFrame(step);
    };
    // The individual `translate` property, never `left`: a foreground overlay
    // is positioned with its own `left` (`50%` plus an offset), and writing
    // `left` here left it at the screen's left edge. `translate` also applies
    // on top of an element's `transform` (a slide's scale), so it shifts in the
    // parent's own layout pixels -- the width is read as `offsetWidth` for the
    // same reason, which stays right inside the scaled mini screen where a
    // `getBoundingClientRect` width does not.
    //
    // The outgoing item is not pushed from here any more: it runs its own
    // `animOut`, the way it came in, so two "Slide In" items still look like
    // one pushing the other.
    const anim: StyleAnimType = {
        duration: 500,
        styleText: '',
        animIn: (targetElement: HTMLElement, parentElement: HTMLElement) => {
            return new Promise<void>((resolve) => {
                parentElement.appendChild(targetElement);
                tagTransitionNode(targetElement, 'move');
                const from = -parentElement.offsetWidth;
                const targetStyle = targetElement.style;
                targetStyle.translate = `${from}px 0px`;
                movingMaker({
                    from,
                    to: 0,
                    durationMil: anim.duration,
                    callback: (n, isDone) => {
                        if (isDone) {
                            // Nothing left at rest.
                            targetStyle.translate = '';
                            resolve();
                            return;
                        }
                        targetStyle.translate = `${n}px 0px`;
                    },
                });
            });
        },
        animOut: (targetElement: HTMLElement) => {
            return new Promise<void>((resolve) => {
                const width = targetElement.parentElement?.offsetWidth ?? 0;
                movingMaker({
                    from: 0,
                    to: width,
                    durationMil: anim.duration,
                    callback: (n, isDone) => {
                        targetElement.style.translate = `${n}px 0px`;
                        if (isDone) {
                            resolve();
                        }
                    },
                });
            });
        },
    };
    return anim;
}

function zoom(prefix: string): StyleAnimType {
    const uniqueId = crypto.randomUUID();
    const animationNameIn = `${prefix}-animation-zoom-${uniqueId}-in`;
    const animationNameOut = `${prefix}-animation-zoom-${uniqueId}-out`;
    const createDiv = (targetElement: HTMLElement) => {
        const div = document.createElement('div');
        div.classList.add('zoom-container');
        div.appendChild(targetElement);
        return div;
    };
    // TODO: fix backdrop filter stop working during animation
    const styleText = `
            .zoom-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
            }
            @keyframes ${animationNameIn} {
                from {
                    opacity: 0;
                    transform: scale(0.1);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            @keyframes ${animationNameOut} {
                from {
                    opacity: 1;
                    transform: scale(1);
                }
                to {
                    opacity: 0;
                    transform: scale(0.1);
                }
            }
        `;
    const anim: StyleAnimType = {
        duration: 500,
        styleText,
        animIn: (targetElement: HTMLElement, parentElement: HTMLElement) => {
            return new Promise((resolve) => {
                const div = createDiv(targetElement);
                tagTransitionNode(div, 'zoom');
                Object.assign(div.style, {
                    ...genCssProps(anim.duration),
                    animationName: animationNameIn,
                    opacity: 0,
                    transform: 'scale(0.1)',
                });
                parentElement.appendChild(div);
                setTimeout(() => {
                    if (div.style.animationName === animationNameOut) {
                        resolve();
                        return;
                    }
                    // Cleared rather than left at `scale(1)`/`1`: ANY transform
                    // makes the wrapper a stacking context, and a foreground
                    // overlay inside one blends with nothing but its own
                    // wrapper -- every blend mode a silent no-op for as long as
                    // it stayed up (memory `foreground-blend-mode-stacking`).
                    Object.assign(div.style, {
                        animationName: '',
                        opacity: '',
                        transform: '',
                    });
                    resolve();
                }, anim.duration + ANIM_END_DELAY_MILLISECOND);
            });
        },
        animOut: (targetElement: HTMLElement) => {
            return new Promise((resolve) => {
                const zoomTarget = toZoomTarget(targetElement);
                if (!checkIsZoomContainer(zoomTarget)) {
                    // Never zoomed in, so it has no wrapper to scale -- and its
                    // own `transform` (a slide's scale) is not ours to replace.
                    return resolve();
                }
                Object.assign(zoomTarget.style, {
                    ...genCssProps(anim.duration),
                    animationName: animationNameOut,
                    opacity: 1,
                    transform: 'scale(1)',
                });
                setTimeout(() => {
                    Object.assign(zoomTarget.style, {
                        opacity: 0,
                        transform: 'scale(0.1)',
                    });
                    resolve();
                }, anim.duration + ANIM_END_DELAY_MILLISECOND);
            });
        },
    };
    return anim;
}

export const styleAnimList = {
    none,
    fade,
    move,
    zoom,
};
export const transitionEffect = {
    none: ['bi bi-ban'],
    fade: ['bi bi-shadows'],
    move: ['bi bi-align-end'],
    zoom: ['bi bi-arrows-fullscreen'],
} as const;
export type TransitionEffectType = keyof typeof transitionEffect;

export function useScreenEffectEvents(
    events: PTFEventType[],
    screenEffectManager: ScreenEffectManager,
    callback?: () => void,
) {
    const [_n, setN] = useState(Date.now());

    const callbackRef = useAppCurrentRef(callback);

    useAppEffect(() => {
        const update = (_data: any, time: number) => {
            setN(time);
            callbackRef.current?.();
        };
        const instanceEvents = screenEffectManager.registerEventListener(
            events,
            update,
        );
        return () => {
            screenEffectManager.unregisterEventListener(instanceEvents);
        };
    }, [JSON.stringify(events)]);
}
