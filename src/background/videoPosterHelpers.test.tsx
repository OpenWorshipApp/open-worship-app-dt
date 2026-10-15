// @vitest-environment jsdom

import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ captureVideoFrameDataUrl: vi.fn() }));
vi.mock('../helper/mediaHelpers', () => ({
    captureVideoFrameDataUrl: h.captureVideoFrameDataUrl,
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});

import { useVideoPoster } from './videoPosterHelpers';

function Poster({ src }: { src: string }) {
    return createElement('output', null, useVideoPoster(src) ?? 'pending');
}

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

async function mountPoster(src: string) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
        root.render(createElement(Poster, { src }));
    });
    return { root, container };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.captureVideoFrameDataUrl.mockReset();
    h.captureVideoFrameDataUrl.mockResolvedValue('data:image/jpeg;base64,AAAA');
});

afterEach(async () => {
    await act(async () => {
        for (const { root } of mounted) root.unmount();
    });
    mounted.length = 0;
    document.body.replaceChildren();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('video tile posters', () => {
    it('captures a bounded JPEG once and reuses its cached still', async () => {
        const first = await mountPoster('file:///cache-first.mp4');
        expect(first.container.textContent).toBe('data:image/jpeg;base64,AAAA');
        expect(h.captureVideoFrameDataUrl).toHaveBeenCalledWith(
            'file:///cache-first.mp4',
            { maxWidth: 320, quality: 0.7 },
        );
        await act(async () => first.root.unmount());
        mounted.shift();
        const second = await mountPoster('file:///cache-first.mp4');
        expect(second.container.textContent).toBe(
            'data:image/jpeg;base64,AAAA',
        );
        expect(h.captureVideoFrameDataUrl).toHaveBeenCalledTimes(1);
    });

    it('remembers a failed capture instead of retrying on every remount', async () => {
        h.captureVideoFrameDataUrl.mockResolvedValueOnce(null);
        const first = await mountPoster('file:///unreadable.mp4');
        expect(first.container.textContent).toBe('pending');
        await act(async () => first.root.unmount());
        mounted.shift();
        const second = await mountPoster('file:///unreadable.mp4');
        expect(second.container.textContent).toBe('pending');
        expect(h.captureVideoFrameDataUrl).toHaveBeenCalledTimes(1);
    });

    it('expires an old still and captures a fresh one when it reappears', async () => {
        const first = await mountPoster('file:///aging.mp4');
        expect(first.container.textContent).toContain('data:image/jpeg');
        await act(async () => first.root.unmount());
        mounted.shift();
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1);
        await mountPoster('file:///sweep-trigger.mp4');
        const second = await mountPoster('file:///aging.mp4');
        expect(second.container.textContent).toContain('data:image/jpeg');
        expect(h.captureVideoFrameDataUrl).toHaveBeenCalledTimes(3);
    });

    it('limits simultaneous captures and skips a queued tile that unmounts', async () => {
        const resolvers: Array<(value: string) => void> = [];
        h.captureVideoFrameDataUrl.mockImplementation(
            () =>
                new Promise<string>((resolve) => {
                    resolvers.push(resolve);
                }),
        );
        const first = await mountPoster('file:///parallel-1.mp4');
        const second = await mountPoster('file:///parallel-2.mp4');
        const third = await mountPoster('file:///parallel-3.mp4');
        const fourth = await mountPoster('file:///parallel-4.mp4');
        expect(h.captureVideoFrameDataUrl).toHaveBeenCalledTimes(3);
        await act(async () => fourth.root.unmount());
        mounted.pop();
        await act(async () => {
            for (const resolve of resolvers)
                resolve('data:image/jpeg;base64,BBBB');
        });
        await vi.advanceTimersByTimeAsync(60);
        expect(h.captureVideoFrameDataUrl).toHaveBeenCalledTimes(3);
        expect(first.container.textContent).toContain('BBBB');
        expect(second.container.textContent).toContain('BBBB');
        expect(third.container.textContent).toContain('BBBB');
    });
});
