import { beforeEach, describe, expect, it, vi } from 'vitest';

// The outcomes the sibling suite leaves out: a finished export, the import
// refusing a bundle, a cancelled password or URL, and a download that failed.
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
}));

vi.mock('./appArchiveHelpers', () => ({
    ARCHIVE_VERSION: 1,
    PLAIN_ARCHIVE_TEMP_NAME: 'plain.tar.gz',
    ArchiveFileCollector: class {
        backgroundMetas = [];
        transitionMetas = [];
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
    messageCallback: () => {},
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
    checkIsSingleItemArchiveFileFullName,
    exportSingleItem,
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
    colorNotes: null,
};

beforeEach(() => {
    h.addDocument.mockResolvedValue(true);
    h.createWorkDir.mockImplementation(
        async (prefix: string) => `/tmp/${prefix}`,
    );
    h.stageArchiveFiles.mockResolvedValue({
        archiveFiles: [entry],
        archiveEntries: ['manifest.json', 'files'],
    });
    h.genNextArchiveFilePath.mockResolvedValue('/downloads/Song.owadoc');
    h.toArchiveDotExtension.mockImplementation((dotExtension: string) => {
        return dotExtension;
    });
    h.toArchiveFileName.mockReturnValue('Song.owadoc');
    h.toArchiveFileNameFromUrl.mockReturnValue('remote.owadoc');
    h.getColorNoteFilePathSettings.mockReturnValue({});
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
    h.validateArchiveBackgroundMetas.mockImplementation((metas: unknown) => {
        return metas ?? [];
    });
    h.resolveKindDirPaths.mockReturnValue(new Map([['document', '/library']]));
    h.importArchiveFiles.mockResolvedValue({
        localFilePathByOriginalPath: new Map([[sourcePath, localPath]]),
        writtenItemFilePaths: [localPath],
    });
    h.selectFiles.mockResolvedValue(['/archives/song.owadoc']);
    h.askForURL.mockResolvedValue('https://example.org/song.owadoc');
    h.initHttpRequest.mockResolvedValue({ status: 200 });
    h.describeDownloadError.mockImplementation((error: any) => {
        return `described: ${error?.message}`;
    });
});

describe('naming and exporting', () => {
    it('recognises its own archives by the configured extension', () => {
        h.checkIsArchiveFileFullName.mockReturnValue(true);
        expect(
            checkIsSingleItemArchiveFileFullName('song.owadoc', config),
        ).toBe(true);
        expect(h.checkIsArchiveFileFullName).toHaveBeenCalledWith(
            'song.owadoc',
            '.owadoc',
        );
    });

    it('says where a finished export went and opens that folder', async () => {
        expect(await exportSingleItem(sourcePath, config)).toBe(
            '/downloads/Song.owadoc',
        );
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Export Document',
            'Exported to /downloads/Song.owadoc',
        );
        expect(h.showFileOrDirExplorer).toHaveBeenCalledWith(
            '/downloads/Song.owadoc',
        );
        expect(h.protectArchiveFile).not.toHaveBeenCalled();
        expect(h.hideProgressBar).toHaveBeenCalledWith('Export Document');
    });
});

describe('importSingleItemArchive refusals', () => {
    it('refuses a manifest of another version or with no item', async () => {
        for (const badManifest of [
            null,
            { ...manifest, version: 2 },
            { ...manifest, item: 5 },
        ]) {
            h.readArchiveManifest.mockResolvedValueOnce(badManifest);
            await expect(
                importSingleItemArchive('/archives/bad.owadoc', config),
            ).rejects.toThrow('Invalid document archive manifest');
        }
        expect(h.importArchiveFiles).not.toHaveBeenCalled();
        expect(h.safeDeleteDir).toHaveBeenCalledTimes(3);
    });

    it('answers null, unpacking nothing, when the password is not given', async () => {
        h.openArchiveForReading.mockResolvedValue(null);
        expect(
            await importSingleItemArchive('/archives/song.owadoc.enc', config),
        ).toBeNull();
        expect(h.tarExtract).not.toHaveBeenCalled();
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-import');
    });

    it('fails when the bundle does not carry the item it names', async () => {
        h.importArchiveFiles.mockResolvedValue({
            localFilePathByOriginalPath: new Map([['/other.mp4', '/v.mp4']]),
            writtenItemFilePaths: [],
        });
        await expect(
            importSingleItemArchive('/archives/song.owadoc', config),
        ).rejects.toThrow('The archive holds no document');
        expect(h.applyImportedCanvasMedia).not.toHaveBeenCalled();
        expect(h.fireUpdateEvent).not.toHaveBeenCalled();
    });

    it('stores no color notes from a manifest whose notes are not a map', async () => {
        expect(
            await importSingleItemArchive('/archives/song.owadoc', config),
        ).toBe(localPath);
        expect(h.setColorNoteFilePathSettings).toHaveBeenCalledWith(
            localPath,
            {},
        );
        expect(h.importArchiveFiles).toHaveBeenCalledWith(
            '/tmp/owadoc-import',
            [entry],
            expect.any(Map),
            null,
        );
    });
});

describe('the import flows', () => {
    it('says nothing when the password prompt is cancelled', async () => {
        h.openArchiveForReading.mockResolvedValue(null);
        expect(await selectAndImportSingleItemArchive(config)).toBeNull();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
        expect(h.handleError).not.toHaveBeenCalled();
        expect(h.hideProgressBar).toHaveBeenCalledWith('Import Document');
    });

    it('reports a failed import under its title', async () => {
        h.readArchiveManifest.mockRejectedValueOnce(
            new Error('Invalid document archive manifest'),
        );
        expect(await selectAndImportSingleItemArchive(config)).toBeNull();
        expect(h.handleError).toHaveBeenCalledWith(
            new Error('Invalid document archive manifest'),
        );
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Import Document',
            'Invalid document archive manifest',
        );

        h.tarExtract.mockRejectedValueOnce({ code: 'EBADTAR' });
        expect(await selectAndImportSingleItemArchive(config)).toBeNull();
        expect(h.showSimpleToast).toHaveBeenLastCalledWith(
            'Import Document',
            'Unable to import the document',
        );
        expect(h.hideProgressBar).toHaveBeenCalledTimes(2);
    });

    it('does nothing when no URL is given', async () => {
        h.askForURL.mockResolvedValue(null);
        expect(await askAndImportSingleItemArchiveFromUrl(config)).toBeNull();
        expect(h.askForURL).toHaveBeenCalledWith(
            'Import From URL',
            'Document URL:',
        );
        expect(h.createWorkDir).not.toHaveBeenCalled();
        expect(h.initHttpRequest).not.toHaveBeenCalled();
    });

    it('a failed download is logged once, the download having said why', async () => {
        const error = new Error('connection reset');
        h.streamDownloadFile.mockRejectedValue(error);
        expect(await askAndImportSingleItemArchiveFromUrl(config)).toBeNull();
        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
        expect(h.tarExtract).not.toHaveBeenCalled();
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-url');
    });

    it('an address that cannot be reached is told in words', async () => {
        const error = new Error('getaddrinfo ENOTFOUND');
        h.initHttpRequest.mockRejectedValue(error);
        expect(await askAndImportSingleItemArchiveFromUrl(config)).toBeNull();
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(h.describeDownloadError).toHaveBeenCalledWith(error);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Import Document',
            'described: getaddrinfo ENOTFOUND',
        );
        expect(h.streamDownloadFile).not.toHaveBeenCalled();
        expect(h.safeDeleteDir).toHaveBeenCalledWith('/tmp/owadoc-url');
    });
});
