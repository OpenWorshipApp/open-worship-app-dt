// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { providerMock } = vi.hoisted(() => ({
    providerMock: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
        },
    },
}));

vi.mock('../server/appProvider', () => ({
    default: providerMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));

import KeyboardEventListener, {
    KeyboardLayerContext,
    PlatformEnum,
    allArrows,
    checkIsControlKeys,
    checkIsKeyboardEventMatch,
    toShortcutKey,
    useKeyboardRegistering,
} from './KeyboardEventListener';

function setPlatform(platform: 'windows' | 'mac' | 'linux') {
    providerMock.systemUtils.isWindows = platform === 'windows';
    providerMock.systemUtils.isMac = platform === 'mac';
    providerMock.systemUtils.isLinux = platform === 'linux';
}

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('KeyboardEventListener', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        setPlatform('windows');
        (KeyboardEventListener as any).eventHandler = null;
        (KeyboardEventListener as any)._layers.length = 0;
        (KeyboardEventListener as any)._layers.push('root');
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('a subtree that claims a layer registers its own keys under it', async () => {
        // A modal pushes its layer in an EFFECT, and effects run child-first,
        // so a child that read the stack at mount would pin `root` and go dead
        // the moment the modal's layer went up. The layer travels as context,
        // read during render, parent first.
        const outsideListener = vi.fn();
        const insideListener = vi.fn();

        function Outside() {
            useKeyboardRegistering([{ key: 'F6' }], outsideListener, []);
            return null;
        }
        function Inside() {
            useKeyboardRegistering([{ key: 'F6' }], insideListener, []);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <>
                    <Outside />
                    <KeyboardLayerContext value="bible-lookup">
                        <Inside />
                    </KeyboardLayerContext>
                </>,
            );
        });

        const event = {
            key: 'F6',
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            defaultPrevented: false,
        };

        // Nothing claimed yet: the app underneath answers.
        KeyboardEventListener.fireEvent(event as any);
        await flushAsyncEvents();
        expect(outsideListener).toHaveBeenCalledTimes(1);
        expect(insideListener).not.toHaveBeenCalled();

        // Claimed: only the subtree that owns the keyboard answers. This is
        // the F6-clears-a-live-screen-through-an-open-modal bug.
        KeyboardEventListener.addLayer('bible-lookup');
        KeyboardEventListener.fireEvent(event as any);
        await flushAsyncEvents();
        expect(outsideListener).toHaveBeenCalledTimes(1);
        expect(insideListener).toHaveBeenCalledTimes(1);

        // Released: the app has its keyboard back.
        KeyboardEventListener.removeLayer('bible-lookup');
        KeyboardEventListener.fireEvent(event as any);
        await flushAsyncEvents();
        expect(outsideListener).toHaveBeenCalledTimes(2);
        expect(insideListener).toHaveBeenCalledTimes(1);
    });

    test('an explicit layer still beats the subtree it sits in', async () => {
        const listener = vi.fn();
        function Probe() {
            useKeyboardRegistering([{ key: 'F7' }], listener, [], 'popup');
            return null;
        }
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <KeyboardLayerContext value="bible-lookup">
                    <Probe />
                </KeyboardLayerContext>,
            );
        });
        const event = {
            key: 'F7',
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            defaultPrevented: false,
        };
        KeyboardEventListener.addLayer('bible-lookup');
        KeyboardEventListener.fireEvent(event as any);
        await flushAsyncEvents();
        expect(listener).not.toHaveBeenCalled();

        KeyboardEventListener.addLayer('popup');
        KeyboardEventListener.fireEvent(event as any);
        await flushAsyncEvents();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('re-asserts a layer instead of stacking it, so one close is enough', () => {
        // A widget that opens twice without closing in between -- an async
        // context-menu builder racing itself, a host unmounted with its menu
        // open -- used to push a DUPLICATE, and `removeLayer` takes one
        // occurrence off. The stack kept a layer nobody owned and every
        // `root` shortcut under it (Ctrl+B, F5-F10, the slide arrows) was
        // dead for the rest of the session.
        KeyboardEventListener.addLayer('context-menu');
        KeyboardEventListener.addLayer('context-menu');
        KeyboardEventListener.addLayer('context-menu');
        expect((KeyboardEventListener as any)._layers).toEqual([
            'root',
            'context-menu',
        ]);

        KeyboardEventListener.removeLayer('context-menu');
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        expect(
            KeyboardEventListener.toEventMapperKey({ key: 'ArrowRight' }),
        ).toBe('root>ArrowRight');
    });

    test('a second widget re-asserting moves it to the top of the stack', () => {
        KeyboardEventListener.addLayer('presenting-control');
        KeyboardEventListener.addLayer('context-menu');
        KeyboardEventListener.addLayer('presenting-control');
        expect((KeyboardEventListener as any)._layers).toEqual([
            'root',
            'context-menu',
            'presenting-control',
        ]);
        KeyboardEventListener.removeLayer('presenting-control');
        expect(KeyboardEventListener.getLastLayer()).toBe('context-menu');
        KeyboardEventListener.removeLayer('context-menu');
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
    });

    test('formats shortcut keys for each platform and rejects incompatible control maps', () => {
        setPlatform('windows');
        expect(toShortcutKey({ key: 'a' })).toBe('A');
        expect(
            toShortcutKey({ wControlKey: ['Shift', 'Ctrl'], key: 'a' } as any),
        ).toBe('Ctrl+Shift+A');
        expect(
            toShortcutKey({ allControlKey: ['Meta'], key: 'x' } as any),
        ).toBe('Command+X');
        expect(() =>
            toShortcutKey({ mControlKey: ['Meta'], key: 'a' } as any),
        ).toThrow(
            'mControlKey and lControlKey are ignored on Windows platform',
        );

        setPlatform('mac');
        expect(
            toShortcutKey({ mControlKey: ['Meta', 'Shift'], key: 'c' } as any),
        ).toBe('⌘⇧ C');
        expect(
            toShortcutKey({ allControlKey: ['Ctrl'], key: 'x' } as any),
        ).toBe('⌃ X');
        expect(() =>
            toShortcutKey({ wControlKey: ['Ctrl'], key: 'a' } as any),
        ).toThrow('wControlKey and lControlKey are ignored on Mac platform');

        setPlatform('linux');
        expect(
            toShortcutKey({ lControlKey: ['Ctrl', 'Alt'], key: 'z' } as any),
        ).toBe('Alt+Ctrl+Z');
        expect(() =>
            toShortcutKey({ mControlKey: ['Meta'], key: 'z' } as any),
        ).toThrow('wControlKey and mControlKey are ignored on Linux platform');
        expect(toShortcutKey({ key: '' })).toBe('');
        expect(allArrows).toContain('ArrowUp');
    });

    test('adds control keys without mutating the original mapper and filters by platform', () => {
        const eventMapper = { key: 'b' };

        setPlatform('windows');
        expect(
            KeyboardEventListener.addControlKey(
                eventMapper as any,
                {
                    key: 'b',
                    ctrlKey: true,
                    altKey: false,
                    shiftKey: true,
                    metaKey: false,
                } as any,
            ),
        ).toEqual({ key: 'b', wControlKey: ['Ctrl', 'Shift'] });
        expect(eventMapper).toEqual({ key: 'b' });

        setPlatform('mac');
        expect(
            KeyboardEventListener.addControlKey(
                { key: 'c' } as any,
                {
                    key: 'c',
                    ctrlKey: true,
                    altKey: true,
                    shiftKey: false,
                    metaKey: true,
                } as any,
            ),
        ).toEqual({ key: 'c', mControlKey: ['Ctrl', 'Option', 'Meta'] });

        setPlatform('windows');
        expect(
            KeyboardEventListener.filterEventMappersByPlatform([
                {
                    platform: PlatformEnum.Windows,
                    wControlKey: [],
                    key: 'a',
                } as any,
                {
                    platform: PlatformEnum.MacOS,
                    mControlKey: [],
                    key: 'b',
                } as any,
                { key: 'c' },
            ]),
        ).toEqual([
            { platform: PlatformEnum.Windows, wControlKey: [], key: 'a' },
            { key: 'c' },
        ]);
    });

    test('tracks layers, matches keyboard events, and dispatches registered listeners', async () => {
        setPlatform('windows');
        const event = {
            key: 'a',
            ctrlKey: true,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            defaultPrevented: false,
        };
        const eventMapper = { wControlKey: ['Ctrl'], key: 'a' } as any;
        const eventKey = KeyboardEventListener.toEventMapperKey(eventMapper);
        const listener = vi.fn();

        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        KeyboardEventListener.addLayer('context-menu');
        expect(KeyboardEventListener.getLastLayer()).toBe('context-menu');
        KeyboardEventListener.removeLayer('context-menu');
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        expect(
            KeyboardEventListener.genEventKeyFromFiredEvent(event as any),
        ).toBe(eventKey);
        expect(checkIsControlKeys({ key: 'Control' } as any)).toBe(true);
        expect(checkIsControlKeys({ key: 'Enter' } as any)).toBe(false);
        expect(checkIsKeyboardEventMatch([eventMapper], event as any)).toBe(
            true,
        );
        expect(checkIsKeyboardEventMatch([{ key: 'x' }], event as any)).toBe(
            false,
        );

        const registered = KeyboardEventListener.registerEventListener(
            [eventKey],
            listener,
        );
        KeyboardEventListener.fireEvent(event as any);
        await flushAsyncEvents();
        expect(listener).toHaveBeenCalledWith(event, expect.any(Number));

        KeyboardEventListener.unregisterEventListener(registered);
        KeyboardEventListener.fireEvent(event as any);
        await flushAsyncEvents();
        expect(listener).toHaveBeenCalledTimes(1);

        await expect(
            KeyboardEventListener.checkShouldNext({
                defaultPrevented: true,
            } as any),
        ).resolves.toBe(false);
    });

    test('registers keyboard listeners from the hook and cleans them up on unmount', async () => {
        setPlatform('windows');
        const listener = vi.fn();
        const registerSpy = vi.spyOn(
            KeyboardEventListener,
            'registerEventListener',
        );
        const unregisterSpy = vi.spyOn(
            KeyboardEventListener,
            'unregisterEventListener',
        );

        function Probe({ dep }: { dep: number }) {
            useKeyboardRegistering(
                [
                    { key: 'q' },
                    {
                        platform: PlatformEnum.Windows,
                        wControlKey: ['Ctrl'],
                        key: 'w',
                    } as any,
                    {
                        platform: PlatformEnum.MacOS,
                        mControlKey: ['Meta'],
                        key: 'm',
                    } as any,
                ],
                listener,
                [dep],
            );
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe dep={1} />);
        });

        expect(registerSpy).toHaveBeenCalledWith(
            ['root>Q', 'root>Ctrl+W'],
            expect.any(Function),
        );

        await act(async () => {
            root?.unmount();
        });
        root = null;

        expect(unregisterSpy).toHaveBeenCalledTimes(1);
    });

    test('keeps one registration while dispatching to the latest listener', async () => {
        setPlatform('windows');
        const firstListener = vi.fn();
        const secondListener = vi.fn();
        const registerSpy = vi.spyOn(
            KeyboardEventListener,
            'registerEventListener',
        );
        const unregisterSpy = vi.spyOn(
            KeyboardEventListener,
            'unregisterEventListener',
        );

        function Probe({
            listener,
        }: Readonly<{ listener: (event: any) => void }>) {
            useKeyboardRegistering([{ key: 'q' }], listener, []);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe listener={firstListener} />);
        });
        expect(registerSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
            root?.render(<Probe listener={secondListener} />);
        });
        expect(registerSpy).toHaveBeenCalledTimes(1);
        expect(unregisterSpy).not.toHaveBeenCalled();

        const event = {
            key: 'q',
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            defaultPrevented: false,
        };
        KeyboardEventListener.fireEvent(event as any);
        await flushAsyncEvents();

        expect(firstListener).not.toHaveBeenCalled();
        expect(secondListener).toHaveBeenCalledWith(event);
    });
});

describe('KeyboardEventListener keys, platforms and the document handler', () => {
    beforeEach(() => {
        setPlatform('windows');
        (KeyboardEventListener as any).eventHandler = null;
        (KeyboardEventListener as any)._layers.length = 0;
        (KeyboardEventListener as any)._layers.push('root');
        KeyboardEventListener.onMacQuitting = null;
    });

    afterEach(() => {
        KeyboardEventListener.onMacQuitting = null;
    });

    test('a printable key is read off its physical place, whatever the layout', () => {
        const toKey = (key: string, code: string) => {
            return KeyboardEventListener.toEnUsKey({ key, code } as any);
        };
        expect(toKey('ArrowUp', 'ArrowUp')).toBe('ArrowUp');
        expect(toKey('a', '')).toBe('a');
        // A German layout swaps Y and Z; the shortcut keeps its place.
        expect(toKey('z', 'KeyY')).toBe('y');
        expect(toKey('Z', 'KeyY')).toBe('Y');
        expect(toKey('§', 'Digit2')).toBe('2');
        expect(toKey('1', 'Numpad1')).toBe('1');
        expect(toKey('°', 'Minus')).toBe('°');
    });

    test('Alt on Windows, Shift on a Mac and every control on Linux are kept', () => {
        const event = {
            key: 'k',
            ctrlKey: true,
            altKey: true,
            shiftKey: true,
            metaKey: false,
        } as any;
        expect(
            KeyboardEventListener.addControlKey({ key: 'k' }, event),
        ).toEqual({ key: 'k', wControlKey: ['Ctrl', 'Alt', 'Shift'] });
        setPlatform('mac');
        expect(
            KeyboardEventListener.addControlKey({ key: 'k' }, event),
        ).toEqual({ key: 'k', mControlKey: ['Ctrl', 'Option', 'Shift'] });
        setPlatform('linux');
        expect(
            KeyboardEventListener.addControlKey({ key: 'k' }, event),
        ).toEqual({ key: 'k', lControlKey: ['Ctrl', 'Alt', 'Shift'] });
        expect(
            KeyboardEventListener.addControlKey({ key: 'k' }, {
                key: 'k',
            } as any),
        ).toEqual({ key: 'k', lControlKey: [] });
    });

    test('an instance of its own stops at a prevented event too', async () => {
        const handler = new KeyboardEventListener();
        const listener = vi.fn();
        handler.registerEventListener(['root>K'], listener);
        handler.addPropEvent('root>K', { defaultPrevented: false });
        await flushAsyncEvents();
        expect(listener).toHaveBeenCalledOnce();
        handler.addPropEvent('root>K', { defaultPrevented: true });
        await flushAsyncEvents();
        expect(listener).toHaveBeenCalledOnce();
    });

    test('the document passes a key on but never a bare control key', () => {
        const fireEvent = vi.spyOn(KeyboardEventListener, 'fireEvent');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }),
        );
        expect(fireEvent).not.toHaveBeenCalled();
        const event = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' });
        document.dispatchEvent(event);
        expect(fireEvent).toHaveBeenCalledExactlyOnceWith(event);
    });

    test('Command+Q on a Mac quits through its own handler, once one is set', () => {
        setPlatform('mac');
        const fireEvent = vi.spyOn(KeyboardEventListener, 'fireEvent');
        const quit = () => {
            const event = new KeyboardEvent('keydown', {
                key: 'q',
                code: 'KeyQ',
                metaKey: true,
                cancelable: true,
            });
            document.dispatchEvent(event);
            return event;
        };
        expect(quit().defaultPrevented).toBe(false);
        expect(fireEvent).toHaveBeenCalledOnce();

        const onMacQuitting = vi.fn();
        KeyboardEventListener.onMacQuitting = onMacQuitting;
        expect(quit().defaultPrevented).toBe(true);
        expect(onMacQuitting).toHaveBeenCalledOnce();
        expect(fireEvent).toHaveBeenCalledOnce();

        // The same press on Windows is an ordinary key.
        setPlatform('windows');
        expect(quit().defaultPrevented).toBe(false);
        expect(onMacQuitting).toHaveBeenCalledOnce();
        expect(fireEvent).toHaveBeenCalledTimes(2);
    });
});
