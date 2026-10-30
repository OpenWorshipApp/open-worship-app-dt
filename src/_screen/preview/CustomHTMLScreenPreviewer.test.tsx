// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    bases: new Map<number, any>(),
    appRenders: [] as number[],
    appUnmounts: [] as number[],
}));

vi.mock('./MiniScreenAppComp', async () => {
    const { useEffect } = await import('react');
    return {
        default: ({ screenId }: { screenId: number }) => {
            h.appRenders.push(screenId);
            useEffect(() => {
                return () => {
                    h.appUnmounts.push(screenId);
                };
            }, [screenId]);
            return (
                <div data-stub="mini-screen-app" data-screen-id={screenId} />
            );
        },
    };
});
vi.mock('../managers/screenManagerBaseHelpers', () => ({
    getScreenManagerBase: (screenId: number) => h.bases.get(screenId) ?? null,
}));

import CustomHTMLScreenPreviewer from './CustomHTMLScreenPreviewer';

const TAG_NAME = 'mini-screen-previewer-custom-html';

function createBase(screenId: number, width = 1920, height = 1080) {
    const registered: { events: string[]; listener: () => void }[] = [];
    const base = {
        screenId,
        width,
        height,
        registered,
        getElementsByDomSelector: null as any,
        registerEventListener: vi.fn(
            (events: string[], listener: () => void) => {
                const entry = { events, listener };
                registered.push(entry);
                return entry;
            },
        ),
        unregisterEventListener: vi.fn(),
    };
    h.bases.set(screenId, base);
    return base;
}

function createParent(width: number, height: number) {
    const parent = document.createElement('div');
    Object.defineProperty(parent, 'clientWidth', {
        configurable: true,
        value: width,
    });
    Object.defineProperty(parent, 'clientHeight', {
        configurable: true,
        value: height,
    });
    document.body.appendChild(parent);
    return parent;
}

function createPreviewer(screenId: number) {
    const previewer = document.createElement(
        TAG_NAME,
    ) as CustomHTMLScreenPreviewer;
    previewer.screenId = screenId;
    return previewer;
}

async function flushMicrotasks() {
    await act(async () => {
        await Promise.resolve();
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.bases.clear();
    h.appRenders.length = 0;
    h.appUnmounts.length = 0;
    document.body.innerHTML = '';
});

afterEach(async () => {
    await act(async () => {
        document.body.innerHTML = '';
    });
    await flushMicrotasks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('CustomHTMLScreenPreviewer', () => {
    test('is registered once as the custom element', () => {
        expect(customElements.get(TAG_NAME)).toBe(CustomHTMLScreenPreviewer);
        const element = document.createElement(TAG_NAME);
        expect(element).toBeInstanceOf(CustomHTMLScreenPreviewer);
        expect((element as CustomHTMLScreenPreviewer).screenId).toBe(-1);
    });

    test('an element with no screen id stays empty', async () => {
        const parent = createParent(400, 225);
        const previewer = document.createElement(TAG_NAME);
        await act(async () => {
            parent.appendChild(previewer);
        });
        expect(previewer.shadowRoot).toBe(null);
        expect(h.appRenders).toEqual([]);
    });

    test('mounts the screen into its shadow root, scaled to its box', async () => {
        const base = createBase(2);
        const parent = createParent(480, 270);
        const previewer = createPreviewer(2);
        await act(async () => {
            parent.appendChild(previewer);
        });

        const mountPoint = previewer.shadowRoot!
            .firstElementChild as HTMLElement;
        expect(mountPoint).toBe(previewer.mountPoint);
        expect(
            mountPoint
                .querySelector('[data-stub="mini-screen-app"]')!
                .getAttribute('data-screen-id'),
        ).toBe('2');
        expect(mountPoint.style.width).toBe('1920px');
        expect(mountPoint.style.height).toBe('1080px');
        expect(mountPoint.style.transformOrigin).toBe('top left');
        expect(mountPoint.style.transform).toBe(
            'translate(0px, 0px) scale(0.25)',
        );
        // The manager can now query what this previewer drew.
        expect(base.getElementsByDomSelector('[data-stub]')).toHaveLength(1);
        expect(base.registerEventListener).toHaveBeenCalledTimes(1);
        expect(base.registered[0].events).toEqual(['scale']);
    });

    test('a box wider than the screen is contained by its height and centered', async () => {
        createBase(3, 1000, 500);
        const parent = createParent(800, 200);
        const previewer = createPreviewer(3);
        await act(async () => {
            parent.appendChild(previewer);
        });
        // Height binds: 200/500 = 0.4, leaving (800 - 400) / 2 on each side.
        expect(previewer.mountPoint.style.transform).toBe(
            'translate(200px, 0px) scale(0.4)',
        );
    });

    test('a scale event rescales now and once more after the layout settles', async () => {
        vi.useFakeTimers();
        const base = createBase(4, 1000, 500);
        const parent = createParent(500, 250);
        const previewer = createPreviewer(4);
        await act(async () => {
            parent.appendChild(previewer);
        });
        expect(previewer.mountPoint.style.transform).toBe(
            'translate(0px, 0px) scale(0.5)',
        );

        Object.defineProperty(parent, 'clientWidth', {
            configurable: true,
            value: 250,
        });
        Object.defineProperty(parent, 'clientHeight', {
            configurable: true,
            value: 125,
        });
        base.registered[0].listener();
        expect(previewer.mountPoint.style.transform).toBe(
            'translate(0px, 0px) scale(0.25)',
        );

        // The trailing pass picks up whatever the box became meanwhile.
        Object.defineProperty(parent, 'clientWidth', {
            configurable: true,
            value: 100,
        });
        Object.defineProperty(parent, 'clientHeight', {
            configurable: true,
            value: 50,
        });
        await vi.advanceTimersByTimeAsync(100);
        expect(previewer.mountPoint.style.transform).toBe(
            'translate(0px, 0px) scale(0.1)',
        );
    });

    test('scaling with no parent leaves the mount point as it is', () => {
        const base = createBase(5);
        const previewer = createPreviewer(5);
        previewer.mountPoint.style.transform = 'scale(0.7)';
        previewer.setMountPointScale(base as any);
        expect(previewer.mountPoint.style.transform).toBe('scale(0.7)');
    });

    test('a screen that no longer exists gets a shadow root and nothing else', async () => {
        const parent = createParent(400, 225);
        const previewer = createPreviewer(77);
        await act(async () => {
            parent.appendChild(previewer);
        });
        expect(previewer.shadowRoot).not.toBe(null);
        expect(h.appRenders).toEqual([]);
    });

    test('a React reparent keeps the root, the scale listener and the screen', async () => {
        const base = createBase(6);
        const firstParent = createParent(480, 270);
        const secondParent = createParent(480, 270);
        const previewer = createPreviewer(6);
        await act(async () => {
            firstParent.appendChild(previewer);
        });
        // Disconnect and reconnect in one go, as a reorder does.
        await act(async () => {
            secondParent.appendChild(previewer);
        });
        await flushMicrotasks();

        expect(base.unregisterEventListener).not.toHaveBeenCalled();
        expect(base.registerEventListener).toHaveBeenCalledTimes(1);
        expect(h.appUnmounts).toEqual([]);
        expect(previewer.shadowRoot!.childElementCount).toBe(1);
    });

    test('leaving the page unregisters and unmounts, and a return mounts afresh', async () => {
        const base = createBase(7);
        const parent = createParent(480, 270);
        const previewer = createPreviewer(7);
        await act(async () => {
            parent.appendChild(previewer);
        });
        const registered = base.registered[0];

        await act(async () => {
            previewer.remove();
        });
        await flushMicrotasks();
        expect(base.unregisterEventListener).toHaveBeenCalledWith(registered);
        expect(h.appUnmounts).toEqual([7]);

        // Back again: listens and renders anew.
        await act(async () => {
            parent.appendChild(previewer);
        });
        expect(base.registerEventListener).toHaveBeenCalledTimes(2);
        expect(h.appRenders.filter((id) => id === 7).length).toBeGreaterThan(1);
    });

    test('a removal before any screen was mounted cleans up nothing', async () => {
        const parent = createParent(400, 225);
        const previewer = createPreviewer(88);
        await act(async () => {
            parent.appendChild(previewer);
        });
        await act(async () => {
            previewer.remove();
        });
        await flushMicrotasks();
        expect(h.appUnmounts).toEqual([]);
    });
});
