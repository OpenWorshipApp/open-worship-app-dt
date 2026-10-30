// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

const state = vi.hoisted(() => ({
    observers: [] as {
        callback: () => void;
        observed: Element[];
        disconnect: Mock<() => void>;
    }[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});

import ShadowingFillParentWidthComp, {
    useShadowingParentWidth,
} from './ShadowingFillParentWidthComp';

class FakeResizeObserver {
    record: (typeof state.observers)[number];
    constructor(callback: () => void) {
        this.record = { callback, observed: [], disconnect: vi.fn() };
        state.observers.push(this.record);
    }
    observe(element: Element) {
        this.record.observed.push(element);
    }
    disconnect() {
        this.record.disconnect();
    }
}

function WidthProbeComp({ label }: Readonly<{ label: string }>) {
    const width = useShadowingParentWidth();
    return <pre>{`${label}:${width ?? 'unknown'}`}</pre>;
}

let host: HTMLDivElement;
let root: Root;

function setParentWidth(width: number) {
    Object.defineProperty(host, 'clientWidth', {
        configurable: true,
        value: width,
    });
}

function getTag() {
    return host.querySelector('shadowing-parent-width-tag') as HTMLElement & {
        connectedCallback: () => void;
    };
}

function getShadowText() {
    return getTag().shadowRoot!.querySelector('pre')?.textContent ?? null;
}

async function flushTask() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    state.observers = [];
    host = document.createElement('div');
    document.body.append(host);
    setParentWidth(640);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('ShadowingFillParentWidthComp', () => {
    test('renders its children inside a shadow root, given the parent width', async () => {
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp>
                    <WidthProbeComp label="slide" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        const tag = getTag();
        // The content lives in the shadow root, not in the light DOM.
        expect(tag.querySelector('pre')).toBeNull();
        expect(getShadowText()).toBe('slide:640');
        // Its own transition style comes along into the shadow root.
        expect(tag.shadowRoot!.querySelector('style')!.textContent).toContain(
            'transition: transform 0.1s ease-in-out',
        );
        expect(state.observers).toHaveLength(1);
        expect(state.observers[0].observed).toEqual([host]);
    });

    test('follows the parent when it is resized', async () => {
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp>
                    <WidthProbeComp label="card" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        setParentWidth(321.5);
        await act(async () => state.observers[0].callback());
        await flushTask();
        expect(getShadowText()).toBe('card:321.5');
    });

    test('new children replace the old ones in the shadow root', async () => {
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp>
                    <WidthProbeComp label="first" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp>
                    <WidthProbeComp label="second" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        expect(getShadowText()).toBe('second:640');
    });

    test('a new width re-measures and swaps the observer', async () => {
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp width={100}>
                    <WidthProbeComp label="w" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        setParentWidth(800);
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp width={200}>
                    <WidthProbeComp label="w" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        expect(state.observers).toHaveLength(2);
        expect(state.observers[0].disconnect).toHaveBeenCalledOnce();
        expect(state.observers[1].disconnect).not.toHaveBeenCalled();
        expect(getShadowText()).toBe('w:800');
    });

    test('an unreadable width attribute is passed on as unknown', async () => {
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp>
                    <WidthProbeComp label="x" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        const tag = getTag();
        tag.setAttribute('parentWidth', 'not-a-number');
        await act(async () => tag.connectedCallback());
        await flushTask();
        expect(getShadowText()).toBe('x:unknown');
        tag.removeAttribute('parentWidth');
        await act(async () => tag.connectedCallback());
        await flushTask();
        expect(getShadowText()).toBe('x:unknown');
    });

    test('unmounting tears the inner root down after the commit', async () => {
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp>
                    <WidthProbeComp label="gone" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        const tag = getTag();
        const mountPoint = tag.shadowRoot!.querySelector('div')!;
        expect(mountPoint.textContent).toContain('gone:640');
        // A synchronous act: the commit only, no task runs inside it.
        act(() => root.unmount());
        expect(tag.isConnected).toBe(false);
        // Deferred to a task: still there right after the commit.
        expect(mountPoint.textContent).toContain('gone:640');
        await flushTask();
        expect(mountPoint.innerHTML).toBe('');
        expect(state.observers[0].disconnect).toHaveBeenCalledOnce();
        root = createRoot(host);
    });

    test('a reparent (disconnect then reconnect) keeps the inner root', async () => {
        await act(async () =>
            root.render(
                <ShadowingFillParentWidthComp>
                    <WidthProbeComp label="moved" />
                </ShadowingFillParentWidthComp>,
            ),
        );
        await flushTask();
        const tag = getTag();
        const otherParent = document.createElement('section');
        document.body.append(otherParent);
        try {
            await act(async () => {
                otherParent.append(tag);
            });
            await flushTask();
            expect(tag.isConnected).toBe(true);
            expect(tag.shadowRoot!.querySelector('pre')!.textContent).toBe(
                'moved:640',
            );
        } finally {
            // Put it back so React can unmount it from where it rendered it.
            host.append(tag);
            await flushTask();
            otherParent.remove();
        }
    });
});
