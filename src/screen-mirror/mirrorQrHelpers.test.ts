// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    decode: vi.fn(),
    close: vi.fn(),
    canvases: [] as Array<{ width: number; height: number }>,
    contextAvailable: true,
    bitmap: { width: 4800, height: 2400 },
}));
vi.mock('jsqr', () => ({ default: h.decode }));

import { findImageFile, readQrTextFromImage } from './mirrorQrHelpers';

beforeEach(() => {
    h.decode.mockReset();
    h.close.mockClear();
    h.canvases.length = 0;
    h.contextAvailable = true;
    h.bitmap = { width: 4800, height: 2400 };
    vi.stubGlobal(
        'createImageBitmap',
        vi.fn(async () => ({ ...h.bitmap, close: h.close })),
    );
    vi.stubGlobal(
        'OffscreenCanvas',
        class {
            width: number;
            height: number;
            constructor(width: number, height: number) {
                this.width = width;
                this.height = height;
                h.canvases.push({ width, height });
            }
            getContext() {
                return h.contextAvailable
                    ? {
                          drawImage: vi.fn(),
                          getImageData: () => ({
                              data: new Uint8ClampedArray(4),
                          }),
                      }
                    : null;
            }
        },
    );
});
afterEach(() => vi.unstubAllGlobals());

test('rejects non-images and oversized files without loading the decoder', async () => {
    expect(
        await readQrTextFromImage(new Blob(['text'], { type: 'text/plain' })),
    ).toBeNull();
    expect(
        await readQrTextFromImage({
            type: 'image/png',
            size: 30 * 1024 * 1024 + 1,
        } as Blob),
    ).toBeNull();
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(h.decode).not.toHaveBeenCalled();
});

test('retries a large image at higher resolution and closes its bitmap', async () => {
    h.decode
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ data: 'host.example:39240' });
    const result = await readQrTextFromImage(
        new Blob(['png'], { type: 'image/png' }),
    );
    expect(result).toBe('host.example:39240');
    expect(h.canvases).toEqual([
        { width: 1200, height: 600 },
        { width: 2400, height: 1200 },
    ]);
    expect(h.decode).toHaveBeenCalledTimes(2);
    expect(h.close).toHaveBeenCalledTimes(1);
});

test('small images are decoded only once and an absent QR returns null', async () => {
    h.bitmap = { width: 600, height: 300 };
    h.decode.mockReturnValue(null);
    expect(
        await readQrTextFromImage(new Blob(['png'], { type: 'image/png' })),
    ).toBeNull();
    expect(h.canvases).toEqual([{ width: 600, height: 300 }]);
    expect(h.decode).toHaveBeenCalledTimes(1);
    expect(h.close).toHaveBeenCalledTimes(1);
});

test('a missing canvas context still closes the bitmap', async () => {
    h.contextAvailable = false;
    expect(
        await readQrTextFromImage(new Blob(['png'], { type: 'image/png' })),
    ).toBeNull();
    expect(h.decode).not.toHaveBeenCalled();
    expect(h.close).toHaveBeenCalledTimes(1);
});

test('selects the first image file from transfer items', () => {
    const image = new File(['png'], 'host.png', { type: 'image/png' });
    const items = [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: 'application/pdf', getAsFile: () => null },
        { kind: 'file', type: 'image/png', getAsFile: () => image },
    ];
    expect(findImageFile(items as unknown as DataTransferItemList)).toBe(image);
    expect(findImageFile(undefined)).toBeNull();
});
