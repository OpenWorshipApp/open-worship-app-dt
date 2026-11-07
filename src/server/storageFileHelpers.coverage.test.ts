// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `storageFileHelpers` reads the path separator once, at import, so each test
// loads it afresh (`vi.resetModules()`) for the operating system family it is
// about. The provider is this file's own: its `pathUtils` getter answers with
// node's posix or win32 rules, and its file system is the small in-memory tree
// in the hoisted bundle, so mounted volumes can be laid out without a disk.
const h = vi.hoisted(() => {
    return {
        isWindows: false,
        hasRenameSync: true,
        dirs: new Map<string, string[]>(),
        files: new Map<string, string>(),
        writeError: null as Error | null,
        writes: [] as { filePath: string; text: string; options: unknown }[],
        handleError: vi.fn(),
        sendDataSync: vi.fn(),
    };
});

vi.mock('./appProvider', async () => {
    const nodePath = await import('node:path');
    return {
        default: {
            get pathUtils() {
                return h.isWindows ? nodePath.win32 : nodePath.posix;
            },
            browserUtils: {
                pathToFileURL: (filePath: string) => `file://${filePath}`,
            },
            sessionData: { defaultStorageDirPath: null },
            systemUtils: { isLinux: true },
            messageUtils: {
                sendDataSync: (...args: unknown[]) => h.sendDataSync(...args),
            },
            fileUtils: {
                readdirSync: (dirPath: string) => {
                    const names = h.dirs.get(dirPath);
                    if (names === undefined) {
                        throw Object.assign(new Error('no such folder'), {
                            code: 'ENOENT',
                        });
                    }
                    return names;
                },
                existsSync: (filePath: string) => {
                    return h.files.has(filePath) || h.dirs.has(filePath);
                },
                readFileSync: (filePath: string) => {
                    const text = h.files.get(filePath);
                    if (text === undefined) {
                        throw new Error('no such file');
                    }
                    return text;
                },
                writeFileSync: (
                    filePath: string,
                    text: string,
                    options: unknown,
                ) => {
                    if (h.writeError !== null) {
                        throw h.writeError;
                    }
                    h.writes.push({ filePath, text, options });
                    h.files.set(filePath, text);
                },
                unlinkSync: (filePath: string) => {
                    h.files.delete(filePath);
                },
                get renameSync() {
                    return h.hasRenameSync
                        ? (from: string, to: string) => {
                              h.files.set(to, h.files.get(from)!);
                              h.files.delete(from);
                          }
                        : undefined;
                },
            },
        },
    };
});
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));

async function loadHelpers(isWindows = false) {
    h.isWindows = isWindows;
    vi.resetModules();
    return await import('./storageFileHelpers');
}

const MARKER = '.owa-data-folder.json';

function addMarker(dirPath: string, id: string) {
    h.files.set(`${dirPath}/${MARKER}`, JSON.stringify({ id }));
}

beforeEach(() => {
    h.isWindows = false;
    h.hasRenameSync = true;
    h.dirs.clear();
    h.files.clear();
    h.writeError = null;
    h.writes.length = 0;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('pathResolve', () => {
    test('a Windows drive root comes back without its separator', async () => {
        const { pathResolve, pathSeparator } = await loadHelpers(true);
        expect(pathSeparator).toBe('\\');
        expect(pathResolve('E:\\')).toBe('E:');
        expect(pathResolve('E:\\Songs\\')).toBe('E:\\Songs');
    });
});

describe('listVolumeRootsSync on macOS and Linux', () => {
    test('lists the mounted volumes under each mount base, hidden names left out', async () => {
        h.dirs.set('/Volumes', ['Macintosh HD', 'STICK', '.Trashes']);
        h.dirs.set('/media', ['racky', '.hidden']);
        h.dirs.set('/media/racky', ['USB1']);
        h.dirs.set('/media/.hidden', ['SECRET']);
        // `/run/media` is not there at all on this computer.
        h.dirs.set('/mnt', ['c']);
        const { listVolumeRootsSync } = await loadHelpers();

        expect(listVolumeRootsSync()).toEqual([
            '/Volumes/Macintosh HD',
            '/Volumes/STICK',
            '/media/racky/USB1',
            '/mnt/c',
        ]);
    });

    test('a computer with none of the mount bases lists no volumes', async () => {
        const { listVolumeRootsSync } = await loadHelpers();
        expect(listVolumeRootsSync()).toEqual([]);
    });
});

describe('data folder markers', () => {
    test('a marker that is not JSON, or has no id, names no folder', async () => {
        const { readDataDirMarkerIdSync } = await loadHelpers();
        h.files.set(`/data/${MARKER}`, '{ broken');
        expect(readDataDirMarkerIdSync('/data')).toBeNull();
        h.files.set(`/data/${MARKER}`, JSON.stringify({ id: '' }));
        expect(readDataDirMarkerIdSync('/data')).toBeNull();
        addMarker('/data', 'marker-1');
        expect(readDataDirMarkerIdSync('/data')).toBe('marker-1');
    });

    test('a folder without a marker gets a new one', async () => {
        vi.stubGlobal('crypto', { randomUUID: () => 'marker-new' });
        const { ensureDataDirMarkerIdSync } = await loadHelpers();
        expect(ensureDataDirMarkerIdSync('/data')).toBe('marker-new');
        const marker = JSON.parse(h.files.get(`/data/${MARKER}`)!);
        expect(marker).toMatchObject({
            id: 'marker-new',
            app: 'open-worship-app',
        });
        expect(Number.isNaN(Date.parse(marker.createdAt))).toBe(false);
    });

    test('a marker that cannot be written is reported and gives no id', async () => {
        vi.stubGlobal('crypto', { randomUUID: () => 'marker-new' });
        const error = new Error('read-only stick');
        h.writeError = error;
        const { ensureDataDirMarkerIdSync } = await loadHelpers();
        expect(ensureDataDirMarkerIdSync('/data')).toBeNull();
        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
    });

    test('a folder that already has a marker keeps it', async () => {
        addMarker('/data', 'marker-1');
        const { ensureDataDirMarkerIdSync } = await loadHelpers();
        expect(ensureDataDirMarkerIdSync('/data')).toBe('marker-1');
        expect(h.writes).toEqual([]);
    });
});

describe('findMovedDataDirSync', () => {
    test('finds the folder on the volume it moved to, never on its old one', async () => {
        h.dirs.set('/Volumes', ['STICK', 'STICK 1']);
        // The old volume still answers with the same marker: it is skipped.
        addMarker('/Volumes/STICK/open-worship-data', 'marker-1');
        addMarker('/Volumes/STICK 1/open-worship-data', 'marker-1');
        const { findMovedDataDirSync } = await loadHelpers();

        expect(
            findMovedDataDirSync(
                '/Volumes/STICK/open-worship-data',
                'marker-1',
            ),
        ).toBe('/Volumes/STICK 1/open-worship-data');
    });

    test('has nothing to look for without a marker id', async () => {
        h.dirs.set('/Volumes', ['STICK 1']);
        addMarker('/Volumes/STICK 1/open-worship-data', 'marker-1');
        const { findMovedDataDirSync } = await loadHelpers();
        expect(
            findMovedDataDirSync('/Volumes/STICK/open-worship-data', null),
        ).toBeNull();
    });
});

describe('writing and asking the main process', () => {
    test('fsWriteFileAtomicSync writes in place where there is no rename', async () => {
        h.hasRenameSync = false;
        const { fsWriteFileAtomicSync } = await loadHelpers();
        fsWriteFileAtomicSync('/data/settings/screen-map', '{"a":1}');
        expect(h.writes).toEqual([
            {
                filePath: '/data/settings/screen-map',
                text: '{"a":1}',
                options: { encoding: 'utf8', flag: 'w' },
            },
        ]);
    });

    test('getUserWritablePath asks the main process for its data path', async () => {
        h.sendDataSync.mockReturnValue('/home/me/.config/open-worship-app');
        const { getUserWritablePath } = await loadHelpers();
        expect(getUserWritablePath()).toBe('/home/me/.config/open-worship-app');
        expect(h.sendDataSync).toHaveBeenCalledExactlyOnceWith(
            'main:app:get-data-path',
        );
    });
});
