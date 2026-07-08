import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    deleteMetaDataFileMock,
    createNewFileDetailMock,
    getMimetypeExtensionsMock,
    handleErrorMock,
    fileSourceGetInstanceMock,
    editingHistoryGetInstanceMock,
    genSelectedSlidesContextMenuItemsMock,
    genSlideContextMenuItemsMock,
    showSimpleToastMock,
    showAppContextMenuMock,
    checkIsImagesInClipboardMock,
    readImagesFromClipboardMock,
    createNewSlidesFromDroppedDataMock,
    fixMissingFontFamiliesMock,
    getFontFamiliesMock,
    notifyNewElementAddedMock,
    tranMock,
    canvasItemGenDefaultItemMock,
    getDefaultScreenDisplayMock,
} = vi.hoisted(() => ({
    deleteMetaDataFileMock: vi.fn(),
    createNewFileDetailMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(),
    handleErrorMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    editingHistoryGetInstanceMock: vi.fn(),
    genSelectedSlidesContextMenuItemsMock: vi.fn(),
    genSlideContextMenuItemsMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    showAppContextMenuMock: vi.fn(),
    checkIsImagesInClipboardMock: vi.fn(),
    readImagesFromClipboardMock: vi.fn(),
    createNewSlidesFromDroppedDataMock: vi.fn(),
    fixMissingFontFamiliesMock: vi.fn(),
    getFontFamiliesMock: vi.fn(),
    notifyNewElementAddedMock: vi.fn(),
    tranMock: vi.fn(),
    canvasItemGenDefaultItemMock: vi.fn(),
    getDefaultScreenDisplayMock: vi.fn(),
}));

vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: {
        getInstance: editingHistoryGetInstanceMock,
    },
}));

vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        deleteMetaDataFile: deleteMetaDataFileMock,
    },
}));

vi.mock('../server/fileHelpers', () => ({
    createNewFileDetail: createNewFileDetailMock,
    getMimetypeExtensions: getMimetypeExtensionsMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
    checkIsSameValues: (left: unknown, right: unknown) => {
        return JSON.stringify(left) === JSON.stringify(right);
    },
    toMaxId: (ids: number[]) => {
        return ids.length === 0 ? 0 : Math.max(...ids);
    },
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

vi.mock('./appDocumentHelpers', () => ({
    genSelectedSlidesContextMenuItems: genSelectedSlidesContextMenuItemsMock,
    genSlideContextMenuItems: genSlideContextMenuItemsMock,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../server/appHelpers', () => ({
    checkIsImagesInClipboard: checkIsImagesInClipboardMock,
    readImagesFromClipboard: readImagesFromClipboardMock,
}));

vi.mock('../app-document-presenter/items/appDocumentHelpers', () => ({
    APP_DOCUMENT_ITEM_CLASS: 'vary-app-document-item',
    createNewSlidesFromDroppedData: createNewSlidesFromDroppedDataMock,
}));

vi.mock('../server/fontHelpers', () => ({
    fixMissingFontFamilies: fixMissingFontFamiliesMock,
    getFontFamilies: getFontFamiliesMock,
}));

vi.mock('../slide-editor/canvas/CanvasItemText', () => ({
    default: {
        genDefaultItem: canvasItemGenDefaultItemMock,
    },
}));

vi.mock('../helper/domHelpers', () => ({
    notifyNewElementAdded: notifyNewElementAddedMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: tranMock,
}));

vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: getDefaultScreenDisplayMock,
}));

import AppDocument, { type AppDocumentType } from './AppDocument';
import Slide from './Slide';

type TestHistoryManager = ReturnType<typeof createHistoryManager>;

type AppDocumentJson = Awaited<ReturnType<AppDocument['getJsonData']>>;
type HistoryTextInput = AppDocumentJson | string | null;

function createHistoryManager() {
    let currentHistory: string | null = null;
    let originalData: string | null = null;

    return {
        __setCurrentHistory(value: string | null) {
            currentHistory = value;
        },
        __setOriginalData(value: string | null) {
            originalData = value;
        },
        getOriginalData: vi.fn(async () => originalData),
        getCurrentHistory: vi.fn(async () => currentHistory),
        addHistory: vi.fn((value: string) => {
            currentHistory = value;
        }),
        save: vi.fn(async () => true),
        discard: vi.fn(),
        undo: vi.fn(() => 'undo-result'),
        redo: vi.fn(() => 'redo-result'),
    };
}

const historyManagers = new Map<string, TestHistoryManager>();

function getHistoryManager(filePath: string) {
    if (!historyManagers.has(filePath)) {
        historyManagers.set(filePath, createHistoryManager());
    }
    const historyManager = historyManagers.get(filePath);
    if (historyManager === undefined) {
        throw new Error(`Missing history manager for ${filePath}`);
    }
    return historyManager;
}

function getMetadata() {
    return {
        app: 'OpenWorship',
        fileVersion: 1,
        initDate: '2026-01-01T00:00:00.000Z',
    };
}

function toHistoryText(value: HistoryTextInput) {
    if (value === null || typeof value === 'string') {
        return value;
    }
    return JSON.stringify(value);
}

function setHistory(
    filePath: string,
    currentData: HistoryTextInput,
    originalData: HistoryTextInput = currentData,
) {
    const history = getHistoryManager(filePath);
    history.__setCurrentHistory(toHistoryText(currentData));
    history.__setOriginalData(toHistoryText(originalData));
    return history;
}

function createDocumentJson(ids: number[]): AppDocumentType {
    return AppDocument.genNewJsonData<AppDocumentType>({
        items: ids.map((id) => Slide.defaultSlideData(id)),
    });
}

function createClipboardItem(text: string) {
    return {
        types: ['text/plain'],
        getType: vi.fn(async () => new Blob([text], { type: 'text/plain' })),
    };
}

describe('AppDocument', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        historyManagers.clear();

        getMimetypeExtensionsMock.mockReturnValue(['ows', 'preview']);
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            const normalized = filePath.replaceAll('\\', '/');
            const fullName = normalized.split('/').at(-1) ?? normalized;
            const dotIndex = fullName.lastIndexOf('.');
            const extension =
                dotIndex >= 0 ? fullName.substring(dotIndex + 1) : '';
            return {
                filePath,
                fullName,
                extension,
            };
        });
        editingHistoryGetInstanceMock.mockImplementation((filePath: string) => {
            return getHistoryManager(filePath);
        });
        createNewFileDetailMock.mockResolvedValue('/docs/new-file.ows');
        genSlideContextMenuItemsMock.mockReturnValue([
            { menuElement: 'Slide Item' },
        ]);
        genSelectedSlidesContextMenuItemsMock.mockReturnValue([
            { menuElement: 'Slides Item' },
        ]);
        checkIsImagesInClipboardMock.mockResolvedValue(false);
        readImagesFromClipboardMock.mockImplementation(async function* () {});
        fixMissingFontFamiliesMock.mockResolvedValue(undefined);
        getFontFamiliesMock.mockResolvedValue([]);
        tranMock.mockImplementation((value: string) => value);
        canvasItemGenDefaultItemMock.mockReturnValue({
            toJson: () => ({ type: 'text', text: 'Welcome' }),
        });
        getDefaultScreenDisplayMock.mockReturnValue({
            bounds: { width: 1280, height: 720 },
        });

        vi.stubGlobal('document', {
            querySelector: vi.fn(() => ({ nodeName: 'DIV' })),
        });
        vi.stubGlobal('navigator', {
            clipboard: {
                read: vi.fn(async () => []),
                writeText: vi.fn(),
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('creates default app-document data and validates payloads', async () => {
        const extraJson = AppDocument.genNewExtraJsonData();

        expect(extraJson.items).toHaveLength(1);
        expect(extraJson.items[0]).toMatchObject({
            id: 0,
            metadata: { width: 1280, height: 720 },
        });
        expect(extraJson.items[0].canvasItems).toHaveLength(1);

        expect(() =>
            AppDocument.validate({
                metadata: getMetadata(),
                items: [Slide.defaultSlideData(1)],
            } as any),
        ).not.toThrow();
        expect(() =>
            AppDocument.validate({
                metadata: getMetadata(),
                items: 'bad',
            } as any),
        ).toThrow('Invalid app document data');

        await expect(AppDocument.create('/docs', 'new-file')).resolves.toEqual({
            filePath: '/docs/new-file.ows',
            fullName: 'new-file.ows',
            extension: 'ows',
        });
        expect(createNewFileDetailMock).toHaveBeenCalledWith(
            '/docs',
            'new-file',
            expect.any(String),
            'appDocument',
        );
    });

    test('recovers from corrupted history or resets to a new document', async () => {
        const currentFilePath = '/docs/corrupted.ows';
        const validOriginal = createDocumentJson([1, 2]);
        const currentHistory = setHistory(
            currentFilePath,
            '{"metadata":null}',
            validOriginal,
        );
        const currentDocument = new AppDocument(currentFilePath);

        await expect(currentDocument.getJsonData()).resolves.toEqual(
            validOriginal,
        );
        expect(currentHistory.discard).toHaveBeenCalledTimes(1);
        expect(showSimpleToastMock).toHaveBeenNthCalledWith(
            1,
            'Corrupted Document',
            'Document data will be reset to the last saved state.',
        );

        const brokenFilePath = '/docs/broken.ows';
        const brokenHistory = setHistory(
            brokenFilePath,
            '{"metadata":null}',
            '{"metadata":null}',
        );
        const brokenDocument = new AppDocument(brokenFilePath);

        const resetData = await brokenDocument.getJsonData();

        expect(resetData).toMatchObject({
            metadata: expect.objectContaining({ app: 'OpenWorship' }),
            items: [expect.any(Object)],
        });
        expect(brokenHistory.addHistory).toHaveBeenCalledTimes(1);
        expect(brokenHistory.save).toHaveBeenCalledTimes(1);
        expect(showSimpleToastMock).toHaveBeenLastCalledWith(
            'Corrupted Document',
            'Document data will be reset to the last saved state.',
        );
    });

    test('reads slides, tracks changes and repairs missing fonts', async () => {
        const filePath = '/docs/live.ows';
        const currentData = createDocumentJson([1, 2]);
        const originalData = createDocumentJson([1, 2]);
        currentData.items[1].name = 'Updated title';
        originalData.items[1].name = 'Original title';
        setHistory(filePath, currentData, originalData);

        const unavailableFontsSpy = vi
            .spyOn(Slide.prototype, 'getUnavailableFontFamilies')
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(['Missing Font']);

        const documentSource = new AppDocument(filePath);
        const slides = await documentSource.getSlides();

        expect(slides).toHaveLength(2);
        expect(slides[0].isChanged).toBe(false);
        expect(slides[1].isChanged).toBe(true);
        expect(fixMissingFontFamiliesMock).toHaveBeenCalledWith(
            expect.any(Set),
            filePath,
        );
        expect(
            Array.from(
                fixMissingFontFamiliesMock.mock.calls[0][0] as Set<string>,
            ),
        ).toEqual(['Missing Font']);

        unavailableFontsSpy.mockRestore();
    });

    test('falls back to an error slide when slide deserialization fails', async () => {
        const filePath = '/docs/errors.ows';
        setHistory(filePath, createDocumentJson([1, 2]));

        const fromJson = Slide.fromJson.bind(Slide);
        const fromJsonSpy = vi
            .spyOn(Slide, 'fromJson')
            .mockImplementation((json: any, slideFilePath: string) => {
                if (json.id === 2) {
                    throw new Error('bad slide');
                }
                return fromJson(json, slideFilePath);
            });
        const unavailableFontsSpy = vi
            .spyOn(Slide.prototype, 'getUnavailableFontFamilies')
            .mockResolvedValue([]);

        const documentSource = new AppDocument(filePath);
        const slides = await documentSource.getSlides();

        expect(slides[1].isError).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Instantiating Slide',
            'bad slide',
        );

        fromJsonSpy.mockRestore();
        unavailableFontsSpy.mockRestore();
    });

    test('finds, updates and retrieves slides by id and index', async () => {
        const filePath = '/docs/update.ows';
        setHistory(filePath, createDocumentJson([1, 2]));

        const documentSource = new AppDocument(filePath);
        const slides = await documentSource.getSlides();
        const targetSlide = slides[1];

        expect(await documentSource.getSlideIndex(targetSlide)).toBe(1);
        expect(await documentSource.getSlideByIndex(9)).toBeNull();
        expect(await documentSource.getItemById(targetSlide.id)).toBeInstanceOf(
            Slide,
        );
        expect(await documentSource.getItemById(999)).toBeNull();

        targetSlide.name = 'Renamed slide';
        await documentSource.updateSlide(targetSlide);

        expect((await documentSource.getSlideByIndex(1))?.name).toBe(
            'Renamed slide',
        );
        expect(await documentSource.getMaxSlideId()).toBe(2);
        expect(() => documentSource.setItemById(1, targetSlide)).toThrow(
            'Method not implemented.',
        );
    });

    test('duplicates, reorders, adds and deletes slides while notifying the DOM', async () => {
        const filePath = '/docs/ordering.ows';
        setHistory(filePath, createDocumentJson([1, 2]));

        const documentSource = new AppDocument(filePath);
        const [slide1, slide2] = await documentSource.getSlides();

        await documentSource.duplicateSlides([slide1]);
        expect(
            (await documentSource.getSlides()).map((slide) => slide.id),
        ).toEqual([1, 3, 2]);
        const firstNotify = notifyNewElementAddedMock.mock
            .calls[0][0] as () => unknown;
        firstNotify();
        expect((globalThis.document as any).querySelector).toHaveBeenCalledWith(
            '.vary-app-document-item[data-vary-app-document-item-id="3"]',
        );

        await documentSource.moveSlideToIndex(slide2, 0);
        expect(
            (await documentSource.getSlides()).map((slide) => slide.id),
        ).toEqual([2, 1, 3]);

        const extraSlide = new Slide(
            '/other/path.ows',
            Slide.defaultSlideData(-1),
        );
        await documentSource.addSlides([extraSlide]);
        expect(
            (await documentSource.getSlides()).map((slide) => slide.id),
        ).toEqual([2, 1, 3, 4]);
        expect((await documentSource.getSlideByIndex(3))?.filePath).toBe(
            filePath,
        );

        await documentSource.swapSlides(0, 1);
        expect(
            (await documentSource.getSlides()).map((slide) => slide.id),
        ).toEqual([1, 2, 3, 4]);

        const firstSlide = (await documentSource.getSlides())[0];
        await documentSource.moveSlide(firstSlide, false);
        expect(
            (await documentSource.getSlides()).map((slide) => slide.id),
        ).toEqual([2, 3, 4, 1]);

        await documentSource.addNewSlide();
        expect(
            (await documentSource.getSlides()).map((slide) => slide.id),
        ).toEqual([2, 3, 4, 1, 5]);

        const slidesToDelete = (await documentSource.getSlides()).filter(
            (slide) => {
                return slide.id === 3 || slide.id === 5;
            },
        );
        await documentSource.deleteSlides(slidesToDelete);

        expect(
            (await documentSource.getSlides()).map((slide) => slide.id),
        ).toEqual([2, 4, 1]);
    });

    test('detects and repairs wrong slide dimensions', async () => {
        const filePath = '/docs/dimensions.ows';
        const jsonData = createDocumentJson([1, 2]);
        jsonData.items[0].metadata = { width: 320, height: 180 };
        jsonData.items[1].metadata = { width: 400, height: 300 };
        setHistory(filePath, jsonData);

        const documentSource = new AppDocument(filePath);

        expect(
            AppDocument.toWrongDimensionString({
                slide: { width: 320, height: 180 },
                display: { width: 800, height: 600 },
            }),
        ).toBe('⚠️ slide:320x180 display:800x600');

        const wrong = await documentSource.getIsWrongDimension({
            bounds: { width: 800, height: 600 },
        } as any);
        expect(wrong).toEqual({
            slide: expect.objectContaining({ width: 320, height: 180 }),
            display: { width: 800, height: 600 },
        });

        const targetSlide = (await documentSource.getSlides())[0];
        await documentSource.changeSlidesDimension(
            { width: 500, height: 500 },
            targetSlide,
        );
        expect((await documentSource.getSlideByIndex(0))?.metadata).toEqual({
            width: 500,
            height: 500,
        });
        expect((await documentSource.getSlideByIndex(1))?.metadata).toEqual({
            width: 400,
            height: 300,
        });

        await documentSource.fixSlidesDimensionForDisplay({
            bounds: { width: 800, height: 600 },
        } as any);
        expect(
            (await documentSource.getSlides()).map((slide) => slide.metadata),
        ).toEqual([
            { width: 800, height: 600 },
            { width: 800, height: 600 },
        ]);
    });

    test('renders document context menus and image-paste actions', async () => {
        const filePath = '/docs/menu.ows';
        setHistory(filePath, createDocumentJson([1, 2]));

        const documentSource = new AppDocument(filePath);
        const slides = await documentSource.getSlides();

        documentSource.showSlideContextMenu(
            'slide-event',
            slides[0],
            [{ menuElement: 'Extra' }],
            true,
        );
        expect(showAppContextMenuMock).toHaveBeenNthCalledWith(
            1,
            'slide-event',
            [{ menuElement: 'Slide Item' }, { menuElement: 'Extra' }],
        );

        documentSource.showHoldingSlidesContextMenu('holding-event', [
            slides[0],
        ]);
        expect(showAppContextMenuMock).toHaveBeenNthCalledWith(
            2,
            'holding-event',
            [{ menuElement: 'Slides Item' }],
        );

        const copiedSlidesSpy = vi
            .spyOn(AppDocument, 'getCopiedSlides')
            .mockResolvedValue([slides[0]]);
        const addSlidesSpy = vi
            .spyOn(documentSource, 'addSlides')
            .mockResolvedValue(undefined as never);
        const addNewSlideSpy = vi
            .spyOn(documentSource, 'addNewSlide')
            .mockResolvedValue(undefined as never);
        checkIsImagesInClipboardMock.mockResolvedValue(true);
        const clipboardBlobA = new Blob(['first']);
        const clipboardBlobB = new Blob(['second']);
        readImagesFromClipboardMock.mockImplementation(async function* () {
            yield clipboardBlobA;
            yield clipboardBlobB;
        });

        showAppContextMenuMock.mockClear();
        await documentSource.showContextMenu('doc-event');

        const menuItems = showAppContextMenuMock.mock.calls[0][1] as any[];
        await menuItems
            .find((item) => item.menuElement === 'Paste')
            ?.onSelect();
        menuItems.find((item) => item.menuElement === 'New Slide')?.onSelect();
        await menuItems
            .find((item) => item.menuElement === 'Paste Image')
            ?.onSelect();

        expect(addSlidesSpy).toHaveBeenCalledWith([slides[0]]);
        expect(addNewSlideSpy).toHaveBeenCalledTimes(1);
        expect(createNewSlidesFromDroppedDataMock).toHaveBeenCalledWith(
            documentSource,
            [clipboardBlobA, clipboardBlobB],
        );

        copiedSlidesSpy.mockRestore();
        addSlidesSpy.mockRestore();
        addNewSlideSpy.mockRestore();
    });

    test('reads and writes copied slides through the clipboard API', async () => {
        const navigatorClipboard = (globalThis.navigator as any).clipboard;
        const slide1 = new Slide('/docs/main.ows', Slide.defaultSlideData(11));
        const slide2 = new Slide('/docs/main.ows', Slide.defaultSlideData(12));

        navigatorClipboard.read.mockResolvedValue([
            createClipboardItem(`${slide1.clipboardSerialize()}\nnot-a-slide`),
            {
                types: ['text/html'],
                getType: vi.fn(),
            },
        ]);

        const copiedSlides = await AppDocument.getCopiedSlides();
        expect(copiedSlides).toHaveLength(1);
        expect(copiedSlides[0]).toBeInstanceOf(Slide);
        expect(copiedSlides[0].id).toBe(11);

        AppDocument.setCopiedSlides([slide1, slide2]);
        expect(navigatorClipboard.writeText).toHaveBeenCalledWith(
            `${slide1.clipboardSerialize()}\n${slide2.clipboardSerialize()}`,
        );
    });
});
