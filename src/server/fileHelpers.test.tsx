// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    showSimpleToastMock,
    handleErrorMock,
    showProgressBarMock,
    hideProgressBarMock,
    tranMock,
} = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
    handleErrorMock: vi.fn(),
    showProgressBarMock: vi.fn(),
    hideProgressBarMock: vi.fn(),
    tranMock: vi.fn((value: string) => value),
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: showProgressBarMock,
    hideProgressBar: hideProgressBarMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: tranMock,
}));

async function loadModules(pathname = '/setting.html') {
    vi.resetModules();
    globalThis.localStorage.clear();
    history.replaceState(null, '', pathname);
    document.title = 'File Helpers';

    const [fileHelpers, { default: appProvider }] = await Promise.all([
        import('./fileHelpers'),
        import('./appProvider'),
    ]);

    return { fileHelpers, appProvider };
}

describe('fileHelpers', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        globalThis.localStorage.clear();
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    test('exposes path and mimetype helpers', async () => {
        const { fileHelpers } = await loadModules();
        const [appDocumentExt] = fileHelpers.getMimetypeExtensions('appDocument');

        expect(fileHelpers.checkIsAppFile(`deck.${appDocumentExt}`)).toBe(true);
        expect(fileHelpers.pathSeparator).toBe('/');
        expect(fileHelpers.pathJoin('/browser-data', 'docs', 'song.txt')).toBe(
            '/browser-data/docs/song.txt',
        );
        expect(fileHelpers.pathResolve('/browser-data/docs/')).toBe(
            '/browser-data/docs',
        );
        expect(fileHelpers.pathBasename('/browser-data/docs/song.txt')).toBe(
            'song.txt',
        );
        expect(fileHelpers.getFileName('song.txt')).toBe('song');
        expect(fileHelpers.getFileDotExtension('song.txt')).toBe('.txt');
        expect(fileHelpers.addExtension('song', '.txt')).toBe('song.txt');
        expect(fileHelpers.getFileMetaData(`deck.${appDocumentExt}`)?.appMimetype.mimetypeName).toBe(
            'appDocument',
        );
        expect(fileHelpers.getAllAppMimetype().length).toBeGreaterThan(0);
        expect(fileHelpers.getAppMimetype('other')).toEqual([]);
        expect(fileHelpers.isSupportedMimetype('image/png', 'image')).toBe(true);
        expect(fileHelpers.isSupportedExt('cover.png', 'image')).toBe(true);
        expect(
            fileHelpers.getDotExtensionFromBase64Data(
                'data:image/png;base64,AAAA',
            ),
        ).toBe('.png');
        expect(fileHelpers.getDotExtensionFromBase64Data('data:text/plain;base64,QQ==')).toBeNull();
    });

    test('creates, writes, lists, renames, and deletes files in the browser mock fs', async () => {
        const { fileHelpers } = await loadModules();
        const baseDir = '/browser-data/projects';

        await fileHelpers.fsCreateDir(baseDir);
        await fileHelpers.fsCreateFile(`${baseDir}/note.txt`, 'hello');

        expect(await fileHelpers.fsCheckDirExist(baseDir)).toBe(true);
        expect(await fileHelpers.fsCheckFileExist(baseDir, 'note.txt')).toBe(true);
        expect(await fileHelpers.fsReadFile(`${baseDir}/note.txt`)).toBe('hello');

        await fileHelpers.fsWriteFile(`${baseDir}/note.txt`, 'world');
        expect(fileHelpers.fsReadSync(`${baseDir}/note.txt`)).toBe('world');

        fileHelpers.fsWriteFileSync(`${baseDir}/second.txt`, 'two');
        expect(fileHelpers.fsExistSync(`${baseDir}/second.txt`)).toBe(true);

        await fileHelpers.fsCreateDir(`${baseDir}/visible`);
        await fileHelpers.fsCreateDir(`${baseDir}/.hidden`);

        const listedNames = (await fileHelpers.fsList(baseDir)).map((item) => {
            return item.name;
        });
        expect(listedNames).toEqual(
            expect.arrayContaining(['note.txt', 'second.txt', 'visible', '.hidden']),
        );
        expect(await fileHelpers.fsListFiles(baseDir)).toEqual(
            expect.arrayContaining(['note.txt', 'second.txt']),
        );
        expect(await fileHelpers.fsListDirectories(baseDir)).toEqual(['visible']);

        await fileHelpers.fsRenameFile(baseDir, 'note.txt', 'renamed.txt');
        expect(await fileHelpers.fsCheckFileExist(`${baseDir}/renamed.txt`)).toBe(
            true,
        );

        await fileHelpers.fsDeleteFile(`${baseDir}/renamed.txt`);
        expect(await fileHelpers.fsCheckFileExist(`${baseDir}/renamed.txt`)).toBe(
            false,
        );

        await fileHelpers.fsDeleteDir(`${baseDir}/visible`);
        expect(await fileHelpers.fsCheckDirExist(`${baseDir}/visible`)).toBe(false);
    });

    test('creates typed files and handles duplicate and override flows', async () => {
        const { fileHelpers } = await loadModules();
        const dirPath = '/browser-data/new';
        const [playlistExt] = fileHelpers.getMimetypeExtensions('playlist');

        await fileHelpers.fsCreateDir(dirPath);
        await expect(
            fileHelpers.createNewFileDetail(dirPath, 'setlist', '[]', 'playlist'),
        ).resolves.toBe(`${dirPath}/setlist.${playlistExt}`);
        await expect(
            fileHelpers.fsCreateFile(`${dirPath}/setlist.${playlistExt}`, 'updated', true),
        ).resolves.toBe(`${dirPath}/setlist.${playlistExt}`);
        expect(await fileHelpers.fsReadFile(`${dirPath}/setlist.${playlistExt}`)).toBe(
            'updated',
        );
        await expect(
            fileHelpers.createNewFileDetail(dirPath, 'setlist', '[]', 'playlist'),
        ).resolves.toBeNull();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Creating Playlist',
            'File exist',
        );
        await expect(
            fileHelpers.createNewFileDetail(dirPath, 'unknown', '{}', 'other'),
        ).rejects.toThrow('No extensions found for mimetype: other');
    });

    test('copies files, resolves filenames, and lists files by mimetype', async () => {
        const { fileHelpers, appProvider } = await loadModules();
        const mediaDir = '/browser-data/media';
        const copyDir = '/browser-data/copies';
        const pngBase64 =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

        await fileHelpers.fsCreateDir(mediaDir);
        await fileHelpers.fsCreateDir(copyDir);
        fileHelpers.writeFileFromBase64Sync(`${mediaDir}/picture.png`, pngBase64);

        const matchedFiles = await fileHelpers.fsListFilesWithMimetype(
            mediaDir,
            'image',
        );
        expect(matchedFiles).toEqual([`${mediaDir}/picture.png`]);

        const copiedPath = await fileHelpers.fsCopyFilePathToPath(
            `${mediaDir}/picture.png`,
            copyDir,
        );
        expect(copiedPath).toBe(`${copyDir}/picture.png`);
        expect(await fileHelpers.fsCheckFileExist(`${copyDir}/picture.png`)).toBe(
            true,
        );

        const uploadedFile = new File(['alpha'], 'upload.txt', {
            type: 'text/plain',
        });
        const writeStream = appProvider.fileUtils.createWriteStream(
            `${copyDir}/upload.txt`,
        );
        const closePromise = new Promise<void>((resolve) => {
            writeStream.once('close', resolve);
        });
        writeStream.write('alpha');
        writeStream.end();
        await closePromise;
        expect(await fileHelpers.fsReadFile(`${copyDir}/upload.txt`)).toBe(
            'alpha',
        );

        expect(fileHelpers.getFileFullName(uploadedFile)).toBe('upload.txt');
        expect(fileHelpers.getFileFullName(`${copyDir}/upload.txt`)).toBe(
            'upload.txt',
        );

        await expect(
            fileHelpers.fsCopyFilePathToPath(new Blob(['x']), copyDir),
        ).resolves.toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copying File:undefined',
            'Error occurred during copying file: Cannot get file name',
        );
        expect(showProgressBarMock).toHaveBeenCalled();
        expect(hideProgressBarMock).toHaveBeenCalled();
    });

    test('handles special paths, selection helpers, hashes, base64 conversion, and provider state', async () => {
        const { fileHelpers, appProvider } = await loadModules('/presenter.html');

        appProvider.messageUtils.listenForData(
            'main:app:select-dirs',
            (_event, payload) => {
                appProvider.messageUtils.sendData(payload.replyEventName, [
                    '/browser-data/desktop',
                ]);
            },
        );
        appProvider.messageUtils.listenForData(
            'main:app:select-files',
            (_event, payload) => {
                appProvider.messageUtils.sendData(payload.replyEventName, [
                    '/browser-data/downloads/pic.png',
                ]);
            },
        );

        await expect(fileHelpers.selectDirs()).resolves.toEqual([
            '/browser-data/desktop',
        ]);
        await expect(
            fileHelpers.selectFiles([{ name: 'Images', extensions: ['png'] }]),
        ).resolves.toEqual(['/browser-data/downloads/pic.png']);

        expect(fileHelpers.getUserWritablePath()).toBe('/browser-data');
        expect(fileHelpers.getDesktopPath()).toBe('/browser-data/desktop');
        expect(fileHelpers.getDownloadPath()).toBe('/browser-data/downloads');
        expect(fileHelpers.getTempPath()).toBe('/browser-data/temp');

        await fileHelpers.ensureDirectory('/browser-data/ensured');
        expect(await fileHelpers.fsCheckDirExist('/browser-data/ensured')).toBe(
            true,
        );

        await fileHelpers.fsCreateFile('/browser-data/hash.txt', 'content');
        await fileHelpers.ensureDirectory('/browser-data/hash.txt');
        await expect(fileHelpers.getFileMD5('/browser-data/hash.txt')).resolves.toMatch(
            /^[0-9a-f]{8}$/,
        );
        await expect(fileHelpers.getFileMD5('/browser-data/missing.txt')).resolves.toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                blob: async () => new Blob(['hello'], { type: 'text/plain' }),
            })),
        );
        await expect(fileHelpers.getFileBase64('/remote')).resolves.toMatch(
            /^data:text\/plain;base64,/, 
        );

        expect(appProvider.windowTitle).toBe('File Helpers');
        expect(appProvider.isPagePresenter).toBe(true);
        expect(appProvider.isMainPage).toBe(true);
        expect(appProvider.getIsMouseOverApp()).toBe(false);
        document.dispatchEvent(new Event('mouseenter'));
        expect(appProvider.getIsMouseOverApp()).toBe(true);
        document.dispatchEvent(new Event('mouseleave'));
        expect(appProvider.getIsMouseOverApp()).toBe(false);
        vi.spyOn(document, 'hasFocus').mockReturnValue(true);
        expect(appProvider.getIsWindowFocused()).toBe(true);
    });
});
