import type { TransitionEffectType } from '../transitionEffectHelpers';
import { toValidTransitionEffect } from '../transitionOverrideHelpers';

type ItemTransitionType = {
    node: HTMLElement;
    effect: TransitionEffectType;
    duration: number;
    animation?: Animation;
};

/** Owns only the current slide and slides that are still leaving the screen. */
export class CanvasItemTransitions {
    private slides = new Map<HTMLElement, ItemTransitionType[]>();
    private exiting = new Map<HTMLElement, Promise<void>>();

    has(slide: HTMLElement) {
        return this.slides.has(slide);
    }

    enter(
        slide: HTMLElement,
        content: HTMLElement,
        inherited: TransitionEffectType,
        durationFor: (effect: TransitionEffectType) => number,
    ) {
        // Direct children only: user HTML must not impersonate canvas items.
        const nodes = Array.from(content.children).filter(
            (node): node is HTMLElement =>
                node instanceof HTMLElement &&
                node.hasAttribute('data-canvas-item-uuid'),
        );
        if (
            !nodes.some(
                (node) =>
                    toValidTransitionEffect(
                        node.dataset.canvasItemTransition,
                    ) !== undefined,
            )
        ) {
            return false;
        }
        const items = nodes.map((node) => {
            const effect =
                toValidTransitionEffect(node.dataset.canvasItemTransition) ??
                inherited;
            return { node, effect, duration: durationFor(effect) };
        });
        this.slides.set(slide, items);
        for (const item of items) {
            this.animate(item, true);
        }
        return true;
    }

    exit(slide: HTMLElement): Promise<void> {
        const pending = this.exiting.get(slide);
        if (pending !== undefined) {
            return pending;
        }
        const items = this.slides.get(slide) ?? [];
        const done = Promise.all(
            items.map((item) => this.animate(item, false)),
        ).then(() => {
            for (const item of items) {
                item.animation?.cancel();
            }
            this.slides.delete(slide);
            this.exiting.delete(slide);
        });
        this.exiting.set(slide, done);
        return done;
    }

    private animate(
        item: ItemTransitionType,
        isEntering: boolean,
    ): Promise<void> {
        const { node, effect, duration } = item;
        // Continue an interrupted entrance from its current visual position.
        const current =
            item.animation === undefined ? null : getComputedStyle(node);
        const opacity = current?.opacity ?? (node.style.opacity || '1');
        const translate = current?.translate ?? '0px 0px';
        const scale = current?.scale ?? '1';
        item.animation?.cancel();
        if (effect === 'none' || typeof node.animate !== 'function') {
            if (!isEntering) {
                node.style.visibility = 'hidden';
            }
            return Promise.resolve();
        }
        let frames: Keyframe[];
        if (effect === 'move') {
            const width = node.parentElement?.offsetWidth ?? 0;
            frames = isEntering
                ? [{ translate: `${-width}px 0px` }, { translate: '0px 0px' }]
                : [{ translate }, { translate: `${width}px 0px` }];
        } else if (effect === 'zoom') {
            frames = isEntering
                ? [
                      { opacity: 0, scale: '0.1' },
                      { opacity, scale: '1' },
                  ]
                : [
                      { opacity, scale },
                      { opacity: 0, scale: '0.1' },
                  ];
        } else {
            frames = isEntering
                ? [{ opacity: 0 }, { opacity }]
                : [{ opacity }, { opacity: 0 }];
        }
        // Individual scale/translate preserve authored rotation and box layout.
        // No wrapper: blending still sees the other items underneath this one.
        const animation = node.animate(frames, {
            duration,
            easing: 'ease-in-out',
            fill: 'both',
        });
        item.animation = animation;
        return animation.finished.then(
            () => {
                if (item.animation !== animation) {
                    return;
                }
                if (!isEntering) {
                    node.style.visibility = 'hidden';
                }
                animation.cancel();
                item.animation = undefined;
            },
            () => {
                // Cancellation is expected on rapid slide changes or unmount.
            },
        );
    }

    dispose() {
        for (const items of this.slides.values()) {
            for (const item of items) {
                item.animation?.cancel();
            }
        }
        this.slides.clear();
        this.exiting.clear();
    }
}
