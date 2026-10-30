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

import ProgressBarEventListener, {
    useHideProgressBar,
    useShowProgressBar,
} from './ProgressBarEventListener';

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
    onShow,
    onHide,
}: Readonly<{ onShow: (key: string) => void; onHide: (key: string) => void }>) {
    useShowProgressBar(onShow);
    useHideProgressBar(onHide);
    return null;
}

describe('ProgressBarEventListener', () => {
    test('show and hide reach their own listener with the progress key', async () => {
        const onShow = vi.fn();
        const onHide = vi.fn();
        await act(async () =>
            root.render(<ProbeComp onShow={onShow} onHide={onHide} />),
        );
        ProgressBarEventListener.showProgressBar('import-bible');
        await flushEvents();
        expect(onShow).toHaveBeenCalledExactlyOnceWith(
            'import-bible',
            expect.any(Number),
        );
        expect(onHide).not.toHaveBeenCalled();

        ProgressBarEventListener.hideProgressBar('import-bible');
        await flushEvents();
        expect(onHide).toHaveBeenCalledExactlyOnceWith(
            'import-bible',
            expect.any(Number),
        );
        expect(onShow).toHaveBeenCalledOnce();
    });

    test('the latest callbacks answer, and none after unmounting', async () => {
        const firstShow = vi.fn();
        const firstHide = vi.fn();
        await act(async () =>
            root.render(<ProbeComp onShow={firstShow} onHide={firstHide} />),
        );
        const secondShow = vi.fn();
        const secondHide = vi.fn();
        await act(async () =>
            root.render(<ProbeComp onShow={secondShow} onHide={secondHide} />),
        );
        ProgressBarEventListener.showProgressBar('a');
        ProgressBarEventListener.hideProgressBar('a');
        await flushEvents();
        expect(firstShow).not.toHaveBeenCalled();
        expect(firstHide).not.toHaveBeenCalled();
        expect(secondShow).toHaveBeenCalledOnce();
        expect(secondHide).toHaveBeenCalledOnce();

        await act(async () => root.render(<></>));
        ProgressBarEventListener.showProgressBar('b');
        ProgressBarEventListener.hideProgressBar('b');
        await flushEvents();
        expect(secondShow).toHaveBeenCalledOnce();
        expect(secondHide).toHaveBeenCalledOnce();
    });
});
