// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    handleErrorMock,
    useKeyboardRegisteringMock,
    useControllerContextMock,
    readIdOnlyFromJsonMock,
    capturedCallbacks,
} = vi.hoisted(() => ({
    handleErrorMock: vi.fn(),
    useKeyboardRegisteringMock: vi.fn(),
    useControllerContextMock: vi.fn(),
    readIdOnlyFromJsonMock: vi.fn((data: any) => ({
        __readOnly: true,
        bibleKey: data?.bibleKey,
    })),
    capturedCallbacks: [] as any[],
}));

vi.mock('./LookupBibleItemController', () => ({
    closeEventMapper: { key: 'Escape' },
    ctrlShiftMetaKeys: { mControlKey: false },
    useLookupBibleItemControllerContext: useControllerContextMock,
}));

vi.mock('../helper/errorHelpers', () => ({ handleError: handleErrorMock }));

vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: useKeyboardRegisteringMock,
}));

vi.mock('../helper/helpers', () => ({
    RECEIVING_DROP_CLASSNAME: 'receiving-data-drop',
}));

vi.mock('./ReadIdOnlyBibleItem', () => ({
    ReadIdOnlyBibleItem: { fromJson: readIdOnlyFromJsonMock },
}));

import {
    applyDropped,
    closeCurrentEditingBibleItem,
    genDraggingClass,
    removeDraggingClass,
    useCloseBibleItemRenderer,
    useNextEditingBibleItem,
} from './readBibleHelpers';
import { DragTypeEnum } from '../helper/DragInf';

const RECT = { left: 0, top: 0, width: 100, height: 100 } as DOMRect;

function genEvent(x: number, y: number, classNames: string[] = []) {
    const currentTarget = document.createElement('div');
    currentTarget.classList.add(...classNames.filter(Boolean));
    currentTarget.getBoundingClientRect = () => RECT;
    return {
        nativeEvent: { x, y },
        currentTarget,
        dataTransfer: { getData: vi.fn() },
    } as any;
}

describe('bible-reader readBibleHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedCallbacks.length = 0;
        useKeyboardRegisteringMock.mockImplementation(
            (_mappers: any, cb: any) => {
                capturedCallbacks.push(cb);
            },
        );
    });

    test('genDraggingClass computes a suffix per quadrant', () => {
        expect(genDraggingClass(genEvent(50, 50))).toBe('receiving-data-drop');
        expect(genDraggingClass(genEvent(10, 50))).toBe(
            'receiving-data-drop-left',
        );
        expect(genDraggingClass(genEvent(90, 50))).toBe(
            'receiving-data-drop-right',
        );
        expect(genDraggingClass(genEvent(50, 10))).toBe(
            'receiving-data-drop-top',
        );
        expect(genDraggingClass(genEvent(50, 90))).toBe(
            'receiving-data-drop-bottom',
        );
    });

    test('removeDraggingClass strips matching classes and reports suffixes', () => {
        const event = genEvent(50, 50, [
            'receiving-data-drop',
            'receiving-data-drop-left',
        ]);
        const suffixes = removeDraggingClass(event);
        // '' (center) and '-left' both present
        expect(suffixes).toContain('');
        expect(suffixes).toContain('-left');
        expect(
            event.currentTarget.classList.contains('receiving-data-drop-left'),
        ).toBe(false);
    });

    test('applyDropped ignores unrelated drag types', () => {
        const event = genEvent(50, 50);
        event.dataTransfer.getData.mockReturnValue(
            JSON.stringify({ type: 'other', data: {} }),
        );
        const ctl = { applyTargetOrBibleKey: vi.fn() } as any;
        applyDropped(event, ctl, { bibleKey: 'KJV' } as any);
        expect(ctl.applyTargetOrBibleKey).not.toHaveBeenCalled();
    });

    test('applyDropped routes each drop position to the controller', () => {
        const ctl = {
            applyTargetOrBibleKey: vi.fn(),
            addBibleItemLeft: vi.fn(),
            addBibleItemRight: vi.fn(),
            addBibleItemTop: vi.fn(),
            addBibleItemBottom: vi.fn(),
        } as any;
        const bibleItem = { bibleKey: 'KJV' } as any;

        const cases: [string, keyof typeof ctl][] = [
            ['receiving-data-drop', 'applyTargetOrBibleKey'],
            ['receiving-data-drop-left', 'addBibleItemLeft'],
            ['receiving-data-drop-right', 'addBibleItemRight'],
            ['receiving-data-drop-top', 'addBibleItemTop'],
            ['receiving-data-drop-bottom', 'addBibleItemBottom'],
        ];
        for (const [className, method] of cases) {
            const event = genEvent(50, 50, [className]);
            event.dataTransfer.getData.mockReturnValue(
                JSON.stringify({
                    type: DragTypeEnum.BIBLE_ITEM,
                    data: { bibleKey: 'ESV' },
                }),
            );
            applyDropped(event, ctl, bibleItem);
            expect(ctl[method]).toHaveBeenCalled();
        }
    });

    test('applyDropped copies bibleKey for target-only drops', () => {
        const ctl = { applyTargetOrBibleKey: vi.fn() } as any;
        const event = genEvent(50, 50, ['receiving-data-drop']);
        event.dataTransfer.getData.mockReturnValue(
            JSON.stringify({
                type: DragTypeEnum.BIBLE_ITEM_TARGET_ONLY,
                data: { bibleKey: 'ESV' },
            }),
        );
        applyDropped(event, ctl, { bibleKey: 'KJV' } as any);
        const passedItem = ctl.applyTargetOrBibleKey.mock.calls[0][1];
        expect(passedItem.bibleKey).toBe('KJV');
    });

    test('applyDropped handles malformed json through handleError', () => {
        const event = genEvent(50, 50);
        event.dataTransfer.getData.mockReturnValue('{not-json');
        applyDropped(event, {} as any, {} as any);
        expect(handleErrorMock).toHaveBeenCalled();
    });

    test('useNextEditingBibleItem edits the neighbor for each arrow key', () => {
        const editBibleItem = vi.fn();
        const controller = {
            straightBibleItems: [{}, {}],
            selectedIndex: 0,
            selectedBibleItem: { id: 1 },
            getNeighborBibleItems: vi.fn(() => ({
                left: { id: 'L' },
                right: { id: 'R' },
                top: { id: 'T' },
                bottom: { id: 'B' },
            })),
            editBibleItem,
        };
        useControllerContextMock.mockReturnValue(controller);
        useNextEditingBibleItem();
        const cb = capturedCallbacks[0];

        for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
            const preventDefault = vi.fn();
            cb({ preventDefault, key });
            expect(preventDefault).toHaveBeenCalled();
        }
        expect(editBibleItem).toHaveBeenCalledTimes(4);
    });

    test('useNextEditingBibleItem exits early with no items or no selection', () => {
        useControllerContextMock.mockReturnValue({
            straightBibleItems: [],
            selectedIndex: 0,
            getNeighborBibleItems: vi.fn(),
            editBibleItem: vi.fn(),
        });
        useNextEditingBibleItem();
        capturedCallbacks[0]({ preventDefault: vi.fn(), key: 'ArrowLeft' });

        const editBibleItem = vi.fn();
        useControllerContextMock.mockReturnValue({
            straightBibleItems: [{}],
            selectedIndex: -1,
            getNeighborBibleItems: vi.fn(),
            editBibleItem,
        });
        useNextEditingBibleItem();
        capturedCallbacks[1]({ preventDefault: vi.fn(), key: 'ArrowLeft' });
        expect(editBibleItem).not.toHaveBeenCalled();
    });

    test('useNextEditingBibleItem does nothing when the neighbor is null', () => {
        const editBibleItem = vi.fn();
        useControllerContextMock.mockReturnValue({
            straightBibleItems: [{}],
            selectedIndex: 0,
            selectedBibleItem: {},
            getNeighborBibleItems: vi.fn(() => ({
                left: null,
                right: null,
                top: null,
                bottom: null,
            })),
            editBibleItem,
        });
        useNextEditingBibleItem();
        capturedCallbacks[0]({ preventDefault: vi.fn(), key: 'ArrowRight' });
        expect(editBibleItem).not.toHaveBeenCalled();
    });

    test('closeCurrentEditingBibleItem deletes only when multiple items exist', () => {
        const deleteBibleItem = vi.fn();
        closeCurrentEditingBibleItem({
            selectedBibleItem: { id: 1 },
            straightBibleItems: [{}],
            deleteBibleItem,
        } as any);
        expect(deleteBibleItem).not.toHaveBeenCalled();

        closeCurrentEditingBibleItem({
            selectedBibleItem: { id: 1 },
            straightBibleItems: [{}, {}],
            deleteBibleItem,
        } as any);
        expect(deleteBibleItem).toHaveBeenCalled();
    });

    test('useCloseBibleItemRenderer wires the close shortcut', () => {
        const deleteBibleItem = vi.fn();
        useControllerContextMock.mockReturnValue({
            selectedBibleItem: { id: 1 },
            straightBibleItems: [{}, {}],
            deleteBibleItem,
        });
        useCloseBibleItemRenderer();
        const preventDefault = vi.fn();
        capturedCallbacks[0]({ preventDefault });
        expect(preventDefault).toHaveBeenCalled();
        expect(deleteBibleItem).toHaveBeenCalled();
    });
});
