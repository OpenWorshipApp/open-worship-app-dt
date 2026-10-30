// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The REAL keyboard stack is used — `KeyboardEventListener`, its layers and its
// event names — because what these helpers decide is exactly how a key travels
// through it. Only its environment is stubbed: the platform (Windows, so a
// chord is spelled `Ctrl+Z`) and the two hooks it reads from `appHooks`.
const { providerMock } = vi.hoisted(() => ({
    providerMock: {
        systemUtils: {
            isDev: false,
            isWindows: true,
            isMac: false,
            isLinux: false,
        },
    },
}));

vi.mock('../server/appProvider', () => ({ default: providerMock }));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import KeyboardEventListener from '../event/KeyboardEventListener';
import {
    PRESENTING_CONTROL_ID,
    PRESENTING_CONTROL_LAYER,
    checkIsPresentingControlTarget,
    checkIsShadowWidgetTarget,
    checkIsTypingTarget,
    presentingShortcutMap,
    swallowPresentingKeyEvent,
    toPresentingShortcutTitle,
    usePresentingKeyboardSwallow,
    usePresentingShortcut,
    usePresentingToolShortcut,
    type PresentingShortcutIdType,
} from './presentingControlShortcutHelpers';

// Listeners run on microtasks (`EventHandler.checkOnEvent` awaits before each
// one), so a fired key has to be given a macrotask to arrive.
async function flushKeyEvents() {
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

// A real dispatch, so `event.target` is set the way the guards read it. A
// target INSIDE the document bubbles to `KeyboardEventListener`'s own
// `document.onkeydown`, which fires the key into the stack exactly as the app
// does; a DETACHED target keeps the key out of the stack, for the cases that
// call the swallow by hand.
function keyDown(init: KeyboardEventInit, target?: Element) {
    const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    (target ?? document.body).dispatchEvent(event);
    return event;
}

function detachedKeyDown(init: KeyboardEventInit) {
    return keyDown(init, document.createElement('div'));
}

const layersAtStart = [...KeyboardEventListener._layers];

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    document.body.innerHTML = '';
});

afterEach(() => {
    // Every test that pushes a layer takes it off again, but a failing one
    // must not leave the stack wrong for the next.
    KeyboardEventListener._layers.splice(
        0,
        KeyboardEventListener._layers.length,
        ...layersAtStart,
    );
    vi.unstubAllGlobals();
});

describe('checkIsTypingTarget', () => {
    test('a contenteditable element is typing, even without the attribute', () => {
        // jsdom does not compute `isContentEditable`; a browser does, for the
        // element and everything inside an editable region.
        const element = document.createElement('div');
        Object.defineProperty(element, 'isContentEditable', { value: true });
        document.body.append(element);
        expect(checkIsTypingTarget({ target: element })).toBe(true);
    });

    test('text fields type, buttons and toggles do not', () => {
        const textarea = document.createElement('textarea');
        const select = document.createElement('select');
        const textInput = document.createElement('input');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        const range = document.createElement('input');
        range.type = 'range';
        document.body.append(textarea, select, textInput, checkbox, range);

        expect(checkIsTypingTarget({ target: textarea })).toBe(true);
        expect(checkIsTypingTarget({ target: select })).toBe(true);
        expect(checkIsTypingTarget({ target: textInput })).toBe(true);
        expect(checkIsTypingTarget({ target: checkbox })).toBe(false);
        expect(checkIsTypingTarget({ target: range })).toBe(false);
    });

    test('Monaco edits through a plain div, which still counts as typing', () => {
        const editor = document.createElement('div');
        editor.className = 'monaco-editor';
        const editContext = document.createElement('div');
        editContext.className = 'native-edit-context';
        editor.append(editContext);
        document.body.append(editor);
        expect(checkIsTypingTarget({ target: editContext })).toBe(true);
        expect(checkIsTypingTarget({ target: document.body })).toBe(false);
    });

    test('with no element target it reads what holds the focus', () => {
        const input = document.createElement('input');
        document.body.append(input);
        input.focus();
        expect(checkIsTypingTarget({ target: globalThis })).toBe(true);
        input.blur();
        expect(checkIsTypingTarget(null)).toBe(false);
    });
});

describe('checkIsShadowWidgetTarget', () => {
    test('a focused control inside a shadow root wins the key', () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        shadowRoot.append(button);

        expect(checkIsShadowWidgetTarget({ target: host })).toBe(false);
        button.focus();
        expect(shadowRoot.activeElement).toBe(button);
        expect(checkIsShadowWidgetTarget({ target: host })).toBe(true);
    });

    test('anything that is not an element is not a shadow widget', () => {
        expect(checkIsShadowWidgetTarget({ target: globalThis })).toBe(false);
        expect(checkIsShadowWidgetTarget(undefined)).toBe(false);
        // An element with no shadow root at all.
        expect(
            checkIsShadowWidgetTarget({ target: document.createElement('p') }),
        ).toBe(false);
    });
});

describe('checkIsPresentingControlTarget', () => {
    test('only the controller subtree is its own target', () => {
        const controller = document.createElement('div');
        controller.id = PRESENTING_CONTROL_ID;
        const slider = document.createElement('input');
        controller.append(slider);
        const outside = document.createElement('button');
        document.body.append(controller, outside);

        expect(checkIsPresentingControlTarget({ target: slider })).toBe(true);
        expect(checkIsPresentingControlTarget({ target: outside })).toBe(false);
        expect(checkIsPresentingControlTarget({ target: null })).toBe(false);
    });
});

describe('swallowPresentingKeyEvent', () => {
    test('a key aimed at the controller widget behaves natively', () => {
        const controller = document.createElement('div');
        controller.id = PRESENTING_CONTROL_ID;
        const slider = document.createElement('input');
        slider.type = 'range';
        controller.append(slider);
        document.body.append(controller);

        const event = keyDown({ key: 'ArrowRight' }, slider);
        expect(swallowPresentingKeyEvent(event)).toBe(false);
        expect(event.defaultPrevented).toBe(false);
    });

    test('a key on the app is taken from it and replayed to the controller', async () => {
        KeyboardEventListener.addLayer(PRESENTING_CONTROL_LAYER);
        const listener = vi.fn();
        const registered = KeyboardEventListener.registerEventListener(
            [`${PRESENTING_CONTROL_LAYER}>B`],
            listener,
        );
        const event = detachedKeyDown({ key: 'b', code: 'KeyB' });
        const stopImmediate = vi.spyOn(event, 'stopImmediatePropagation');

        expect(swallowPresentingKeyEvent(event)).toBe(true);
        expect(event.defaultPrevented).toBe(true);
        expect(stopImmediate).toHaveBeenCalled();

        await flushKeyEvents();
        expect(listener).toHaveBeenCalledTimes(1);
        const [replayed] = listener.mock.calls[0];
        // A stand-in, not the swallowed original: that one is prevented, and
        // `checkOnEvent` would deliver nothing for it.
        expect(replayed).not.toBe(event);
        expect(replayed).toMatchObject({
            type: 'keydown',
            key: 'b',
            code: 'KeyB',
            ctrlKey: false,
            defaultPrevented: false,
            target: event.target,
        });
        KeyboardEventListener.unregisterEventListener(registered);
    });

    test('armed, a real key reaches the controller and never the app', async () => {
        function SwallowComp() {
            usePresentingKeyboardSwallow(true);
            return null;
        }
        const swallowContainer = document.createElement('div');
        document.body.append(swallowContainer);
        const swallowRoot = createRoot(swallowContainer);
        await act(async () => {
            swallowRoot.render(createElement(SwallowComp));
        });
        KeyboardEventListener.addLayer(PRESENTING_CONTROL_LAYER);
        const controllerListener = vi.fn();
        const appListener = vi.fn();
        const registered = KeyboardEventListener.registerEventListener(
            [`${PRESENTING_CONTROL_LAYER}>Ctrl+Z`],
            controllerListener,
        );
        const appInput = document.createElement('input');
        appInput.addEventListener('keydown', appListener);
        document.body.append(appInput);

        keyDown({ key: 'z', code: 'KeyZ', ctrlKey: true }, appInput);
        await flushKeyEvents();

        // Window capture runs first and stops the event dead, so neither the
        // app's own handler nor `document.onkeydown` ever sees the original —
        // the controller hears the one replay, under its own layer.
        expect(appListener).not.toHaveBeenCalled();
        expect(controllerListener).toHaveBeenCalledTimes(1);
        KeyboardEventListener.unregisterEventListener(registered);
        act(() => {
            swallowRoot.unmount();
        });
        swallowContainer.remove();
    });

    test('a replayed key that a listener prevents stops the chain', async () => {
        KeyboardEventListener.addLayer(PRESENTING_CONTROL_LAYER);
        const later = vi.fn();
        const first = vi.fn((replayed: KeyboardEvent) => {
            // The no-op stand-ins must be callable like the real ones.
            replayed.stopPropagation();
            replayed.stopImmediatePropagation();
            replayed.preventDefault();
        });
        // Listeners run newest first, so `first` is registered last.
        const registered = [
            ...KeyboardEventListener.registerEventListener(
                [`${PRESENTING_CONTROL_LAYER}>Ctrl+Z`],
                later,
            ),
            ...KeyboardEventListener.registerEventListener(
                [`${PRESENTING_CONTROL_LAYER}>Ctrl+Z`],
                first,
            ),
        ];

        swallowPresentingKeyEvent(
            detachedKeyDown({ key: 'z', code: 'KeyZ', ctrlKey: true }),
        );
        await flushKeyEvents();

        expect(first).toHaveBeenCalledTimes(1);
        expect(first.mock.calls[0][0].defaultPrevented).toBe(true);
        expect(later).not.toHaveBeenCalled();
        KeyboardEventListener.unregisterEventListener(registered);
    });

    test('a release, a keypress and a bare modifier are swallowed but never replayed', async () => {
        KeyboardEventListener.addLayer(PRESENTING_CONTROL_LAYER);
        const fireEventSpy = vi.spyOn(KeyboardEventListener, 'fireEvent');
        const keyUp = new KeyboardEvent('keyup', {
            key: 'b',
            cancelable: true,
        });
        const keyPress = new KeyboardEvent('keypress', {
            key: 'b',
            cancelable: true,
        });
        const shift = new KeyboardEvent('keydown', {
            key: 'Shift',
            shiftKey: true,
            cancelable: true,
        });

        for (const event of [keyUp, keyPress, shift]) {
            expect(swallowPresentingKeyEvent(event)).toBe(true);
            expect(event.defaultPrevented).toBe(true);
        }
        await flushKeyEvents();
        expect(fireEventSpy).not.toHaveBeenCalled();
    });
});

let container: HTMLDivElement;
let root: Root;

function mountHook(render: () => void) {
    function HookHostComp() {
        render();
        return null;
    }
    return HookHostComp;
}

describe('the keyboard swallow hook', () => {
    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    test('takes the keyboard only while armed, and gives it back', async () => {
        function SwallowComp({ isSwallowing }: { isSwallowing: boolean }) {
            usePresentingKeyboardSwallow(isSwallowing);
            return null;
        }
        const appInput = document.createElement('input');
        document.body.append(appInput);

        await act(async () => {
            root.render(createElement(SwallowComp, { isSwallowing: false }));
        });
        expect(keyDown({ key: 'a' }, appInput).defaultPrevented).toBe(false);

        await act(async () => {
            root.render(createElement(SwallowComp, { isSwallowing: true }));
        });
        for (const type of ['keydown', 'keypress', 'keyup']) {
            const event = new KeyboardEvent(type, {
                key: 'a',
                bubbles: true,
                cancelable: true,
            });
            appInput.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        }

        // Disarming tears every capture listener down again.
        await act(async () => {
            root.render(createElement(SwallowComp, { isSwallowing: false }));
        });
        expect(keyDown({ key: 'a' }, appInput).defaultPrevented).toBe(false);
    });

    test('unmounting while armed leaves nothing swallowing', async () => {
        await act(async () => {
            root.render(
                createElement(
                    mountHook(() => {
                        usePresentingKeyboardSwallow(true);
                    }),
                ),
            );
        });
        expect(keyDown({ key: 'a' }).defaultPrevented).toBe(true);
        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        expect(keyDown({ key: 'a' }).defaultPrevented).toBe(false);
    });
});

describe('controller shortcuts', () => {
    beforeEach(() => {
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    // Through the document, so `document.onkeydown` fires it into the stack
    // the way the app does.
    async function pressKey(init: KeyboardEventInit, target?: Element) {
        keyDown(init, target);
        await flushKeyEvents();
    }

    test('a controller key fires only while its layer is on top', async () => {
        const handle = vi.fn();
        await act(async () => {
            root.render(
                createElement(
                    mountHook(() => {
                        usePresentingShortcut(
                            presentingShortcutMap.exitTool,
                            handle,
                        );
                    }),
                ),
            );
        });

        // `interact`: the app owns the keyboard, Escape is the app's.
        await pressKey({ key: 'Escape' });
        expect(handle).not.toHaveBeenCalled();

        KeyboardEventListener.addLayer(PRESENTING_CONTROL_LAYER);
        await pressKey({ key: 'Escape' });
        expect(handle).toHaveBeenCalledTimes(1);
    });

    test('a held key, a field being typed in and a focused preview all win', async () => {
        const handle = vi.fn();
        await act(async () => {
            root.render(
                createElement(
                    mountHook(() => {
                        usePresentingShortcut(
                            presentingShortcutMap.usePaint,
                            handle,
                            'root',
                        );
                    }),
                ),
            );
        });

        // Auto-repeat would flap the tool ~30 times a second.
        await pressKey({ key: 'b', code: 'KeyB', repeat: true });
        // "bible" typed into the lookup must stay text.
        const input = document.createElement('input');
        document.body.append(input);
        await pressKey({ key: 'b', code: 'KeyB' }, input);
        // A mini-screen overlay holding the focus binds `b` itself.
        const host = document.createElement('div');
        document.body.append(host);
        const shadowButton = document.createElement('button');
        host.attachShadow({ mode: 'open' }).append(shadowButton);
        shadowButton.focus();
        await pressKey({ key: 'b', code: 'KeyB' }, host);
        expect(handle).not.toHaveBeenCalled();

        shadowButton.blur();
        await pressKey({ key: 'b', code: 'KeyB' });
        expect(handle).toHaveBeenCalledTimes(1);
    });

    test('the latest handler is the one a key reaches', async () => {
        const firstHandle = vi.fn();
        const secondHandle = vi.fn();
        function ShortcutComp({ handle }: { handle: () => void }) {
            usePresentingShortcut(presentingShortcutMap.toggleHold, handle);
            return null;
        }
        KeyboardEventListener.addLayer(PRESENTING_CONTROL_LAYER);
        await act(async () => {
            root.render(createElement(ShortcutComp, { handle: firstHandle }));
        });
        await act(async () => {
            root.render(createElement(ShortcutComp, { handle: secondHandle }));
        });
        await pressKey({ key: 'h', code: 'KeyH' });
        expect(firstHandle).not.toHaveBeenCalled();
        expect(secondHandle).toHaveBeenCalledTimes(1);
    });

    test('a tool key arms from `interact` AND switches while armed, once each', async () => {
        const handle = vi.fn();
        await act(async () => {
            root.render(
                createElement(
                    mountHook(() => {
                        usePresentingToolShortcut('useFocus', handle);
                    }),
                ),
            );
        });

        await pressKey({ key: 'f', code: 'KeyF' });
        expect(handle).toHaveBeenCalledTimes(1);

        KeyboardEventListener.addLayer(PRESENTING_CONTROL_LAYER);
        await pressKey({ key: 'f', code: 'KeyF' });
        // Two registrations, one top layer: never both.
        expect(handle).toHaveBeenCalledTimes(2);
    });

    test('unmounting releases the key', async () => {
        const handle = vi.fn();
        KeyboardEventListener.addLayer(PRESENTING_CONTROL_LAYER);
        await act(async () => {
            root.render(
                createElement(
                    mountHook(() => {
                        usePresentingToolShortcut('toggleScreencast', handle);
                    }),
                ),
            );
        });
        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        await pressKey({ key: 'k', code: 'KeyK' });
        expect(handle).not.toHaveBeenCalled();
    });
});

describe('toPresentingShortcutTitle', () => {
    test.each([
        ['useInteract', 'V'],
        ['usePaint', 'B'],
        ['useEraser', 'E'],
        ['exitTool', 'Escape'],
        ['toggleScreencast', 'K'],
    ] as [PresentingShortcutIdType, string][])(
        '%s is hinted as [%s]',
        (shortcutId, keys) => {
            expect(toPresentingShortcutTitle('Label', shortcutId)).toBe(
                `Label [${keys}]`,
            );
        },
    );

    test('the key label is resolved once per id for the process', () => {
        const filterSpy = vi.spyOn(
            KeyboardEventListener,
            'filterEventMappersByPlatform',
        );
        // `useFocus` is asked for nowhere else in this file.
        expect(toPresentingShortcutTitle('Spotlight', 'useFocus')).toBe(
            'Spotlight [F]',
        );
        expect(toPresentingShortcutTitle('Again', 'useFocus')).toBe(
            'Again [F]',
        );
        expect(filterSpy).toHaveBeenCalledTimes(1);
    });
});
