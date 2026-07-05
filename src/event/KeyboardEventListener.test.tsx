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

vi.mock('../helper/debuggerHelpers', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: React.useEffect,
    };
});

import KeyboardEventListener, {
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
        expect(listener).toHaveBeenCalledWith(event);

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
