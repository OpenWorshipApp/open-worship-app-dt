// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    electronSendAsyncMock,
    fsCheckDirExistMock,
    fsCreateDirMock,
    fsDeleteDirMock,
    fsListFilesMock,
    appErrorMock,
    pathResolveMock,
    fileSourceGetInstanceMock,
    openSyncMock,
    readSyncMock,
    closeSyncMock,
    cacheStoreMock,
} = vi.hoisted(() => ({
    electronSendAsyncMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    fsCreateDirMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsListFilesMock: vi.fn(),
    appErrorMock: vi.fn(),
    pathResolveMock: vi.fn((...parts: string[]) => parts.join('/')),
    fileSourceGetInstanceMock: vi.fn(),
    openSyncMock: vi.fn(),
    readSyncMock: vi.fn(),
    closeSyncMock: vi.fn(),
    // Shared so `beforeEach` can clear it: the real cache manager lives at
    // module scope in `pdfHelpers.ts`, so without this a size cached by one
    // test silently answers the next one.
    cacheStoreMock: new Map<string, unknown>(),
}));

vi.mock('../others/CacheManager', () => ({
    default: class CacheManagerMock<T> {
        async get(key: string) {
            return (cacheStoreMock.get(key) as T | undefined) ?? null;
        }

        async set(key: string, value: T) {
            cacheStoreMock.set(key, value);
        }
    },
}));

vi.mock('../server/appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        pathUtils: {
            resolve: pathResolveMock,
        },
        fileUtils: {
            openSync: openSyncMock,
            readSync: readSyncMock,
            closeSync: closeSyncMock,
        },
        isPageScreen: false,
    },
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: fsCheckDirExistMock,
    fsCreateDir: fsCreateDirMock,
    fsDeleteDir: fsDeleteDirMock,
    fsListFiles: fsListFilesMock,
}));

vi.mock('./FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('./loggerHelpers', () => ({
    appError: appErrorMock,
}));

import { genPdfImagesPreview, removePdfImagesPreview } from './pdfHelpers';

function getFileSource(filePath: string) {
    const segments = filePath.split('/');
    const fullName = segments.at(-1) ?? '';
    const baseDirPath = segments.slice(0, -1).join('/');
    const dotIndex = fullName.lastIndexOf('.');
    return {
        baseDirPath,
        fullName,
        name: dotIndex >= 0 ? fullName.substring(0, dotIndex) : fullName,
        src: `asset://${fullName}`,
    };
}

// A PNG's first 24 bytes: signature, IHDR chunk length + type, then width and
// height as big-endian uint32s. `readPngSize` reads exactly this instead of
// decoding the image.
function genPngHeader(width: number, height: number) {
    const buffer = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(
        buffer,
        0,
    );
    buffer.writeUInt32BE(13, 8);
    buffer.write('IHDR', 12, 'latin1');
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
}

let imageConstructedCount = 0;

describe('pdfHelpers', () => {
    beforeAll(() => {
        class MockImage {
            width = 0;
            height = 0;
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            constructor() {
                imageConstructedCount += 1;
            }

            set src(value: string) {
                if (value.includes('bad')) {
                    this.onerror?.();
                    return;
                }
                this.width = value.includes('page-2') ? 200 : 100;
                this.height = value.includes('page-2') ? 400 : 300;
                this.onload?.();
            }
        }

        vi.stubGlobal('Image', MockImage as unknown as typeof Image);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        imageConstructedCount = 0;
        cacheStoreMock.clear();

        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            return getFileSource(filePath);
        });
        fsCheckDirExistMock.mockResolvedValue(true);
        fsCreateDirMock.mockResolvedValue(undefined);
        fsDeleteDirMock.mockResolvedValue(undefined);
        fsListFilesMock.mockResolvedValue([]);
        // Default: no readable file, so the header read bails and the existing
        // tests exercise the `Image` decode fallback exactly as before.
        openSyncMock.mockImplementation(() => {
            throw new Error('ENOENT');
        });
    });

    test('removes the preview directory for a PDF file', () => {
        removePdfImagesPreview('/docs/sermon.pdf');

        expect(fsDeleteDirMock).toHaveBeenCalledWith('/docs/sermon.pdf-images');
    });

    test('reads page dimensions from the PNG header without decoding', async () => {
        // Decoding every page cost ~163MB of bitmap for an 88-page PDF; the
        // header read must produce the same numbers for ~24 bytes per page.
        const headers: { [filePath: string]: Buffer } = {
            '/docs/sermon.pdf-images/page-1.png': genPngHeader(612, 792),
            '/docs/sermon.pdf-images/page-2.png': genPngHeader(1224, 1584),
        };
        openSyncMock.mockImplementation((filePath: string) => {
            if (headers[filePath] === undefined) {
                throw new Error('ENOENT');
            }
            return filePath === '/docs/sermon.pdf-images/page-1.png' ? 11 : 22;
        });
        readSyncMock.mockImplementation(
            (
                fileDescriptor: number,
                buffer: Buffer,
                offset: number,
                length: number,
            ) => {
                const header =
                    fileDescriptor === 11
                        ? headers['/docs/sermon.pdf-images/page-1.png']
                        : headers['/docs/sermon.pdf-images/page-2.png'];
                header.copy(buffer, offset, 0, length);
                return length;
            },
        );
        fsListFilesMock.mockResolvedValue(['page-2.png', 'page-1.png']);
        electronSendAsyncMock.mockResolvedValue(2);

        const result = await genPdfImagesPreview('/docs/sermon.pdf');

        expect(result).toEqual([
            {
                src: 'asset://page-1.png',
                pageNumber: 1,
                width: 612,
                height: 792,
            },
            {
                src: 'asset://page-2.png',
                pageNumber: 2,
                width: 1224,
                height: 1584,
            },
        ]);
        // The whole point: no image was decoded, and every descriptor closed.
        expect(imageConstructedCount).toBe(0);
        expect(closeSyncMock).toHaveBeenCalledTimes(2);
    });

    test('falls back to decoding when the file is not a valid PNG', async () => {
        openSyncMock.mockReturnValue(7);
        readSyncMock.mockImplementation(
            (
                _fileDescriptor: number,
                buffer: Buffer,
                offset: number,
                length: number,
            ) => {
                Buffer.alloc(length, 0).copy(buffer, offset);
                return length;
            },
        );
        fsListFilesMock.mockResolvedValue(['page-1.png']);
        electronSendAsyncMock.mockResolvedValue(1);

        const result = await genPdfImagesPreview('/docs/sermon.pdf');

        expect(result).toEqual([
            {
                src: 'asset://page-1.png',
                pageNumber: 1,
                width: 100,
                height: 300,
            },
        ]);
        expect(imageConstructedCount).toBe(1);
        expect(closeSyncMock).toHaveBeenCalledTimes(1);
    });

    test('reuses existing preview images when all pages are present', async () => {
        fsListFilesMock.mockResolvedValue([
            'page-2.png',
            'note.txt',
            'page-1.png',
        ]);
        electronSendAsyncMock.mockResolvedValue(2);

        const result = await genPdfImagesPreview('/docs/sermon.pdf');

        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:pdf-pages-count',
            { filePath: '/docs/sermon.pdf' },
        );
        expect(result).toEqual([
            {
                src: 'asset://page-1.png',
                pageNumber: 1,
                width: 100,
                height: 300,
            },
            {
                src: 'asset://page-2.png',
                pageNumber: 2,
                width: 200,
                height: 400,
            },
        ]);
    });

    test('returns null when cached preview pages are incomplete', async () => {
        fsListFilesMock.mockResolvedValue(['page-1.png', 'page-2.png']);
        electronSendAsyncMock.mockResolvedValue(3);

        await expect(
            genPdfImagesPreview('/docs/sermon.pdf'),
        ).resolves.toBeNull();
    });

    test('generates preview images when no reusable cache exists', async () => {
        fsCheckDirExistMock.mockResolvedValue(false);
        electronSendAsyncMock.mockResolvedValue({
            isSuccessful: true,
            filePaths: [
                '/docs/sermon.pdf-images/page-2.png',
                '/docs/sermon.pdf-images/page-1.png',
            ],
        });

        const result = await genPdfImagesPreview('/docs/sermon.pdf', true);

        expect(fsDeleteDirMock).toHaveBeenCalledWith('/docs/sermon.pdf-images');
        expect(fsCreateDirMock).toHaveBeenCalledWith('/docs/sermon.pdf-images');
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:pdf-to-images',
            {
                filePath: '/docs/sermon.pdf',
                outDir: '/docs/sermon.pdf-images',
                isForce: true,
            },
        );
        expect(result?.map((item) => item.pageNumber)).toEqual([1, 2]);
    });

    test('logs and returns null when PDF conversion fails', async () => {
        fsCheckDirExistMock.mockResolvedValue(false);
        electronSendAsyncMock.mockResolvedValue({
            isSuccessful: false,
            message: 'conversion failed',
        });

        await expect(
            genPdfImagesPreview('/docs/sermon.pdf'),
        ).resolves.toBeNull();
        expect(appErrorMock).toHaveBeenCalledWith(
            'Failed to generate PDF images preview:',
            'conversion failed',
        );
    });
});
