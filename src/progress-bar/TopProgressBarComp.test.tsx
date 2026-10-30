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

import TopProgressBarComp from './TopProgressBarComp';
import ProgressBarEventListener from '../event/ProgressBarEventListener';

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

function getProgressTitle() {
    return host
        .querySelector('.app-top-progress-bar .progress')
        ?.getAttribute('title');
}

describe('TopProgressBarComp', () => {
    test('shows one bar while any progress is running, named after each', async () => {
        await act(async () => root.render(<TopProgressBarComp />));
        expect(host.innerHTML).toBe('');

        ProgressBarEventListener.showProgressBar('download');
        await flushEvents();
        expect(getProgressTitle()).toBe('Progress: download');
        expect(host.querySelector('[role="progressbar"]')!.className).toContain(
            'progress-bar-animated',
        );

        ProgressBarEventListener.showProgressBar('export');
        // The same key twice is still one entry.
        ProgressBarEventListener.showProgressBar('download');
        await flushEvents();
        expect(getProgressTitle()).toBe('Progress: download,export');

        ProgressBarEventListener.hideProgressBar('download');
        await flushEvents();
        expect(getProgressTitle()).toBe('Progress: export');

        // Hiding a key that never showed changes nothing.
        ProgressBarEventListener.hideProgressBar('unknown');
        await flushEvents();
        expect(getProgressTitle()).toBe('Progress: export');

        ProgressBarEventListener.hideProgressBar('export');
        await flushEvents();
        expect(host.innerHTML).toBe('');
    });
});
