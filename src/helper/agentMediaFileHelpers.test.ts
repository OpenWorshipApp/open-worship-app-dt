import { beforeEach, describe, expect, test, vi } from 'vitest';

// The worker behind `owa_media_file`, driven against folders that live in
// memory: what each action asks for, what it refuses, and that a clip is
// copied beside its backup (a `blob` restore) before it goes to the trash.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dirs: {
            'select-dir-image-bg': '/images',
            'select-dir-video-bg': '/videos',
            'select-dir-audio-bg': '/audios',
            'select-dir-web-bg': '/webs',
            'select-dir-app-document': '/documents',
        } as Record<string, string | null>,
        files: {
            image: ['/images/sunrise.jpg', '/images/cross.png'],
            video: ['/videos/bg.mp4'],
            audio: [],
            web: ['/webs/clock.html'],
            appDocument: ['/documents/Welcome.ows'],
            lyric: ['/documents/Amazing Grace.owl'],
            pdf: ['/documents/Order.pdf'],
            pptx: [],
            docx: [],
        } as Record<string, string[]>,
        disk: {
            '/webs/clock.html': '<html>clock</html>',
            '/downloads/new.jpg': 'JPEGBYTES',
            '/downloads/notes.txt': 'words',
            '/downloads/Sermon.pptx': 'PPTX',
        } as Record<string, string>,
        sizes: {} as Record<string, number>,
    },
    mocks: {
        handleError: vi.fn(),
        runWithAgentBackup: vi.fn(),
        renameAgentFile: vi.fn(),
        trashAgentFile: vi.fn(),
        snapshotAgentSidecars: vi.fn(),
        fsCloneFile: vi.fn(),
        fsWriteFile: vi.fn(),
        writeFileData: vi.fn(),
        fireUpdateEvent: vi.fn(),
        stat: vi.fn(),
    },
}));

const fileExists = (filePath: string) =>
    Object.values(state.files).some((list) => list.includes(filePath)) ||
    Object.hasOwn(state.disk, filePath);

vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (settingName: string) =>
            state.dirs[settingName] ?? null,
    },
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: {
        BACKGROUND_IMAGE: 'select-dir-image-bg',
        BACKGROUND_VIDEO: 'select-dir-video-bg',
        BACKGROUND_AUDIO: 'select-dir-audio-bg',
        BACKGROUND_WEB: 'select-dir-web-bg',
        APP_DOCUMENT: 'select-dir-app-document',
    },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../../tools/owa-devtools-mcp/agentFileName.mjs', () => ({
    checkAgentFileName: (value: unknown) =>
        typeof value === 'string' &&
        value.trim() !== '' &&
        !/[\\/]|\.\./.test(value)
            ? null
            : 'A name is required.',
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) => fileExists(filePath),
    fsCloneFile: (...args: any[]) => mocks.fsCloneFile(...args),
    fsGetFileStamp: async (filePath: string) => ({
        size: state.sizes[filePath] ?? 10,
        modifiedAt: 0,
    }),
    fsReadFile: async (filePath: string) => state.disk[filePath] ?? '',
    fsWriteFile: (...args: any[]) => mocks.fsWriteFile(...args),
    getFileFullName: (filePath: string) => filePath.split('/').at(-1),
    getMimetypeExtensions: (mimetypeName: string) =>
        ({
            image: ['jpg', 'png'],
            video: ['mp4', 'webm'],
            audio: ['mp3'],
            web: ['html'],
            appDocument: ['ows'],
            lyric: ['owl'],
            pdf: ['pdf'],
            pptx: ['pptx'],
            docx: ['docx'],
        })[mimetypeName] ?? [],
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            fullName: filePath.split('/').at(-1),
            genNextFilePath: async () =>
                filePath.replace(/(\.[^.]+)$/, ' (2)$1'),
            writeFileData: (...args: any[]) => mocks.writeFileData(...args),
            fireUpdateEvent: mocks.fireUpdateEvent,
        }),
    },
}));
vi.mock('./agentBackupHelpers', () => ({
    AGENT_DOCUMENT_MIMETYPE_NAMES: [
        'appDocument',
        'lyric',
        'pdf',
        'pptx',
        'docx',
    ],
    NoBackupError: class NoBackupError extends Error {},
    genBlobTooBigReason: (fileName: string, size: number) =>
        `"${fileName}" is ${Math.round(size / 1048576)} MB, too big for the copy an undo needs`,
    genNoBackupReason: (error: unknown) => String(error),
    genUndoField: () => ({ undoId: 'backup-id' }),
    listAgentFiles: async (_dir: string, mimetypeName: string) =>
        (state.files[mimetypeName] ?? []).map((filePath: string) => ({
            filePath,
            name: filePath
                .split('/')
                .at(-1)
                ?.replace(/\.[^.]+$/, ''),
            fullName: filePath.split('/').at(-1),
        })),
    toAgentFilePath: (dir: string, name: string) => `${dir}/${name}`,
    renameAgentFile: (...args: any[]) => mocks.renameAgentFile(...args),
    runWithAgentBackup: (...args: any[]) => mocks.runWithAgentBackup(...args),
    snapshotAgentFile: async (filePath: string) => ({
        type: 'file',
        filePath,
        text: state.disk[filePath] ?? null,
    }),
    snapshotAgentSidecars: (...args: any[]) =>
        mocks.snapshotAgentSidecars(...args),
    trashAgentFile: (...args: any[]) => mocks.trashAgentFile(...args),
}));
vi.mock('./agentBackupPlanHelpers', () => ({
    AGENT_BACKUP_MAX_BLOB_BYTES: 1000,
}));

import { handleAgentMediaFileRequest } from './agentMediaFileHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.dirs['select-dir-video-bg'] = '/videos';
    state.files.image = ['/images/sunrise.jpg', '/images/cross.png'];
    state.files.video = ['/videos/bg.mp4'];
    state.files.web = ['/webs/clock.html'];
    state.sizes = {};
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => ({ meta: { id: 'backup-id' }, value: await change() }),
    );
    mocks.snapshotAgentSidecars.mockResolvedValue([]);
    mocks.renameAgentFile.mockResolvedValue('/videos/renamed.mp4');
    mocks.writeFileData.mockResolvedValue(true);
    mocks.fsCloneFile.mockImplementation(async (_from: string, to: string) => {
        state.disk[to] = 'copied';
    });
    mocks.fsWriteFile.mockImplementation(async (to: string, text: string) => {
        state.disk[to] = text;
    });
});

describe('owa_media_file worker', () => {
    test('lists a kind by full name and reads a web page', async () => {
        await expect(
            handleAgentMediaFileRequest({ action: 'list', kind: 'image' }),
        ).resolves.toEqual({
            kind: 'image',
            folder: '/images',
            count: 2,
            names: ['sunrise.jpg', 'cross.png'],
            isTruncated: false,
        });
        await expect(
            handleAgentMediaFileRequest({
                action: 'info',
                kind: 'web',
                name: 'clock.html',
            }),
        ).resolves.toMatchObject({
            text: '<html>clock</html>',
            characters: 18,
        });
        await expect(
            handleAgentMediaFileRequest({ action: 'list', kind: 'song' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Unknown kind'),
        });
        state.dirs['select-dir-video-bg'] = null;
        await expect(
            handleAgentMediaFileRequest({ action: 'list', kind: 'video' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('No Background Videos folder'),
        });
    });

    test('trashes a clip only after copying it beside the backup', async () => {
        await expect(
            handleAgentMediaFileRequest({
                action: 'delete',
                kind: 'video',
                name: 'bg.mp4',
            }),
        ).resolves.toMatchObject({ deleted: 'bg.mp4', isInTrash: true });
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            {
                type: 'blob',
                filePath: '/videos/bg.mp4',
                sourcePath: '/videos/bg.mp4',
            },
        ]);
        expect(mocks.trashAgentFile).toHaveBeenCalledWith('/videos/bg.mp4');
        // ...and a web page as text, the ordinary way.
        await expect(
            handleAgentMediaFileRequest({
                action: 'delete',
                kind: 'web',
                name: 'clock.html',
            }),
        ).resolves.toMatchObject({ deleted: 'clock.html' });
        expect(mocks.runWithAgentBackup.mock.calls[1][1]).toEqual([
            {
                type: 'file',
                filePath: '/webs/clock.html',
                text: '<html>clock</html>',
            },
        ]);
    });

    test('refuses to trash a clip too big to copy, naming the Recycle Bin route', async () => {
        state.sizes['/videos/bg.mp4'] = 5000;
        await expect(
            handleAgentMediaFileRequest({
                action: 'delete',
                kind: 'video',
                name: 'bg.mp4',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('Recycle Bin'),
        });
        expect(mocks.trashAgentFile).not.toHaveBeenCalled();
    });

    test('renames keeping the extension, and refuses a changed one', async () => {
        await expect(
            handleAgentMediaFileRequest({
                action: 'rename',
                kind: 'video',
                name: 'bg.mp4',
                newName: 'intro',
            }),
        ).resolves.toMatchObject({
            renamedFrom: 'bg.mp4',
            renamedTo: 'intro.mp4',
        });
        expect(mocks.renameAgentFile).toHaveBeenCalledWith(
            '/videos/bg.mp4',
            'intro',
        );
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            { type: 'rename', from: '/videos/bg.mp4', to: '/videos/intro.mp4' },
        ]);
        await expect(
            handleAgentMediaFileRequest({
                action: 'rename',
                kind: 'video',
                name: 'bg.mp4',
                newName: 'intro.webm',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('extension'),
        });
        await expect(
            handleAgentMediaFileRequest({
                action: 'rename',
                kind: 'image',
                name: 'nowhere.jpg',
                newName: 'x',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('"sunrise.jpg", "cross.png"'),
        });
    });

    test('imports a file of the kind from the disk, never over an existing one', async () => {
        await expect(
            handleAgentMediaFileRequest({
                action: 'import',
                kind: 'image',
                path: '/downloads/new.jpg',
            }),
        ).resolves.toMatchObject({
            imported: 'new.jpg',
            filePath: '/images/new.jpg',
        });
        expect(mocks.fsCloneFile).toHaveBeenCalledWith(
            '/downloads/new.jpg',
            '/images/new.jpg',
        );
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            { type: 'file', filePath: '/images/new.jpg', text: null },
        ]);
        state.disk['/downloads/sunrise.jpg'] = 'bytes';
        await expect(
            handleAgentMediaFileRequest({
                action: 'import',
                kind: 'image',
                path: '/downloads/sunrise.jpg',
            }),
        ).resolves.toMatchObject({
            imported: 'sunrise (2).jpg',
            renamedTo: 'sunrise (2).jpg',
        });
        await expect(
            handleAgentMediaFileRequest({
                action: 'import',
                kind: 'image',
                path: '/downloads/notes.txt',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('jpg, png'),
        });
        await expect(
            handleAgentMediaFileRequest({
                action: 'import',
                kind: 'image',
                path: '/downloads/missing.jpg',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no file at'),
        });
    });

    test('imports a document from the disk, and leaves songs and slide documents to their tools', async () => {
        await expect(
            handleAgentMediaFileRequest({ action: 'list', kind: 'document' }),
        ).resolves.toMatchObject({
            names: ['Welcome.ows', 'Amazing Grace.owl', 'Order.pdf'],
        });
        await expect(
            handleAgentMediaFileRequest({
                action: 'import',
                kind: 'document',
                path: '/downloads/Sermon.pptx',
            }),
        ).resolves.toMatchObject({
            imported: 'Sermon.pptx',
            filePath: '/documents/Sermon.pptx',
        });
        expect(mocks.fsCloneFile).toHaveBeenCalledWith(
            '/downloads/Sermon.pptx',
            '/documents/Sermon.pptx',
        );
        await expect(
            handleAgentMediaFileRequest({
                action: 'delete',
                kind: 'document',
                name: 'Amazing Grace.owl',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('owa_lyric_file'),
        });
        await expect(
            handleAgentMediaFileRequest({
                action: 'rename',
                kind: 'document',
                name: 'Welcome.ows',
                newName: 'Hello',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('owa_slide_file'),
        });
        expect(mocks.trashAgentFile).not.toHaveBeenCalled();
        expect(mocks.renameAgentFile).not.toHaveBeenCalled();
        // A PDF has no history of its own, so it is this tool's.
        await expect(
            handleAgentMediaFileRequest({
                action: 'delete',
                kind: 'document',
                name: 'Order.pdf',
            }),
        ).resolves.toMatchObject({ deleted: 'Order.pdf' });
        expect(mocks.trashAgentFile).toHaveBeenCalledWith(
            '/documents/Order.pdf',
        );
    });

    test('writes a web page, and refuses to write a clip from text', async () => {
        await expect(
            handleAgentMediaFileRequest({
                action: 'create',
                kind: 'web',
                name: 'welcome',
            }),
        ).resolves.toMatchObject({
            created: 'welcome.html',
            filePath: '/webs/welcome.html',
        });
        expect(mocks.fsWriteFile.mock.calls[0][0]).toBe('/webs/welcome.html');
        expect(mocks.fsWriteFile.mock.calls[0][1]).toContain(
            '<title>welcome</title>',
        );
        await expect(
            handleAgentMediaFileRequest({
                action: 'update',
                kind: 'web',
                name: 'clock.html',
                content: '<html>new</html>',
            }),
        ).resolves.toMatchObject({ updated: 'clock.html' });
        expect(mocks.writeFileData).toHaveBeenCalledWith('<html>new</html>');
        expect(mocks.runWithAgentBackup.mock.calls[1][1]).toEqual([
            {
                type: 'file',
                filePath: '/webs/clock.html',
                text: '<html>clock</html>',
            },
        ]);
        await expect(
            handleAgentMediaFileRequest({
                action: 'create',
                kind: 'video',
                name: 'x',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('"import"'),
        });
        await expect(
            handleAgentMediaFileRequest({
                action: 'create',
                kind: 'web',
                name: 'clock.html',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('already there'),
        });
    });
});
