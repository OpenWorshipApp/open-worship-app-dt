// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { KeyboardListenerType } from '../event/KeyboardEventListener';

const { controller, keyboard } = vi.hoisted(() => ({
    controller: { splitWithoutPassage: vi.fn() },
    keyboard: {
        maps: undefined as unknown,
        listener: undefined as KeyboardListenerType | undefined,
    },
}));

vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: (eventMapper: { key: string }) =>
        `Ctrl+Shift+${eventMapper.key.toUpperCase()}`,
    useKeyboardRegistering: (maps: unknown, listener: KeyboardListenerType) => {
        keyboard.maps = maps;
        keyboard.listener = listener;
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => {
    const splitHorizontalEventMapper = { key: 's' };
    const splitVerticalEventMapper = { key: 'v' };
    return {
        splitEventMappers: [
            splitHorizontalEventMapper,
            splitVerticalEventMapper,
        ],
        splitHorizontalEventMapper,
        splitVerticalEventMapper,
        useLookupBibleItemControllerContext: () => controller,
    };
});
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (current: unknown) => ({ current }),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import RenderLookupSplitButtonsComp from './RenderLookupSplitButtonsComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function render(bookKey: string | null) {
    act(() => {
        root.render(<RenderLookupSplitButtonsComp bookKey={bookKey} />);
    });
    return Array.from(host.querySelectorAll('button'));
}

beforeEach(() => {
    vi.clearAllMocks();
    keyboard.maps = undefined;
    keyboard.listener = undefined;
    host = document.createElement('div');
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
});

test('the buttons split the grid view with the picked book', () => {
    const [horizontal, vertical] = render('EXO');

    expect(horizontal.getAttribute('aria-label')).toBe('Split horizontal');
    expect(horizontal.title).toBe('Split horizontal [Ctrl+Shift+S]');
    expect(vertical.getAttribute('aria-label')).toBe('Split vertical');
    expect(vertical.title).toBe('Split vertical [Ctrl+Shift+V]');
    act(() => {
        horizontal.click();
    });
    expect(controller.splitWithoutPassage).toHaveBeenLastCalledWith(
        'EXO',
        true,
    );
    act(() => {
        vertical.click();
    });
    expect(controller.splitWithoutPassage).toHaveBeenLastCalledWith(
        'EXO',
        false,
    );
});

test('before a book is picked the split carries no book', () => {
    const [horizontal] = render(null);

    act(() => {
        horizontal.click();
    });
    expect(controller.splitWithoutPassage).toHaveBeenLastCalledWith(null, true);
});

test.each([
    ['s', true],
    ['S', true],
    ['v', false],
    ['V', false],
])('Ctrl+Shift+%s splits and cancels the browser action', (key, isH) => {
    render('EXO');
    const event = new KeyboardEvent('keydown', {
        key,
        ctrlKey: true,
        shiftKey: true,
        cancelable: true,
    });

    expect((keyboard.maps as { key: string }[]).map((m) => m.key)).toEqual([
        's',
        'v',
    ]);
    keyboard.listener!(event);

    expect(event.defaultPrevented).toBe(true);
    expect(controller.splitWithoutPassage).toHaveBeenCalledExactlyOnceWith(
        'EXO',
        isH,
    );
});
