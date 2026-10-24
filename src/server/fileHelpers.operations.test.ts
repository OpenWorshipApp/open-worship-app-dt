// @vitest-environment jsdom

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    forceExdev: false,
    failCopy: false,
    handleError: vi.fn(),
    showSimpleToast: vi.fn(),
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
    electronSendAsync: vi.fn(),
    sendDataSync: vi.fn(),
}));

vi.mock('./appProvider', async () => {
    const fileSystem = await import('node:fs');
    const pathModule = await import('node:path');
    const { createHash: createNodeHash } = await import('node:crypto');
    const { pathToFileURL: toUrl } = await import('node:url');
    return {
        default: {
            isPageScreen: false,
            systemUtils: { isDev: false, isWindows: true },
            sessionData: { defaultStorageDirPath: null },
            pathUtils: pathModule,
            browserUtils: {
                pathToFileURL: (filePath: string) => toUrl(filePath).href,
            },
            messageUtils: { sendDataSync: h.sendDataSync },
            cryptoUtils: { createHash: createNodeHash },
            fileUtils: {
                ...fileSystem,
                rename: (
                    from: string,
                    to: string,
                    callback: (error: NodeJS.ErrnoException | null) => void,
                ) => {
                    if (h.forceExdev) {
                        h.forceExdev = false;
                        callback(
                            Object.assign(new Error('different device'), {
                                code: 'EXDEV',
                            }),
                        );
                    } else {
                        fileSystem.rename(from, to, callback);
                    }
                },
                copyFile: (
                    from: string,
                    to: string,
                    callback: (error: NodeJS.ErrnoException | null) => void,
                ) => {
                    if (h.failCopy) {
                        fileSystem.writeFileSync(to, 'partial');
                        callback(new Error('disk full'));
                    } else {
                        fileSystem.copyFile(from, to, callback);
                    }
                },
                rmdir: (
                    dir: string,
                    _options: unknown,
                    callback: (error: NodeJS.ErrnoException | null) => void,
                ) => {
                    fileSystem.rm(dir, { recursive: true }, callback);
                },
            },
        },
    };
});
vi.mock('../helper/FileSource', async () => {
    const fileSystem = await import('node:fs');
    const pathModule = await import('node:path');
    return {
        default: {
            getInstance: (filePath: string, fileFullName?: string) => {
                const fullPath = fileFullName
                    ? pathModule.join(filePath, fileFullName)
                    : filePath;
                return {
                    filePath: fullPath,
                    fullName: pathModule.basename(fullPath),
                    genNextFilePath: async () =>
                        fileSystem.existsSync(fullPath)
                            ? `${fullPath}.copy`
                            : fullPath,
                };
            },
        },
    };
});
vi.mock('./appHelpers', () => ({ electronSendAsync: h.electronSendAsync }));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: h.showProgressBar,
    hideProgressBar: h.hideProgressBar,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import {
    createNewFileDetail,
    ensureDirectory,
    fsCheckDirExist,
    fsCheckFileExist,
    fsCopyFilePathToPath,
    fsCreateDir,
    fsCreateFile,
    fsCreateReadStream,
    fsCreateWriteStream,
    fsDeleteDir,
    fsDeleteFile,
    fsGetFileSize,
    fsGetFileStamp,
    fsList,
    fsListDirectories,
    fsListDirents,
    fsListFilesWithMimetype,
    fsMove,
    fsReadFile,
    fsReadFileBase64Sync,
    fsReadFileBytes,
    fsRenameFile,
    fsWriteFile,
    getDotExtensionFromBase64Data,
    getDownloadPath,
    getFileBase64,
    getFileChecksum,
    getFileFullName,
    getHomePath,
    getFileMD5,
    getFileMetaData,
    getMimetypeExtensions,
    getDesktopPath,
    getTempPath,
    isSupportedExt,
    isSupportedMimetype,
    selectDirs,
    selectFiles,
    toScreenFileURL,
} from './fileHelpers';

let workDir: string;
const inWorkDir = (...parts: string[]) => path.join(workDir, ...parts);

beforeEach(() => {
    vi.clearAllMocks();
    h.forceExdev = false;
    h.failCopy = false;
    workDir = fs.mkdtempSync(path.join(tmpdir(), 'owa-file-ops-'));
});

afterEach(() => {
    vi.unstubAllGlobals();
    // Only remove this test's direct child of the system temporary directory.
    const resolved = path.resolve(workDir);
    if (
        path.dirname(resolved) !== path.resolve(tmpdir()) ||
        !path.basename(resolved).startsWith('owa-file-ops-')
    ) {
        throw new Error(`Unsafe test cleanup path: ${resolved}`);
    }
    fs.rmSync(resolved, { recursive: true, force: true });
});

describe('file operations on a temporary directory', () => {
    it('creates, stamps, reads and deletes a file without changing its bytes', async () => {
        const filePath = inWorkDir('song.ows');
        expect(await fsCheckFileExist(filePath)).toBe(false);
        expect(await fsCheckDirExist(workDir)).toBe(true);
        await fsCreateFile(filePath, 'first');
        await expect(fsCreateFile(filePath, 'second')).rejects.toThrow(
            'File exist',
        );
        expect(await fsReadFile(filePath)).toBe('first');
        expect(await fsGetFileSize(filePath)).toBe(5);
        expect(await fsGetFileStamp(filePath)).toMatchObject({ size: 5 });
        await fsCreateFile(filePath, 'second', true);
        expect(await fsReadFile(filePath)).toBe('second');
        expect(new Uint8Array(await fsReadFileBytes(filePath))).toEqual(
            new Uint8Array(Buffer.from('second')),
        );
        await fsDeleteFile(filePath);
        expect(await fsCheckFileExist(filePath)).toBe(false);
        expect(await fsGetFileStamp(filePath)).toBeNull();
    });

    it('rejects the wrong kind of path and protects an existing destination', async () => {
        const filePath = inWorkDir('song.ows');
        await fsWriteFile(filePath, 'song');
        await expect(fsGetFileSize(workDir)).rejects.toThrow(
            'Path is not a file',
        );
        expect(await fsGetFileStamp(workDir)).toBeNull();
        await expect(fsDeleteDir(filePath)).rejects.toThrow('not a directory');
        await expect(fsDeleteFile(workDir)).rejects.toThrow('not a file');
        await expect(ensureDirectory(filePath)).rejects.toThrow(
            'a file already exists',
        );
        await expect(
            fsRenameFile(workDir, 'missing.ows', 'next.ows'),
        ).rejects.toThrow('File not exist');
        await fsWriteFile(inWorkDir('next.ows'), 'another');
        await expect(
            fsRenameFile(workDir, 'song.ows', 'next.ows'),
        ).rejects.toThrow('File exist');
    });

    it('lists dirents in one read and filters hidden files and MIME types', async () => {
        const dirPath = inWorkDir('documents');
        await ensureDirectory(dirPath);
        await fsWriteFile(path.join(dirPath, 'song.ows'), 'song');
        await fsWriteFile(path.join(dirPath, '.hidden.ows'), 'hidden');
        await fsWriteFile(path.join(dirPath, 'notes.txt'), 'other');
        await ensureDirectory(path.join(dirPath, 'nested'));
        const dirents = await fsListDirents(dirPath);
        expect(dirents).toEqual(
            expect.arrayContaining([
                { name: 'song.ows', isFile: true, isDirectory: false },
                { name: 'nested', isFile: false, isDirectory: true },
            ]),
        );
        expect(await fsListDirectories(dirPath)).toEqual(['nested']);
        expect(await fsListFilesWithMimetype(dirPath, 'appDocument')).toEqual([
            path.join(dirPath, 'song.ows'),
        ]);
        expect(await fsList(dirPath)).toHaveLength(4);
        expect(await fsListDirents('')).toEqual([]);
    });

    it('falls back to copy and unlink for a move across devices', async () => {
        const source = inWorkDir('video.mp4');
        const destination = inWorkDir('moved.mp4');
        await fsWriteFile(source, Buffer.from([0, 1, 255]));
        h.forceExdev = true;
        await fsMove(source, destination);
        expect(fs.existsSync(source)).toBe(false);
        expect(fs.readFileSync(destination)).toEqual(Buffer.from([0, 1, 255]));
    });

    it('removes a partial destination when cross-device copying fails', async () => {
        const source = inWorkDir('video.mp4');
        const destination = inWorkDir('moved.mp4');
        await fsWriteFile(source, 'complete');
        h.forceExdev = true;
        h.failCopy = true;
        await expect(fsMove(source, destination)).rejects.toThrow('disk full');
        expect(fs.readFileSync(source, 'utf8')).toBe('complete');
        expect(fs.existsSync(destination)).toBe(false);
    });

    it('copies to the next available name and reports an unnamed blob', async () => {
        const source = inWorkDir('song.ows');
        await fsWriteFile(source, 'song');
        expect(await fsCopyFilePathToPath(source, workDir)).toBe(
            `${source}.copy`,
        );
        expect(fs.readFileSync(`${source}.copy`, 'utf8')).toBe('song');
        expect(
            await fsCopyFilePathToPath(new Blob(['orphan']), workDir),
        ).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Copying File:undefined',
            expect.stringContaining('Cannot get file name'),
        );
        expect(h.hideProgressBar).toHaveBeenCalledTimes(2);
    });

    it('refuses an empty or relative folder rather than the working directory', async () => {
        const source = inWorkDir('dropped.ows');
        await fsWriteFile(source, 'dropped');
        for (const destination of ['', 'documents']) {
            expect(await fsCopyFilePathToPath(source, destination)).toBeNull();
            expect(
                fs.existsSync(path.resolve(destination, 'dropped.ows')),
            ).toBe(false);
        }
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Copying File:dropped.ows',
            expect.stringContaining('No folder to copy into'),
        );
    });

    it('recognizes file types and a data-URL MIME signature', () => {
        expect(getFileMetaData('SONG.OWS')?.appMimetype.mimetypeName).toBe(
            'appDocument',
        );
        expect(getFileMetaData('unknown.xyz')).toBeNull();
        expect(getMimetypeExtensions('pdf')).toContain('pdf');
        expect(isSupportedExt('slides.pptx', 'pptx')).toBe(true);
        expect(isSupportedMimetype('application/pdf', 'pdf')).toBe(true);
        expect(
            getDotExtensionFromBase64Data('data:image/png;base64,AAAA'),
        ).toBe('.png');
        expect(
            getDotExtensionFromBase64Data('data:other/unknown;base64,AAAA'),
        ).toBeNull();
    });

    it('checksums file content and routes picker and screen paths', async () => {
        const filePath = inWorkDir('song.ows');
        await fsWriteFile(filePath, 'song');
        expect(await getFileMD5(filePath)).toBe(
            createHash('md5').update('song').digest('hex'),
        );
        h.electronSendAsync
            .mockResolvedValueOnce([workDir])
            .mockResolvedValueOnce([filePath]);
        expect(await selectDirs()).toEqual([workDir]);
        expect(
            await selectFiles([{ name: 'Songs', extensions: ['ows'] }]),
        ).toEqual([filePath]);
        expect(h.electronSendAsync).toHaveBeenNthCalledWith(
            2,
            'main:app:select-files',
            { filters: [{ name: 'Songs', extensions: ['ows'] }] },
        );
        expect(toScreenFileURL(filePath)).toBe(pathToFileURL(filePath).href);
        expect(h.hideProgressBar).toHaveBeenCalledTimes(2);
    });

    it('says a missing folder in words instead of a raw ENOENT', async () => {
        const missingDir = inWorkDir('zz-missing-dir');

        const filePath = await createNewFileDetail(
            missingDir,
            'song',
            '{}',
            'appDocument',
        );

        expect(filePath).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Creating File',
            `Folder not found: ${missingDir}`,
        );
        expect(await fsCheckDirExist(missingDir)).toBe(false);

        const createdFilePath = await createNewFileDetail(
            workDir,
            'song',
            '{}',
            'appDocument',
        );
        expect(createdFilePath).not.toBeNull();
        expect(await fsReadFile(createdFilePath!)).toBe('{}');
    });

    it('creates directories and exposes native file streams and base64 bytes', async () => {
        const nestedDir = inWorkDir('one', 'two');
        await fsCreateDir(nestedDir);
        expect(await fsCheckDirExist(nestedDir)).toBe(true);

        const filePath = path.join(nestedDir, 'picture.bin');
        const writer = fsCreateWriteStream(filePath);
        const closed = new Promise<void>((resolve, reject) => {
            writer.once('error', reject);
            writer.once('close', resolve);
        });
        writer.end(Buffer.from([0, 1, 2, 255]));
        await closed;

        const chunks: Buffer[] = [];
        const reader = fsCreateReadStream(filePath);
        await new Promise<void>((resolve, reject) => {
            reader.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            reader.once('error', reject);
            reader.once('end', resolve);
        });
        expect(Buffer.concat(chunks)).toEqual(Buffer.from([0, 1, 2, 255]));
        expect(fsReadFileBase64Sync(filePath)).toBe('AAEC/w==');
        expect(getFileFullName(new File(['x'], 'report.txt'))).toBe(
            'report.txt',
        );
        expect(getFileFullName(filePath)).toBe('picture.bin');
    });

    it('uses the special-path IPC and reads blob URLs as data URLs', async () => {
        h.sendDataSync.mockImplementation((_channel, name) => `${name}-path`);
        expect(getDesktopPath()).toBe('desktop-path');
        expect(getDownloadPath()).toBe('downloads-path');
        expect(getTempPath()).toBe('temp-path');
        expect(getHomePath()).toBe('home-path');
        expect(h.sendDataSync).toHaveBeenCalledWith(
            'main:app:get-special-path',
            'home',
        );

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                blob: async () => new Blob(['hello'], { type: 'text/plain' }),
            }),
        );
        await expect(
            getFileBase64('https://files.test/song.txt'),
        ).resolves.toBe('data:text/plain;base64,aGVsbG8=');
    });

    it('propagates fetch and FileReader errors when making a data URL', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('network down')),
        );
        await expect(
            getFileBase64('https://files.test/song.txt'),
        ).rejects.toThrow('network down');

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ blob: async () => new Blob(['song']) }),
        );
        vi.stubGlobal(
            'FileReader',
            class {
                onerror: ((error: unknown) => void) | null = null;
                readAsDataURL() {
                    this.onerror?.(new Error('reader failed'));
                }
            },
        );
        await expect(
            getFileBase64('https://files.test/song.txt'),
        ).rejects.toThrow('Error reading blob as base64: Error: reader failed');
    });

    it('returns null for a checksum read error and a failed MIME directory listing', async () => {
        expect(await getFileChecksum(inWorkDir('missing.bin'), 'sha256')).toBe(
            null,
        );
        expect(h.handleError).toHaveBeenCalled();

        h.handleError.mockClear();
        expect(
            await fsListFilesWithMimetype(
                inWorkDir('missing-directory'),
                'appDocument',
            ),
        ).toBeNull();
        expect(h.handleError).toHaveBeenCalled();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Getting File List',
            'Error occurred during listing file',
        );
    });
});
