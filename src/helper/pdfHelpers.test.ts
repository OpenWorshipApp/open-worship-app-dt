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
} = vi.hoisted(() => ({
    electronSendAsyncMock: vi.fn(),
    fsCheckDirExistMock: vi.fn(),
    fsCreateDirMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsListFilesMock: vi.fn(),
    appErrorMock: vi.fn(),
    pathResolveMock: vi.fn((...parts: string[]) => parts.join('/')),
    fileSourceGetInstanceMock: vi.fn(),
}));

vi.mock('../others/CacheManager', () => ({
    default: class CacheManagerMock<T> {
        private readonly store = new Map<string, T>();

        async get(key: string) {
            return this.store.get(key) ?? null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
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

describe('pdfHelpers', () => {
    beforeAll(() => {
        class MockImage {
            width = 0;
            height = 0;
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

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

        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            return getFileSource(filePath);
        });
        fsCheckDirExistMock.mockResolvedValue(true);
        fsCreateDirMock.mockResolvedValue(undefined);
        fsDeleteDirMock.mockResolvedValue(undefined);
        fsListFilesMock.mockResolvedValue([]);
    });

    test('removes the preview directory for a PDF file', () => {
        removePdfImagesPreview('/docs/sermon.pdf');

        expect(fsDeleteDirMock).toHaveBeenCalledWith('/docs/sermon.pdf-images');
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
