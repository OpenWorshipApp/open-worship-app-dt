// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { findClippingAncestors } from './virtualScrollHelpers';

function genElement(style: string, tagName = 'div') {
    const element = document.createElement(tagName);
    element.setAttribute('style', style);
    return element;
}

/** Nests the elements, oldest first, and returns the innermost one. */
function genNested(elementList: HTMLElement[]) {
    for (let index = 0; index < elementList.length - 1; index++) {
        elementList[index].appendChild(elementList[index + 1]);
    }
    document.body.appendChild(elementList[0]);
    return elementList[elementList.length - 1];
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('findClippingAncestors', () => {
    it('takes every scrolling or hiding ancestor of a plain element', () => {
        const outer = genElement('overflow-y: hidden;');
        const scroller = genElement('overflow-y: auto;');
        const plain = genElement('');
        const list = genElement('');
        genNested([outer, scroller, plain, list]);
        expect(findClippingAncestors(list)).toEqual([scroller, outer]);
    });

    it('leaves out an ancestor that does not clip', () => {
        const visible = genElement('overflow: visible;');
        const list = genElement('');
        genNested([visible, list]);
        expect(findClippingAncestors(list)).toEqual([]);
    });

    it('stops at a fixed ancestor: nothing above it clips it', () => {
        // The Foreground panel. Its own `overflow: hidden` counts; the
        // presenter's, which ends above the panel, does not -- intersecting
        // with that made the panel's grid render nothing at all.
        const presenter = genElement('overflow-y: hidden;');
        const widget = genElement('position: fixed; overflow-y: hidden;');
        const content = genElement('overflow-y: auto;');
        const list = genElement('');
        genNested([presenter, widget, content, list]);
        expect(findClippingAncestors(list)).toEqual([content, widget]);
    });

    it('lets a transformed ancestor clip a fixed descendant again', () => {
        // A transform makes the element the containing block for `fixed`.
        const holder = genElement(
            'transform: translateX(1px); overflow: hidden;',
        );
        const widget = genElement('position: fixed;');
        const list = genElement('');
        genNested([holder, widget, list]);
        expect(findClippingAncestors(list)).toEqual([holder]);
    });

    it('skips ancestors an absolute element is not laid out inside', () => {
        const positioned = genElement('position: relative; overflow: hidden;');
        const between = genElement('overflow: hidden;');
        const floating = genElement('position: absolute;');
        const list = genElement('');
        genNested([positioned, between, floating, list]);
        expect(findClippingAncestors(list)).toEqual([positioned]);
    });
});
