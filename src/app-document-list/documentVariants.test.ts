import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    deleteMetaDataFileMock,
    getMimetypeExtensionsMock,
    fileSourceGetInstanceMock,
    showStaticSlideContextMenuMock,
    genPdfImagesPreviewMock,
    removePdfImagesPreviewMock,
    getPptxDataMock,
    getPptxToHtmlsVersionMock,
    removePptxHtmlsPreviewMock,
    getDocxDataMock,
    getDocxToHtmlsVersionMock,
    removeDocxHtmlsPreviewMock,
    handleErrorMock,
    appLogMock,
    pathJoinMock,
} = vi.hoisted(() => ({
    deleteMetaDataFileMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    showStaticSlideContextMenuMock: vi.fn(),
    genPdfImagesPreviewMock: vi.fn(),
    removePdfImagesPreviewMock: vi.fn(),
    getPptxDataMock: vi.fn(),
    getPptxToHtmlsVersionMock: vi.fn(),
    removePptxHtmlsPreviewMock: vi.fn(),
    getDocxDataMock: vi.fn(),
    getDocxToHtmlsVersionMock: vi.fn(),
    removeDocxHtmlsPreviewMock: vi.fn(),
    handleErrorMock: vi.fn(),
    appLogMock: vi.fn(),
    pathJoinMock: vi.fn(),
}));

vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        deleteMetaDataFile: deleteMetaDataFileMock,
    },
}));

vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: getMimetypeExtensionsMock,
    pathJoin: pathJoinMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('./appDocumentHelpers', () => ({
    showStaticSlideContextMenu: showStaticSlideContextMenuMock,
}));

vi.mock('../helper/pdfHelpers', () => ({
    genPdfImagesPreview: genPdfImagesPreviewMock,
    removePdfImagesPreview: removePdfImagesPreviewMock,
}));

vi.mock('../server/pptxHelpers', () => ({
    getPptxData: getPptxDataMock,
    getPptxToHtmlsVersion: getPptxToHtmlsVersionMock,
    removePptxHtmlsPreview: removePptxHtmlsPreviewMock,
}));

vi.mock('../server/docxHelpers', () => ({
    getDocxData: getDocxDataMock,
    getDocxToHtmlsVersion: getDocxToHtmlsVersionMock,
    removeDocxHtmlsPreview: removeDocxHtmlsPreviewMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../helper/loggerHelpers', () => ({
    appLog: appLogMock,
}));

import DocxAppDocument from './DocxAppDocument';
import PdfAppDocument from './PdfAppDocument';
import PptxAppDocument from './PptxAppDocument';

function mockFileSource(filePath: string) {
    const normalized = filePath.replaceAll('\\', '/');
    const fullName = normalized.split('/').at(-1) ?? normalized;
    const baseDirPath = normalized.includes('/')
        ? normalized.substring(0, normalized.lastIndexOf('/'))
        : '';
    const dotIndex = fullName.lastIndexOf('.');
    const extension = dotIndex >= 0 ? fullName.substring(dotIndex + 1) : '';
    return {
        filePath,
        fullName,
        baseDirPath,
        extension,
    };
}

describe('document variants', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        getMimetypeExtensionsMock.mockImplementation((mimetypeName: string) => {
            switch (mimetypeName) {
                case 'pdf':
                    return ['pdf'];
                case 'pptx':
                    return ['pptx'];
                case 'docx':
                    return ['docx'];
                default:
                    return ['ows'];
            }
        });
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            return mockFileSource(filePath);
        });
        pathJoinMock.mockImplementation((...parts: string[]) =>
            parts.join('/'),
        );
        removePdfImagesPreviewMock.mockResolvedValue(undefined);
        removePptxHtmlsPreviewMock.mockResolvedValue(undefined);
        removeDocxHtmlsPreviewMock.mockResolvedValue(undefined);
        getPptxToHtmlsVersionMock.mockResolvedValue('1.0.0');
        getDocxToHtmlsVersionMock.mockResolvedValue('1.0.0');
    });

    test('wraps PDF pages and delegates shared helpers', async () => {
        genPdfImagesPreviewMock.mockResolvedValue([
            {
                src: '/preview/page-0.png',
                pageNumber: 0,
                width: 800,
                height: 600,
            },
            {
                src: '/preview/page-1.png',
                pageNumber: 1,
                width: 800,
                height: 600,
            },
        ]);

        const documentSource = PdfAppDocument.getInstance('/docs/guide.pdf');
        const slides = await documentSource.getSlides();

        expect(slides.map((slide) => slide.id)).toEqual([0, 1, 2]);
        expect(slides[0].pdfPreviewSrc).toBe('/assets/blank.png');
        expect((await documentSource.getSlideByIndex(2))?.id).toBe(2);
        expect((await documentSource.getItemById(1))?.id).toBe(1);
        expect(await documentSource.getMetadata()).toEqual({});
        documentSource.showSlideContextMenu('event', slides[1], [
            { menuElement: 'Extra' } as any,
        ]);
        expect(showStaticSlideContextMenuMock).toHaveBeenCalledWith(
            'event',
            slides[1],
            [{ menuElement: 'Extra' }],
        );
        await documentSource.showContextMenu('ignored');
        expect(appLogMock).toHaveBeenCalledWith('Method not implemented.');
        expect(PdfAppDocument.getInstance('/docs/guide.pdf')).toBe(
            documentSource,
        );
        expect(PdfAppDocument.checkIsThisType(documentSource)).toBe(true);
        expect(
            documentSource.checkIsSame(new PdfAppDocument('/docs/guide.pdf')),
        ).toBe(true);
        expect(() => documentSource.toJson()).toThrow(
            'Method not implemented.',
        );

        await documentSource.preDelete();
        expect(deleteMetaDataFileMock).toHaveBeenCalledWith('/docs/guide.pdf');
        expect(removePdfImagesPreviewMock).toHaveBeenCalledWith(
            '/docs/guide.pdf',
        );
    });

    test('returns empty PDF slides for null previews or preview errors', async () => {
        genPdfImagesPreviewMock.mockResolvedValueOnce(null);
        expect(await new PdfAppDocument('/docs/empty.pdf').getSlides()).toEqual(
            [],
        );

        genPdfImagesPreviewMock.mockRejectedValueOnce(new Error('pdf failure'));
        expect(await new PdfAppDocument('/docs/error.pdf').getSlides()).toEqual(
            [],
        );
        expect(handleErrorMock).toHaveBeenCalled();
    });

    test('wraps PPTX slides, audio assets and version mismatches', async () => {
        getPptxDataMock.mockResolvedValue({
            info: {
                toolVersion: '1.0.0',
                dimensions: { width: 1280, height: 720 },
                slides: [
                    {
                        htmlFilePath: '/deck/slide-1.html',
                        subHtmlFilePaths: [],
                        html: '<section>1</section>',
                        subHtmls: [],
                        isDisabled: false,
                        note: null,
                        images: [],
                        videos: [],
                        audios: ['audio/track.mp3'],
                    },
                    {
                        htmlFilePath: '/deck/slide-2.html',
                        subHtmlFilePaths: ['/deck/sub-1.html'],
                        html: '<section>2</section>',
                        subHtmls: ['<section>2a</section>'],
                        isDisabled: true,
                        note: 'Speaker note',
                        images: [],
                        videos: [],
                        audios: [],
                    },
                ],
            },
        });

        const documentSource = PptxAppDocument.getInstance('/docs/deck.pptx');
        const slides = await documentSource.getSlides();

        expect(slides.map((slide) => slide.id)).toEqual([0, 1, 2]);
        expect((await documentSource.getSlideByIndex(2))?.id).toBe(2);
        expect((await documentSource.getItemById(1))?.id).toBe(1);
        expect(await documentSource.getAudioFilePaths()).toEqual([
            {
                slideIndex: 1,
                filePaths: ['/deck/audio/track.mp3'],
            },
        ]);
        expect(PptxAppDocument.getInstance('/docs/deck.pptx')).toBe(
            documentSource,
        );
        expect(PptxAppDocument.checkIsThisType(documentSource)).toBe(true);
        expect(
            documentSource.checkIsSame(new PptxAppDocument('/docs/deck.pptx')),
        ).toBe(true);
        expect(() => documentSource.toJson()).toThrow(
            'Method not implemented.',
        );

        await documentSource.preDelete();
        expect(removePptxHtmlsPreviewMock).toHaveBeenCalledWith(
            '/docs/deck.pptx',
        );

        getPptxToHtmlsVersionMock.mockResolvedValueOnce('2.0.0');
        expect(
            await new PptxAppDocument('/docs/mismatch.pptx').getSlides(),
        ).toEqual([]);
        expect(removePptxHtmlsPreviewMock).toHaveBeenCalledWith(
            '/docs/mismatch.pptx',
        );
        expect(appLogMock).toHaveBeenCalledWith(
            'Pptx version mismatch:',
            '2.0.0',
            '1.0.0',
        );

        getPptxDataMock.mockResolvedValueOnce(null);
        expect(
            await new PptxAppDocument('/docs/null.pptx').getSlides(),
        ).toEqual([]);

        getPptxDataMock.mockRejectedValueOnce(new Error('pptx failure'));
        expect(
            await new PptxAppDocument('/docs/error.pptx').getSlides(),
        ).toEqual([]);
        expect(handleErrorMock).toHaveBeenCalled();
    });

    test('wraps DOCX pages and clears stale previews', async () => {
        getDocxDataMock.mockResolvedValue({
            info: {
                toolVersion: '1.0.0',
                pages: [
                    {
                        htmlFilePath: '/doc/page-1.html',
                        html: '<article>1</article>',
                        width: 800,
                        height: 1100,
                    },
                    {
                        htmlFilePath: '/doc/page-2.html',
                        html: '<article>2</article>',
                        width: 800,
                        height: 1100,
                    },
                ],
            },
        });

        const documentSource = DocxAppDocument.getInstance('/docs/file.docx');
        const slides = await documentSource.getSlides();

        expect(slides.map((slide) => slide.id)).toEqual([0, 1, 2]);
        expect((await documentSource.getSlideByIndex(2))?.id).toBe(2);
        expect((await documentSource.getItemById(1))?.id).toBe(1);
        expect(await documentSource.getMetadata()).toEqual({});
        expect(DocxAppDocument.getInstance('/docs/file.docx')).toBe(
            documentSource,
        );
        expect(DocxAppDocument.checkIsThisType(documentSource)).toBe(true);
        expect(
            documentSource.checkIsSame(new DocxAppDocument('/docs/file.docx')),
        ).toBe(true);
        expect(() => documentSource.toJson()).toThrow(
            'Method not implemented.',
        );

        await documentSource.preDelete();
        expect(removeDocxHtmlsPreviewMock).toHaveBeenCalledWith(
            '/docs/file.docx',
        );

        getDocxToHtmlsVersionMock.mockResolvedValueOnce('2.0.0');
        expect(
            await new DocxAppDocument('/docs/mismatch.docx').getSlides(),
        ).toEqual([]);
        expect(removeDocxHtmlsPreviewMock).toHaveBeenCalledWith(
            '/docs/mismatch.docx',
        );
        expect(appLogMock).toHaveBeenCalledWith(
            'Docx version mismatch:',
            '2.0.0',
            '1.0.0',
        );

        getDocxDataMock.mockResolvedValueOnce(null);
        expect(
            await new DocxAppDocument('/docs/null.docx').getSlides(),
        ).toEqual([]);

        getDocxDataMock.mockRejectedValueOnce(new Error('docx failure'));
        expect(
            await new DocxAppDocument('/docs/error.docx').getSlides(),
        ).toEqual([]);
        expect(handleErrorMock).toHaveBeenCalled();
    });
});
