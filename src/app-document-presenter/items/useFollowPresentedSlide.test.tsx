// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerVirtualReveal } from '../../virtual-list/virtualRevealHelpers';
import { useFollowPresentedSlide } from './useFollowPresentedSlide';
import type { VarySlideGridItemType } from './varySlideGridHelpers';

const state = vi.hoisted(() => ({
    onScreen: [] as [string, { filePath: string; itemJson: { id: number } }][],
    listeners: new Set<() => void>(),
    appProvider: { isPageAppDocumentEditor: false },
}));

vi.mock('../../server/appProvider', () => ({ default: state.appProvider }));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    toKeyByFilePath: (filePath: string, id: number) => `${filePath}|${id}`,
}));
vi.mock('../../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: {
        getPresentingDataList: (filePath: string) =>
            state.onScreen.filter(([, data]) => data.filePath === filePath),
    },
}));
vi.mock('../../_screen/managers/varySlideOnScreenHelpers', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useVarySlideOnScreenChangeEffect: (callback: () => void) => {
            const ref = useRef(callback);
            ref.current = callback;
            useEffect(() => {
                const listener = () => ref.current();
                state.listeners.add(listener);
                return () => {
                    state.listeners.delete(listener);
                };
            }, []);
        },
    };
});

describe('following the presented slide', () => {
    let root: Root;
    let host: HTMLDivElement;
    let release: () => void;
    const reveal = vi.fn(() => true);
    const render = vi.fn();
    const loadedItems = [{}] as VarySlideGridItemType[];

    function PreviewComp({ filePath = '/deck', items = loadedItems }) {
        render();
        useFollowPresentedSlide(filePath, items);
        return null;
    }

    function present(id: number, screenId = '0', filePath = '/deck') {
        state.onScreen = state.onScreen.filter(([key]) => key !== screenId);
        state.onScreen.push([screenId, { filePath, itemJson: { id } }]);
    }

    async function update() {
        await act(async () => {
            for (const listener of state.listeners) listener();
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        state.onScreen = [];
        state.appProvider.isPageAppDocumentEditor = false;
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        release = registerVirtualReveal(reveal);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        release();
        host.remove();
        expect(state.listeners.size).toBe(0);
    });

    it('reveals an unmounted card after a step without re-rendering the list', async () => {
        present(8);
        await act(async () => root.render(<PreviewComp />));
        expect(reveal).toHaveBeenLastCalledWith('/deck|8', 'smooth');
        const renderCount = render.mock.calls.length;
        present(1);
        await update();
        expect(reveal).toHaveBeenLastCalledWith('/deck|1', 'smooth');
        expect(render).toHaveBeenCalledTimes(renderCount);
        await update();
        expect(reveal).toHaveBeenCalledTimes(2);
        // Repeated Next presses replace the scroll target with the latest
        // slide, even when React has not rendered between screen events.
        await act(async () => {
            for (const id of [2, 3, 4, 5]) {
                present(id);
                for (const listener of state.listeners) listener();
            }
        });
        expect(reveal).toHaveBeenLastCalledWith('/deck|5', 'smooth');
        expect(render).toHaveBeenCalledTimes(renderCount);
    });

    it('follows the screen that changed, including a PowerPoint sub-slide', async () => {
        present(2, '0');
        present(8, '1');
        await act(async () => root.render(<PreviewComp />));
        present(8.01, '1');
        await update();
        expect(reveal).toHaveBeenLastCalledWith('/deck|8.01', 'smooth');
        present(3, '2', '/other');
        await update();
        expect(reveal).toHaveBeenCalledTimes(2);
        state.onScreen = [];
        await update();
        expect(reveal).toHaveBeenCalledTimes(2);
        present(8.01, '1');
        await update();
        expect(reveal).toHaveBeenCalledTimes(3);
    });

    it('waits for slides to load and resets when the document changes', async () => {
        present(8);
        await act(async () => root.render(<PreviewComp items={[]} />));
        await update();
        expect(reveal).not.toHaveBeenCalled();
        await act(async () => root.render(<PreviewComp />));
        expect(reveal).toHaveBeenLastCalledWith('/deck|8', 'smooth');
        present(2, '0', '/other');
        await act(async () => root.render(<PreviewComp filePath="/other" />));
        expect(reveal).toHaveBeenLastCalledWith('/other|2', 'smooth');
    });

    it('leaves the Slide Editor selection alone', async () => {
        state.appProvider.isPageAppDocumentEditor = true;
        present(8);
        await act(async () => root.render(<PreviewComp />));
        present(1);
        await update();
        expect(reveal).not.toHaveBeenCalled();
    });
});
