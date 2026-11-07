// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks, decoded } = vi.hoisted(() => ({
    mocks: {
        electronSendAsync: vi.fn(),
        fsCheckDirExist: vi.fn(),
        fsCreateDir: vi.fn(),
        fsDeleteDir: vi.fn(),
        fsListFiles: vi.fn(),
        openSync: vi.fn(),
        readSync: vi.fn(),
        closeSync: vi.fn(),
    },
    // The decode fallback: which sources were decoded, and how each answers.
    decoded: {
        sources: [] as string[],
        sizeOf: (_src: string): { width: number; height: number } | null =>
            null,
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: () => {} }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: () => {},
    hideProgressBar: () => {},
}));
vi.mock('./pdfConversionProgress', () => ({
    startPdfConversion: () => false,
    updatePdfConversion: () => {},
    finishPdfConversion: () => false,
}));
vi.mock('../server/appHelpers', () => ({
    electronSendAsync: mocks.electronSendAsync,
}));
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        pathUtils: { resolve: (...parts: string[]) => parts.join('/') },
        fileUtils: {
            openSync: mocks.openSync,
            readSync: mocks.readSync,
            closeSync: mocks.closeSync,
        },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: mocks.fsCheckDirExist,
    fsCreateDir: mocks.fsCreateDir,
    fsDeleteDir: mocks.fsDeleteDir,
    fsListFiles: mocks.fsListFiles,
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => {
            const fullName = filePath.split('/').at(-1) ?? '';
            return {
                baseDirPath: filePath.split('/').slice(0, -1).join('/'),
                fullName,
                name: fullName.replace(/\.[^.]+$/, ''),
                src: `asset://${fullName}`,
            };
        },
    },
}));
vi.mock('./loggerHelpers', () => ({
    appError: () => {},
    appWarning: () => {},
}));

import { genPdfImagesPreview } from './pdfHelpers';

const OUT_DIR = '/docs/sermon.pdf-images';

function genPngHeader(width: number, height: number) {
    const buffer = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
    buffer.writeUInt32BE(13, 8);
    buffer.write('IHDR', 12, 'latin1');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
}

// Each file path answers its own header; a header shorter than 24 bytes is
// what a truncated file reads.
function serveHeaders(headers: Record<string, Buffer>) {
    const descriptors: string[] = [];
    mocks.openSync.mockImplementation((filePath: string) => {
        if (headers[filePath] === undefined) {
            throw new Error('ENOENT');
        }
        descriptors.push(filePath);
        return descriptors.length;
    });
    mocks.readSync.mockImplementation(
        (descriptor: number, buffer: Buffer, offset: number) => {
            const header = headers[descriptors[descriptor - 1]];
            header.copy(buffer, offset);
            return header.length;
        },
    );
}

function reuseExisting(fileNames: string[]) {
    mocks.fsCheckDirExist.mockResolvedValue(true);
    mocks.fsListFiles.mockResolvedValue(fileNames);
    mocks.electronSendAsync.mockResolvedValue(fileNames.length);
}

const originalImage = globalThis.Image;

beforeEach(() => {
    vi.useFakeTimers();
    decoded.sources = [];
    decoded.sizeOf = () => null;
    class FakeImage {
        width = 0;
        height = 0;
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        set src(value: string) {
            decoded.sources.push(value);
            const size = decoded.sizeOf(value);
            if (size === null) {
                this.onerror?.();
                return;
            }
            this.width = size.width;
            this.height = size.height;
            this.onload?.();
        }
    }
    (globalThis as any).Image = FakeImage;
    mocks.fsCreateDir.mockResolvedValue(undefined);
    mocks.fsDeleteDir.mockResolvedValue(undefined);
});

afterEach(() => {
    (globalThis as any).Image = originalImage;
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('page sizes', () => {
    test('a truncated PNG falls back to decoding the image', async () => {
        serveHeaders({ [`${OUT_DIR}/short-1.png`]: Buffer.alloc(10) });
        decoded.sizeOf = () => ({ width: 640, height: 480 });
        reuseExisting(['short-1.png']);
        await expect(genPdfImagesPreview('/docs/sermon.pdf')).resolves.toEqual([
            {
                src: 'asset://short-1.png',
                pageNumber: 1,
                width: 640,
                height: 480,
            },
        ]);
        expect(decoded.sources).toEqual(['asset://short-1.png']);
        // The descriptor was closed even though the read came up short.
        expect(mocks.closeSync).toHaveBeenCalledWith(1);
    });

    test('a PNG header claiming a zero size is not trusted', async () => {
        serveHeaders({ [`${OUT_DIR}/zero-1.png`]: genPngHeader(0, 792) });
        decoded.sizeOf = () => ({ width: 612, height: 792 });
        reuseExisting(['zero-1.png']);
        const result = await genPdfImagesPreview('/docs/sermon.pdf');
        expect(result?.[0]).toMatchObject({ width: 612, height: 792 });
        expect(decoded.sources).toEqual(['asset://zero-1.png']);
    });

    test('an image that cannot be decoded either reads as 0 x 0', async () => {
        reuseExisting(['broken-1.png']);
        const result = await genPdfImagesPreview('/docs/sermon.pdf');
        expect(result).toEqual([
            { src: 'asset://broken-1.png', pageNumber: 1, width: 0, height: 0 },
        ]);
    });

    test('a page size is read once per cache window, then again after it', async () => {
        serveHeaders({ [`${OUT_DIR}/memo-1.png`]: genPngHeader(100, 200) });
        reuseExisting(['memo-1.png']);
        await genPdfImagesPreview('/docs/sermon.pdf');
        await genPdfImagesPreview('/docs/sermon.pdf');
        expect(mocks.openSync).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10_001);
        const result = await genPdfImagesPreview('/docs/sermon.pdf');
        expect(mocks.openSync).toHaveBeenCalledTimes(2);
        expect(result?.[0]).toMatchObject({ width: 100, height: 200 });
    });
});

describe('page order', () => {
    test('pages listed in order stay in order, by number not by name', async () => {
        serveHeaders({
            [`${OUT_DIR}/order-1.png`]: genPngHeader(1, 1),
            [`${OUT_DIR}/order-2.png`]: genPngHeader(2, 2),
            [`${OUT_DIR}/order-10.png`]: genPngHeader(10, 10),
        });
        reuseExisting(['order-1.png', 'order-2.png', 'order-10.png']);
        const result = await genPdfImagesPreview('/docs/sermon.pdf');
        expect(result?.map((item) => item.pageNumber)).toEqual([1, 2, 10]);
    });

    test('two files claiming the same page keep their listed order', async () => {
        serveHeaders({
            [`${OUT_DIR}/a-3.png`]: genPngHeader(3, 3),
            [`${OUT_DIR}/b-3.png`]: genPngHeader(4, 4),
            [`${OUT_DIR}/c-1.png`]: genPngHeader(1, 1),
        });
        reuseExisting(['a-3.png', 'b-3.png', 'c-1.png']);
        const result = await genPdfImagesPreview('/docs/sermon.pdf');
        expect(result?.map((item) => item.src)).toEqual([
            'asset://c-1.png',
            'asset://a-3.png',
            'asset://b-3.png',
        ]);
    });

    test('freshly exported pages are sorted the same way', async () => {
        mocks.fsCheckDirExist.mockResolvedValue(false);
        serveHeaders({
            [`${OUT_DIR}/fresh-1.png`]: genPngHeader(1, 1),
            [`${OUT_DIR}/fresh-2.png`]: genPngHeader(2, 2),
        });
        mocks.electronSendAsync.mockResolvedValue({
            isSuccessful: true,
            filePaths: [`${OUT_DIR}/fresh-1.png`, `${OUT_DIR}/fresh-2.png`],
        });
        const result = await genPdfImagesPreview('/docs/sermon.pdf');
        expect(result?.map((item) => item.pageNumber)).toEqual([1, 2]);
        expect(mocks.fsDeleteDir).toHaveBeenCalledWith(OUT_DIR);
        expect(mocks.fsCreateDir).toHaveBeenCalledWith(OUT_DIR);
    });
});
