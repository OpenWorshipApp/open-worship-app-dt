// @vitest-environment jsdom

import { Blob as NodeBlob } from 'node:buffer';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The corners of `fileHelpers` the operations suite does not reach: the pure
// path rules, the data-folder link finder's skips, the error paths of
// creating and checking files, moving a whole folder across drives, cloning
// a dropped `File` through a write stream (backpressure and failures), and a
// screen window reading through its host. `appProvider` is this file's own:
// node's fs and path, plus a few switches in the hoisted bundle.
const h = vi.hoisted(() => {
    return {
        isScreen: false,
        forceExdev: false,
        statErrorPath: null as string | null,
        writeStream: null as unknown,
        handleError: vi.fn(),
        showSimpleToast: vi.fn(),
        showProgressBar: vi.fn(),
        hideProgressBar: vi.fn(),
        electronSendAsync: vi.fn(),
        writeFileFromBase64Sync: vi.fn(),
    };
});

vi.mock('./appProvider', async () => {
    const fileSystem = await import('node:fs');
    const pathModule = await import('node:path');
    return {
        default: {
            get screenUtils() {
                return h.isScreen ? {} : undefined;
            },
            isPageScreen: false,
            systemUtils: { isDev: false, isWindows: false },
            sessionData: { defaultStorageDirPath: null },
            pathUtils: pathModule,
            browserUtils: {
                pathToFileURL: (filePath: string) => {
                    return `file:///host/${encodeURIComponent(filePath)}`;
                },
            },
            fileUtils: {
                ...fileSystem,
                stat: (filePath: string, callback: any) => {
                    if (filePath === h.statErrorPath) {
                        callback(
                            Object.assign(new Error('permission denied'), {
                                code: 'EACCES',
                            }),
                        );
                        return;
                    }
                    fileSystem.stat(filePath, callback);
                },
                rename: (from: string, to: string, callback: any) => {
                    if (h.forceExdev) {
                        h.forceExdev = false;
                        callback(
                            Object.assign(new Error('cross-device link'), {
                                code: 'EXDEV',
                            }),
                        );
                        return;
                    }
                    fileSystem.rename(from, to, callback);
                },
                rmdir: (dirPath: string, _options: unknown, callback: any) => {
                    fileSystem.rm(dirPath, { recursive: true }, callback);
                },
                createWriteStream: (filePath: string) => {
                    return (
                        h.writeStream ?? fileSystem.createWriteStream(filePath)
                    );
                },
                writeFileFromBase64Sync: (...args: unknown[]) => {
                    return h.writeFileFromBase64Sync(...args);
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
                    genNextFilePath: async () => {
                        return fileSystem.existsSync(fullPath)
                            ? `${fullPath}.copy`
                            : fullPath;
                    },
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
    checkIsForeignAbsolutePath,
    createNewFileDetail,
    findDataDirLinks,
    fsCheckDirExist,
    fsCheckFileExist,
    fsCloneFile,
    fsCopyFilePathToPath,
    fsDeleteDir,
    fsList,
    fsListFilesWithMimetype,
    fsMove,
    fsReadFile,
    fsReadFileBytes,
    fsRenameFile,
    getFileName,
    pathDirname,
    rebaseDataDirPath,
    writeFileFromBase64Sync,
} from './fileHelpers';

/** A node write stream's surface, with the answers each test wants. */
class FakeWriteStream extends EventEmitter {
    chunks: string[] = [];
    writeAnswers: boolean[] = [];
    isEnded = false;
    destroyCount = 0;
    write(chunk: Uint8Array) {
        this.chunks.push(new TextDecoder().decode(chunk));
        return this.writeAnswers.shift() ?? true;
    }
    end() {
        this.isEnded = true;
        queueMicrotask(() => {
            this.emit('close');
        });
    }
    destroy() {
        this.destroyCount++;
    }
}

/** jsdom's `File` has no `stream()`; the renderer's does. */
function fileWithStream(name: string, stream: () => ReadableStream) {
    const file = new File(['ignored'], name);
    Object.defineProperty(file, 'stream', { value: stream });
    return file;
}

function streamOf(chunks: string[], error?: Error) {
    const encoder = new TextEncoder();
    return () => {
        return new ReadableStream<Uint8Array>({
            pull(controller) {
                const chunk = chunks.shift();
                if (chunk !== undefined) {
                    controller.enqueue(encoder.encode(chunk));
                } else if (error !== undefined) {
                    controller.error(error);
                } else {
                    controller.close();
                }
            },
        });
    };
}

async function flush() {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
}

let tempDir = '';

beforeEach(() => {
    h.isScreen = false;
    h.forceExdev = false;
    h.statErrorPath = null;
    h.writeStream = null;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-'));
});

afterEach(() => {
    vi.unstubAllGlobals();
    if (
        tempDir !== '' &&
        path.basename(tempDir).startsWith('owa-') &&
        path.dirname(tempDir) === path.resolve(os.tmpdir())
    ) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = '';
});

describe('path rules', () => {
    test('pathDirname and getFileName take the folder and the bare name', () => {
        expect(pathDirname('/data/documents/song.lyric')).toBe(
            '/data/documents',
        );
        expect(getFileName('song.lyric')).toBe('song');
        expect(getFileName('service.2026.ows')).toBe('service.2026');
    });

    test('rebaseDataDirPath has nothing to rebase for the folder itself', () => {
        expect(rebaseDataDirPath('/old/data/', '/old/data', '/new', '/')).toBe(
            null,
        );
        expect(
            rebaseDataDirPath(
                '/old/data/images/a.png',
                '/old/data',
                '/new',
                '/',
            ),
        ).toBe('/new/images/a.png');
    });

    test('a path from the other operating system family is foreign', () => {
        // Read on Windows: a Mac or Linux path names nothing here.
        expect(checkIsForeignAbsolutePath('/Users/me/Songs', true)).toBe(true);
        expect(checkIsForeignAbsolutePath('//server/share', true)).toBe(false);
        expect(checkIsForeignAbsolutePath('C:\\Songs', true)).toBe(false);
        // Read on a Mac: a drive path names nothing here.
        expect(checkIsForeignAbsolutePath('D:\\Songs', false)).toBe(true);
        expect(checkIsForeignAbsolutePath('/Users/me/Songs', false)).toBe(
            false,
        );
    });
});

describe('findDataDirLinks', () => {
    test('finds nothing when the data folder has no folders to look for', () => {
        expect(findDataDirLinks('"/old/data/images/a.png"', [])).toEqual([]);
    });

    test('skips a file URL written with backslashes, not one with slashes', () => {
        expect(
            findDataDirLinks('"file:///C:\\images\\a.png"', ['images']),
        ).toEqual([]);
        const [link] = findDataDirLinks('"file:///C:/images/a.png"', [
            'images',
        ]);
        expect(link.isUrl).toBe(true);
        expect(link.segments).toEqual(['images', 'a.png']);
    });

    test('skips a file URL whose escapes do not decode, and decodes one that does', () => {
        expect(
            findDataDirLinks('"file:///old/images/caf%E9.png"', ['images']),
        ).toEqual([]);
        const [link] = findDataDirLinks('"file:///old/images/my%20song.png"', [
            'images',
        ]);
        expect(link.segments).toEqual(['images', 'my song.png']);
        expect(link.linkPath).toBe('/old/images/my song.png');
    });
});

describe('createNewFileDetail', () => {
    test('refuses a kind of file that has no extension', async () => {
        await expect(
            createNewFileDetail(tempDir, 'Song', '', 'other'),
        ).rejects.toThrow('No extensions found for mimetype: other');
    });

    test('says why a name another computer would refuse is refused', async () => {
        expect(
            await createNewFileDetail(tempDir, 'Service 10:30', '', 'lyric'),
        ).toBeNull();
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Invalid file name',
            'A name cannot contain these characters, which some computers ' +
                'refuse: \\ / : * ? " < > |',
        );
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    test('reports a folder it is not allowed to look into', async () => {
        h.statErrorPath = tempDir;
        expect(await createNewFileDetail(tempDir, 'Song', '', 'lyric')).toBe(
            null,
        );
        expect(h.handleError).toHaveBeenCalledOnce();
        expect(h.handleError.mock.calls[0][0].code).toBe('EACCES');
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Creating File',
            'Error during checking file exist',
        );
    });
});

describe('checking and listing', () => {
    test('an empty path exists as nothing and lists nothing', async () => {
        expect(await fsCheckFileExist('')).toBe(false);
        expect(await fsCheckDirExist('')).toBe(false);
        expect(await fsList('')).toEqual([]);
        expect(await fsListFilesWithMimetype('', 'lyric')).toEqual([]);
    });

    test('a check that is refused is reported and thrown with its cause', async () => {
        const filePath = path.join(tempDir, 'song.lyric');
        h.statErrorPath = filePath;
        const checking = fsCheckFileExist(filePath);
        await expect(checking).rejects.toThrow(
            'Error during checking file exist',
        );
        const error = await checking.catch((reason) => reason);
        expect(error.cause.code).toBe('EACCES');
        expect(h.handleError).toHaveBeenCalledWith(error.cause);
    });
});

describe('moving and deleting', () => {
    test('fsRenameFile renames a file inside its folder', async () => {
        fs.writeFileSync(path.join(tempDir, 'old.lyric'), 'Amazing Grace');
        await fsRenameFile(tempDir, 'old.lyric', 'new.lyric');
        expect(fs.existsSync(path.join(tempDir, 'old.lyric'))).toBe(false);
        expect(fs.readFileSync(path.join(tempDir, 'new.lyric'), 'utf8')).toBe(
            'Amazing Grace',
        );
    });

    test('fsMove passes on a failure that is not a cross-drive move', async () => {
        await expect(
            fsMove(path.join(tempDir, 'missing'), path.join(tempDir, 'x')),
        ).rejects.toMatchObject({ code: 'ENOENT' });
    });

    test('a folder moved across drives is copied entry by entry, then removed', async () => {
        const from = path.join(tempDir, 'from');
        const to = path.join(tempDir, 'to');
        fs.mkdirSync(path.join(from, 'sub'), { recursive: true });
        fs.writeFileSync(path.join(from, 'a.txt'), 'A');
        fs.writeFileSync(path.join(from, 'sub', 'b.txt'), 'B');
        h.forceExdev = true;
        await fsMove(from, to);

        expect(fs.existsSync(from)).toBe(false);
        expect(fs.readFileSync(path.join(to, 'a.txt'), 'utf8')).toBe('A');
        expect(fs.readFileSync(path.join(to, 'sub', 'b.txt'), 'utf8')).toBe(
            'B',
        );
    });

    test('fsDeleteDir removes a folder and what is in it', async () => {
        const dirPath = path.join(tempDir, 'old');
        fs.mkdirSync(dirPath);
        fs.writeFileSync(path.join(dirPath, 'a.txt'), 'A');
        await fsDeleteDir(dirPath);
        expect(fs.existsSync(dirPath)).toBe(false);
    });
});

describe('fsCloneFile with a dropped File', () => {
    test('writes every chunk, ends the stream and settles on close', async () => {
        const writeStream = new FakeWriteStream();
        h.writeStream = writeStream;
        const file = fileWithStream('a.txt', streamOf(['Amazing ', 'Grace']));
        await fsCloneFile(file, '/dest/a.txt');
        expect(writeStream.chunks).toEqual(['Amazing ', 'Grace']);
        expect(writeStream.isEnded).toBe(true);
        expect(writeStream.destroyCount).toBe(0);
    });

    test('waits for the disk to drain before the next chunk', async () => {
        const writeStream = new FakeWriteStream();
        writeStream.writeAnswers = [false];
        h.writeStream = writeStream;
        const file = fileWithStream('a.txt', streamOf(['one', 'two']));
        let isDone = false;
        const cloning = fsCloneFile(file, '/dest/a.txt').then(() => {
            isDone = true;
        });
        await flush();
        expect(writeStream.chunks).toEqual(['one']);
        expect(isDone).toBe(false);

        writeStream.emit('drain');
        await cloning;
        expect(writeStream.chunks).toEqual(['one', 'two']);
        expect(isDone).toBe(true);
    });

    test('a disk error rejects once and closes the stream', async () => {
        const writeStream = new FakeWriteStream();
        writeStream.writeAnswers = [false];
        h.writeStream = writeStream;
        const file = fileWithStream('a.txt', streamOf(['one', 'two']));
        const cloning = fsCloneFile(file, '/dest/a.txt');
        await flush();
        const error = new Error('disk full');
        writeStream.emit('error', error);
        await expect(cloning).rejects.toBe(error);
        expect(writeStream.destroyCount).toBe(1);

        // Already settled: a second error and the close change nothing.
        writeStream.emit('error', new Error('again'));
        writeStream.emit('close');
        expect(writeStream.destroyCount).toBe(1);
    });

    test('a file that fails to read aborts the write and rejects', async () => {
        const writeStream = new FakeWriteStream();
        h.writeStream = writeStream;
        const error = new Error('file was removed');
        const file = fileWithStream('a.txt', streamOf(['one'], error));
        await expect(fsCloneFile(file, '/dest/a.txt')).rejects.toBe(error);
        expect(writeStream.chunks).toEqual(['one']);
        expect(writeStream.isEnded).toBe(false);
        // Once by the stream's abort, once by the failure.
        expect(writeStream.destroyCount).toBe(2);
    });

    test('fsCopyFilePathToPath copies a dropped File under its own name', async () => {
        const file = fileWithStream('Amazing Grace.lyric', () => {
            return new NodeBlob(['# Amazing Grace']).stream() as any;
        });
        const copiedPath = await fsCopyFilePathToPath(file, tempDir);
        expect(copiedPath).toBe(path.join(tempDir, 'Amazing Grace.lyric'));
        expect(fs.readFileSync(copiedPath!, 'utf8')).toBe('# Amazing Grace');
        expect(h.showProgressBar).toHaveBeenCalledWith(
            'Copying File:Amazing Grace.lyric',
        );
        expect(h.hideProgressBar).toHaveBeenCalledWith(
            'Copying File:Amazing Grace.lyric',
        );
    });
});

describe('a screen window reads through its host', () => {
    test('fsReadFile fetches the text of the file URL', async () => {
        h.isScreen = true;
        const fetchMock = vi.fn(async () => {
            return { ok: true, text: async () => 'slide text' };
        });
        vi.stubGlobal('fetch', fetchMock);
        expect(await fsReadFile('/data/a.txt')).toBe('slide text');
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            `file:///host/${encodeURIComponent('/data/a.txt')}`,
        );
    });

    test('fsReadFile says so when the host has no such file', async () => {
        h.isScreen = true;
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ ok: false })),
        );
        await expect(fsReadFile('/data/a.txt')).rejects.toThrow(
            'Presentation resource is unavailable',
        );
    });

    test('fsReadFileBytes fetches the bytes of the file URL', async () => {
        h.isScreen = true;
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
            })),
        );
        expect(await fsReadFileBytes('/data/a.png')).toEqual(
            new Uint8Array([1, 2, 3]),
        );
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ ok: false })),
        );
        await expect(fsReadFileBytes('/data/a.png')).rejects.toThrow(
            'Presentation resource is unavailable',
        );
    });
});

test('writeFileFromBase64Sync hands the data to the provider', () => {
    h.writeFileFromBase64Sync.mockReturnValue(undefined);
    writeFileFromBase64Sync('/data/a.png', 'iVBORw0KGgo=');
    expect(h.writeFileFromBase64Sync).toHaveBeenCalledExactlyOnceWith(
        '/data/a.png',
        'iVBORw0KGgo=',
    );
});
