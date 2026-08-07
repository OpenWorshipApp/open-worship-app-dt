// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    ensureDirectoryMock,
    fsCheckFileExistMock,
    downloadsFileExistMock,
    fsCloneFileMock,
    fsCopyFilePathToPathMock,
    fsCreateFileMock,
    fsDeleteDirMock,
    fsReadFileMock,
    fsGetFileSizeMock,
    getFileMD5Mock,
    genNextFilePathMock,
    tarCreateMock,
    tarExtractMock,
    getDirPathBySettingNameMock,
    fireUpdateEventMock,
} = vi.hoisted(() => ({
    ensureDirectoryMock: vi.fn(),
    fsCheckFileExistMock: vi.fn(),
    downloadsFileExistMock: vi.fn(),
    fsCloneFileMock: vi.fn(),
    fsCopyFilePathToPathMock: vi.fn(),
    fsCreateFileMock: vi.fn(),
    fsDeleteDirMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    fsGetFileSizeMock: vi.fn(),
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

// The Downloads folder answers separately, and empty by default. Tests here
// say "everything exists" to describe the DATA folders, but the export's own
// destination is read with the same call: `genNextArchiveFilePath` counts up
// until it finds a free name, so one blanket `true` would never terminate.
const fsCheckFileExistSplitMock = (filePath: string) => {
    if (String(filePath).startsWith('/downloads/')) {
        return Promise.resolve(downloadsFileExistMock(filePath) === true);
    }
    return fsCheckFileExistMock(filePath);
};

vi.mock('../server/fileHelpers', () => ({
    ensureDirectory: ensureDirectoryMock,
    fsCheckFileExist: fsCheckFileExistSplitMock,
    fsCloneFile: fsCloneFileMock,
    fsCopyFilePathToPath: fsCopyFilePathToPathMock,
    fsCreateFile: fsCreateFileMock,
    fsDeleteDir: fsDeleteDirMock,
    fsReadFile: fsReadFileMock,
    getDownloadPath: () => '/downloads',
    fsGetFileSize: fsGetFileSizeMock,
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

// Every test re-imports the module under test from scratch, and this one pulls
// in the playlist-item graph (which reaches the canvas classes), so a cold
// import is charged to whichever test runs first. Under some worker packings
// that alone exceeds the 10s default and the file fails for no reason of its
// own — and a half-initialized graph then breaks the NEXT test with
// "Class extends value undefined".
const COLD_IMPORT_TIMEOUT = 30_000;

const EXTRACT_DIR = '/system-temp/owapl-import-run-id';

function genManifest(files: any[], backgroundMetas: any[] = []) {
    return JSON.stringify({
        version: 1,
        playlist: 'playlist.json',
        files,
        backgroundMetas,
    });
}

describe(
    'playlistArchiveHelpers import — file collisions',
    () => {
        beforeEach(() => {
            vi.clearAllMocks();
            vi.stubGlobal('crypto', { randomUUID: () => 'run-id' });
            getDirPathBySettingNameMock.mockReturnValue('/data/playlists');
            genNextFilePathMock.mockImplementation(async (filePath: string) => {
                return filePath;
            });
            fsCopyFilePathToPathMock.mockImplementation(
                async (
                    _source: string,
                    dirPath: string,
                    fileFullName: string,
                ) => {
                    return `${dirPath}/${fileFullName}`;
                },
            );
            fsCheckFileExistMock.mockResolvedValue(true);
            // Size is the free first half of the same-contents check, so an
            // identical size is the default and MD5 decides where it matters.
            fsGetFileSizeMock.mockResolvedValue(1024);
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

        // The imported playlist is named after the archive, so the extension has
        // to come off in BOTH the shapes that exist on disk — otherwise a bundle
        // an older build named `pl.owapl.tar (3).gz` lands as a playlist called
        // `pl.owapl.tar (3)`.
        test.each([
            ['/downloads/pl.owapl.tar.gz', '/data/playlists/pl.owp'],
            ['/downloads/pl (3).owapl.tar.gz', '/data/playlists/pl (3).owp'],
            ['/downloads/pl.owapl.tar (3).gz', '/data/playlists/pl.owp'],
        ])('names the playlist after %s', async (archivePath, expected) => {
            mockArchive([]);

            const { importPlaylistArchive } = await loadModule();
            await importPlaylistArchive(archivePath);

            const writtenCall = fsCreateFileMock.mock.calls.find((call) => {
                return String(call[0]).endsWith('.owp');
            });
            expect(writtenCall?.[0]).toBe(expected);
        });

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
            fsCopyFilePathToPathMock.mockResolvedValue(
                '/data/playlists/a (1).mp4',
            );

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
            fsCheckFileExistMock.mockImplementation(
                async (filePath: string) => {
                    return filePath.startsWith(EXTRACT_DIR);
                },
            );

            const { importPlaylistArchive } = await loadModule();
            await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

            expect(getFileMD5Mock).not.toHaveBeenCalled();
            expect(fsCopyFilePathToPathMock).toHaveBeenCalled();
        });
    },
    COLD_IMPORT_TIMEOUT,
);

describe(
    'playlistArchiveHelpers — a document’s own canvas media',
    () => {
        beforeEach(() => {
            vi.clearAllMocks();
            vi.stubGlobal('crypto', { randomUUID: () => 'run-id' });
            getDirPathBySettingNameMock.mockReturnValue('/data/playlists');
            genNextFilePathMock.mockImplementation(async (filePath: string) => {
                return filePath;
            });
            fsCheckFileExistMock.mockResolvedValue(true);
            // Size is the free first half of the same-contents check, so an
            // identical size is the default and MD5 decides where it matters.
            fsGetFileSizeMock.mockResolvedValue(1024);
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
            fsCheckFileExistMock.mockImplementation(
                async (filePath: string) => {
                    return !filePath.endsWith('.bg.json');
                },
            );

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
            fsCheckFileExistMock.mockImplementation(
                async (filePath: string) => {
                    return filePath.startsWith(EXTRACT_DIR);
                },
            );
            fsCopyFilePathToPathMock.mockImplementation(
                async (
                    _source: string,
                    dirPath: string,
                    fileFullName: string,
                ) => {
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

        test('a bundled document is written fresh even when identical', async () => {
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
            fsCopyFilePathToPathMock.mockResolvedValue(
                '/data/playlists/a (1).ows',
            );

            const { importPlaylistArchive } = await loadModule();
            await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

            // A document is never folded into the operator's namesake, so
            // identical contents change nothing — it is still written.
            expect(fsCopyFilePathToPathMock).toHaveBeenCalledWith(
                `${EXTRACT_DIR}/files/001-a.ows`,
                '/data/playlists',
                'a.ows',
            );
            expect(getFileMD5Mock).not.toHaveBeenCalled();
        });
    },
    COLD_IMPORT_TIMEOUT,
);

describe(
    'playlistArchiveHelpers — CC elements',
    () => {
        beforeEach(() => {
            vi.clearAllMocks();
            vi.stubGlobal('crypto', { randomUUID: () => 'run-id' });
            getDirPathBySettingNameMock.mockReturnValue('/data/playlists');
            genNextFilePathMock.mockImplementation(async (filePath: string) => {
                return filePath;
            });
            fsCheckFileExistMock.mockResolvedValue(true);
            fsGetFileSizeMock.mockResolvedValue(1024);
        });

        test('export bundles the media a CC points at', async () => {
            fsReadFileMock.mockResolvedValue('{}');
            // No `.bg.json` sidecar exists beside the bundled document.
            fsCheckFileExistMock.mockImplementation(
                async (filePath: string) => {
                    return !filePath.endsWith('.bg.json');
                },
            );

            const { createPlaylistArchive } = await loadModule();
            await createPlaylistArchive({
                fileSource: { name: 'Service' },
                getJsonData: async () => ({
                    items: [
                        {
                            uuid: 'u-image',
                            type: 'bg-image',
                            data: '/other/images/lower-third.png',
                            title: 'lower-third.png',
                        },
                        {
                            uuid: 'u-video',
                            type: 'bg-video',
                            data: '/other/videos/clip.mp4',
                            title: 'clip.mp4',
                        },
                        {
                            uuid: 'u-color',
                            type: 'bg-color',
                            data: '#fff',
                            title: '#fff',
                            ccItems: [{ uuid: 'u-image' }],
                        },
                        {
                            uuid: 'u-doc',
                            type: 'appDocument',
                            filePath: '/other/docs/a.ows',
                            data: '/other/docs/a.ows',
                            title: 'a',
                            slideCcItems: { '7': [{ uuid: 'u-video' }] },
                        },
                    ],
                }),
            } as any);

            const manifestCall = fsCreateFileMock.mock.calls.find((call) => {
                return String(call[0]).endsWith('manifest.json');
            });
            const manifest = JSON.parse(String(manifestCall?.[1]));
            // A CC's media travels with the bundle because the element it
            // points at is itself a line of the sheet — there is nothing
            // nested left for the walk to miss.
            expect(
                manifest.files.map((file: any) => {
                    return file.originalPath;
                }),
            ).toEqual([
                '/other/images/lower-third.png',
                '/other/videos/clip.mp4',
                '/other/docs/a.ows',
            ]);
        });

        test('import keeps a CC pointing at its element, entry and slide alike', async () => {
            fsReadFileMock.mockImplementation((filePath: string) => {
                if (filePath.endsWith('manifest.json')) {
                    return Promise.resolve(
                        genManifest([
                            {
                                originalPath: '/other/images/lower-third.png',
                                archivePath: 'files/001-lower-third.png',
                                kind: 'image',
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
                    return Promise.resolve(
                        JSON.stringify({
                            items: [
                                {
                                    uuid: 'u-color',
                                    type: 'bg-color',
                                    data: '#fff',
                                    title: '#fff',
                                    ccItems: [{ uuid: 'u-image' }],
                                    slideCcItems: {
                                        '7': [{ uuid: 'u-video' }],
                                    },
                                },
                                {
                                    uuid: 'u-image',
                                    type: 'bg-image',
                                    data: '/other/images/lower-third.png',
                                    title: 'lower-third.png',
                                },
                                {
                                    uuid: 'u-video',
                                    type: 'bg-video',
                                    data: '/other/videos/clip.mp4',
                                    title: 'clip.mp4',
                                },
                            ],
                        }),
                    );
                }
                return Promise.resolve('{}');
            });
            fsCheckFileExistMock.mockImplementation(
                async (filePath: string) => {
                    return filePath.startsWith(EXTRACT_DIR);
                },
            );
            fsCopyFilePathToPathMock.mockImplementation(
                async (
                    _source: string,
                    dirPath: string,
                    fileFullName: string,
                ) => {
                    return `${dirPath}/${fileFullName}`;
                },
            );

            const { importPlaylistArchive } = await loadModule();
            await importPlaylistArchive('/downloads/pl.owapl.tar.gz');

            const writtenCall = fsCreateFileMock.mock.calls.find((call) => {
                return String(call[0]).endsWith('.owp');
            });
            const written = JSON.parse(String(writtenCall?.[1]));
            // The references survive the round trip untouched, and what they
            // name is re-pointed at the local copy as an ordinary entry.
            expect(written.items[0].ccItems).toEqual([{ uuid: 'u-image' }]);
            expect(written.items[0].slideCcItems['7']).toEqual([
                { uuid: 'u-video' },
            ]);
            expect(written.items[1].data).toBe(
                '/data/playlists/lower-third.png',
            );
            expect(written.items[2].data).toBe('/data/playlists/clip.mp4');
        });
    },
    COLD_IMPORT_TIMEOUT,
);

describe(
    'playlistArchiveHelpers — the archive file NAME',
    () => {
        // Imported ONCE for the whole block: `loadModule` resets the module
        // registry and re-imports the playlist-item graph, and doing that per
        // test is what pushes this file over the heap limit. Nothing here needs
        // a fresh module — every mock it reads is consulted at call time.
        let playlistArchiveHelpers: any;

        beforeAll(async () => {
            playlistArchiveHelpers = await loadModule();
        }, COLD_IMPORT_TIMEOUT);

        beforeEach(() => {
            vi.clearAllMocks();
            vi.stubGlobal('crypto', { randomUUID: () => 'run-id' });
            getDirPathBySettingNameMock.mockReturnValue('/data/playlists');
            fsReadFileMock.mockResolvedValue('{}');
            fsGetFileSizeMock.mockResolvedValue(1024);
        });

        function exportEmptyPlaylist(existingPaths: string[]) {
            downloadsFileExistMock.mockImplementation((filePath: string) => {
                return existingPaths.includes(filePath);
            });
            return playlistArchiveHelpers.createPlaylistArchive({
                fileSource: { name: 'Service' },
                getJsonData: async () => ({ items: [] }),
            } as any);
        }

        test('the first export is the canonical name', async () => {
            expect(await exportEmptyPlaylist([])).toBe(
                '/downloads/Service.owapl.tar.gz',
            );
        });

        // The suffix used to be inserted before the LAST dot, giving
        // `Service.owapl.tar (1).gz` — a name that no longer ends in
        // `.owapl.tar.gz`, which the drop gate below then refused. Exporting
        // twice therefore produced a bundle the app itself could not take back.
        test('a later export keeps the whole extension', async () => {
            expect(
                await exportEmptyPlaylist(['/downloads/Service.owapl.tar.gz']),
            ).toBe('/downloads/Service (1).owapl.tar.gz');
            expect(
                await exportEmptyPlaylist([
                    '/downloads/Service.owapl.tar.gz',
                    '/downloads/Service (1).owapl.tar.gz',
                ]),
            ).toBe('/downloads/Service (2).owapl.tar.gz');
        });

        test('the drop gate takes both the canonical and the legacy name', () => {
            const { checkIsPlaylistArchiveFileFullName } =
                playlistArchiveHelpers;

            expect(
                checkIsPlaylistArchiveFileFullName('Service.owapl.tar.gz'),
            ).toBe(true);
            expect(
                checkIsPlaylistArchiveFileFullName('Service (1).owapl.tar.gz'),
            ).toBe(true);
            // Written by older builds, so it must still import.
            expect(
                checkIsPlaylistArchiveFileFullName('Service.owapl.tar (1).gz'),
            ).toBe(true);
            expect(
                checkIsPlaylistArchiveFileFullName('Service.owapl.tar(12).gz'),
            ).toBe(true);
            expect(
                checkIsPlaylistArchiveFileFullName('holiday-photos.gz'),
            ).toBe(false);
            expect(
                checkIsPlaylistArchiveFileFullName('Service.owadoc.tar.gz'),
            ).toBe(false);
            expect(checkIsPlaylistArchiveFileFullName('Service.owp')).toBe(
                false,
            );
        });
    },
    COLD_IMPORT_TIMEOUT,
);
