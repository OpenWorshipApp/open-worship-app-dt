// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

import { act } from 'react';
import { createRoot } from 'react-dom/client';

import KeyboardEventListener from '../event/KeyboardEventListener';
import {
    PRESENTING_CONTROL_ID,
    checkIsShadowWidgetTarget,
    checkIsTypingTarget,
    swallowPresentingKeyEvent,
    toPresentingShortcutTitle,
    usePresentingKeyboardSwallow,
    usePresentingToolShortcut,
} from './presentingControlShortcutHelpers';

// The two gates the controller's plain-letter keys pass through before acting.
// They are the whole reason `V` `B` `E` `F` `K` can be bound on `root` while the
// app underneath is live, so they are worth pinning down away from a real
// keyboard.

function dispatchKeyDown(element: Element) {
    let event: KeyboardEvent | null = null;
    const handleKeyDown = (firedEvent: Event) => {
        event = firedEvent as KeyboardEvent;
    };
    element.addEventListener('keydown', handleKeyDown);
    element.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'b', bubbles: true }),
    );
    element.removeEventListener('keydown', handleKeyDown);
    return event as unknown as KeyboardEvent;
}

function appendElement<T extends Element>(element: T) {
    document.body.appendChild(element);
    return element;
}

describe('checkIsTypingTarget', () => {
    test('defers to a field being typed into', () => {
        const textareaElement = appendElement(
            document.createElement('textarea'),
        );
        expect(checkIsTypingTarget(dispatchKeyDown(textareaElement))).toBe(
            true,
        );

        const inputElement = appendElement(document.createElement('input'));
        expect(checkIsTypingTarget(dispatchKeyDown(inputElement))).toBe(true);

        // Monaco edits through the EditContext API, so its editable element is a
        // plain div with no contenteditable attribute.
        const monacoElement = appendElement(document.createElement('div'));
        monacoElement.className = 'monaco-editor';
        const editContextElement = document.createElement('div');
        monacoElement.appendChild(editContextElement);
        expect(checkIsTypingTarget(dispatchKeyDown(editContextElement))).toBe(
            true,
        );
    });

    test('leaves a non-typing target alone', () => {
        const buttonElement = appendElement(document.createElement('button'));
        expect(checkIsTypingTarget(dispatchKeyDown(buttonElement))).toBe(false);

        // An input that cannot be typed into is not typing. Listing the
        // non-typing types is the safe direction — an unknown one counts as
        // typing and the shortcut defers.
        const checkboxElement = appendElement(document.createElement('input'));
        checkboxElement.type = 'checkbox';
        expect(checkIsTypingTarget(dispatchKeyDown(checkboxElement))).toBe(
            false,
        );
    });
});

// What the hook installs on `window`, minus the mount/unmount bookkeeping: one
// capture listener that takes the key before anything else in the page sees it.
function withSwallowing(run: () => void) {
    const handleKeyEvent = (event: Event) => {
        swallowPresentingKeyEvent(event as KeyboardEvent);
    };
    globalThis.addEventListener('keydown', handleKeyEvent, true);
    try {
        run();
    } finally {
        globalThis.removeEventListener('keydown', handleKeyEvent, true);
    }
}

function pressB(element: Element) {
    const event = new KeyboardEvent('keydown', {
        key: 'b',
        code: 'KeyB',
        bubbles: true,
        cancelable: true,
    });
    element.dispatchEvent(event);
    return event;
}

describe('swallowPresentingKeyEvent', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('takes an app-bound key away from the whole page', () => {
        const appListener = vi.fn();
        document.addEventListener('keydown', appListener);
        let event: KeyboardEvent | null = null;
        withSwallowing(() => {
            event = pressB(appendElement(document.createElement('div')));
        });
        document.removeEventListener('keydown', appListener);

        // Nothing downstream runs — not `document.onkeydown` (the app's whole
        // shortcut stack), not a React `onKeyDown` — and the native default
        // (typing, scrolling, Tab) is cancelled.
        expect(appListener).not.toHaveBeenCalled();
        expect(event!.defaultPrevented).toBe(true);
    });

    test('leaves the controller widget its own keys', () => {
        const widgetElement = appendElement(document.createElement('div'));
        widgetElement.id = PRESENTING_CONTROL_ID;
        const sliderElement = document.createElement('input');
        sliderElement.type = 'range';
        widgetElement.appendChild(sliderElement);

        const appListener = vi.fn();
        document.addEventListener('keydown', appListener);
        let event: KeyboardEvent | null = null;
        withSwallowing(() => {
            event = pressB(sliderElement);
        });
        document.removeEventListener('keydown', appListener);

        expect(appListener).toHaveBeenCalledTimes(1);
        expect(event!.defaultPrevented).toBe(false);
    });

    test("replays a swallowed key to the controller's own shortcuts", async () => {
        // The swallow stops `document.onkeydown`, so the controller's keys have
        // to be handed to the keyboard stack directly — and handed over as a
        // stand-in event, because a prevented one is dropped by `checkOnEvent`.
        const shortcutListener = vi.fn();
        const registeredEvents = KeyboardEventListener.registerEventListener(
            [`${KeyboardEventListener.getLastLayer()}>B`],
            shortcutListener,
        );
        withSwallowing(() => {
            pressB(appendElement(document.createElement('div')));
        });
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        KeyboardEventListener.unregisterEventListener(registeredEvents);

        expect(shortcutListener).toHaveBeenCalledTimes(1);
        const replayedEvent = shortcutListener.mock.calls[0][0];
        expect(replayedEvent.defaultPrevented).toBe(false);

        // the stand-in carries the same surface a real event does, so a
        // listener that stops the chain still stops it
        replayedEvent.stopPropagation();
        replayedEvent.stopImmediatePropagation();
        replayedEvent.preventDefault();
        expect(replayedEvent.defaultPrevented).toBe(true);
    });
});

describe('checkIsShadowWidgetTarget', () => {
    test('defers to a focused shadow-hosted widget', () => {
        // How a mini-screen preview looks from the outside: the overlay canvas
        // lives in the shadow root and claims the keyboard by DOM focus, so a
        // keydown retargets to the HOST and only its shadow root knows.
        const hostElement = appendElement(document.createElement('div'));
        const shadowRoot = hostElement.attachShadow({ mode: 'open' });
        const canvasElement = document.createElement('canvas');
        canvasElement.tabIndex = 0;
        shadowRoot.appendChild(canvasElement);

        expect(checkIsShadowWidgetTarget(dispatchKeyDown(hostElement))).toBe(
            false,
        );
        canvasElement.focus();
        expect(checkIsShadowWidgetTarget(dispatchKeyDown(hostElement))).toBe(
            true,
        );
        canvasElement.blur();
        expect(checkIsShadowWidgetTarget(dispatchKeyDown(hostElement))).toBe(
            false,
        );
    });

    test('leaves an ordinary element alone', () => {
        const divElement = appendElement(document.createElement('div'));
        expect(checkIsShadowWidgetTarget(dispatchKeyDown(divElement))).toBe(
            false,
        );
        expect(checkIsShadowWidgetTarget(undefined)).toBe(false);
        expect(checkIsShadowWidgetTarget({ target: null })).toBe(false);
    });
});
describe('presenting control keyboard hooks', () => {
    async function renderHook(callback: () => void) {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        function Probe() {
            callback();
            return null;
        }
        await act(async () => {
            root.render(<Probe />);
        });
        return async () => {
            await act(async () => {
                root.unmount();
            });
            container.remove();
            (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
        };
    }

    test('the swallow listener is attached and detached with the flag', async () => {
        const addSpy = vi.spyOn(globalThis, 'addEventListener');
        const removeSpy = vi.spyOn(globalThis, 'removeEventListener');
        try {
            const unmountIdle = await renderHook(() => {
                usePresentingKeyboardSwallow(false);
            });
            expect(
                addSpy.mock.calls.some(([type]) => type === 'keypress'),
            ).toBe(false);
            await unmountIdle();

            const unmount = await renderHook(() => {
                usePresentingKeyboardSwallow(true);
            });
            for (const eventType of ['keydown', 'keypress', 'keyup']) {
                expect(
                    addSpy.mock.calls.some(([type]) => type === eventType),
                ).toBe(true);
            }

            // an armed overlay takes the key away from the page underneath
            const appListener = vi.fn();
            document.addEventListener('keydown', appListener);
            const target = appendElement(document.createElement('div'));
            target.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'b', bubbles: true }),
            );
            document.removeEventListener('keydown', appListener);
            expect(appListener).not.toHaveBeenCalled();

            await unmount();
            for (const eventType of ['keydown', 'keypress', 'keyup']) {
                expect(
                    removeSpy.mock.calls.some(([type]) => type === eventType),
                ).toBe(true);
            }
        } finally {
            addSpy.mockRestore();
            removeSpy.mockRestore();
        }
    });

    test('a tool shortcut fires once per press and defers while typing', async () => {
        const handle = vi.fn();
        const unmount = await renderHook(() => {
            usePresentingToolShortcut('usePaint', handle);
        });

        const fire = (extra: Record<string, unknown> = {}) => {
            KeyboardEventListener.fireEvent({
                key: 'b',
                code: 'KeyB',
                type: 'keydown',
                target: document.body,
                preventDefault: () => {},
                stopPropagation: () => {},
                ...extra,
            } as any);
        };

        fire();
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(handle).toHaveBeenCalledTimes(1);

        // a held key must not flap the tool ~30 times a second
        fire({ repeat: true });
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(handle).toHaveBeenCalledTimes(1);

        // whatever holds the keyboard wins while the app underneath is live
        const inputElement = appendElement(document.createElement('input'));
        fire({ target: inputElement });
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(handle).toHaveBeenCalledTimes(1);

        await unmount();
    });

    test('shortcut titles are rendered once and then reused', () => {
        const title = toPresentingShortcutTitle('Brush', 'usePaint');

        expect(title).toContain('Brush');
        expect(toPresentingShortcutTitle('Brush', 'usePaint')).toBe(title);
    });
});
