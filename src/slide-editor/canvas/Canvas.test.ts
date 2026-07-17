// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    bibleFromJsonMock,
    errorFromJsonErrorMock,
    htmlFromJsonMock,
    imageFromJsonMock,
    navigatorClipboard,
    textFromJsonMock,
    videoFromJsonMock,
    youtubeFromJsonMock,
    websiteFromJsonMock,
} = vi.hoisted(() => ({
    bibleFromJsonMock: vi.fn(),
    errorFromJsonErrorMock: vi.fn(),
    htmlFromJsonMock: vi.fn(),
    imageFromJsonMock: vi.fn(),
    navigatorClipboard: {
        read: vi.fn(),
        writeText: vi.fn(),
    },
    textFromJsonMock: vi.fn(),
    videoFromJsonMock: vi.fn(),
    youtubeFromJsonMock: vi.fn(),
    websiteFromJsonMock: vi.fn(),
}));

vi.mock('../../helper/helpers', () => ({
    toMaxId: (ids: number[]) => {
        return ids.length === 0 ? 0 : Math.max(...ids);
    },
}));

vi.mock('./CanvasItem', () => ({
    CanvasItemError: {
        fromJsonError: errorFromJsonErrorMock,
    },
}));

vi.mock('./CanvasItemBibleItem', () => ({
    default: {
        fromJson: bibleFromJsonMock,
    },
}));

vi.mock('./CanvasItemHtml', () => ({
    default: {
        fromJson: htmlFromJsonMock,
    },
}));

vi.mock('./CanvasItemImage', () => ({
    default: {
        fromJson: imageFromJsonMock,
    },
}));

vi.mock('./CanvasItemText', () => ({
    default: {
        fromJson: textFromJsonMock,
    },
}));

vi.mock('./CanvasItemVideo', () => ({
    default: {
        fromJson: videoFromJsonMock,
    },
}));

vi.mock('./CanvasItemYouTube', () => ({
    default: {
        fromJson: youtubeFromJsonMock,
    },
}));

vi.mock('./CanvasItemWebsite', () => ({
    default: {
        fromJson: websiteFromJsonMock,
    },
}));

import Canvas from './Canvas';

function createClipboardItem(text: string, types = ['text/plain']) {
    return {
        types,
        getType: vi.fn(async () => ({
            text: async () => text,
        })),
    };
}

describe('Canvas', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: navigatorClipboard,
        });
        imageFromJsonMock.mockImplementation((json: any) => ({
            ...json,
            type: 'image',
        }));
        videoFromJsonMock.mockImplementation((json: any) => ({
            ...json,
            type: 'video',
        }));
        youtubeFromJsonMock.mockImplementation((json: any) => ({
            ...json,
            type: 'youtube',
        }));
        websiteFromJsonMock.mockImplementation((json: any) => ({
            ...json,
            type: 'website',
        }));
        htmlFromJsonMock.mockImplementation((json: any) => ({
            ...json,
            type: 'html',
        }));
        textFromJsonMock.mockImplementation((json: any) => ({
            ...json,
            type: json.type,
        }));
        bibleFromJsonMock.mockImplementation((json: any) => ({
            ...json,
            type: 'bible',
        }));
        errorFromJsonErrorMock.mockImplementation((json: any) => ({
            ...json,
            type: 'error',
        }));
    });

    test('maps slide items, filters nulls, and proxies slide dimensions and serialization', () => {
        expect(
            new Canvas({ width: 640, height: 360, canvasItemsJson: [] } as any)
                .maxItemId,
        ).toBe(0);

        const slide = {
            width: 1024,
            height: 768,
            canvasItemsJson: [{ id: 1 }, { id: 2 }, { id: 8 }],
        };
        const canvasItemFromJsonSpy = vi
            .spyOn(Canvas, 'canvasItemFromJson')
            .mockImplementation((json: any) => {
                if (json.id === 2) {
                    return null as any;
                }
                return { id: json.id, type: 'text' } as any;
            });
        const canvas = new Canvas(slide as any);

        expect(canvas.width).toBe(1024);
        expect(canvas.height).toBe(768);
        expect(canvas.canvasItems).toEqual([
            { id: 1, type: 'text' },
            { id: 8, type: 'text' },
        ]);
        expect(canvas.maxItemId).toBe(8);

        const nextItems = [
            { toJson: vi.fn(() => ({ id: 5, type: 'image' })) },
            { toJson: vi.fn(() => ({ id: 9, type: 'text' })) },
        ];

        canvas.canvasItems = nextItems as any;

        expect(slide.canvasItemsJson).toEqual([
            { id: 5, type: 'image' },
            { id: 9, type: 'text' },
        ]);
        canvasItemFromJsonSpy.mockRestore();
    });

    test('dispatches canvas item creation to the correct factory', () => {
        expect(Canvas.canvasItemFromJson({ type: 'image', id: 1 })).toEqual({
            type: 'image',
            id: 1,
        });
        expect(Canvas.canvasItemFromJson({ type: 'video', id: 2 })).toEqual({
            type: 'video',
            id: 2,
        });
        expect(Canvas.canvasItemFromJson({ type: 'youtube', id: 7 })).toEqual({
            type: 'youtube',
            id: 7,
        });
        expect(Canvas.canvasItemFromJson({ type: 'website', id: 8 })).toEqual({
            type: 'website',
            id: 8,
        });
        expect(Canvas.canvasItemFromJson({ type: 'text', id: 3 })).toEqual({
            type: 'text',
            id: 3,
        });
        expect(Canvas.canvasItemFromJson({ type: 'html', id: 4 })).toEqual({
            type: 'html',
            id: 4,
        });
        expect(Canvas.canvasItemFromJson({ type: 'bible', id: 5 })).toEqual({
            type: 'bible',
            id: 5,
        });
        expect(Canvas.canvasItemFromJson({ type: 'unknown', id: 6 })).toEqual({
            type: 'error',
            id: 6,
        });
    });

    test('deserializes clipboard JSON and ignores empty, invalid, and error items', () => {
        expect(Canvas.clipboardDeserializeCanvasItem('')).toBeNull();
        expect(
            Canvas.clipboardDeserializeCanvasItem('{"type":"text","id":1}'),
        ).toEqual({ type: 'text', id: 1 });

        errorFromJsonErrorMock.mockReturnValueOnce({ type: 'error', id: 7 });
        expect(
            Canvas.clipboardDeserializeCanvasItem('{"type":"unknown","id":7}'),
        ).toBeNull();
        expect(Canvas.clipboardDeserializeCanvasItem('{bad-json')).toBeNull();
    });

    test('reads copied canvas items from the clipboard and writes serialized items back', async () => {
        navigatorClipboard.read.mockResolvedValue([
            createClipboardItem(
                '{"type":"text","id":1}\n{"type":"unknown","id":2}\n{bad-json',
            ),
            createClipboardItem('ignored-image-data', ['image/png']),
        ]);
        errorFromJsonErrorMock.mockReturnValueOnce({ type: 'error', id: 2 });

        expect(await Canvas.getCopiedCanvasItems()).toEqual([
            { type: 'text', id: 1 },
        ]);

        Canvas.setCopiedItems([
            { clipboardSerialize: vi.fn(() => '{"type":"text","id":1}') },
            { clipboardSerialize: vi.fn(() => '{"type":"image","id":2}') },
        ] as any);

        expect(navigatorClipboard.writeText).toHaveBeenCalledWith(
            '{"type":"text","id":1}\n{"type":"image","id":2}',
        );
    });
});
