// @vitest-environment jsdom

// The find bar's two halves: the helpers it talks to the main process with
// (over a recording stand-in for `appProvider.messageUtils`), and the panel
// body it draws, pressed control by control.

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    return {
        listeners,
        sent: [] as unknown[][],
        // What the main process sending on a channel looks like here.
        sendFromMain(channel: string, data?: unknown) {
            for (const listener of listeners.get(channel) ?? []) {
                listener({ sender: 'main' }, data);
            }
        },
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendData: (...args: unknown[]) => {
                mocks.sent.push(args);
            },
            listenForData: (
                channel: string,
                callback: (...args: any[]) => void,
            ) => {
                if (!mocks.listeners.has(channel)) {
                    mocks.listeners.set(channel, new Set());
                }
                mocks.listeners.get(channel)!.add(callback);
            },
            removeListener: (
                channel: string,
                callback: (...args: any[]) => void,
            ) => {
                mocks.listeners.get(channel)?.delete(callback);
            },
        },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import {
    closeFinder,
    findString,
    listenFocusFinder,
    listenFoundInPage,
    markFinderMounted,
    startFinderDragging,
    stopFindingString,
    stopFinderDragging,
} from './finderHelpers';
import FindPanelBodyComp from './FindPanelBodyComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
    mocks.sent.length = 0;
    mocks.listeners.clear();
});

describe('finderHelpers', () => {
    test('a query is searched in the page; an empty one stops and clears', () => {
        findString('grace', { findNext: true, matchCase: true });
        findString('mercy');
        findString('');
        stopFindingString('keepSelection');
        expect(mocks.sent).toEqual([
            [
                'finder:app:search-in-page',
                'grace',
                { findNext: true, matchCase: true },
            ],
            ['finder:app:search-in-page', 'mercy', {}],
            ['finder:app:stop-search-in-page', 'clearSelection'],
            ['finder:app:stop-search-in-page', 'keepSelection'],
        ]);
    });

    test('closing, mounting and dragging each tell the main process', () => {
        const unmark = markFinderMounted();
        startFinderDragging(42);
        stopFinderDragging();
        closeFinder();
        unmark();
        expect(mocks.sent).toEqual([
            ['finder:app:mounted', true],
            ['finder:app:drag-start', 42],
            ['finder:app:drag-stop'],
            ['finder:app:close'],
            ['finder:app:mounted', false],
        ]);
    });

    test('match counts and focus requests reach a listener until it unregisters', () => {
        const onFound = vi.fn();
        const onFocus = vi.fn();
        const stopFound = listenFoundInPage(onFound);
        const stopFocus = listenFocusFinder(onFocus);
        const result = { activeMatchOrdinal: 2, matches: 5, finalUpdate: true };
        mocks.sendFromMain('main:app:found-in-page', result);
        mocks.sendFromMain('main:app:focus-find');
        expect(onFound).toHaveBeenCalledExactlyOnceWith(result);
        expect(onFocus).toHaveBeenCalledOnce();

        stopFound();
        stopFocus();
        expect(mocks.listeners.get('main:app:found-in-page')?.size).toBe(0);
        expect(mocks.listeners.get('main:app:focus-find')?.size).toBe(0);
        mocks.sendFromMain('main:app:found-in-page', result);
        mocks.sendFromMain('main:app:focus-find');
        expect(onFound).toHaveBeenCalledOnce();
        expect(onFocus).toHaveBeenCalledOnce();
    });
});

describe('FindPanelBodyComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    function renderBody(props: {
        queryText: string;
        isMatchCase: boolean;
        matchCount: number;
        activeMatchOrdinal: number;
    }) {
        const handlers = {
            onQueryChanging: vi.fn(),
            onKeyDowning: vi.fn(),
            onPreviousClicking: vi.fn(),
            onNextClicking: vi.fn(),
            onMatchCaseToggling: vi.fn(),
            onClosing: vi.fn(),
            onGripPointerDowning: vi.fn(),
            onGripPointerUping: vi.fn(),
        };
        const inputRef = createRef<HTMLInputElement>();
        act(() => {
            root.render(
                <FindPanelBodyComp
                    inputRef={inputRef}
                    {...props}
                    {...handlers}
                />,
            );
        });
        return { handlers, inputRef };
    }

    function control(label: string) {
        return container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
    }

    test('with nothing typed it shows no count and nothing to step through', () => {
        const { inputRef } = renderBody({
            queryText: '',
            isMatchCase: false,
            matchCount: 0,
            activeMatchOrdinal: 0,
        });
        expect(inputRef.current).toBe(control('Find'));
        expect((control('Match count') as HTMLInputElement).value).toBe('');
        expect((control('Previous match') as HTMLButtonElement).disabled).toBe(
            true,
        );
        expect((control('Next match') as HTMLButtonElement).disabled).toBe(
            true,
        );
        expect(control('Match case').getAttribute('aria-pressed')).toBe(
            'false',
        );
        expect(control('Match case').className).not.toContain('is-active');
    });

    test('with matches it counts them and every control reports its press', () => {
        const { handlers } = renderBody({
            queryText: 'grace',
            isMatchCase: true,
            matchCount: 3,
            activeMatchOrdinal: 2,
        });
        const query = control('Find') as HTMLInputElement;
        expect(query.value).toBe('grace');
        expect((control('Match count') as HTMLInputElement).value).toBe('2/3');
        expect(control('Match case').getAttribute('aria-pressed')).toBe('true');
        expect(control('Match case').className).toContain('is-active');

        // Read during the change: the input is the parent's to update.
        const typed: string[] = [];
        handlers.onQueryChanging.mockImplementation((event) => {
            typed.push(event.target.value);
        });
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!;
        act(() => {
            setValue.call(query, 'graces');
            query.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(typed).toEqual(['graces']);
        // Not updated by the parent, it shows the query it was given.
        expect(query.value).toBe('grace');

        act(() => {
            query.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(handlers.onKeyDowning).toHaveBeenCalledOnce();

        act(() => {
            control('Previous match').click();
            control('Next match').click();
            control('Next match').click();
            control('Match case').click();
            control('Close find').click();
        });
        expect(handlers.onPreviousClicking).toHaveBeenCalledOnce();
        expect(handlers.onNextClicking).toHaveBeenCalledTimes(2);
        expect(handlers.onMatchCaseToggling).toHaveBeenCalledOnce();
        expect(handlers.onClosing).toHaveBeenCalledOnce();

        const grip = control('Drag to move the find panel');
        act(() => {
            grip.dispatchEvent(
                new MouseEvent('pointerdown', { bubbles: true }),
            );
            grip.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
            grip.dispatchEvent(
                new MouseEvent('pointercancel', { bubbles: true }),
            );
        });
        expect(handlers.onGripPointerDowning).toHaveBeenCalledOnce();
        // A cancelled press lets go of the drag just as a release does.
        expect(handlers.onGripPointerUping).toHaveBeenCalledTimes(2);
        expect(grip.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
            'true',
        );
    });
});
