import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        json: null as any,
        manifest: null as any,
        readJson: null as any,
        readable: { filePath: '/plain.tar' } as any,
        dirPath: '/runs' as any,
        selected: [] as string[],
        password: '' as string | null,
        url: null as string | null,
        appFilePath: null as string | null,
        copyPath: '/copied/archive' as string | null,
        bibleItem: null as any,
        defaultBible: null as any,
        collectorAdds: [] as any[],
        importedMap: new Map<string, string>(),
    },
    mocks: {
        handleError: vi.fn(),
        fsCreate: vi.fn(),
        fsCopy: vi.fn(),
        fsRead: vi.fn(),
        showExplorer: vi.fn(),
        tarCreate: vi.fn(),
        tarExtract: vi.fn(),
        askUrl: vi.fn(),
        stream: vi.fn(),
        progress: vi.fn(),
        hideProgress: vi.fn(),
        toast: vi.fn(),
        safeDelete: vi.fn(),
        protect: vi.fn(),
        openReading: vi.fn(),
        importFiles: vi.fn(),
        canvas: vi.fn(),
        backgrounds: vi.fn(),
        fireUpdate: vi.fn(),
    },
}));

vi.mock('../bible-list/Bible', () => ({
    default: { getDefault: async () => state.defaultBible },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: { dragDeserialize: () => state.bibleItem },
}));
vi.mock('../helper/constants', () => ({
    dirSourceSettingNames: { PRESENTING_FLOW: 'flow-dir' },
}));
vi.mock('../helper/DirSource', () => ({
    default: { getDirPathBySettingName: () => state.dirPath },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (path: string) => ({
            name: path === '/source.owpf' ? 'Sunday' : `name:${path}`,
            genNextFilePath: async () => `${path}.next`,
            fireUpdateEvent: mocks.fireUpdate,
        }),
    },
}));
vi.mock('../helper/helpers', () => ({ parseJsonSafely: () => state.readJson }));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.showExplorer,
    tarCreate: mocks.tarCreate,
    tarExtract: mocks.tarExtract,
}));
vi.mock('../server/fileHelpers', () => ({
    fsCreateFile: mocks.fsCreate,
    fsCopyFilePathToPath: (...args: any[]) => mocks.fsCopy(...args),
    fsReadFile: mocks.fsRead,
    getDownloadPath: () => '/downloads',
    pathBasename: (path: string) => path.split('/').at(-1),
    pathJoin: (...parts: string[]) => parts.join('/'),
    selectFiles: async () => state.selected,
}));
vi.mock('../helper/localFileHelpers', () => ({
    getAppFilePathFromFile: () => state.appFilePath,
}));
vi.mock('../helper/bible-helpers/downloadHelpers', () => ({
    initHttpRequest: async () => ({ body: true }),
}));
vi.mock('../background/downloadHelper', () => ({
    askForURL: async () => state.url,
    messageCallback: vi.fn(),
    streamDownloadFile: mocks.stream,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    hideProgressBar: mocks.hideProgress,
    showProgressBar: mocks.progress,
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('./PresentingFlow', () => ({
    default: {
        getInstance: (path: string) => ({
            filePath: path,
            fileSource: { name: `name:${path}` },
        }),
    },
}));
vi.mock('./PresentingFlowItem', () => ({
    slideDragTypeList: [
        'slide',
        'pdfSlide',
        'pptxSlide',
        'docxSlide',
        'lyric-slide',
    ],
}));
vi.mock('../helper/appArchiveHelpers', () => ({
    ARCHIVE_VERSION: 3,
    ArchiveFileCollector: class {
        backgroundMetas = [{ filePath: '/bg' }];
        async addDocument(path: string | null) {
            state.collectorAdds.push(['document', path]);
        }
        async addFile(path: string | null, kind: string) {
            state.collectorAdds.push([kind, path]);
        }
    },
    PLAIN_ARCHIVE_TEMP_NAME: 'plain.tar.gz',
    applyImportedCanvasMedia: mocks.canvas,
    backgroundTypeKindMap: {
        'bg-image': 'background-image',
        'bg-video': 'background-video',
        'bg-audio': 'audio',
    },
    checkIsArchiveFileFullName: (name: string, ext: string) =>
        name.endsWith(ext) || name.endsWith(`${ext}.enc`),
    createWorkDir: async (name: string) => `/tmp/${name}`,
    genNextArchiveFilePath: async (dir: string, name: string) =>
        `${dir}/${name}`,
    importArchiveFiles: (...args: any[]) => mocks.importFiles(...args),
    importBackgroundMetas: mocks.backgrounds,
    readArchiveManifest: async () => state.manifest,
    resolveKindDirPaths: () => new Map(),
    safeDeleteDir: mocks.safeDelete,
    stageArchiveFiles: async () => ({
        archiveFiles: [{ path: 'one' }],
        archiveEntries: ['manifest.json', 'one'],
    }),
    toArchiveBaseName: (name: string) => name.split('.')[0],
    toArchiveDotExtension: (ext: string, password: string | null) =>
        password ? `${ext}.enc` : ext,
    toArchiveFileName: (name: string, ext: string, fallback: string) =>
        `${name || fallback}${ext}`,
    toArchiveFileNameFromUrl: (url: string, ext: string) =>
        `${new URL(url).pathname.split('/').at(-1) || 'PresentingFlow'}${ext}`,
    toExtractedArchivePath: (dir: string, path: string) => `${dir}/${path}`,
    validateArchiveBackgroundMetas: (value: any) =>
        Array.isArray(value) ? value : [],
    validateArchiveFileEntries: (value: any) =>
        Array.isArray(value) ? value : [],
    writeArchiveManifest: vi.fn(),
}));
vi.mock('../helper/archivePasswordHelpers', () => ({
    askForNewArchivePassword: async () => state.password,
    openArchiveForReading: async () => state.readable,
    protectArchiveFile: (...args: any[]) => mocks.protect(...args),
}));

import { DragTypeEnum } from '../helper/DragInf';
import {
    askAndImportPresentingFlowArchiveFromUrl,
    checkIsPresentingFlowArchiveFileFullName,
    createPresentingFlowArchive,
    exportPresentingFlow,
    importDroppedPresentingFlowArchive,
    importPresentingFlowArchive,
    selectAndImportPresentingFlowArchive,
    toPresentingFlowArchiveFileName,
} from './presentingFlowArchiveHelpers';

function flow(json = state.json) {
    return {
        filePath: '/source.owpf',
        fileSource: { name: 'Sunday' },
        getJsonData: vi.fn(async () => json),
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    state.json = { items: [] };
    state.manifest = {
        version: 3,
        presentingFlow: 'presentingFlow.json',
        files: [],
        backgroundMetas: [],
    };
    state.readJson = { items: [] };
    state.readable = { filePath: '/plain.tar' };
    state.dirPath = '/runs';
    state.selected = [];
    state.password = '';
    state.url = null;
    state.appFilePath = null;
    state.copyPath = '/copied/archive';
    state.bibleItem = null;
    state.defaultBible = null;
    state.collectorAdds = [];
    state.importedMap = new Map();
    mocks.protect.mockResolvedValue('/downloads/Sunday.owapf.tar.gz.enc');
    mocks.fsCopy.mockImplementation(async () => state.copyPath);
    mocks.importFiles.mockResolvedValue({
        localFilePathByOriginalPath: state.importedMap,
        writtenItemFilePaths: [],
    });
});

describe('presenting-flow archives', () => {
    test('names and creates plain and protected bundles while collecting owned paths', async () => {
        expect(toPresentingFlowArchiveFileName('')).toBe(
            'PresentingFlow.owapf.tar.gz',
        );
        expect(toPresentingFlowArchiveFileName('Sunday', 'pw')).toBe(
            'Sunday.owapf.tar.gz.enc',
        );
        state.json = {
            items: [
                { type: DragTypeEnum.SLIDE, filePath: '/doc' },
                {
                    type: DragTypeEnum.APP_DOCUMENT,
                    filePath: '/app',
                    data: '/app-data',
                },
                { type: DragTypeEnum.BACKGROUND_IMAGE, data: '/image' },
                {
                    type: DragTypeEnum.BACKGROUND_WEB,
                    data: 'https://example.com',
                },
                {
                    type: DragTypeEnum.FOREGROUND,
                    data: { target: 'video', data: { filePath: '/fg' } },
                },
                {
                    type: DragTypeEnum.FOREGROUND,
                    data: { target: 'message', data: {} },
                },
            ],
        };
        expect(await createPresentingFlowArchive(flow())).toBe(
            '/downloads/Sunday.owapf.tar.gz',
        );
        expect(state.collectorAdds).toContainEqual(['document', '/doc']);
        expect(state.collectorAdds).toContainEqual(['document', '/app']);
        expect(state.collectorAdds).toContainEqual(['document', '/app-data']);
        expect(state.collectorAdds).toContainEqual([
            'background-image',
            '/image',
        ]);
        expect(state.collectorAdds).toContainEqual(['foreground-video', '/fg']);
        expect(mocks.tarCreate).toHaveBeenCalled();
        expect(mocks.safeDelete).toHaveBeenCalledWith('/tmp/owapf-export');
        expect(await createPresentingFlowArchive(flow(), 'pw')).toContain(
            '.enc',
        );
        expect(mocks.protect).toHaveBeenCalled();
        await expect(createPresentingFlowArchive(flow(null))).rejects.toThrow(
            'Unable to read',
        );
    });

    test('exports with cancellation, success, and failure feedback', async () => {
        state.password = null;
        await expect(exportPresentingFlow(flow())).resolves.toBeNull();
        expect(mocks.progress).not.toHaveBeenCalled();
        state.password = '';
        const result = await exportPresentingFlow(flow());
        expect(result).toContain('/downloads/');
        expect(mocks.showExplorer).toHaveBeenCalledWith(result);
        expect(mocks.toast).toHaveBeenCalledWith(
            'Export Presenting Flow',
            expect.stringContaining('Exported to'),
        );
        expect(mocks.hideProgress).toHaveBeenCalledWith(
            'Export Presenting Flow',
        );
        mocks.tarCreate.mockRejectedValueOnce(new Error('tar failed'));
        await expect(exportPresentingFlow(flow())).resolves.toBeNull();
        expect(mocks.handleError).toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Export Presenting Flow',
            'tar failed',
        );
    });

    test('imports, rewrites media paths, reuses bible verses, and creates the run file', async () => {
        state.manifest = {
            version: 3,
            presentingFlow: 'presentingFlow.json',
            files: [{ path: 'doc' }],
            backgroundMetas: [],
            dataDirPath: '/old',
        };
        const existing = {
            id: 9,
            bibleKey: 'KJV',
            toJson: () => ({ target: { book: 1 } }),
        };
        state.bibleItem = {
            bibleKey: 'KJV',
            toJson: () => ({ target: { book: 1 } }),
        };
        state.defaultBible = {
            items: [existing],
            filePath: '/bibles/default',
            addBibleItem: vi.fn(),
            save: vi.fn(),
            maxItemId: 10,
        };
        state.readJson = {
            items: [
                { type: DragTypeEnum.SLIDE, filePath: '/old/doc' },
                {
                    type: DragTypeEnum.APP_DOCUMENT,
                    filePath: '/old/app',
                    data: '/old/app',
                },
                { type: DragTypeEnum.BACKGROUND_IMAGE, data: '/old/image' },
                {
                    type: DragTypeEnum.FOREGROUND,
                    data: { target: 'web', data: { filePath: '/old/web' } },
                },
                { type: DragTypeEnum.BIBLE_ITEM, data: { old: true } },
            ],
        };
        state.importedMap = new Map([
            ['/old/doc', '/new/doc'],
            ['/old/app', '/new/app'],
            ['/old/image', '/new/image'],
            ['/old/web', '/new/web'],
        ]);
        mocks.importFiles.mockResolvedValue({
            localFilePathByOriginalPath: state.importedMap,
            writtenItemFilePaths: ['/new/doc'],
        });
        const result: any = await importPresentingFlowArchive(
            '/exports/Sunday.owapf.tar.gz',
        );
        expect(result.filePath).toContain('/runs/Sunday.owpf.next');
        expect(state.readJson.items[0].filePath).toBe('/new/doc');
        expect(state.readJson.items[1]).toMatchObject({
            filePath: '/new/app',
            data: '/new/app',
        });
        expect(state.readJson.items[2].data).toBe('/new/image');
        expect(state.readJson.items[3].data.data.filePath).toBe('/new/web');
        expect(state.readJson.items[4].data).toMatchObject({
            id: 9,
            filePath: '/bibles/default',
        });
        expect(mocks.canvas).toHaveBeenCalled();
        expect(mocks.backgrounds).toHaveBeenCalled();
        expect(mocks.fireUpdate).toHaveBeenCalled();
        expect(mocks.safeDelete).toHaveBeenCalledWith('/tmp/owapf-import');
    });

    test('rejects invalid archive state and handles password cancellation', async () => {
        state.readable = null;
        await expect(importPresentingFlowArchive('/x')).resolves.toBeNull();
        state.readable = { filePath: '/plain' };
        state.manifest = null;
        await expect(importPresentingFlowArchive('/x')).rejects.toThrow(
            'Invalid presenting flow archive manifest',
        );
        state.manifest = {
            version: 3,
            presentingFlow: 'flow.json',
            files: [],
            backgroundMetas: [],
        };
        state.readJson = { bad: true };
        await expect(importPresentingFlowArchive('/x')).rejects.toThrow(
            'Invalid presenting flow data',
        );
        state.readJson = { items: [] };
        state.dirPath = null;
        await expect(importPresentingFlowArchive('/x')).rejects.toThrow(
            'No presenting flows folder',
        );
    });

    test('adds new bible verses and reports unavailable or unsavable defaults', async () => {
        state.readJson = {
            items: [{ type: DragTypeEnum.BIBLE_ITEM, data: {} }],
        };
        state.bibleItem = {
            bibleKey: 'KJV',
            toJson: () => ({ target: { verse: 1 } }),
        };
        state.defaultBible = null;
        await expect(importPresentingFlowArchive('/x')).rejects.toThrow(
            'Unable to open the Default',
        );
        state.defaultBible = {
            items: [],
            filePath: '/default',
            addBibleItem: vi.fn(),
            save: vi.fn(async () => false),
            maxItemId: 4,
        };
        await expect(importPresentingFlowArchive('/x')).rejects.toThrow(
            'Unable to save',
        );
        state.defaultBible.save.mockResolvedValue(true);
        await expect(importPresentingFlowArchive('/x')).resolves.toBeTruthy();
        expect(state.defaultBible.addBibleItem).toHaveBeenCalled();
        expect(state.readJson.items[0].data.id).toBe(4);
    });

    test('selects, recognizes, downloads, and drops archives through the shared importer', async () => {
        expect(checkIsPresentingFlowArchiveFileFullName('a.owapf.tar.gz')).toBe(
            true,
        );
        expect(checkIsPresentingFlowArchiveFileFullName('a.txt')).toBe(false);
        await expect(
            selectAndImportPresentingFlowArchive(),
        ).resolves.toBeNull();
        state.selected = ['/picked.owapf.tar.gz'];
        await expect(
            selectAndImportPresentingFlowArchive(),
        ).resolves.toBeTruthy();
        expect(mocks.progress).toHaveBeenCalledWith('Import Presenting Flow');

        await expect(
            askAndImportPresentingFlowArchiveFromUrl(),
        ).resolves.toBeNull();
        state.url = 'https://example.com/Sunday.owapf.tar.gz';
        await expect(
            askAndImportPresentingFlowArchiveFromUrl(),
        ).resolves.toBeTruthy();
        expect(mocks.stream).toHaveBeenCalled();
        mocks.stream.mockRejectedValueOnce(new Error('download failed'));
        await expect(
            askAndImportPresentingFlowArchiveFromUrl(),
        ).resolves.toBeNull();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Import Presenting Flow',
            'download failed',
        );

        await expect(
            importDroppedPresentingFlowArchive('/local/archive'),
        ).resolves.toBeTruthy();
        state.appFilePath = '/electron/archive';
        await expect(
            importDroppedPresentingFlowArchive({ name: 'a' } as any),
        ).resolves.toBeTruthy();
        state.appFilePath = null;
        await expect(
            importDroppedPresentingFlowArchive({ name: 'a' } as any),
        ).resolves.toBeTruthy();
        expect(mocks.fsCopy).toHaveBeenCalled();
        state.copyPath = null;
        await expect(
            importDroppedPresentingFlowArchive({ name: 'bad' } as any),
        ).resolves.toBeNull();
        expect(mocks.handleError).toHaveBeenCalled();
        expect(mocks.safeDelete).toHaveBeenCalledWith('/tmp/owapf-dropped');
    });
});
