// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', () => ({
    useAppEffect: vi.fn(),
    useAppCurrentRef: (value: unknown) => ({ current: value }),
}));

import {
    ANIM_END_DELAY_MILLISECOND,
    getStyleAnimForNode,
    styleAnimList,
    transitionEffect,
    TRANSITION_DATASET_KEY,
} from './transitionEffectHelpers';
import {
    TRANSITION_EFFECT_LIST,
    toTransitionPart,
    toValidTransitionEffect,
    withTransitionEffect,
} from './transitionOverrideHelpers';

function genParent() {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    return parent;
}

describe('transition effects', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    test('each effect tags the node it appended with its own name', async () => {
        const parent = genParent();
        for (const effect of ['none', 'fade', 'move'] as const) {
            const element = document.createElement('div');
            void styleAnimList[effect]('test').animIn(element, parent);
            expect(element.parentElement).toBe(parent);
            expect(element.dataset[TRANSITION_DATASET_KEY]).toBe(effect);
        }
        const zoomed = document.createElement('div');
        void styleAnimList.zoom('test').animIn(zoomed, parent);
        // Zoom wraps: the WRAPPER is what sits in the parent and is tagged.
        const wrapper = zoomed.parentElement!;
        expect(wrapper.classList.contains('zoom-container')).toBe(true);
        expect(wrapper.parentElement).toBe(parent);
        expect(wrapper.dataset[TRANSITION_DATASET_KEY]).toBe('zoom');
        expect(zoomed.dataset[TRANSITION_DATASET_KEY]).toBeUndefined();
    });

    test('an outgoing node leaves the way it came in', () => {
        const parent = genParent();
        const list = Object.fromEntries(
            Object.entries(styleAnimList).map(([key, factory]) => {
                return [key, factory('test')];
            }),
        );
        const zoomed = document.createElement('div');
        void list.zoom.animIn(zoomed, parent);
        expect(
            getStyleAnimForNode(parent.lastElementChild!, list, list.fade),
        ).toBe(list.zoom);
        // Rendered before anything tagged it: the layer's own effect.
        const untagged = document.createElement('div');
        expect(getStyleAnimForNode(untagged, list, list.move)).toBe(list.move);
    });

    test('"No Transition" is a cut both ways', async () => {
        const parent = genParent();
        const element = document.createElement('div');
        const anim = styleAnimList.none('test');
        await anim.animIn(element, parent);
        expect(element.style.opacity).toBe('');
        let isDone = false;
        void anim.animOut(element).then(() => {
            isDone = true;
        });
        await Promise.resolve();
        expect(isDone).toBe(true);
    });

    test('a fade puts back the opacity the element asked for', async () => {
        const parent = genParent();
        const element = document.createElement('div');
        element.style.opacity = '0.4';
        const anim = styleAnimList.fade('test');
        const adding = anim.animIn(element, parent);
        await vi.advanceTimersByTimeAsync(
            anim.duration + ANIM_END_DELAY_MILLISECOND,
        );
        await adding;
        expect(element.style.opacity).toBe('0.4');
        expect(element.style.animationName).toBe('');
    });

    test('a zoom leaves no transform at rest and zooms its wrapper out', async () => {
        const parent = genParent();
        const element = document.createElement('div');
        const anim = styleAnimList.zoom('test');
        const adding = anim.animIn(element, parent);
        await vi.advanceTimersByTimeAsync(
            anim.duration + ANIM_END_DELAY_MILLISECOND,
        );
        await adding;
        const wrapper = element.parentElement!;
        // Any transform makes the wrapper a stacking context, and a blend
        // mode inside one blends with nothing but the wrapper.
        expect(wrapper.style.transform).toBe('');
        expect(wrapper.style.opacity).toBe('');
        // Handed the INNER element (what a foreground overlay passes), it
        // still animates the wrapper.
        void anim.animOut(element);
        expect(wrapper.style.animationName).toContain('-out');
        expect(element.style.animationName).toBe('');
    });

    test('Slide In never writes left and never moves a sibling', async () => {
        const parent = genParent();
        const sibling = document.createElement('div');
        sibling.style.left = '50%';
        parent.appendChild(sibling);
        const element = document.createElement('div');
        element.style.left = '50%';
        const anim = styleAnimList.move();
        const adding = anim.animIn(element, parent);
        await vi.advanceTimersByTimeAsync(anim.duration + 100);
        await adding;
        expect(element.style.left).toBe('50%');
        expect(sibling.style.left).toBe('50%');
        expect((element.style as any).translate).toBe('');
    });
});

describe('transition overrides', () => {
    test('the list of effects is the screen menu list', () => {
        expect([...TRANSITION_EFFECT_LIST]).toEqual(
            Object.keys(transitionEffect),
        );
    });

    test('only a real effect counts as an override', () => {
        expect(toValidTransitionEffect('zoom')).toBe('zoom');
        expect(toValidTransitionEffect('sparkle')).toBeUndefined();
        expect(toValidTransitionEffect(null)).toBeUndefined();
        expect(toValidTransitionEffect('')).toBeUndefined();
    });

    test('a datum gets the key only when there is an override', () => {
        expect(toTransitionPart(undefined)).toEqual({});
        expect(toTransitionPart('fade')).toEqual({ transitionEffect: 'fade' });
        const data = { id: 1, transitionEffect: 'zoom' as const };
        const followed = withTransitionEffect(data, undefined);
        // No `transitionEffect: undefined`: `checkAreObjectsEqual` counts keys.
        expect(Object.keys(followed)).toEqual(['id']);
        expect(withTransitionEffect(data, 'move')).toEqual({
            id: 1,
            transitionEffect: 'move',
        });
        // A copy: the argument can be an entry of a memoized map.
        expect(data.transitionEffect).toBe('zoom');
    });
});
