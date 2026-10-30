// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import PreviewingEventListener, {
    previewingEventListener,
    useBibleItemShowing,
    useVaryAppDocumentSelecting,
    useVaryAppDocumentUpdating,
} from './PreviewingEventListener';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function flushEvents() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

function ProbeComp({
    onBible,
    bibleDeps,
    onSelect,
    onUpdate,
}: Readonly<{
    onBible: (item: any) => void;
    bibleDeps: unknown[];
    onSelect: (item: any) => void;
    onUpdate: (item: any) => void;
}>) {
    useBibleItemShowing(onBible, bibleDeps);
    useVaryAppDocumentSelecting(onSelect);
    useVaryAppDocumentUpdating(onUpdate);
    return null;
}

describe('PreviewingEventListener', () => {
    test('the shared listener is an instance of the class', () => {
        expect(previewingEventListener).toBeInstanceOf(PreviewingEventListener);
    });

    test('each kind of preview reaches only its own listener', async () => {
        const onBible = vi.fn();
        const onSelect = vi.fn();
        const onUpdate = vi.fn();
        await act(async () =>
            root.render(
                <ProbeComp
                    onBible={onBible}
                    bibleDeps={[]}
                    onSelect={onSelect}
                    onUpdate={onUpdate}
                />,
            ),
        );
        const bibleItem = { target: 'JHN 3:16' } as any;
        const document = { filePath: '/docs/a.slides' } as any;

        previewingEventListener.showBibleItem(bibleItem);
        await flushEvents();
        expect(onBible).toHaveBeenCalledExactlyOnceWith(
            bibleItem,
            expect.any(Number),
        );
        expect(onSelect).not.toHaveBeenCalled();
        expect(onUpdate).not.toHaveBeenCalled();

        previewingEventListener.showVaryAppDocument(document);
        await flushEvents();
        expect(onSelect).toHaveBeenCalledExactlyOnceWith(
            document,
            expect.any(Number),
        );

        previewingEventListener.showVaryAppDocument(null);
        await flushEvents();
        expect(onSelect).toHaveBeenLastCalledWith(null, expect.any(Number));

        previewingEventListener.updateVaryAppDocument(document);
        await flushEvents();
        expect(onUpdate).toHaveBeenCalledExactlyOnceWith(
            document,
            expect.any(Number),
        );
        expect(onBible).toHaveBeenCalledOnce();
    });

    test('the document listeners follow the latest callback; the bible one its deps', async () => {
        const firstBible = vi.fn();
        const firstSelect = vi.fn();
        const firstUpdate = vi.fn();
        await act(async () =>
            root.render(
                <ProbeComp
                    onBible={firstBible}
                    bibleDeps={['a']}
                    onSelect={firstSelect}
                    onUpdate={firstUpdate}
                />,
            ),
        );
        const secondBible = vi.fn();
        const secondSelect = vi.fn();
        const secondUpdate = vi.fn();
        // Same bible deps: the bible listener registered first stays.
        await act(async () =>
            root.render(
                <ProbeComp
                    onBible={secondBible}
                    bibleDeps={['a']}
                    onSelect={secondSelect}
                    onUpdate={secondUpdate}
                />,
            ),
        );
        previewingEventListener.showBibleItem({} as any);
        previewingEventListener.showVaryAppDocument({} as any);
        previewingEventListener.updateVaryAppDocument({} as any);
        await flushEvents();
        expect(firstBible).toHaveBeenCalledOnce();
        expect(secondBible).not.toHaveBeenCalled();
        expect(firstSelect).not.toHaveBeenCalled();
        expect(secondSelect).toHaveBeenCalledOnce();
        expect(firstUpdate).not.toHaveBeenCalled();
        expect(secondUpdate).toHaveBeenCalledOnce();

        // New deps: the bible listener is swapped for the current one.
        await act(async () =>
            root.render(
                <ProbeComp
                    onBible={secondBible}
                    bibleDeps={['b']}
                    onSelect={secondSelect}
                    onUpdate={secondUpdate}
                />,
            ),
        );
        previewingEventListener.showBibleItem({} as any);
        await flushEvents();
        expect(firstBible).toHaveBeenCalledOnce();
        expect(secondBible).toHaveBeenCalledOnce();
    });

    test('unmounting removes every listener', async () => {
        const onBible = vi.fn();
        const onSelect = vi.fn();
        const onUpdate = vi.fn();
        await act(async () =>
            root.render(
                <ProbeComp
                    onBible={onBible}
                    bibleDeps={[]}
                    onSelect={onSelect}
                    onUpdate={onUpdate}
                />,
            ),
        );
        await act(async () => root.render(<></>));
        previewingEventListener.showBibleItem({} as any);
        previewingEventListener.showVaryAppDocument(null);
        previewingEventListener.updateVaryAppDocument({} as any);
        await flushEvents();
        expect(onBible).not.toHaveBeenCalled();
        expect(onSelect).not.toHaveBeenCalled();
        expect(onUpdate).not.toHaveBeenCalled();
    });
});
