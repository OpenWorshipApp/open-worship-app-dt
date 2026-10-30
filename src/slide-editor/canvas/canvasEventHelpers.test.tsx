// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import EventHandler from '../../event/EventHandler';

const h = vi.hoisted(() => ({
    controller: null as any,
}));

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

// The real controller drags in every canvas item kind; these hooks only need
// its event surface and its scale, which a bare `EventHandler` provides.
vi.mock('./CanvasController', () => ({
    useCanvasControllerContext: () => h.controller,
}));

import {
    useCanvasControllerEvents,
    useCanvasControllerRefreshEvents,
    useSlideCanvasScale,
} from './canvasEventHelpers';

class FakeCanvasController extends EventHandler<string> {
    scale = 1;
    itemRegisterEventListener(
        eventNames: string[],
        listener: (data: any, time: number) => void,
    ) {
        return this.registerEventListener(eventNames, listener);
    }
}

let container: HTMLDivElement;
let root: Root;
let clock = 1_000;

async function fire(controller: FakeCanvasController, eventName: string) {
    await act(async () => {
        controller.addPropEvent(eventName, { canvasItems: [] });
        // Listeners run a few microtasks later, never synchronously.
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function render(element: ReactElement) {
    await act(async () => root.render(element));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    // Every event gets its own timestamp, so a refresh is never swallowed as
    // a same-millisecond state update.
    vi.spyOn(Date, 'now').mockImplementation(() => ++clock);
    h.controller = new FakeCanvasController();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('useCanvasControllerEvents', () => {
    function ListenerComp({
        eventTypes,
        callback,
    }: {
        eventTypes: string[];
        callback?: (data: any, time: number) => void;
    }) {
        useCanvasControllerEvents(eventTypes as any, callback);
        return null;
    }

    test('calls back for the subscribed events only, with their data', async () => {
        const callback = vi.fn();
        await render(
            <ListenerComp eventTypes={['update']} callback={callback} />,
        );

        await fire(h.controller, 'scale');
        expect(callback).not.toHaveBeenCalled();

        await fire(h.controller, 'update');
        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(
            { canvasItems: [] },
            expect.any(Number),
        );
    });

    test('a re-render swaps the callback without adding a second listener', async () => {
        const first = vi.fn();
        const second = vi.fn();
        await render(<ListenerComp eventTypes={['update']} callback={first} />);
        await render(
            <ListenerComp eventTypes={['update']} callback={second} />,
        );

        await fire(h.controller, 'update');

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();
    });

    test('follows a change of event types and stops on unmount', async () => {
        const callback = vi.fn();
        await render(
            <ListenerComp eventTypes={['update']} callback={callback} />,
        );
        await render(
            <ListenerComp eventTypes={['reload']} callback={callback} />,
        );

        await fire(h.controller, 'update');
        expect(callback).not.toHaveBeenCalled();
        await fire(h.controller, 'reload');
        expect(callback).toHaveBeenCalledOnce();

        await act(async () => root.unmount());
        root = createRoot(container);
        await fire(h.controller, 'reload');
        expect(callback).toHaveBeenCalledOnce();
    });

    test('tolerates having no callback at all', async () => {
        await render(<ListenerComp eventTypes={['update']} />);
        await expect(fire(h.controller, 'update')).resolves.toBeUndefined();
    });
});

describe('useSlideCanvasScale', () => {
    function ScaleComp({ controller }: { controller: FakeCanvasController }) {
        const scale = useSlideCanvasScale(controller as any);
        return <span>{scale}</span>;
    }

    test('starts from the controller scale and follows its scale events', async () => {
        const controller = new FakeCanvasController();
        controller.scale = 0.5;
        await render(<ScaleComp controller={controller} />);
        expect(container.textContent).toBe('0.5');

        controller.scale = 2;
        // Without the event nothing re-renders.
        expect(container.textContent).toBe('0.5');
        await fire(controller, 'scale');
        expect(container.textContent).toBe('2');

        controller.scale = 3;
        await fire(controller, 'update');
        expect(container.textContent).toBe('2');
    });

    test('lets go of the controller when unmounted', async () => {
        const controller = new FakeCanvasController();
        const unregister = vi.spyOn(controller, 'unregisterEventListener');
        await render(<ScaleComp controller={controller} />);

        await act(async () => root.unmount());
        root = createRoot(container);

        expect(unregister).toHaveBeenCalledOnce();
        expect(unregister.mock.calls[0][0]).toEqual([
            { eventName: 'scale', listener: expect.any(Function) },
        ]);
    });
});

describe('useCanvasControllerRefreshEvents', () => {
    function RefreshComp({
        eventTypes,
        onRender,
    }: {
        eventTypes?: string[];
        onRender: () => void;
    }) {
        useCanvasControllerRefreshEvents(eventTypes as any);
        onRender();
        return null;
    }

    test('re-renders on update and scale by default', async () => {
        const onRender = vi.fn();
        await render(<RefreshComp onRender={onRender} />);
        const mountRenders = onRender.mock.calls.length;

        await fire(h.controller, 'update');
        expect(onRender).toHaveBeenCalledTimes(mountRenders + 1);
        await fire(h.controller, 'scale');
        expect(onRender).toHaveBeenCalledTimes(mountRenders + 2);
        await fire(h.controller, 'reload');
        expect(onRender).toHaveBeenCalledTimes(mountRenders + 2);
    });

    test('re-renders only on the event types it is given', async () => {
        const onRender = vi.fn();
        await render(
            <RefreshComp eventTypes={['reload']} onRender={onRender} />,
        );
        const mountRenders = onRender.mock.calls.length;

        await fire(h.controller, 'update');
        expect(onRender).toHaveBeenCalledTimes(mountRenders);
        await fire(h.controller, 'reload');
        expect(onRender).toHaveBeenCalledTimes(mountRenders + 1);
    });
});
