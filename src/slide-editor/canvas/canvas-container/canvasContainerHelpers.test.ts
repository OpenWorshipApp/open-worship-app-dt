// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { extractDropDataMock, readDroppedFilesMock, showSimpleToastMock } =
    vi.hoisted(() => ({
        extractDropDataMock: vi.fn(),
        readDroppedFilesMock: vi.fn(),
        showSimpleToastMock: vi.fn(),
    }));

vi.mock('../../../helper/dragHelpers', () => ({
    extractDropData: extractDropDataMock,
}));

vi.mock('../../../others/droppingFileHelpers', () => ({
    readDroppedFiles: readDroppedFilesMock,
}));

vi.mock('../../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../canvasContextMenuHelpers', () => ({
    showCanvasContextMenu: vi.fn(),
}));

vi.mock('../../../helper/cameraHelpers', () => ({
    getAllCameraDevices: vi.fn().mockResolvedValue([]),
}));

import {
    dragOverHandling,
    findDroppedCanvasItemId,
    handleDropping,
} from './canvasContainerHelpers';

function genDragOverEvent(types: string[], itemTypeList: string[] = []) {
    return {
        preventDefault: vi.fn(),
        currentTarget: { style: { opacity: '1' } },
        dataTransfer: {
            types,
            items: itemTypeList.map((type) => ({ type })),
        },
    } as any;
}

describe('dragOverHandling', () => {
    test('accepts a background drag by its advertised kind', () => {
        const event = genDragOverEvent([
            'text/plain',
            'application/x-owa-drag-bg-video',
        ]);

        dragOverHandling(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.currentTarget.style.opacity).toBe('0.5');
    });

    test('refuses an internal drag the canvas cannot turn into an item', () => {
        // An internal drag carries two `kind: 'string'` entries, so its items
        // are what the OS-file branch below sees.
        const event = genDragOverEvent(
            ['text/plain', 'application/x-owa-drag-bibleitem'],
            ['text/plain', 'application/x-owa-drag-bibleitem'],
        );

        dragOverHandling(event);

        // Still `preventDefault`d (that has always been unconditional), but no
        // accept feedback for something the drop would silently ignore.
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.currentTarget.style.opacity).toBe('1');
    });

    test('still accepts an OS media file drag', () => {
        const event = genDragOverEvent(['Files'], ['image/png']);

        dragOverHandling(event);

        expect(event.currentTarget.style.opacity).toBe('0.5');
    });

    test('refuses an OS drag carrying an unsupported file', () => {
        const event = genDragOverEvent(['Files'], ['image/png', 'text/csv']);

        dragOverHandling(event);

        expect(event.currentTarget.style.opacity).toBe('1');
    });

    test('refuses a drag carrying nothing droppable at all', () => {
        const event = genDragOverEvent([], []);

        dragOverHandling(event);

        expect(event.currentTarget.style.opacity).toBe('1');
    });
});

describe('findDroppedCanvasItemId', () => {
    test('walks up from the drop target to the box that owns it', () => {
        const box = document.createElement('div');
        box.setAttribute('data-app-box-editor-id', '7');
        const child = document.createElement('span');
        box.appendChild(child);

        expect(findDroppedCanvasItemId({ target: child } as any)).toBe(7);
    });

    test('returns null on bare canvas and for a non-element target', () => {
        const canvas = document.createElement('div');

        expect(findDroppedCanvasItemId({ target: canvas } as any)).toBeNull();
        expect(findDroppedCanvasItemId({ target: null } as any)).toBeNull();
    });
});

describe('handleDropping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        extractDropDataMock.mockReturnValue(null);
        readDroppedFilesMock.mockReturnValue([]);
    });

    function genDropEvent(target: any, currentTarget: any) {
        return {
            clientX: 120,
            clientY: 80,
            target,
            currentTarget,
            dataTransfer: { getData: () => '' },
        } as any;
    }

    test('clears the accept dim off the canvas even when dropped on a box', async () => {
        // `dragOverHandling` dims `currentTarget`; `dragleave` never fires on a
        // drop, so a drop that lands on a box must still clear the CANVAS.
        const canvasElement = document.createElement('div');
        canvasElement.style.opacity = '0.5';
        const box = document.createElement('div');
        canvasElement.appendChild(box);

        await handleDropping({} as any, genDropEvent(box, canvasElement));

        expect(canvasElement.style.opacity).toBe('1');
    });

    test('measures the insert position against the canvas, not the box', async () => {
        const canvasElement = document.createElement('div');
        const box = document.createElement('div');
        box.setAttribute('data-app-box-editor-id', '3');
        canvasElement.appendChild(box);
        extractDropDataMock.mockReturnValue({
            type: 'bg-image',
            item: { filePath: 'a.png' },
        });
        const canvasController = {
            genNewMediaItemFromFilePath: vi.fn().mockResolvedValue('item'),
            addNewItems: vi.fn(),
        } as any;

        await handleDropping(
            canvasController,
            genDropEvent(box, canvasElement),
        );

        expect(
            canvasController.genNewMediaItemFromFilePath,
        ).toHaveBeenCalledWith('a.png', {
            clientX: 120,
            clientY: 80,
            target: canvasElement,
        });
        expect(canvasController.addNewItems).toHaveBeenCalledWith(['item']);
    });

    test('recolors the box a dropped color landed on', async () => {
        const canvasElement = document.createElement('div');
        const box = document.createElement('div');
        box.setAttribute('data-app-box-editor-id', '3');
        canvasElement.appendChild(box);
        extractDropDataMock.mockReturnValue({
            type: 'bg-color',
            item: '#abcdef',
        });
        const canvasController = {
            editCanvasItemById: vi.fn(),
            addNewItems: vi.fn(),
        } as any;

        await handleDropping(
            canvasController,
            genDropEvent(box, canvasElement),
        );

        expect(canvasController.editCanvasItemById.mock.calls[0][0]).toBe(3);
        expect(canvasController.addNewItems).not.toHaveBeenCalled();
    });

    test('ignores an internal drag it has no mapping for, without a toast', async () => {
        const canvasElement = document.createElement('div');
        extractDropDataMock.mockReturnValue({
            type: 'bibleItem',
            item: {},
        });

        await handleDropping(
            {} as any,
            genDropEvent(canvasElement, canvasElement),
        );

        expect(readDroppedFilesMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });
});
