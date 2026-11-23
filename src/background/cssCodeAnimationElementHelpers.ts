import {
    ANIMATION_SPEED_FACTOR_MAP,
    type CssAnimationType,
} from './animationValueHelpers';
import {
    genCssCodeBoxes,
    genCssCodeFrameCss,
    genCssCodeStillCss,
    type CssCodeBoxType,
} from './cssCodeAnimationHelpers';

/**
 * A person's own CSS animation drawn (2026-11-19, the goal _chatbot can
 * help handle css and glsl code editing_): on a screen, over the slide
 * (Animation Show), in a tile and in the CSS Code panel's preview.
 *
 * The code goes into a SHADOW ROOT of a box of its own, so its rules style
 * the animation's boxes and nothing else on the screen -- not the slide's
 * words, not a Bible verse, not the app around a tile. The box is
 * `contain: strict`: a `position: fixed` in the code is held inside it and
 * cut to it, and nothing in it can rise over what is drawn above it. What
 * the code may say at all is `checkCssCodeProblem`'s (no address, no
 * escape, keyframes on the compositor only); a value that fails it never
 * parses, so it never reaches here.
 *
 * Speed is every animation's `playbackRate`, set as each one starts -- the
 * code writes its durations as at normal speed. Where it is not moving
 * every animation is held where it starts (`genCssCodeStillCss`).
 */

function appendBox(parent: HTMLElement, box: CssCodeBoxType) {
    const element = parent.ownerDocument.createElement('div');
    element.className = box.className;
    for (const [name, value] of Object.entries(box.variables)) {
        element.style.setProperty(name, value);
    }
    for (const child of box.children) {
        appendBox(element, child);
    }
    parent.appendChild(element);
}

export function genCssCodeAnimationElement(
    animation: CssAnimationType,
    {
        isMoving,
        isOnScreen = isMoving,
        targetDocument = document,
    }: {
        isMoving: boolean;
        /** Presented: reduced motion does not stop it (a tile it does). */
        isOnScreen?: boolean;
        targetDocument?: Document;
    },
): { element: HTMLDivElement; stop: () => void } {
    const element = targetDocument.createElement('div');
    Object.assign(element.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        contain: 'strict',
        opacity: `${animation.opacity / 100}`,
    });
    const shadowRoot = element.attachShadow({ mode: 'open' });
    const code = animation.code ?? '';
    const frameStyle = targetDocument.createElement('style');
    frameStyle.textContent = genCssCodeFrameCss(animation);
    // The person's code, as text: a style sheet, never markup.
    const codeStyle = targetDocument.createElement('style');
    codeStyle.textContent = code;
    const stillStyle = targetDocument.createElement('style');
    stillStyle.textContent = genCssCodeStillCss(isMoving, isOnScreen);
    const scene = targetDocument.createElement('div');
    scene.className = 'scene';
    for (const box of genCssCodeBoxes(code, animation.density)) {
        appendBox(scene, box);
    }
    shadowRoot.append(frameStyle, codeStyle, stillStyle, scene);
    const factor = ANIMATION_SPEED_FACTOR_MAP[animation.speed];
    if (!isMoving || factor === 1) {
        return { element, stop: () => {} };
    }
    // Each animation as it starts; one with a delay starts later. The
    // subtree takes a `::before`'s, whose event names the box it is on.
    const onAnimationStart = (event: Event) => {
        const target = event.target as Element | null;
        for (const one of target?.getAnimations?.({ subtree: true }) ?? []) {
            one.playbackRate = factor;
        }
    };
    shadowRoot.addEventListener('animationstart', onAnimationStart);
    return {
        element,
        stop: () => {
            shadowRoot.removeEventListener('animationstart', onAnimationStart);
        },
    };
}
