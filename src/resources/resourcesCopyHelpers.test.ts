import { mkdtempSync, rmSync } from 'node:fs';
import fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, cloneFileMock } = vi.hoisted(() => ({
    state: { parentDirPath: '' },
    cloneFileMock: vi.fn(),
}));

// The REAL disk, in a temporary folder: what is being tested is a tree copy,
// and a mocked file system would only prove the mock agrees with itself.
vi.mock('../server/fileHelpers', async () => {
    const nodeFs = await import('node:fs/promises');
    const nodePath = await import('node:path');
    async function checkIs(filePath: string, isFile: boolean) {
        try {
            const stat = await nodeFs.stat(filePath);
            return isFile ? stat.isFile() : stat.isDirectory();
        } catch (_error) {
            return false;
        }
    }
    return {
        fsCheckDirExist: (filePath: string) => checkIs(filePath, false),
        fsCheckFileExist: (filePath: string) => checkIs(filePath, true),
        fsCloneFile: cloneFileMock,
        fsCreateDir: (dirPath: string) => {
            return nodeFs.mkdir(dirPath, { recursive: true });
        },
        fsDeleteDir: (dirPath: string) => {
            return nodeFs.rm(dirPath, { recursive: true, force: true });
        },
        fsDeleteFile: (filePath: string) => {
            return nodeFs.rm(filePath, { force: true });
        },
        fsListDirents: async (dirPath: string) => {
            const direntList = await nodeFs.readdir(dirPath, {
                withFileTypes: true,
            });
            return direntList.map((dirent) => ({
                name: dirent.name,
                isFile: dirent.isFile(),
                isDirectory: dirent.isDirectory(),
            }));
        },
        fsMove: (oldPath: string, newPath: string) => {
            return nodeFs.rename(oldPath, newPath);
        },
        pathBasename: nodePath.basename,
        pathJoin: nodePath.join,
        pathResolve: nodePath.resolve,
        pathSeparator: nodePath.sep,
    };
});

// `tran` reads the locale out of the settings store, which otherwise walks all
// the way down to IPC. With nothing stored it short-circuits to English, which
// is what the message assertions below read.
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get defaultStorageDirPath() {
            return state.parentDirPath;
        },
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

// Reached through `tran`, and it touches `document` at module scope -- which a
// node-env file has none of. Only what `langHelpers` reads is stubbed.
vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        messageUtils: { sendDataSync: () => null, listenForData: () => {} },
    },
}));

vi.mock('./resourcesFolderHelpers', () => ({
    toDirPathCompareKey: (dirPath: string) => {
        return process.platform === 'linux' ? dirPath : dirPath.toLowerCase();
    },
}));

import {
    checkIsInResourcesDataDir,
    checkIsSameOrInsideDir,
    copyFilesIntoResourcesFolder,
    copyResourcesFolderToDataDir,
    genFreeFilePath,
    getResourcesFolderCopyRefusalKey,
    ResourcesCopyError,
    toResourcesFilesCopiedMessage,
} from './resourcesCopyHelpers';

let rootDirPath = '';

async function writeTree(files: Record<string, string>) {
    for (const [relativePath, content] of Object.entries(files)) {
        const filePath = path.join(rootDirPath, relativePath);
        await fsp.mkdir(path.dirname(filePath), { recursive: true });
        await fsp.writeFile(filePath, content);
    }
}

async function listTree(dirPath: string): Promise<string[]> {
    const found: string[] = [];
    for (const dirent of await fsp.readdir(dirPath, { withFileTypes: true })) {
        const childPath = path.join(dirPath, dirent.name);
        if (dirent.isDirectory()) {
            for (const childName of await listTree(childPath)) {
                found.push(`${dirent.name}/${childName}`);
            }
        } else {
            found.push(dirent.name);
        }
    }
    return found.sort();
}

describe('copyResourcesFolderToDataDir', () => {
    beforeEach(() => {
        rootDirPath = mkdtempSync(path.join(tmpdir(), 'owa-resources-copy-'));
        state.parentDirPath = path.join(rootDirPath, 'data');
        cloneFileMock.mockReset();
        cloneFileMock.mockImplementation((from: string, to: string) => {
            return fsp.copyFile(from, to);
        });
    });

    afterEach(() => {
        rmSync(rootDirPath, { recursive: true, force: true });
    });

    test('copies the whole tree under resources and leaves the source', async () => {
        await writeTree({
            'library/YouTube/GEN.0.json': '[]',
            'library/YouTube/deep/er/GEN.1.pdf': 'pdf',
        });
        const sourceDirPath = path.join(rootDirPath, 'library', 'YouTube');
        const result = await copyResourcesFolderToDataDir(sourceDirPath);
        expect(result).toEqual({
            destinationDirPath: path.join(
                state.parentDirPath,
                'resources',
                'YouTube',
            ),
            fileCount: 2,
            skippedCount: 0,
        });
        expect(await listTree(result.destinationDirPath)).toEqual([
            'GEN.0.json',
            'deep/er/GEN.1.pdf',
        ]);
        expect(
            await fsp.readFile(
                path.join(result.destinationDirPath, 'deep', 'er', 'GEN.1.pdf'),
                'utf8',
            ),
        ).toBe('pdf');
        // A copy, not a move.
        expect(await listTree(sourceDirPath)).toEqual([
            'GEN.0.json',
            'deep/er/GEN.1.pdf',
        ]);
        // No staging folder left beside it.
        expect(
            await fsp.readdir(path.join(state.parentDirPath, 'resources')),
        ).toEqual(['YouTube']);
    });

    test('takes the next free name instead of writing into a taken one', async () => {
        await writeTree({
            'library/YouTube/GEN.1.pdf': 'new',
            'data/resources/YouTube/GEN.1.pdf': 'old',
        });
        const result = await copyResourcesFolderToDataDir(
            path.join(rootDirPath, 'library', 'YouTube'),
        );
        expect(path.basename(result.destinationDirPath)).toBe('YouTube (1)');
        expect(
            await fsp.readFile(
                path.join(
                    state.parentDirPath,
                    'resources',
                    'YouTube',
                    'GEN.1.pdf',
                ),
                'utf8',
            ),
        ).toBe('old');
    });

    test('refuses a folder that holds the data directory', async () => {
        // `Desktop` beside a data dir at `Desktop\open-worship-data`: the copy
        // would be written into the tree it is reading.
        await writeTree({ 'GEN.1.pdf': 'pdf' });
        await expect(
            copyResourcesFolderToDataDir(rootDirPath),
        ).rejects.toMatchObject({
            messageKey: 'The data directory is inside this folder',
        });
        expect(cloneFileMock).not.toHaveBeenCalled();
        await expect(fsp.stat(state.parentDirPath)).rejects.toThrow();
    });

    test('refuses a folder that is already a copy', async () => {
        await writeTree({ 'data/resources/YouTube/GEN.1.pdf': 'pdf' });
        const error = await copyResourcesFolderToDataDir(
            path.join(state.parentDirPath, 'resources', 'YouTube'),
        ).catch((caught) => caught);
        expect(error).toBeInstanceOf(ResourcesCopyError);
        expect(error.messageKey).toBe(
            'Folder is already in the data directory',
        );
    });

    test('says a folder that is gone is not found', async () => {
        await expect(
            copyResourcesFolderToDataDir(path.join(rootDirPath, 'gone')),
        ).rejects.toMatchObject({ messageKey: 'Folder not found' });
    });

    test('a copy that fails half way leaves nothing that looks finished', async () => {
        await writeTree({
            'library/YouTube/a.pdf': 'a',
            'library/YouTube/b.pdf': 'b',
        });
        let callCount = 0;
        cloneFileMock.mockImplementation((from: string, to: string) => {
            callCount++;
            if (callCount === 2) {
                return Promise.reject(
                    Object.assign(new Error('disk full'), { code: 'ENOSPC' }),
                );
            }
            return fsp.copyFile(from, to);
        });
        await expect(
            copyResourcesFolderToDataDir(
                path.join(rootDirPath, 'library', 'YouTube'),
            ),
        ).rejects.toThrow('disk full');
        expect(
            await fsp.readdir(path.join(state.parentDirPath, 'resources')),
        ).toEqual([]);
    });

    test('skips a link back up the tree instead of walking it for ever', async () => {
        await writeTree({ 'library/YouTube/GEN.1.pdf': 'pdf' });
        const sourceDirPath = path.join(rootDirPath, 'library', 'YouTube');
        // A junction needs no elevation on Windows; elsewhere the type is
        // ignored and it is a plain directory link.
        await fsp.symlink(
            sourceDirPath,
            path.join(sourceDirPath, 'loop'),
            'junction',
        );
        const result = await copyResourcesFolderToDataDir(sourceDirPath);
        expect(result.fileCount).toBe(1);
        expect(result.skippedCount).toBe(1);
        expect(await listTree(result.destinationDirPath)).toEqual([
            'GEN.1.pdf',
        ]);
    });
});

describe('checkIsSameOrInsideDir', () => {
    const base = path.resolve('/owa-root');

    test('a folder is inside itself and its parents, not its siblings', () => {
        expect(checkIsSameOrInsideDir(base, base)).toBe(true);
        expect(checkIsSameOrInsideDir(base, path.join(base, 'a', 'b'))).toBe(
            true,
        );
        expect(checkIsSameOrInsideDir(path.join(base, 'a', 'b'), base)).toBe(
            false,
        );
    });

    test('a shared name prefix is not containment', () => {
        expect(
            checkIsSameOrInsideDir(
                path.join(base, 'Song'),
                path.join(base, 'Songs'),
            ),
        ).toBe(false);
    });

    test('a drive or file system root holds everything on it', () => {
        const root = path.parse(base).root;
        expect(checkIsSameOrInsideDir(root, base)).toBe(true);
    });
});

describe('getResourcesFolderCopyRefusalKey', () => {
    test('says why before anything is asked or read', () => {
        state.parentDirPath = path.resolve('/owa-root/Desktop/data');
        expect(
            getResourcesFolderCopyRefusalKey(path.resolve('/owa-root/Desktop')),
        ).toBe('The data directory is inside this folder');
        expect(
            getResourcesFolderCopyRefusalKey(
                path.join(state.parentDirPath, 'resources', 'YouTube'),
            ),
        ).toBe('Folder is already in the data directory');
        expect(
            getResourcesFolderCopyRefusalKey(
                path.resolve('/owa-root/library/YouTube'),
            ),
        ).toBeNull();
    });
});

describe('checkIsInResourcesDataDir', () => {
    test('is true only under <parent dir>/resources', () => {
        state.parentDirPath = path.resolve('/owa-root/data');
        expect(
            checkIsInResourcesDataDir(
                path.join(state.parentDirPath, 'resources', 'YouTube'),
            ),
        ).toBe(true);
        expect(
            checkIsInResourcesDataDir(path.join(state.parentDirPath, 'images')),
        ).toBe(false);
    });
});

describe('genFreeFilePath', () => {
    beforeEach(() => {
        rootDirPath = mkdtempSync(path.join(tmpdir(), 'owa-resources-free-'));
    });

    afterEach(() => {
        rmSync(rootDirPath, { recursive: true, force: true });
    });

    test('keeps the extension, so the copy still opens in the same app', async () => {
        await writeTree({ 'GEN.1.pdf': 'a', 'GEN.1 (1).pdf': 'b' });
        expect(await genFreeFilePath(rootDirPath, 'GEN.1.pdf')).toBe(
            path.join(rootDirPath, 'GEN.1 (2).pdf'),
        );
    });

    test('a free name is taken as it is', async () => {
        expect(await genFreeFilePath(rootDirPath, 'GEN.1.pdf')).toBe(
            path.join(rootDirPath, 'GEN.1.pdf'),
        );
    });

    test('a name that is all extension keeps the index on the end', async () => {
        await writeTree({ '.notes': 'a' });
        expect(await genFreeFilePath(rootDirPath, '.notes')).toBe(
            path.join(rootDirPath, '.notes (1)'),
        );
    });

    test('a FOLDER of that name is taken too', async () => {
        await writeTree({ 'GEN.1.pdf/inside.txt': 'a' });
        expect(await genFreeFilePath(rootDirPath, 'GEN.1.pdf')).toBe(
            path.join(rootDirPath, 'GEN.1 (1).pdf'),
        );
    });
});

describe('copyFilesIntoResourcesFolder', () => {
    beforeEach(() => {
        rootDirPath = mkdtempSync(path.join(tmpdir(), 'owa-resources-files-'));
        cloneFileMock.mockReset();
        cloneFileMock.mockImplementation((from: string, to: string) => {
            return fsp.copyFile(from, to);
        });
    });

    afterEach(() => {
        rmSync(rootDirPath, { recursive: true, force: true });
    });

    test('copies the picked files in and leaves the sources alone', async () => {
        await writeTree({
            'shelf/keep.txt': 'keep',
            'downloads/GEN.4.pdf': 'four',
            'downloads/notes.docx': 'notes',
        });
        const shelfDirPath = path.join(rootDirPath, 'shelf');
        const result = await copyFilesIntoResourcesFolder(shelfDirPath, [
            path.join(rootDirPath, 'downloads', 'GEN.4.pdf'),
            path.join(rootDirPath, 'downloads', 'notes.docx'),
        ]);
        expect(result).toEqual({
            copiedFilePaths: [
                path.join(shelfDirPath, 'GEN.4.pdf'),
                path.join(shelfDirPath, 'notes.docx'),
            ],
            skippedCount: 0,
            error: null,
        });
        expect(await listTree(shelfDirPath)).toEqual([
            'GEN.4.pdf',
            'keep.txt',
            'notes.docx',
        ]);
        // A copy, not a move.
        expect(await listTree(path.join(rootDirPath, 'downloads'))).toEqual([
            'GEN.4.pdf',
            'notes.docx',
        ]);
    });

    test('never overwrites: a taken name gets the next free one', async () => {
        await writeTree({
            'shelf/GEN.4.pdf': 'old',
            'downloads/GEN.4.pdf': 'new',
        });
        const shelfDirPath = path.join(rootDirPath, 'shelf');
        const result = await copyFilesIntoResourcesFolder(shelfDirPath, [
            path.join(rootDirPath, 'downloads', 'GEN.4.pdf'),
        ]);
        expect(result.copiedFilePaths).toEqual([
            path.join(shelfDirPath, 'GEN.4 (1).pdf'),
        ]);
        expect(
            await fsp.readFile(path.join(shelfDirPath, 'GEN.4.pdf'), 'utf8'),
        ).toBe('old');
        expect(
            await fsp.readFile(
                path.join(shelfDirPath, 'GEN.4 (1).pdf'),
                'utf8',
            ),
        ).toBe('new');
    });
});

describe('copyFilesIntoResourcesFolder refusals', () => {
    beforeEach(() => {
        rootDirPath = mkdtempSync(path.join(tmpdir(), 'owa-resources-skip-'));
        cloneFileMock.mockReset();
        cloneFileMock.mockImplementation((from: string, to: string) => {
            return fsp.copyFile(from, to);
        });
    });

    afterEach(() => {
        rmSync(rootDirPath, { recursive: true, force: true });
    });

    test('a file already sitting here is passed over, not duplicated', async () => {
        await writeTree({ 'shelf/GEN.4.pdf': 'four', 'shelf/deep/a.txt': 'a' });
        const shelfDirPath = path.join(rootDirPath, 'shelf');
        const result = await copyFilesIntoResourcesFolder(shelfDirPath, [
            path.join(shelfDirPath, 'GEN.4.pdf'),
            // One level down is a DIFFERENT file, so that one is copied.
            path.join(shelfDirPath, 'deep', 'a.txt'),
        ]);
        expect(result.skippedCount).toBe(1);
        expect(result.copiedFilePaths).toEqual([
            path.join(shelfDirPath, 'a.txt'),
        ]);
        expect(await listTree(shelfDirPath)).toEqual([
            'GEN.4.pdf',
            'a.txt',
            'deep/a.txt',
        ]);
    });

    test('a picked path that is gone, or is a folder, is passed over', async () => {
        await writeTree({
            'shelf/keep.txt': 'keep',
            'downloads/deep/a.txt': 'a',
        });
        const shelfDirPath = path.join(rootDirPath, 'shelf');
        const result = await copyFilesIntoResourcesFolder(shelfDirPath, [
            path.join(rootDirPath, 'downloads', 'gone.pdf'),
            path.join(rootDirPath, 'downloads', 'deep'),
        ]);
        expect(result).toEqual({
            copiedFilePaths: [],
            skippedCount: 2,
            error: null,
        });
        expect(await listTree(shelfDirPath)).toEqual(['keep.txt']);
    });

    test('refuses a folder that is gone before anything is written', async () => {
        await writeTree({ 'downloads/GEN.4.pdf': 'four' });
        const error = await copyFilesIntoResourcesFolder(
            path.join(rootDirPath, 'gone'),
            [path.join(rootDirPath, 'downloads', 'GEN.4.pdf')],
        ).catch((caught) => caught);
        expect(error).toBeInstanceOf(ResourcesCopyError);
        expect(error.messageKey).toBe('Folder not found');
        expect(cloneFileMock).not.toHaveBeenCalled();
    });

    test('a failure keeps what landed and leaves no part file behind', async () => {
        await writeTree({
            'shelf/keep.txt': 'keep',
            'downloads/a.pdf': 'a',
            'downloads/b.pdf': 'b',
            'downloads/c.pdf': 'c',
        });
        const shelfDirPath = path.join(rootDirPath, 'shelf');
        cloneFileMock.mockImplementation(async (from: string, to: string) => {
            if (path.basename(from) === 'b.pdf') {
                // What a full disk leaves: the file is created, then the write
                // fails part way through it.
                await fsp.writeFile(to, 'par');
                throw Object.assign(new Error('disk full'), {
                    code: 'ENOSPC',
                });
            }
            await fsp.copyFile(from, to);
        });
        const result = await copyFilesIntoResourcesFolder(shelfDirPath, [
            path.join(rootDirPath, 'downloads', 'a.pdf'),
            path.join(rootDirPath, 'downloads', 'b.pdf'),
            path.join(rootDirPath, 'downloads', 'c.pdf'),
        ]);
        expect(result.copiedFilePaths).toEqual([
            path.join(shelfDirPath, 'a.pdf'),
        ]);
        expect((result.error as Error).message).toBe('disk full');
        // The part file swept up, and the one after it never attempted.
        expect(await listTree(shelfDirPath)).toEqual(['a.pdf', 'keep.txt']);
    });
});

describe('toResourcesFilesCopiedMessage', () => {
    const shown = { isNoneListed: false, isOthersShowing: false };

    function genResult(overrides: any = {}) {
        return {
            copiedFilePaths: [],
            skippedCount: 0,
            error: null,
            ...overrides,
        };
    }

    test('counts what landed, in the singular and the plural', () => {
        expect(
            toResourcesFilesCopiedMessage(
                genResult({ copiedFilePaths: ['/a/GEN.4.pdf'] }),
                shown,
            ),
        ).toBe('1 file copied');
        expect(
            toResourcesFilesCopiedMessage(
                genResult({ copiedFilePaths: ['/a/1.pdf', '/a/2.pdf'] }),
                shown,
            ),
        ).toBe('2 files copied');
    });

    test('says how many were passed over, beside what landed', () => {
        expect(
            toResourcesFilesCopiedMessage(
                genResult({
                    copiedFilePaths: ['/a/GEN.4.pdf'],
                    skippedCount: 2,
                }),
                shown,
            ),
        ).toBe('1 file copied, 2 files were not copied');
        expect(
            toResourcesFilesCopiedMessage(
                genResult({ skippedCount: 1 }),
                shown,
            ),
        ).toBe('1 file was not copied');
    });

    test('files that landed and are not drawn say so, rather than nothing', () => {
        expect(
            toResourcesFilesCopiedMessage(
                genResult({ copiedFilePaths: ['/a/notes.docx'] }),
                { isNoneListed: true, isOthersShowing: false },
            ),
        ).toBe('1 file copied. Tick Others to see them');
        // With Others already ticked there is nothing left to tick.
        expect(
            toResourcesFilesCopiedMessage(
                genResult({ copiedFilePaths: ['/a/notes.docx'] }),
                { isNoneListed: true, isOthersShowing: true },
            ),
        ).toBe('1 file copied. They are not shown in this list');
    });

    test('an error is said WITH what already landed, and takes the tail', () => {
        expect(
            toResourcesFilesCopiedMessage(
                genResult({
                    copiedFilePaths: ['/a/GEN.4.pdf'],
                    error: new Error('disk full'),
                }),
                { isNoneListed: true, isOthersShowing: false },
            ),
        ).toBe('1 file copied. Cannot copy file: disk full');
    });
});
