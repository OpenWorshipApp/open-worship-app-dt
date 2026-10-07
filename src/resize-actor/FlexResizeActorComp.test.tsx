// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../helper/mediaControlHelpers', () => ({
    checkMediaPlaying: () => false,
}));
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (func: () => void) => {
        func();
    },
}));

import FlexResizeActorComp, {
    clampKeyboardResizeStep,
    toKeyboardResizeStep,
    type ResizeKindType,
} from './FlexResizeActorComp';

// Where a floating widget's backdrop blur puts the containing block of the
// fixed `.mover`: 80px right of and 60px below the viewport origin.
const ORIGIN_X = 80;
const ORIGIN_Y = 60;
const MOVER_SIZE = 40;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

function renderActor(type: ResizeKindType) {
    act(() => {
        root.render(
            <FlexResizeActorComp
                type={type}
                isDisableQuickResize={false}
                checkSize={() => {}}
                disableWidget={() => {}}
                checkCanClose={() => null}
            />,
        );
    });
    const actor = container.querySelector('.flex-resize-actor') as HTMLElement;
    const mover = actor.querySelector('.mover') as HTMLDivElement;
    // jsdom has no layout: answer as the browser does for a fixed box inside a
    // blurred widget, offset by the widget and by translate(-45%, -45%).
    const measure = vi.fn(() => {
        const left = Number.parseFloat(mover.style.left || '0');
        const top = Number.parseFloat(mover.style.top || '0');
        return {
            left: ORIGIN_X + left - MOVER_SIZE * 0.45,
            top: ORIGIN_Y + top - MOVER_SIZE * 0.45,
            width: MOVER_SIZE,
            height: MOVER_SIZE,
        } as DOMRect;
    });
    mover.getBoundingClientRect = measure;
    return { actor, mover, measure };
}

function moveOver(actor: HTMLElement, clientX: number, clientY: number) {
    act(() => {
        actor.dispatchEvent(
            new MouseEvent('mousemove', { bubbles: true, clientX, clientY }),
        );
    });
}

describe('FlexResizeActorComp mover', () => {
    test('a horizontal bar puts the arrows at the cursor x inside an offset containing block', () => {
        const { actor, mover, measure } = renderActor('v');
        moveOver(actor, 300, 500);
        expect(mover.style.left).toBe(`${300 - ORIGIN_X}px`);
        expect(mover.style.top).toBe('');
        moveOver(actor, 310, 500);
        expect(mover.style.left).toBe(`${310 - ORIGIN_X}px`);
        // Measured once per hover, not on every move.
        expect(measure).toHaveBeenCalledTimes(1);
    });

    test('a vertical bar puts the arrows at the cursor y inside an offset containing block', () => {
        const { actor, mover } = renderActor('h');
        moveOver(actor, 300, 500);
        expect(mover.style.top).toBe(`${500 - ORIGIN_Y}px`);
        expect(mover.style.left).toBe('');
    });

    test('leaving the bar measures again on the next hover', () => {
        const { actor, measure } = renderActor('v');
        moveOver(actor, 300, 500);
        act(() => {
            actor.dispatchEvent(
                new MouseEvent('mouseout', {
                    bubbles: true,
                    relatedTarget: document.body,
                }),
            );
        });
        moveOver(actor, 320, 500);
        expect(measure).toHaveBeenCalledTimes(2);
    });
});

// A divider is a window splitter for the keyboard too (2026-10-06): it took
// no focus, so its Reset Size / Close Widget menu and any resize were
// mouse-only.
describe('FlexResizeActorComp keyboard', () => {
    function renderBetweenPanes(
        type: ResizeKindType,
        { preSize = 300, nextSize = 300, minSize = 50 } = {},
    ) {
        const checkSize = vi.fn();
        act(() => {
            root.render(
                <div className="d-flex">
                    <div data-min-size={minSize} style={{ flexGrow: 1 }} />
                    <FlexResizeActorComp
                        type={type}
                        isDisableQuickResize={false}
                        checkSize={checkSize}
                        disableWidget={() => {}}
                        checkCanClose={() => null}
                    />
                    <div data-min-size={minSize} style={{ flexGrow: 1 }} />
                </div>,
            );
        });
        const actor = container.querySelector(
            '.flex-resize-actor',
        ) as HTMLElement;
        const [preNode, nextNode] = [
            actor.previousElementSibling as HTMLElement,
            actor.nextElementSibling as HTMLElement,
        ];
        // jsdom lays nothing out: the panes answer with fixed sizes.
        for (const [node, size] of [
            [preNode, preSize],
            [nextNode, nextSize],
        ] as const) {
            Object.defineProperty(node, 'offsetWidth', { value: size });
            Object.defineProperty(node, 'offsetHeight', { value: size });
        }
        return { actor, preNode, nextNode, checkSize };
    }

    function pressKey(actor: HTMLElement, key: string, shiftKey = false) {
        const event = new KeyboardEvent('keydown', {
            key,
            shiftKey,
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            actor.dispatchEvent(event);
        });
        return event;
    }

    test('takes focus and says it is a splitter with a value', () => {
        const { actor } = renderBetweenPanes('h');
        expect(actor.tabIndex).toBe(0);
        expect(actor.getAttribute('role')).toBe('separator');
        expect(actor.getAttribute('aria-valuemin')).toBe('0');
        expect(actor.getAttribute('aria-valuemax')).toBe('100');
        act(() => {
            actor.focus();
        });
        expect(actor.getAttribute('aria-valuenow')).toBe('50');
    });

    test('an arrow along its axis moves it and saves the size', () => {
        const { actor, preNode, nextNode, checkSize } = renderBetweenPanes('h');
        const event = pressKey(actor, 'ArrowRight');
        expect(event.defaultPrevented).toBe(true);
        // 300/300 -> 320/280 of a combined grow of 2.
        expect(Number(preNode.style.flexGrow)).toBeCloseTo((2 * 320) / 600);
        expect(Number(nextNode.style.flexGrow)).toBeCloseTo((2 * 280) / 600);
        expect(checkSize).toHaveBeenCalledTimes(1);
        // The panes take the pointer again: a keyboard move is not a drag.
        expect(preNode.style.pointerEvents).toBe('auto');
        expect(actor.classList.contains('active')).toBe(false);
    });

    test('Shift takes a bigger step, and a top/bottom divider answers Up/Down', () => {
        const { actor, preNode } = renderBetweenPanes('v');
        pressKey(actor, 'ArrowUp', true);
        expect(Number(preNode.style.flexGrow)).toBeCloseTo((2 * 200) / 600);
    });

    test('the other axis is left alone', () => {
        const { actor, preNode, checkSize } = renderBetweenPanes('h');
        const event = pressKey(actor, 'ArrowDown');
        expect(event.defaultPrevented).toBe(false);
        expect(preNode.style.flexGrow).toBe('1');
        expect(checkSize).not.toHaveBeenCalled();
    });

    test('never shrinks a pane past its minimum, so it never collapses', () => {
        const { actor, preNode, checkSize } = renderBetweenPanes('h', {
            preSize: 60,
            nextSize: 540,
        });
        pressKey(actor, 'ArrowLeft', true);
        expect(Number(preNode.style.flexGrow)).toBeCloseTo((2 * 50) / 600);
        expect(checkSize).toHaveBeenCalledTimes(1);
    });

    test('at the minimum already, a press moves nothing and saves nothing', () => {
        const { actor, preNode, checkSize } = renderBetweenPanes('h', {
            preSize: 50,
            nextSize: 550,
        });
        pressKey(actor, 'ArrowLeft');
        expect(preNode.style.flexGrow).toBe('1');
        expect(checkSize).not.toHaveBeenCalled();
    });
});

describe('keyboard resize steps', () => {
    test('map an arrow to a signed step along the divider', () => {
        expect(toKeyboardResizeStep('h', 'ArrowLeft', false)).toBe(-20);
        expect(toKeyboardResizeStep('h', 'ArrowRight', true)).toBe(100);
        expect(toKeyboardResizeStep('h', 'ArrowUp', false)).toBe(null);
        expect(toKeyboardResizeStep('v', 'ArrowDown', false)).toBe(20);
        expect(toKeyboardResizeStep('v', 'Enter', false)).toBe(null);
    });

    test('are clamped to the room either pane has above its minimum', () => {
        const sizes = { preSize: 100, nextSize: 100, preMinSize: 80 };
        expect(
            clampKeyboardResizeStep({ step: -50, nextMinSize: 0, ...sizes }),
        ).toBe(-20);
        expect(
            clampKeyboardResizeStep({ step: 50, nextMinSize: 90, ...sizes }),
        ).toBe(10);
        expect(
            clampKeyboardResizeStep({ step: 50, nextMinSize: 120, ...sizes }),
        ).toBe(0);
    });
});
