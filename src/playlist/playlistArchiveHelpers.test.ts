// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    ensureDirectoryMock,
    fsCheckFileExistMock,
    fsCloneFileMock,
    fsCopyFilePathToPathMock,
    fsCreateFileMock,
    fsDeleteDirMock,
    fsReadFileMock,
    getFileMD5Mock,
    genNextFilePathMock,
    tarCreateMock,
    tarExtractMock,
    getDirPathBySettingNameMock,
    fireUpdateEventMock,
} = vi.hoisted(() => ({
    ensureDirectoryMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    fsCloneFileMock: vi.fn(),
    fsCopyFilePathToPathMock: vi.fn(),
    fsCreateFileMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    getFileMD5Mock: vi.fn(),
    genNextFilePathMock: vi.fn(),
    tarCreateMock: vi.fn(),
    tarExtractMock: vi.fn(),
    getDirPathBySettingNameMock: vi.fn(),
    fireUpdateEventMock: vi.fn(),
}));

const pathJoinMock = (...parts: string[]) => parts.join('/');
const pathBasenameMock = (filePath: string) => {
    return filePath.split('/').pop() ?? filePath;
};

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));
vi.mock('../helper/bible-helpers/downloadHelpers', () => ({
    initHttpRequest: vi.fn(),
}));
vi.mock('../background/downloadHelper', () => ({
    askForURL: vi.fn(),
    messageCallback: vi.fn(),
    streamDownloadFile: vi.fn(),
}));
vi.mock('../helper/localFileHelpers', () => ({
    getAppFilePathFromFile: vi.fn(() => null),
}));
// Both must stay CLASSES: modules further down the graph subclass them
// (`ReadIdOnlyBibleItem extends BibleItem`), and a plain object throws
// "Class extends value is not a constructor" at import time.
vi.mock('../bible-list/Bible', () => ({
    default: class {
        static getDefault = vi.fn(async () => null);
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: class {
        static dragDeserialize = vi.fn(() => null);
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn((filePath: string) => ({
            filePath,
            fullName: pathBasenameMock(filePath),
            name: pathBasenameMock(filePath).replace(/\.[^.]*$/, ''),
            genNextFilePath: () => genNextFilePathMock(filePath),
            fireUpdateEvent: () => fireUpdateEventMock(filePath),
        })),
    },
}));

vi.mock('../helper/DirSource', () => ({
    default: { getDirPathBySettingName: getDirPathBySettingNameMock },
}));

vi.mock('../setting/directory-setting/directoryHelpers', () => ({
    BaseDirFileSource: class {
        constructor(
            readonly settingName: string,
            readonly value: string,
        ) {}
        get fileSource() {
            return { filePath: this.value };
        }
        get fileFullNameOrFilePath() {
            return pathBasenameMock(this.value);
        }
    },
}));

vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: vi.fn(),
    tarCreate: tarCreateMock,
    tarExtract: tarExtractMock,
}));

vi.mock('../server/fileHelpers', () => ({
    ensureDirectory: ensureDirectoryMock,
    fsCheckFileExist: fsCheckFileExistMock,
    fsCloneFile: fsCloneFileMock,
    fsCopyFilePathToPath: fsCopyFilePathToPathMock,
    fsCreateFile: fsCreateFileMock,
    fsDeleteDir: fsDeleteDirMock,
    fsReadFile: fsReadFileMock,
    getDownloadPath: () => '/downloads',
    getFileMD5: getFileMD5Mock,
    getTempPath: () => '/system-temp',
    pathBasename: pathBasenameMock,
    pathJoin: pathJoinMock,
    selectFiles: vi.fn(),
}));

vi.mock('./Playlist', () => ({
    default: { getInstance: vi.fn((filePath: string) => ({ filePath })) },
}));

async function loadModule() {
    vi.resetModules();
    return await import('./playlistArchiveHelpers');
}

const EXTRACT_DIR = '/system-temp/owapl-import-run-id';

function genManifest(files: any[], backgroundMetas: any[] = []) {
    return JSON.stringify({
        version: 1,
        playlist: 'playlist.json',
        files,
        backgroundMetas,
    });
}

describe('playlistArchiveHelpers import — file collisions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('crypto', { randomUUID: () => 'run-id' });
        getDirPathBySettingNameMock.mockReturnValue('/data/playlists');
        genNextFilePathMock.mockImplementation(async (filePath: string) => {
            return filePath;
        });
        fsCopyFilePathToPathMock.mockImplementation(
            async (_source: string, dirPath: string, fileFullName: string) => {
                return `${dirPath}/${fileFullName}`;
            },
        );
        fsCheckFileExistMock.mockResolvedValue(true);
    });

    function mockArchive(files: any[], playlistItems: any[] = []) {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('manifest.json')) {
                return Promise.resolve(genManifest(files));
            }
            if (filePath.endsWith('playlist.json')) {
                return Promise.resolve(
                    JSON.stringify({ items: playlistItems }),
                );
            }
            return Promise.resolve('{}');
        });
    }

    test('reuses a local file whose contents are identical', async () => {
        mockArchive([
            {
                originalPath: '/other-machine/videos/a.mp4',
                archivePath: 'files/001-a.mp4',
                kind: 'video',
            },
        ]);
        getFileMD5Mock.mockResolvedValue('same-hash');

        const { importPlaylistArchive } = await loadModule();
        await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

        expect(fsCopyFilePathToPathMock).not.toHaveBeenCalled();
    });

    test('copies beside a local file of the same name but different contents', async () => {
        mockArchive([
            {
                originalPath: '/other-machine/videos/a.mp4',
                archivePath: 'files/001-a.mp4',
                kind: 'video',
            },
        ]);
        getFileMD5Mock.mockImplementation(async (filePath: string) => {
            return filePath.startsWith(EXTRACT_DIR) ? 'archived' : 'local';
        });
        // `fsCopyFilePathToPath` resolves the free name itself, so a differing
        // hash simply has to reach it.
        fsCopyFilePathToPathMock.mockResolvedValue('/data/playlists/a (1).mp4');

        const { importPlaylistArchive } = await loadModule();
        await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

        expect(fsCopyFilePathToPathMock).toHaveBeenCalledWith(
            `${EXTRACT_DIR}/files/001-a.mp4`,
            '/data/playlists',
            'a.mp4',
        );
    });

    test('treats an unreadable local file as different rather than reusing it', async () => {
        mockArchive([
            {
                originalPath: '/other-machine/videos/a.mp4',
                archivePath: 'files/001-a.mp4',
                kind: 'video',
            },
        ]);
        getFileMD5Mock.mockResolvedValue(null);

        const { importPlaylistArchive } = await loadModule();
        await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

        expect(fsCopyFilePathToPathMock).toHaveBeenCalled();
    });

    test('copies straight away when nothing occupies the name', async () => {
        mockArchive([
            {
                originalPath: '/other-machine/videos/a.mp4',
                archivePath: 'files/001-a.mp4',
                kind: 'video',
            },
        ]);
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath.startsWith(EXTRACT_DIR);
        });

        const { importPlaylistArchive } = await loadModule();
        await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

        expect(getFileMD5Mock).not.toHaveBeenCalled();
        expect(fsCopyFilePathToPathMock).toHaveBeenCalled();
    });
});

describe('playlistArchiveHelpers — a document’s own canvas media', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('crypto', { randomUUID: () => 'run-id' });
        getDirPathBySettingNameMock.mockReturnValue('/data/playlists');
        genNextFilePathMock.mockImplementation(async (filePath: string) => {
            return filePath;
        });
        fsCheckFileExistMock.mockResolvedValue(true);
    });

    const CANVAS_DOCUMENT = {
        items: [
            {
                id: 0,
                canvasItems: [
                    { type: 'text', text: 'hi' },
                    { type: 'video', filePath: '/other/videos/clip.mp4' },
                ],
            },
        ],
    };

    test('export bundles the video a slide’s canvas points at', async () => {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('.ows')) {
                return Promise.resolve(JSON.stringify(CANVAS_DOCUMENT));
            }
            return Promise.resolve('{}');
        });
        // Only the document and the video exist; no `.bg.json` sidecar.
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return !filePath.endsWith('.bg.json');
        });

        const { createPlaylistArchive } = await loadModule();
        await createPlaylistArchive({
            fileSource: { name: 'Service' },
            getJsonData: async () => ({
                items: [
                    { type: 'slide', filePath: '/other/docs/a.ows', id: 1 },
                ],
            }),
        } as any);

        const manifestCall = fsCreateFileMock.mock.calls.find((call) => {
            return String(call[0]).endsWith('manifest.json');
        });
        const manifest = JSON.parse(String(manifestCall?.[1]));
        expect(manifest.files).toEqual([
            expect.objectContaining({
                originalPath: '/other/docs/a.ows',
                kind: 'document',
            }),
            expect.objectContaining({
                originalPath: '/other/videos/clip.mp4',
                kind: 'video',
            }),
        ]);
    });

    test('import re-points the canvas video at the local copy', async () => {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('manifest.json')) {
                return Promise.resolve(
                    genManifest([
                        {
                            originalPath: '/other/docs/a.ows',
                            archivePath: 'files/001-a.ows',
                            kind: 'document',
                        },
                        {
                            originalPath: '/other/videos/clip.mp4',
                            archivePath: 'files/002-clip.mp4',
                            kind: 'video',
                        },
                    ]),
                );
            }
            if (filePath.endsWith('playlist.json')) {
                return Promise.resolve(JSON.stringify({ items: [] }));
            }
            return Promise.resolve(JSON.stringify(CANVAS_DOCUMENT));
        });
        // Nothing local collides, so both files are written fresh.
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath.startsWith(EXTRACT_DIR);
        });
        fsCopyFilePathToPathMock.mockImplementation(
            async (_source: string, dirPath: string, fileFullName: string) => {
                return `${dirPath}/${fileFullName}`;
            },
        );

        const { importPlaylistArchive } = await loadModule();
        await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

        const rewriteCall = fsCreateFileMock.mock.calls.find((call) => {
            return String(call[0]).endsWith('a.ows');
        });
        expect(rewriteCall).toBeDefined();
        expect(JSON.parse(String(rewriteCall?.[1]))).toEqual({
            items: [
                {
                    id: 0,
                    canvasItems: [
                        { type: 'text', text: 'hi' },
                        {
                            type: 'video',
                            filePath: '/data/playlists/clip.mp4',
                        },
                    ],
                },
            ],
        });
    });

    test('a REUSED document is never rewritten', async () => {
        fsReadFileMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('manifest.json')) {
                return Promise.resolve(
                    genManifest([
                        {
                            originalPath: '/other/docs/a.ows',
                            archivePath: 'files/001-a.ows',
                            kind: 'document',
                        },
                    ]),
                );
            }
            if (filePath.endsWith('playlist.json')) {
                return Promise.resolve(JSON.stringify({ items: [] }));
            }
            return Promise.resolve(JSON.stringify(CANVAS_DOCUMENT));
        });
        getFileMD5Mock.mockResolvedValue('identical');

        const { importPlaylistArchive } = await loadModule();
        await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

        const rewriteCall = fsCreateFileMock.mock.calls.find((call) => {
            return String(call[0]).endsWith('a.ows');
        });
        expect(rewriteCall).toBeUndefined();
    });
});
