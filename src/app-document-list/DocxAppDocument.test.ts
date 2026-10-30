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
                    fireUpdateEvent: vi.fn(),
                };
                fileSources.set(filePath, fileSource);
            }
            return fileSource;
        },
        // The order the delete clean-up steps ran in.
        log: [] as string[],
        appLogMock: vi.fn(),
        getDocxDataMock: vi.fn(),
        getDocxMissingFontFamilyListMock: vi.fn(),
        getDocxToHtmlsVersionMock: vi.fn(),
        handleErrorMock: vi.fn(),
        removeDocxHtmlsPreviewMock: vi.fn(),
        showAppContextMenuMock: vi.fn(),
        showStaticSlideContextMenuMock: vi.fn(),
    };
});

vi.mock('../server/docxHelpers', () => ({
    getDocxData: mocks.getDocxDataMock,
    getDocxMissingFontFamilyList: mocks.getDocxMissingFontFamilyListMock,
    getDocxToHtmlsVersion: mocks.getDocxToHtmlsVersionMock,
    removeDocxHtmlsPreview: mocks.removeDocxHtmlsPreviewMock,
}));
vi.mock('./appDocumentHelpers', () => ({
    BLANK_HTML_SLIDE_SRC: 'blank.html',
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
        return mimetypeName === 'docx' ? ['docx'] : [];
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

import DocxAppDocument from './DocxAppDocument';
import DocxSlide from './DocxSlide';

const FILE_PATH = '/docs/handout.docx';

function genDocxData(toolVersion = '1.0.0') {
    return {
        info: {
            toolVersion,
            pages: [
                {
                    htmlFilePath: '/previews/handout/page-1.html',
                    html: '<p>One</p>',
                    width: 800,
                    height: 1100,
                },
                {
                    htmlFilePath: '/previews/handout/page-2.html',
                    html: '<p>Two</p>',
                    width: 800,
                    height: 1000,
                },
            ],
        },
    };
}

beforeEach(() => {
    mocks.fileSources.clear();
    mocks.log.length = 0;
    mocks.getDocxDataMock.mockResolvedValue(genDocxData());
    mocks.getDocxToHtmlsVersionMock.mockResolvedValue('1.0.0');
    mocks.removeDocxHtmlsPreviewMock.mockImplementation(async () => {
        mocks.log.push('remove preview');
    });
});

describe('DocxAppDocument.getSlides', () => {
    test('a blank cover slide sized like page one, then one slide per page', async () => {
        const slides = await new DocxAppDocument(FILE_PATH).getSlides();

        expect(slides.every((slide) => slide instanceof DocxSlide)).toBe(true);
        expect(slides.map((slide) => slide.toJson())).toEqual([
            {
                id: 0,
                htmlFilePath: 'blank.html',
                html: '',
                metadata: { width: 800, height: 1100 },
                type: 'docx-slide',
            },
            {
                id: 1,
                htmlFilePath: '/previews/handout/page-1.html',
                html: '<p>One</p>',
                metadata: { width: 800, height: 1100 },
                type: 'docx-slide',
            },
            {
                id: 2,
                htmlFilePath: '/previews/handout/page-2.html',
                html: '<p>Two</p>',
                metadata: { width: 800, height: 1000 },
                type: 'docx-slide',
            },
        ]);
        expect(slides.every((slide) => slide.filePath === FILE_PATH)).toBe(
            true,
        );
        expect(mocks.getDocxDataMock).toHaveBeenCalledWith(FILE_PATH);
    });

    test('a preview made by another converter version is thrown away', async () => {
        mocks.getDocxToHtmlsVersionMock.mockResolvedValue('2.0.0');

        expect(await new DocxAppDocument(FILE_PATH).getSlides()).toEqual([]);

        expect(mocks.removeDocxHtmlsPreviewMock).toHaveBeenCalledWith(
            FILE_PATH,
        );
        expect(mocks.appLogMock).toHaveBeenCalledWith(
            'Docx version mismatch:',
            '2.0.0',
            '1.0.0',
        );
    });

    test('an unknown converter version keeps the preview', async () => {
        mocks.getDocxToHtmlsVersionMock.mockResolvedValue(null);

        const slides = await new DocxAppDocument(FILE_PATH).getSlides();

        expect(slides).toHaveLength(3);
        expect(mocks.removeDocxHtmlsPreviewMock).not.toHaveBeenCalled();
    });

    test('no preview yet, or one with no pages, gives no slides', async () => {
        const docxAppDocument = new DocxAppDocument(FILE_PATH);

        mocks.getDocxDataMock.mockResolvedValueOnce(null);
        expect(await docxAppDocument.getSlides()).toEqual([]);

        const empty = genDocxData();
        empty.info.pages = [];
        mocks.getDocxDataMock.mockResolvedValueOnce(empty);
        expect(await docxAppDocument.getSlides()).toEqual([]);
        expect(mocks.removeDocxHtmlsPreviewMock).not.toHaveBeenCalled();
    });

    test('a failed read is reported and gives no slides', async () => {
        const error = new Error('unreadable');
        mocks.getDocxDataMock.mockRejectedValue(error);

        expect(await new DocxAppDocument(FILE_PATH).getSlides()).toEqual([]);
        expect(mocks.handleErrorMock).toHaveBeenCalledWith(error);
    });

    test('finds a page by index and by id', async () => {
        const docxAppDocument = new DocxAppDocument(FILE_PATH);

        expect((await docxAppDocument.getSlideByIndex(2))?.html).toBe(
            '<p>Two</p>',
        );
        expect(await docxAppDocument.getSlideByIndex(3)).toBeNull();
        expect((await docxAppDocument.getItemById(1))?.htmlFilePath).toBe(
            '/previews/handout/page-1.html',
        );
        expect(await docxAppDocument.getItemById(9)).toBeNull();
    });
});

describe('DocxAppDocument as a read-only document', () => {
    test('asks the converter for its missing fonts and has no metadata', async () => {
        mocks.getDocxMissingFontFamilyListMock.mockResolvedValue(['Garamond']);
        const docxAppDocument = new DocxAppDocument(FILE_PATH);

        expect(await docxAppDocument.getMissingFontFamilyList()).toEqual([
            'Garamond',
        ]);
        expect(mocks.getDocxMissingFontFamilyListMock).toHaveBeenCalledWith(
            FILE_PATH,
        );
        expect(await docxAppDocument.getMetadata()).toEqual({});
        expect(docxAppDocument.isEditable).toBe(false);
    });

    test('refuses every write', () => {
        const docxAppDocument = new DocxAppDocument(FILE_PATH);

        expect(() => docxAppDocument.setMetadata({})).toThrow(
            'Method not implemented.',
        );
        expect(() => docxAppDocument.setSlides([])).toThrow(
            'Method not implemented.',
        );
        expect(() => docxAppDocument.setItemById(1, {} as DocxSlide)).toThrow(
            'Method not implemented.',
        );
        expect(() => docxAppDocument.toJson()).toThrow(
            'Method not implemented.',
        );
    });

    test("a page's menu is the static slide menu with the extras", () => {
        const docxAppDocument = new DocxAppDocument(FILE_PATH);
        const slide = {} as DocxSlide;
        const extra = [{ menuElement: 'Transition' }];

        docxAppDocument.showSlideContextMenu('event', slide, extra);
        docxAppDocument.showSlideContextMenu('event', slide);

        expect(mocks.showStaticSlideContextMenuMock.mock.calls).toEqual([
            ['event', slide, extra],
            ['event', slide, []],
        ]);
    });

    test('the document menu shows only the rows it was given', async () => {
        const docxAppDocument = new DocxAppDocument(FILE_PATH);

        await docxAppDocument.showContextMenu('event');
        expect(mocks.showAppContextMenuMock).not.toHaveBeenCalled();
        expect(mocks.appLogMock).toHaveBeenCalledWith(
            'Method not implemented.',
        );

        const extra = [{ menuElement: 'Transition' }];
        await docxAppDocument.showContextMenu('event', extra);
        expect(mocks.showAppContextMenuMock).toHaveBeenCalledExactlyOnceWith(
            'event',
            extra,
        );
    });

    test('one instance per file, compared by path', () => {
        const docxAppDocument = DocxAppDocument.getInstance(FILE_PATH);

        expect(DocxAppDocument.getInstance(FILE_PATH)).toBe(docxAppDocument);
        expect(DocxAppDocument.checkIsThisType(docxAppDocument)).toBe(true);
        expect(DocxAppDocument.checkIsThisType({ filePath: FILE_PATH })).toBe(
            false,
        );
        expect(
            docxAppDocument.checkIsSame(new DocxAppDocument(FILE_PATH)),
        ).toBe(true);
        expect(
            docxAppDocument.checkIsSame(new DocxAppDocument('/docs/b.docx')),
        ).toBe(false);
        expect(docxAppDocument.checkIsSame({ filePath: FILE_PATH })).toBe(
            false,
        );
        expect(() => DocxAppDocument.getInstance('/docs/a.pdf')).toThrow(
            'File extension pdf does not match expected extensions: docx',
        );
    });

    test('deleting clears the shared metadata first, then the preview', async () => {
        await new DocxAppDocument(FILE_PATH).preDelete();

        expect(mocks.log).toEqual([
            'background meta',
            'transition meta',
            'remove preview',
        ]);
        expect(mocks.removeDocxHtmlsPreviewMock).toHaveBeenCalledWith(
            FILE_PATH,
        );
    });
});
