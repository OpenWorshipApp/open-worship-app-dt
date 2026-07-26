// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

import KeyboardEventListener from '../event/KeyboardEventListener';
import {
    PRESENTING_CONTROL_ID,
    checkIsShadowWidgetTarget,
    checkIsTypingTarget,
    swallowPresentingKeyEvent,
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
        expect(shortcutListener.mock.calls[0][0].defaultPrevented).toBe(false);
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
