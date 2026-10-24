// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        initialText: 'Grace',
        controller: null as any,
    },
    mocks: {
        setSetting: vi.fn(),
        pasteText: vi.fn(),
    },
}));

vi.mock('./BibleFindController', () => ({
    useBibleFindController: () => state.controller,
}));
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
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        setSetting: mocks.setSetting,
        useStateSettingString: () => useState(state.initialText),
    };
});
vi.mock('../server/appHelpers', () => ({
    pasteTextToInput: mocks.pasteText,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (_key: string) => 'serif',
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import BibleFindHeaderComp, {
    setBibleFindRecentSearch,
} from './BibleFindHeaderComp';

let host: HTMLDivElement;
let root: Root;
let handleFinding: (text: string, isFresh?: boolean) => void;

function input() {
    return host.querySelector<HTMLInputElement>('input')!;
}

function changeInput(value: string) {
    Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
}

function keyUp(key: string) {
    const event = new KeyboardEvent('keyup', {
        key,
        bubbles: true,
        cancelable: true,
    });
    input().dispatchEvent(event);
    return event;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.initialText = 'Grace';
    state.controller = {
        bibleKey: 'KJV',
        menuControllerSession: null,
        closeSuggestionMenu: vi.fn(),
        handleNewValue: vi.fn(),
    };
    handleFinding = vi.fn<(text: string, isFresh?: boolean) => void>();
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

describe('Bible Find header', () => {
    test('debounces typing, then Enter, Escape and Refresh act immediately', async () => {
        await act(async () =>
            root.render(<BibleFindHeaderComp handleFinding={handleFinding} />),
        );
        expect(handleFinding).toHaveBeenCalledWith('Grace');
        expect(input().getAttribute('aria-label')).toBe('Search verses');
        expect(input().style.fontFamily).toBe('serif');

        await act(async () => changeInput('Mercy'));
        expect(state.controller.handleNewValue).toHaveBeenCalledOnce();
        await act(async () => vi.advanceTimersByTime(1999));
        expect(handleFinding).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTime(1));
        expect(handleFinding).toHaveBeenLastCalledWith('Mercy');

        const enter = await act(async () => keyUp('Enter'));
        expect(enter.defaultPrevented).toBe(true);
        expect(handleFinding).toHaveBeenLastCalledWith('Mercy', true);
        await act(async () =>
            host
                .querySelector<HTMLButtonElement>('[aria-label="Refresh"]')!
                .click(),
        );
        expect(handleFinding).toHaveBeenLastCalledWith('Mercy', true);
        const escape = await act(async () => keyUp('Escape'));
        expect(escape.defaultPrevented).toBe(true);
        expect(handleFinding).toHaveBeenLastCalledWith('', false);
        expect(input().value).toBe('');
    });

    test('Enter closes an open suggestion menu without starting a second search', async () => {
        state.controller.menuControllerSession = {};
        await act(async () =>
            root.render(<BibleFindHeaderComp handleFinding={handleFinding} />),
        );
        await act(async () => keyUp('Enter'));
        expect(state.controller.closeSuggestionMenu).toHaveBeenCalledOnce();
        expect(handleFinding).toHaveBeenCalledTimes(1);
        expect(handleFinding).toHaveBeenCalledWith('Grace');
    });

    test('recent searches persist and paste only while the header is mounted', async () => {
        await act(async () =>
            root.render(<BibleFindHeaderComp handleFinding={handleFinding} />),
        );
        setBibleFindRecentSearch('  ');
        expect(mocks.setSetting).toHaveBeenLastCalledWith(
            'bible-find-recent-search',
            '',
        );
        expect(mocks.pasteText).toHaveBeenCalledWith(input(), '');
        setBibleFindRecentSearch('John 3:16');
        expect(mocks.pasteText).toHaveBeenLastCalledWith(input(), 'John 3:16');

        await act(async () => root.unmount());
        root = createRoot(host);
        mocks.pasteText.mockClear();
        setBibleFindRecentSearch('Psalm 23');
        expect(mocks.setSetting).toHaveBeenLastCalledWith(
            'bible-find-recent-search',
            'Psalm 23',
        );
        expect(mocks.pasteText).not.toHaveBeenCalled();
    });
});
