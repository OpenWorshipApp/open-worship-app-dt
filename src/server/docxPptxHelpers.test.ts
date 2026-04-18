import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    fileSourceGetInstanceMock,
    showProgressBarMock,
    hideProgressBarMock,
    electronSendAsyncMock,
    fsDeleteDirMock,
    fsReadFileMock,
    pathJoinMock,
    resolvePathMock,
    unlockingMock,
    generateFileMD5Mock,
} = vi.hoisted(() => ({
    fileSourceGetInstanceMock: vi.fn(),
    showProgressBarMock: vi.fn(),
    hideProgressBarMock: vi.fn(),
    electronSendAsyncMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    pathJoinMock: vi.fn((...parts: string[]) => parts.join('/')),
    resolvePathMock: vi.fn((...parts: string[]) => parts.join('/')),
    unlockingMock: vi.fn(async (_key: string, callback: () => unknown) => {
        return await callback();
    }),
    generateFileMD5Mock: vi.fn(),
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: showProgressBarMock,
    hideProgressBar: hideProgressBarMock,
}));

vi.mock('./appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));

vi.mock('./fileHelpers', () => ({
    fsDeleteDir: fsDeleteDirMock,
    fsReadFile: fsReadFileMock,
    pathJoin: pathJoinMock,
}));

vi.mock('./unlockingHelpers', () => ({
    unlocking: unlockingMock,
}));

vi.mock('./appProvider', () => ({
    default: {
        pathUtils: {
            resolve: resolvePathMock,
        },
        systemUtils: {
            generateFileMD5: generateFileMD5Mock,
        },
    },
}));

async function loadDocxModule() {
    vi.resetModules();
    return await import('./docxHelpers');
}

async function loadPptxModule() {
    vi.resetModules();
    return await import('./pptxHelpers');
}

describe('docxHelpers and pptxHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pathJoinMock.mockImplementation((...parts: string[]) => parts.join('/'));
        resolvePathMock.mockImplementation((...parts: string[]) => parts.join('/'));
    });

    test('removes docx previews, exports HTML, and caches the tool version', async () => {
        const module = await loadDocxModule();
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            if (filePath === '/docs/book.docx') {
                return {
                    baseDirPath: '/docs',
                    fullName: 'book.docx',
                    name: 'book',
                };
            }
            return { readFileJsonData: vi.fn() };
        });
        fsDeleteDirMock.mockResolvedValue(undefined);
        electronSendAsyncMock
            .mockResolvedValueOnce({ isSuccessful: true })
            .mockResolvedValueOnce({ version: '1.2.3' });

        await expect(module.removeDocxHtmlsPreview('/docs/book.docx')).resolves.toBeUndefined();
        expect(fsDeleteDirMock).toHaveBeenCalledWith('/docs/book.docx-docx-htmls');

        await expect(
            module.docxToHtmls('/docs/book.docx', '/docs/out'),
        ).resolves.toEqual({ isSuccessful: true });
        expect(showProgressBarMock).toHaveBeenCalledWith(
            'Exporting DOCX Pages "book"',
        );
        expect(hideProgressBarMock).toHaveBeenCalledWith(
            'Exporting DOCX Pages "book"',
        );

        await expect(module.getDocxToHtmlsVersion()).resolves.toBe('1.2.3');
        await expect(module.getDocxToHtmlsVersion()).resolves.toBe('1.2.3');
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(2);
        expect(unlockingMock).toHaveBeenCalledWith(
            'get-docx-to-htmls-version',
            expect.any(Function),
        );
    });

    test('builds docx page data after invalidating stale preview output', async () => {
        const module = await loadDocxModule();
        const infoReadMock = vi
            .fn()
            .mockResolvedValueOnce({
                checksum: { md5: 'stale-md5' },
                pages: [{ htmlFileName: 'page-1.html', width: 100, height: 200 }],
            })
            .mockResolvedValueOnce({
                checksum: { md5: 'good-md5' },
                pages: [{ htmlFileName: 'page-1.html', width: 100, height: 200 }],
            });
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            if (filePath === '/docs/book.docx') {
                return {
                    baseDirPath: '/docs',
                    fullName: 'book.docx',
                    name: 'book',
                };
            }
            if (filePath.endsWith('/info.json')) {
                return {
                    readFileJsonData: infoReadMock,
                };
            }
            throw new Error(`Unexpected file source: ${filePath}`);
        });
        generateFileMD5Mock.mockResolvedValue('good-md5');
        electronSendAsyncMock.mockResolvedValue({ isSuccessful: true });
        fsReadFileMock.mockResolvedValue('<html>page</html>');

        await expect(module.getDocxData('/docs/book.docx')).resolves.toEqual({
            info: {
                checksum: { md5: 'good-md5' },
                pages: [
                    {
                        htmlFileName: 'page-1.html',
                        width: 100,
                        height: 200,
                        htmlFilePath: '/docs/book.docx-docx-htmls/page-1.html',
                        html: '<html>page</html>',
                    },
                ],
            },
            baseDirPath: '/docs/book.docx-docx-htmls',
        });

        expect(fsDeleteDirMock).toHaveBeenCalledWith('/docs/book.docx-docx-htmls');
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:docx-to-htmls',
            {
                filePath: '/docs/book.docx',
                outDir: '/docs/book.docx-docx-htmls',
            },
        );
        expect(fsReadFileMock).toHaveBeenCalledWith(
            '/docs/book.docx-docx-htmls/page-1.html',
        );
    });

    test('returns null for docx data after three failed export attempts', async () => {
        const module = await loadDocxModule();
        const infoReadMock = vi.fn().mockResolvedValue(null);
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            if (filePath === '/docs/missing.docx') {
                return {
                    baseDirPath: '/docs',
                    fullName: 'missing.docx',
                    name: 'missing',
                };
            }
            if (filePath.endsWith('/info.json')) {
                return {
                    readFileJsonData: infoReadMock,
                };
            }
            throw new Error(`Unexpected file source: ${filePath}`);
        });
        generateFileMD5Mock.mockResolvedValue('md5');
        electronSendAsyncMock.mockResolvedValue({ isSuccessful: false });

        await expect(module.getDocxData('/docs/missing.docx')).resolves.toBeNull();
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(3);
    });

    test('removes pptx previews, gets slide counts, exports HTML, caches versions, and removes slide backgrounds', async () => {
        const module = await loadPptxModule();
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            if (filePath === '/slides/demo.pptx') {
                return {
                    baseDirPath: '/slides',
                    fullName: 'demo.pptx',
                    name: 'demo',
                };
            }
            return { readFileJsonData: vi.fn() };
        });
        fsDeleteDirMock.mockResolvedValue(undefined);
        electronSendAsyncMock
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce({ isSuccessful: true })
            .mockResolvedValueOnce({ version: '2.3.4' })
            .mockResolvedValueOnce(true);

        await expect(module.removePptxHtmlsPreview('/slides/demo.pptx')).resolves.toBeUndefined();
        expect(fsDeleteDirMock).toHaveBeenCalledWith('/slides/demo.pptx-htmls');

        await expect(module.getSlidesCount('/slides/demo.pptx')).resolves.toBe(12);
        await expect(
            module.pptxToHtmls('/slides/demo.pptx', '/slides/out'),
        ).resolves.toEqual({ isSuccessful: true });
        await expect(module.getPptxToHtmlsVersion()).resolves.toBe('2.3.4');
        await expect(module.getPptxToHtmlsVersion()).resolves.toBe('2.3.4');
        await expect(module.removeSlideBackground('/slides/demo.pptx')).resolves.toBe(true);

        expect(showProgressBarMock).toHaveBeenCalledWith(
            'Exporting PPTX Slides "demo"',
        );
        expect(hideProgressBarMock).toHaveBeenCalledWith(
            'Exporting PPTX Slides "demo"',
        );
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:ms-pp-remove-slides-bg',
            { filePath: '/slides/demo.pptx' },
        );
    });

    test('builds pptx slide data with sub-html content after invalidating stale previews', async () => {
        const module = await loadPptxModule();
        const infoReadMock = vi
            .fn()
            .mockResolvedValueOnce({
                checksum: { md5: 'old-md5' },
                slides: [
                    {
                        htmlFileName: 'slide-1.html',
                        subHtmlFileNames: ['sub-1.html', 'sub-2.html'],
                        isDisabled: false,
                        note: null,
                        images: [],
                        videos: [],
                        audios: [],
                    },
                ],
            })
            .mockResolvedValueOnce({
                checksum: { md5: 'new-md5' },
                slides: [
                    {
                        htmlFileName: 'slide-1.html',
                        subHtmlFileNames: ['sub-1.html', 'sub-2.html'],
                        isDisabled: false,
                        note: null,
                        images: [],
                        videos: [],
                        audios: [],
                    },
                ],
            });
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            if (filePath === '/slides/demo.pptx') {
                return {
                    baseDirPath: '/slides',
                    fullName: 'demo.pptx',
                    name: 'demo',
                };
            }
            if (filePath.endsWith('/info.json')) {
                return {
                    readFileJsonData: infoReadMock,
                };
            }
            throw new Error(`Unexpected file source: ${filePath}`);
        });
        generateFileMD5Mock.mockResolvedValue('new-md5');
        electronSendAsyncMock.mockResolvedValue({ isSuccessful: true });
        fsReadFileMock.mockImplementation(async (filePath: string) => {
            return `<html>${filePath}</html>`;
        });

        await expect(module.getPptxData('/slides/demo.pptx')).resolves.toEqual({
            info: {
                checksum: { md5: 'new-md5' },
                slides: [
                    {
                        htmlFileName: 'slide-1.html',
                        subHtmlFileNames: ['sub-1.html', 'sub-2.html'],
                        isDisabled: false,
                        note: null,
                        images: [],
                        videos: [],
                        audios: [],
                        htmlFilePath: '/slides/demo.pptx-htmls/slide-1.html',
                        subHtmlFilePaths: [
                            '/slides/demo.pptx-htmls/sub-1.html',
                            '/slides/demo.pptx-htmls/sub-2.html',
                        ],
                        html: '<html>/slides/demo.pptx-htmls/slide-1.html</html>',
                        subHtmls: [
                            '<html>/slides/demo.pptx-htmls/sub-1.html</html>',
                            '<html>/slides/demo.pptx-htmls/sub-2.html</html>',
                        ],
                    },
                ],
            },
            baseDir: '/slides/demo.pptx-htmls',
        });

        expect(fsDeleteDirMock).toHaveBeenCalledWith('/slides/demo.pptx-htmls');
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:pptx-to-htmls',
            {
                filePath: '/slides/demo.pptx',
                outDir: '/slides/demo.pptx-htmls',
            },
        );
    });

    test('returns null for pptx data after repeated missing exports', async () => {
        const module = await loadPptxModule();
        const infoReadMock = vi.fn().mockResolvedValue(null);
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            if (filePath === '/slides/missing.pptx') {
                return {
                    baseDirPath: '/slides',
                    fullName: 'missing.pptx',
                    name: 'missing',
                };
            }
            if (filePath.endsWith('/info.json')) {
                return {
                    readFileJsonData: infoReadMock,
                };
            }
            throw new Error(`Unexpected file source: ${filePath}`);
        });
        generateFileMD5Mock.mockResolvedValue('md5');
        electronSendAsyncMock.mockResolvedValue({ isSuccessful: false });

        await expect(module.getPptxData('/slides/missing.pptx')).resolves.toBeNull();
        expect(electronSendAsyncMock).toHaveBeenCalledTimes(3);
    });
});
