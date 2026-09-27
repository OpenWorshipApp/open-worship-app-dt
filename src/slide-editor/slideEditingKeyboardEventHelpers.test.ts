import { describe, expect, test, vi } from 'vitest';

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
            const controlKeys: string[] = matcher.wControlKey ?? [];
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
});
