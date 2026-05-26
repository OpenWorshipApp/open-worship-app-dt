// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    hookState,
    showAppAlertMock,
    showAppConfirmMock,
    handleErrorMock,
    showSimpleToastMock,
    showProgressBarMock,
    hideProgressBarMock,
    convertToPdfMock,
    getDataListMock,
    useFileSourceEventsMock,
    useScreenVaryAppDocumentManagerEventsMock,
    appLogMock,
    getSlidesCountMock,
    fsCheckFileExistMock,
    fsCopyFilePathToPathMock,
    fileSourceGetInstanceMock,
    appProviderMock,
} = vi.hoisted(() => ({
    hookState: {
        fileSourceEventCallback: null as null | (() => Promise<void> | void),
        screenRefreshCallback: null as null | (() => Promise<void> | void),
    },
    showAppAlertMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    handleErrorMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    showProgressBarMock: vi.fn(),
    hideProgressBarMock: vi.fn(),
    convertToPdfMock: vi.fn(),
    getDataListMock: vi.fn(),
    useFileSourceEventsMock: vi.fn(),
    useScreenVaryAppDocumentManagerEventsMock: vi.fn(),
    appLogMock: vi.fn(),
    getSlidesCountMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    fsCopyFilePathToPathMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    appProviderMock: {
        isPagePresenter: false,
        isPageAppDocumentEditor: false,
        pathUtils: {
            join: (...parts: string[]) => parts.join('/').replaceAll('//', '/'),
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

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: showAppAlertMock,
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../event/VaryAppDocumentEventListener', () => ({
    default: {
        selectVarySlide: vi.fn(),
    },
}));

vi.mock('../helper/DirSource', () => ({
    default: {
        getInstance: vi.fn(),
    },
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

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
    openSlideQuickEdit: vi.fn(),
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('./Slide', () => ({
    default: class Slide {
        filePath: string;
        id: number;

        constructor(filePath: string, json: { id: number }) {
            this.filePath = filePath;
            this.id = json.id;
        }

        toJson() {
            return { id: this.id };
        }

        async getItemFilePath() {
            return null;
        }
    },
}));

vi.mock('./AppDocument', () => ({
    default: class AppDocument {
        public static readonly instances = new Map<string, AppDocument>();
        public static readonly setCopiedSlides = vi.fn();

        filePath: string;
        slides: any[] = [];
        getIsWrongDimension = vi.fn(async () => null);

        constructor(filePath: string) {
            this.filePath = filePath;
        }

        async getItemById(id: number) {
            return this.slides.find((item) => item.id === id) ?? null;
        }

        async getSlides() {
            return this.slides;
        }

        static getInstance(filePath: string) {
            return getOrCreateInstance(this.instances, filePath, () => {
                return new this(filePath);
            });
        }

        static checkIsThisType(value: unknown) {
            return value instanceof this;
        }
    },
}));

vi.mock('./PdfAppDocument', () => ({
    default: class PdfAppDocument {
        constructor(public filePath: string) {}
    },
}));

vi.mock('./PptxAppDocument', () => ({
    default: class PptxAppDocument {
        constructor(public filePath: string) {}
    },
}));

vi.mock('./DocxAppDocument', () => ({
    default: class DocxAppDocument {
        constructor(public filePath: string) {}
    },
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: showProgressBarMock,
    hideProgressBar: hideProgressBarMock,
}));

vi.mock('../server/appHelpers', () => ({
    convertToPdf: convertToPdfMock,
    showFileOrDirExplorer: vi.fn(),
}));

vi.mock('../helper/constants', () => ({
    dirSourceSettingNames: {
        APP_DOCUMENT: 'app-document',
    },
}));

vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: vi.fn(() => []),
}));

vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: {
        handleSlideSelecting: vi.fn(),
        getDataList: getDataListMock,
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: vi.fn(),
    setSetting: vi.fn(),
}));

vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: useFileSourceEventsMock,
}));

vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenVaryAppDocumentManagerEvents:
        useScreenVaryAppDocumentManagerEventsMock,
}));

vi.mock('../helper/debuggerHelpers', () => ({
    useAppEffect: useEffect,
}));

vi.mock('../others/selectedHelpers', () => ({
    checkSelectedFilePathExist: vi.fn(async () => true),
}));

vi.mock('../_screen/preview/screenPreviewerHelpers', () => ({
    getAppDocumentListOnScreenSetting: vi.fn(() => ({})),
}));

vi.mock('../helper/loggerHelpers', () => ({
    appLog: appLogMock,
}));

vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        getAttachedBackground: vi.fn(),
    },
}));

vi.mock('./selectedVaryAppDocumentHelpers', () => ({
    SELECTED_APP_DOCUMENT_SETTING_NAME: 'selected-vary-app-document',
    getSelectedVaryAppDocumentFilePathWithEnsure: vi.fn(async () => null),
    setSelectedVaryAppDocumentFilePath: vi.fn(),
}));

vi.mock('../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
}));

vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: vi.fn(() => 'Reveal'),
}));

vi.mock('../server/pptxHelpers', () => ({
    getSlidesCount: getSlidesCountMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
    },
}));

import AppDocument from './AppDocument';
import * as appDocumentHelpers from './appDocumentHelpers';

describe('appDocumentHelpers coverage', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.useRealTimers();

        hookState.fileSourceEventCallback = null;
        hookState.screenRefreshCallback = null;

        showAppConfirmMock.mockResolvedValue(true);
        fsCheckFileExistMock.mockResolvedValue(false);
        fsCopyFilePathToPathMock.mockResolvedValue('/tmp/copied.docx');
        convertToPdfMock.mockResolvedValue(null);
        getSlidesCountMock.mockResolvedValue(0);
        getDataListMock.mockReturnValue([]);
        useFileSourceEventsMock.mockImplementation(
            (_events: string[], callback: () => Promise<void> | void) => {
                hookState.fileSourceEventCallback = callback;
            },
        );
        useScreenVaryAppDocumentManagerEventsMock.mockImplementation(
            (
                _events: string[],
                _handler: unknown,
                refresh: () => Promise<void> | void,
            ) => {
                hookState.screenRefreshCallback = refresh;
            },
        );
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            const normalizedPath = filePath.replaceAll('\\', '/');
            const fullName = normalizedPath.split('/').at(-1) ?? normalizedPath;
            return {
                baseDirPath: normalizedPath.includes('/')
                    ? normalizedPath.substring(
                          0,
                          normalizedPath.lastIndexOf('/'),
                      )
                    : '',
                fullName,
            };
        });

        (AppDocument as any).instances.clear();

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        if (root !== null) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('stops office conversion when the confirmation is rejected', async () => {
        showAppConfirmMock.mockResolvedValue(false);

        await appDocumentHelpers.convertOfficeFile(
            { name: 'sermon.docx' } as any,
            { dirPath: '/docs' } as any,
        );

        expect(showAppConfirmMock).toHaveBeenCalledWith(
            'Converting to PDF',
            expect.stringContaining('sermon.docx'),
        );
        expect(showProgressBarMock).not.toHaveBeenCalled();
        expect(convertToPdfMock).not.toHaveBeenCalled();
    });

    test('converts office files through a temp path and warns on slide mismatches', async () => {
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return (
                filePath === '/tmp/temp-to-pdf-0.docx' ||
                filePath === '/docs/sermon.pdf'
            );
        });
        fsCopyFilePathToPathMock.mockResolvedValue('/tmp/temp-to-pdf-1.docx');
        getSlidesCountMock.mockResolvedValueOnce(4).mockResolvedValueOnce(3);

        await appDocumentHelpers.convertOfficeFile(
            { name: 'sermon.docx' } as any,
            { dirPath: '/docs' } as any,
        );

        expect(appLogMock).toHaveBeenCalledWith(
            'Temp file path for converting:',
            '/tmp/temp-to-pdf-1.docx',
        );
        expect(showProgressBarMock).toHaveBeenCalledWith('Converting to PDF');
        expect(fsCopyFilePathToPathMock).toHaveBeenCalledWith(
            { name: 'sermon.docx' },
            '/tmp',
            'temp-to-pdf-1.docx',
        );
        expect(convertToPdfMock).toHaveBeenCalledWith(
            '/tmp/temp-to-pdf-1.docx',
            '/docs/sermon-1.pdf',
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Converting to PDF',
            'Document with 4 slides is being converted. Do not close application',
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Converting to PDF',
            'Warning: Slides count mismatch. Original: 4, Converted: 3',
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Converting to PDF',
            '<b>sermon.docx</b> is converted to PDF "/docs/sermon-1.pdf"',
        );
        expect(hideProgressBarMock).toHaveBeenCalledWith('Converting to PDF');
    });

    test('shows the install alert for missing LibreOffice and handles generic conversion errors', async () => {
        convertToPdfMock.mockRejectedValueOnce(
            new Error('Could not find soffice binary'),
        );

        await appDocumentHelpers.convertOfficeFile(
            { name: 'guide.docx' } as any,
            { dirPath: '/docs' } as any,
        );

        expect(showAppAlertMock).toHaveBeenCalledWith(
            'LibreOffice is not installed',
            expect.stringContaining('LibreOffice'),
        );
        expect(handleErrorMock).not.toHaveBeenCalled();

        showAppAlertMock.mockClear();

        await appDocumentHelpers.convertOfficeFile(
            {} as any,
            { dirPath: '/docs' } as any,
        );

        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Failed to get file name' }),
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Converting to PDF',
            'Something wrong during converting, please try again.',
        );
    });

    test('tracks wrong slide dimensions for app documents and ignores other document types', async () => {
        const appDocument = AppDocument.getInstance('/docs/main.ows') as any;
        appDocument.getIsWrongDimension
            .mockResolvedValueOnce({
                slide: { width: 1, height: 2 },
                display: { width: 3, height: 4 },
            })
            .mockResolvedValueOnce({
                slide: { width: 5, height: 6 },
                display: { width: 7, height: 8 },
            });
        const otherDocument = {
            filePath: '/docs/other.pdf',
            getIsWrongDimension: vi.fn(async () => ({
                slide: { width: 9, height: 10 },
                display: { width: 11, height: 12 },
            })),
        };

        function Probe({
            varyAppDocument,
        }: Readonly<{ varyAppDocument: any }>) {
            const wrong = appDocumentHelpers.useSlideWrongDimension(
                varyAppDocument,
                'presenter' as any,
            );
            return (
                <div>
                    {wrong === null
                        ? 'none'
                        : `${wrong.slide.width}:${wrong.display.width}`}
                </div>
            );
        }

        await act(async () => {
            root?.render(<Probe varyAppDocument={appDocument} />);
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(container?.textContent).toBe('1:3');
        expect(useFileSourceEventsMock).toHaveBeenCalledWith(
            ['update'],
            expect.any(Function),
            [expect.any(Function)],
            '/docs/main.ows',
        );

        await act(async () => {
            await hookState.fileSourceEventCallback?.();
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(container?.textContent).toBe('5:7');

        await act(async () => {
            root?.render(<Probe varyAppDocument={otherDocument} />);
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(otherDocument.getIsWrongDimension).not.toHaveBeenCalled();
        expect(container?.textContent).toBe('5:7');
    });

    test('updates selection state when screen manager data changes', async () => {
        const slides = [
            { filePath: '/docs/main.ows', id: 1 },
            { filePath: '/docs/main.ows', id: 2 },
        ];

        function Probe({
            varySlides,
        }: Readonly<{ varySlides?: any[] | null }>) {
            const isSelected =
                appDocumentHelpers.useAnyItemSelected(varySlides);
            return <div>{`${isSelected}`}</div>;
        }

        await act(async () => {
            root?.render(<Probe varySlides={undefined} />);
        });

        expect(container?.textContent).toBe('false');

        await act(async () => {
            root?.render(<Probe varySlides={slides} />);
        });

        expect(container?.textContent).toBe('false');
        expect(useScreenVaryAppDocumentManagerEventsMock).toHaveBeenCalledWith(
            ['update'],
            undefined,
            expect.any(Function),
        );

        getDataListMock.mockImplementation((filePath: string, id: number) => {
            return filePath === '/docs/main.ows' && id === 2
                ? ['screen-1']
                : [];
        });

        await act(async () => {
            await hookState.screenRefreshCallback?.();
        });

        expect(container?.textContent).toBe('true');
    });
});
