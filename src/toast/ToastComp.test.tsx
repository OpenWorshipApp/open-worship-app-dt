// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/sanitizeHelpers', () => ({
    sanitizeHtml: (html: string) => html,
}));
vi.mock('./DailyTipComp', () => ({ default: () => null }));

import ToastEventListener from '../event/ToastEventListener';
import ToastComp from './ToastComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
        root.render(<ToastComp />);
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('ToastComp', () => {
    test('replaces a stale progress toast even while it remains open', async () => {
        const replacementKey = Symbol('download');
        await act(async () => {
            ToastEventListener.showSimpleToast({
                title: 'Download From URL',
                message: 'Downloading audio, please wait...',
                replacementKey,
            });
            await Promise.resolve();
        });

        const progressToast = container.querySelector('[role="alert"]');
        expect(progressToast?.textContent).toContain('please wait');

        await act(async () => {
            ToastEventListener.showSimpleToast({
                title: 'Download From URL',
                message: 'Audio downloaded successfully',
                replacementKey,
            });
            await Promise.resolve();
        });

        const toasts = container.querySelectorAll('[role="alert"]');
        expect(toasts).toHaveLength(1);
        expect(toasts[0]?.textContent).toContain(
            'Audio downloaded successfully',
        );
        expect(toasts[0]?.textContent).not.toContain('please wait');
    });
});
