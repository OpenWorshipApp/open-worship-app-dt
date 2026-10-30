import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAppDocument: true,
    isControlKey: false,
    getCopiedSlides: vi.fn(),
    setCopiedSlides: vi.fn(),
    getCopiedCanvasItems: vi.fn(),
    showSimpleToast: vi.fn(),
}));

vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        checkIsThisType: () => h.isAppDocument,
        getCopiedSlides: h.getCopiedSlides,
        setCopiedSlides: h.setCopiedSlides,
    },
}));

// Enough of the matcher for the keys used here: the key itself plus whether
// Ctrl and Shift are held (same shape as the sibling suite's).
vi.mock('../event/KeyboardEventListener', () => ({
    PlatformEnum: { Windows: 'windows', MacOS: 'mac', Linux: 'linux' },
    checkIsControlKeys: () => h.isControlKey,
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
    showSimpleToast: h.showSimpleToast,
}));

vi.mock('./canvas/canvasBibleItemHelpers', () => ({
    readBibleItemFromClipboard: vi.fn(async () => null),
}));

vi.mock('./canvas/Canvas', () => ({
    default: {
        getCopiedCanvasItems: h.getCopiedCanvasItems,
        setCopiedItems: vi.fn(),
    },
}));

import {
    onCanvasKeyboardEvent,
    onSlideItemsKeyboardEvent,
} from './slideEditingKeyboardEventHelpers';

function genKeyEvent(
    key: string,
    { ctrlKey = false, shiftKey = false, type = 'keydown' } = {},
) {
    return {
        type,
        key,
        ctrlKey,
        shiftKey,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    };
}

function genSlide(id: number): any {
    return {
        id,
        checkIsSame: (other: any) => other?.id === id,
    };
}

function genCanvasController(overrides: Record<string, unknown> = {}) {
    return {
        canvas: { canvasItems: [] },
        deleteItems: vi.fn(),
        duplicateItems: vi.fn(),
        addNewBibleItem: vi.fn(),
        matchEvent: vi.fn(() => false),
        appDocument: {
            historyUndo: vi.fn(),
            historyRedo: vi.fn(),
            save: vi.fn(),
        },
        ...overrides,
    } as any;
}

beforeEach(() => {
    h.isAppDocument = true;
    h.isControlKey = false;
    h.getCopiedSlides.mockReset();
    h.setCopiedSlides.mockReset();
    h.getCopiedCanvasItems.mockReset();
    h.showSimpleToast.mockReset();
    h.setCopiedSlides.mockResolvedValue(true);
    h.getCopiedCanvasItems.mockResolvedValue([]);
});

describe('slide list keys', () => {
    test('a document that cannot be edited ignores every key, blur included', async () => {
        h.isAppDocument = false;
        const setHoldingSlides = vi.fn();
        for (const event of [
            genKeyEvent('Escape'),
            genKeyEvent('', { type: 'blur' }),
        ]) {
            await onSlideItemsKeyboardEvent(
                {
                    holdingSlides: [genSlide(1)],
                    setHoldingSlides,
                    varyAppDocument: {} as any,
                    selectedSlideEditing: null,
                },
                event,
            );
            expect(event.preventDefault).not.toHaveBeenCalled();
        }
        expect(setHoldingSlides).not.toHaveBeenCalled();
    });

    test('a lone modifier key press is not a command', async () => {
        h.isControlKey = true;
        const setHoldingSlides = vi.fn();
        const event = genKeyEvent('Escape');

        await onSlideItemsKeyboardEvent(
            {
                holdingSlides: [genSlide(1)],
                setHoldingSlides,
                varyAppDocument: {} as any,
                selectedSlideEditing: null,
            },
            event,
        );

        expect(setHoldingSlides).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('Ctrl+C copies the slide being edited together with the held ones', async () => {
        const held = genSlide(1);
        const editing = genSlide(2);

        await onSlideItemsKeyboardEvent(
            {
                holdingSlides: [held],
                setHoldingSlides: vi.fn(),
                varyAppDocument: {} as any,
                selectedSlideEditing: editing,
            },
            genKeyEvent('c', { ctrlKey: true }),
        );

        expect(h.setCopiedSlides).toHaveBeenCalledWith([held, editing]);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Copied',
            'Slides are copied',
        );
    });

    test('a slide that is both held and edited is copied once', async () => {
        const held = genSlide(1);
        const editing = genSlide(2);

        await onSlideItemsKeyboardEvent(
            {
                holdingSlides: [held, genSlide(2)],
                setHoldingSlides: vi.fn(),
                varyAppDocument: {} as any,
                selectedSlideEditing: editing,
            },
            genKeyEvent('c', { ctrlKey: true }),
        );

        expect(
            h.setCopiedSlides.mock.calls[0][0].map((s: any) => s.id),
        ).toEqual([1, 2]);
    });

    test('Ctrl+Shift+D duplicates the slide being edited when nothing is held', async () => {
        const editing = genSlide(4);
        const appDocument = { duplicateSlides: vi.fn() };

        await onSlideItemsKeyboardEvent(
            {
                holdingSlides: [],
                setHoldingSlides: vi.fn(),
                varyAppDocument: appDocument as any,
                selectedSlideEditing: editing,
            },
            genKeyEvent('d', { ctrlKey: true, shiftKey: true }),
        );

        expect(appDocument.duplicateSlides).toHaveBeenCalledWith([editing]);
    });

    test('copy and duplicate with no slide at all do nothing but still claim the key', async () => {
        const appDocument = { duplicateSlides: vi.fn() };
        const context = {
            holdingSlides: [],
            setHoldingSlides: vi.fn(),
            varyAppDocument: appDocument as any,
            selectedSlideEditing: null,
        };
        const copyEvent = genKeyEvent('c', { ctrlKey: true });
        await onSlideItemsKeyboardEvent(context, copyEvent);
        await onSlideItemsKeyboardEvent(
            context,
            genKeyEvent('d', { ctrlKey: true, shiftKey: true }),
        );

        expect(h.setCopiedSlides).not.toHaveBeenCalled();
        expect(appDocument.duplicateSlides).not.toHaveBeenCalled();
        expect(copyEvent.preventDefault).toHaveBeenCalled();
    });
});

describe('canvas keys', () => {
    test('a key-up or a lone modifier is not a canvas command', async () => {
        const stopAllModes = vi.fn();
        const canvasController = genCanvasController();
        const keyUp = genKeyEvent('Escape', { type: 'keyup' });
        await onCanvasKeyboardEvent(
            {
                stopAllModes,
                canvasController,
                selectedCanvasItems: [],
                setSelectedCanvasItems: vi.fn(),
            },
            keyUp,
        );
        h.isControlKey = true;
        const modifier = genKeyEvent('Escape');
        await onCanvasKeyboardEvent(
            {
                stopAllModes,
                canvasController,
                selectedCanvasItems: [],
                setSelectedCanvasItems: vi.fn(),
            },
            modifier,
        );

        expect(stopAllModes).not.toHaveBeenCalled();
        expect(keyUp.preventDefault).not.toHaveBeenCalled();
        expect(modifier.preventDefault).not.toHaveBeenCalled();
    });

    test('Ctrl+V pastes copied canvas items before looking for a Bible verse', async () => {
        const copiedItems = [{ id: 7 }];
        h.getCopiedCanvasItems.mockResolvedValue(copiedItems);
        const canvasController = genCanvasController();

        await onCanvasKeyboardEvent(
            {
                stopAllModes: vi.fn(),
                canvasController,
                selectedCanvasItems: [],
                setSelectedCanvasItems: vi.fn(),
            },
            genKeyEvent('v', { ctrlKey: true }),
        );

        expect(canvasController.duplicateItems).toHaveBeenCalledWith(
            copiedItems,
        );
        expect(canvasController.addNewBibleItem).not.toHaveBeenCalled();
    });

    test('redo and save reach the edited document', async () => {
        const canvasController = genCanvasController();
        const context = {
            stopAllModes: vi.fn(),
            canvasController,
            selectedCanvasItems: [],
            setSelectedCanvasItems: vi.fn(),
        };

        await onCanvasKeyboardEvent(
            context,
            genKeyEvent('z', { ctrlKey: true, shiftKey: true }),
        );
        await onCanvasKeyboardEvent(
            context,
            genKeyEvent('s', { ctrlKey: true }),
        );

        expect(canvasController.appDocument.historyRedo).toHaveBeenCalledOnce();
        expect(canvasController.appDocument.save).toHaveBeenCalledOnce();
        expect(canvasController.appDocument.historyUndo).not.toHaveBeenCalled();
    });

    test('any other key is offered to the controller and claimed only if it took it', async () => {
        const canvasController = genCanvasController();
        const context = {
            stopAllModes: vi.fn(),
            canvasController,
            selectedCanvasItems: [],
            setSelectedCanvasItems: vi.fn(),
        };
        const ignored = genKeyEvent('q');
        await onCanvasKeyboardEvent(context, ignored);
        expect(canvasController.matchEvent).toHaveBeenCalledWith(ignored);
        expect(ignored.preventDefault).not.toHaveBeenCalled();

        canvasController.matchEvent.mockReturnValue(true);
        const arrow = genKeyEvent('ArrowLeft');
        await onCanvasKeyboardEvent(context, arrow);
        expect(arrow.preventDefault).toHaveBeenCalled();
        expect(arrow.stopPropagation).toHaveBeenCalled();
    });
});
