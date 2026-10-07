// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const screenBackgroundRegisterMock = vi.fn();
const screenBackgroundUnregisterMock = vi.fn();
const screenVaryRegisterMock = vi.fn();
const screenVaryUnregisterMock = vi.fn();
const screenBibleRegisterMock = vi.fn();
const screenBibleUnregisterMock = vi.fn();
const screenForegroundRegisterMock = vi.fn();
const screenForegroundUnregisterMock = vi.fn();
const screenDrawRegisterMock = vi.fn();
const screenDrawUnregisterMock = vi.fn();

const appProviderMock = {
    getIsMouseOverApp: vi.fn(() => true),
    getIsWindowFocused: vi.fn(() => true),
};

vi.mock('../../helper/appHooks', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: React.useEffect,
        useAppCurrentRef: (target: any) => {
            const ref = React.useRef(target);
            ref.current = target;
            return ref;
        },
    };
});

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('./ScreenBackgroundManager', () => ({
    default: class ScreenBackgroundManager {
        static registerEventListener = screenBackgroundRegisterMock;
        static unregisterEventListener = screenBackgroundUnregisterMock;
    },
}));

vi.mock('./ScreenVaryAppDocumentManager', () => ({
    default: class ScreenVaryAppDocumentManager {
        static registerEventListener = screenVaryRegisterMock;
        static unregisterEventListener = screenVaryUnregisterMock;
    },
}));

vi.mock('./ScreenBibleManager', () => ({
    default: class ScreenBibleManager {
        static registerEventListener = screenBibleRegisterMock;
        static unregisterEventListener = screenBibleUnregisterMock;
    },
}));

vi.mock('./ScreenForegroundManager', () => ({
    default: class ScreenForegroundManager {
        static registerEventListener = screenForegroundRegisterMock;
        static unregisterEventListener = screenForegroundUnregisterMock;
    },
}));

vi.mock('./ScreenDrawManager', () => ({
    default: class ScreenDrawManager {
        static registerEventListener = screenDrawRegisterMock;
        static unregisterEventListener = screenDrawUnregisterMock;
    },
}));

vi.mock('./ScreenFocusManager', () => ({
    default: class ScreenFocusManager {
        static registerEventListener = vi.fn(() => []);
        static unregisterEventListener = vi.fn();
    },
}));

describe('screenEventHelpers', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.innerHTML = '';
        document.body.appendChild(container);
        root = createRoot(container);
        vi.clearAllMocks();
        appProviderMock.getIsMouseOverApp.mockReturnValue(true);
        appProviderMock.getIsWindowFocused.mockReturnValue(true);
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('uses instance event handlers and cleans them up', async () => {
        const { useScreenEvents } = await import('./screenEventHelpers');

        let updateCallback: ((data: string, time: number) => void) | undefined;
        const staticHandler = {
            registerEventListener: vi.fn(),
            unregisterEventListener: vi.fn(),
        };
        const instanceHandler = {
            registerEventListener: vi.fn((_events: string[], callback) => {
                updateCallback = callback;
                return ['instance-listener'];
            }),
            unregisterEventListener: vi.fn(),
        };
        const onData = vi.fn();

        function Host() {
            useScreenEvents(
                ['update'],
                staticHandler as any,
                instanceHandler as any,
                onData,
            );
            return null;
        }

        await act(async () => {
            root.render(<Host />);
        });

        expect(instanceHandler.registerEventListener).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
        );
        expect(staticHandler.registerEventListener).not.toHaveBeenCalled();

        await act(async () => {
            updateCallback?.('payload', Date.now());
        });

        expect(onData).toHaveBeenCalledWith('payload', expect.any(Number));

        await act(async () => {
            root.unmount();
        });

        expect(instanceHandler.unregisterEventListener).toHaveBeenCalledWith([
            'instance-listener',
        ]);
        root = createRoot(container);
    });

    test('keeps a single registration while dispatching to the latest callback', async () => {
        const { useScreenEvents } = await import('./screenEventHelpers');

        let updateCallback: ((data: string, time: number) => void) | undefined;
        const staticHandler = {
            registerEventListener: vi.fn((_events: string[], callback) => {
                updateCallback = callback;
                return ['static-listener'];
            }),
            unregisterEventListener: vi.fn(),
        };
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        function Host({
            callback,
        }: Readonly<{ callback: (data: any) => void }>) {
            useScreenEvents(
                ['update'],
                staticHandler as any,
                undefined,
                callback,
            );
            return null;
        }

        await act(async () => {
            root.render(<Host callback={firstCallback} />);
        });
        expect(staticHandler.registerEventListener).toHaveBeenCalledTimes(1);

        await act(async () => {
            root.render(<Host callback={secondCallback} />);
        });
        expect(staticHandler.registerEventListener).toHaveBeenCalledTimes(1);
        expect(staticHandler.unregisterEventListener).not.toHaveBeenCalled();

        await act(async () => {
            updateCallback?.('payload', Date.now());
        });
        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).toHaveBeenCalledWith(
            'payload',
            expect.any(Number),
        );
    });

    test('re-registers listeners when the events list changes', async () => {
        const { useScreenEvents } = await import('./screenEventHelpers');

        const staticHandler = {
            registerEventListener: vi.fn((events: string[]) => {
                return events.map((eventName) => `${eventName}-listener`);
            }),
            unregisterEventListener: vi.fn(),
        };

        function Host({ events }: Readonly<{ events: string[] }>) {
            useScreenEvents(events, staticHandler as any);
            return null;
        }

        await act(async () => {
            root.render(<Host events={['update']} />);
        });
        expect(staticHandler.registerEventListener).toHaveBeenCalledTimes(1);

        await act(async () => {
            root.render(<Host events={['update', 'delete']} />);
        });
        expect(staticHandler.registerEventListener).toHaveBeenCalledTimes(2);
        expect(staticHandler.unregisterEventListener).toHaveBeenCalledWith([
            'update-listener',
        ]);
        expect(staticHandler.registerEventListener).toHaveBeenLastCalledWith(
            ['update', 'delete'],
            expect.any(Function),
        );
    });

    test('falls back to static handlers and wrapper hooks subscribe to their classes', async () => {
        const {
            useScreenEvents,
            useScreenBackgroundManagerEvents,
            useScreenVaryAppDocumentManagerEvents,
            useScreenBibleManagerEvents,
            useScreenForegroundManagerEvents,
            useScreenDrawManagerEvents,
        } = await import('./screenEventHelpers');

        let staticCallback: (() => void) | undefined;
        const staticHandler = {
            registerEventListener: vi.fn((_events: string[], callback) => {
                staticCallback = callback;
                return ['static-listener'];
            }),
            unregisterEventListener: vi.fn(),
        };

        screenBackgroundRegisterMock.mockReturnValue(['background-listener']);
        screenVaryRegisterMock.mockReturnValue(['vary-listener']);
        screenBibleRegisterMock.mockReturnValue(['bible-listener']);
        screenForegroundRegisterMock.mockReturnValue(['foreground-listener']);
        screenDrawRegisterMock.mockReturnValue(['draw-listener']);

        function Host() {
            useScreenEvents(['sync'], staticHandler as any);
            useScreenBackgroundManagerEvents(['update']);
            useScreenVaryAppDocumentManagerEvents(['update']);
            useScreenBibleManagerEvents(['update']);
            useScreenForegroundManagerEvents(['update']);
            useScreenDrawManagerEvents(['update']);
            return null;
        }

        await act(async () => {
            root.render(<Host />);
        });

        expect(staticHandler.registerEventListener).toHaveBeenCalledWith(
            ['sync'],
            expect.any(Function),
        );
        expect(screenBackgroundRegisterMock).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
        );
        expect(screenVaryRegisterMock).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
        );
        expect(screenBibleRegisterMock).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
        );
        expect(screenForegroundRegisterMock).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
        );
        expect(screenDrawRegisterMock).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
        );

        await act(async () => {
            staticCallback?.();
        });

        await act(async () => {
            root.unmount();
        });

        expect(staticHandler.unregisterEventListener).toHaveBeenCalledWith([
            'static-listener',
        ]);
        expect(screenBackgroundUnregisterMock).toHaveBeenCalledWith([
            'background-listener',
        ]);
        expect(screenVaryUnregisterMock).toHaveBeenCalledWith([
            'vary-listener',
        ]);
        expect(screenBibleUnregisterMock).toHaveBeenCalledWith([
            'bible-listener',
        ]);
        expect(screenForegroundUnregisterMock).toHaveBeenCalledWith([
            'foreground-listener',
        ]);
        expect(screenDrawUnregisterMock).toHaveBeenCalledWith([
            'draw-listener',
        ]);
        root = createRoot(container);
    });

    test('never cancels a wheel and says which scrolls followed one', async () => {
        const { registerScrollingSyncEvent } =
            await import('./screenEventHelpers');

        const target = document.createElement('div');
        Object.defineProperties(target, {
            scrollLeft: {
                configurable: true,
                writable: true,
                value: 50,
            },
            scrollTop: {
                configurable: true,
                writable: true,
                value: 25,
            },
            scrollWidth: { configurable: true, value: 200 },
            clientWidth: { configurable: true, value: 100 },
            scrollHeight: { configurable: true, value: 125 },
            clientHeight: { configurable: true, value: 25 },
        });
        const onScroll = vi.fn();
        const nowSpy = vi.spyOn(performance, 'now');
        try {
            registerScrollingSyncEvent(target, onScroll);

            // a scroll no wheel drove: a scrollbar drag, a key, a program
            nowSpy.mockReturnValue(1000);
            target.dispatchEvent(new Event('scroll'));
            expect(onScroll).toHaveBeenLastCalledWith(
                { x: 0.5, y: 0.25 },
                false,
            );

            // Right after a reload, with the pointer resting on the mini screen
            // and the window not focused, both window-level flags are false.
            // The wheel is still the operator's and must scroll.
            appProviderMock.getIsMouseOverApp.mockReturnValue(false);
            appProviderMock.getIsWindowFocused.mockReturnValue(false);
            const wheel = new Event('wheel', {
                bubbles: true,
                cancelable: true,
            });
            target.dispatchEvent(wheel);
            expect(wheel.defaultPrevented).toBe(false);

            nowSpy.mockReturnValue(1500);
            target.dispatchEvent(new Event('scroll'));
            expect(onScroll).toHaveBeenLastCalledWith(
                { x: 0.5, y: 0.25 },
                true,
            );

            // long after the wheel, a scroll is no longer the wheel's
            nowSpy.mockReturnValue(2500);
            target.dispatchEvent(new Event('scroll'));
            expect(onScroll).toHaveBeenLastCalledWith(
                { x: 0.5, y: 0.25 },
                false,
            );
        } finally {
            nowSpy.mockRestore();
        }
    });

    test('never sends back the scrolls a remote sync set off', async () => {
        const { registerScrollingSyncEvent } =
            await import('./screenEventHelpers');
        const { applyRemoteScrollPercentage } =
            await import('./screenScrollSyncHelpers');

        const target = document.createElement('div');
        Object.defineProperties(target, {
            scrollLeft: { configurable: true, writable: true, value: 50 },
            scrollTop: { configurable: true, writable: true, value: 25 },
            scrollWidth: { configurable: true, value: 200 },
            clientWidth: { configurable: true, value: 100 },
            scrollHeight: { configurable: true, value: 125 },
            clientHeight: { configurable: true, value: 25 },
        });
        target.scrollTo = vi.fn() as any;
        const onScroll = vi.fn();
        const nowSpy = vi.spyOn(performance, 'now');
        try {
            registerScrollingSyncEvent(target, onScroll);

            nowSpy.mockReturnValue(1000);
            applyRemoteScrollPercentage(target, { x: 0.5, y: 0.25 });
            expect(target.scrollTo).toHaveBeenCalledWith({
                left: 50,
                top: 25,
            });

            // The scrollTo's own event, then the reflow's follow-ups, at
            // positions that need not match: none of them is the operator's,
            // and sending any of them out echoes it between windows forever.
            nowSpy.mockReturnValue(1016);
            target.dispatchEvent(new Event('scroll'));
            (target as any).scrollTop = 40;
            nowSpy.mockReturnValue(1100);
            target.dispatchEvent(new Event('scroll'));
            nowSpy.mockReturnValue(1900);
            target.dispatchEvent(new Event('scroll'));
            expect(onScroll).not.toHaveBeenCalled();

            // A wheel on this container after the remote scroll landed is
            // the operator taking it back: through at once, as a wheel's.
            nowSpy.mockReturnValue(1950);
            target.dispatchEvent(new Event('wheel'));
            nowSpy.mockReturnValue(1966);
            target.dispatchEvent(new Event('scroll'));
            expect(onScroll).toHaveBeenLastCalledWith({ x: 0.5, y: 0.4 }, true);

            // A press counts too (a scrollbar grab, the to-the-top button),
            // but only a wheel lets it past the window-level check.
            onScroll.mockClear();
            nowSpy.mockReturnValue(3000);
            applyRemoteScrollPercentage(target, { x: 0, y: 0 });
            nowSpy.mockReturnValue(3100);
            target.dispatchEvent(new Event('scroll'));
            expect(onScroll).not.toHaveBeenCalled();
            target.dispatchEvent(new Event('pointerdown'));
            target.dispatchEvent(new Event('scroll'));
            expect(onScroll).toHaveBeenLastCalledWith(
                { x: 0.5, y: 0.4 },
                false,
            );

            // Once the quiet window is over, other scrolls flow as before.
            onScroll.mockClear();
            nowSpy.mockReturnValue(5000);
            applyRemoteScrollPercentage(target, { x: 0, y: 0 });
            nowSpy.mockReturnValue(6001);
            target.dispatchEvent(new Event('scroll'));
            expect(onScroll).toHaveBeenCalledWith({ x: 0.5, y: 0.4 }, false);
        } finally {
            nowSpy.mockRestore();
        }
    });

    test('registers one set of listeners per container', async () => {
        const { registerScrollingSyncEvent } =
            await import('./screenEventHelpers');

        const target = document.createElement('div');
        Object.defineProperties(target, {
            scrollLeft: { configurable: true, writable: true, value: 0 },
            scrollTop: { configurable: true, writable: true, value: 50 },
            scrollWidth: { configurable: true, value: 200 },
            clientWidth: { configurable: true, value: 100 },
            scrollHeight: { configurable: true, value: 200 },
            clientHeight: { configurable: true, value: 100 },
        });
        const addEventListenerSpy = vi.spyOn(target, 'addEventListener');
        const first = vi.fn();
        const second = vi.fn();
        registerScrollingSyncEvent(target, first);
        const listenerCount = addEventListenerSpy.mock.calls.length;
        // The bible view is handed the same div on every effect re-run.
        registerScrollingSyncEvent(target, second);
        expect(addEventListenerSpy).toHaveBeenCalledTimes(listenerCount);

        target.dispatchEvent(new Event('scroll'));
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledWith({ x: 0, y: 0.5 }, false);
    });

    test('never echoes a scroll an auto-scroll is driving, however many listen', async () => {
        const { registerScrollingSyncEvent } =
            await import('./screenEventHelpers');
        const { writeSubPixelScrollTop, releaseSubPixelScroll } =
            await import('../../scrolling/subPixelScrollHelpers');

        const target = document.createElement('div');
        Object.defineProperties(target, {
            scrollLeft: { configurable: true, writable: true, value: 50 },
            scrollTop: { configurable: true, writable: true, value: 25 },
            scrollWidth: { configurable: true, value: 200 },
            clientWidth: { configurable: true, value: 100 },
            scrollHeight: { configurable: true, value: 125 },
            clientHeight: { configurable: true, value: 25 },
        });
        // Registered twice, as a StrictMode remount of the projector's
        // bible view does. A rounded offset sent back to the mini preview
        // driving it knocked the preview off its slide, which shook.
        const first = vi.fn();
        const second = vi.fn();
        registerScrollingSyncEvent(target, first);
        registerScrollingSyncEvent(target, second);
        // The projector's own window focused, the pointer over it.
        appProviderMock.getIsMouseOverApp.mockReturnValue(true);
        appProviderMock.getIsWindowFocused.mockReturnValue(true);

        // One auto-scroll frame, with no sync message marking it: sliding by
        // a fraction of a pixel alone keeps it quiet.
        writeSubPixelScrollTop(target, 25.4);
        target.dispatchEvent(new Event('scroll'));
        target.dispatchEvent(new Event('scroll'));
        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled();

        // A wheel while it plays is still the operator's.
        target.dispatchEvent(new Event('wheel'));
        target.scrollTop = 75;
        target.dispatchEvent(new Event('scroll'));
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith({ x: 0.5, y: 0.75 }, true);

        // Stopped: a plain scroll speaks again.
        releaseSubPixelScroll(target);
        vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 5000);
        second.mockClear();
        target.dispatchEvent(new Event('scroll'));
        expect(second).toHaveBeenCalledWith({ x: 0.5, y: 0.75 }, false);
    });
});
