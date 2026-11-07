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

// The real event bus: the bar answers what the app's own show/hide sends.
import ProgressBarEventListener from '../event/ProgressBarEventListener';
import TopProgressBarComp from './TopProgressBarComp';

let container: HTMLDivElement;
let root: Root;

// Listeners run on microtasks; one macrotask lets every one of them land.
async function send(action: () => void) {
    await act(async () => {
        action();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function shownTitle() {
    return (
        container
            .querySelector('.app-top-progress-bar .app-progress-bar')
            ?.getAttribute('title') ?? null
    );
}

beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<TopProgressBarComp />));
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

describe('TopProgressBarComp', () => {
    test('draws nothing until something is in progress', () => {
        expect(container.innerHTML).toBe('');
    });

    test('one bar for every key in progress, each key once', async () => {
        await send(() => ProgressBarEventListener.showProgressBar('save'));
        expect(shownTitle()).toBe('Progress: save');
        expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(
            1,
        );
        // The same work started twice is still one key.
        await send(() => ProgressBarEventListener.showProgressBar('save'));
        expect(shownTitle()).toBe('Progress: save');
        await send(() => ProgressBarEventListener.showProgressBar('load'));
        expect(shownTitle()).toBe('Progress: save,load');
        expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(
            1,
        );
    });

    test('a key that ends leaves the others; the last one takes the bar away', async () => {
        await send(() => {
            ProgressBarEventListener.showProgressBar('save');
            ProgressBarEventListener.showProgressBar('load');
        });
        await send(() => ProgressBarEventListener.hideProgressBar('save'));
        expect(shownTitle()).toBe('Progress: load');
        // Hiding a key that is not shown changes nothing.
        await send(() => ProgressBarEventListener.hideProgressBar('never'));
        expect(shownTitle()).toBe('Progress: load');
        await send(() => ProgressBarEventListener.hideProgressBar('load'));
        expect(container.innerHTML).toBe('');
    });

    test('an unmounted bar stops listening', async () => {
        await act(async () => root.unmount());
        await send(() => ProgressBarEventListener.showProgressBar('late'));
        root = createRoot(container);
        await act(async () => root.render(<TopProgressBarComp />));
        // The show sent while nothing listened is not replayed.
        expect(container.innerHTML).toBe('');
    });
});
