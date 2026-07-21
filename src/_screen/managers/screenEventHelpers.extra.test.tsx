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

    test('blocks inactive wheel scrolling and reports normalized scroll positions', async () => {
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

        registerScrollingSyncEvent(target, onScroll);

        appProviderMock.getIsMouseOverApp.mockReturnValue(false);
        appProviderMock.getIsWindowFocused.mockReturnValue(true);
        const inactiveWheel = new Event('wheel', {
            bubbles: true,
            cancelable: true,
        });
        const inactivePreventDefault = vi.fn();
        Object.defineProperty(inactiveWheel, 'preventDefault', {
            configurable: true,
            value: inactivePreventDefault,
        });
        target.dispatchEvent(inactiveWheel);
        expect(inactivePreventDefault).toHaveBeenCalledOnce();

        appProviderMock.getIsMouseOverApp.mockReturnValue(true);
        appProviderMock.getIsWindowFocused.mockReturnValue(true);
        const activeWheel = new Event('wheel', {
            bubbles: true,
            cancelable: true,
        });
        const activePreventDefault = vi.fn();
        Object.defineProperty(activeWheel, 'preventDefault', {
            configurable: true,
            value: activePreventDefault,
        });
        target.dispatchEvent(activeWheel);
        expect(activePreventDefault).not.toHaveBeenCalled();

        const scrollEvent = new Event('scroll', {
            bubbles: true,
            cancelable: true,
        });
        const scrollPreventDefault = vi.fn();
        Object.defineProperty(scrollEvent, 'preventDefault', {
            configurable: true,
            value: scrollPreventDefault,
        });
        target.dispatchEvent(scrollEvent);

        expect(scrollPreventDefault).toHaveBeenCalledOnce();
        expect(onScroll).toHaveBeenCalledWith({ x: 0.5, y: 0.25 });
    });
});
