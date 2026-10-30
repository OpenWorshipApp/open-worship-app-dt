// @vitest-environment jsdom

import { act, createElement, useRef } from 'react';
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
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: vi.fn(),
}));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false, isWindows: true } },
}));

import PresentingDrawManager from './PresentingDrawManager';
import PresentingFocusManager from './PresentingFocusManager';
import {
    usePresentingManagerEvents,
    usePresentingManagers,
    useWindowResize,
} from './presentingControlHooks';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('usePresentingManagerEvents', () => {
    test('re-renders on each engine update and stops listening on unmount', async () => {
        let listener: (() => void) | null = null;
        const unsubscribe = vi.fn(() => {
            listener = null;
        });
        const manager = {
            addUpdateListener: vi.fn((newListener: () => void) => {
                listener = newListener;
                return unsubscribe;
            }),
        };
        function ToolbarComp() {
            usePresentingManagerEvents(manager);
            const renderCountRef = useRef(0);
            renderCountRef.current += 1;
            return createElement('span', null, `${renderCountRef.current}`);
        }

        await act(async () => {
            root.render(createElement(ToolbarComp));
        });
        expect(container.textContent).toBe('1');
        expect(manager.addUpdateListener).toHaveBeenCalledTimes(1);

        await act(async () => {
            listener!();
        });
        expect(container.textContent).toBe('2');
        await act(async () => {
            listener!();
        });
        expect(container.textContent).toBe('3');

        act(() => {
            root.unmount();
        });
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        root = createRoot(container);
    });
});

describe('useWindowResize', () => {
    test('tells the latest handler, and nothing once unmounted', async () => {
        const firstHandle = vi.fn();
        const secondHandle = vi.fn();
        function ResizeComp({ handle }: { handle: () => void }) {
            useWindowResize(handle);
            return null;
        }

        await act(async () => {
            root.render(createElement(ResizeComp, { handle: firstHandle }));
        });
        globalThis.dispatchEvent(new Event('resize'));
        expect(firstHandle).toHaveBeenCalledTimes(1);

        await act(async () => {
            root.render(createElement(ResizeComp, { handle: secondHandle }));
        });
        globalThis.dispatchEvent(new Event('resize'));
        expect(firstHandle).toHaveBeenCalledTimes(1);
        expect(secondHandle).toHaveBeenCalledTimes(1);

        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        globalThis.dispatchEvent(new Event('resize'));
        expect(secondHandle).toHaveBeenCalledTimes(1);
    });
});

describe('usePresentingManagers', () => {
    test('one engine pair per session, torn down when the session ends', async () => {
        const drawDelete = vi.spyOn(PresentingDrawManager.prototype, 'delete');
        const focusDelete = vi.spyOn(
            PresentingFocusManager.prototype,
            'delete',
        );
        const seen: ReturnType<typeof usePresentingManagers>[] = [];
        function ControllerComp({ label }: { label: string }) {
            seen.push(usePresentingManagers());
            return createElement('span', null, label);
        }

        await act(async () => {
            root.render(createElement(ControllerComp, { label: 'a' }));
        });
        await act(async () => {
            root.render(createElement(ControllerComp, { label: 'b' }));
        });

        expect(seen).toHaveLength(2);
        expect(seen[0].drawManager).toBeInstanceOf(PresentingDrawManager);
        expect(seen[0].focusManager).toBeInstanceOf(PresentingFocusManager);
        // A re-render is the same session, not a new pair.
        expect(seen[1].drawManager).toBe(seen[0].drawManager);
        expect(seen[1].focusManager).toBe(seen[0].focusManager);
        expect(drawDelete).not.toHaveBeenCalled();

        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        expect(drawDelete).toHaveBeenCalledTimes(1);
        expect(focusDelete).toHaveBeenCalledTimes(1);
    });
});
