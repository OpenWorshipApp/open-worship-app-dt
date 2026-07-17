import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fileSourceGetInstanceMock: vi.fn(),
    fromBibleItemMock: vi.fn(),
    genDefaultItemMock: vi.fn(),
    genFromFileImageMock: vi.fn(),
    genFromFileVideoMock: vi.fn(),
    genFromInsertionImageMock: vi.fn(),
    genFromInsertionVideoMock: vi.fn(),
    genFromUrlYouTubeMock: vi.fn(),
    genFromUrlWebsiteMock: vi.fn(),
    getSettingMock: vi.fn(),
    handleErrorMock: vi.fn(),
    setSettingMock: vi.fn(),
    showCanvasItemContextMenuMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: mocks.getSettingMock,
    setSetting: mocks.setSettingMock,
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: mocks.fileSourceGetInstanceMock,
    },
}));

vi.mock('./CanvasItemText', () => ({
    default: {
        genDefaultItem: mocks.genDefaultItemMock,
    },
}));

vi.mock('./CanvasItemImage', () => ({
    default: {
        genFromFile: mocks.genFromFileImageMock,
        genFromInsertion: mocks.genFromInsertionImageMock,
    },
}));

vi.mock('./CanvasItemBibleItem', () => ({
    default: {
        fromBibleItem: mocks.fromBibleItemMock,
    },
}));

vi.mock('./CanvasItemVideo', () => ({
    default: {
        genFromFile: mocks.genFromFileVideoMock,
        genFromInsertion: mocks.genFromInsertionVideoMock,
    },
}));

vi.mock('./CanvasItemYouTube', () => ({
    default: {
        genFromUrl: mocks.genFromUrlYouTubeMock,
    },
}));

vi.mock('./CanvasItemWebsite', () => ({
    default: {
        genFromUrl: mocks.genFromUrlWebsiteMock,
    },
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToastMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('./canvasContextMenuHelpers', () => ({
    showCanvasItemContextMenu: mocks.showCanvasItemContextMenuMock,
}));

vi.mock('../../event/KeyboardEventListener', () => ({
    allArrows: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
}));

// `canvasHelpers` pulls in `server/fileHelpers`, whose `appProvider` mock
// needs a DOM this node-environment test doesn't have.
vi.mock('../../server/fileHelpers', () => ({
    isSupportedMimetype: vi.fn(() => true),
}));

import CanvasController from './CanvasController';

function createCanvasItem({
    id,
    type = 'text',
    top = 20,
    left = 10,
    width = 200,
    height = 100,
    mediaWidth = width,
    mediaHeight = height,
}: {
    id: number;
    type?: string;
    top?: number;
    left?: number;
    width?: number;
    height?: number;
    mediaWidth?: number;
    mediaHeight?: number;
}) {
    const item: any = {
        type,
        props: {
            id,
            top,
            left,
            width,
            height,
            mediaWidth,
            mediaHeight,
        },
        applyBoxData: vi.fn(),
        applyProps: vi.fn((props: Record<string, unknown>) => {
            Object.assign(item.props, props);
        }),
        checkIsSame: (targetItem: any) => {
            return item.props.id === (targetItem.props?.id ?? targetItem.id);
        },
        fireEditEvent: vi.fn(),
    };

    Object.defineProperty(item, 'id', {
        configurable: true,
        get() {
            return item.props.id;
        },
    });
    Object.defineProperty(item, 'isLocked', {
        configurable: true,
        get() {
            return item.props.locked === true;
        },
    });

    return item;
}

function createCanvas(initialItems: any[] = []) {
    let currentItems = initialItems;

    return {
        height: 720,
        slide: { id: 'slide-1' },
        width: 1280,
        get canvasItems() {
            return currentItems;
        },
        set canvasItems(newCanvasItems: any[]) {
            currentItems = newCanvasItems;
        },
        get maxItemId() {
            return currentItems.reduce((maxId, item) => {
                return Math.max(maxId, item.props?.id ?? item.id ?? 0);
            }, 0);
        },
    };
}

function createController(
    items: any[] = [],
    settingValue: string | null = null,
) {
    const canvas = createCanvas(items);
    const appDocument = {
        fileSource: { fullName: 'sample.owa' },
        updateSlide: vi.fn(),
    };
    mocks.getSettingMock.mockReturnValue(settingValue);
    const controller = new CanvasController(appDocument as any, canvas as any);
    return { appDocument, canvas, controller };
}

describe('CanvasController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSettingMock.mockReturnValue(null);
        mocks.fileSourceGetInstanceMock.mockReturnValue({
            metadata: {
                appMimetype: {
                    mimetypeName: 'image',
                },
            },
        });
    });

    test('initializes scale, emits scale and reload events, and applies edited items', async () => {
        const existingItem = createCanvasItem({ id: 1 });
        const replacementItem = createCanvasItem({ id: 1, left: 50 });
        const missingItem = createCanvasItem({ id: 99 });
        const { appDocument, canvas, controller } = createController(
            [existingItem],
            '1.5',
        );
        const listener = vi.fn();

        controller.itemRegisterEventListener(['scale', 'reload'], listener);
        controller.scale = 2;
        await Promise.resolve();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0]?.[0]).toEqual({
            canvasItems: [existingItem],
        });

        controller.fireReloadEvent();
        await Promise.resolve();

        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener.mock.calls[1]?.[0]).toEqual({
            canvasItems: [existingItem],
        });

        controller.editCanvasItemById(replacementItem.id, (latestItem) => {
            latestItem.applyProps(replacementItem.props);
        });
        controller.editCanvasItemById(missingItem.id, (latestItem) => {
            latestItem.applyProps(missingItem.props);
        });

        expect(controller.scale).toBe(2);
        expect(mocks.setSettingMock).toHaveBeenCalledWith(
            'canvas-editor-scale',
            '2',
        );
        expect(canvas.canvasItems[0]?.id).toBe(replacementItem.id);
        expect(canvas.canvasItems[0]?.props.left).toBe(50);
        expect(appDocument.updateSlide).toHaveBeenCalledWith(canvas.slide);
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Edit Canvas Item',
            'Canvas item not found',
        );
    });

    test('edits latest items by id and commits once for multi-item edits', () => {
        const firstItem = createCanvasItem({ id: 1, left: 10, top: 20 });
        const secondItem = createCanvasItem({ id: 2, left: 30, top: 40 });
        const { appDocument, canvas, controller } = createController([
            firstItem,
            secondItem,
        ]);

        const editedItems = controller.editCanvasItemsByIds(
            [1, 2],
            (item) => {
                item.applyProps({ left: item.props.left + 5 });
            },
            { showNotFoundToast: false },
        );

        expect(editedItems).toHaveLength(2);
        expect(canvas.canvasItems[0]?.props.left).toBe(15);
        expect(canvas.canvasItems[1]?.props.left).toBe(35);
        expect(appDocument.updateSlide).toHaveBeenCalledTimes(1);
        expect(firstItem.fireEditEvent).toHaveBeenCalledTimes(1);
        expect(secondItem.fireEditEvent).toHaveBeenCalledTimes(1);

        const result = controller.editCanvasItemsByIds([999], () => {}, {
            showNotFoundToast: false,
        });
        expect(result).toEqual([]);
        expect(mocks.showSimpleToastMock).not.toHaveBeenCalledWith(
            'Edit Canvas Item',
            'Canvas item not found',
        );
    });

    test('duplicates, adds, deletes, reorders, and matches arrow events', () => {
        const firstItem = createCanvasItem({ id: 1, top: 10, left: 20 });
        const secondItem = createCanvasItem({ id: 2, top: 30, left: 40 });
        const duplicateItem = createCanvasItem({ id: 50, top: 5, left: 7 });
        const newItem = createCanvasItem({ id: -1, top: 0, left: 0 });
        const { canvas, controller } = createController([
            firstItem,
            secondItem,
        ]);
        const onArrowing = vi.fn();
        controller.onArrowing = onArrowing;

        controller.duplicateItems([duplicateItem as any]);
        controller.addNewItems([newItem as any]);
        controller.applyOrderingData(newItem as any, true);
        controller.deleteItems([secondItem as any]);

        expect(duplicateItem.props.id).toBe(3);
        expect(duplicateItem.props.top).toBe(25);
        expect(duplicateItem.props.left).toBe(27);
        expect(newItem.props.id).toBe(4);
        expect(canvas.canvasItems.map((item: any) => item.props.id)).toEqual([
            1, 4, 3,
        ]);

        const arrowEvent = { key: 'ArrowLeft' } as KeyboardEvent;
        expect(controller.matchEvent(arrowEvent)).toBe(true);
        expect(onArrowing).toHaveBeenCalledWith(arrowEvent);
        expect(controller.matchEvent({ key: 'Enter' } as KeyboardEvent)).toBe(
            false,
        );
    });

    test('refuses to delete locked items until they are unlocked', () => {
        const lockedItem = createCanvasItem({ id: 1 });
        lockedItem.props.locked = true;
        const normalItem = createCanvasItem({ id: 2 });
        const { appDocument, canvas, controller } = createController([
            lockedItem,
            normalItem,
        ]);

        controller.deleteItems([lockedItem]);
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Delete Canvas Items',
            'Locked items cannot be deleted',
        );
        expect(canvas.canvasItems.map((item: any) => item.props.id)).toEqual([
            1, 2,
        ]);
        // Nothing was deletable, so no history entry either.
        expect(appDocument.updateSlide).not.toHaveBeenCalled();

        // A mixed selection deletes only the unlocked items.
        controller.deleteItems([lockedItem, normalItem]);
        expect(canvas.canvasItems.map((item: any) => item.props.id)).toEqual([
            1,
        ]);

        lockedItem.props.locked = false;
        controller.deleteItems([lockedItem]);
        expect(canvas.canvasItems).toEqual([]);
    });

    test('creates media items from paths and blobs and reports unsupported or failed paths', async () => {
        const { controller } = createController();
        const imageItem = createCanvasItem({ id: 3, type: 'image' });
        const videoItem = createCanvasItem({ id: 4, type: 'video' });
        const event = {
            clientX: 110,
            clientY: 220,
            target: {
                getBoundingClientRect: () => ({ left: 10, top: 20 }),
            },
        };

        mocks.genFromInsertionImageMock.mockResolvedValue(imageItem);
        mocks.genFromInsertionVideoMock.mockResolvedValue(videoItem);
        mocks.genFromFileImageMock.mockResolvedValue(imageItem);
        mocks.genFromFileVideoMock.mockResolvedValue(videoItem);

        await expect(
            controller.genNewMediaItemFromFilePath(
                '/assets/a.png',
                event as any,
            ),
        ).resolves.toBe(imageItem);
        expect(mocks.genFromInsertionImageMock).toHaveBeenCalledWith(
            100,
            200,
            '/assets/a.png',
        );

        mocks.fileSourceGetInstanceMock.mockReturnValueOnce({
            metadata: { appMimetype: { mimetypeName: 'video' } },
        });
        await expect(
            controller.genNewMediaItemFromFilePath(
                '/assets/a.mp4',
                event as any,
            ),
        ).resolves.toBe(videoItem);
        expect(mocks.genFromInsertionVideoMock).toHaveBeenCalledWith(
            100,
            200,
            '/assets/a.mp4',
        );

        mocks.fileSourceGetInstanceMock.mockReturnValueOnce({
            metadata: { appMimetype: { mimetypeName: 'application/pdf' } },
        });
        await expect(
            controller.genNewMediaItemFromFilePath(
                '/assets/a.pdf',
                event as any,
            ),
        ).resolves.toBeUndefined();
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Insert Medias',
            'Only image and video files are supported',
        );

        mocks.fileSourceGetInstanceMock.mockImplementationOnce(() => {
            throw new Error('broken path');
        });
        await expect(
            controller.genNewMediaItemFromFilePath(
                '/broken/file',
                event as any,
            ),
        ).resolves.toBeUndefined();
        expect(mocks.handleErrorMock).toHaveBeenCalled();
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Insert Image or Video',
            'Fail to insert medias',
        );

        await expect(
            controller.genNewImageItemFromFile(
                new Blob(['image']),
                event as any,
            ),
        ).resolves.toBe(imageItem);
        expect(mocks.genFromFileImageMock).toHaveBeenCalledWith(
            100,
            200,
            expect.any(Blob),
        );

        // Dropped files dispatch on their mimetype: video files become
        // video items, everything else goes through the image path.
        mocks.genFromFileImageMock.mockClear();
        await expect(
            controller.genNewMediaItemFromFile(
                new Blob(['video'], { type: 'video/mp4' }),
                event as any,
            ),
        ).resolves.toBe(videoItem);
        expect(mocks.genFromFileVideoMock).toHaveBeenCalledWith(
            100,
            200,
            expect.any(Blob),
        );
        expect(mocks.genFromFileImageMock).not.toHaveBeenCalled();

        await expect(
            controller.genNewMediaItemFromFile(
                new Blob(['image'], { type: 'image/png' }),
                event as any,
            ),
        ).resolves.toBe(imageItem);
        expect(mocks.genFromFileImageMock).toHaveBeenCalledWith(
            100,
            200,
            expect.any(Blob),
        );

        mocks.genFromFileVideoMock.mockRejectedValueOnce(
            new Error('broken video'),
        );
        await expect(
            controller.genNewMediaItemFromFile(
                new Blob(['video'], { type: 'video/mp4' }),
                event as any,
            ),
        ).resolves.toBeUndefined();
        expect(mocks.handleErrorMock).toHaveBeenCalled();
        expect(mocks.showSimpleToastMock).toHaveBeenCalledWith(
            'Insert Image or Video',
            'Fail to insert medias',
        );
    });

    test('adds bible items, scales items, moves items, and opens context menus', async () => {
        const { canvas, controller } = createController();
        const bibleCanvasItem = createCanvasItem({ id: -1, type: 'bible' });
        const mediaItem = createCanvasItem({
            id: 9,
            type: 'image',
            top: 0,
            left: 0,
            width: 300,
            height: 300,
            mediaWidth: 800,
            mediaHeight: 200,
        });
        const textItem = createCanvasItem({
            id: 10,
            type: 'text',
            top: 100,
            left: 200,
            width: 400,
            height: 100,
        });
        const editHandler = vi.fn();
        const stopPropagation = vi.fn();

        mocks.fromBibleItemMock.mockResolvedValue(bibleCanvasItem);

        await controller.addNewBibleItem({ key: 'GEN.1.1' } as any);
        controller.applyCanvasItemFully(mediaItem as any);
        controller.applyCanvasItemMediaStrip(textItem as any);
        CanvasController.scaleCanvasItemToSize(
            textItem as any,
            200,
            200,
            400,
            100,
        );
        controller.moveCanvasItem(textItem as any, 2, 3, {
            arrowing: 'ArrowRight',
            isCtrlKey: true,
            isShiftKey: false,
        });
        controller.moveCanvasItem(textItem as any, 2, 3, {
            arrowing: 'ArrowUp',
            isCtrlKey: false,
            isShiftKey: true,
        });

        controller.genHandleContextMenuOpening(
            mediaItem as any,
            editHandler,
            true,
        )({ stopPropagation } as any);

        expect(bibleCanvasItem.props.id).toBe(1);
        expect(canvas.canvasItems[0]).toBe(bibleCanvasItem);
        expect(mediaItem.applyBoxData).toHaveBeenCalledWith({
            parentWidth: 1280,
            parentHeight: 720,
        });
        expect(mediaItem.props.left).toBe(0);
        expect(mediaItem.props.top).toBe(200);
        expect(textItem.applyBoxData).toHaveBeenCalledWith({
            parentWidth: 200,
            parentHeight: 200,
        });
        expect(textItem.props.width).toBe(200);
        expect(textItem.props.height).toBe(50);
        expect(textItem.props.left).toBeCloseTo(300.2, 5);
        expect(textItem.props.top).toBe(95);
        expect(mocks.showCanvasItemContextMenuMock).toHaveBeenCalledWith(
            { stopPropagation },
            controller,
            mediaItem,
            editHandler,
            true,
            null,
        );
        expect(stopPropagation).toHaveBeenCalledTimes(1);
    });
});
