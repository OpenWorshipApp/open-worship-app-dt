import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setCopiedSlides: null as any,
    getCopiedSlides: null as any,
    getCopiedCanvasItems: null as any,
    setCopiedItems: null as any,
    readBibleItemFromClipboard: null as any,
    showSimpleToast: null as any,
}));

// A slide document is anything flagged `isAppDocument`, like the real
// `instanceof` check would tell a PDF or a PowerPoint apart.
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        checkIsThisType: (value: any) => value?.isAppDocument === true,
        getCopiedSlides: () => h.getCopiedSlides(),
        setCopiedSlides: (slides: any[]) => h.setCopiedSlides(slides),
    },
}));
// Enough of the matcher for the keys used here: the key itself plus whether
// Ctrl and Shift are held. `checkIsControlKeys` is the real list.
vi.mock('../event/KeyboardEventListener', () => ({
    // Nothing holds the keyboard above the list here.
    default: { getLastLayer: () => 'root' },
    PlatformEnum: { Windows: 'windows', MacOS: 'mac', Linux: 'linux' },
    checkIsControlKeys: (event: any) => {
        return ['Meta', 'Alt', 'Control', 'Shift'].includes(event.key);
    },
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
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: (...args: any[]) => h.showSimpleToast(...args),
}));
vi.mock('./canvas/canvasBibleItemHelpers', () => ({
    readBibleItemFromClipboard: () => h.readBibleItemFromClipboard(),
}));
vi.mock('./canvas/Canvas', () => ({
    default: {
        getCopiedCanvasItems: () => h.getCopiedCanvasItems(),
        setCopiedItems: (items: any[]) => h.setCopiedItems(items),
    },
}));

import {
    onCanvasKeyboardEvent,
    onSlideItemsKeyboardEvent,
} from './slideEditingKeyboardEventHelpers';

function genKeyEvent(key: string, ctrlKey = false, shiftKey = false) {
    return {
        type: 'keydown',
        key,
        ctrlKey,
        shiftKey,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    };
}

function genSlide(id: number) {
    return {
        id,
        checkIsSame: (other: any) => other?.id === id,
    } as any;
}

function genAppDocument() {
    return {
        isAppDocument: true,
        deleteSlides: vi.fn(async () => {}),
        duplicateSlides: vi.fn(),
        addSlides: vi.fn(),
        getSlides: vi.fn(async () => []),
        historyUndo: vi.fn(),
        historyRedo: vi.fn(),
        save: vi.fn(),
    };
}

function genCanvasController() {
    return {
        canvas: { canvasItems: [] },
        deleteItems: vi.fn(),
        duplicateItems: vi.fn(),
        addNewBibleItem: vi.fn(async () => {}),
        matchEvent: vi.fn((_event: KeyboardEvent) => false),
        appDocument: genAppDocument(),
    };
}

beforeEach(() => {
    h.setCopiedSlides = vi.fn(async () => true);
    h.getCopiedSlides = vi.fn(async () => []);
    h.getCopiedCanvasItems = vi.fn(async () => []);
    h.setCopiedItems = vi.fn(async () => true);
    h.readBibleItemFromClipboard = vi.fn(async () => null);
    h.showSimpleToast = vi.fn();
});

describe('slide list keys', () => {
    test('a document that is not an Open Worship slide document is left alone', async () => {
        const pdfDocument = { ...genAppDocument(), isAppDocument: false };
        const setHoldingSlides = vi.fn();
        for (const event of [
            genKeyEvent('Delete'),
            genKeyEvent('a', true),
            { ...genKeyEvent(''), type: 'blur' },
        ]) {
            await onSlideItemsKeyboardEvent(
                {
                    holdingSlides: [genSlide(1)],
                    setHoldingSlides,
                    varyAppDocument: pdfDocument as any,
                    selectedSlideEditing: null,
                },
                event,
            );
            expect(event.preventDefault).not.toHaveBeenCalled();
        }
        expect(setHoldingSlides).not.toHaveBeenCalled();
        expect(pdfDocument.deleteSlides).not.toHaveBeenCalled();
        expect(pdfDocument.getSlides).not.toHaveBeenCalled();
    });

    test('a modifier pressed on its own does nothing', async () => {
        const appDocument = genAppDocument();
        const setHoldingSlides = vi.fn();
        for (const key of ['Control', 'Shift', 'Alt', 'Meta']) {
            const event = genKeyEvent(key);
            await onSlideItemsKeyboardEvent(
                {
                    holdingSlides: [genSlide(1)],
                    setHoldingSlides,
                    varyAppDocument: appDocument as any,
                    selectedSlideEditing: genSlide(2),
                },
                event,
            );
            expect(event.preventDefault).not.toHaveBeenCalled();
        }
        expect(setHoldingSlides).not.toHaveBeenCalled();
        expect(h.setCopiedSlides).not.toHaveBeenCalled();
    });

    test('copy and duplicate act on the slide being edited when nothing is held', async () => {
        const appDocument = genAppDocument();
        const editing = genSlide(7);
        const copyEvent = genKeyEvent('c', true);
        await onSlideItemsKeyboardEvent(
            {
                holdingSlides: [],
                setHoldingSlides: vi.fn(),
                varyAppDocument: appDocument as any,
                selectedSlideEditing: editing,
            },
            copyEvent,
        );
        expect(h.setCopiedSlides).toHaveBeenCalledExactlyOnceWith([editing]);
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Copied',
            'Slides are copied',
        );
        expect(copyEvent.preventDefault).toHaveBeenCalled();

        await onSlideItemsKeyboardEvent(
            {
                holdingSlides: [],
                setHoldingSlides: vi.fn(),
                varyAppDocument: appDocument as any,
                selectedSlideEditing: editing,
            },
            genKeyEvent('d', true, true),
        );
        expect(appDocument.duplicateSlides).toHaveBeenCalledExactlyOnceWith([
            editing,
        ]);
    });

    test('the slide being edited is not copied twice when it is also held', async () => {
        const appDocument = genAppDocument();
        const held = genSlide(3);
        const editingAsHeld = genSlide(7);
        await onSlideItemsKeyboardEvent(
            {
                holdingSlides: [held, editingAsHeld],
                setHoldingSlides: vi.fn(),
                varyAppDocument: appDocument as any,
                selectedSlideEditing: genSlide(7),
            },
            genKeyEvent('c', true),
        );
        expect(h.setCopiedSlides).toHaveBeenCalledExactlyOnceWith([
            held,
            editingAsHeld,
        ]);
    });

    test('a key never adds the slide being edited to the held list itself', async () => {
        // Found by UT-92 (2026-11-03): the "all selected" list WAS the held
        // list -- React's own state array -- so any key pressed on the slide
        // list pushed the slide being edited into it, unseen by React.
        const appDocument = genAppDocument();
        const editing = genSlide(7);
        const holdingSlides: any[] = [];
        for (const event of [
            genKeyEvent('ArrowDown'),
            genKeyEvent('c', true),
            genKeyEvent('Delete'),
        ]) {
            await onSlideItemsKeyboardEvent(
                {
                    holdingSlides,
                    setHoldingSlides: vi.fn(),
                    varyAppDocument: appDocument as any,
                    selectedSlideEditing: editing,
                },
                event,
            );
        }
        expect(holdingSlides).toEqual([]);
        // Delete still takes the slide being edited when nothing is held,
        // as copy and duplicate do -- what it has always done.
        expect(appDocument.deleteSlides).toHaveBeenCalledExactlyOnceWith([
            editing,
        ]);
    });

    test('nothing to copy leaves the clipboard untouched', async () => {
        const event = genKeyEvent('c', true);
        await onSlideItemsKeyboardEvent(
            {
                holdingSlides: [],
                setHoldingSlides: vi.fn(),
                varyAppDocument: genAppDocument() as any,
                selectedSlideEditing: null,
            },
            event,
        );
        expect(h.setCopiedSlides).not.toHaveBeenCalled();
        // the key is still marked handled at the end
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });
});

describe('canvas keys', () => {
    test('a modifier pressed on its own, or a key that is let go, does nothing', async () => {
        const canvasController = genCanvasController();
        const stopAllModes = vi.fn();
        for (const event of [
            genKeyEvent('Shift'),
            genKeyEvent('Control', true),
            { ...genKeyEvent('Escape'), type: 'keyup' },
        ]) {
            await onCanvasKeyboardEvent(
                {
                    stopAllModes,
                    canvasController: canvasController as any,
                    selectedCanvasItems: [],
                    setSelectedCanvasItems: vi.fn(),
                },
                event,
            );
            expect(event.preventDefault).not.toHaveBeenCalled();
        }
        expect(stopAllModes).not.toHaveBeenCalled();
        expect(canvasController.matchEvent).not.toHaveBeenCalled();
    });

    test('paste duplicates copied canvas items before trying a Bible reference', async () => {
        const copied = [{ id: 11 }, { id: 12 }];
        h.getCopiedCanvasItems.mockResolvedValue(copied);
        const canvasController = genCanvasController();
        await onCanvasKeyboardEvent(
            {
                stopAllModes: vi.fn(),
                canvasController: canvasController as any,
                selectedCanvasItems: [],
                setSelectedCanvasItems: vi.fn(),
            },
            genKeyEvent('v', true),
        );
        expect(canvasController.duplicateItems).toHaveBeenCalledExactlyOnceWith(
            copied,
        );
        expect(h.readBibleItemFromClipboard).not.toHaveBeenCalled();
        expect(canvasController.addNewBibleItem).not.toHaveBeenCalled();
    });

    test('a key the canvas controller handles itself is consumed, any other key is not', async () => {
        const canvasController = genCanvasController();
        canvasController.matchEvent.mockImplementation((event) => {
            return event.key === 'ArrowLeft';
        });
        const context = {
            stopAllModes: vi.fn(),
            canvasController: canvasController as any,
            selectedCanvasItems: [],
            setSelectedCanvasItems: vi.fn(),
        };
        const arrow = genKeyEvent('ArrowLeft');
        await onCanvasKeyboardEvent(context, arrow);
        expect(arrow.preventDefault).toHaveBeenCalledOnce();
        expect(arrow.stopPropagation).toHaveBeenCalledOnce();
        const letter = genKeyEvent('q');
        await onCanvasKeyboardEvent(context, letter);
        expect(canvasController.matchEvent).toHaveBeenCalledTimes(2);
        expect(letter.preventDefault).not.toHaveBeenCalled();
        expect(canvasController.appDocument.historyUndo).not.toHaveBeenCalled();
    });
});
