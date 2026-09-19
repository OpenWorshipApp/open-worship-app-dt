// @vitest-environment jsdom
// jsdom only because `CanvasItemYouTube` pulls in `canvasHelpers` -> `appProvider`,
// which touches `document` at module scope. Nothing here uses the DOM.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getAllCameraDevicesMock } = vi.hoisted(() => ({
    getAllCameraDevicesMock: vi.fn(),
}));

// `cameraHelpers` destructures `navigator.mediaDevices` at module load, which
// does not exist in the node environment these canvas model tests run in.
vi.mock('../../helper/cameraHelpers', () => ({
    getAllCameraDevices: getAllCameraDevicesMock,
}));

import { DragTypeEnum } from '../../helper/DragInf';
import {
    applyCanvasBackgroundDropPlan,
    canvasBackgroundDropMimeTypeSet,
    checkIsCanvasBackgroundDropDataTransfer,
    planCanvasBackgroundDrop,
} from './canvasBackgroundDropHelpers';

const positionEvent = { clientX: 0, clientY: 0, target: null };

function genCanvasControllerMock() {
    return {
        genNewMediaItemFromFilePath: vi.fn().mockResolvedValue('media-item'),
        genNewYouTubeItem: vi.fn().mockReturnValue('youtube-item'),
        genNewWebsiteItem: vi.fn().mockReturnValue('website-item'),
        genNewCameraItem: vi.fn().mockReturnValue('camera-item'),
        genNewColorBoxItem: vi.fn().mockReturnValue('color-box-item'),
        addNewItems: vi.fn(),
        editCanvasItemById: vi.fn(),
    } as any;
}

describe('planCanvasBackgroundDrop', () => {
    test.each([
        DragTypeEnum.BACKGROUND_IMAGE,
        DragTypeEnum.BACKGROUND_VIDEO,
        DragTypeEnum.BACKGROUND_AUDIO,
    ])('maps %s to its file path', (type) => {
        expect(
            planCanvasBackgroundDrop({
                type,
                item: { filePath: 'C:\\videos\\a.mp4' },
            }),
        ).toEqual({ kind: 'media', filePath: 'C:\\videos\\a.mp4' });
    });

    test.each([
        'https://youtu.be/abc123',
        'https://www.youtube.com/watch?v=abc123',
        'https://youtube.com/shorts/abc123',
    ])('maps the web URL %s to a youtube item', (src) => {
        expect(
            planCanvasBackgroundDrop({
                type: DragTypeEnum.BACKGROUND_WEB,
                item: { src, isUrl: true },
            }),
        ).toEqual({ kind: 'youtube', url: src });
    });

    test('maps a non-youtube web URL to a website item', () => {
        expect(
            planCanvasBackgroundDrop({
                type: DragTypeEnum.BACKGROUND_WEB,
                item: { src: 'https://example.com/page', isUrl: true },
            }),
        ).toEqual({ kind: 'website', url: 'https://example.com/page' });
    });

    test('maps a local web file to a website item at its file:// url', () => {
        expect(
            planCanvasBackgroundDrop({
                type: DragTypeEnum.BACKGROUND_WEB,
                // A `FileSource`, which never sets `isUrl`.
                item: {
                    filePath: 'C:\\webs\\a.html',
                    src: 'file:///C:/webs/a.html',
                },
            }),
        ).toEqual({ kind: 'website', url: 'file:///C:/webs/a.html' });
    });

    test('maps a camera to its device id', () => {
        expect(
            planCanvasBackgroundDrop({
                type: DragTypeEnum.BACKGROUND_CAMERA,
                item: { src: 'device-1' },
            }),
        ).toEqual({ kind: 'camera', deviceId: 'device-1' });
    });

    test('maps a color, whose deserialized item IS the value', () => {
        expect(
            planCanvasBackgroundDrop({
                type: DragTypeEnum.BACKGROUND_COLOR,
                item: '#123456',
            }),
        ).toEqual({ kind: 'color', color: '#123456' });
    });

    test.each([
        DragTypeEnum.BIBLE_ITEM,
        DragTypeEnum.SLIDE,
        DragTypeEnum.APP_DOCUMENT,
        DragTypeEnum.FOREGROUND,
        DragTypeEnum.UNKNOWN,
    ])('refuses %s', (type) => {
        expect(planCanvasBackgroundDrop({ type, item: {} })).toBeNull();
    });
});

describe('checkIsCanvasBackgroundDropDataTransfer', () => {
    test('accepts a background drag by its advertised mime type', () => {
        expect(
            checkIsCanvasBackgroundDropDataTransfer({
                types: ['text/plain', 'application/x-owa-drag-bg-video'],
            } as any),
        ).toBe(true);
    });

    test('refuses an internal drag the canvas cannot use', () => {
        expect(
            checkIsCanvasBackgroundDropDataTransfer({
                types: ['text/plain', 'application/x-owa-drag-bibleitem'],
            } as any),
        ).toBe(false);
    });

    test('refuses an OS file drag and a missing data transfer', () => {
        expect(
            checkIsCanvasBackgroundDropDataTransfer({
                types: ['Files'],
            } as any),
        ).toBe(false);
        expect(checkIsCanvasBackgroundDropDataTransfer(null)).toBe(false);
    });

    test('covers every accepted type exactly once', () => {
        expect(canvasBackgroundDropMimeTypeSet.size).toBe(6);
    });
});

describe('applyCanvasBackgroundDropPlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('inserts a media item from its file path', async () => {
        const canvasController = genCanvasControllerMock();

        await applyCanvasBackgroundDropPlan(
            canvasController,
            { kind: 'media', filePath: 'C:\\videos\\a.mp4' },
            positionEvent,
            null,
        );

        expect(
            canvasController.genNewMediaItemFromFilePath,
        ).toHaveBeenCalledWith('C:\\videos\\a.mp4', positionEvent);
        expect(canvasController.addNewItems).toHaveBeenCalledWith([
            'media-item',
        ]);
    });

    test.each([
        ['youtube', 'genNewYouTubeItem', 'youtube-item'],
        ['website', 'genNewWebsiteItem', 'website-item'],
    ] as const)(
        'inserts a %s item from its url',
        async (kind, method, item) => {
            const canvasController = genCanvasControllerMock();

            await applyCanvasBackgroundDropPlan(
                canvasController,
                { kind, url: 'https://example.com' } as any,
                positionEvent,
                null,
            );

            expect(canvasController[method]).toHaveBeenCalledWith(
                'https://example.com',
                positionEvent,
            );
            expect(canvasController.addNewItems).toHaveBeenCalledWith([item]);
        },
    );

    test('resolves the camera label from the device list', async () => {
        const canvasController = genCanvasControllerMock();
        getAllCameraDevicesMock.mockResolvedValue([
            { deviceId: 'device-0', label: 'Other' },
            { deviceId: 'device-1', label: 'Stage Cam' },
        ]);

        await applyCanvasBackgroundDropPlan(
            canvasController,
            { kind: 'camera', deviceId: 'device-1' },
            positionEvent,
            null,
        );

        expect(canvasController.genNewCameraItem).toHaveBeenCalledWith(
            { deviceId: 'device-1', label: 'Stage Cam' },
            positionEvent,
        );
    });

    test('still inserts a camera whose label cannot be resolved', async () => {
        const canvasController = genCanvasControllerMock();
        getAllCameraDevicesMock.mockResolvedValue([]);

        await applyCanvasBackgroundDropPlan(
            canvasController,
            { kind: 'camera', deviceId: 'device-1' },
            positionEvent,
            null,
        );

        expect(canvasController.genNewCameraItem).toHaveBeenCalledWith(
            { deviceId: 'device-1', label: '' },
            positionEvent,
        );
        expect(canvasController.addNewItems).toHaveBeenCalledWith([
            'camera-item',
        ]);
    });

    test('recolors the box a color was dropped on', async () => {
        const canvasController = genCanvasControllerMock();

        await applyCanvasBackgroundDropPlan(
            canvasController,
            { kind: 'color', color: '#123456' as any },
            positionEvent,
            7,
        );

        expect(canvasController.editCanvasItemById).toHaveBeenCalledTimes(1);
        const [id, mutator] = canvasController.editCanvasItemById.mock.calls[0];
        expect(id).toBe(7);
        const canvasItem = { applyProps: vi.fn() };
        mutator(canvasItem);
        expect(canvasItem.applyProps).toHaveBeenCalledWith({
            backgroundColor: '#123456',
        });
        expect(canvasController.addNewItems).not.toHaveBeenCalled();
    });

    test('inserts a colored box when a color lands on bare canvas', async () => {
        const canvasController = genCanvasControllerMock();

        await applyCanvasBackgroundDropPlan(
            canvasController,
            { kind: 'color', color: '#123456' as any },
            positionEvent,
            null,
        );

        expect(canvasController.genNewColorBoxItem).toHaveBeenCalledWith(
            '#123456',
            positionEvent,
        );
        expect(canvasController.addNewItems).toHaveBeenCalledWith([
            'color-box-item',
        ]);
        expect(canvasController.editCanvasItemById).not.toHaveBeenCalled();
    });

    test('adds nothing when the item factory refuses', async () => {
        const canvasController = genCanvasControllerMock();
        canvasController.genNewWebsiteItem.mockReturnValue(undefined);

        await applyCanvasBackgroundDropPlan(
            canvasController,
            { kind: 'website', url: 'nope' },
            positionEvent,
            null,
        );

        expect(canvasController.addNewItems).not.toHaveBeenCalled();
    });
});
