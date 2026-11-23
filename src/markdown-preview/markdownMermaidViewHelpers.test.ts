// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    attachMermaidViewControls,
    removeMermaidViewControls,
} from './markdownMermaidViewHelpers';

const LABELS = {
    pan: 'pan it',
    zoomOut: 'smaller',
    zoomIn: 'bigger',
    reset: 'as drawn',
};

let container: HTMLDivElement;
let diagram: HTMLDivElement;
let svg: SVGSVGElement;
let detach: () => void;
const genLabels = vi.fn(() => LABELS);

function over(element: Element) {
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
}

function press(action: string) {
    const button = diagram.querySelector<HTMLButtonElement>(
        `[data-mermaid-action="${action}"]`,
    );
    button?.click();
    return button;
}

function pointer(type: string, clientX: number, clientY: number, button = 0) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button,
    });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    return event;
}

beforeEach(() => {
    genLabels.mockClear();
    container = document.createElement('div');
    container.innerHTML =
        '<p>words</p>' +
        '<div class="app-markdown-mermaid app-markdown-mermaid--rendered" ' +
        'data-mermaid-index="0"><svg style="max-width: 400px;"><g></g></svg>' +
        '</div>' +
        '<div class="app-markdown-mermaid" data-mermaid-index="1">' +
        '<pre><code>not drawn</code></pre></div>';
    document.body.append(container);
    diagram = container.querySelector<HTMLDivElement>(
        '[data-mermaid-index="0"]',
    )!;
    svg = diagram.querySelector('svg')!;
    // The diagram's box on the page: 400 by 200 at (100, 50), its picture
    // filling it.
    diagram.getBoundingClientRect = () => {
        return new DOMRect(100, 50, 400, 200);
    };
    svg.getBoundingClientRect = () => {
        const [x = 0, y = 0] = (svg.dataset.appView ?? '')
            .split(' ')
            .map(Number);
        return new DOMRect(100 + x, 50 + y, 400, 200);
    };
    detach = attachMermaidViewControls(container, genLabels);
});

afterEach(() => {
    detach();
    container.remove();
});

describe('the buttons of a drawn diagram', () => {
    test('are made once, when it first comes under the mouse', () => {
        expect(container.querySelector('button')).toBeNull();
        over(container.querySelector('p')!);
        over(container.querySelector('[data-mermaid-index="1"] code')!);
        expect(container.querySelector('button')).toBeNull();
        expect(genLabels).not.toHaveBeenCalled();

        over(svg.querySelector('g')!);
        over(svg);
        expect(genLabels).toHaveBeenCalledTimes(1);
        const buttons = [...diagram.querySelectorAll('button')];
        expect(buttons.map((button) => button.title)).toEqual([
            'pan it',
            'smaller',
            'bigger',
            'as drawn',
        ]);
        expect(
            buttons.map((button) => button.getAttribute('aria-label')),
        ).toEqual(['pan it', 'smaller', 'bigger', 'as drawn']);
        // The picture is still the box's first `<svg>`, as the Word
        // document reads it.
        expect(diagram.querySelector('svg')).toBe(svg);
    });

    test('zoom about the middle of the box, and reset', () => {
        over(svg);
        press('zoom-in');
        // The middle of the box, (200, 100) in the picture, stays put.
        expect(svg.dataset.appView).toBe('-50 -25 1.25');
        expect(svg.style.transform).toBe('translate(-50px, -25px) scale(1.25)');
        expect(svg.style.transformOrigin).toBe('0 0');
        press('zoom-out');
        expect(svg.dataset.appView).toBeUndefined();
        expect(svg.style.transform).toBe('');
        expect(svg.style.maxWidth).toBe('400px');

        press('zoom-out');
        expect(svg.dataset.appView).toBe('40 20 0.8');
        press('reset');
        expect(svg.dataset.appView).toBeUndefined();
        expect(svg.getAttribute('style')).toBe('max-width: 400px;');
    });

    test('zoom stops at its ends', () => {
        over(svg);
        for (let count = 0; count < 40; count++) {
            press('zoom-in');
        }
        expect(Number(svg.dataset.appView?.split(' ')[2])).toBe(10);
        for (let count = 0; count < 80; count++) {
            press('zoom-out');
        }
        expect(Number(svg.dataset.appView?.split(' ')[2])).toBe(0.2);
    });

    test('a drag moves the picture only while drag-to-move is on', () => {
        over(svg);
        const down = pointer('pointerdown', 150, 150);
        svg.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(false);
        diagram.dispatchEvent(pointer('pointermove', 180, 140));
        expect(svg.style.transform).toBe('');

        const panButton = press('pan')!;
        expect(panButton.getAttribute('aria-pressed')).toBe('true');
        expect(diagram.classList.contains('app-markdown-mermaid--pan')).toBe(
            true,
        );
        // Not with another button, nor from the buttons themselves.
        svg.dispatchEvent(pointer('pointerdown', 150, 150, 2));
        panButton.dispatchEvent(pointer('pointerdown', 150, 150));
        diagram.dispatchEvent(pointer('pointermove', 180, 140));
        expect(svg.style.transform).toBe('');

        const panDown = pointer('pointerdown', 150, 150);
        svg.dispatchEvent(panDown);
        expect(panDown.defaultPrevented).toBe(true);
        expect(
            diagram.classList.contains('app-markdown-mermaid--panning'),
        ).toBe(true);
        diagram.dispatchEvent(pointer('pointermove', 180, 140));
        expect(svg.style.transform).toBe('translate(30px, -10px) scale(1)');
        // Kept in the picture once the drag ends.
        expect(svg.dataset.appView).toBeUndefined();
        diagram.dispatchEvent(pointer('pointerup', 180, 140));
        expect(svg.dataset.appView).toBe('30 -10 1');
        expect(
            diagram.classList.contains('app-markdown-mermaid--panning'),
        ).toBe(false);
        diagram.dispatchEvent(pointer('pointermove', 300, 300));
        expect(svg.dataset.appView).toBe('30 -10 1');

        press('pan');
        expect(panButton.getAttribute('aria-pressed')).toBe('false');
        svg.dispatchEvent(pointer('pointerdown', 150, 150));
        diagram.dispatchEvent(pointer('pointermove', 0, 0));
        expect(svg.dataset.appView).toBe('30 -10 1');
    });

    test('the wheel zooms under the mouse only while drag-to-move is on', () => {
        over(svg);
        const wheel = () => {
            const event = new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaY: -100,
                clientX: 100,
                clientY: 50,
            });
            svg.dispatchEvent(event);
            return event;
        };
        // Off: the page scrolls as ever.
        expect(wheel().defaultPrevented).toBe(false);
        expect(svg.dataset.appView).toBeUndefined();

        press('pan');
        expect(wheel().defaultPrevented).toBe(true);
        // The picture's corner is under the mouse, so it stays there.
        const [x, y, scale] = svg.dataset.appView!.split(' ').map(Number);
        expect([x, y]).toEqual([0, 0]);
        expect(scale).toBeCloseTo(Math.exp(0.15));

        press('pan');
        expect(wheel().defaultPrevented).toBe(false);
    });

    test('are taken off before the pictures are kept, the view staying', () => {
        over(svg);
        press('zoom-in');
        removeMermaidViewControls(container);
        expect(container.querySelector('button')).toBeNull();
        expect(diagram.innerHTML).toContain('data-app-view="-50 -25 1.25"');
        expect(diagram.innerHTML).toContain('scale(1.25)');
        // And made again on the next pass of the mouse.
        over(svg);
        expect(diagram.querySelectorAll('button')).toHaveLength(4);
    });

    test('nothing answers once detached', () => {
        detach();
        over(svg);
        expect(container.querySelector('button')).toBeNull();
    });
});
