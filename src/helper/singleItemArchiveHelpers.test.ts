import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    addDocument: vi.fn(),
    setFileContent: vi.fn(),
    createWorkDir: vi.fn(),
    stageArchiveFiles: vi.fn(),
    writeArchiveManifest: vi.fn(),
    genNextArchiveFilePath: vi.fn(),
    safeDeleteDir: vi.fn(),
    readArchiveManifest: vi.fn(),
    validateArchiveFileEntries: vi.fn(),
    validateArchiveBackgroundMetas: vi.fn(),
    resolveKindDirPaths: vi.fn(),
    importArchiveFiles: vi.fn(),
    applyImportedCanvasMedia: vi.fn(),
    importBackgroundMetas: vi.fn(),
    importTransitionMetas: vi.fn(),
    toArchiveFileName: vi.fn(),
    toArchiveDotExtension: vi.fn(),
    checkIsArchiveFileFullName: vi.fn(),
    toArchiveFileNameFromUrl: vi.fn(),
    askForNewArchivePassword: vi.fn(),
    openArchiveForReading: vi.fn(),
    protectArchiveFile: vi.fn(),
    getInstance: vi.fn(),
    fireUpdateEvent: vi.fn(),
    getDirPathBySettingName: vi.fn(),
    getColorNoteFilePathSettings: vi.fn(),
    setColorNoteFilePathSettings: vi.fn(),
    getAppFilePathFromFile: vi.fn(),
    initHttpRequest: vi.fn(),
    askForURL: vi.fn(),
    streamDownloadFile: vi.fn(),
    describeDownloadError: vi.fn(),
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
    showSimpleToast: vi.fn(),
    showFileOrDirExplorer: vi.fn(),
    tarCreate: vi.fn(),
    tarExtract: vi.fn(),
    fsCopyFilePathToPath: vi.fn(),
    selectFiles: vi.fn(),
    handleError: vi.fn(),
    backgroundMetas: [{ path: '/source/song.ows.bg.json' }],
    transitionMetas: [] as unknown[],
}));

vi.mock('./appArchiveHelpers', () => ({
    ARCHIVE_VERSION: 1,
    PLAIN_ARCHIVE_TEMP_NAME: 'plain.tar.gz',
    ArchiveFileCollector: class {
        backgroundMetas = h.backgroundMetas;
        transitionMetas = h.transitionMetas;
        addDocument = h.addDocument;
        setFileContent = h.setFileContent;
    },
    createWorkDir: h.createWorkDir,
    stageArchiveFiles: h.stageArchiveFiles,
    writeArchiveManifest: h.writeArchiveManifest,
    genNextArchiveFilePath: h.genNextArchiveFilePath,
    safeDeleteDir: h.safeDeleteDir,
    readArchiveManifest: h.readArchiveManifest,
    validateArchiveFileEntries: h.validateArchiveFileEntries,
    validateArchiveBackgroundMetas: h.validateArchiveBackgroundMetas,
    resolveKindDirPaths: h.resolveKindDirPaths,
    importArchiveFiles: h.importArchiveFiles,
    applyImportedCanvasMedia: h.applyImportedCanvasMedia,
    importBackgroundMetas: h.importBackgroundMetas,
    importTransitionMetas: h.importTransitionMetas,
    toArchiveFileName: h.toArchiveFileName,
    toArchiveDotExtension: h.toArchiveDotExtension,
    checkIsArchiveFileFullName: h.checkIsArchiveFileFullName,
    toArchiveFileNameFromUrl: h.toArchiveFileNameFromUrl,
}));
vi.mock('./archivePasswordHelpers', () => ({
    askForNewArchivePassword: h.askForNewArchivePassword,
    openArchiveForReading: h.openArchiveForReading,
    protectArchiveFile: h.protectArchiveFile,
}));
vi.mock('./DirSource', () => ({
    default: { getDirPathBySettingName: h.getDirPathBySettingName },
}));
vi.mock('./FileSource', () => ({
    default: { getInstance: h.getInstance },
}));
vi.mock('./FileSourceMetaManager', () => ({
    getColorNoteFilePathSettings: h.getColorNoteFilePathSettings,
    setColorNoteFilePathSettings: h.setColorNoteFilePathSettings,
}));
vi.mock('./localFileHelpers', () => ({
    getAppFilePathFromFile: h.getAppFilePathFromFile,
}));
vi.mock('./bible-helpers/downloadHelpers', () => ({
    initHttpRequest: h.initHttpRequest,
}));
vi.mock('../background/downloadHelper', () => ({
    askForURL: h.askForURL,
    describeDownloadError: h.describeDownloadError,
    messageCallback: vi.fn(),
    streamDownloadFile: h.streamDownloadFile,
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: h.showProgressBar,
    hideProgressBar: h.hideProgressBar,
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: h.showFileOrDirExplorer,
    tarCreate: h.tarCreate,
    tarExtract: h.tarExtract,
}));
vi.mock('../server/fileHelpers', () => ({
    fsCopyFilePathToPath: h.fsCopyFilePathToPath,
    getDownloadPath: () => '/downloads',
    pathJoin: (...parts: string[]) => parts.join('/'),
    selectFiles: h.selectFiles,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('./errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));

import {
    askAndImportSingleItemArchiveFromUrl,
    createSingleItemArchive,
    exportSingleItem,
    importDroppedSingleItemArchive,
    importSingleItemArchive,
    selectAndImportSingleItemArchive,
    type SingleItemArchiveConfigType,
} from './singleItemArchiveHelpers';

const config: SingleItemArchiveConfigType = {
    itemKind: 'document',
    dotExtension: '.owadoc',
    fallbackName: 'Document',
    workDirPrefix: 'owadoc',
    exportTitle: 'Export Document',
    importTitle: 'Import Document',
    urlLabel: 'Document URL:',
    itemLabel: 'document',
};
const sourcePath = '/source/song.ows';
const localPath = '/library/song.ows';
const entry = { kind: 'document', originalPath: sourcePath };
const manifest = {
    version: 1,
    itemKind: 'document',
    item: sourcePath,
    files: [entry],
    backgroundMetas: [],
    transitionMetas: [],
    colorNotes: { red: '#ff0000' },
    dataDirPath: '/source',
};

beforeEach(() => {
    vi.resetAllMocks();
    h.transitionMetas.length = 0;
    h.addDocument.mockResolvedValue(true);
    h.createWorkDir.mockImplementation(
        async (prefix: string) => `/tmp/${prefix}`,
    );
    h.stageArchiveFiles.mockResolvedValue({
        archiveFiles: [entry],
        archiveEntries: ['manifest.json', 'files/song.ows'],
    });
    h.genNextArchiveFilePath.mockResolvedValue('/downloads/Song.owadoc');
    h.toArchiveDotExtension.mockImplementation(
        (extension: string) => extension,
    );
    h.toArchiveFileName.mockReturnValue('Song.owadoc');
    h.toArchiveFileNameFromUrl.mockReturnValue('remote.owadoc');
    h.getColorNoteFilePathSettings.mockReturnValue({ red: '#ff0000' });
    h.getInstance.mockReturnValue({
        name: 'Song',
        fireUpdateEvent: h.fireUpdateEvent,
    });
    h.askForNewArchivePassword.mockResolvedValue('');
    h.openArchiveForReading.mockResolvedValue({
        filePath: '/archives/song.owadoc',
    });
    h.readArchiveManifest.mockResolvedValue(manifest);
    h.validateArchiveFileEntries.mockImplementation((files: unknown) => files);
    h.validateArchiveBackgroundMetas.mockImplementation(
        (metas: unknown) => metas ?? [],
    );
    h.resolveKindDirPaths.mockReturnValue(new Map([['document', '/library']]));
    h.importArchiveFiles.mockResolvedValue({
        localFilePathByOriginalPath: new Map([[sourcePath, localPath]]),
        writtenItemFilePaths: [localPath],
    });
    h.getDirPathBySettingName.mockReturnValue('/library');
    h.selectFiles.mockResolvedValue(['/archives/song.owadoc']);
    h.askForURL.mockResolvedValue('https://example.org/song.owadoc');
    h.initHttpRequest.mockResolvedValue({ status: 200 });
    h.fsCopyFilePathToPath.mockResolvedValue('/tmp/owadoc-dropped/song.owadoc');
    h.describeDownloadError.mockReturnValue('Could not reach that address');
});

describe('single-item archives', () => {
    it('exports live content, sidecars and color notes, then removes staging', async () => {
        const collectExtraFiles = vi.fn(async () => {});
        const archivePath = await createSingleItemArchive(sourcePath, {
            ...config,
            readItemContent: async () => 'unsaved note',
            collectExtraFiles,
        });
        expect(archivePath).toBe('/downloads/Song.owadoc');
        expect(h.addDocument).toHaveBeenCalledWith(sourcePath, 'document');
        expect(h.setFileContent).toHaveBeenCalledWith(
            sourcePath,
            'unsaved note',
        );
        expect(collectExtraFiles).toHaveBeenCalledWith(
            expect.anything(),
            sourcePath,
            'unsaved note',
        );
        expect(h.writeArchiveManifest).toHaveBeenCalledWith(
            '/tmp/owadoc-export',
            expect.objectContaining({
                item: sourcePath,
                files: [entry],
                colorNotes: { red: '#ff0000' },
            }),
        );
        expect(h.tarCreate).toHaveBeenCalledWith(
            '/tmp/owadoc-export',
            '/downloads/Song.owadoc',
            ['manifest.json', 'files/song.ows'],
            true,
        );
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-export');
    });

    it('protects an export inside staging and removes the plain archive', async () => {
        h.transitionMetas.push({ path: '/source/song.ows.transition.json' });
        h.protectArchiveFile.mockResolvedValue('/downloads/Song.owadoc.enc');
        expect(
            await createSingleItemArchive(sourcePath, config, 'secret'),
        ).toBe('/downloads/Song.owadoc.enc');
        expect(h.tarCreate).toHaveBeenCalledWith(
            '/tmp/owadoc-export',
            '/tmp/owadoc-export/plain.tar.gz',
            expect.any(Array),
            true,
        );
        expect(h.protectArchiveFile).toHaveBeenCalledWith(
            '/tmp/owadoc-export/plain.tar.gz',
            '/downloads/Song.owadoc',
            'secret',
        );
        expect(h.writeArchiveManifest.mock.calls[0][1]).toMatchObject({
            transitionMetas: h.transitionMetas,
        });
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-export');
    });

    it('cleans staging when the source cannot be collected', async () => {
        h.addDocument.mockResolvedValue(false);
        await expect(
            createSingleItemArchive(sourcePath, config),
        ).rejects.toThrow('Unable to read the document');
        expect(h.stageArchiveFiles).not.toHaveBeenCalled();
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-export');
    });

    it('imports a written item, media links, sidecars and notes', async () => {
        const applyImportedExtraFiles = vi.fn(async () => {});
        expect(
            await importSingleItemArchive('/archives/song.owadoc', {
                ...config,
                getItemDirSettingName: () => 'document-dir',
                getExtraPresetDirPaths: async () =>
                    new Map([['video', '/videos']]),
                applyImportedExtraFiles,
            }),
        ).toBe(localPath);
        expect(h.resolveKindDirPaths).toHaveBeenCalledWith(
            [entry],
            new Map([
                ['video', '/videos'],
                ['document', '/library'],
            ]),
        );
        expect(h.importArchiveFiles).toHaveBeenCalledWith(
            '/tmp/owadoc-import',
            [entry],
            expect.any(Map),
            '/source',
        );
        expect(h.applyImportedCanvasMedia).toHaveBeenCalledWith(
            [localPath],
            new Map([[sourcePath, localPath]]),
        );
        expect(h.importBackgroundMetas).toHaveBeenCalled();
        expect(h.importTransitionMetas).toHaveBeenCalled();
        expect(h.setColorNoteFilePathSettings).toHaveBeenCalledWith(localPath, {
            red: '#ff0000',
        });
        expect(applyImportedExtraFiles).toHaveBeenCalledWith(
            localPath,
            new Map([[sourcePath, localPath]]),
        );
        expect(h.fireUpdateEvent).toHaveBeenCalledOnce();
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-import');
    });

    it('does not overwrite notes or extra files on a reused local item', async () => {
        h.importArchiveFiles.mockResolvedValue({
            localFilePathByOriginalPath: new Map([[sourcePath, localPath]]),
            writtenItemFilePaths: [],
        });
        const applyImportedExtraFiles = vi.fn();
        expect(
            await importSingleItemArchive('/archives/song.owadoc', {
                ...config,
                applyImportedExtraFiles,
            }),
        ).toBe(localPath);
        expect(h.setColorNoteFilePathSettings).not.toHaveBeenCalled();
        expect(applyImportedExtraFiles).not.toHaveBeenCalled();
        expect(h.fireUpdateEvent).toHaveBeenCalledOnce();
    });

    it('accepts a legacy document key but refuses a different item kind', async () => {
        h.readArchiveManifest.mockResolvedValueOnce({
            ...manifest,
            item: undefined,
            itemKind: undefined,
            document: sourcePath,
        });
        expect(
            await importSingleItemArchive('/archives/old.owadoc', config),
        ).toBe(localPath);
        h.readArchiveManifest.mockResolvedValueOnce({
            ...manifest,
            itemKind: 'bible-list',
        });
        await expect(
            importSingleItemArchive('/archives/wrong.owadoc', config),
        ).rejects.toThrow('not a document');
        expect(h.importArchiveFiles).toHaveBeenCalledTimes(1);
        expect(h.safeDeleteDir).toHaveBeenCalledTimes(2);
    });

    it('rejects a missing destination before importing any files', async () => {
        h.getDirPathBySettingName.mockReturnValue(null);
        await expect(
            importSingleItemArchive('/archives/song.owadoc', {
                ...config,
                getItemDirSettingName: () => 'document-dir',
            }),
        ).rejects.toThrow('No "document" folder is selected');
        expect(h.importArchiveFiles).not.toHaveBeenCalled();
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-import');
    });

    it('cancels the password prompt without starting an export', async () => {
        h.askForNewArchivePassword.mockResolvedValue(null);
        expect(await exportSingleItem(sourcePath, config)).toBeNull();
        expect(h.showProgressBar).not.toHaveBeenCalled();
        expect(h.tarCreate).not.toHaveBeenCalled();
    });

    it('reports an export error and always hides progress', async () => {
        h.addDocument.mockResolvedValue(false);
        expect(await exportSingleItem(sourcePath, config)).toBeNull();
        expect(h.handleError).toHaveBeenCalledWith(expect.any(Error));
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Export Document',
            expect.stringContaining('Unable to read'),
        );
        expect(h.hideProgressBar).toHaveBeenCalledWith('Export Document');
    });

    it('imports the chosen archive and returns null for a cancelled picker', async () => {
        expect(await selectAndImportSingleItemArchive(config)).toBe(localPath);
        expect(h.selectFiles).toHaveBeenCalledWith([
            expect.objectContaining({
                extensions: ['gz', 'tgz', 'tar', 'enc'],
            }),
        ]);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Import Document',
            'Imported Song',
        );
        h.selectFiles.mockResolvedValueOnce([]);
        expect(await selectAndImportSingleItemArchive(config)).toBeNull();
        expect(h.tarExtract).toHaveBeenCalledTimes(1);
    });

    it('downloads a URL to a temporary file and removes it after import', async () => {
        expect(await askAndImportSingleItemArchiveFromUrl(config)).toBe(
            localPath,
        );
        expect(h.initHttpRequest).toHaveBeenCalledWith(
            new URL('https://example.org/song.owadoc'),
        );
        expect(h.streamDownloadFile).toHaveBeenCalledWith(
            '/tmp/owadoc-url/remote.owadoc',
            { status: 200 },
            expect.any(Function),
            true,
        );
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-url');
    });

    it('stages a dropped file without an app path and reports a failed copy', async () => {
        const file = { name: 'song.owadoc' } as File;
        h.getAppFilePathFromFile.mockReturnValue(null);
        expect(await importDroppedSingleItemArchive(file, config)).toBe(
            localPath,
        );
        expect(h.fsCopyFilePathToPath).toHaveBeenCalledWith(
            file,
            '/tmp/owadoc-dropped',
            'song.owadoc',
        );
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-dropped');
        h.fsCopyFilePathToPath.mockResolvedValueOnce(null);
        expect(await importDroppedSingleItemArchive(file, config)).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Import Document',
            'Unable to read the dropped document archive',
        );
    });
});
