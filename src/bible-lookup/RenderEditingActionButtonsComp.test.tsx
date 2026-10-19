// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';

import type BibleItem from '../bible-list/BibleItem';
import type { KeyboardListenerType } from '../event/KeyboardEventListener';

const { controller, keyboard } = vi.hoisted(() => ({
    controller: {
        isMinimized: true,
        splitBibleItemOnPress: vi.fn(),
        checkIsSplitAskingBibleKey: vi.fn(() => false),
    },
    keyboard: { listener: undefined as KeyboardListenerType | undefined },
}));

vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: () => '',
    useKeyboardRegistering: (
        _maps: unknown,
        listener: KeyboardListenerType,
    ) => {
        keyboard.listener = listener;
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    splitEventMappers: [],
    splitHorizontalEventMapper: { key: 's' },
    splitVerticalEventMapper: { key: 'v' },
    useLookupBibleItemControllerContext: () => controller,
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (current: unknown) => ({ current }),
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    exportToWordDocument: vi.fn(),
    saveBibleItem: vi.fn(),
}));
vi.mock('../server/appProvider', () => ({ default: {} }));
vi.mock('./bibleActionHelpers', () => ({
    addBibleItemAndPresent: vi.fn(),
    ctrlEnterEventMapper: {},
    ctrlShiftEnterEventMapper: {},
    showAddingBibleItemFail: vi.fn(),
}));
vi.mock('./RenderActionButtonsComp', () => ({
    RenderCopyBibleItemActionButtonsComp: () => null,
    RenderAskAssistantBibleItemButtonComp: () => null,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../slide-editor/canvas/canvasBibleItemHelpers', () => ({
    CanvasBibleItemEventListener: {},
}));

import RenderEditingActionButtonsComp from './RenderEditingActionButtonsComp';

beforeEach(() => {
    vi.clearAllMocks();
    controller.checkIsSplitAskingBibleKey.mockReturnValue(false);
    keyboard.listener = undefined;
});

test.each(['v', 'V', 's', 'S'])(
    'splitting with Ctrl+Shift+%s cancels the browser action',
    (key) => {
        const bibleItem = { id: 'selected-passage' } as unknown as BibleItem;
        renderToStaticMarkup(
            <RenderEditingActionButtonsComp bibleItem={bibleItem} />,
        );
        const event = new KeyboardEvent('keydown', {
            key,
            ctrlKey: true,
            shiftKey: true,
            cancelable: true,
        });
        expect(keyboard.listener).toBeDefined();
        keyboard.listener!(event);

        expect(event.defaultPrevented).toBe(true);
        // A static render mounts no button to hang a version list under, so
        // the key's own event is what the controller is handed.
        expect(
            controller.splitBibleItemOnPress,
        ).toHaveBeenCalledExactlyOnceWith(
            event,
            bibleItem,
            key.toLowerCase() === 's',
        );
    },
);

// Asked for by the user: a view in a colour group splits into another
// version, so its buttons are the menu's `… to` items.
test('the split buttons of a grouped view say they ask for a version', () => {
    const bibleItem = { id: 'selected-passage' } as unknown as BibleItem;
    const plain = renderToStaticMarkup(
        <RenderEditingActionButtonsComp bibleItem={bibleItem} />,
    );
    expect(plain).toContain('aria-label="Split horizontal"');
    expect(plain).toContain('aria-label="Split vertical"');
    expect(plain).not.toContain('aria-haspopup');

    controller.checkIsSplitAskingBibleKey.mockReturnValue(true);
    const grouped = renderToStaticMarkup(
        <RenderEditingActionButtonsComp bibleItem={bibleItem} />,
    );
    expect(controller.checkIsSplitAskingBibleKey).toHaveBeenLastCalledWith(
        bibleItem,
    );
    expect(grouped).toContain('aria-label="Split Horizontal to"');
    expect(grouped).toContain('aria-label="Split Vertical to"');
    expect(grouped.match(/aria-haspopup="menu"/g)).toHaveLength(2);
});
