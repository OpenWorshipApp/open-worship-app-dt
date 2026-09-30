// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';

import type BibleItem from '../bible-list/BibleItem';
import type { KeyboardListenerType } from '../event/KeyboardEventListener';

const { controller, keyboard } = vi.hoisted(() => ({
    controller: {
        isMinimized: true,
        addBibleItemLeft: vi.fn(),
        addBibleItemBottom: vi.fn(),
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
    ctrlShiftMetaKeys: { allControlKey: ['Ctrl', 'Shift'] },
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
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../slide-editor/canvas/canvasBibleItemHelpers', () => ({
    CanvasBibleItemEventListener: {},
}));

import RenderEditingActionButtonsComp from './RenderEditingActionButtonsComp';

beforeEach(() => {
    vi.clearAllMocks();
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
        const [split, otherSplit] =
            key.toLowerCase() === 'v'
                ? [controller.addBibleItemBottom, controller.addBibleItemLeft]
                : [controller.addBibleItemLeft, controller.addBibleItemBottom];
        expect(split).toHaveBeenCalledExactlyOnceWith(bibleItem, bibleItem);
        expect(otherSplit).not.toHaveBeenCalled();
    },
);
