// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../helper/debuggerHelpers', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
    };
});

vi.mock('./CanvasController', async () => {
    const React = await import('react');
    const CanvasControllerContext = React.createContext<any>(null);
    return {
        CanvasControllerContext,
        default: class CanvasControllerMock {},
        useCanvasControllerContext: () => {
            const context = React.useContext(CanvasControllerContext);
            if (context === null) {
                throw new Error('CanvasControllerContext is null');
            }
            return context;
        },
    };
});

import { CanvasControllerContext } from './CanvasController';
import {
    useCanvasControllerEvents,
    useCanvasControllerRefreshEvents,
    useSlideCanvasScale,
} from './canvasEventHelpers';

function createFakeController() {
    const listeners = new Map<string, Set<(data: any) => void>>();

    return {
        scale: 1,
        itemRegisterEventListener: vi.fn(
            (eventTypes: string[], listener: (data: any) => void) => {
                return eventTypes.map((eventName) => {
                    const eventListeners =
                        listeners.get(eventName) ?? new Set();
                    eventListeners.add(listener);
                    listeners.set(eventName, eventListeners);
                    return { eventName, listener };
                });
            },
        ),
        unregisterEventListener: vi.fn((registeredEvents: any[]) => {
            for (const { eventName, listener } of registeredEvents) {
                listeners.get(eventName)?.delete(listener);
            }
        }),
        emit(eventName: string, data: any = { canvasItems: [] }) {
            for (const listener of listeners.get(eventName) ?? []) {
                listener(data);
            }
        },
    };
}

function EventHarness({ onEvent }: Readonly<{ onEvent: (data: any) => void }>) {
    useCanvasControllerEvents(['update', 'reload'], onEvent);
    return <div data-testid="events" />;
}

function ScaleHarness({
    controller,
    onScale,
}: Readonly<{
    controller: any;
    onScale: (scale: number) => void;
}>) {
    const scale = useSlideCanvasScale(controller);

    useEffect(() => {
        onScale(scale);
    }, [onScale, scale]);

    return <div data-testid="scale">{scale}</div>;
}

function RefreshHarness({ eventTypes }: Readonly<{ eventTypes?: string[] }>) {
    const refreshCount = useCanvasControllerRefreshEvents(eventTypes as any);
    return <div data-testid="refresh">{refreshCount}</div>;
}

describe('canvasEventHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
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

    test('registers and unregisters controller event listeners', async () => {
        const controller = createFakeController();
        const onEvent = vi.fn();

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <CanvasControllerContext.Provider value={controller as any}>
                    <EventHarness onEvent={onEvent} />
                </CanvasControllerContext.Provider>,
            );
        });

        controller.emit('update', { canvasItems: [{ id: 1 }] });
        controller.emit('reload', { canvasItems: [{ id: 2 }] });

        expect(onEvent).toHaveBeenNthCalledWith(1, {
            canvasItems: [{ id: 1 }],
        });
        expect(onEvent).toHaveBeenNthCalledWith(2, {
            canvasItems: [{ id: 2 }],
        });

        await act(async () => {
            root?.unmount();
            root = null;
        });

        expect(controller.unregisterEventListener).toHaveBeenCalledTimes(1);

        controller.emit('update', { canvasItems: [{ id: 3 }] });
        expect(onEvent).toHaveBeenCalledTimes(2);
    });

    test('keeps controller registration while dispatching to the latest callback', async () => {
        const controller = createFakeController();
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <CanvasControllerContext.Provider value={controller as any}>
                    <EventHarness onEvent={firstCallback} />
                </CanvasControllerContext.Provider>,
            );
        });
        expect(controller.itemRegisterEventListener).toHaveBeenCalledTimes(1);

        await act(async () => {
            root?.render(
                <CanvasControllerContext.Provider value={controller as any}>
                    <EventHarness onEvent={secondCallback} />
                </CanvasControllerContext.Provider>,
            );
        });
        expect(controller.itemRegisterEventListener).toHaveBeenCalledTimes(1);
        expect(controller.unregisterEventListener).not.toHaveBeenCalled();

        controller.emit('update', { canvasItems: [{ id: 1 }] });
        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).toHaveBeenCalledWith({
            canvasItems: [{ id: 1 }],
        });
    });

    test('re-registers controller listeners when event types change', async () => {
        const controller = createFakeController();
        const onEvent = vi.fn();

        function Harness({ eventTypes }: Readonly<{ eventTypes: string[] }>) {
            useCanvasControllerEvents(eventTypes as any, onEvent);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <CanvasControllerContext.Provider value={controller as any}>
                    <Harness eventTypes={['update']} />
                </CanvasControllerContext.Provider>,
            );
        });
        expect(controller.itemRegisterEventListener).toHaveBeenCalledTimes(1);

        await act(async () => {
            root?.render(
                <CanvasControllerContext.Provider value={controller as any}>
                    <Harness eventTypes={['update', 'reload']} />
                </CanvasControllerContext.Provider>,
            );
        });
        expect(controller.itemRegisterEventListener).toHaveBeenCalledTimes(2);
        expect(controller.unregisterEventListener).toHaveBeenCalledTimes(1);

        controller.emit('reload', { canvasItems: [] });
        expect(onEvent).toHaveBeenCalledWith({ canvasItems: [] });
    });

    test('tracks scale changes and refresh counters from controller events', async () => {
        const controller = createFakeController();
        const observedScales: number[] = [];

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <CanvasControllerContext.Provider value={controller as any}>
                    <ScaleHarness
                        controller={controller}
                        onScale={(scale) => {
                            observedScales.push(scale);
                        }}
                    />
                    <RefreshHarness />
                </CanvasControllerContext.Provider>,
            );
        });

        controller.scale = 1.5;
        await act(async () => {
            controller.emit('scale');
        });

        await act(async () => {
            controller.emit('update');
        });

        await act(async () => {
            controller.emit('reload');
        });

        expect(observedScales).toEqual([1, 1.5]);
        expect(
            container?.querySelector('[data-testid="refresh"]')?.textContent,
        ).toBe('2');
    });
});
