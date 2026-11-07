// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The poster cache's two remaining rules, each on a fresh module (this file's
// own): it is BOUNDED, dropping the least recently used still past 150, and
// the capture queue moves on at the first idle moment instead of waiting out
// its fallback timeout.
const h = vi.hoisted(() => ({
    capture: vi.fn(),
    idleHandlers: [] as (() => void)[],
    idleOptions: [] as unknown[],
}));

vi.mock('../helper/mediaHelpers', () => ({
    captureVideoFrameDataUrl: (src: string, options: unknown) =>
        h.capture(src, options),
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});

import { useVideoPoster } from './videoPosterHelpers';

function PosterComp({ src }: { src: string }) {
    return createElement(
        'output',
        { 'data-src': src },
        useVideoPoster(src) ?? 'pending',
    );
}

function PosterListComp({ srcList }: { srcList: string[] }) {
    return srcList.map((src) => createElement(PosterComp, { key: src, src }));
}

const roots: { root: Root; container: HTMLDivElement }[] = [];

async function mount(srcList: string[]) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push({ root, container });
    await act(async () => {
        root.render(createElement(PosterListComp, { srcList }));
    });
    return container;
}

async function drain(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

function capturesOf(src: string) {
    return h.capture.mock.calls.filter(([calledSrc]) => calledSrc === src)
        .length;
}

const srcOf = (index: number) => `file:///clip-${index}.mp4`;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.idleHandlers = [];
    h.idleOptions = [];
});

afterEach(async () => {
    await act(async () => {
        for (const { root } of roots) {
            root.unmount();
        }
    });
    for (const { container } of roots) {
        container.remove();
    }
    roots.length = 0;
    await vi.runAllTimersAsync();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('video poster cache', () => {
    it('keeps at most 150 stills, dropping the least recently used one', async () => {
        h.capture.mockImplementation(async (src: string) => `data:${src}`);
        // 150 stills: the cache is full, nothing dropped yet.
        await mount(Array.from({ length: 150 }, (_, index) => srcOf(index)));
        await drain(4000);
        expect(h.capture).toHaveBeenCalledTimes(150);

        // Clip 0 is looked at again, so clip 1 is now the stalest.
        const again = await mount([srcOf(0)]);
        expect(again.textContent).toBe(`data:${srcOf(0)}`);
        expect(capturesOf(srcOf(0))).toBe(1);

        // One more still pushes the stalest out.
        await mount([srcOf(150)]);
        await drain(100);
        expect(h.capture).toHaveBeenCalledTimes(151);

        // Clips 0 and 2 are still held: showing them captures nothing.
        const kept = await mount([srcOf(0), srcOf(2)]);
        expect(kept.textContent).toBe(`data:${srcOf(0)}data:${srcOf(2)}`);
        expect(h.capture).toHaveBeenCalledTimes(151);
        await drain(100);

        // Clip 1's still was the one let go, so showing it captures again.
        const dropped = await mount([srcOf(1)]);
        expect(capturesOf(srcOf(1))).toBe(2);
        expect(dropped.textContent).toBe(`data:${srcOf(1)}`);
        expect(capturesOf(srcOf(0))).toBe(1);
        expect(capturesOf(srcOf(2))).toBe(1);
        expect(h.capture).toHaveBeenCalledTimes(152);
    });

    it('moves on to the next capture at the first idle moment, once', async () => {
        vi.stubGlobal(
            'requestIdleCallback',
            (handler: () => void, options: unknown) => {
                h.idleHandlers.push(handler);
                h.idleOptions.push(options);
            },
        );
        const resolvers = new Map<string, (dataUrl: string) => void>();
        h.capture.mockImplementation(
            (src: string) =>
                new Promise<string>((resolve) => {
                    resolvers.set(src, resolve);
                }),
        );
        const srcList = ['idle-1', 'idle-2', 'idle-3', 'idle-4'].map(
            (name) => `file:///${name}.mp4`,
        );
        await mount(srcList);
        // Three at a time.
        expect(h.capture).toHaveBeenCalledTimes(3);

        await act(async () => {
            resolvers.get(srcList[0])!('data:one');
        });
        expect(h.idleOptions).toEqual([{ timeout: 60 }]);
        expect(h.capture).toHaveBeenCalledTimes(3);

        // The browser is idle: the freed worker takes the fourth at once,
        // with no time passing at all.
        await act(async () => {
            h.idleHandlers[0]();
        });
        expect(h.capture).toHaveBeenCalledTimes(4);
        expect(h.capture.mock.calls[3][0]).toBe(srcList[3]);

        // Its fallback timeout firing later changes nothing.
        await drain(60);
        expect(h.capture).toHaveBeenCalledTimes(4);

        await act(async () => {
            for (const src of srcList.slice(1)) {
                resolvers.get(src)!(`data:${src}`);
            }
        });
        await drain(200);
        expect(
            roots[0].container.querySelector(`[data-src="${srcList[3]}"]`)
                ?.textContent,
        ).toBe(`data:${srcList[3]}`);
        expect(h.capture).toHaveBeenCalledTimes(4);
    });
});
