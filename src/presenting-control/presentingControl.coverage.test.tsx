// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

// One mock surface for the whole Presenting Control: the controller, its
// toolbar, both lazy tool panels, the keyboard screencast and the menu gate.
// The keyboard stack is REAL (`KeyboardEventListener`, `WindowEventListener`,
// the overlay shortcut hooks), so every key below travels the same path a
// real press does: `document.onkeydown`, or — while a tool is armed — the
// window-capture swallow and its replay under the controller's layer.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        dictionaries: [] as Record<string, string>[],
        isWindowFocused: true,
        menuHandler: null as null | ((event: unknown, data: unknown) => void),
        floatingProps: null as any,
        systemUtils: {
            isDev: false,
            isWindows: true,
            isMac: false,
            isLinux: false,
        },
    },
    mocks: {
        persist: vi.fn(),
        setMenuItems: vi.fn(),
        unregisterMenu: vi.fn(),
        showMenu: vi.fn(),
        takeSnapshot: vi.fn(),
        sendSnapshot: vi.fn(),
        copySnapshot: vi.fn(),
        saveSnapshot: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: true,
        isPageScreen: false,
        systemUtils: state.systemUtils,
        getIsWindowFocused: () => state.isWindowFocused,
    },
}));
// `KeyboardEventListener` needs only `cloneJson`; the real module drags in the
// logger, the error reporter and the cache manager.
vi.mock('../helper/helpers', () => ({
    cloneJson: (value: unknown) => JSON.parse(JSON.stringify(value)),
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
// English labels stay easy to query, but every key is checked against BOTH
// real dictionaries: a missing Khmer or French string throws here as it does
// in dev, instead of being hidden behind an identity stub.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
    registerAppMenuClicked: (
        handler: (event: unknown, data: unknown) => void,
    ) => {
        state.menuHandler = handler;
        return () => {
            mocks.unregisterMenu(handler);
            state.menuHandler = null;
        };
    },
    setAppMenuItems: mocks.setMenuItems,
}));
// String-backed like the real store, so the draw panel (which writes through
// `useStateSetting*`) and the engines (which read through `getSetting`) agree.
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    function genSettingHook<T>(parse: (raw: string) => T) {
        return (name: string, fallback: T) => {
            const [value, setValue] = useState<T>(() => {
                const raw = state.settings.get(name);
                return raw === undefined || raw === '' ? fallback : parse(raw);
            });
            const setSettingValue = (next: T) => {
                state.settings.set(name, `${next}`);
                mocks.persist(name, `${next}`);
                setValue(next);
            };
            return [value, setSettingValue] as const;
        };
    }
    return {
        getSetting: (name: string) => state.settings.get(name) ?? null,
        setSetting: (name: string, value: string | null) => {
            state.settings.set(name, value ?? '');
            mocks.persist(name, value ?? '');
        },
        useStateSettingString: genSettingHook((raw) => raw),
        useStateSettingNumber: genSettingHook((raw) => Number.parseFloat(raw)),
        useStateSettingBoolean: genSettingHook((raw) => raw === 'true'),
    };
});
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: (props: any) => {
        state.floatingProps = props;
        return (
            <div className="floating-widget-stub">
                <div className="floating-widget-title">{props.title}</div>
                <button aria-label="Close the widget" onClick={props.onClose}>
                    x
                </button>
                <div className="floating-widget-body">{props.children}</div>
            </div>
        );
    },
}));
vi.mock('../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: any) => (
            <Suspense fallback={<span className="suspense-fallback" />}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showMenu,
}));
vi.mock('./presentingSnapshotHelpers', () => ({
    takeAppSnapshot: mocks.takeSnapshot,
    sendSnapshotToChatbot: mocks.sendSnapshot,
    copySnapshot: mocks.copySnapshot,
    saveSnapshotToImages: mocks.saveSnapshot,
}));

import KeyboardEventListener from '../event/KeyboardEventListener';
import ControllerComp from './ControllerComp';
// The two tool panels are lazy chunks; loading them up front only makes the
// `lazy()` imports resolve without file I/O.
import './ControllerDrawToolsComp';
import './ControllerFocusToolsComp';
import KeyboardScreencastComp from './KeyboardScreencastComp';
import PresentingControlComp from './PresentingControlComp';
import PresentingDrawManager from './PresentingDrawManager';
import PresentingFocusManager from './PresentingFocusManager';
import { KEYSTROKE_HIDE_DELAY_MS } from './keyboardScreencastHelpers';
import {
    checkIsPresentingControlTarget,
    checkIsShadowWidgetTarget,
    checkIsTypingTarget,
    swallowPresentingKeyEvent,
    toPresentingShortcutTitle,
} from './presentingControlShortcutHelpers';

const dictionaries = readLangPackageDictionaries();

const INTERACT = 'Use the app (drawing stays on top)';
const PAINT = 'Draw on the app';
const ERASER = 'Erase parts of the drawing';
const FOCUS = 'Spotlight part of the app';

let container: HTMLDivElement;
let root: Root;
let originalGetContext: HTMLCanvasElement['getContext'];
const outsideElements: HTMLElement[] = [];

// jsdom has no canvas backend. The engines only need a context to call into;
// the pixels are not what these tests are about.
function genCanvasContextStub() {
    return new Proxy({} as Record<string | symbol, unknown>, {
        get(target, property) {
            if (!(property in target)) {
                target[property] = () => {};
            }
            return target[property];
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        },
    });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.settings.clear();
    state.dictionaries = dictionaries;
    state.isWindowFocused = true;
    state.menuHandler = null;
    state.floatingProps = null;
    Object.assign(state.systemUtils, {
        isWindows: true,
        isMac: false,
        isLinux: false,
    });
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    const context = genCanvasContextStub();
    HTMLCanvasElement.prototype.getContext = function () {
        return context;
    } as any;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    for (const element of outsideElements.splice(0)) {
        element.remove();
    }
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    // The layer stack is module state shared by every test in the worker.
    KeyboardEventListener._layers.splice(
        0,
        KeyboardEventListener._layers.length,
        'root',
    );
    vi.useRealTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

function addOutside<T extends HTMLElement>(element: T) {
    document.body.appendChild(element);
    outsideElements.push(element);
    return element;
}

// Keyboard listeners run on microtasks (`EventHandler.checkOnEvent` awaits
// before every listener), so a press is not done until those have drained.
async function flushMicrotasks() {
    for (let index = 0; index < 20; index++) {
        await Promise.resolve();
    }
}

async function render(element: ReactElement) {
    await act(async () => {
        root.render(element);
    });
}

// For the lazy chunks: poll in small real steps for what has to be on screen.
async function waitFor(check: () => boolean, what: string) {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (check()) {
            return;
        }
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 5);
            });
        });
    }
    throw new Error(`Timed out waiting for ${what}`);
}

// The engines coalesce repaints onto an animation frame.
async function nextFrames() {
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 40);
        });
    });
}

function query<T extends Element = HTMLElement>(selector: string) {
    const element = container.querySelector<T>(selector);
    if (element === null) {
        throw new Error(`Missing ${selector}`);
    }
    return element;
}

function byLabel<T extends HTMLElement = HTMLButtonElement>(label: string) {
    return query<T>(`[aria-label="${label}"]`);
}

function buttonByText(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (item) => {
            return item.textContent?.trim() === text;
        },
    );
    if (button === undefined) {
        throw new Error(`Missing button ${text}`);
    }
    return button;
}

function pressedTools() {
    return Array.from(
        container.querySelectorAll('.presenting-control-tool-group button'),
    )
        .filter((button) => {
            return button.getAttribute('aria-pressed') === 'true';
        })
        .map((button) => {
            return button.getAttribute('aria-label');
        });
}

function getLayers() {
    const [canvas, mask] = Array.from(
        container.querySelectorAll<HTMLElement>('.presenting-control-layer'),
    );
    return {
        canvas: canvas as HTMLCanvasElement,
        mask: mask as HTMLDivElement,
    };
}

// The value an `OverlayRangeComp` prints beside its slider.
function rangeText(label: string) {
    return byLabel<HTMLInputElement>(label).parentElement!.querySelector(
        'small',
    )!.textContent;
}

function historyState() {
    return {
        undo: !byLabel('Undo').disabled,
        redo: !byLabel('Redo').disabled,
        clear: !byLabel('Clear drawing').disabled,
    };
}

async function click(element: HTMLElement) {
    await act(async () => {
        element.click();
    });
}

async function press(
    init: KeyboardEventInit,
    target: EventTarget = document.body,
    type = 'keydown',
) {
    const event = new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    await act(async () => {
        target.dispatchEvent(event);
        await flushMicrotasks();
    });
    return event;
}

async function changeValue(input: HTMLInputElement, value: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

// The overlay is `position: fixed; inset: 0`, and jsdom lays nothing out: the
// engines read an unlaid box as "not ready" and refuse to map a pointer.
function stubBox(element: HTMLElement, width: number, height: number) {
    element.getBoundingClientRect = () => {
        return {
            left: 0,
            top: 0,
            right: width,
            bottom: height,
            width,
            height,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect;
    };
    Object.defineProperty(element, 'offsetWidth', {
        configurable: true,
        value: width,
    });
    Object.defineProperty(element, 'offsetHeight', {
        configurable: true,
        value: height,
    });
}

function pointer(type: string, clientX: number, clientY: number) {
    return new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button: 0,
    });
}

async function drawStroke(canvas: HTMLElement, points: [number, number][]) {
    await act(async () => {
        canvas.dispatchEvent(pointer('pointerdown', ...points[0]));
        for (const point of points.slice(1)) {
            globalThis.dispatchEvent(pointer('pointermove', ...point));
        }
        globalThis.dispatchEvent(pointer('pointerup', ...points.at(-1)!));
    });
}

describe('ControllerComp', () => {
    test('opens in interact: nothing armed and the app keeps its keyboard', async () => {
        const onClose = vi.fn();
        await render(<ControllerComp onClose={onClose} />);

        expect(query('#presenting-control').className).toBe('');
        const { canvas, mask } = getLayers();
        expect(canvas.style.pointerEvents).toBe('none');
        expect(canvas.style.cursor).toBe('default');
        expect(mask.style.pointerEvents).toBe('none');
        expect(pressedTools()).toEqual([INTERACT]);
        expect(KeyboardEventListener._layers).toEqual(['root']);
        // `interact` has no settings, so the widget is a header and nothing
        // else.
        expect(state.floatingProps).toMatchObject({
            persistKey: 'presenting-control-widget-rect',
            isBodyHidden: true,
            options: {
                width: 640,
                height: 150,
                minWidth: 360,
                minHeight: 90,
                extraClassName: 'presenting-control-widget',
            },
        });
        expect(byLabel(INTERACT).title).toBe(`${INTERACT} [V]`);
        expect(byLabel(PAINT).title).toBe(`${PAINT} [B]`);
        expect(byLabel(ERASER).title).toBe(`${ERASER} [E]`);
        expect(byLabel(FOCUS).title).toBe(`${FOCUS} [F]`);
        const screencast = byLabel('Show the keys being pressed');
        expect(screencast.title).toBe('Show the keys being pressed [K]');
        expect(screencast.disabled).toBe(false);
        expect(screencast.getAttribute('aria-pressed')).toBe('false');
        expect(byLabel('Undo').title).toBe('Undo [Ctrl+Z]');
        // Linux's Ctrl+Y is filtered out on Windows instead of throwing.
        expect(byLabel('Redo').title).toBe('Redo [Ctrl+Shift+Z / Ctrl+Y]');
        expect(byLabel('Clear drawing').title).toBe('Clear drawing [C]');
        expect(historyState()).toEqual({
            undo: false,
            redo: false,
            clear: false,
        });

        // No toolbar button may take focus from the overlay on press.
        for (const label of [
            PAINT,
            'Show the keys being pressed',
            'Take a picture of the app',
        ]) {
            const mouseDown = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
            });
            byLabel(label).dispatchEvent(mouseDown);
            expect(mouseDown.defaultPrevented).toBe(true);
        }

        await click(byLabel('Close the widget'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('arming the brush claims the keyboard, takes focus off the app and loads its panel', async () => {
        await render(<ControllerComp onClose={() => {}} />);
        const input = addOutside(document.createElement('input'));
        input.focus();
        expect(document.activeElement).toBe(input);

        await click(byLabel(PAINT));

        expect(pressedTools()).toEqual([PAINT]);
        expect(query('#presenting-control').className).toBe('is-armed');
        expect(getLayers().canvas.style.pointerEvents).toBe('auto');
        expect(getLayers().canvas.style.cursor).toBe('crosshair');
        expect(KeyboardEventListener._layers).toEqual([
            'root',
            'presenting-control',
        ]);
        expect(document.activeElement).not.toBe(input);
        expect(state.floatingProps.isBodyHidden).toBe(false);
        // The strip is unavailable while the overlay swallows the keyboard.
        const screencast = byLabel('Available while using the app');
        expect(screencast.disabled).toBe(true);
        await waitFor(() => {
            return container.textContent!.includes(
                'Drag anywhere on the app to draw',
            );
        }, 'the brush panel');

        // Re-picking the armed tool is not a second arm: focus stays put.
        input.focus();
        await click(byLabel(PAINT));
        expect(document.activeElement).toBe(input);
        input.blur();

        // Escape backs out to `interact` and hands the keyboard back.
        const escape = await press({ key: 'Escape', code: 'Escape' });
        expect(escape.defaultPrevented).toBe(true);
        expect(pressedTools()).toEqual([INTERACT]);
        expect(KeyboardEventListener._layers).toEqual(['root']);
        expect(state.floatingProps.isBodyHidden).toBe(true);
        expect(getLayers().canvas.style.pointerEvents).toBe('none');

        // The buttons switch tools as the keys do.
        await click(byLabel(ERASER));
        expect(pressedTools()).toEqual([ERASER]);
        expect(KeyboardEventListener._layers).toEqual([
            'root',
            'presenting-control',
        ]);
        await click(byLabel(INTERACT));
        expect(pressedTools()).toEqual([INTERACT]);
        expect(KeyboardEventListener._layers).toEqual(['root']);
    });

    test('the tool keys arm from interact, but never while the app is being typed into', async () => {
        await render(<ControllerComp onClose={() => {}} />);
        // A `b` typed into a field stays a `b`...
        const input = addOutside(document.createElement('input'));
        await press({ key: 'b', code: 'KeyB' }, input);
        // ...so does one aimed at a focused shadow-hosted preview overlay...
        const host = addOutside(document.createElement('div'));
        const shadowButton = document.createElement('button');
        host.attachShadow({ mode: 'open' }).appendChild(shadowButton);
        shadowButton.focus();
        await press({ key: 'b', code: 'KeyB' }, host);
        shadowButton.blur();
        // ...and a held key does not flap the tool.
        await press({ key: 'b', code: 'KeyB', repeat: true });
        expect(pressedTools()).toEqual([INTERACT]);

        await press({ key: 'b', code: 'KeyB' });
        expect(pressedTools()).toEqual([PAINT]);
        // Armed, the keys reach the toolbar through the swallow's replay.
        await press({ key: 'e', code: 'KeyE' });
        expect(pressedTools()).toEqual([ERASER]);
        await waitFor(() => {
            return container.textContent!.includes(
                'Drag over the drawing to rub it out',
            );
        }, 'the eraser hint');
        await press({ key: 'f', code: 'KeyF' });
        expect(pressedTools()).toEqual([FOCUS]);
        await waitFor(() => {
            return (
                container.querySelector('[aria-label="Spotlight size"]') !==
                null
            );
        }, 'the spotlight panel');
        expect(container.querySelector('[aria-label="Size"]')).toBeNull();
        await press({ key: 'v', code: 'KeyV' });
        expect(pressedTools()).toEqual([INTERACT]);
        expect(KeyboardEventListener._layers).toEqual(['root']);
    });

    test('armed, the app hears no key at all, while the widget keeps its own', async () => {
        await render(<ControllerComp onClose={() => {}} />);
        const heard: string[] = [];
        const listener = (event: Event) => {
            heard.push(`${event.type}:${(event as KeyboardEvent).key}`);
        };
        const eventTypes = ['keydown', 'keypress', 'keyup'];
        for (const eventType of eventTypes) {
            document.addEventListener(eventType, listener);
        }
        try {
            await click(byLabel(PAINT));
            await waitFor(() => {
                return container.querySelector('[aria-label="Size"]') !== null;
            }, 'the brush panel');

            const swallowed = [
                await press({ key: 'ArrowDown', code: 'ArrowDown' }),
                await press(
                    { key: 'a', code: 'KeyA' },
                    document.body,
                    'keypress',
                ),
                await press({ key: 'a', code: 'KeyA' }, document.body, 'keyup'),
            ];
            expect(
                swallowed.map((event) => {
                    return event.defaultPrevented;
                }),
            ).toEqual([true, true, true]);
            expect(heard).toEqual([]);

            // The widget's slider is the controller's own: its arrows work.
            const ownKey = await press(
                { key: 'ArrowRight', code: 'ArrowRight' },
                byLabel('Size'),
            );
            expect(ownKey.defaultPrevented).toBe(false);
            expect(heard).toEqual(['keydown:ArrowRight']);

            await press({ key: 'Escape', code: 'Escape' });
            heard.length = 0;
            const released = await press({
                key: 'ArrowDown',
                code: 'ArrowDown',
            });
            expect(released.defaultPrevented).toBe(false);
            expect(heard).toEqual(['keydown:ArrowDown']);
        } finally {
            for (const eventType of eventTypes) {
                document.removeEventListener(eventType, listener);
            }
        }
    });

    test('undo, redo and clear track the drawing; their keys answer only while armed', async () => {
        await render(<ControllerComp onClose={() => {}} />);
        const { canvas } = getLayers();
        stubBox(canvas, 400, 300);
        await click(byLabel(PAINT));
        await drawStroke(canvas, [
            [10, 10],
            [30, 40],
            [60, 80],
        ]);
        expect(historyState()).toEqual({
            undo: true,
            redo: false,
            clear: true,
        });
        // An enabled history button keeps the overlay's focus as well.
        const mouseDown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        });
        byLabel('Undo').dispatchEvent(mouseDown);
        expect(mouseDown.defaultPrevented).toBe(true);

        await click(byLabel('Undo'));
        expect(historyState()).toEqual({
            undo: false,
            redo: true,
            clear: false,
        });
        await click(byLabel('Redo'));
        expect(historyState()).toEqual({
            undo: true,
            redo: false,
            clear: true,
        });
        await press({ key: 'z', code: 'KeyZ', ctrlKey: true });
        expect(historyState()).toEqual({
            undo: false,
            redo: true,
            clear: false,
        });
        await press({ key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true });
        expect(historyState()).toEqual({
            undo: true,
            redo: false,
            clear: true,
        });
        await press({ key: 'z', code: 'KeyZ', ctrlKey: true });
        expect(historyState()).toEqual({
            undo: false,
            redo: true,
            clear: false,
        });
        await press({ key: 'y', code: 'KeyY', ctrlKey: true });
        expect(historyState()).toEqual({
            undo: true,
            redo: false,
            clear: true,
        });

        // A held `C` is one clear, not thirty.
        await press({ key: 'c', code: 'KeyC', repeat: true });
        expect(historyState().clear).toBe(true);
        await press({ key: 'c', code: 'KeyC' });
        // A clear collapses the stack: one Undo still restores it.
        expect(historyState()).toEqual({
            undo: true,
            redo: false,
            clear: false,
        });
        await click(byLabel('Undo'));
        expect(historyState()).toEqual({
            undo: false,
            redo: true,
            clear: true,
        });

        // In `interact` these chords belong to the app, not to the drawing...
        await press({ key: 'Escape', code: 'Escape' });
        await press({ key: 'c', code: 'KeyC' });
        await press({ key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true });
        expect(historyState()).toEqual({
            undo: false,
            redo: true,
            clear: true,
        });
        // ...while the buttons work in every tool.
        await click(byLabel('Clear drawing'));
        expect(historyState()).toEqual({
            undo: true,
            redo: false,
            clear: false,
        });
    });

    test('the brush panel persists every edit and feeds it to the engine', async () => {
        const setPaintParams = vi.spyOn(
            PresentingDrawManager.prototype,
            'setPaintParams',
        );
        await render(<ControllerComp onClose={() => {}} />);
        await click(byLabel(PAINT));
        await waitFor(() => {
            return container.querySelector('[aria-label="Size"]') !== null;
        }, 'the brush panel');
        expect(setPaintParams).toHaveBeenLastCalledWith({
            color: '#ff2d2dff',
            size: 10,
            isStraight: false,
            is3D: false,
            isDots: false,
        });

        const straight = buttonByText('Straight');
        expect(straight.title).toBe('Straight [S]');
        expect(buttonByText('3D').title).toBe('3D [3]');
        expect(buttonByText('Dots').title).toBe('Dots [D]');
        await click(straight);
        expect(straight.getAttribute('aria-pressed')).toBe('true');
        expect(state.settings.get('presenting-control-paint-straight')).toBe(
            'true',
        );
        await press({ key: '3', code: 'Digit3' });
        await press({ key: 'd', code: 'KeyD' });
        expect(buttonByText('3D').getAttribute('aria-pressed')).toBe('true');
        expect(buttonByText('Dots').getAttribute('aria-pressed')).toBe('true');
        expect(setPaintParams).toHaveBeenLastCalledWith({
            color: '#ff2d2dff',
            size: 10,
            isStraight: true,
            is3D: true,
            isDots: true,
        });

        await changeValue(byLabel<HTMLInputElement>('Size'), '25');
        expect(rangeText('Size')).toBe('25px');
        await press({ key: ']', code: 'BracketRight' });
        await press({ key: '}', code: 'BracketRight', shiftKey: true });
        expect(rangeText('Size')).toBe('31px');
        await press({ key: '[', code: 'BracketLeft' });
        await press({ key: '{', code: 'BracketLeft', shiftKey: true });
        expect(rangeText('Size')).toBe('25px');
        expect(state.settings.get('presenting-control-paint-size')).toBe('25');

        await changeValue(byLabel<HTMLInputElement>('Opacity'), '50');
        await changeValue(byLabel<HTMLInputElement>('Color'), '#00ff00');
        expect(state.settings.get('presenting-control-paint-alpha')).toBe('50');
        expect(state.settings.get('presenting-control-paint-color')).toBe(
            '#00ff00',
        );
        // The transparency rides in the colour, as `#rrggbbaa`.
        expect(setPaintParams).toHaveBeenLastCalledWith({
            color: '#00ff0080',
            size: 25,
            isStraight: true,
            is3D: true,
            isDots: true,
        });

        const quality = byLabel('Toggle drawing quality');
        expect(quality.textContent).toBe('HQ');
        expect(quality.title).toBe(
            'High quality drawing (anti-aliased, slower) [Q]',
        );
        await click(quality);
        expect(quality.textContent).toBe('Fast');
        expect(quality.title).toBe('Fast drawing (lighter, less smooth) [Q]');
        expect(state.settings.get('presenting-control-paint-quality')).toBe(
            'false',
        );
        await press({ key: 'q', code: 'KeyQ' });
        expect(quality.textContent).toBe('HQ');
        expect(state.settings.get('presenting-control-paint-quality')).toBe(
            'true',
        );
        await click(quality);

        await click(byLabel('Reset settings'));
        expect(quality.textContent).toBe('HQ');
        expect(
            Object.fromEntries(
                [...state.settings].filter(([key]) => {
                    return key.startsWith('presenting-control-paint-');
                }),
            ),
        ).toEqual({
            'presenting-control-paint-color': '#ff2d2d',
            'presenting-control-paint-alpha': '100',
            'presenting-control-paint-size': '10',
            'presenting-control-paint-straight': 'false',
            'presenting-control-paint-3d': 'false',
            'presenting-control-paint-dots': 'false',
            'presenting-control-paint-quality': 'true',
        });
        expect(setPaintParams).toHaveBeenLastCalledWith({
            color: '#ff2d2dff',
            size: 10,
            isStraight: false,
            is3D: false,
            isDots: false,
        });

        // `R` is the same reset, from the keyboard.
        await click(buttonByText('Straight'));
        expect(buttonByText('Straight').getAttribute('aria-pressed')).toBe(
            'true',
        );
        await press({ key: 'r', code: 'KeyR' });
        expect(buttonByText('Straight').getAttribute('aria-pressed')).toBe(
            'false',
        );
    });

    test('the spotlight panel drives the engine and re-renders from it', async () => {
        const setIsArmed = vi.spyOn(
            PresentingFocusManager.prototype,
            'setIsArmed',
        );
        await render(<ControllerComp onClose={() => {}} />);
        const focusManager = setIsArmed.mock
            .contexts[0] as PresentingFocusManager;
        const { mask } = getLayers();
        stubBox(mask, 400, 300);
        await click(byLabel(FOCUS));
        expect(mask.style.pointerEvents).toBe('auto');
        expect(mask.style.cursor).toBe('crosshair');
        await waitFor(() => {
            return (
                container.querySelector('[aria-label="Spotlight size"]') !==
                null
            );
        }, 'the spotlight panel');
        expect(rangeText('Spotlight size')).toBe('260px');
        expect(rangeText('Dim the rest of the app')).toBe('65%');
        expect(rangeText('Spotlight edge blur (0 = hard edge)')).toBe('35%');
        expect(container.textContent).toContain(
            'Move over the app to spotlight',
        );
        const isLit = () => {
            return (
                container.querySelector('i.bi-record-circle.text-primary') !==
                null
            );
        };
        expect(isLit()).toBe(false);

        await act(async () => {
            mask.dispatchEvent(pointer('pointermove', 120, 90));
        });
        expect(isLit()).toBe(true);

        await changeValue(byLabel<HTMLInputElement>('Spotlight size'), '500');
        expect(focusManager.size).toBe(500);
        expect(rangeText('Spotlight size')).toBe('500px');
        await press({ key: ']', code: 'BracketRight' });
        await press({ key: '}', code: 'BracketRight', shiftKey: true });
        expect(rangeText('Spotlight size')).toBe('560px');

        await changeValue(
            byLabel<HTMLInputElement>('Dim the rest of the app'),
            '80',
        );
        expect(focusManager.dimOpacity).toBe(80);
        expect(rangeText('Dim the rest of the app')).toBe('80%');
        const blurLabel = 'Spotlight edge blur (0 = hard edge)';
        await changeValue(byLabel<HTMLInputElement>(blurLabel), '10');
        await press({ key: ',', code: 'Comma' });
        expect(rangeText(blurLabel)).toBe('5%');
        await press({ key: '>', code: 'Period', shiftKey: true });
        expect(rangeText(blurLabel)).toBe('25%');
        expect(focusManager.edgeBlur).toBe(25);
        await changeValue(byLabel<HTMLInputElement>('Dim color'), '#112233');
        expect(focusManager.dimColor).toBe('#112233');
        expect(byLabel<HTMLInputElement>('Dim color').value).toBe('#112233');

        const contrast = byLabel('Contrast');
        expect(contrast.title).toBe(
            'Spotlight: the circle reveals what the pointer is over [X]',
        );
        await click(contrast);
        expect(contrast.getAttribute('aria-pressed')).toBe('true');
        expect(focusManager.isContrast).toBe(true);
        expect(contrast.title).toBe(
            'Contrast: the circle blocks what the pointer is over [X]',
        );
        expect(contrast.querySelector('i')!.className).toBe(
            'bi bi-circle-fill',
        );
        await press({ key: 'x', code: 'KeyX' });
        expect(contrast.getAttribute('aria-pressed')).toBe('false');

        // Follow kept the mask up through every edit above.
        expect(isLit()).toBe(true);
        const hold = byLabel('Hold to spotlight');
        expect(hold.textContent).toBe('Follow');
        expect(hold.title).toBe('Follow: the spotlight tracks the pointer [H]');
        await click(hold);
        expect(hold.getAttribute('aria-pressed')).toBe('true');
        expect(hold.textContent).toBe('Hold');
        expect(hold.title).toBe('Hold: dim only while the button is down [H]');
        expect(container.textContent).toContain(
            'Press and hold on the app to spotlight',
        );
        // Switching into hold drops the mask that follow had up.
        expect(isLit()).toBe(false);
        await press({ key: 'h', code: 'KeyH' });
        expect(hold.getAttribute('aria-pressed')).toBe('false');

        await press({ key: 'r', code: 'KeyR' });
        expect(rangeText('Spotlight size')).toBe('260px');
        expect(focusManager.dimColor).toBe('#000000');
        await changeValue(byLabel<HTMLInputElement>('Spotlight size'), '700');
        await click(byLabel('Reset settings'));
        expect(rangeText('Spotlight size')).toBe('260px');
        await changeValue(byLabel<HTMLInputElement>('Spotlight size'), '900');

        // Closing the controller flushes the spotlight's trailing write.
        await render(<div />);
        expect(state.settings.get('presenting-control-focus-size')).toBe('900');
        expect(state.settings.get('presenting-control-focus-color')).toBe(
            '#000000',
        );
    });

    test('the screencast is its own switch: K toggles it, arming turns it off for good', async () => {
        const addListener = vi.spyOn(document, 'addEventListener');
        await render(<ControllerComp onClose={() => {}} />);
        const screencastPills = () => {
            return Array.from(
                container.querySelectorAll('.keyboard-screencast-key'),
            ).map((pill) => {
                return pill.textContent;
            });
        };

        await press({ key: 'k', code: 'KeyK' });
        expect(
            byLabel('Show the keys being pressed').getAttribute('aria-pressed'),
        ).toBe('true');
        // The strip is lazy and draws nothing until a key: wait for its
        // passive capture listener instead.
        await waitFor(() => {
            return addListener.mock.calls.some(([type, , options]) => {
                return type === 'keydown' && (options as any)?.passive === true;
            });
        }, 'the screencast listener');
        await press({ key: 'a', code: 'KeyA' });
        await press({ key: 'a', code: 'KeyA' });
        expect(screencastPills()).toEqual(['a×2']);

        await click(byLabel(PAINT));
        const disabledScreencast = byLabel('Available while using the app');
        expect(disabledScreencast.getAttribute('aria-pressed')).toBe('false');
        expect(container.querySelector('#keyboard-screencast')).toBeNull();
        // Its key reaches the toggle while armed, and the toggle refuses.
        await press({ key: 'k', code: 'KeyK' });
        expect(disabledScreencast.getAttribute('aria-pressed')).toBe('false');

        // Not restored on disarm; one key brings it back.
        await press({ key: 'Escape', code: 'Escape' });
        const screencast = byLabel('Show the keys being pressed');
        expect(screencast.getAttribute('aria-pressed')).toBe('false');
        await press({ key: 'k', code: 'KeyK' });
        expect(screencast.getAttribute('aria-pressed')).toBe('true');
        await click(screencast);
        expect(screencast.getAttribute('aria-pressed')).toBe('false');
    });

    test('a window resize re-lays the drawing and the spotlight', async () => {
        const focusRender = vi.spyOn(
            PresentingFocusManager.prototype,
            'render',
        );
        await render(<ControllerComp onClose={() => {}} />);
        const { canvas } = getLayers();
        stubBox(canvas, 400, 300);
        await click(byLabel(PAINT));
        await drawStroke(canvas, [
            [10, 10],
            [50, 50],
        ]);
        await nextFrames();
        // Supersampled 2x in the default high quality.
        expect([canvas.width, canvas.height]).toEqual([800, 600]);

        stubBox(canvas, 200, 100);
        await act(async () => {
            globalThis.dispatchEvent(new Event('resize'));
        });
        await nextFrames();
        expect([canvas.width, canvas.height]).toEqual([400, 200]);
        expect(focusRender).toHaveBeenCalledTimes(1);

        // Closing the controller takes the listener with it.
        await render(<div />);
        globalThis.dispatchEvent(new Event('resize'));
        expect(focusRender).toHaveBeenCalledTimes(1);
    });

    test('closing the controller tears both engines and the keyboard layer down', async () => {
        const drawDelete = vi.spyOn(PresentingDrawManager.prototype, 'delete');
        const focusDelete = vi.spyOn(
            PresentingFocusManager.prototype,
            'delete',
        );
        await render(<ControllerComp onClose={() => {}} />);
        await click(byLabel(PAINT));
        expect(KeyboardEventListener._layers).toEqual([
            'root',
            'presenting-control',
        ]);
        expect(drawDelete).not.toHaveBeenCalled();

        await render(<div />);

        expect(drawDelete).toHaveBeenCalledTimes(1);
        expect(focusDelete).toHaveBeenCalledTimes(1);
        expect(KeyboardEventListener._layers).toEqual(['root']);
    });
});

describe('ControllerToolbarComp snapshot', () => {
    const DATA_URL = 'data:image/png;base64,AAAA';

    async function pressCamera() {
        await act(async () => {
            byLabel('Take a picture of the app').dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    clientX: 12,
                    clientY: 34,
                }),
            );
            await flushMicrotasks();
        });
    }

    test('takes the picture first, then offers three things to do with it', async () => {
        mocks.takeSnapshot.mockResolvedValue(DATA_URL);
        await render(<ControllerComp onClose={() => {}} />);

        await pressCamera();

        expect(mocks.takeSnapshot).toHaveBeenCalledTimes(1);
        expect(mocks.showMenu).toHaveBeenCalledTimes(1);
        // The menu is never in the shot: capture, then menu.
        expect(mocks.takeSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.showMenu.mock.invocationCallOrder[0],
        );
        const [at, items] = mocks.showMenu.mock.calls[0];
        expect(at).toMatchObject({ clientX: 12, clientY: 34 });
        expect(() => {
            at.preventDefault();
            at.stopPropagation();
        }).not.toThrow();
        expect(
            items.map((item: any) => {
                return item.menuElement;
            }),
        ).toEqual([
            'Ask the assistant about this',
            'Copy',
            'Save into your images',
        ]);
        items[0].onSelect();
        items[1].onSelect();
        items[2].onSelect();
        expect(mocks.sendSnapshot).toHaveBeenCalledWith(DATA_URL);
        expect(mocks.copySnapshot).toHaveBeenCalledWith(DATA_URL);
        expect(mocks.saveSnapshot).toHaveBeenCalledWith(DATA_URL);
    });

    test('offers nothing when the capture failed', async () => {
        mocks.takeSnapshot.mockResolvedValue(null);
        await render(<ControllerComp onClose={() => {}} />);

        await pressCamera();

        expect(mocks.takeSnapshot).toHaveBeenCalledTimes(1);
        expect(mocks.showMenu).not.toHaveBeenCalled();
    });
});

describe('PresentingControlComp', () => {
    test('adds its menu entry and toggles the controller from it, in the focused window only', async () => {
        await render(<PresentingControlComp />);
        expect(container.innerHTML).toBe('');
        expect(mocks.setMenuItems).toHaveBeenCalledWith(
            'presenting-control',
            {
                tools: [
                    {
                        label: 'Start Controlling',
                        accelerator: 'Ctrl+Shift+P',
                        clickData: { isTogglePresentingControl: true },
                    },
                ],
            },
            { isRoutedToFocusedWindow: true },
        );

        await act(async () => {
            state.menuHandler!({}, { isTogglePresentingControl: true });
        });
        await waitFor(() => {
            return container.querySelector('#presenting-control') !== null;
        }, 'the controller');
        await act(async () => {
            state.menuHandler!({}, { isTogglePresentingControl: true });
        });
        expect(container.querySelector('#presenting-control')).toBeNull();

        // Another item's click, an empty one, or one meant for the window in
        // front, opens nothing here.
        await act(async () => {
            state.menuHandler!({}, { isOther: true });
            state.menuHandler!({}, undefined);
        });
        state.isWindowFocused = false;
        await act(async () => {
            state.menuHandler!({}, { isTogglePresentingControl: true });
        });
        expect(container.innerHTML).toBe('');

        const handler = state.menuHandler;
        await render(<div />);
        expect(mocks.unregisterMenu).toHaveBeenCalledWith(handler);
    });

    test('Ctrl+Shift+P toggles the controller, except from under an armed tool', async () => {
        await render(<PresentingControlComp />);
        const chord = { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true };
        const isOpen = () => {
            return container.querySelector('#presenting-control') !== null;
        };

        await press(chord);
        await waitFor(isOpen, 'the controller');
        // Armed, the overlay swallows the chord: Escape disarms first.
        await click(byLabel(PAINT));
        await press(chord);
        expect(isOpen()).toBe(true);
        await press({ key: 'Escape', code: 'Escape' });
        await press(chord);
        expect(isOpen()).toBe(false);

        // The widget's ✕ closes it too.
        await press(chord);
        await waitFor(isOpen, 'the controller again');
        await click(byLabel('Close the widget'));
        expect(isOpen()).toBe(false);
    });

    test('offers the Command chord on a Mac', async () => {
        Object.assign(state.systemUtils, { isWindows: false, isMac: true });
        await render(<PresentingControlComp />);
        expect(mocks.setMenuItems.mock.lastCall![1].tools[0].accelerator).toBe(
            'Command+Shift+P',
        );
    });
});

describe('KeyboardScreencastComp', () => {
    function pills() {
        return Array.from(
            container.querySelectorAll('.keyboard-screencast-key'),
        ).map((pill) => {
            return pill.textContent;
        });
    }

    async function advance(ms: number) {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(ms);
        });
    }

    test('shows each press once, counts repeats and is gone between bursts', async () => {
        vi.useFakeTimers();
        await render(<KeyboardScreencastComp />);
        expect(container.innerHTML).toBe('');

        await press({ key: 'a', code: 'KeyA' });
        expect(pills()).toEqual(['a']);
        expect(query('#keyboard-screencast').getAttribute('aria-hidden')).toBe(
            'true',
        );
        // Auto-repeat is not a press.
        await press({ key: 'a', code: 'KeyA', repeat: true });
        expect(pills()).toEqual(['a']);
        await press({ key: 'a', code: 'KeyA' });
        expect(pills()).toEqual(['a×2']);
        // A key with nothing presentable adds nothing.
        await press({ key: 'Process', code: 'KeyA' });
        await press({ key: 'Shift', code: 'ShiftLeft', shiftKey: true });
        expect(pills()).toEqual(['a×2', 'Shift']);

        // Every press restarts the hide delay.
        await advance(KEYSTROKE_HIDE_DELAY_MS - 100);
        await press({ key: 'Enter', code: 'Enter' });
        await advance(KEYSTROKE_HIDE_DELAY_MS - 1);
        expect(pills()).toEqual(['a×2', 'Shift', 'Enter']);
        await advance(1);
        expect(container.innerHTML).toBe('');

        await press({ key: 'b', code: 'KeyB' });
        expect(pills()).toEqual(['b']);
    });

    test('unmounting drops the listener and the pending hide', async () => {
        vi.useFakeTimers();
        await render(<KeyboardScreencastComp />);
        await press({ key: 'a', code: 'KeyA' });
        expect(vi.getTimerCount()).toBe(1);

        await render(<div className="after" />);

        expect(vi.getTimerCount()).toBe(0);
        await press({ key: 'a', code: 'KeyA' });
        expect(container.innerHTML).toBe('<div class="after"></div>');
    });
});

describe('presentingControlShortcutHelpers', () => {
    function keyEventOn(target: Element) {
        let received: KeyboardEvent | null = null;
        const listener = (event: Event) => {
            received = event as KeyboardEvent;
        };
        target.addEventListener('keydown', listener);
        target.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'b', bubbles: true }),
        );
        target.removeEventListener('keydown', listener);
        return received!;
    }

    test('knows when a key is being typed into something', () => {
        const typingElements: HTMLElement[] = [
            document.createElement('textarea'),
            document.createElement('select'),
        ];
        const textInput = document.createElement('input');
        textInput.type = 'text';
        // An unknown type resolves to `text`: it counts as typing.
        const unknownInput = document.createElement('input');
        unknownInput.setAttribute('type', 'not-a-type');
        const editable = document.createElement('div');
        // jsdom does not compute `isContentEditable`.
        Object.defineProperty(editable, 'isContentEditable', { value: true });
        const monaco = document.createElement('div');
        monaco.className = 'monaco-editor';
        const monacoChild = document.createElement('div');
        monaco.appendChild(monacoChild);
        typingElements.push(textInput, unknownInput, editable, monacoChild);
        for (const element of typingElements) {
            addOutside(element === monacoChild ? monaco : element);
            expect(checkIsTypingTarget(keyEventOn(element))).toBe(true);
        }

        const notTyping: Element[] = ['checkbox', 'range', 'color'].map(
            (type) => {
                const input = document.createElement('input');
                input.type = type;
                return input;
            },
        );
        notTyping.push(document.createElement('div'));
        notTyping.push(
            document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
        );
        for (const element of notTyping) {
            addOutside(element as HTMLElement);
            expect(checkIsTypingTarget(keyEventOn(element))).toBe(false);
        }

        // With no element target, the focused element decides.
        const focused = addOutside(document.createElement('textarea'));
        focused.focus();
        expect(checkIsTypingTarget(null)).toBe(true);
        expect(checkIsTypingTarget({ target: globalThis })).toBe(true);
        focused.blur();
        expect(checkIsTypingTarget(null)).toBe(false);
    });

    test("knows a focused shadow widget and the controller's own subtree", () => {
        const host = addOutside(document.createElement('div'));
        const inner = document.createElement('button');
        host.attachShadow({ mode: 'open' }).appendChild(inner);
        expect(checkIsShadowWidgetTarget({ target: host })).toBe(false);
        inner.focus();
        expect(checkIsShadowWidgetTarget({ target: host })).toBe(true);
        expect(checkIsShadowWidgetTarget({ target: document.body })).toBe(
            false,
        );
        expect(checkIsShadowWidgetTarget({ target: globalThis })).toBe(false);
        expect(checkIsShadowWidgetTarget(null)).toBe(false);

        const overlay = addOutside(document.createElement('div'));
        overlay.id = 'presenting-control';
        const slider = document.createElement('input');
        overlay.appendChild(slider);
        expect(checkIsPresentingControlTarget({ target: slider })).toBe(true);
        expect(checkIsPresentingControlTarget({ target: host })).toBe(false);
        expect(checkIsPresentingControlTarget({ target: globalThis })).toBe(
            false,
        );
    });

    test('a swallowed key is replayed to the keyboard stack as a stand-in', () => {
        const fireEvent = vi
            .spyOn(KeyboardEventListener, 'fireEvent')
            .mockImplementation(() => {});
        const target = addOutside(document.createElement('div'));
        function swallow(type: string, init: KeyboardEventInit) {
            const event = new KeyboardEvent(type, {
                bubbles: true,
                cancelable: true,
                ...init,
            });
            let isSwallowed: boolean | null = null;
            const listener = (received: Event) => {
                isSwallowed = swallowPresentingKeyEvent(
                    received as KeyboardEvent,
                );
            };
            target.addEventListener(type, listener);
            target.dispatchEvent(event);
            target.removeEventListener(type, listener);
            return { event, isSwallowed: isSwallowed as boolean | null };
        }

        // A release and a bare modifier go nowhere at all.
        const keyUp = swallow('keyup', { key: 'z' });
        const modifier = swallow('keydown', { key: 'Shift', shiftKey: true });
        expect([keyUp.isSwallowed, modifier.isSwallowed]).toEqual([true, true]);
        expect(keyUp.event.defaultPrevented).toBe(true);
        expect(modifier.event.defaultPrevented).toBe(true);
        expect(fireEvent).not.toHaveBeenCalled();

        const undo = swallow('keydown', {
            key: 'z',
            code: 'KeyZ',
            ctrlKey: true,
        });
        expect(undo.isSwallowed).toBe(true);
        expect(undo.event.defaultPrevented).toBe(true);
        expect(fireEvent).toHaveBeenCalledTimes(1);
        const replayed = fireEvent.mock.calls[0][0] as any;
        // Not the original: the stack refuses a prevented event outright.
        expect(replayed).not.toBe(undo.event);
        expect(replayed).toMatchObject({
            type: 'keydown',
            key: 'z',
            code: 'KeyZ',
            repeat: false,
            ctrlKey: true,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            target,
            defaultPrevented: false,
        });
        replayed.stopPropagation();
        replayed.stopImmediatePropagation();
        expect(replayed.defaultPrevented).toBe(false);
        replayed.preventDefault();
        expect(replayed.defaultPrevented).toBe(true);
    });

    test('a key aimed inside the controller is left alone', () => {
        const fireEvent = vi
            .spyOn(KeyboardEventListener, 'fireEvent')
            .mockImplementation(() => {});
        const overlay = addOutside(document.createElement('div'));
        overlay.id = 'presenting-control';
        const slider = document.createElement('input');
        overlay.appendChild(slider);
        const event = new KeyboardEvent('keydown', {
            key: 'ArrowLeft',
            bubbles: true,
            cancelable: true,
        });
        let isSwallowed: boolean | null = null;
        slider.addEventListener('keydown', (received) => {
            isSwallowed = swallowPresentingKeyEvent(received);
        });
        slider.dispatchEvent(event);

        expect(isSwallowed).toBe(false);
        expect(event.defaultPrevented).toBe(false);
        // It bubbled on to `document.onkeydown` like any other key.
        expect(fireEvent).toHaveBeenCalledWith(event);
    });

    test('renders a key hint once per shortcut id', () => {
        const filter = vi.spyOn(
            KeyboardEventListener,
            'filterEventMappersByPlatform',
        );
        expect(toPresentingShortcutTitle('Back', 'exitTool')).toBe(
            'Back [Escape]',
        );
        expect(toPresentingShortcutTitle('Back out', 'exitTool')).toBe(
            'Back out [Escape]',
        );
        expect(filter).toHaveBeenCalledTimes(1);
    });
});
