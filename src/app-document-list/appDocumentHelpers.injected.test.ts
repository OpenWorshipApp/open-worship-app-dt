// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));

// The app-document EDITOR window, opened on one document through `?file=`
// (`openAppDocumentEditorExternal`). Whether a window hosts an injected
// document is decided when `appDocumentHelpers` is evaluated, so the URL and
// the page kind are set inside `vi.hoisted`, before that import runs.
//
// The resolved path is cached by the module once it is found, so the order of
// the tests below is load-bearing: the two failures first, then the success.

const { state, mocks, AppDocumentMock } = vi.hoisted(() => {
    globalThis.history.replaceState(
        null,
        '',
        '/app-document-editor.html?file=sermon.ows&id=2',
    );
    class AppDocumentMock {
        static readonly instances = new Map<string, AppDocumentMock>();
        isEditable = true;
        slides: { id: number }[] = [];
        constructor(public filePath: string) {}
        async getSlides() {
            return this.slides;
        }
        async getItemById(id: number) {
            return (
                this.slides.find((slide) => {
                    return slide.id === id;
                }) ?? null
            );
        }
        static getInstance(filePath: string) {
            let instance = this.instances.get(filePath);
            if (instance === undefined) {
                instance = new this(filePath);
                this.instances.set(filePath, instance);
            }
            return instance;
        }
        static checkIsThisType(value: unknown) {
            return value instanceof this;
        }
    }
    return {
        AppDocumentMock,
        state: {
            dirPath: null as string | null,
            existingPaths: new Set<string>(),
        },
        mocks: {
            handleError: vi.fn(),
            setSetting: vi.fn(),
            getSelectedPath: vi.fn(),
        },
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        isPageAppDocumentEditor: true,
        windowTitle: 'Open Worship',
    },
}));
vi.mock('../helper/domHelpers', () => ({
    getParamFileFullName: (url: string) =>
        new URL(url).searchParams.get('file'),
    getParamKeyValue: (url: string, key: string) =>
        new URL(url).searchParams.get(key),
    getParamIdNum: (url: string) => {
        const idNum = Number.parseInt(
            new URL(url).searchParams.get('id') ?? '',
        );
        return Number.isNaN(idNum) ? null : idNum;
    },
    setParamIdNum: (url: string, idNum: number) => {
        const urlObject = new URL(url);
        urlObject.searchParams.set('id', `${idNum}`);
        return urlObject.toString();
    },
}));
vi.mock('../helper/DirSource', () => ({
    default: {
        getDirPathBySettingName: () => state.dirPath,
        getInstance: () => null,
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async () => false,
    fsCopyFilePathToPath: async () => null,
    fsExistSync: (filePath: string) => state.existingPaths.has(filePath),
    getFileDotExtension: (fileName: string) =>
        fileName.substring(fileName.lastIndexOf('.')),
    getFileFullName: (file: { name?: string }) => file.name ?? '',
    getFileName: (fileFullName: string) =>
        fileFullName.substring(0, fileFullName.lastIndexOf('.')),
    getMimetypeExtensions: () => ['owl'],
    getTempPath: () => '/tmp',
    KEY_SEPARATOR: '<id>',
    mimetypeDocx: { extensions: ['.docx'] },
    mimetypePdf: { extensions: ['.pdf'] },
    mimetypePptx: { extensions: ['.pptx'] },
    pathBasename: (filePath: string) => filePath.split('/').at(-1),
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            name: filePath.split('/').at(-1)?.split('.')[0],
        }),
    },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: mocks.setSetting,
}));
vi.mock('./selectedVaryAppDocumentHelpers', () => ({
    SELECTED_APP_DOCUMENT_SETTING_NAME: 'selected-vary-app-document',
    getSelectedVaryAppDocumentFilePathWithEnsure: mocks.getSelectedPath,
    setSelectedVaryAppDocumentFilePath: () => undefined,
}));
vi.mock('./AppDocument', () => ({
    default: AppDocumentMock,
    openAppDocumentEditorExternal: () => undefined,
}));
vi.mock('./Slide', () => ({ default: class Slide {} }));
vi.mock('./PdfAppDocument', () => ({ default: class PdfAppDocument {} }));
vi.mock('./PptxAppDocument', () => ({ default: class PptxAppDocument {} }));
vi.mock('./DocxAppDocument', () => ({ default: class DocxAppDocument {} }));
vi.mock('../helper/constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'app-document' },
}));
// Imported by the module but not reached by anything below.
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: () => undefined,
    showAppConfirm: async () => false,
}));
vi.mock('../event/VaryAppDocumentEventListener', () => ({ default: {} }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: () => undefined,
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: () => undefined }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: () => undefined,
    hideProgressBar: () => undefined,
}));
vi.mock('../server/appHelpers', () => ({
    convertToPdf: async () => null,
    showFileOrDirExplorer: () => undefined,
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: () => [],
}));
vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: { handleSlideSelecting: () => undefined, getDataList: () => [] },
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: () => undefined,
}));
vi.mock('../_screen/managers/varySlideOnScreenHelpers', () => ({
    useVarySlideOnScreenChangeEffect: () => undefined,
}));
vi.mock('../helper/appHooks', () => ({ useAppEffect: () => undefined }));
vi.mock('../others/selectedHelpers', () => ({
    checkSelectedFilePathExist: async () => true,
}));
vi.mock('../helper/loggerHelpers', () => ({ appLog: () => undefined }));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { getAttachedBackground: () => null },
}));
vi.mock('../others/color/colorHelpers', () => ({ HEX_COLOR_BLACK: '#000000' }));
vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal',
}));
vi.mock('../server/pptxHelpers', () => ({ getSlidesCount: async () => 0 }));

import {
    getSelectedEditingSlide,
    getSelectedEditingSlideFilePath,
    getSelectedVaryAppDocument,
    isInjectedAppDocumentFilePath,
    setSelectedEditingSlideFilePath,
} from './appDocumentHelpers';

function setUrlId(id: string | null) {
    const url = new URL(globalThis.location.href);
    if (id === null) {
        url.searchParams.delete('id');
    } else {
        url.searchParams.set('id', id);
    }
    globalThis.history.replaceState(null, '', url.toString());
}

describe('appDocumentHelpers in the injected app-document editor', () => {
    test('knows at load that this window hosts an injected document', () => {
        expect(isInjectedAppDocumentFilePath).toBe(true);
    });

    test('reports a documents folder that is not set and falls back to the selection', async () => {
        mocks.getSelectedPath.mockResolvedValue(null);
        state.dirPath = null;
        await expect(getSelectedVaryAppDocument()).resolves.toBeNull();
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                message: 'App document directory not set',
            }),
        );
        expect(mocks.getSelectedPath).toHaveBeenCalledOnce();
    });

    test('reports an injected file that is not in the documents folder', async () => {
        mocks.getSelectedPath.mockResolvedValue(null);
        state.dirPath = '/docs';
        await expect(getSelectedVaryAppDocument()).resolves.toBeNull();
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                message: 'App document file not found: sermon.ows',
            }),
        );
    });

    test('opens the injected document, names the window after it, and remembers the path', async () => {
        state.dirPath = '/docs';
        state.existingPaths.add('/docs/sermon.ows');
        const appDocument = await getSelectedVaryAppDocument();
        expect(appDocument).toBe(
            AppDocumentMock.getInstance('/docs/sermon.ows'),
        );
        expect(document.title).toBe('Open Worship - sermon');
        expect(mocks.getSelectedPath).not.toHaveBeenCalled();

        // Found once, it is not looked up again even if the folder moves.
        state.dirPath = null;
        await expect(getSelectedVaryAppDocument()).resolves.toBe(appDocument);
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('selects the slide the URL names, or the first one', async () => {
        const appDocument = AppDocumentMock.getInstance('/docs/sermon.ows');
        appDocument.slides = [{ id: 1 }, { id: 2 }];
        setUrlId('2');
        await expect(getSelectedEditingSlideFilePath()).resolves.toEqual({
            filePath: '/docs/sermon.ows',
            id: 2,
        });
        await expect(getSelectedEditingSlide()).resolves.toEqual({ id: 2 });

        // An id that names no slide of it any more: its first slide.
        setUrlId('9');
        await expect(getSelectedEditingSlideFilePath()).resolves.toEqual({
            filePath: '/docs/sermon.ows',
            id: 1,
        });
        setUrlId(null);
        await expect(getSelectedEditingSlideFilePath()).resolves.toEqual({
            filePath: '/docs/sermon.ows',
            id: 1,
        });

        appDocument.slides = [];
        await expect(getSelectedEditingSlideFilePath()).resolves.toEqual({
            filePath: '/docs/sermon.ows',
            id: -1,
        });
    });

    test('a document that is not editable has no editing slide', async () => {
        const appDocument = AppDocumentMock.getInstance('/docs/sermon.ows');
        appDocument.isEditable = false;
        try {
            await expect(getSelectedEditingSlideFilePath()).resolves.toBeNull();
            await expect(getSelectedEditingSlide()).resolves.toBeNull();
        } finally {
            appDocument.isEditable = true;
        }
    });

    test('writes the selected slide into the URL as well as the setting', () => {
        setUrlId('2');
        setSelectedEditingSlideFilePath('/docs/sermon.ows', 5);
        const url = new URL(globalThis.location.href);
        expect(url.searchParams.get('id')).toBe('5');
        expect(url.searchParams.get('file')).toBe('sermon.ows');
        expect(mocks.setSetting).toHaveBeenCalledExactlyOnceWith(
            'selected-vary-app-document-item',
            '/docs/sermon.ows<id>5',
        );

        setSelectedEditingSlideFilePath(null, -1);
        expect(new URL(globalThis.location.href).searchParams.get('id')).toBe(
            '-1',
        );
        expect(mocks.setSetting).toHaveBeenLastCalledWith(
            'selected-vary-app-document-item',
            '',
        );
    });
});
