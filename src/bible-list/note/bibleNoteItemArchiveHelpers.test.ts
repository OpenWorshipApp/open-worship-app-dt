// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    files: new Map<string, string>(),
    archives: new Map<string, Map<string, string>>(),
    deleted: [] as string[],
    selected: [] as string[],
    password: '' as string | null,
    tarCreate: vi.fn(),
    protect: vi.fn(),
    copy: vi.fn(),
    toast: vi.fn(),
    explorer: vi.fn(),
    error: vi.fn(),
}));

const join = (...parts: string[]) => parts.join('/').replace(/\/+/g, '/');

vi.mock('../../server/appProvider', () => ({
    default: {
        appUtils: {
            base64Encode: (text: string) =>
                Buffer.from(text).toString('base64'),
        },
    },
}));
vi.mock('../../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
    pathBasename: (path: string) => path.split('/').at(-1) ?? '',
    getTempPath: () => '/tmp',
    getDownloadPath: () => '/downloads',
    ensureDirectory: async () => {},
    fsCheckFileExist: async (path: string) => h.files.has(path),
    fsCreateFile: async (path: string, content: string) => {
        h.files.set(path, content);
        return path;
    },
    fsCloneFile: async (source: string, target: string) => {
        h.files.set(target, h.files.get(source)!);
    },
    fsReadFile: async (path: string) => h.files.get(path),
    fsDeleteDir: async (dir: string) => {
        h.deleted.push(dir);
        for (const path of h.files.keys()) {
            if (path.startsWith(`${dir}/`)) h.files.delete(path);
        }
    },
    fsCopyFilePathToPath: h.copy,
    selectFiles: async () => h.selected,
}));
vi.mock('../../server/appHelpers', () => ({
    tarCreate: h.tarCreate,
    tarExtract: async (archivePath: string, extractDir: string) => {
        for (const [name, content] of h.archives.get(archivePath) ?? []) {
            h.files.set(`${extractDir}/${name}`, content);
        }
    },
    showFileOrDirExplorer: h.explorer,
}));
vi.mock('../../helper/archivePasswordHelpers', () => ({
    askForNewArchivePassword: async () => h.password,
    openArchiveForReading: async (path: string) => ({ filePath: path }),
    protectArchiveFile: h.protect,
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: h.error }));
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { tmpFilesDir: '/tmp/files' },
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./NoteItem', () => ({
    default: { fromJson: (json: unknown) => json },
}));

import {
    createBibleNoteItemArchive,
    exportBibleNoteItem,
    importBibleNoteItemArchive,
    selectAndImportBibleNoteItemArchive,
    toBibleNoteItemArchiveFileName,
    toBibleNoteItemTmpFileName,
} from './bibleNoteItemArchiveHelpers';

beforeEach(() => {
    h.files.clear();
    h.archives.clear();
    h.deleted.length = 0;
    h.selected = [];
    h.password = '';
    h.tarCreate
        .mockReset()
        .mockImplementation(async (stagingDir: string, archivePath: string) => {
            const entries = new Map<string, string>();
            for (const [path, content] of h.files) {
                if (path.startsWith(`${stagingDir}/`)) {
                    entries.set(path.slice(stagingDir.length + 1), content);
                }
            }
            h.archives.set(archivePath, entries);
        });
    h.protect
        .mockReset()
        .mockImplementation(async (plain: string, output: string) => {
            h.archives.set(output, h.archives.get(plain)!);
            return output;
        });
    h.copy
        .mockReset()
        .mockImplementation(
            async (source: string, dir: string, name: string) => {
                const target = join(dir, name);
                h.files.set(target, h.files.get(source)!);
                return target;
            },
        );
    h.toast.mockClear();
    h.explorer.mockClear();
    h.error.mockClear();
});

function item(content: string) {
    const json = { title: 'Prayer: morning', metadata: { id: 3 }, content };
    return { ...json, toJson: () => json } as any;
}

function note() {
    return {
        maxItemId: 8,
        fileSource: { name: 'Sunday.own' },
        addAndSaveNoteItem: vi.fn(async () => true),
    } as any;
}

test('portable names keep the archive kind and a traceable asset extension', () => {
    expect(toBibleNoteItemArchiveFileName(' Prayer: morning ')).toBe(
        'Prayer_ morning.owabn.tar.gz',
    );
    expect(toBibleNoteItemArchiveFileName('***')).toBe(
        'BibleNoteItem.owabn.tar.gz',
    );
    expect(toBibleNoteItemArchiveFileName('Prayer', 'secret')).toBe(
        'Prayer.owabn.enc',
    );
    expect(
        toBibleNoteItemTmpFileName('Sunday', 9, '/media/photo.png', 123),
    ).toMatch(/^bn-[A-Za-z0-9+_=]+\.png$/);
});

test('an exported item and its embedded image import with a new id and local path', async () => {
    const content = JSON.stringify({
        root: { children: [{ src: '/media/photo.png' }] },
    });
    h.files.set('/media/photo.png', 'image bytes');
    const archivePath = await createBibleNoteItemArchive(item(content));
    expect(archivePath).toBe('/downloads/Prayer_ morning.owabn.tar.gz');
    const entries = h.archives.get(archivePath)!;
    expect(JSON.parse(entries.get('manifest.json')!)).toMatchObject({
        version: 1,
        noteItem: 'note-item.json',
        files: [
            {
                originalPath: '/media/photo.png',
                archivePath: 'files/001-photo.png',
            },
        ],
    });
    expect(entries.get('files/001-photo.png')).toBe('image bytes');
    expect(h.deleted).toHaveLength(1);

    const targetNote = note();
    const imported = await importBibleNoteItemArchive(targetNote, archivePath);
    expect(imported?.metadata.id).toBe(9);
    expect(targetNote.addAndSaveNoteItem).toHaveBeenCalledWith(imported);
    const importedImage = JSON.parse(imported!.content).root.children[0].src;
    expect(importedImage).toMatch(/^\/tmp\/files\/bn-.*\.png$/);
    expect(h.files.get(importedImage)).toBe('image bytes');
    expect(h.deleted).toHaveLength(2);
});

test('password export packs only the plain staging copy and cleans it up', async () => {
    h.password = 'secret';
    const path = await exportBibleNoteItem(item('{}'));
    expect(path).toBe('/downloads/Prayer_ morning.owabn.enc');
    expect(h.tarCreate.mock.calls[0][1]).toMatch(/\/plain-archive\.tmp$/);
    expect(h.protect).toHaveBeenCalledWith(
        h.tarCreate.mock.calls[0][1],
        path,
        'secret',
    );
    expect(h.explorer).toHaveBeenCalledWith(path);
    expect(h.deleted).toHaveLength(1);
    expect(h.archives.get(path!)?.has('plain-archive.tmp')).toBe(false);
    h.password = null;
    expect(await exportBibleNoteItem(item('{}'))).toBeNull();
    expect(h.tarCreate).toHaveBeenCalledTimes(1);
});

test('an archive cannot import a missing file or an escaping embedded path', async () => {
    const archive = '/downloads/bad.owabn.tar.gz';
    h.archives.set(
        archive,
        new Map([
            [
                'manifest.json',
                JSON.stringify({
                    version: 1,
                    noteItem: 'note-item.json',
                    files: [
                        {
                            originalPath: '/media/photo.png',
                            archivePath: '../outside.png',
                        },
                    ],
                }),
            ],
            [
                'note-item.json',
                JSON.stringify({ metadata: { id: 1 }, content: '{}' }),
            ],
        ]),
    );
    await expect(importBibleNoteItemArchive(note(), archive)).rejects.toThrow(
        'Invalid BibleNote item archive file path',
    );
    expect(h.copy).not.toHaveBeenCalled();
    expect(h.deleted).toHaveLength(1);

    h.archives.set(
        archive,
        new Map([
            [
                'manifest.json',
                JSON.stringify({
                    version: 1,
                    noteItem: 'note-item.json',
                    files: [
                        {
                            originalPath: '/media/photo.png',
                            archivePath: 'files/missing.png',
                        },
                    ],
                }),
            ],
            [
                'note-item.json',
                JSON.stringify({ metadata: { id: 1 }, content: '{}' }),
            ],
        ]),
    );
    await expect(importBibleNoteItemArchive(note(), archive)).rejects.toThrow(
        'Archive file not found: files/missing.png',
    );
    expect(h.copy).not.toHaveBeenCalled();
});

test('file-picker import reports success and leaves a cancelled picker alone', async () => {
    const archive = await createBibleNoteItemArchive(item('{}'));
    const targetNote = note();
    h.selected = [archive];
    expect(
        (await selectAndImportBibleNoteItemArchive(targetNote))?.metadata.id,
    ).toBe(9);
    expect(h.toast).toHaveBeenCalledWith(
        'Import Bible Note Item',
        'Imported Prayer: morning',
    );
    h.selected = [];
    h.toast.mockClear();
    expect(await selectAndImportBibleNoteItemArchive(targetNote)).toBeNull();
    expect(h.toast).not.toHaveBeenCalled();
});
