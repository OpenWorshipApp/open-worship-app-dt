// @vitest-environment jsdom

import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    files: new Map<string, string>(),
    directories: [] as string[],
    copied: [] as { from: string; to: string }[],
    updates: [] as string[],
    errors: [] as unknown[],
    selectedDirs: new Map<string, string>(),
    sessionData: { defaultStorageDirPath: '/church/data' as string | null },
    // `fsCopyFilePathToPath` answering null: the copy did not land.
    failCopy: false,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        isPageReader: false,
        isMainPage: false,
        systemUtils: { isDev: false, isWindows: false },
        sessionData: h.sessionData,
        pathUtils: posix,
        messageUtils: { sendData: () => {}, sendDataSync: () => null },
    },
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (name: string) => h.selectedDirs.get(name),
    },
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (path: string) => ({
            fireUpdateEvent: () => h.updates.push(path),
        }),
    },
}));
vi.mock('../setting/directory-setting/directoryHelpers', () => ({
    BaseDirFileSource: class {
        fileSource: { filePath: string };
        fileFullNameOrFilePath: string;

        constructor(_settingName: string, filePath: string) {
            this.fileSource = { filePath };
            this.fileFullNameOrFilePath = posix.basename(filePath);
        }
    },
}));
vi.mock('./errorHelpers', () => ({
    handleError: (error: unknown) => h.errors.push(error),
}));

vi.mock('../server/fileHelpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../server/fileHelpers')>();
    return {
        ...actual,
        pathJoin: posix.join,
        pathBasename: posix.basename,
        getTempPath: () => '/tmp',
        getDataDirPath: () => h.sessionData.defaultStorageDirPath,
        ensureDirectory: async (path: string) => {
            h.directories.push(path);
        },
        fsCheckFileExist: async (path: string) => h.files.has(path),
        fsReadFile: async (path: string) => {
            const content = h.files.get(path);
            if (content === undefined) throw new Error(`Missing ${path}`);
            return content;
        },
        fsCreateFile: async (path: string, content: string) => {
            h.files.set(path, content);
            return true;
        },
        fsCloneFile: async (from: string, to: string) => {
            h.files.set(to, h.files.get(from) ?? '');
            h.copied.push({ from, to });
            return true;
        },
        fsCopyFilePathToPath: async (
            from: string,
            dir: string,
            name: string,
        ) => {
            if (h.failCopy) return null;
            const to = posix.join(dir, name);
            h.files.set(to, h.files.get(from) ?? '');
            h.copied.push({ from, to });
            return to;
        },
        fsDeleteDir: async (path: string) => {
            if (path === '/bad') throw new Error('delete failed');
            h.directories.push(`deleted:${path}`);
        },
        fsGetFileSize: async (path: string) => {
            const content = h.files.get(path);
            if (content === undefined) throw new Error(`Missing ${path}`);
            return Buffer.byteLength(content);
        },
        getFileMD5: async (path: string) => {
            const content = h.files.get(path);
            return content === undefined
                ? null
                : createHash('md5').update(content).digest('hex');
        },
    };
});

import { dirSourceSettingNames } from './constants';
import { DragTypeEnum } from './DragInf';
import {
    ArchiveFileCollector,
    applyImportedCanvasMedia,
    checkIsSameFileContent,
    createWorkDir,
    findExistingLocalFile,
    getImportCollisionPolicy,
    importArchiveFiles,
    importBackgroundMetas,
    importTransitionMetas,
    readArchiveManifest,
    resolveKindDirPaths,
    safeDeleteDir,
    stageArchiveFiles,
    toExtractedArchivePath,
    toValidTransitionMetaData,
    validateArchiveBackgroundMetas,
    validateArchiveFileEntries,
    writeArchiveManifest,
} from './appArchiveHelpers';

beforeEach(() => {
    h.files.clear();
    h.directories.length = 0;
    h.copied.length = 0;
    h.updates.length = 0;
    h.errors.length = 0;
    h.selectedDirs.clear();
    h.sessionData.defaultStorageDirPath = '/church/data';
    h.failCopy = false;
});

describe('archive manifest boundaries', () => {
    test('writes the exporting data folder and reads a valid manifest', async () => {
        await writeArchiveManifest('/tmp/stage', { itemKind: 'document' });
        expect(JSON.parse(h.files.get('/tmp/stage/manifest.json')!)).toEqual({
            itemKind: 'document',
            dataDirPath: '/church/data',
        });
        expect(await readArchiveManifest('/tmp/stage', 'Wrong bundle')).toEqual(
            {
                itemKind: 'document',
                dataDirPath: '/church/data',
            },
        );
        await expect(
            readArchiveManifest('/absent', 'Wrong bundle'),
        ).rejects.toThrow('Wrong bundle');
    });

    test('validates entry kinds, sidecars and extracted paths', () => {
        expect(
            validateArchiveFileEntries(
                [
                    {
                        originalPath: '/old/song.ows',
                        archivePath: 'files/song.ows',
                        kind: 'document',
                        ignored: true,
                    },
                ],
                'Invalid files',
            ),
        ).toEqual([
            {
                originalPath: '/old/song.ows',
                archivePath: 'files/song.ows',
                kind: 'document',
            },
        ]);
        for (const files of [
            null,
            [{ kind: 'unknown' }],
            [{ kind: 'video' }],
        ]) {
            expect(() =>
                validateArchiveFileEntries(files, 'Invalid files'),
            ).toThrow('Invalid files');
        }
        expect(validateArchiveBackgroundMetas(null)).toEqual([]);
        expect(
            validateArchiveBackgroundMetas([
                { documentOriginalPath: '/song.ows', archivePath: 'files/bg' },
                { documentOriginalPath: 2, archivePath: 'files/other' },
            ]),
        ).toEqual([
            { documentOriginalPath: '/song.ows', archivePath: 'files/bg' },
        ]);
        expect(toExtractedArchivePath('/tmp/extract', '/files//song.ows')).toBe(
            '/tmp/extract/files/song.ows',
        );
        for (const path of [
            '',
            '../secret',
            'files/../secret',
            'files\\song',
        ]) {
            expect(() => toExtractedArchivePath('/tmp/extract', path)).toThrow(
                'Invalid archive file path',
            );
        }
    });

    test('filters transition sidecars and resolves folders before import', () => {
        expect(
            toValidTransitionMetaData({ preview: 'fade', a: 'zoom', b: 8 }),
        ).toEqual({ preview: 'fade', a: 'zoom' });
        expect(toValidTransitionMetaData({ a: 'invalid' })).toBeNull();
        expect(toValidTransitionMetaData(null)).toBeNull();
        h.selectedDirs.set(dirSourceSettingNames.BACKGROUND_VIDEO, '/videos');
        const files = [
            {
                originalPath: '/a',
                archivePath: 'files/a',
                kind: 'video' as const,
            },
            {
                originalPath: '/b',
                archivePath: 'files/b',
                kind: 'video' as const,
            },
            {
                originalPath: '/c',
                archivePath: 'files/c',
                kind: 'bible' as const,
            },
        ];
        expect(
            resolveKindDirPaths(files, new Map([['bible', '/custom-bibles']])),
        ).toEqual(
            new Map([
                ['bible', '/custom-bibles'],
                ['video', '/videos'],
            ]),
        );
        expect(() => resolveKindDirPaths(files)).toThrow('No "bible" folder');
    });

    test('creates and safely removes staging folders', async () => {
        const workDir = await createWorkDir('bundle');
        expect(workDir).toMatch(/^\/tmp\/bundle-/);
        expect(h.directories).toContain(workDir);
        await safeDeleteDir(workDir);
        await safeDeleteDir('/bad');
        expect(h.directories).toContain(`deleted:${workDir}`);
        expect(h.errors).toHaveLength(1);
    });
});

describe('document collection and staging', () => {
    test('collects sidecars and local canvas media only once', async () => {
        h.files.set(
            '/docs/song.ows',
            JSON.stringify({
                items: [
                    {
                        canvasItems: [
                            { type: 'video', filePath: '/media/clip.mp4' },
                            { type: 'audio', filePath: '/media/song.mp3' },
                            {
                                type: 'video',
                                filePath: 'https://example.com/live',
                            },
                            { type: 'image', filePath: '/media/image.png' },
                        ],
                    },
                ],
            }),
        );
        h.files.set(
            '/docs/song.ows.bg.json',
            JSON.stringify({
                first: {
                    type: DragTypeEnum.BACKGROUND_IMAGE,
                    item: '/media/bg.png',
                },
                ignored: { type: 'unknown', item: '/media/ignored' },
            }),
        );
        h.files.set(
            '/docs/song.ows.transition.json',
            JSON.stringify({
                preview: 'fade',
                bad: 'bounce',
            }),
        );
        for (const path of [
            '/media/clip.mp4',
            '/media/song.mp3',
            '/media/bg.png',
        ]) {
            h.files.set(path, `bytes:${path}`);
        }
        const collector = new ArchiveFileCollector();
        expect(await collector.addDocument('/docs/song.ows')).toBe(true);
        expect(await collector.addDocument('/docs/song.ows')).toBe(true);
        expect([...collector.entryByOriginalPath.keys()]).toEqual([
            '/docs/song.ows',
            '/media/bg.png',
            '/media/clip.mp4',
            '/media/song.mp3',
        ]);
        expect(collector.backgroundMetas).toHaveLength(1);
        expect(collector.transitionMetas).toHaveLength(1);
        expect(collector.extraContentByArchivePath.size).toBe(2);
        const staged = await stageArchiveFiles(collector, '/tmp/stage', [
            'item.json',
        ]);
        expect(staged.archiveEntries).toEqual([
            'manifest.json',
            'item.json',
            'files',
        ]);
        expect(h.copied).toHaveLength(4);
        const backgrounds = JSON.parse(
            h.files.get(
                `/tmp/stage/${collector.backgroundMetas[0].archivePath}`,
            )!,
        );
        expect(backgrounds.first.item).toBe('/media/bg.png');
        const transitions = JSON.parse(
            h.files.get(
                `/tmp/stage/${collector.transitionMetas[0].archivePath}`,
            )!,
        );
        expect(transitions).toEqual({ preview: 'fade' });
    });

    test('rejects missing documents and leaves an empty stage without files/', async () => {
        const collector = new ArchiveFileCollector();
        expect(await collector.addDocument(null)).toBe(false);
        expect(await collector.addDocument('/missing.ows')).toBe(false);
        expect(await collector.addFile('/missing.mp4', 'video')).toBe(false);
        expect(
            await stageArchiveFiles(collector, '/tmp/stage', ['item.json']),
        ).toEqual({
            archiveFiles: [],
            archiveEntries: ['manifest.json', 'item.json'],
        });
        expect(h.directories).toEqual([]);
    });
});

describe('import collision and restoration', () => {
    test('compares bytes before reusing media and handles unreadable files', async () => {
        h.files.set('/a.mp4', 'same');
        h.files.set('/b.mp4', 'same');
        h.files.set('/c.mp4', 'other');
        h.files.set('/long.mp4', 'longer');
        expect(await checkIsSameFileContent('/a.mp4', '/b.mp4')).toBe(true);
        expect(await checkIsSameFileContent('/a.mp4', '/c.mp4')).toBe(false);
        expect(await checkIsSameFileContent('/a.mp4', '/long.mp4')).toBe(false);
        expect(await checkIsSameFileContent('/a.mp4', '/missing')).toBe(false);
        expect(h.errors).toHaveLength(1);
        expect(
            getImportCollisionPolicy(dirSourceSettingNames.APP_DOCUMENT),
        ).toBe('always-new');
        expect(
            getImportCollisionPolicy(dirSourceSettingNames.BIBLE_PRESENT),
        ).toBe('merge-items');
        expect(
            getImportCollisionPolicy(dirSourceSettingNames.BACKGROUND_VIDEO),
        ).toBe('reuse-if-same');
        expect(
            await findExistingLocalFile('reuse-if-same', '/b.mp4', '/a.mp4'),
        ).toBe('/a.mp4');
        expect(
            await findExistingLocalFile('always-new', '/b.mp4', '/a.mp4'),
        ).toBeNull();
    });

    test('merges new Bible references while preserving local entries and ids', async () => {
        const local = '/bibles/list.json';
        const archived = '/tmp/extract/files/list.json';
        const originalItem = {
            id: 5,
            bibleKey: 'KJV',
            target: {
                bookKey: 'Gen',
                chapter: 1,
                verseStart: 1,
                verseEnd: 1,
            },
            metadata: { color: 'blue' },
        };
        const newItem = {
            id: 1,
            bibleKey: 'KJV',
            target: {
                bookKey: 'Gen',
                chapter: 1,
                verseStart: 2,
                verseEnd: 2,
            },
            metadata: { color: 'red' },
        };
        h.files.set(local, JSON.stringify({ items: [originalItem] }));
        h.files.set(
            archived,
            JSON.stringify({ items: [originalItem, newItem] }),
        );
        expect(
            await findExistingLocalFile('merge-items', archived, local),
        ).toBe(local);
        expect(JSON.parse(h.files.get(local)!).items).toEqual([
            originalItem,
            { ...newItem, id: 6 },
        ]);
        expect(h.updates).toEqual([local]);
        expect(
            await findExistingLocalFile('merge-items', archived, local),
        ).toBe(local);
        expect(h.updates).toEqual([local]);
        h.files.set(archived, '{bad json');
        expect(
            await findExistingLocalFile('merge-items', archived, local),
        ).toBeNull();
    });

    test('merges a cross-chapter passage as its own entry, once', async () => {
        const local = '/bibles/cross.json';
        const archived = '/tmp/extract/files/cross.json';
        const singleItem = {
            id: 3,
            bibleKey: 'KJV',
            target: { bookKey: 'JHN', chapter: 1, verseStart: 2, verseEnd: 4 },
            metadata: {},
        };
        const crossItem = {
            id: 1,
            bibleKey: 'KJV',
            target: {
                bookKey: 'JHN',
                chapter: 1,
                verseStart: 2,
                verseEnd: 4,
                chapterEnd: 3,
            },
            metadata: {},
        };
        h.files.set(local, JSON.stringify({ items: [singleItem] }));
        h.files.set(
            archived,
            JSON.stringify({
                items: [
                    // JHN 1:2-4 with a same-chapter `chapterEnd` IS JHN 1:2-4.
                    {
                        ...singleItem,
                        target: { ...singleItem.target, chapterEnd: 1 },
                    },
                    crossItem,
                    { ...crossItem, id: 2 },
                    // JHN 1:2-2:4 is another passage again.
                    {
                        ...crossItem,
                        id: 4,
                        target: { ...crossItem.target, chapterEnd: 2 },
                    },
                ],
            }),
        );
        expect(
            await findExistingLocalFile('merge-items', archived, local),
        ).toBe(local);
        const items = JSON.parse(h.files.get(local)!).items;
        expect(items.map(({ id }: any) => id)).toEqual([3, 4, 5]);
        expect(items[1].target).toEqual(crossItem.target);
        expect(items[2].target.chapterEnd).toBe(2);
    });

    test('rewrites imported canvas paths and restores the two sidecars', async () => {
        const documentPath = '/documents/song.ows';
        h.files.set(
            documentPath,
            JSON.stringify({
                items: [
                    {
                        canvasItems: [
                            { type: 'video', filePath: '/old/clip.mp4' },
                            { type: 'audio', filePath: '/old/song.mp3' },
                        ],
                    },
                ],
            }),
        );
        const pathMap = new Map([
            ['/old/doc.ows', documentPath],
            ['/old/clip.mp4', '/media/clip.mp4'],
        ]);
        await applyImportedCanvasMedia([documentPath], pathMap);
        const canvasItems = JSON.parse(h.files.get(documentPath)!).items[0]
            .canvasItems;
        expect(canvasItems[0].filePath).toBe('/media/clip.mp4');
        expect(canvasItems[1].filePath).toBe('/old/song.mp3');
        expect(h.updates).toEqual([documentPath]);
        await applyImportedCanvasMedia([documentPath], pathMap);
        expect(h.updates).toEqual([documentPath]);

        h.files.set(
            '/tmp/extract/files/bg.json',
            JSON.stringify({
                first: {
                    type: DragTypeEnum.BACKGROUND_IMAGE,
                    item: '/old/bg.png',
                },
            }),
        );
        h.files.set(
            '/tmp/extract/files/transition.json',
            JSON.stringify({
                preview: 'zoom',
                bad: 'bounce',
            }),
        );
        pathMap.set('/old/bg.png', '/media/bg.png');
        const backgrounds = [
            {
                documentOriginalPath: '/old/doc.ows',
                archivePath: 'files/bg.json',
            },
        ];
        const transitions = [
            {
                documentOriginalPath: '/old/doc.ows',
                archivePath: 'files/transition.json',
            },
        ];
        await importBackgroundMetas('/tmp/extract', backgrounds, pathMap);
        await importTransitionMetas('/tmp/extract', transitions, pathMap);
        expect(JSON.parse(h.files.get(`${documentPath}.bg.json`)!)).toEqual({
            first: { type: DragTypeEnum.BACKGROUND_IMAGE, item: 'bg.png' },
        });
        expect(
            JSON.parse(h.files.get(`${documentPath}.transition.json`)!),
        ).toEqual({
            preview: 'zoom',
        });
        expect(h.updates).toEqual([
            documentPath,
            `${documentPath}.bg.json`,
            `${documentPath}.transition.json`,
        ]);
        await importBackgroundMetas('/tmp/extract', backgrounds, pathMap);
        await importTransitionMetas('/tmp/extract', transitions, pathMap);
        expect(h.updates).toHaveLength(3);
    });
});

describe('collection edges', () => {
    test('a document with no sidecars or canvas media brings only itself', async () => {
        // A lyric is not a canvas document: it is never read for media.
        h.files.set('/docs/hymn.owl', 'lyric text');
        h.files.set('/docs/empty.ows', JSON.stringify({ title: 'no items' }));
        h.files.set(
            '/docs/plain.ows',
            JSON.stringify({ items: [{ id: 1 }, null, { canvasItems: 'x' }] }),
        );
        const collector = new ArchiveFileCollector();
        for (const path of [
            '/docs/hymn.owl',
            '/docs/empty.ows',
            '/docs/plain.ows',
        ]) {
            expect(await collector.addDocument(path)).toBe(true);
        }
        expect([...collector.entryByOriginalPath.keys()]).toEqual([
            '/docs/hymn.owl',
            '/docs/empty.ows',
            '/docs/plain.ows',
        ]);
        expect(collector.backgroundMetas).toEqual([]);
        expect(collector.transitionMetas).toEqual([]);
        expect(collector.extraContentByArchivePath.size).toBe(0);
        expect(h.errors).toEqual([]);
    });

    test('skips an empty or invalid sidecar, and a background whose media is gone', async () => {
        h.files.set('/docs/a.ows', JSON.stringify({ items: [] }));
        h.files.set('/docs/a.ows.bg.json', '{}');
        h.files.set(
            '/docs/a.ows.transition.json',
            JSON.stringify({ preview: 'bounce' }),
        );
        h.files.set('/docs/b.ows', JSON.stringify({ items: [] }));
        h.files.set(
            '/docs/b.ows.bg.json',
            JSON.stringify({
                gone: {
                    type: DragTypeEnum.BACKGROUND_VIDEO,
                    item: '/media/gone.mp4',
                },
                here: {
                    type: DragTypeEnum.BACKGROUND_IMAGE,
                    item: '/media/here.png',
                },
            }),
        );
        h.files.set('/media/here.png', 'png');
        const collector = new ArchiveFileCollector();
        await collector.addDocument('/docs/a.ows');
        await collector.addDocument('/docs/b.ows');
        expect([...collector.entryByOriginalPath.keys()]).toEqual([
            '/docs/a.ows',
            '/docs/b.ows',
            '/media/here.png',
        ]);
        expect(collector.transitionMetas).toEqual([]);
        expect(collector.backgroundMetas).toEqual([
            {
                documentOriginalPath: '/docs/b.ows',
                archivePath: expect.stringMatching(
                    /^files\/\d{3}-b\.ows\.bg\.json$/,
                ),
            },
        ]);
        const sidecar = JSON.parse(
            collector.extraContentByArchivePath.get(
                collector.backgroundMetas[0].archivePath,
            )!,
        );
        // The missing clip keeps its original path; nothing was bundled for it.
        expect(sidecar.gone.item).toBe('/media/gone.mp4');
        expect(sidecar.here.item).toBe('/media/here.png');
    });

    test('an unreadable canvas document is logged and left alone on import', async () => {
        await applyImportedCanvasMedia(
            ['/docs/missing.ows'],
            new Map([['/old/a.mp4', '/media/a.mp4']]),
        );
        expect(h.errors).toEqual([new Error('Missing /docs/missing.ows')]);
        expect(h.updates).toEqual([]);
        expect(h.files.has('/docs/missing.ows')).toBe(false);
    });

    test('a bible list that cannot be read is written as a new file instead', async () => {
        const local = '/bibles/list.json';
        h.files.set(local, JSON.stringify({ items: [] }));
        expect(
            await findExistingLocalFile(
                'merge-items',
                '/tmp/extract/files/gone.json',
                local,
            ),
        ).toBeNull();
        expect(h.errors).toEqual([
            new Error('Missing /tmp/extract/files/gone.json'),
        ]);
        expect(h.files.get(local)).toBe(JSON.stringify({ items: [] }));
        expect(h.updates).toEqual([]);
    });
});

describe('importArchiveFiles edges', () => {
    const videoEntry = {
        originalPath: '/old/data/videos/clip.mp4',
        archivePath: 'files/001-clip.mp4',
        kind: 'video' as const,
    };

    test('stops at an entry the archive does not hold', async () => {
        await expect(
            importArchiveFiles(
                '/tmp/extract',
                [videoEntry],
                new Map([['video', '/church/data/videos']]),
            ),
        ).rejects.toThrow('Archive file not found: files/001-clip.mp4');
        expect(h.copied).toEqual([]);
    });

    test('reuses an identical local copy and keys it by its rebased path too', async () => {
        h.files.set('/tmp/extract/files/001-clip.mp4', 'same-bytes');
        h.files.set('/church/data/videos/clip.mp4', 'same-bytes');
        const { localFilePathByOriginalPath, writtenItemFilePaths } =
            await importArchiveFiles(
                '/tmp/extract',
                [videoEntry],
                new Map([['video', '/church/data/videos']]),
                '/old/data',
            );
        expect(h.copied).toEqual([]);
        expect(writtenItemFilePaths).toEqual([]);
        expect(Object.fromEntries(localFilePathByOriginalPath)).toEqual({
            '/old/data/videos/clip.mp4': '/church/data/videos/clip.mp4',
            '/church/data/videos/clip.mp4': '/church/data/videos/clip.mp4',
        });
    });

    test('fails when a file cannot be copied in', async () => {
        h.files.set('/tmp/extract/files/001-clip.mp4', 'bytes');
        h.failCopy = true;
        await expect(
            importArchiveFiles(
                '/tmp/extract',
                [videoEntry],
                new Map([['video', '/church/data/videos']]),
            ),
        ).rejects.toThrow('Unable to import file: files/001-clip.mp4');
    });
});

describe('sidecars that cannot be restored', () => {
    const toPathMap = () => {
        return new Map([
            ['/old/a.ows', '/documents/a.ows'],
            ['/old/b.ows', '/documents/b.ows'],
            ['/old/c.ows', '/documents/c.ows'],
            ['/old/bg.png', '/media/bg.png'],
        ]);
    };

    test('backgrounds: skips what was not imported, not bundled or not readable', async () => {
        h.files.set('/tmp/extract/files/b-bg.json', '{bad json');
        h.files.set(
            '/tmp/extract/files/c-bg.json',
            JSON.stringify({
                unknown: { type: 'unknown', item: '/old/x.png' },
                notBundled: {
                    type: DragTypeEnum.BACKGROUND_IMAGE,
                    item: '/old/not-bundled.png',
                },
                bundled: {
                    type: DragTypeEnum.BACKGROUND_IMAGE,
                    item: '/old/bg.png',
                },
            }),
        );
        await importBackgroundMetas(
            '/tmp/extract',
            [
                {
                    documentOriginalPath: '/old/not-imported.ows',
                    archivePath: 'files/x-bg.json',
                },
                {
                    documentOriginalPath: '/old/a.ows',
                    archivePath: 'files/a-bg.json',
                },
                {
                    documentOriginalPath: '/old/b.ows',
                    archivePath: 'files/b-bg.json',
                },
                {
                    documentOriginalPath: '/old/c.ows',
                    archivePath: 'files/c-bg.json',
                },
            ],
            toPathMap(),
        );
        expect(h.files.has('/documents/a.ows.bg.json')).toBe(false);
        expect(h.files.has('/documents/b.ows.bg.json')).toBe(false);
        expect(JSON.parse(h.files.get('/documents/c.ows.bg.json')!)).toEqual({
            unknown: { type: 'unknown', item: '/old/x.png' },
            notBundled: {
                type: DragTypeEnum.BACKGROUND_IMAGE,
                item: '/old/not-bundled.png',
            },
            bundled: { type: DragTypeEnum.BACKGROUND_IMAGE, item: 'bg.png' },
        });
        expect(h.updates).toEqual(['/documents/c.ows.bg.json']);
    });

    test('transitions: skips what was not imported, not bundled or not valid', async () => {
        h.files.set(
            '/tmp/extract/files/b-t.json',
            JSON.stringify({ preview: 'bounce' }),
        );
        await importTransitionMetas(
            '/tmp/extract',
            [
                {
                    documentOriginalPath: '/old/not-imported.ows',
                    archivePath: 'files/x-t.json',
                },
                {
                    documentOriginalPath: '/old/a.ows',
                    archivePath: 'files/a-t.json',
                },
                {
                    documentOriginalPath: '/old/b.ows',
                    archivePath: 'files/b-t.json',
                },
            ],
            toPathMap(),
        );
        expect(h.files.has('/documents/a.ows.transition.json')).toBe(false);
        expect(h.files.has('/documents/b.ows.transition.json')).toBe(false);
        expect(h.updates).toEqual([]);
    });
});
