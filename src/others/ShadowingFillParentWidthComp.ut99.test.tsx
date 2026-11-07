// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    // What `useAppEffect` is outside dev.
    return { useAppEffect: useEffect };
});

import ShadowingFillParentWidthComp, {
    useShadowingParentWidth,
} from './ShadowingFillParentWidthComp';

type ObserverRecordType = {
    callback: () => void;
    observed: Element[];
    disconnectCount: number;
};

function WidthProbeComp({ label }: Readonly<{ label: string }>) {
    const parentWidth = useShadowingParentWidth();
    return (
        <span className="probe">
            {label}:{parentWidth === undefined ? 'none' : parentWidth}
        </span>
    );
}

let container: HTMLDivElement;
let root: Root | null = null;
let observers: ObserverRecordType[] = [];
let clientWidth = 0;
const originalResizeObserver = globalThis.ResizeObserver;

function readProbe(host: Element | null) {
    return host?.shadowRoot?.querySelector('.probe')?.textContent ?? null;
}

async function waitForTask() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    observers = [];
    clientWidth = 500;
    (globalThis as any).ResizeObserver = class {
        record: ObserverRecordType;
        constructor(callback: () => void) {
            this.record = { callback, observed: [], disconnectCount: 0 };
            observers.push(this.record);
        }
        observe(target: Element) {
            this.record.observed.push(target);
        }
        disconnect() {
            this.record.disconnectCount++;
        }
    };
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {
        configurable: true,
        get: () => clientWidth,
    });
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    const currentRoot = root;
    root = null;
    if (currentRoot !== null) {
        await act(async () => {
            currentRoot.unmount();
        });
    }
    await waitForTask();
    container.remove();
    (globalThis as any).ResizeObserver = originalResizeObserver;
});

describe('ShadowingFillParentWidthComp', () => {
    test('renders its children in the shadow root with the parent width', async () => {
        await act(async () => {
            root!.render(
                <ShadowingFillParentWidthComp width={640}>
                    <WidthProbeComp label="first" />
                </ShadowingFillParentWidthComp>,
            );
        });
        const host = container.querySelector('shadowing-parent-width-tag')!;
        expect(host.shadowRoot).not.toBeNull();
        // Nothing of the content leaks into the light DOM.
        expect(host.childNodes).toHaveLength(0);
        // The measured parent wins over the hint the prop gave first.
        expect(readProbe(host)).toBe('first:500');
        expect(host.getAttribute('parentWidth')).toBe('500');
        const style = host.shadowRoot!.querySelector('style')!;
        expect(style.textContent).toContain(
            'transition: transform 0.1s ease-in-out;',
        );
        expect(observers).toHaveLength(1);
        expect(observers[0].observed).toEqual([container]);

        // A resize of the parent reaches the content.
        clientWidth = 320;
        await act(async () => {
            observers[0].callback();
        });
        expect(readProbe(host)).toBe('first:320');

        // New children re-render inside; a new width re-observes.
        await act(async () => {
            root!.render(
                <ShadowingFillParentWidthComp width={700}>
                    <WidthProbeComp label="second" />
                </ShadowingFillParentWidthComp>,
            );
        });
        expect(readProbe(host)).toBe('second:320');
        expect(observers[0].disconnectCount).toBe(1);
        expect(observers).toHaveLength(2);
        expect(observers[1].observed).toEqual([container]);

        // Unmounting stops observing and, a task later, empties the shadow root.
        const currentRoot = root!;
        root = null;
        await act(async () => {
            currentRoot.unmount();
        });
        expect(observers[1].disconnectCount).toBe(1);
        await waitForTask();
        expect(readProbe(host)).toBeNull();
    });

    test('an unreadable width reaches the content as no width', async () => {
        await act(async () => {
            root!.render(
                <ShadowingFillParentWidthComp>
                    <WidthProbeComp label="probe" />
                </ShadowingFillParentWidthComp>,
            );
        });
        const host = container.querySelector(
            'shadowing-parent-width-tag',
        ) as any;
        await act(async () => {
            host.setParentWidth(Number.NaN);
        });
        expect(readProbe(host)).toBe('probe:none');
    });

    test('measures nothing when its parent is not an element', async () => {
        const shadowHost = document.createElement('div');
        document.body.appendChild(shadowHost);
        const shadow = shadowHost.attachShadow({ mode: 'open' });
        const shadowRoot = createRoot(shadow);
        try {
            await act(async () => {
                shadowRoot.render(
                    <ShadowingFillParentWidthComp width={250}>
                        <WidthProbeComp label="in-shadow" />
                    </ShadowingFillParentWidthComp>,
                );
            });
            const host = shadow.querySelector('shadowing-parent-width-tag')!;
            expect(readProbe(host)).toBe('in-shadow:250');
            expect(observers).toHaveLength(0);
        } finally {
            await act(async () => {
                shadowRoot.unmount();
            });
            await waitForTask();
            shadowHost.remove();
        }
    });
});

describe('shadowing-parent-width-tag', () => {
    test('survives a synchronous reparent and unmounts once really gone', async () => {
        const tag = document.createElement('shadowing-parent-width-tag') as any;
        tag.myContent = <WidthProbeComp label="solo" />;
        await act(async () => {
            document.body.appendChild(tag);
        });
        // No attribute at all: no width.
        expect(readProbe(tag)).toBe('solo:none');

        // Out and straight back in, the way React reparents: kept.
        await act(async () => {
            tag.remove();
            document.body.appendChild(tag);
        });
        await waitForTask();
        expect(readProbe(tag)).toBe('solo:none');

        // Out twice before the deferred check runs: one unmount, then a no-op.
        await act(async () => {
            tag.remove();
            document.body.appendChild(tag);
            tag.remove();
        });
        await waitForTask();
        expect(readProbe(tag)).toBeNull();

        // Back in later: a fresh inner root, with the width it is given now.
        await act(async () => {
            document.body.appendChild(tag);
            tag.setParentWidth(128);
        });
        expect(readProbe(tag)).toBe('solo:128');
        await act(async () => {
            tag.remove();
        });
        await waitForTask();
        expect(readProbe(tag)).toBeNull();
    });
});
