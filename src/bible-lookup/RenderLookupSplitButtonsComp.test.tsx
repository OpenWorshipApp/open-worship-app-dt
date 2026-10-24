// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { KeyboardListenerType } from '../event/KeyboardEventListener';

const { controller, keyboard } = vi.hoisted(() => ({
    controller: {
        selectedBibleItem: { id: 'selected-view' },
        splitWithoutPassageOnPress: vi.fn(),
        checkIsSplitAskingBibleKey: vi.fn(() => false),
    },
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
// The real one builds a `MouseEvent` with `view: window`, which this jsdom
// refuses; which BUTTON the key's menu hangs under is what is under test.
vi.mock('../context-menu/contextMenuEventHelpers', () => ({
    createMouseEventUnder: (element: Element) => ({ under: element }),
}));

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
    controller.checkIsSplitAskingBibleKey.mockReturnValue(false);
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
    expect(horizontal.hasAttribute('aria-haspopup')).toBe(false);
    act(() => {
        horizontal.click();
    });
    // The press itself goes along: it is where a version list would open.
    expect(controller.splitWithoutPassageOnPress).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'click' }),
        'EXO',
        true,
    );
    act(() => {
        vertical.click();
    });
    expect(controller.splitWithoutPassageOnPress).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'click' }),
        'EXO',
        false,
    );
});

// Asked for by the user: a view in a colour group splits into another
// version, so its buttons are the menu's `… to` items.
test('in a colour group the buttons say they ask for a version', () => {
    controller.checkIsSplitAskingBibleKey.mockReturnValue(true);
    const [horizontal, vertical] = render('EXO');

    expect(controller.checkIsSplitAskingBibleKey).toHaveBeenLastCalledWith(
        controller.selectedBibleItem,
    );
    expect(horizontal.getAttribute('aria-label')).toBe('Split Horizontal to');
    expect(horizontal.title).toBe('Split Horizontal to [Ctrl+Shift+S]');
    expect(horizontal.getAttribute('aria-haspopup')).toBe('menu');
    expect(vertical.getAttribute('aria-label')).toBe('Split Vertical to');
    expect(vertical.title).toBe('Split Vertical to [Ctrl+Shift+V]');
    expect(vertical.getAttribute('aria-haspopup')).toBe('menu');
});

test('before a book is picked the split carries no book', () => {
    const [horizontal] = render(null);

    act(() => {
        horizontal.click();
    });
    expect(controller.splitWithoutPassageOnPress).toHaveBeenLastCalledWith(
        expect.anything(),
        null,
        true,
    );
});

test.each([
    ['s', true],
    ['S', true],
    ['v', false],
    ['V', false],
])('Ctrl+Shift+%s splits and cancels the browser action', (key, isH) => {
    const buttons = render('EXO');
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
    // A key has no pointer position: a version list hangs under its button.
    expect(
        controller.splitWithoutPassageOnPress,
    ).toHaveBeenCalledExactlyOnceWith(
        { under: buttons[isH ? 0 : 1] },
        'EXO',
        isH,
    );
});
