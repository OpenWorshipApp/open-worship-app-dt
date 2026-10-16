// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    bodyProps: null as null | Record<string, any>,
    foundListener: null as null | ((result: object) => void),
    focusListener: null as null | (() => void),
    find: vi.fn(),
    close: vi.fn(),
    startDrag: vi.fn(),
    stopDrag: vi.fn(),
    unsubscribeFound: vi.fn(),
    unsubscribeFocus: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('./finderHelpers', () => ({
    closeFinder: state.close,
    findString: state.find,
    listenFocusFinder: (listener: () => void) => {
        state.focusListener = listener;
        return state.unsubscribeFocus;
    },
    listenFoundInPage: (listener: (result: object) => void) => {
        state.foundListener = listener;
        return state.unsubscribeFound;
    },
    startFinderDragging: state.startDrag,
    stopFinderDragging: state.stopDrag,
}));
vi.mock('./FindPanelBodyComp', () => ({
    default: (props: Record<string, any>) => {
        state.bodyProps = props;
        return (
            <div onKeyDown={props.onKeyDowning}>
                <input
                    ref={props.inputRef}
                    value={props.queryText}
                    onChange={props.onQueryChanging}
                />
                <button type="button" onClick={props.onPreviousClicking}>
                    Previous
                </button>
                <button type="button" onClick={props.onNextClicking}>
                    Next
                </button>
                <button type="button" onClick={props.onMatchCaseToggling}>
                    Case
                </button>
                <button type="button" onClick={props.onClosing}>
                    Close
                </button>
                <span>{`${props.activeMatchOrdinal}/${props.matchCount}`}</span>
            </div>
        );
    },
}));

import FinderAppComp from './FinderAppComp';

let host: HTMLDivElement;
let root: Root;

function input() {
    return host.querySelector('input')!;
}

function button(label: string) {
    return [...host.querySelectorAll('button')].find(
        (element) => element.textContent === label,
    )!;
}

function changeQuery(value: string) {
    Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    state.bodyProps = null;
    state.foundListener = null;
    state.focusListener = null;
    state.find.mockReset();
    state.close.mockReset();
    state.startDrag.mockReset();
    state.stopDrag.mockReset();
    state.unsubscribeFound.mockReset();
    state.unsubscribeFocus.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('Finder bar', () => {
    it('debounces typing, steps immediately, and clears the page search', async () => {
        await act(async () => root.render(<FinderAppComp />));
        expect(host.querySelector('.app')?.getAttribute('data-bs-theme')).toBe(
            'dark',
        );
        await act(async () => changeQuery('grace'));
        expect(state.find).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTime(250));
        expect(state.find).toHaveBeenLastCalledWith('grace', {
            matchCase: false,
        });

        await act(async () => button('Next').click());
        expect(state.find).toHaveBeenLastCalledWith('grace', {
            matchCase: false,
            forward: true,
            findNext: true,
        });
        await act(async () => button('Previous').click());
        expect(state.find).toHaveBeenLastCalledWith('grace', {
            matchCase: false,
            forward: false,
            findNext: true,
        });
        await act(async () => button('Case').click());
        expect(state.bodyProps!.isMatchCase).toBe(true);
        expect(state.find).toHaveBeenLastCalledWith('grace', {
            matchCase: true,
        });

        await act(async () => changeQuery(''));
        expect(state.find).toHaveBeenLastCalledWith('');
        state.find.mockClear();
        await act(async () => button('Next').click());
        expect(state.find).not.toHaveBeenCalled();
    });

    it('shows search result counts and reselects the query when focused again', async () => {
        await act(async () => root.render(<FinderAppComp />));
        await act(async () => changeQuery('mercy'));
        await act(async () => vi.advanceTimersByTime(250));
        await act(async () =>
            state.foundListener!({ matches: 9, activeMatchOrdinal: 3 }),
        );
        expect(host.textContent).toContain('3/9');

        input().blur();
        await act(async () => state.focusListener!());
        expect(document.activeElement).toBe(input());
        expect(input().selectionStart).toBe(0);
        expect(input().selectionEnd).toBe(5);
        expect(state.find).toHaveBeenLastCalledWith('mercy', {
            matchCase: false,
        });

        await act(async () =>
            input().dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            ),
        );
        expect(state.find).toHaveBeenLastCalledWith('mercy', {
            matchCase: false,
            forward: true,
            findNext: true,
        });
        await act(async () =>
            input().dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    shiftKey: true,
                    bubbles: true,
                }),
            ),
        );
        expect(state.find).toHaveBeenLastCalledWith('mercy', {
            matchCase: false,
            forward: false,
            findNext: true,
        });
        await act(async () =>
            input().dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            ),
        );
        expect(state.close).toHaveBeenCalledOnce();
    });

    it('starts drag at the grip and stops on release, blur, or close', async () => {
        await act(async () => root.render(<FinderAppComp />));
        const setPointerCapture = vi.fn();
        state.bodyProps!.onGripPointerDowning({
            currentTarget: { setPointerCapture },
            pointerId: 7,
            clientX: 125,
        });
        expect(setPointerCapture).toHaveBeenCalledWith(7);
        expect(state.startDrag).toHaveBeenCalledWith(125);
        state.bodyProps!.onGripPointerUping();
        window.dispatchEvent(new Event('pointercancel'));
        window.dispatchEvent(new Event('blur'));
        expect(state.stopDrag).toHaveBeenCalledTimes(3);

        await act(async () => button('Close').click());
        expect(state.close).toHaveBeenCalledOnce();
        await act(async () => root.unmount());
        expect(state.unsubscribeFound).toHaveBeenCalledOnce();
        expect(state.unsubscribeFocus).toHaveBeenCalledOnce();
        root = createRoot(host);
    });
});
