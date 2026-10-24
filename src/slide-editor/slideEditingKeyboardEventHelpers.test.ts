import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        checkIsThisType: () => true,
        getCopiedSlides: vi.fn(async () => []),
        setCopiedSlides: vi.fn(),
    },
}));

// Enough of the matcher for the keys used here: the key itself plus whether
// Ctrl and Shift are held.
vi.mock('../event/KeyboardEventListener', () => ({
    PlatformEnum: { Windows: 'windows', MacOS: 'mac', Linux: 'linux' },
    checkIsControlKeys: () => false,
    checkIsKeyboardEventMatch: (matchers: any[], event: any) => {
        return matchers.some((matcher) => {
            const controlKeys: string[] =
                matcher.wControlKey ?? matcher.allControlKey ?? [];
            return (
                matcher.platform === undefined &&
                matcher.key === event.key &&
                controlKeys.includes('Ctrl') === Boolean(event.ctrlKey) &&
                controlKeys.includes('Shift') === Boolean(event.shiftKey)
            );
        });
    },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: vi.fn(),
}));

vi.mock('./canvas/canvasBibleItemHelpers', () => ({
    readBibleItemFromClipboard: vi.fn(async () => null),
}));

vi.mock('./canvas/Canvas', () => ({
    default: {
        getCopiedCanvasItems: vi.fn(async () => []),
        setCopiedItems: vi.fn(),
    },
}));

import {
    onCanvasKeyboardEvent,
    onSlideItemsKeyboardEvent,
} from './slideEditingKeyboardEventHelpers';
import AppDocument from '../app-document-list/AppDocument';
import Canvas from './canvas/Canvas';
import { showSimpleToast } from '../toast/toastHelpers';
import { readBibleItemFromClipboard } from './canvas/canvasBibleItemHelpers';

function genKeyEvent(key: string, ctrlKey = false) {
    return {
        type: 'keydown',
        key,
        ctrlKey,
        shiftKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    };
}

describe('slideEditingKeyboardEventHelpers', () => {
    beforeEach(() => vi.clearAllMocks());

    test.each([true, false])(
        'slide copy consumes the key before awaiting and reports only success (%s)',
        async (copied) => {
            let finish!: (ok: boolean) => void;
            vi.mocked(AppDocument.setCopiedSlides).mockReturnValueOnce(
                new Promise((resolve) => {
                    finish = resolve;
                }),
            );
            const event = genKeyEvent('c', true);
            const pending = onSlideItemsKeyboardEvent(
                {
                    holdingSlides: [{ id: 1 }] as any,
                    selectedSlideEditing: null,
                    setHoldingSlides: vi.fn(),
                    varyAppDocument: {} as any,
                },
                event,
            );
            expect(event.preventDefault).toHaveBeenCalled();
            expect(showSimpleToast).not.toHaveBeenCalled();
            finish(copied);
            await pending;
            expect(showSimpleToast).toHaveBeenCalledTimes(copied ? 1 : 0);
        },
    );

    test.each([true, false])(
        'canvas copy consumes the key before awaiting and reports only success (%s)',
        async (copied) => {
            let finish!: (ok: boolean) => void;
            vi.mocked(Canvas.setCopiedItems).mockReturnValueOnce(
                new Promise((resolve) => {
                    finish = resolve;
                }),
            );
            const event = genKeyEvent('c', true);
            const pending = onCanvasKeyboardEvent(
                {
                    stopAllModes: vi.fn(),
                    canvasController: {} as any,
                    selectedCanvasItems: [{ id: 1 }] as any,
                    setSelectedCanvasItems: vi.fn(),
                },
                event,
            );
            expect(event.preventDefault).toHaveBeenCalled();
            expect(showSimpleToast).not.toHaveBeenCalled();
            finish(copied);
            await pending;
            expect(showSimpleToast).toHaveBeenCalledTimes(copied ? 1 : 0);
        },
    );
    // A default action can only be cancelled while the event is being
    // dispatched. Cancelling it after an `await` let Ctrl+A in the slide list
    // also select all the text in the window.
    test('Ctrl+A in the slide list cancels the default before it awaits', async () => {
        let resolveSlides: (slides: any[]) => void = () => {};
        const slides = [{ id: 1 }, { id: 2 }];
        const appDocument = {
            getSlides: vi.fn(() => {
                return new Promise<any[]>((resolve) => {
                    resolveSlides = resolve;
                });
            }),
        };
        const setHoldingSlides = vi.fn();
        const event = genKeyEvent('a', true);

        const pending = onSlideItemsKeyboardEvent(
            {
                holdingSlides: [],
                setHoldingSlides,
                varyAppDocument: appDocument as any,
                selectedSlideEditing: null,
            },
            event,
        );

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();

        resolveSlides(slides);
        await pending;
        expect(setHoldingSlides).toHaveBeenCalledWith(slides);
    });

    test('Ctrl+V on the canvas cancels the default before it awaits', async () => {
        const event = genKeyEvent('v', true);

        const pending = onCanvasKeyboardEvent(
            {
                stopAllModes: vi.fn(),
                canvasController: {
                    duplicateItems: vi.fn(),
                    addNewBibleItem: vi.fn(),
                } as any,
                selectedCanvasItems: [],
                setSelectedCanvasItems: vi.fn(),
            },
            event,
        );

        expect(event.preventDefault).toHaveBeenCalled();
        await pending;
    });

    test('slide keys delete, paste and duplicate the selected slides', async () => {
        const selected = [{ id: 3, checkIsSame: () => false }] as any;
        const copied = [{ id: 4 }] as any;
        const appDocument = {
            deleteSlides: vi.fn(async () => {}),
            addSlides: vi.fn(),
            duplicateSlides: vi.fn(),
        };
        const context = {
            holdingSlides: selected,
            selectedSlideEditing: null,
            setHoldingSlides: vi.fn(),
            varyAppDocument: appDocument as any,
        };
        const deleteEvent = genKeyEvent('Delete');
        await onSlideItemsKeyboardEvent(context, deleteEvent);
        expect(deleteEvent.preventDefault).toHaveBeenCalled();
        expect(appDocument.deleteSlides).toHaveBeenCalledWith(selected);

        vi.mocked(AppDocument.getCopiedSlides).mockResolvedValueOnce(copied);
        const pasteEvent = genKeyEvent('v', true);
        await onSlideItemsKeyboardEvent(context, pasteEvent);
        expect(pasteEvent.preventDefault).toHaveBeenCalled();
        expect(appDocument.addSlides).toHaveBeenCalledWith(copied);

        const duplicateEvent = genKeyEvent('d', true);
        duplicateEvent.shiftKey = true;
        await onSlideItemsKeyboardEvent(context, duplicateEvent);
        expect(appDocument.duplicateSlides).toHaveBeenCalledWith(selected);
    });

    test('slide Escape, blur and history keys clear or restore selection', async () => {
        const appDocument = {
            historyUndo: vi.fn(),
            historyRedo: vi.fn(),
            save: vi.fn(),
        };
        const context = {
            holdingSlides: [{ id: 1 }] as any,
            selectedSlideEditing: null,
            setHoldingSlides: vi.fn(),
            varyAppDocument: appDocument as any,
        };
        await onSlideItemsKeyboardEvent(context, genKeyEvent('Escape'));
        expect(context.setHoldingSlides).toHaveBeenCalledWith([]);
        const blurEvent = { ...genKeyEvent(''), type: 'blur' };
        await onSlideItemsKeyboardEvent(context, blurEvent);
        expect(blurEvent.preventDefault).toHaveBeenCalled();
        expect(context.setHoldingSlides).toHaveBeenCalledTimes(2);

        await onSlideItemsKeyboardEvent(context, genKeyEvent('z', true));
        const redoEvent = genKeyEvent('z', true);
        redoEvent.shiftKey = true;
        await onSlideItemsKeyboardEvent(context, redoEvent);
        await onSlideItemsKeyboardEvent(context, genKeyEvent('s', true));
        expect(appDocument.historyUndo).toHaveBeenCalledOnce();
        expect(appDocument.historyRedo).toHaveBeenCalledOnce();
        expect(appDocument.save).toHaveBeenCalledOnce();
    });

    test('canvas Tab cycles by item id and delete removes the selected item', async () => {
        const items = [
            { props: { id: 8 } },
            { props: { id: 2 } },
            { props: { id: 5 } },
        ] as any;
        const canvasController = {
            canvas: { canvasItems: items },
            deleteItems: vi.fn(),
            duplicateItems: vi.fn(),
        };
        const setSelectedCanvasItems = vi.fn();
        const context = {
            stopAllModes: vi.fn(),
            canvasController: canvasController as any,
            selectedCanvasItems: [items[1]],
            setSelectedCanvasItems,
        };
        await onCanvasKeyboardEvent(context, genKeyEvent('Tab'));
        expect(setSelectedCanvasItems).toHaveBeenCalledWith([items[2]]);
        const reverse = genKeyEvent('Tab');
        reverse.shiftKey = true;
        await onCanvasKeyboardEvent(context, reverse);
        expect(setSelectedCanvasItems).toHaveBeenLastCalledWith([items[0]]);
        await onCanvasKeyboardEvent(context, genKeyEvent('Delete'));
        expect(canvasController.deleteItems).toHaveBeenCalledWith([items[1]]);
    });

    test('canvas paste falls back to a Bible item and other keys use controller actions', async () => {
        const bibleItem = { title: 'John 3:16' } as any;
        vi.mocked(readBibleItemFromClipboard).mockResolvedValueOnce(bibleItem);
        const canvasController = {
            canvas: { canvasItems: [] },
            addNewBibleItem: vi.fn(async () => {}),
            duplicateItems: vi.fn(),
            matchEvent: vi.fn(() => false),
            appDocument: { historyUndo: vi.fn() },
        };
        const context = {
            stopAllModes: vi.fn(),
            canvasController: canvasController as any,
            selectedCanvasItems: [] as any,
            setSelectedCanvasItems: vi.fn(),
        };
        await onCanvasKeyboardEvent(context, genKeyEvent('v', true));
        expect(canvasController.addNewBibleItem).toHaveBeenCalledWith(
            bibleItem,
        );
        const duplicateEvent = genKeyEvent('d', true);
        duplicateEvent.shiftKey = true;
        await onCanvasKeyboardEvent(context, duplicateEvent);
        expect(canvasController.duplicateItems).toHaveBeenCalledWith([]);
        await onCanvasKeyboardEvent(context, genKeyEvent('Escape'));
        expect(context.stopAllModes).toHaveBeenCalledOnce();
        await onCanvasKeyboardEvent(context, genKeyEvent('z', true));
        expect(canvasController.appDocument.historyUndo).toHaveBeenCalledOnce();
    });
});
