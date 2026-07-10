import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    showAppAlertMock,
    showAppConfirmMock,
    selectVarySlideMock,
    dirSourceGetInstanceMock,
    handleErrorMock,
    showAppContextMenuMock,
    openSlideQuickEditMock,
    showSimpleToastMock,
    showProgressBarMock,
    hideProgressBarMock,
    convertToPdfMock,
    showFileOrDirExplorerMock,
    genShowOnScreensContextMenuMock,
    handleSlideSelectingMock,
    getDataListMock,
    getSettingMock,
    setSettingMock,
    useFileSourceEventsMock,
    useScreenVaryAppDocumentManagerEventsMock,
    useAppEffectMock,
    checkSelectedFilePathExistMock,
    getAppDocumentListOnScreenSettingMock,
    appLogMock,
    getAttachedBackgroundMock,
    getSelectedVaryAppDocumentFilePathWithEnsureMock,
    setSelectedVaryAppDocumentFilePathMock,
    getMenuTitleRevealFileMock,
    getSlidesCountMock,
    fileSourceGetInstanceMock,
    fsCheckFileExistMock,
    fsCopyFilePathToPathMock,
    appDocumentSetCopiedSlidesMock,
    tranMock,
    appProviderMock,
} = vi.hoisted(() => ({
    showAppAlertMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    selectVarySlideMock: vi.fn(),
    dirSourceGetInstanceMock: vi.fn(),
    handleErrorMock: vi.fn(),
    showAppContextMenuMock: vi.fn(),
    openSlideQuickEditMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    showProgressBarMock: vi.fn(),
    hideProgressBarMock: vi.fn(),
    convertToPdfMock: vi.fn(),
    showFileOrDirExplorerMock: vi.fn(),
    genShowOnScreensContextMenuMock: vi.fn(),
    handleSlideSelectingMock: vi.fn(),
    getDataListMock: vi.fn(),
    getSettingMock: vi.fn(),
    setSettingMock: vi.fn(),
    useFileSourceEventsMock: vi.fn(),
    useScreenVaryAppDocumentManagerEventsMock: vi.fn(),
    useAppEffectMock: vi.fn(),
    checkSelectedFilePathExistMock: vi.fn(),
    getAppDocumentListOnScreenSettingMock: vi.fn(),
    appLogMock: vi.fn(),
    getAttachedBackgroundMock: vi.fn(),
    getSelectedVaryAppDocumentFilePathWithEnsureMock: vi.fn(),
    setSelectedVaryAppDocumentFilePathMock: vi.fn(),
    getMenuTitleRevealFileMock: vi.fn(),
    getSlidesCountMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    fsCopyFilePathToPathMock: vi.fn(),
    appDocumentSetCopiedSlidesMock: vi.fn(),
    tranMock: vi.fn(),
    appProviderMock: {
        isPagePresenter: false,
        isPageAppDocumentEditor: false,
        pathUtils: {
            join: (...parts: string[]) => parts.join('/'),
        },
    },
}));

function getOrCreateInstance<T>(
    instances: Map<string, T>,
    filePath: string,
    create: () => T,
) {
    if (!instances.has(filePath)) {
        instances.set(filePath, create());
    }
    const instance = instances.get(filePath);
    if (instance === undefined) {
        throw new Error(`Missing instance for ${filePath}`);
    }
    return instance;
}

vi.mock('../lang/langHelpers', () => ({ tran: tranMock }));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: showAppAlertMock,
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../event/VaryAppDocumentEventListener', () => ({
    default: { selectVarySlide: selectVarySlideMock },
}));

vi.mock('../helper/DirSource', () => ({
    default: { getInstance: dirSourceGetInstanceMock },
}));

vi.mock('../helper/errorHelpers', () => ({ handleError: handleErrorMock }));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../server/appProvider', () => ({ default: appProviderMock }));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: fsCheckFileExistMock,
    fsCopyFilePathToPath: fsCopyFilePathToPathMock,
    getFileDotExtension: (fileName: string) => {
        return fileName.substring(fileName.lastIndexOf('.'));
    },
    getFileFullName: (file: { name?: string }) => file.name ?? '',
    getFileName: (fileFullName: string) => {
        return fileFullName.substring(0, fileFullName.lastIndexOf('.'));
    },
    getTempPath: () => '/tmp',
    KEY_SEPARATOR: '<id>',
    mimetypeDocx: { extensions: ['.docx'] },
    mimetypePdf: { extensions: ['.pdf'] },
    mimetypePptx: { extensions: ['.pptx'] },
    pathBasename: (filePath: string) => filePath.split('/').at(-1) ?? filePath,
}));

vi.mock('../app-document-presenter/SlideEditHandlerComp', () => ({
    openSlideQuickEdit: openSlideQuickEditMock,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('./Slide', () => {
    return {
        default: class Slide {
            filePath: string;
            id: number;
            private readonly json: any;

            constructor(filePath: string, json: any) {
                this.filePath = filePath;
                this.id = json.id;
                this.json = json;
            }

            toJson() {
                return this.json;
            }

            async getItemFilePath() {
                return this.json.itemFilePath ?? null;
            }
        },
    };
});

vi.mock('./AppDocument', () => {
    return {
        default: class AppDocument {
            public static readonly instances = new Map<string, AppDocument>();
            public static readonly setCopiedSlides =
                appDocumentSetCopiedSlidesMock;
            filePath: string;
            items: any[] = [];
            duplicateSlides = vi.fn();
            moveSlide = vi.fn();
            updateSlide = vi.fn();
            deleteSlides = vi.fn();
            getIsWrongDimension = vi.fn(async () => null);

            constructor(filePath: string) {
                this.filePath = filePath;
            }

            async getItemById(id: number) {
                return this.items.find((item) => item.id === id) ?? null;
            }

            async getSlides() {
                return this.items;
            }

            static getInstance(filePath: string) {
                return getOrCreateInstance(this.instances, filePath, () => {
                    return new this(filePath);
                });
            }

            static checkIsThisType(item: unknown) {
                return item instanceof this;
            }
        },
    };
});

vi.mock('./PdfAppDocument', () => {
    return {
        default: class PdfAppDocument {
            public static readonly instances = new Map<
                string,
                PdfAppDocument
            >();

            filePath: string;
            items: any[] = [];

            constructor(filePath: string) {
                this.filePath = filePath;
            }

            async getItemById(id: number) {
                return this.items.find((item) => item.id === id) ?? null;
            }

            async getSlides() {
                return this.items;
            }

            static getInstance(filePath: string) {
                return getOrCreateInstance(this.instances, filePath, () => {
                    return new this(filePath);
                });
            }
        },
    };
});

vi.mock('./PptxAppDocument', () => {
    return {
        default: class PptxAppDocument {
            public static readonly instances = new Map<
                string,
                PptxAppDocument
            >();

            filePath: string;
            items: any[] = [];

            constructor(filePath: string) {
                this.filePath = filePath;
            }

            async getItemById(id: number) {
                return this.items.find((item) => item.id === id) ?? null;
            }

            async getSlides() {
                return this.items;
            }

            static getInstance(filePath: string) {
                return getOrCreateInstance(this.instances, filePath, () => {
                    return new this(filePath);
                });
            }
        },
    };
});

vi.mock('./DocxAppDocument', () => {
    return {
        default: class DocxAppDocument {
            public static readonly instances = new Map<
                string,
                DocxAppDocument
            >();

            filePath: string;
            items: any[] = [];

            constructor(filePath: string) {
                this.filePath = filePath;
            }

            async getItemById(id: number) {
                return this.items.find((item) => item.id === id) ?? null;
            }

            async getSlides() {
                return this.items;
            }

            static getInstance(filePath: string) {
                return getOrCreateInstance(this.instances, filePath, () => {
                    return new this(filePath);
                });
            }
        },
    };
});

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: showProgressBarMock,
    hideProgressBar: hideProgressBarMock,
}));

vi.mock('../server/appHelpers', () => ({
    convertToPdf: convertToPdfMock,
    showFileOrDirExplorer: showFileOrDirExplorerMock,
}));

vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: genShowOnScreensContextMenuMock,
}));

vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: {
        handleSlideSelecting: handleSlideSelectingMock,
        getDataList: getDataListMock,
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));

vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: useFileSourceEventsMock,
}));

vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenVaryAppDocumentManagerEvents:
        useScreenVaryAppDocumentManagerEventsMock,
}));

vi.mock('../helper/appHooks', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: useAppEffectMock,
        useAppCurrentRef: (target: any) => {
            const ref = React.useRef(target);
            ref.current = target;
            return ref;
        },
    };
});

vi.mock('../others/selectedHelpers', () => ({
    checkSelectedFilePathExist: checkSelectedFilePathExistMock,
}));

vi.mock('../_screen/preview/screenPreviewerHelpers', () => ({
    getAppDocumentListOnScreenSetting: getAppDocumentListOnScreenSettingMock,
}));

vi.mock('../helper/loggerHelpers', () => ({ appLog: appLogMock }));

vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        getAttachedBackground: getAttachedBackgroundMock,
    },
}));

vi.mock('./selectedVaryAppDocumentHelpers', () => ({
    SELECTED_APP_DOCUMENT_SETTING_NAME: 'selected-vary-app-document',
    getSelectedVaryAppDocumentFilePathWithEnsure:
        getSelectedVaryAppDocumentFilePathWithEnsureMock,
    setSelectedVaryAppDocumentFilePath: setSelectedVaryAppDocumentFilePathMock,
}));

vi.mock('../others/color/colorHelpers', () => ({ HEX_COLOR_BLACK: '#000000' }));

vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: getMenuTitleRevealFileMock,
}));

vi.mock('../server/pptxHelpers', () => ({
    getSlidesCount: getSlidesCountMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: { getInstance: fileSourceGetInstanceMock },
}));

import AppDocument from './AppDocument';
import DocxAppDocument from './DocxAppDocument';
import PdfAppDocument from './PdfAppDocument';
import PptxAppDocument from './PptxAppDocument';
import Slide from './Slide';
import * as appDocumentHelpers from './appDocumentHelpers';

function createSlide(
    filePath: string,
    id: number,
    itemFilePath: string | null = null,
) {
    return new Slide(filePath, {
        id,
        itemFilePath,
        metadata: { width: 100, height: 50 },
        canvasItems: [],
    } as any);
}

describe('appDocumentHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();

        appProviderMock.isPagePresenter = false;
        appProviderMock.isPageAppDocumentEditor = false;
        tranMock.mockImplementation((value: string) => value);
        genShowOnScreensContextMenuMock.mockImplementation(
            (handler: (event: any) => void) => {
                return [
                    {
                        menuElement: 'Show On Screens',
                        onSelect: (event: any) => handler(event),
                    },
                ];
            },
        );
        dirSourceGetInstanceMock.mockResolvedValue({
            getFilePaths: vi.fn(async () => []),
        });
        getDataListMock.mockReturnValue([]);
        checkSelectedFilePathExistMock.mockResolvedValue(true);
        getAppDocumentListOnScreenSettingMock.mockReturnValue({});
        getSelectedVaryAppDocumentFilePathWithEnsureMock.mockResolvedValue(
            null,
        );
        getSettingMock.mockReturnValue('');
        getMenuTitleRevealFileMock.mockReturnValue('Reveal');
        showAppConfirmMock.mockResolvedValue(false);
        fsCheckFileExistMock.mockResolvedValue(false);
        fsCopyFilePathToPathMock.mockResolvedValue('/tmp/copied.docx');
        getSlidesCountMock.mockResolvedValue(0);
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            const normalized = filePath.replaceAll('\\', '/');
            const fullName = normalized.split('/').at(-1) ?? normalized;
            return {
                baseDirPath: normalized.includes('/')
                    ? normalized.substring(0, normalized.lastIndexOf('/'))
                    : '',
                fullName,
            };
        });

        (AppDocument as any).instances.clear();
        (PdfAppDocument as any).instances.clear();
        (PptxAppDocument as any).instances.clear();
        (DocxAppDocument as any).instances.clear();
    });

    test('builds static and editable slide context menus', async () => {
        const slide = createSlide('/docs/main.ows', 7, '/images/slide-7.png');
        const doc = AppDocument.getInstance('/docs/main.ows') as any;
        const contextMenuEvent = {} as any;

        await appDocumentHelpers.showStaticSlideContextMenu(
            'event',
            slide as any,
            [{ menuElement: 'Extra' } as any],
        );
        const staticMenuItems = showAppContextMenuMock.mock
            .calls[0][1] as any[];
        expect(staticMenuItems.map((item) => item.menuElement)).toEqual([
            'Show On Screens',
            'Reveal',
            'Extra',
        ]);
        staticMenuItems[0].onSelect('screen-event');
        staticMenuItems[1].onSelect();
        expect(handleSlideSelectingMock).toHaveBeenCalledWith(
            'screen-event',
            '/docs/main.ows',
            slide.toJson(),
            true,
        );
        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/images/slide-7.png',
        );

        await appDocumentHelpers.showStaticSlideContextMenu(
            'event-2',
            createSlide('/docs/main.ows', 8) as any,
            [],
        );
        const staticMenuWithoutReveal = showAppContextMenuMock.mock
            .calls[1][1] as any[];
        expect(staticMenuWithoutReveal.map((item) => item.menuElement)).toEqual(
            ['Show On Screens'],
        );

        appProviderMock.isPagePresenter = true;
        appProviderMock.isPageAppDocumentEditor = true;
        const menuItems = appDocumentHelpers.genSlideContextMenuItems(
            doc,
            slide as any,
            true,
        );
        expect(menuItems.map((item) => item.menuElement)).toEqual([
            'Copy',
            'Duplicate',
            'Move forward',
            'Move backward',
            'Disable',
            'Quick Edit',
            'Show On Screens',
            'Delete',
        ]);
        await menuItems[0].onSelect?.(contextMenuEvent);
        menuItems[1].onSelect?.(contextMenuEvent);
        menuItems[2].onSelect?.(contextMenuEvent);
        menuItems[3].onSelect?.(contextMenuEvent);
        menuItems[4].onSelect?.(contextMenuEvent);
        menuItems[5].onSelect?.(contextMenuEvent);
        menuItems[6].onSelect?.('presenter-event' as any);
        menuItems[7].onSelect?.(contextMenuEvent);

        expect(appDocumentSetCopiedSlidesMock).toHaveBeenCalledWith([slide]);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copied',
            'Slide is copied',
        );
        expect(doc.duplicateSlides).toHaveBeenCalledWith([slide]);
        expect(doc.moveSlide).toHaveBeenNthCalledWith(1, slide, true);
        expect(doc.moveSlide).toHaveBeenNthCalledWith(2, slide, false);
        expect((slide as any).isDisabled).toBe(true);
        expect(doc.updateSlide).toHaveBeenCalledWith(slide);
        const disabledMenuItems = appDocumentHelpers.genSlideContextMenuItems(
            doc,
            slide as any,
            true,
        );
        expect(disabledMenuItems[4].menuElement).toBe('Enable');
        disabledMenuItems[4].onSelect?.(contextMenuEvent);
        expect((slide as any).isDisabled).toBe(false);
        expect(selectVarySlideMock).toHaveBeenCalledWith(slide);
        expect(handleSlideSelectingMock).toHaveBeenCalledWith(
            'presenter-event',
            '/docs/main.ows',
            slide.toJson(),
            true,
        );
        expect(doc.deleteSlides).toHaveBeenCalledWith([slide]);

        appProviderMock.isPageAppDocumentEditor = false;
        appDocumentHelpers
            .genSlideContextMenuItems(doc, slide as any, false)
            .find((item) => item.menuElement === 'Quick Edit')
            ?.onSelect?.(contextMenuEvent);
        expect(openSlideQuickEditMock).toHaveBeenCalledWith(slide);

        const selectedMenuItems =
            appDocumentHelpers.genSelectedSlidesContextMenuItems(doc, [
                slide as any,
            ]);
        await selectedMenuItems[0].onSelect?.(contextMenuEvent);
        selectedMenuItems[1].onSelect?.(contextMenuEvent);
        selectedMenuItems[2].onSelect?.(contextMenuEvent);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copied',
            'Slides are copied',
        );
        expect(doc.duplicateSlides).toHaveBeenCalledWith([slide]);
        expect(doc.deleteSlides).toHaveBeenCalledWith([slide]);

        expect(appDocumentHelpers.checkIsPdf('.PDF')).toBe(true);
        expect(appDocumentHelpers.checkIsPptx('.pptx')).toBe(true);
        expect(appDocumentHelpers.checkIsDocx('.docx')).toBe(true);
        expect(appDocumentHelpers.supportOfficeFileExtensions).toEqual(
            expect.arrayContaining(['.doc', '.docx', '.odp', '.svg']),
        );
    });

    test('selects another app document through the menu', async () => {
        const otherDocument = AppDocument.getInstance('/docs/other.ows');
        dirSourceGetInstanceMock.mockResolvedValue({
            getFilePaths: vi.fn(async () => [
                '/docs/current.ows',
                '/docs/other.ows',
            ]),
        });

        const selectionPromise = appDocumentHelpers.selectSlide(
            'select-event',
            '/docs/current.ows',
        );
        await Promise.resolve();
        await Promise.resolve();
        const menuItems = showAppContextMenuMock.mock.calls[0][1] as any[];
        expect(menuItems).toHaveLength(1);
        expect(menuItems[0].menuElement).toBe('other.ows');
        menuItems[0].onSelect();

        await expect(selectionPromise).resolves.toBe(otherDocument);

        dirSourceGetInstanceMock.mockResolvedValueOnce({
            getFilePaths: vi.fn(async () => []),
        });
        await expect(
            appDocumentHelpers.selectSlide('empty-event', '/docs/current.ows'),
        ).resolves.toBeNull();
    });

    test('reads app-document React contexts and throws when providers are missing', () => {
        const varyDocument = AppDocument.getInstance('/docs/context.ows');
        const selectedSlide = createSlide('/docs/context.ows', 3);
        const setSelectedVaryAppDocument = vi.fn();
        const setSelectedSlide = vi.fn();
        const onSlideItemsKeyboardEvent = vi.fn();
        const selectedVaryAppDocumentContextValue = {
            selectedVaryAppDocument: varyDocument as any,
            setSelectedVaryAppDocument,
        };
        const nullSelectedSlideContextValue = {
            selectedSlideEditing: null,
            holdingSlides: [],
            setSelectedSlide,
            onSlideItemsKeyboardEvent,
        };
        const selectedSlideContextValue = {
            selectedSlideEditing: selectedSlide as any,
            holdingSlides: [selectedSlide as any],
            setSelectedSlide,
            onSlideItemsKeyboardEvent,
        };
        let setterFromContext: unknown;
        let slideSetterFromContext: unknown;
        let keyHandlerFromContext: unknown;

        function MissingVaryProvider() {
            appDocumentHelpers.useVaryAppDocumentContext();
            return <div />;
        }
        expect(() => renderToStaticMarkup(<MissingVaryProvider />)).toThrow(
            'No VaryAppDocumentContext found',
        );

        function VaryProviderHost() {
            const varyAppDocument =
                appDocumentHelpers.useVaryAppDocumentContext();
            setterFromContext =
                appDocumentHelpers.useSelectedAppDocumentSetterContext();
            return <div data-file-path={varyAppDocument.filePath} />;
        }
        const varyHtml = renderToStaticMarkup(
            <appDocumentHelpers.SelectedVaryAppDocumentContext.Provider
                value={selectedVaryAppDocumentContextValue}
            >
                <appDocumentHelpers.VaryAppDocumentContext.Provider
                    value={varyDocument as any}
                >
                    <VaryProviderHost />
                </appDocumentHelpers.VaryAppDocumentContext.Provider>
            </appDocumentHelpers.SelectedVaryAppDocumentContext.Provider>,
        );
        expect(varyHtml).toContain('data-file-path="/docs/context.ows"');
        expect(setterFromContext).toBe(setSelectedVaryAppDocument);

        function MissingSelectedSlideProvider() {
            appDocumentHelpers.useSelectedEditingSlideContext();
            return <div />;
        }
        expect(() =>
            renderToStaticMarkup(<MissingSelectedSlideProvider />),
        ).toThrow(
            'useSelectedEditingSlideContext must be used within a SelectedEditingSlideContext',
        );

        function NullSelectedSlideProvider() {
            return (
                <appDocumentHelpers.SelectedEditingSlideContext.Provider
                    value={nullSelectedSlideContextValue}
                >
                    <MissingSelectedSlideProvider />
                </appDocumentHelpers.SelectedEditingSlideContext.Provider>
            );
        }
        expect(() =>
            renderToStaticMarkup(<NullSelectedSlideProvider />),
        ).toThrow('No selected slide');

        function SelectedSlideHost() {
            const slide = appDocumentHelpers.useSelectedEditingSlideContext();
            slideSetterFromContext =
                appDocumentHelpers.useSelectedEditingSlideSetterContext();
            keyHandlerFromContext =
                appDocumentHelpers.useSlideItemsControlEventContext();
            return <div data-slide-id={slide.id.toString()} />;
        }
        const selectedSlideHtml = renderToStaticMarkup(
            <appDocumentHelpers.SelectedEditingSlideContext.Provider
                value={selectedSlideContextValue}
            >
                <SelectedSlideHost />
            </appDocumentHelpers.SelectedEditingSlideContext.Provider>,
        );
        expect(selectedSlideHtml).toContain('data-slide-id="3"');
        expect(slideSetterFromContext).toBe(setSelectedSlide);
        expect(keyHandlerFromContext).toBe(onSlideItemsKeyboardEvent);
    });

    test('resolves selected documents, selected slides and file-path keys', async () => {
        const appDocument = AppDocument.getInstance('/docs/main.ows') as any;
        const pdfDocument = PdfAppDocument.getInstance('/docs/file.pdf');
        const pptxDocument = PptxAppDocument.getInstance('/docs/file.pptx');
        const docxDocument = DocxAppDocument.getInstance('/docs/file.docx');
        const slide = createSlide('/docs/main.ows', 5);
        appDocument.items = [slide];
        (pdfDocument as any).items = [createSlide('/docs/file.pdf', 1)];
        (pptxDocument as any).items = [createSlide('/docs/file.pptx', 2)];
        (docxDocument as any).items = [createSlide('/docs/file.docx', 3)];

        const validKey = appDocumentHelpers.toKeyByFilePath(
            '/docs/main.ows',
            5,
        );
        expect(validKey).toBe('/docs/main.ows<id>5');
        expect(appDocumentHelpers.toVarySlideExtractKey(validKey)).toEqual({
            filePath: '/docs/main.ows',
            id: 5,
        });
        expect(appDocumentHelpers.toVarySlideExtractKey('invalid')).toBeNull();
        await expect(appDocumentHelpers.toSlideFromKey(validKey)).resolves.toBe(
            slide,
        );
        await expect(
            appDocumentHelpers.toSlideFromKey('invalid'),
        ).resolves.toBeNull();

        getSelectedVaryAppDocumentFilePathWithEnsureMock.mockResolvedValueOnce(
            '/docs/file.pdf',
        );
        await expect(
            appDocumentHelpers.getSelectedVaryAppDocument(),
        ).resolves.toBe(pdfDocument);

        await appDocumentHelpers.setSelectedVaryAppDocument(appDocument);
        await appDocumentHelpers.setSelectedVaryAppDocument(null);
        expect(setSelectedVaryAppDocumentFilePathMock).toHaveBeenNthCalledWith(
            1,
            '/docs/main.ows',
        );
        expect(setSelectedVaryAppDocumentFilePathMock).toHaveBeenNthCalledWith(
            2,
            null,
        );

        getSelectedVaryAppDocumentFilePathWithEnsureMock.mockResolvedValue(
            '/docs/main.ows',
        );
        getSettingMock.mockReturnValue('/docs/main.ows<id>5');
        await expect(
            appDocumentHelpers.getSelectedEditingSlideFilePath(),
        ).resolves.toEqual({
            filePath: '/docs/main.ows',
            id: 5,
        });

        getSettingMock.mockReturnValue('/docs/main.ows<id>bad');
        await expect(
            appDocumentHelpers.getSelectedEditingSlideFilePath(),
        ).resolves.toBeNull();
        expect(setSettingMock).toHaveBeenCalledWith(
            'selected-vary-app-document-item',
            '',
        );

        appDocumentHelpers.setSelectedEditingSlideFilePath('/docs/main.ows', 9);
        expect(setSettingMock).toHaveBeenLastCalledWith(
            'selected-vary-app-document-item',
            '/docs/main.ows<id>9',
        );

        getSettingMock.mockReturnValue('/docs/main.ows<id>5');
        await expect(
            appDocumentHelpers.getSelectedEditingSlide(),
        ).resolves.toBe(slide);

        getSelectedVaryAppDocumentFilePathWithEnsureMock.mockResolvedValue(
            '/docs/file.pdf',
        );
        getSettingMock.mockReturnValue('/docs/file.pdf<id>1');
        await expect(
            appDocumentHelpers.getSelectedEditingSlide(),
        ).resolves.toBeNull();

        appDocumentHelpers.setSelectedEditingSlide(slide as any);
        appDocumentHelpers.setSelectedEditingSlide(null);
        expect(setSettingMock.mock.calls.slice(-2)).toEqual([
            ['selected-vary-app-document-item', '/docs/main.ows<id>5'],
            ['selected-vary-app-document-item', ''],
        ]);

        expect(
            appDocumentHelpers.varyAppDocumentFromFilePath('/docs/main.ows'),
        ).toBe(appDocument);
        expect(
            appDocumentHelpers.varyAppDocumentFromFilePath('/docs/file.pdf'),
        ).toBe(pdfDocument);
        expect(
            appDocumentHelpers.varyAppDocumentFromFilePath('/docs/file.pptx'),
        ).toBe(pptxDocument);
        expect(
            appDocumentHelpers.varyAppDocumentFromFilePath('/docs/file.docx'),
        ).toBe(docxDocument);
    });

    test('checks screen state and preloads attached backgrounds', async () => {
        const appDocument = AppDocument.getInstance('/docs/screen.ows') as any;
        const slide = createSlide('/docs/screen.ows', 2);
        appDocument.items = [slide];

        getDataListMock.mockImplementation((filePath: string, id: number) => {
            return filePath === '/docs/screen.ows' && id === 2
                ? ['screen-1']
                : [];
        });
        expect(appDocumentHelpers.checkIsVarySlideOnScreen(slide as any)).toBe(
            true,
        );
        expect(
            appDocumentHelpers.checkIsVarySlideOnScreen(
                createSlide('/docs/screen.ows', 99) as any,
            ),
        ).toBe(false);

        getAppDocumentListOnScreenSettingMock.mockReturnValue({});
        await expect(
            appDocumentHelpers.checkIsVaryAppDocumentOnScreen(appDocument),
        ).resolves.toBe(false);

        getAppDocumentListOnScreenSettingMock.mockReturnValue({ screen: true });
        await expect(
            appDocumentHelpers.checkIsVaryAppDocumentOnScreen(appDocument),
        ).resolves.toBe(true);

        getDataListMock.mockReturnValue([]);
        await expect(
            appDocumentHelpers.checkIsVaryAppDocumentOnScreen(appDocument),
        ).resolves.toBe(false);

        vi.useFakeTimers();
        await appDocumentHelpers.preloadAttachedBackground(appDocument, [
            { filePath: '/docs/screen.ows', id: 2 },
            { filePath: '/docs/screen.ows', id: 3 },
        ]);
        vi.runAllTimers();
        expect(getAttachedBackgroundMock).toHaveBeenNthCalledWith(
            1,
            '/docs/screen.ows',
            2,
        );
        expect(getAttachedBackgroundMock).toHaveBeenNthCalledWith(
            2,
            '/docs/screen.ows',
            3,
        );

        getAttachedBackgroundMock.mockClear();
        await appDocumentHelpers.preloadAttachedBackground(appDocument);
        vi.runAllTimers();
        expect(getAttachedBackgroundMock).toHaveBeenCalledWith(
            '/docs/screen.ows',
            2,
        );
        vi.useRealTimers();
    });
});
