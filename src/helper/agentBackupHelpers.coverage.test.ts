import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        existing: new Set<string>(),
        texts: new Map<string, string>(),
        listed: [] as string[],
        mimeFiles: [] as string[],
    },
    mocks: {
        handleError: vi.fn(),
        fsCreateDir: vi.fn(),
        fsDeleteFile: vi.fn(),
        fsWriteFile: vi.fn(),
        trashAllMaterialFiles: vi.fn(),
        renameAllMaterialFiles: vi.fn(),
        deleteMetaDataFile: vi.fn(),
        deleteTransitionMetaDataFile: vi.fn(),
        moveFilePath: vi.fn(),
        preDelete: vi.fn(),
        fireUpdateEvent: vi.fn(),
    },
}));

vi.mock('./constants', () => ({
    appManagedDataDirNames: { AGENT_BACKUP: 'agent-backups' },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: async (path: string) => state.existing.has(path),
    fsCheckFileExist: async (path: string) => state.existing.has(path),
    fsCreateDir: mocks.fsCreateDir,
    fsDeleteFile: mocks.fsDeleteFile,
    fsListFiles: async () => state.listed,
    fsListFilesWithMimetype: async () => state.mimeFiles,
    fsReadFile: async (path: string) => state.texts.get(path) ?? '',
    fsWriteFile: mocks.fsWriteFile,
    pathJoin: (...parts: string[]) => {
        const joined = parts.join('/').replace(/\/{2,}/g, '/');
        return joined.replace(/\/[^/]+\/\.\.\//g, '/');
    },
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/data' },
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (path: string) => ({
            name: path.split('/').at(-1)?.split('.')[0],
            trash: async () => state.existing.delete(path),
            renameTo: async (newName: string) => {
                const renamedPath = `${path.slice(0, path.lastIndexOf('/') + 1)}${newName}${path.slice(path.lastIndexOf('.'))}`;
                state.existing.delete(path);
                state.existing.add(renamedPath);
                return {
                    filePath: renamedPath,
                    fireUpdateEvent: mocks.fireUpdateEvent,
                };
            },
            writeFileData: async (text: string) => {
                state.existing.add(path);
                state.texts.set(path, text);
                return true;
            },
            fireUpdateEvent: mocks.fireUpdateEvent,
        }),
    },
}));
vi.mock('../server/appHelpers', () => ({
    trashAllMaterialFiles: mocks.trashAllMaterialFiles,
    renameAllMaterialFiles: mocks.renameAllMaterialFiles,
}));
vi.mock('../others/SlideTransitionManager', () => ({
    slideTransitionManager: {
        deleteMetaDataFile: mocks.deleteTransitionMetaDataFile,
    },
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: { deleteMetaDataFile: mocks.deleteMetaDataFile },
}));
vi.mock('../editing-manager/EditingHistoryManager', () => ({
    default: { moveFilePath: mocks.moveFilePath },
}));

import {
    AGENT_SIDECAR_EXTENSIONS,
    findAgentFreeName,
    genNoBackupReason,
    genUndoField,
    getAgentBackupDirPath,
    handleAgentUndoRequest,
    listAgentBackups,
    listAgentFiles,
    renameAgentFile,
    runWithAgentBackup,
    saveAgentBackup,
    snapshotAgentFile,
    snapshotAgentSidecars,
    trashAgentFile,
    toAgentFilePath,
    undoAgentBackup,
} from './agentBackupHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.existing.clear();
    state.texts.clear();
    state.listed = [];
    state.mimeFiles = [];
    mocks.fsWriteFile.mockImplementation(async (path: string, text: string) => {
        state.existing.add(path);
        state.texts.set(path, text);
    });
});

describe('agent backup public contracts', () => {
    test('describes backup failures, undo metadata, and the backup directory', async () => {
        expect(genNoBackupReason(new Error('disk full'))).toContain(
            'disk full',
        );
        expect(genNoBackupReason('offline')).toContain('offline');
        expect(genUndoField({ id: '20260101-000000000-aaaa' } as any)).toEqual({
            undoId: '20260101-000000000-aaaa',
            undo: 'owa_undo with id "20260101-000000000-aaaa" puts this back.',
        });
        expect(await getAgentBackupDirPath()).toBe('/data/agent-backups');
        expect(AGENT_SIDECAR_EXTENSIONS).toEqual([
            '.bg.json',
            '.preview.bg.json',
            '.transition.json',
        ]);
    });

    test('snapshots missing and existing files and only existing sidecars', async () => {
        expect(await snapshotAgentFile('/a.ows')).toEqual({
            type: 'file',
            filePath: '/a.ows',
            text: null,
        });
        state.existing.add('/a.ows');
        state.texts.set('/a.ows', 'content');
        expect(await snapshotAgentFile('/a.ows', 'slide')).toEqual({
            type: 'file',
            filePath: '/a.ows',
            text: 'content',
            kind: 'slide',
        });
        state.existing.add('/a.ows.bg.json');
        state.texts.set('/a.ows.bg.json', 'background');
        expect(await snapshotAgentSidecars('/a.ows')).toEqual([
            { type: 'file', filePath: '/a.ows.bg.json', text: 'background' },
        ]);
    });

    test('keeps generated file paths inside the named directory', () => {
        expect(toAgentFilePath('/docs', 'Song', 'owl')).toBe('/docs/Song.owl');
        expect(toAgentFilePath('/docs/', 'Song', 'owl')).toBe('/docs/Song.owl');
        expect(toAgentFilePath('/docs', '../escape', 'owl')).toBeNull();
    });

    test('finds the first unused numbered name and uses a bounded fallback', async () => {
        state.existing.add('/docs/Song (2).owl');
        expect(await findAgentFreeName('/docs', 'Song', 'owl')).toBe(
            'Song (3)',
        );
        for (let index = 2; index < 100; index += 1)
            state.existing.add(`/docs/Full (${index}).owl`);
        expect(await findAgentFreeName('/docs', 'Full', 'owl')).toMatch(
            /^Full \([a-z0-9]+\)$/,
        );
    });

    test('lists files with Default first and the remainder alphabetically', async () => {
        state.mimeFiles = ['/b/Zeal.owb', '/b/Default.owb', '/b/Alpha.owb'];
        expect(await listAgentFiles('/b', 'bible', 'Default')).toEqual([
            { filePath: '/b/Default.owb', name: 'Default' },
            { filePath: '/b/Alpha.owb', name: 'Alpha' },
            { filePath: '/b/Zeal.owb', name: 'Zeal' },
        ]);
    });

    test('lists readable backup metadata and rejects invalid or missing undo targets', async () => {
        const dir = '/data/agent-backups';
        state.existing.add(dir);
        const id = '20260101-000000000-aaaa';
        state.listed = [`${id}.meta.json`, 'junk.txt'];
        state.existing.add(`${dir}/${id}.meta.json`);
        state.texts.set(
            `${dir}/${id}.meta.json`,
            JSON.stringify({
                id,
                at: '2026-01-01T00:00:00.000Z',
                summary: 'Changed song',
                filePaths: ['/song'],
                undoneAt: 'x',
                undoOf: 'y',
                failedAt: 'z',
            }),
        );
        const listed = await listAgentBackups();
        expect(listed.changes[0]).toMatchObject({
            id,
            isUndone: true,
            isUndo: true,
            didNotFinish: true,
        });
        await expect(undoAgentBackup('bad')).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('not the id'),
        });
        state.listed = [];
        await expect(undoAgentBackup()).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('no change left'),
        });
    });

    test('dispatches list and undo requests and contains thrown errors', async () => {
        await expect(
            handleAgentUndoRequest({ action: 'wat' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Unknown action'),
        });
        await expect(
            handleAgentUndoRequest({ action: 'list' }),
        ).resolves.toHaveProperty('changes');
        await expect(
            handleAgentUndoRequest({ action: 'undo', id: '   ' }),
        ).resolves.toMatchObject({ isError: true });
    });

    test('persists data before visible metadata and creates the backup directory', async () => {
        const meta = await saveAgentBackup('Changed a song', [
            { type: 'file', filePath: '/songs/One.owl', text: 'old song' },
        ]);

        expect(mocks.fsCreateDir).toHaveBeenCalledWith('/data/agent-backups');
        expect(mocks.fsWriteFile).toHaveBeenCalledTimes(2);
        const [dataPath] = mocks.fsWriteFile.mock.calls[0];
        const [metaPath] = mocks.fsWriteFile.mock.calls[1];
        expect(dataPath).toContain('.data.json');
        expect(metaPath).toContain('.meta.json');
        expect(meta.summary).toBe('Changed a song');
        expect(meta.filePaths).toEqual(['/songs/One.owl']);
        expect(JSON.parse(state.texts.get(dataPath) ?? '')).toMatchObject({
            id: meta.id,
            restores: [{ filePath: '/songs/One.owl', text: 'old song' }],
        });
    });

    test('does not run a change when persisting its backup fails', async () => {
        mocks.fsWriteFile.mockRejectedValueOnce(new Error('disk full'));
        const change = vi.fn(async () => 'changed');

        await expect(runWithAgentBackup('Change', [], change)).rejects.toThrow(
            'Nothing was changed',
        );
        expect(change).not.toHaveBeenCalled();
    });

    test('marks a saved backup unfinished when its following change fails', async () => {
        const change = vi.fn(async () => {
            throw new Error('write failed');
        });

        await expect(runWithAgentBackup('Change', [], change)).rejects.toThrow(
            'write failed',
        );
        const metaWrite = mocks.fsWriteFile.mock.calls.at(-1);
        expect(metaWrite?.[0]).toContain('.meta.json');
        expect(JSON.parse(metaWrite?.[1] ?? '')).toHaveProperty('failedAt');
    });

    test('moves a file to trash before cleaning its material sidecars', async () => {
        state.existing.add('/songs/One.owl');
        await trashAgentFile('/songs/One.owl');

        expect(mocks.trashAllMaterialFiles).toHaveBeenCalledOnce();
        expect(mocks.deleteMetaDataFile).toHaveBeenCalledWith('/songs/One.owl');
        expect(mocks.deleteTransitionMetaDataFile).toHaveBeenCalledWith(
            '/songs/One.owl',
        );
    });

    test('refuses a delete that the OS trash leaves in place', async () => {
        state.existing.add('/songs/One.owl');
        const fileSource = await import('./FileSource');
        vi.spyOn(fileSource.default, 'getInstance').mockReturnValueOnce({
            name: 'One',
            trash: vi.fn(),
        } as any);

        await expect(trashAgentFile('/songs/One.owl')).rejects.toThrow(
            'could not be moved to the trash',
        );
        expect(mocks.trashAllMaterialFiles).not.toHaveBeenCalled();
    });

    test('renames a document history and material files before announcing an update', async () => {
        state.existing.add('/songs/One.owl');
        await expect(
            renameAgentFile('/songs/One.owl', 'Two', 'lyric'),
        ).resolves.toBe('/songs/Two.owl');

        expect(mocks.moveFilePath).toHaveBeenCalledWith(
            '/songs/One.owl',
            '/songs/Two.owl',
        );
        expect(mocks.renameAllMaterialFiles).toHaveBeenCalledOnce();
        expect(mocks.fireUpdateEvent).toHaveBeenCalledOnce();
    });
});
