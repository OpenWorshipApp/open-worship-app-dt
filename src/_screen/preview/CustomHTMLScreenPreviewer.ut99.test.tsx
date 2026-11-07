// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    managers: new Map<number, any>(),
}));

vi.mock('./MiniScreenAppComp', () => ({
    default: ({ screenId }: { screenId: number }) => (
        <div className="mini-screen-app-stub" data-screen-id={screenId} />
    ),
}));
vi.mock('../managers/screenManagerBaseHelpers', () => ({
    getScreenManagerBase: (screenId: number) => {
        return h.managers.get(screenId) ?? null;
    },
}));

import CustomHTMLScreenPreviewer from './CustomHTMLScreenPreviewer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type PreviewerType = CustomHTMLScreenPreviewer;

function genManager(screenId: number) {
    const manager: any = {
        screenId,
        width: 1280,
        height: 720,
        scaleListeners: [] as (() => void)[],
        registerEventListener: vi.fn(
            (_events: string[], listener: () => void) => {
                manager.scaleListeners.push(listener);
                return [`scale-token-${screenId}`];
            },
        ),
        unregisterEventListener: vi.fn(),
    };
    h.managers.set(screenId, manager);
    return manager;
}

function genWrapper(width: number, height: number) {
    const wrapper = document.createElement('div');
    const size = { width, height };
    Object.defineProperty(wrapper, 'clientWidth', { get: () => size.width });
    Object.defineProperty(wrapper, 'clientHeight', {
        get: () => size.height,
    });
    document.body.appendChild(wrapper);
    return { wrapper, size };
}

function genPreviewer(screenId?: number) {
    const element = document.createElement(
        'mini-screen-previewer-custom-html',
    ) as PreviewerType;
    if (screenId !== undefined) {
        element.screenId = screenId;
    }
    return element;
}

async function attach(wrapper: HTMLElement, element: PreviewerType) {
    await act(async () => {
        wrapper.appendChild(element);
    });
}

// Removal is deferred to a microtask; flushing one inside act lets it run.
async function detach(element: PreviewerType) {
    await act(async () => {
        element.remove();
        await Promise.resolve();
    });
}

describe('mini-screen-previewer-custom-html', () => {
    beforeEach(() => {
        h.managers.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    test('is the registered element for its tag', () => {
        expect(genPreviewer()).toBeInstanceOf(CustomHTMLScreenPreviewer);
    });

    test('with no screen id it mounts nothing at all', async () => {
        const { wrapper } = genWrapper(640, 360);
        const element = genPreviewer();
        await attach(wrapper, element);
        expect(element.shadowRoot).toBeNull();
        expect(element.mountPoint.isConnected).toBe(false);
    });

    test('a screen with no manager gets its mount point but no preview', async () => {
        const { wrapper } = genWrapper(640, 360);
        const element = genPreviewer(3);
        await attach(wrapper, element);
        expect(element.shadowRoot!.firstElementChild).toBe(element.mountPoint);
        expect(element.mountPoint.innerHTML).toBe('');
        expect(element.mountPoint.style.transform).toBe('');
    });

    test('mounts the preview, answers DOM queries from inside its shadow root, and rescales on a scale event', async () => {
        const manager = genManager(1);
        const { wrapper, size } = genWrapper(640, 360);
        const element = genPreviewer(1);
        await attach(wrapper, element);
        const mountPoint = element.mountPoint;
        expect(mountPoint.style.width).toBe('1280px');
        expect(mountPoint.style.height).toBe('720px');
        expect(mountPoint.style.transform).toBe(
            'translate(0px, 0px) scale(0.5)',
        );
        const stub = mountPoint.querySelector('.mini-screen-app-stub');
        expect(stub?.getAttribute('data-screen-id')).toBe('1');
        // The shadow root hides the preview from `document`; the manager's
        // selector reaches into it instead.
        expect(document.querySelector('.mini-screen-app-stub')).toBeNull();
        expect(
            manager.getElementsByDomSelector('.mini-screen-app-stub'),
        ).toEqual([stub]);
        expect(manager.registerEventListener).toHaveBeenCalledWith(
            ['scale'],
            expect.any(Function),
        );

        // Full view: wider than the screen's ratio, so the height binds and
        // the preview is centred down the leftover space.
        size.width = 1280;
        size.height = 900;
        manager.scaleListeners[0]();
        expect(mountPoint.style.transform).toBe(
            'translate(0px, 90px) scale(1)',
        );
        // ...and once more after the layout has settled.
        size.width = 320;
        size.height = 180;
        expect(mountPoint.style.transform).toBe(
            'translate(0px, 90px) scale(1)',
        );
        await vi.advanceTimersByTimeAsync(100);
        expect(mountPoint.style.transform).toBe(
            'translate(0px, 0px) scale(0.25)',
        );
    });

    test('a scale event while the element is detached leaves the preview alone', async () => {
        const manager = genManager(1);
        const { wrapper } = genWrapper(640, 360);
        const element = genPreviewer(1);
        await attach(wrapper, element);
        const before = element.mountPoint.style.transform;
        await act(async () => {
            element.remove();
            // Before the deferred release runs.
            manager.scaleListeners[0]();
            await Promise.resolve();
        });
        expect(element.mountPoint.style.transform).toBe(before);
        await vi.advanceTimersByTimeAsync(100);
        expect(element.mountPoint.style.transform).toBe(before);
    });

    test('a reparent keeps the preview and its listener; a real removal lets go of both', async () => {
        const manager = genManager(2);
        const first = genWrapper(640, 360);
        const second = genWrapper(320, 180);
        const element = genPreviewer(2);
        await attach(first.wrapper, element);
        const stub = element.mountPoint.querySelector('.mini-screen-app-stub');

        // A React reparent: disconnect and reconnect in the same task.
        await act(async () => {
            second.wrapper.appendChild(element);
            await Promise.resolve();
        });
        expect(manager.registerEventListener).toHaveBeenCalledTimes(1);
        expect(manager.unregisterEventListener).not.toHaveBeenCalled();
        expect(element.mountPoint.querySelector('.mini-screen-app-stub')).toBe(
            stub,
        );
        // Re-fitted to the new parent.
        expect(element.mountPoint.style.transform).toBe(
            'translate(0px, 0px) scale(0.25)',
        );

        await detach(element);
        expect(manager.unregisterEventListener).toHaveBeenCalledWith([
            'scale-token-2',
        ]);
        expect(element.mountPoint.innerHTML).toBe('');

        // Back again: a fresh listener and a fresh root.
        await attach(first.wrapper, element);
        expect(manager.registerEventListener).toHaveBeenCalledTimes(2);
        expect(
            element.mountPoint.querySelector('.mini-screen-app-stub'),
        ).not.toBeNull();
    });

    test('removing one that never found its manager has nothing to release', async () => {
        const { wrapper } = genWrapper(640, 360);
        const element = genPreviewer(4);
        await attach(wrapper, element);
        await detach(element);
        expect(element.isConnected).toBe(false);
        expect(element.mountPoint.innerHTML).toBe('');
    });
});
