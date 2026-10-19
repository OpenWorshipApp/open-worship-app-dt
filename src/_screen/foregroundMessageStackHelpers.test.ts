// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import { layOutMessageStack } from './foregroundMessageStackHelpers';

/**
 * jsdom lays nothing out, so each box answers `offsetHeight` from a formula:
 * `lines` lines at the font size it currently has, plus fixed padding --
 * enough to see a fit shrink the font and a stack follow the new heights.
 */
function genMessage(lines: number, style: Partial<CSSStyleDeclaration> = {}) {
    const element = document.createElement('div');
    Object.assign(element.style, { fontSize: '100px', ...style });
    Object.defineProperty(element, 'offsetHeight', {
        get() {
            return lines * Number.parseFloat(element.style.fontSize) + 20;
        },
    });
    document.body.appendChild(element);
    return element;
}

describe('layOutMessageStack', () => {
    test('a stack pinned to the top puts each message under the real height of the ones above, wrapped lines included', () => {
        // The first message WRAPPED to three lines; its typed text had one.
        const first = genMessage(3, { top: '0px' });
        const second = genMessage(1, { top: '0px' });
        layOutMessageStack([first, second], 1080);
        expect(first.style.marginTop).toBe('');
        expect(second.style.marginTop).toBe('320px');
    });

    test('a scaled stack is offset by the height each box takes on the wall', () => {
        const first = genMessage(2, { top: '0px', transform: 'scale(1.5)' });
        const second = genMessage(1, {
            top: '0px',
            transform: 'scale(1.5)',
        });
        layOutMessageStack([first, second], 1080);
        expect(second.style.marginTop).toBe('330px');
    });

    test('a stack pinned to the bottom grows upwards, the last message on the edge', () => {
        const first = genMessage(1, { bottom: '0px' });
        const second = genMessage(2, { bottom: '0px' });
        layOutMessageStack([first, second], 1080);
        expect(first.style.marginBottom).toBe('220px');
        expect(second.style.marginBottom).toBe('');
        expect(first.style.marginTop).toBe('');
    });

    test('in the middle each box makes up the difference to the first one it is centred like', () => {
        const first = genMessage(1, { top: '50%' });
        const second = genMessage(3, { top: '50%' });
        layOutMessageStack([first, second], 2000);
        // above (120) + (320 - 120) / 2
        expect(second.style.marginTop).toBe('220px');
    });

    test('a message too tall for the screen is shrunk until it fits, from the size it was given', () => {
        // 8 lines at 100px is 820px on a 720px screen.
        const element = genMessage(8, { top: '0px' });
        layOutMessageStack([element], 720);
        const fitted = Number.parseFloat(element.style.fontSize);
        expect(fitted).toBeLessThan(100);
        expect(element.offsetHeight).toBeLessThanOrEqual(720);
        // As LARGE as still fits (87.5px exactly here), not just smaller: a
        // step down by the overflow alone overshoots once the text rewraps.
        expect(fitted).toBeGreaterThan(86);
        // A second pass starts from the size it was GIVEN, not the fit, so it
        // lands on the same size instead of shrinking again.
        layOutMessageStack([element], 720);
        expect(Number.parseFloat(element.style.fontSize)).toBe(fitted);
        // Once there is room again it goes back to that size exactly.
        layOutMessageStack([element], 5000);
        expect(element.style.fontSize).toBe('100px');
    });

    test('a stack that fits is left at the size it was given', () => {
        const element = genMessage(1, { top: '0px' });
        layOutMessageStack([element], 720);
        expect(element.style.fontSize).toBe('100px');
    });

    test('a stack nobody has laid out (a collapsed preview) keeps the estimate it came with', () => {
        const element = document.createElement('div');
        Object.assign(element.style, { top: '0px', marginTop: '5em' });
        const second = document.createElement('div');
        Object.assign(second.style, { top: '0px', marginTop: '5em' });
        layOutMessageStack([element, second], 720);
        expect(second.style.marginTop).toBe('5em');
    });
});
