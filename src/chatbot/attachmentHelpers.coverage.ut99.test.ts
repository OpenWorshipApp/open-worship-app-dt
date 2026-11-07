// @vitest-environment jsdom
// The picture half of `attachmentHelpers.ts`: what a picture is cut down to
// before a provider is billed for it, what goes onto the clipboard, and the
// few small rules the node suite (`attachmentHelpers.test.ts`) does not reach.
//
// jsdom for `document`, `FileReader` and `Blob`. jsdom draws nothing, so the
// canvas and `Image` are fakes this file owns: a canvas that records what it
// was asked to draw and hands back the data URL a test chose, and an `Image`
// that "decodes" to the size a test chose (or fails).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    type ChatAttachmentType,
    copyImageToClipboard,
    dropAttachmentData,
    findOpenFileAttachments,
    genElementAttachment,
    genImageAttachment,
    genTextAttachment,
    getAttachmentData,
    getAttachmentPages,
    normalizeImage,
    putAttachmentData,
    putAttachmentPages,
    toAttachedText,
    toAttachmentLegend,
    toImageMediaType,
} from './attachmentHelpers';

const h = vi.hoisted(() => {
    return {
        imageSize: null as { width: number; height: number } | null,
        imageSrcList: [] as string[],
    };
});

class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 0;
    height = 0;
    set src(value: string) {
        h.imageSrcList.push(value);
        queueMicrotask(() => {
            if (h.imageSize === null) {
                this.onerror?.();
                return;
            }
            this.width = h.imageSize.width;
            this.height = h.imageSize.height;
            this.onload?.();
        });
    }
}

class FakeClipboardItem {
    items: Record<string, Blob>;
    constructor(items: Record<string, Blob>) {
        this.items = items;
    }
}

const SMALL_PNG = 'data:image/png;base64,AAAA';
const heldIdList: string[] = [];
let originalImage: any;
let clipboardDescriptor: PropertyDescriptor | undefined;
const clipboardWrite = vi.fn();

function hold<T extends { id: string } | null>(attachment: T) {
    if (attachment !== null) {
        heldIdList.push(attachment.id);
    }
    return attachment;
}

// The canvas `normalizeImage` and the clipboard draw through.
function fakeCanvas(options?: {
    context?: any;
    toDataURL?: (type?: string, quality?: any) => string;
    blob?: Blob | null;
}) {
    const context =
        options && 'context' in options
            ? options.context
            : { drawImage: vi.fn() };
    const getContext = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(context);
    const toDataURL = vi
        .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
        .mockImplementation(
            options?.toDataURL ??
                ((type?: string) => {
                    return `data:${type ?? 'image/png'};base64,DRAWN`;
                }),
        );
    const toBlob = vi
        .spyOn(HTMLCanvasElement.prototype, 'toBlob')
        .mockImplementation((callback: BlobCallback) => {
            callback(options?.blob === undefined ? null : options.blob);
        });
    const created: HTMLCanvasElement[] = [];
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((
        tagName: string,
        elementOptions?: ElementCreationOptions,
    ) => {
        const element = originalCreate(tagName, elementOptions);
        if (tagName === 'canvas') {
            created.push(element as HTMLCanvasElement);
        }
        return element;
    }) as any);
    return { context, getContext, toDataURL, toBlob, created };
}

beforeEach(() => {
    originalImage = (globalThis as any).Image;
    (globalThis as any).Image = FakeImage;
    h.imageSize = { width: 300, height: 80 };
    h.imageSrcList = [];
    clipboardWrite.mockResolvedValue(undefined);
    clipboardDescriptor = Object.getOwnPropertyDescriptor(
        window.navigator,
        'clipboard',
    );
    Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: { write: clipboardWrite },
    });
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
});

afterEach(() => {
    (globalThis as any).Image = originalImage;
    if (clipboardDescriptor === undefined) {
        delete (window.navigator as any).clipboard;
    } else {
        Object.defineProperty(
            window.navigator,
            'clipboard',
            clipboardDescriptor,
        );
    }
    vi.unstubAllGlobals();
    for (const id of heldIdList.splice(0)) {
        dropAttachmentData(id);
    }
});

describe('putAttachmentPages', () => {
    it('lets go of what an id held when it is handed no pages', () => {
        putAttachmentPages('cov-pages', [SMALL_PNG, SMALL_PNG]);
        expect(getAttachmentPages('cov-pages')).toHaveLength(2);
        putAttachmentPages('cov-pages', []);
        expect(getAttachmentPages('cov-pages')).toEqual([]);
        expect(getAttachmentData('cov-pages')).toBeNull();
    });
});

describe('normalizeImage', () => {
    it('hands back a small PNG untouched, without a canvas', async () => {
        const canvas = fakeCanvas();
        expect(await normalizeImage(SMALL_PNG)).toEqual({
            dataUrl: SMALL_PNG,
            width: 300,
            height: 80,
            byteSize: 4,
        });
        expect(canvas.created).toHaveLength(0);
        expect(h.imageSrcList).toEqual([SMALL_PNG]);
    });

    it('reads a Blob into a data URL first, keeping its type', async () => {
        const blob = new Blob([new Uint8Array([1, 2, 3])], {
            type: 'image/jpeg',
        });
        const result = await normalizeImage(blob);
        expect(result?.dataUrl).toBe('data:image/jpeg;base64,AQID');
        expect(result?.byteSize).toBe(4);
    });

    it('is null when the file reader fails or reads no text', async () => {
        class FailingReader {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            result: unknown = null;
            readAsDataURL() {
                queueMicrotask(() => {
                    this.onerror?.();
                });
            }
        }
        vi.stubGlobal('FileReader', FailingReader);
        expect(await normalizeImage(new Blob(['x']))).toBeNull();

        class BufferReader {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            result: unknown = new ArrayBuffer(2);
            readAsDataURL() {
                queueMicrotask(() => {
                    this.onload?.();
                });
            }
        }
        vi.stubGlobal('FileReader', BufferReader);
        expect(await normalizeImage(new Blob(['x']))).toBeNull();
        // Nothing was decoded for either.
        expect(h.imageSrcList).toEqual([]);
    });

    it('is null for a picture that does not decode or has no size', async () => {
        h.imageSize = null;
        expect(await normalizeImage(SMALL_PNG)).toBeNull();
        h.imageSize = { width: 0, height: 40 };
        expect(await normalizeImage(SMALL_PNG)).toBeNull();
        h.imageSize = { width: 40, height: 0 };
        expect(await normalizeImage(SMALL_PNG)).toBeNull();
    });

    it('cuts a wide picture to 1024 on its long edge, as PNG', async () => {
        h.imageSize = { width: 2048, height: 1536 };
        const canvas = fakeCanvas({
            toDataURL: (type) => {
                return `data:${type};base64,${'A'.repeat(100)}`;
            },
        });
        const result = await normalizeImage(SMALL_PNG);
        expect(result).toEqual({
            dataUrl: `data:image/png;base64,${'A'.repeat(100)}`,
            width: 1024,
            height: 768,
            byteSize: 100,
        });
        expect(canvas.created).toHaveLength(1);
        expect(canvas.created[0].width).toBe(1024);
        expect(canvas.created[0].height).toBe(768);
        expect(canvas.getContext).toHaveBeenCalledWith('2d');
        expect(canvas.context.drawImage).toHaveBeenCalledWith(
            expect.any(FakeImage),
            0,
            0,
            1024,
            768,
        );
        expect(canvas.toDataURL).toHaveBeenCalledTimes(1);
        expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
    });

    it('cuts a tall one on its height, and never to less than a pixel', async () => {
        h.imageSize = { width: 500, height: 3000 };
        fakeCanvas();
        const tall = await normalizeImage(SMALL_PNG);
        expect(tall).toMatchObject({ width: 171, height: 1024 });

        h.imageSize = { width: 8000, height: 2 };
        const strip = await normalizeImage(SMALL_PNG);
        expect(strip).toMatchObject({ width: 1024, height: 1 });
    });

    it('falls back to JPEG at 0.85 when the PNG comes back photo-sized', async () => {
        h.imageSize = { width: 4000, height: 3000 };
        const bigPng = `data:image/png;base64,${'A'.repeat(900 * 1024 + 1)}`;
        const jpeg = `data:image/jpeg;base64,${'B'.repeat(5000)}`;
        const canvas = fakeCanvas({
            toDataURL: (type) => {
                return type === 'image/png' ? bigPng : jpeg;
            },
        });
        const result = await normalizeImage(SMALL_PNG);
        expect(result).toEqual({
            dataUrl: jpeg,
            width: 1024,
            height: 768,
            byteSize: 5000,
        });
        expect(canvas.toDataURL).toHaveBeenNthCalledWith(2, 'image/jpeg', 0.85);
    });

    it('keeps a PNG of exactly 900 KB as PNG', async () => {
        h.imageSize = { width: 2000, height: 1000 };
        const edgePng = `data:image/png;base64,${'A'.repeat(900 * 1024)}`;
        const canvas = fakeCanvas({
            toDataURL: () => {
                return edgePng;
            },
        });
        expect((await normalizeImage(SMALL_PNG))?.dataUrl).toBe(edgePng);
        expect(canvas.toDataURL).toHaveBeenCalledTimes(1);
    });

    it('redraws a small picture in a format a provider would refuse', async () => {
        h.imageSize = { width: 100, height: 50 };
        const canvas = fakeCanvas();
        const result = await normalizeImage('data:image/bmp;base64,Qk0=');
        expect(result).toEqual({
            dataUrl: 'data:image/png;base64,DRAWN',
            width: 100,
            height: 50,
            byteSize: 5,
        });
        expect(canvas.context.drawImage).toHaveBeenCalledWith(
            expect.any(FakeImage),
            0,
            0,
            100,
            50,
        );
    });

    it('is null when the canvas gives no 2d context', async () => {
        h.imageSize = { width: 3000, height: 2000 };
        const canvas = fakeCanvas({ context: null });
        expect(await normalizeImage(SMALL_PNG)).toBeNull();
        expect(canvas.toDataURL).not.toHaveBeenCalled();
    });
});

describe('copyImageToClipboard', () => {
    function stubFetch(blob: Blob) {
        const fetchMock = vi.fn(async () => {
            return { blob: async () => blob };
        });
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    it('puts a PNG on the clipboard as it is', async () => {
        const png = new Blob(['png'], { type: 'image/png' });
        const fetchMock = stubFetch(png);
        const canvas = fakeCanvas();
        await copyImageToClipboard(SMALL_PNG);
        expect(fetchMock).toHaveBeenCalledWith(SMALL_PNG);
        expect(clipboardWrite).toHaveBeenCalledTimes(1);
        const [items] = clipboardWrite.mock.calls[0];
        expect(items).toHaveLength(1);
        expect(items[0]).toBeInstanceOf(FakeClipboardItem);
        expect(items[0].items).toEqual({ 'image/png': png });
        expect(canvas.created).toHaveLength(0);
    });

    it('redraws anything else as a PNG first: the clipboard takes no JPEG', async () => {
        h.imageSize = { width: 640, height: 480 };
        const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' });
        const redrawn = new Blob(['redrawn'], { type: 'image/png' });
        stubFetch(jpeg);
        const canvas = fakeCanvas({ blob: redrawn });
        await copyImageToClipboard('data:image/jpeg;base64,BBBB');
        expect(canvas.created[0].width).toBe(640);
        expect(canvas.created[0].height).toBe(480);
        expect(canvas.context.drawImage).toHaveBeenCalledWith(
            expect.any(FakeImage),
            0,
            0,
        );
        expect(canvas.toBlob).toHaveBeenCalledWith(
            expect.any(Function),
            'image/png',
        );
        expect(clipboardWrite.mock.calls[0][0][0].items).toEqual({
            'image/png': redrawn,
        });
    });

    it('says so, in words, when the picture cannot be read', async () => {
        stubFetch(new Blob(['jpeg'], { type: 'image/jpeg' }));
        h.imageSize = null;
        await expect(
            copyImageToClipboard('data:image/jpeg;base64,BBBB'),
        ).rejects.toThrow('the picture could not be read');
        h.imageSize = { width: 0, height: 0 };
        await expect(
            copyImageToClipboard('data:image/jpeg;base64,BBBB'),
        ).rejects.toThrow('the picture could not be read');
        expect(clipboardWrite).not.toHaveBeenCalled();
    });

    it('says so when it cannot be redrawn for want of a context', async () => {
        stubFetch(new Blob(['webp'], { type: 'image/webp' }));
        h.imageSize = { width: 10, height: 10 };
        const canvas = fakeCanvas({ context: null });
        await expect(
            copyImageToClipboard('data:image/webp;base64,CCCC'),
        ).rejects.toThrow('the picture could not be redrawn');
        expect(canvas.toBlob).not.toHaveBeenCalled();
        expect(clipboardWrite).not.toHaveBeenCalled();
    });

    it('says so when the redraw hands back no PNG', async () => {
        stubFetch(new Blob(['webp'], { type: 'image/webp' }));
        h.imageSize = { width: 10, height: 10 };
        const canvas = fakeCanvas({ blob: null });
        await expect(
            copyImageToClipboard('data:image/webp;base64,CCCC'),
        ).rejects.toThrow('the picture could not be redrawn');
        expect(canvas.toBlob).toHaveBeenCalledTimes(1);
        expect(clipboardWrite).not.toHaveBeenCalled();
    });
});

describe('genImageAttachment', () => {
    it('is null for a picture that cannot be drawn, and holds nothing', async () => {
        h.imageSize = null;
        expect(await genImageAttachment(SMALL_PNG, 'broken.png')).toBeNull();
    });

    it('holds the cut picture and names where it came from', async () => {
        const window = {
            id: 'T9',
            page: 'setting.html?uuid=setting',
            label: 'Settings',
            isMain: false,
        };
        const attachment = hold(
            await genImageAttachment(
                SMALL_PNG,
                'shot.png',
                '/pics/shot.png',
                window,
            ),
        );
        expect(attachment).toMatchObject({
            kind: 'image',
            name: 'shot.png',
            mimeType: 'image/png',
            byteSize: 4,
            filePath: '/pics/shot.png',
            window,
        });
        expect(getAttachmentData(attachment!.id)).toBe(SMALL_PNG);
    });

    it('leaves out a path and a window it was not given, typed by its bytes', async () => {
        const attachment = hold(
            await genImageAttachment('data:image/jpeg;base64,ZZZZ', 'paste'),
        );
        expect(attachment).not.toBeNull();
        expect(attachment!.mimeType).toBe('image/jpeg');
        expect('filePath' in attachment!).toBe(false);
        expect('window' in attachment!).toBe(false);
    });
});

describe('toImageMediaType', () => {
    it('types a picture by its name, and refuses what is not one', () => {
        expect(toImageMediaType('photo.JPG')).toBe('image/jpeg');
        expect(toImageMediaType('scan.jpeg')).toBe('image/jpeg');
        expect(toImageMediaType('logo.PNG')).toBe('image/png');
        expect(toImageMediaType('anim.webp')).toBe('image/webp');
        expect(toImageMediaType('old.bmp')).toBe('image/bmp');
        expect(toImageMediaType('vector.svg')).toBeNull();
        expect(toImageMediaType('notes.txt')).toBeNull();
    });
});

describe('toAttachedText', () => {
    it("gives back a text file's own words without the model's header", () => {
        const attachment = genTextAttachment('order.md', '1. Welcome\n2. Song');
        expect(attachment.summary?.startsWith('The user attached')).toBe(true);
        expect(toAttachedText(attachment)).toBe('1. Welcome\n2. Song');
    });

    it("gives an element's lines as they are, and nothing for no summary", () => {
        const element = genElementAttachment({ label: 'Clear All' });
        expect(toAttachedText(element)).toBe(element.summary);
        const bare: ChatAttachmentType = {
            id: 'bare',
            kind: 'text',
            name: 'x.txt',
            mimeType: 'text/plain',
            byteSize: 0,
        };
        expect(toAttachedText(bare)).toBe('');
    });
});

describe('genElementAttachment, a control that is not on show', () => {
    it('says it only shows under the mouse, or that it is not on screen', () => {
        const hovered = genElementAttachment({
            label: 'Lock',
            isVisible: false,
            showsOnHover: true,
        });
        expect(hovered.summary).toContain(
            '- it only shows while the mouse is over that part of the window',
        );
        expect(hovered.summary).not.toContain('not on screen');

        const hidden = genElementAttachment({
            label: 'Lock',
            isVisible: false,
        });
        expect(hidden.summary).toContain('- it is not on screen at the moment');
        expect(hidden.summary).not.toContain('mouse is over');
    });
});

describe('findOpenFileAttachments', () => {
    it('is empty when no question of the tab had a file on it', () => {
        expect(
            findOpenFileAttachments([
                { id: 1, author: 'you' },
                {
                    id: 2,
                    author: 'bot',
                    attachments: [
                        {
                            id: 'answered',
                            kind: 'text',
                            name: 'song.lyric',
                            mimeType: 'text/plain',
                            byteSize: 1,
                            filePath: '/songs/song.lyric',
                        },
                    ],
                },
                {
                    id: 3,
                    author: 'you',
                    attachments: [genElementAttachment({ label: 'Lock' })],
                },
            ]),
        ).toEqual([]);
    });
});

describe('toAttachmentLegend, a PDF of one page', () => {
    it('counts its one page among the pictures', () => {
        putAttachmentData('legend-pic', SMALL_PNG);
        putAttachmentPages('legend-pdf', [SMALL_PNG]);
        heldIdList.push('legend-pic', 'legend-pdf');
        const legend = toAttachmentLegend([
            {
                id: 'legend-pic',
                kind: 'image',
                name: 'a.png',
                mimeType: 'image/png',
                byteSize: 4,
                number: 1,
            },
            {
                id: 'legend-pdf',
                kind: 'file',
                name: 'one.pdf',
                mimeType: 'application/pdf',
                byteSize: 9,
                filePath: '/one.pdf',
                number: 2,
            },
        ]);
        expect(legend.split('\n').slice(1)).toEqual([
            '[1] a picture called "a.png" -- the 1st picture attached here',
            '[2] the file "one.pdf" -- its page is the 2nd picture attached here',
        ]);
    });
});
