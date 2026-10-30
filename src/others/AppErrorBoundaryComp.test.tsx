// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    handleError: vi.fn(),
    shouldThrow: true,
}));

vi.mock('../helper/errorHelpers', () => ({ handleError: state.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import AppErrorBoundaryComp from './AppErrorBoundaryComp';

function FlakyComp() {
    if (state.shouldThrow) {
        throw new Error('Extension mismatch: .owl');
    }
    return <p className="page">page body</p>;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.shouldThrow = true;
    // React reports a caught render error on the console too.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('AppErrorBoundaryComp', () => {
    test('renders its children while nothing throws', async () => {
        state.shouldThrow = false;
        await act(async () =>
            root.render(
                <AppErrorBoundaryComp>
                    <FlakyComp />
                </AppErrorBoundaryComp>,
            ),
        );
        expect(host.querySelector('.page')!.textContent).toBe('page body');
        expect(state.handleError).not.toHaveBeenCalled();
    });

    test('a render throw shows the fallback instead of a blank window', async () => {
        await act(async () =>
            root.render(
                <AppErrorBoundaryComp>
                    <FlakyComp />
                </AppErrorBoundaryComp>,
            ),
        );
        const alert = host.querySelector('[role="alert"]')!;
        expect(alert.textContent).toContain('Something went wrong here');
        const detail = alert.querySelector('.app-ellipsis')!;
        expect(detail.getAttribute('title')).toBe('Extension mismatch: .owl');
        expect(detail.textContent).toBe('Extension mismatch: .owl');
        // The error, then where in the tree it happened.
        expect(state.handleError).toHaveBeenCalledTimes(2);
        expect(state.handleError.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(state.handleError.mock.calls[0][0].message).toBe(
            'Extension mismatch: .owl',
        );
        expect(state.handleError.mock.calls[1][0]).toContain('FlakyComp');
    });

    test('Try Again renders the children afresh', async () => {
        await act(async () =>
            root.render(
                <AppErrorBoundaryComp>
                    <FlakyComp />
                </AppErrorBoundaryComp>,
            ),
        );
        expect(host.querySelector('.page')).toBeNull();
        state.shouldThrow = false;
        const retry = host.querySelector('button')!;
        expect(retry.textContent).toBe('Try Again');
        await act(async () => retry.click());
        expect(host.querySelector('.page')!.textContent).toBe('page body');
        expect(host.querySelector('[role="alert"]')).toBeNull();
    });
});
