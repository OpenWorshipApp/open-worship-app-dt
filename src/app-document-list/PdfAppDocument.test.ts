// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const fileSources = new Map<string, any>();
    return {
        fileSources,
        getFileSource: (filePath: string) => {
            let fileSource = fileSources.get(filePath);
            if (fileSource === undefined) {
                const fullName = filePath.split('/').at(-1) ?? filePath;
                fileSource = {
                    filePath,
                    fullName,
                    extension: fullName.split('.').at(-1),
                };
                fileSources.set(filePath, fileSource);
            }
            return fileSource;
        },
        // The order the delete clean-up steps ran in.
        log: [] as string[],
        appLogMock: vi.fn(),
        genPdfImagesPreviewMock: vi.fn(),
        handleErrorMock: vi.fn(),
        removePdfImagesPreviewMock: vi.fn(),
        showAppContextMenuMock: vi.fn(),
        showStaticSlideContextMenuMock: vi.fn(),
    };
});

vi.mock('../helper/pdfHelpers', () => ({
    genPdfImagesPreview: mocks.genPdfImagesPreviewMock,
    removePdfImagesPreview: mocks.removePdfImagesPreviewMock,
}));
vi.mock('./appDocumentHelpers', () => ({
    BLANK_IMAGE_SLIDE_SRC: 'blank.png',
    showStaticSlideContextMenu: mocks.showStaticSlideContextMenuMock,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenuMock,
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));
vi.mock('../helper/loggerHelpers', () => ({ appLog: mocks.appLogMock }));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => mocks.getFileSource(filePath),
    },
}));
vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: (mimetypeName: string) => {
        return mimetypeName === 'pdf' ? ['pdf'] : [];
    },
}));
// Only the editable base reaches the history; this document never does.
vi.mock('../editing-manager/EditingHistoryManager', () => ({ default: {} }));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        deleteMetaDataFile: async () => {
            mocks.log.push('background meta');
        },
    },
}));
vi.mock('../others/SlideTransitionManager', () => ({
    slideTransitionManager: {
        deleteMetaDataFile: async () => {
            mocks.log.push('transition meta');
        },
    },
}));

import PdfAppDocument from './PdfAppDocument';
import PdfSlide from './PdfSlide';

const FILE_PATH = '/docs/bulletin.pdf';

beforeEach(() => {
    mocks.fileSources.clear();
    mocks.log.length = 0;
    mocks.genPdfImagesPreviewMock.mockResolvedValue([
        { src: 'file:///p/0.png', pageNumber: 0, width: 600, height: 800 },
        { src: 'file:///p/1.png', pageNumber: 1, width: 800, height: 600 },
    ]);
    mocks.removePdfImagesPreviewMock.mockImplementation(() => {
        mocks.log.push('remove preview');
    });
});

describe('PdfAppDocument.getSlides', () => {
    test('a blank first slide sized like page one, then one image slide per page', async () => {
        const slides = await new PdfAppDocument(FILE_PATH).getSlides();

        expect(slides.every((slide) => slide instanceof PdfSlide)).toBe(true);
        expect(slides.map((slide) => slide.toJson())).toEqual([
            {
                id: 0,
                imagePreviewSrc: 'blank.png',
                pdfPageNumber: 0,
                metadata: { width: 600, height: 800 },
                type: 'pdf-slide',
            },
            {
                id: 1,
                imagePreviewSrc: 'file:///p/0.png',
                pdfPageNumber: 0,
                metadata: { width: 600, height: 800 },
                type: 'pdf-slide',
            },
            {
                id: 2,
                imagePreviewSrc: 'file:///p/1.png',
                pdfPageNumber: 1,
                metadata: { width: 800, height: 600 },
                type: 'pdf-slide',
            },
        ]);
        expect(mocks.genPdfImagesPreviewMock).toHaveBeenCalledWith(FILE_PATH);
    });

    test('no preview, or an empty one, gives no slides', async () => {
        const pdfAppDocument = new PdfAppDocument(FILE_PATH);

        mocks.genPdfImagesPreviewMock.mockResolvedValueOnce(null);
        expect(await pdfAppDocument.getSlides()).toEqual([]);

        mocks.genPdfImagesPreviewMock.mockResolvedValueOnce([]);
        expect(await pdfAppDocument.getSlides()).toEqual([]);
    });

    test('a failed conversion is reported and gives no slides', async () => {
        const error = new Error('broken pdf');
        mocks.genPdfImagesPreviewMock.mockRejectedValue(error);

        expect(await new PdfAppDocument(FILE_PATH).getSlides()).toEqual([]);
        expect(mocks.handleErrorMock).toHaveBeenCalledWith(error);
    });

    test('finds a page by index and by id', async () => {
        const pdfAppDocument = new PdfAppDocument(FILE_PATH);

        expect((await pdfAppDocument.getSlideByIndex(2))?.pdfPreviewSrc).toBe(
            'file:///p/1.png',
        );
        expect(await pdfAppDocument.getSlideByIndex(5)).toBeNull();
        expect((await pdfAppDocument.getItemById(1))?.width).toBe(600);
        expect(await pdfAppDocument.getItemById(9)).toBeNull();
    });
});

describe('PdfAppDocument as a read-only document', () => {
    test('has no metadata and refuses every write', async () => {
        const pdfAppDocument = new PdfAppDocument(FILE_PATH);

        expect(await pdfAppDocument.getMetadata()).toEqual({});
        expect(pdfAppDocument.isEditable).toBe(false);
        expect(() => pdfAppDocument.setMetadata({})).toThrow(
            'Method not implemented.',
        );
        expect(() => pdfAppDocument.setSlides([])).toThrow(
            'Method not implemented.',
        );
        expect(() => pdfAppDocument.setItemById(1, {} as PdfSlide)).toThrow(
            'Method not implemented.',
        );
        expect(() => pdfAppDocument.toJson()).toThrow(
            'Method not implemented.',
        );
    });

    test("a page's menu is the static slide menu with the extras", () => {
        const pdfAppDocument = new PdfAppDocument(FILE_PATH);
        const slide = {} as PdfSlide;
        const extra = [{ menuElement: 'Transition' }];

        pdfAppDocument.showSlideContextMenu('event', slide, extra);
        pdfAppDocument.showSlideContextMenu('event', slide);

        expect(mocks.showStaticSlideContextMenuMock.mock.calls).toEqual([
            ['event', slide, extra],
            ['event', slide, []],
        ]);
    });

    test('the document menu shows only the rows it was given', async () => {
        const pdfAppDocument = new PdfAppDocument(FILE_PATH);

        await pdfAppDocument.showContextMenu('event');
        expect(mocks.showAppContextMenuMock).not.toHaveBeenCalled();
        expect(mocks.appLogMock).toHaveBeenCalledWith(
            'Method not implemented.',
        );

        const extra = [{ menuElement: 'Transition' }];
        await pdfAppDocument.showContextMenu('event', extra);
        expect(mocks.showAppContextMenuMock).toHaveBeenCalledExactlyOnceWith(
            'event',
            extra,
        );
    });

    test('one instance per file, compared by path', () => {
        const pdfAppDocument = PdfAppDocument.getInstance(FILE_PATH);

        expect(PdfAppDocument.getInstance(FILE_PATH)).toBe(pdfAppDocument);
        expect(PdfAppDocument.checkIsThisType(pdfAppDocument)).toBe(true);
        expect(pdfAppDocument.checkIsSame(new PdfAppDocument(FILE_PATH))).toBe(
            true,
        );
        expect(
            pdfAppDocument.checkIsSame(new PdfAppDocument('/docs/other.pdf')),
        ).toBe(false);
        expect(pdfAppDocument.checkIsSame({ filePath: FILE_PATH })).toBeFalsy();
    });

    test('deleting clears the shared metadata, then the page images', async () => {
        await new PdfAppDocument(FILE_PATH).preDelete();

        expect(mocks.log).toEqual([
            'background meta',
            'transition meta',
            'remove preview',
        ]);
        expect(mocks.removePdfImagesPreviewMock).toHaveBeenCalledWith(
            FILE_PATH,
        );
    });
});
