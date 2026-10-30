// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The picture half of `attachmentHelpers`: a picture cut to what is worth
// sending, and a picture put on the clipboard. jsdom loads no picture and
// draws no canvas, so `Image` is a stand-in whose size each test says, the
// canvas hands back what each test says it drew, and the clipboard records
// what it was given.
const { drawState } = vi.hoisted(() => ({
    drawState: {
        // The size the stand-in `Image` loads at; null fails to load.
        imageSize: { width: 2048, height: 1024 } as null | {
            width: number;
            height: number;
        },
        hasContext: true,
        pngDataUrl: 'data:image/png;base64,UE5H',
        isBlobNull: false,
        drawnList: [] as { width: number; height: number }[],
        dataUrlTypeList: [] as string[],
        clipboardList: [] as any[],
    },
}));

import {
    copyImageToClipboard,
    dropAttachmentData,
    genImageAttachment,
    getAttachmentData,
    normalizeImage,
} from './attachmentHelpers';

class FakeImage {
    width = 0;
    height = 0;
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(_value: string) {
        queueMicrotask(() => {
            if (drawState.imageSize === null) {
                this.onerror?.();
                return;
            }
            this.width = drawState.imageSize.width;
            this.height = drawState.imageSize.height;
            this.onload?.();
        });
    }
}

class FakeClipboardItem {
    constructor(public items: Record<string, Blob>) {}
}

function genFakeCanvas() {
    const canvas = {
        width: 0,
        height: 0,
        getContext: () => {
            if (!drawState.hasContext) {
                return null;
            }
            return {
                drawImage: () => {
                    drawState.drawnList.push({
                        width: canvas.width,
                        height: canvas.height,
                    });
                },
            };
        },
        toDataURL: (type: string) => {
            drawState.dataUrlTypeList.push(type);
            return type === 'image/png'
                ? drawState.pngDataUrl
                : 'data:image/jpeg;base64,SlBFRw==';
        },
        toBlob: (resolve: (blob: Blob | null) => void, type: string) => {
            resolve(drawState.isBlobNull ? null : new Blob(['png'], { type }));
        },
    };
    return canvas;
}

const realCreateElement = document.createElement.bind(document);

beforeEach(() => {
    drawState.imageSize = { width: 2048, height: 1024 };
    drawState.hasContext = true;
    drawState.pngDataUrl = 'data:image/png;base64,UE5H';
    drawState.isBlobNull = false;
    drawState.drawnList = [];
    drawState.dataUrlTypeList = [];
    drawState.clipboardList = [];
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    vi.spyOn(document, 'createElement').mockImplementation(
        (tagName: string, options?: any) => {
            return tagName === 'canvas'
                ? (genFakeCanvas() as any)
                : realCreateElement(tagName, options);
        },
    );
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            write: async (items: any[]) => {
                drawState.clipboardList.push(...items);
            },
        },
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('normalizeImage', () => {
    test('a picture past the long edge is drawn down to it, as a PNG', async () => {
        const normalized = await normalizeImage('data:image/png;base64,QUFB');
        expect(drawState.drawnList).toEqual([{ width: 1024, height: 512 }]);
        expect(normalized).toEqual({
            dataUrl: 'data:image/png;base64,UE5H',
            width: 1024,
            height: 512,
            // The size HELD: the base64 the window keeps, not the bytes.
            byteSize: 4,
        });
        expect(drawState.dataUrlTypeList).toEqual(['image/png']);
    });

    test('a PNG that comes back photo-sized is sent as a JPEG', async () => {
        // 1.2 MB of base64 is ~900 KB of bytes and more.
        drawState.pngDataUrl = `data:image/png;base64,${'A'.repeat(1300000)}`;
        const normalized = await normalizeImage('data:image/bmp;base64,QUFB');
        expect(drawState.dataUrlTypeList).toEqual(['image/png', 'image/jpeg']);
        expect(normalized?.dataUrl).toBe('data:image/jpeg;base64,SlBFRw==');
    });

    test('a kind not every provider takes is redrawn even when small', async () => {
        drawState.imageSize = { width: 10, height: 30 };
        const normalized = await normalizeImage('data:image/bmp;base64,QUFB');
        expect(drawState.drawnList).toEqual([{ width: 10, height: 30 }]);
        expect(normalized?.width).toBe(10);
    });

    test('a picture that will not load, has no size or no canvas is nothing', async () => {
        drawState.imageSize = null;
        expect(await normalizeImage('data:image/png;base64,QUFB')).toBeNull();
        drawState.imageSize = { width: 0, height: 10 };
        expect(await normalizeImage('data:image/png;base64,QUFB')).toBeNull();
        drawState.imageSize = { width: 4000, height: 10 };
        drawState.hasContext = false;
        expect(await normalizeImage('data:image/png;base64,QUFB')).toBeNull();
    });

    test('a blob that cannot be read is nothing', async () => {
        class FailingReader {
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;
            result: unknown = null;
            readAsDataURL() {
                queueMicrotask(() => {
                    this.onerror?.();
                });
            }
        }
        vi.stubGlobal('FileReader', FailingReader);
        expect(
            await normalizeImage(new Blob(['x'], { type: 'image/png' })),
        ).toBeNull();

        class OddReader extends FailingReader {
            readAsDataURL() {
                queueMicrotask(() => {
                    this.result = new ArrayBuffer(2);
                    this.onload?.();
                });
            }
        }
        vi.stubGlobal('FileReader', OddReader);
        expect(
            await normalizeImage(new Blob(['x'], { type: 'image/png' })),
        ).toBeNull();
    });

    test('a picture attachment holds the drawn bytes and says what it is', async () => {
        const attachment = await genImageAttachment(
            'data:image/png;base64,QUFB',
            'my screen',
            undefined,
            {
                id: 'T-1',
                page: 'presenter.html',
                label: 'Presenter',
                isMain: true,
            },
        );
        expect(attachment).toMatchObject({
            kind: 'image',
            name: 'my screen',
            mimeType: 'image/png',
            byteSize: 4,
            window: { id: 'T-1', isMain: true },
        });
        expect(attachment?.filePath).toBeUndefined();
        expect(getAttachmentData(attachment!.id)).toBe(
            'data:image/png;base64,UE5H',
        );
        dropAttachmentData(attachment!.id);

        drawState.imageSize = null;
        expect(
            await genImageAttachment('data:image/png;base64,QUFB', 'x'),
        ).toBeNull();
    });
});

describe('copyImageToClipboard', () => {
    function useFetchedType(type: string) {
        vi.stubGlobal('fetch', async () => {
            return {
                blob: async () => {
                    return new Blob(['bytes'], { type });
                },
            };
        });
    }

    test('a PNG goes onto the clipboard as it is', async () => {
        useFetchedType('image/png');
        await copyImageToClipboard('data:image/png;base64,QUFB');
        expect(drawState.drawnList).toEqual([]);
        expect(drawState.clipboardList).toHaveLength(1);
        expect(drawState.clipboardList[0].items['image/png'].type).toBe(
            'image/png',
        );
    });

    test('any other kind is redrawn as a PNG first', async () => {
        useFetchedType('image/jpeg');
        drawState.imageSize = { width: 30, height: 20 };
        await copyImageToClipboard('data:image/jpeg;base64,QUFB');
        expect(drawState.drawnList).toEqual([{ width: 30, height: 20 }]);
        expect(drawState.clipboardList[0].items['image/png'].type).toBe(
            'image/png',
        );
    });

    test('a picture that cannot be read or redrawn throws a sentence', async () => {
        useFetchedType('image/jpeg');
        drawState.imageSize = null;
        await expect(
            copyImageToClipboard('data:image/jpeg;base64,QUFB'),
        ).rejects.toThrow('the picture could not be read');

        drawState.imageSize = { width: 30, height: 20 };
        drawState.hasContext = false;
        await expect(
            copyImageToClipboard('data:image/jpeg;base64,QUFB'),
        ).rejects.toThrow('the picture could not be redrawn');

        drawState.hasContext = true;
        drawState.isBlobNull = true;
        await expect(
            copyImageToClipboard('data:image/jpeg;base64,QUFB'),
        ).rejects.toThrow('the picture could not be redrawn');
        expect(drawState.clipboardList).toEqual([]);
    });
});
