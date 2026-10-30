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
                    baseDirPath: filePath.slice(0, filePath.lastIndexOf('/')),
                    fireUpdateEvent: vi.fn(),
                };
                fileSources.set(filePath, fileSource);
            }
            return fileSource;
        },
        // The order the delete clean-up steps ran in.
        log: [] as string[],
        appLogMock: vi.fn(),
        getPptxDataMock: vi.fn(),
        getPptxMissingFontFamilyListMock: vi.fn(),
        getPptxSlideAudioDataListQuickMock: vi.fn(),
        getPptxToHtmlsVersionMock: vi.fn(),
        handleErrorMock: vi.fn(),
        removePptxHtmlsPreviewMock: vi.fn(),
        showAppContextMenuMock: vi.fn(),
        showStaticSlideContextMenuMock: vi.fn(),
    };
});

vi.mock('../server/pptxHelpers', () => ({
    getPptxData: mocks.getPptxDataMock,
    getPptxMissingFontFamilyList: mocks.getPptxMissingFontFamilyListMock,
    getPptxSlideAudioDataListQuick: mocks.getPptxSlideAudioDataListQuickMock,
    getPptxToHtmlsVersion: mocks.getPptxToHtmlsVersionMock,
    removePptxHtmlsPreview: mocks.removePptxHtmlsPreviewMock,
}));
vi.mock('./appDocumentHelpers', () => ({
    BLANK_HTML_SLIDE_SRC: 'blank.html',
    showStaticSlideContextMenu: mocks.showStaticSlideContextMenuMock,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenuMock,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (iconName: string) => iconName,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
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
        return mimetypeName === 'pptx' ? ['pptx'] : [];
    },
    pathJoin: (...parts: string[]) => parts.join('/'),
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

import PptxAppDocument from './PptxAppDocument';
import PptxSlide from './PptxSlide';

const FILE_PATH = '/docs/deck.pptx';
const DIMENSIONS = { width: 1280, height: 720 };

function genPptxData() {
    return {
        info: {
            toolVersion: '1.0.0',
            dimensions: DIMENSIONS,
            slides: [
                {
                    htmlFilePath: '/previews/deck/slide-1.html',
                    subHtmlFilePaths: ['/previews/deck/slide-1-1.html'],
                    html: '<section>One</section>',
                    subHtmls: ['<section>One, step</section>'],
                    isDisabled: false,
                    note: 'Welcome',
                    images: ['images/a.png'],
                    videos: ['videos/a.mp4'],
                    audios: ['audios/a.mp3'],
                },
                {
                    // An older preview: no media lists at all.
                    htmlFilePath: '/previews/deck/slide-2.html',
                    subHtmlFilePaths: [],
                    html: '<section>Two</section>',
                    subHtmls: [],
                    isDisabled: true,
                    note: null,
                },
            ],
        },
    };
}

beforeEach(() => {
    mocks.fileSources.clear();
    mocks.log.length = 0;
    mocks.getPptxDataMock.mockResolvedValue(genPptxData());
    mocks.getPptxToHtmlsVersionMock.mockResolvedValue('1.0.0');
    mocks.removePptxHtmlsPreviewMock.mockImplementation(async () => {
        mocks.log.push('remove preview');
    });
});

describe('PptxAppDocument.getSlides', () => {
    test('a blank first slide at the deck size, then every slide with its media', async () => {
        const slides = await new PptxAppDocument(FILE_PATH).getSlides();

        expect(slides.every((slide) => slide instanceof PptxSlide)).toBe(true);
        expect(slides.map((slide) => slide.toJson())).toEqual([
            {
                id: 0,
                htmlFilePath: 'blank.html',
                subHtmlFilePaths: [],
                html: '',
                subHtmls: [],
                isDisabled: false,
                note: null,
                metadata: DIMENSIONS,
                images: [],
                videos: [],
                audios: [],
                type: 'pptx-slide',
            },
            {
                id: 1,
                htmlFilePath: '/previews/deck/slide-1.html',
                subHtmlFilePaths: ['/previews/deck/slide-1-1.html'],
                html: '<section>One</section>',
                subHtmls: ['<section>One, step</section>'],
                isDisabled: false,
                note: 'Welcome',
                metadata: DIMENSIONS,
                images: ['images/a.png'],
                videos: ['videos/a.mp4'],
                audios: ['audios/a.mp3'],
                type: 'pptx-slide',
            },
            {
                id: 2,
                htmlFilePath: '/previews/deck/slide-2.html',
                subHtmlFilePaths: [],
                html: '<section>Two</section>',
                subHtmls: [],
                isDisabled: true,
                note: null,
                metadata: DIMENSIONS,
                images: [],
                videos: [],
                audios: [],
                type: 'pptx-slide',
            },
        ]);
        expect(slides[1].audioFilePaths).toEqual([
            '/previews/deck/audios/a.mp3',
        ]);
    });

    test('a preview made by another converter version is thrown away', async () => {
        mocks.getPptxToHtmlsVersionMock.mockResolvedValue('2.0.0');

        expect(await new PptxAppDocument(FILE_PATH).getSlides()).toEqual([]);

        expect(mocks.removePptxHtmlsPreviewMock).toHaveBeenCalledWith(
            FILE_PATH,
        );
        expect(mocks.appLogMock).toHaveBeenCalledWith(
            'Pptx version mismatch:',
            '2.0.0',
            '1.0.0',
        );
    });

    test('no preview yet gives no slides and removes nothing', async () => {
        mocks.getPptxDataMock.mockResolvedValue(null);

        expect(await new PptxAppDocument(FILE_PATH).getSlides()).toEqual([]);
        expect(mocks.removePptxHtmlsPreviewMock).not.toHaveBeenCalled();
    });

    test('a failed read is reported and gives no slides', async () => {
        const error = new Error('unreadable');
        mocks.getPptxDataMock.mockRejectedValue(error);

        expect(await new PptxAppDocument(FILE_PATH).getSlides()).toEqual([]);
        expect(mocks.handleErrorMock).toHaveBeenCalledWith(error);
    });

    test('finds a slide by index and by id', async () => {
        const pptxAppDocument = new PptxAppDocument(FILE_PATH);

        expect((await pptxAppDocument.getSlideByIndex(2))?.isDisabled).toBe(
            true,
        );
        expect(await pptxAppDocument.getSlideByIndex(3)).toBeNull();
        expect((await pptxAppDocument.getItemById(1))?.note).toBe('Welcome');
        expect(await pptxAppDocument.getItemById(7)).toBeNull();
    });
});

describe('PptxAppDocument as a read-only document', () => {
    test('audio paths come from the quick reader, tagged with this deck', async () => {
        mocks.getPptxSlideAudioDataListQuickMock.mockResolvedValue([
            { src: 'file:///a.mp3', name: 'a.mp3' },
        ]);

        expect(
            await new PptxAppDocument(FILE_PATH).getAudioFilePaths(),
        ).toEqual([
            { src: 'file:///a.mp3', name: 'a.mp3', slideFilePath: FILE_PATH },
        ]);
        expect(mocks.getPptxSlideAudioDataListQuickMock).toHaveBeenCalledWith(
            FILE_PATH,
        );
        // Not through the full slide read (EN-12).
        expect(mocks.getPptxDataMock).not.toHaveBeenCalled();
    });

    test('asks the converter for its missing fonts and has no metadata', async () => {
        mocks.getPptxMissingFontFamilyListMock.mockResolvedValue(['Calibri']);
        const pptxAppDocument = new PptxAppDocument(FILE_PATH);

        expect(await pptxAppDocument.getMissingFontFamilyList()).toEqual([
            'Calibri',
        ]);
        expect(await pptxAppDocument.getMetadata()).toEqual({});
    });

    test('refuses every write', () => {
        const pptxAppDocument = new PptxAppDocument(FILE_PATH);

        expect(() => pptxAppDocument.setMetadata({})).toThrow(
            'Method not implemented.',
        );
        expect(() => pptxAppDocument.setSlides([])).toThrow(
            'Method not implemented.',
        );
        expect(() => pptxAppDocument.setItemById(1, {} as PptxSlide)).toThrow(
            'Method not implemented.',
        );
        expect(() => pptxAppDocument.toJson()).toThrow(
            'Method not implemented.',
        );
    });

    test("a slide's menu is the static slide menu with the extras", () => {
        const pptxAppDocument = new PptxAppDocument(FILE_PATH);
        const slide = {} as PptxSlide;

        pptxAppDocument.showSlideContextMenu('event', slide);

        expect(mocks.showStaticSlideContextMenuMock).toHaveBeenCalledWith(
            'event',
            slide,
            [],
        );
    });

    test('the document menu offers Reload before the extras', async () => {
        const pptxAppDocument = new PptxAppDocument(FILE_PATH);
        const extra = { menuElement: 'Transition' };

        await pptxAppDocument.showContextMenu('event', [extra]);

        const [, menuItems] = mocks.showAppContextMenuMock.mock.lastCall as [
            unknown,
            { menuElement: string; onSelect?: () => void }[],
        ];
        expect(menuItems.map((item) => item.menuElement)).toEqual([
            'Reload',
            'Transition',
        ]);
        menuItems[0].onSelect?.();
        expect(
            mocks.getFileSource(FILE_PATH).fireUpdateEvent,
        ).toHaveBeenCalledOnce();

        await pptxAppDocument.showContextMenu('event');
        const [, onlyReload] = mocks.showAppContextMenuMock.mock.lastCall as [
            unknown,
            { menuElement: string }[],
        ];
        expect(onlyReload.map((item) => item.menuElement)).toEqual(['Reload']);
    });

    test('one instance per file, compared by path', () => {
        const pptxAppDocument = PptxAppDocument.getInstance(FILE_PATH);

        expect(PptxAppDocument.getInstance(FILE_PATH)).toBe(pptxAppDocument);
        expect(PptxAppDocument.checkIsThisType(pptxAppDocument)).toBe(true);
        expect(
            pptxAppDocument.checkIsSame(new PptxAppDocument(FILE_PATH)),
        ).toBe(true);
        expect(
            pptxAppDocument.checkIsSame(new PptxAppDocument('/docs/b.pptx')),
        ).toBe(false);
        expect(pptxAppDocument.checkIsSame({ filePath: FILE_PATH })).toBe(
            false,
        );
    });

    test('deleting clears the shared metadata first, then the preview', async () => {
        await new PptxAppDocument(FILE_PATH).preDelete();

        expect(mocks.log).toEqual([
            'background meta',
            'transition meta',
            'remove preview',
        ]);
        expect(mocks.removePptxHtmlsPreviewMock).toHaveBeenCalledWith(
            FILE_PATH,
        );
    });
});
