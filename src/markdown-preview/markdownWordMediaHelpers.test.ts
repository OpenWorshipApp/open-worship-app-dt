import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    readBytes: vi.fn(),
    getSize: vi.fn(),
}));

vi.mock('../server/fileHelpers', () => ({
    fsReadFileBytes: h.readBytes,
    fsGetFileSize: h.getSize,
}));

import {
    loadWordPicture,
    readWordReadyPicture,
} from './markdownWordMediaHelpers';

function genPng(width: number, height: number) {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
}

// A JPEG of an APP1 EXIF block naming `orientation`, then a frame header.
function genJpeg(width: number, height: number, orientation: number | null) {
    const partList: number[] = [0xff, 0xd8];
    if (orientation !== null) {
        const tiff = [
            0x4d,
            0x4d,
            0x00,
            0x2a,
            0x00,
            0x00,
            0x00,
            0x08,
            // one IFD entry: 0x0112 (orientation), SHORT, 1, value
            0x00,
            0x01,
            0x01,
            0x12,
            0x00,
            0x03,
            0x00,
            0x00,
            0x00,
            0x01,
            0x00,
            orientation,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
        ];
        const app1 = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
        const length = app1.length + 2;
        partList.push(0xff, 0xe1, length >> 8, length & 0xff, ...app1);
    }
    partList.push(
        0xff,
        0xc0,
        0x00,
        0x11,
        0x08,
        height >> 8,
        height & 0xff,
        width >> 8,
        width & 0xff,
        0x03,
        0x01,
        0x22,
        0x00,
        0x02,
        0x11,
        0x01,
        0x03,
        0x11,
        0x01,
    );
    partList.push(0xff, 0xd9);
    return new Uint8Array(partList);
}

describe('readWordReadyPicture', () => {
    it('reads the size of a PNG, a JPEG, a GIF and a BMP from its header', () => {
        expect(readWordReadyPicture(genPng(640, 480))).toEqual(
            expect.objectContaining({
                extension: 'png',
                width: 640,
                height: 480,
            }),
        );
        expect(readWordReadyPicture(genJpeg(1024, 768, null))).toEqual(
            expect.objectContaining({
                extension: 'jpeg',
                width: 1024,
                height: 768,
            }),
        );
        expect(readWordReadyPicture(genJpeg(10, 20, 1))).toEqual(
            expect.objectContaining({ width: 10, height: 20 }),
        );
        const gif = new Uint8Array(13);
        gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 30, 0, 2, 1]);
        expect(readWordReadyPicture(gif)).toEqual(
            expect.objectContaining({
                extension: 'gif',
                width: 30,
                height: 258,
            }),
        );
        const bmp = new Uint8Array(54);
        bmp.set([0x42, 0x4d]);
        const bmpView = new DataView(bmp.buffer);
        bmpView.setInt32(18, 12, true);
        // A top-down bitmap names its height negative.
        bmpView.setInt32(22, -34, true);
        expect(readWordReadyPicture(bmp)).toEqual(
            expect.objectContaining({
                extension: 'bmp',
                width: 12,
                height: 34,
            }),
        );
    });

    it('leaves a photo the camera turned, and any other picture, to be drawn', () => {
        expect(readWordReadyPicture(genJpeg(10, 20, 6))).toBeNull();
        const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
        expect(readWordReadyPicture(webp)).toBeNull();
        expect(readWordReadyPicture(new Uint8Array())).toBeNull();
    });
});

describe('loadWordPicture', () => {
    const context = {
        maxBox: { width: 600, height: 800 },
        svgFontCss: '',
    };

    beforeEach(() => {
        h.readBytes.mockReset();
        h.getSize.mockReset().mockResolvedValue(100);
    });

    it('reads a picture beside the file as it is, at the width the page gave it', async () => {
        h.readBytes.mockResolvedValue(genPng(1000, 500));
        const loaded = await loadWordPicture(
            { kind: 'src', src: 'file:///notes/My%20Map.png', width: 400 },
            context,
        );
        expect(h.readBytes).toHaveBeenCalledWith('/notes/My Map.png');
        expect(loaded).toEqual(
            expect.objectContaining({
                extension: 'png',
                width: 400,
                height: 200,
            }),
        );
    });

    it('fits a large picture between the margins', async () => {
        h.readBytes.mockResolvedValue(genPng(1200, 300));
        const loaded = await loadWordPicture(
            { kind: 'src', src: 'file:///notes/wide.png', width: null },
            context,
        );
        expect(loaded).toEqual(
            expect.objectContaining({ width: 600, height: 150 }),
        );
    });

    it('leaves out a picture too large, or one that cannot be read', async () => {
        h.getSize.mockResolvedValue(64 * 1024 * 1024);
        expect(
            await loadWordPicture(
                { kind: 'src', src: 'file:///notes/huge.png', width: null },
                context,
            ),
        ).toBeNull();
        expect(h.readBytes).not.toHaveBeenCalled();

        h.getSize.mockRejectedValue(new Error('gone'));
        expect(
            await loadWordPicture(
                { kind: 'src', src: 'file:///notes/gone.png', width: null },
                context,
            ),
        ).toBeNull();
        expect(
            await loadWordPicture(
                { kind: 'src', src: 'not a url', width: null },
                context,
            ),
        ).toBeNull();
    });

    it('takes a picture from the web, and leaves out one the site refuses', async () => {
        const fetchMock = vi.fn(async () => {
            return new Response(genPng(20, 10), { status: 200 });
        });
        vi.stubGlobal('fetch', fetchMock);
        try {
            expect(
                await loadWordPicture(
                    {
                        kind: 'src',
                        src: 'https://example.org/a.png',
                        width: null,
                    },
                    context,
                ),
            ).toEqual(expect.objectContaining({ width: 20, height: 10 }));
            fetchMock.mockImplementationOnce(async () => {
                return new Response('no', { status: 403 });
            });
            expect(
                await loadWordPicture(
                    {
                        kind: 'src',
                        src: 'https://example.org/b.png',
                        width: null,
                    },
                    context,
                ),
            ).toBeNull();
            fetchMock.mockImplementationOnce(async () => {
                throw new TypeError('Failed to fetch');
            });
            expect(
                await loadWordPicture(
                    {
                        kind: 'src',
                        src: 'https://example.org/c.png',
                        width: null,
                    },
                    context,
                ),
            ).toBeNull();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
