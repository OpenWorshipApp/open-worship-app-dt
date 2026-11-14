import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        existing: new Set<string>(),
        texts: new Map<string, string>(),
        listed: [] as string[],
        mimeFiles: [] as string[],
        noteHasHistories: false,
        noteEditingData: null as Record<string, unknown> | null,
        flowData: null as Record<string, unknown> | null,
        lyricData: new Map<string, Record<string, unknown>>(),
        slideData: new Map<string, Record<string, unknown>>(),
        listError: null as Error | null,
    },
    mocks: {
        handleError: vi.fn(),
        fsCreateDir: vi.fn(),
        fsCloneFile: vi.fn(),
        fsDeleteFile: vi.fn(),
        fsGetFileStamp: vi.fn(),
        fsWriteFile: vi.fn(),
        trashAllMaterialFiles: vi.fn(),
        renameAllMaterialFiles: vi.fn(),
        deleteMetaDataFile: vi.fn(),
        deleteTransitionMetaDataFile: vi.fn(),
        moveFilePath: vi.fn(),
        preDelete: vi.fn(),
        fireUpdateEvent: vi.fn(),
        deleteHistories: vi.fn(),
        addNoteHistory: vi.fn(),
        notifyNoteHeadChanged: vi.fn(),
        saveFlow: vi.fn(),
        removeFlowSettings: vi.fn(),
        documentRead: vi.fn(),
        lyricPreDelete: vi.fn(),
        slidePreDelete: vi.fn(),
        clearBibleXMLCache: vi.fn(),
        invalidateResourcesScanCache: vi.fn(),
        announceResourcesChanged: vi.fn(),
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
    fsCloneFile: mocks.fsCloneFile,
    fsDeleteFile: mocks.fsDeleteFile,
    fsGetFileStamp: mocks.fsGetFileStamp,
    fsListFiles: async () => {
        if (state.listError !== null) {
            throw state.listError;
        }
        return state.listed;
    },
    fsListFilesWithMimetype: async () => state.mimeFiles,
    fsReadFile: async (path: string) => state.texts.get(path) ?? '',
    fsWriteFile: mocks.fsWriteFile,
    getFileFullName: (path: string) => path.split('/').at(-1),
    pathDirname: (path: string) => path.split('/').slice(0, -1).join('/'),
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
    default: {
        moveFilePath: mocks.moveFilePath,
        getInstance: () => ({
            checkHasHistories: async () => state.noteHasHistories,
            deleteHistories: mocks.deleteHistories,
        }),
    },
}));
// An open note window is told when an undo puts its head back (2026-11-07).
vi.mock('../bible-list/note/noteHeadChangeHelpers', () => ({
    notifyNoteHeadChanged: mocks.notifyNoteHeadChanged,
}));
vi.mock('../bible-list/note/Note', () => ({
    default: {
        fromFilePathEditing: async () =>
            state.noteEditingData === null
                ? null
                : { toJson: () => state.noteEditingData },
        fromJson: (_filePath: string, jsonData: Record<string, unknown>) => ({
            addEditingHistory: async () => {
                state.noteEditingData = jsonData;
                mocks.addNoteHistory(jsonData);
            },
        }),
    },
}));
vi.mock('../presenting-flow/PresentingFlow', () => ({
    default: {
        getInstance: () => ({
            getJsonData: async () => state.flowData,
            setJsonData: async (jsonData: Record<string, unknown>) => {
                state.flowData = jsonData;
            },
            save: mocks.saveFlow,
            preDelete: mocks.preDelete,
        }),
    },
}));
vi.mock('../presenting-flow/presentingFlowHelpers', () => ({
    removePresentingFlowSettings: mocks.removeFlowSettings,
}));
// A song and a slide document each through its OWN class: the two maps are
// apart so a head read or put back through the wrong class shows.
vi.mock('../lyric-list/Lyric', () => ({
    default: {
        getInstance: (filePath: string) => ({
            getJsonData: async () => {
                mocks.documentRead('lyric', filePath);
                return state.lyricData.get(filePath) ?? null;
            },
            setJsonData: async (jsonData: Record<string, unknown>) => {
                state.lyricData.set(filePath, jsonData);
            },
            preDelete: async () => mocks.lyricPreDelete(filePath),
        }),
    },
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        getInstance: (filePath: string) => ({
            getJsonData: async () => {
                mocks.documentRead('slide', filePath);
                return state.slideData.get(filePath) ?? null;
            },
            setJsonData: async (jsonData: Record<string, unknown>) => {
                state.slideData.set(filePath, jsonData);
            },
            preDelete: async () => mocks.slidePreDelete(filePath),
        }),
    },
}));
vi.mock('../setting/bible-setting/bibleXMLHelpers', () => ({
    clearBibleXMLCache: (...args: unknown[]) =>
        mocks.clearBibleXMLCache(...args),
}));
vi.mock('../resources/resourcesScanHelpers', () => ({
    invalidateResourcesScanCache: (...args: unknown[]) =>
        mocks.invalidateResourcesScanCache(...args),
}));
vi.mock('../resources/resourcesChangedEvent', () => ({
    announceResourcesChanged: () => mocks.announceResourcesChanged(),
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
    snapshotAgentEditing,
    snapshotAgentFile,
    snapshotAgentFileForDelete,
    snapshotAgentSidecars,
    trashAgentFile,
    toAgentFilePath,
    undoAgentBackup,
} from './agentBackupHelpers';
import { genAgentBackupId } from './agentBackupPlanHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.existing.clear();
    state.texts.clear();
    state.listed = [];
    state.mimeFiles = [];
    state.noteHasHistories = false;
    state.noteEditingData = null;
    state.flowData = null;
    state.lyricData.clear();
    state.slideData.clear();
    state.listError = null;
    mocks.fsDeleteFile.mockImplementation(async (path: string) => {
        state.existing.delete(path);
        state.texts.delete(path);
    });
    mocks.fsCreateDir.mockImplementation(async (path: string) => {
        state.existing.add(path);
    });
    mocks.fsCloneFile.mockImplementation(async (from: string, to: string) => {
        state.existing.add(to);
        state.texts.set(to, state.texts.get(from) ?? '');
    });
    mocks.fsGetFileStamp.mockImplementation(async (path: string) => {
        return state.existing.has(path)
            ? { size: state.texts.get(path)?.length ?? 0 }
            : null;
    });
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

    test('undo restores overwritten content and keeps the newer version in its own backup', async () => {
        const filePath = '/songs/One.owl';
        state.existing.add(filePath);
        state.texts.set(filePath, 'new song');
        const original = await saveAgentBackup('Changed song', [
            { type: 'file', filePath, text: 'old song' },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Changed song',
            undoId: expect.any(String),
        });
        expect(state.texts.get(filePath)).toBe('old song');
        expect(mocks.fireUpdateEvent).not.toHaveBeenCalled();

        const originalMeta = JSON.parse(
            state.texts.get(`/data/agent-backups/${original.id}.meta.json`) ??
                '',
        );
        expect(originalMeta).toMatchObject({
            undoneAt: expect.any(String),
            undoneBy: expect.any(String),
        });
        const undoData = JSON.parse(
            state.texts.get(
                `/data/agent-backups/${originalMeta.undoneBy}.data.json`,
            ) ?? '',
        );
        expect(undoData.restores).toEqual([
            { type: 'file', filePath, text: 'new song' },
        ]);
        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            reason: expect.stringContaining('already undone'),
        });
    });

    test('undo removes a newly created file through trash and backs it up', async () => {
        const filePath = '/songs/New.owl';
        state.existing.add(filePath);
        state.texts.set(filePath, 'new song');
        const original = await saveAgentBackup('Created song', [
            { type: 'file', filePath, text: null },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup()).resolves.toMatchObject({
            undone: 'Created song',
        });
        expect(state.existing.has(filePath)).toBe(false);
        expect(mocks.trashAllMaterialFiles).toHaveBeenCalledOnce();
        const meta = JSON.parse(
            state.texts.get(`/data/agent-backups/${original.id}.meta.json`) ??
                '',
        );
        const undoData = JSON.parse(
            state.texts.get(`/data/agent-backups/${meta.undoneBy}.data.json`) ??
                '',
        );
        expect(undoData.restores).toEqual([
            { type: 'file', filePath, text: 'new song' },
        ]);
    });

    test('an unwritable restore reports a partial undo and marks its backup unfinished', async () => {
        const filePath = '/songs/One.owl';
        state.existing.add(filePath);
        state.texts.set(filePath, 'new song');
        const original = await saveAgentBackup('Changed song', [
            { type: 'file', filePath, text: 'old song' },
        ]);
        state.listed = [`${original.id}.meta.json`];
        const fileSource = await import('./FileSource');
        vi.spyOn(fileSource.default, 'getInstance').mockReturnValueOnce({
            name: 'One',
            writeFileData: async () => false,
        } as any);

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('could not be written back'),
        });
        expect(state.texts.get(filePath)).toBe('new song');
        const metaWrites = mocks.fsWriteFile.mock.calls.filter(([path]) =>
            String(path).endsWith('.meta.json'),
        );
        expect(JSON.parse(metaWrites.at(-1)?.[1] ?? '')).toHaveProperty(
            'failedAt',
        );
    });

    test('undo moves a renamed document back with its editing history', async () => {
        state.existing.add('/songs/New.owl');
        const original = await saveAgentBackup('Renamed song', [
            {
                type: 'rename',
                from: '/songs/Old.owl',
                to: '/songs/New.owl',
                kind: 'lyric',
            },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Renamed song',
        });
        expect(state.existing.has('/songs/New.owl')).toBe(false);
        expect(state.existing.has('/songs/Old.owl')).toBe(true);
        expect(mocks.moveFilePath).toHaveBeenCalledWith(
            '/songs/New.owl',
            '/songs/Old.owl',
        );
        expect(mocks.renameAllMaterialFiles).toHaveBeenCalledOnce();
        const undoMeta = JSON.parse(
            state.texts.get(`/data/agent-backups/${original.id}.meta.json`) ??
                '',
        );
        const undoData = JSON.parse(
            state.texts.get(
                `/data/agent-backups/${undoMeta.undoneBy}.data.json`,
            ) ?? '',
        );
        expect(undoData.restores).toEqual([
            {
                type: 'rename',
                from: '/songs/New.owl',
                to: '/songs/Old.owl',
                kind: 'lyric',
            },
        ]);
    });

    test('undo refuses a missing backup body before changing the file', async () => {
        const filePath = '/songs/One.owl';
        state.existing.add(filePath);
        state.texts.set(filePath, 'current song');
        const original = await saveAgentBackup('Changed song', [
            { type: 'file', filePath, text: 'old song' },
        ]);
        state.listed = [`${original.id}.meta.json`];
        state.existing.delete(`/data/agent-backups/${original.id}.data.json`);

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('could not be read'),
        });
        expect(state.texts.get(filePath)).toBe('current song');
        expect(mocks.fsWriteFile).toHaveBeenCalledTimes(2);
    });

    test('undo restores a binary file and keeps the version it replaced', async () => {
        const filePath = '/media/Photo.png';
        state.existing.add(filePath);
        state.texts.set(filePath, 'old-binary');
        const original = await saveAgentBackup('Changed photo', [
            { type: 'blob', filePath, sourcePath: filePath },
        ]);
        state.listed = [`${original.id}.meta.json`];
        state.texts.set(filePath, 'new-binary');

        const result = await undoAgentBackup(original.id);
        expect(result).toMatchObject({ undone: 'Changed photo' });
        expect(state.texts.get(filePath)).toBe('old-binary');
        expect(mocks.fireUpdateEvent).toHaveBeenCalledOnce();

        const originalData = JSON.parse(
            state.texts.get(`/data/agent-backups/${original.id}.data.json`) ??
                '',
        );
        expect(originalData.restores[0]).toMatchObject({
            type: 'blob',
            filePath,
            blobName: `${original.id}.blob-0.bin`,
        });
        const undoData = JSON.parse(
            state.texts.get(`/data/agent-backups/${result.undoId}.data.json`) ??
                '',
        );
        expect(
            state.texts.get(
                `/data/agent-backups/${undoData.restores[0].blobName}`,
            ),
        ).toBe('new-binary');
    });

    test('refuses to save a binary backup larger than the copy limit', async () => {
        const filePath = '/media/Huge.mp4';
        state.existing.add(filePath);
        mocks.fsGetFileStamp.mockResolvedValueOnce({
            size: 201 * 1024 * 1024,
        });

        await expect(
            saveAgentBackup('Delete clip', [
                { type: 'blob', filePath, sourcePath: filePath },
            ]),
        ).rejects.toThrow('too big for the copy');
        expect(mocks.fsCloneFile).not.toHaveBeenCalled();
        expect(mocks.fsWriteFile).not.toHaveBeenCalled();
    });

    test('backs up a Bible note editing head only when it has history', async () => {
        const filePath = '/notes/Study.own';
        state.existing.add(filePath);
        state.texts.set(filePath, 'saved note');
        expect(await snapshotAgentEditing('note', filePath)).toBeNull();

        state.noteHasHistories = true;
        state.noteEditingData = { title: 'Unsaved title' };
        state.existing.add(`${filePath}.bg.json`);
        state.texts.set(`${filePath}.bg.json`, 'background');
        expect(await snapshotAgentFileForDelete(filePath, 'note')).toEqual([
            { type: 'file', filePath, text: 'saved note', kind: 'note' },
            {
                type: 'editing',
                filePath,
                kind: 'note',
                text: JSON.stringify(state.noteEditingData, null, 2),
            },
            {
                type: 'file',
                filePath: `${filePath}.bg.json`,
                text: 'background',
            },
        ]);
    });

    test('undo restores a Bible note as a new editing history step', async () => {
        const filePath = '/notes/Study.own';
        state.existing.add(filePath);
        state.noteHasHistories = true;
        state.noteEditingData = { title: 'New title' };
        const original = await saveAgentBackup('Edited note', [
            {
                type: 'editing',
                filePath,
                kind: 'note',
                text: JSON.stringify({ title: 'Old title' }),
            },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Edited note',
        });
        expect(state.noteEditingData).toEqual({ title: 'Old title' });
        expect(mocks.addNoteHistory).toHaveBeenCalledWith({
            title: 'Old title',
        });
        expect(mocks.notifyNoteHeadChanged).toHaveBeenCalledWith(filePath);
        expect(mocks.fireUpdateEvent).toHaveBeenCalledOnce();
        const meta = JSON.parse(
            state.texts.get(`/data/agent-backups/${original.id}.meta.json`) ??
                '',
        );
        const undoData = JSON.parse(
            state.texts.get(`/data/agent-backups/${meta.undoneBy}.data.json`) ??
                '',
        );
        expect(undoData.restores).toEqual([
            {
                type: 'editing',
                filePath,
                kind: 'note',
                text: JSON.stringify({ title: 'New title' }, null, 2),
            },
        ]);
    });

    test('trashing a Bible note removes its metadata and history folder', async () => {
        const filePath = '/notes/Study.own';
        state.existing.add(filePath);

        await trashAgentFile(filePath, 'note');
        expect(state.existing.has(filePath)).toBe(false);
        expect(mocks.deleteMetaDataFile).toHaveBeenCalledWith(filePath);
        expect(mocks.deleteHistories).toHaveBeenCalledOnce();
    });

    test('undoing a presenting flow saves its restored editing head to disk', async () => {
        const filePath = '/flows/Service.owf';
        state.existing.add(filePath);
        state.flowData = { items: ['new'] };
        expect(await snapshotAgentEditing('presentingFlow', filePath)).toEqual({
            type: 'editing',
            filePath,
            kind: 'presentingFlow',
            text: JSON.stringify(state.flowData, null, 2),
        });
        const original = await saveAgentBackup('Changed flow', [
            {
                type: 'editing',
                filePath,
                kind: 'presentingFlow',
                text: JSON.stringify({ items: ['old'] }),
            },
        ]);
        state.listed = [`${original.id}.meta.json`];

        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Changed flow',
        });
        expect(state.flowData).toEqual({ items: ['old'] });
        expect(mocks.saveFlow).toHaveBeenCalledOnce();
        expect(mocks.fireUpdateEvent).toHaveBeenCalledOnce();
    });

    test('trashing a presenting flow cleans its saved settings', async () => {
        const filePath = '/flows/Service.owf';
        state.existing.add(filePath);

        await trashAgentFile(filePath, 'presentingFlow');
        expect(mocks.preDelete).toHaveBeenCalledOnce();
        expect(mocks.removeFlowSettings).toHaveBeenCalledWith(filePath);
    });
});

describe('agent backup edges', () => {
    const dir = '/data/agent-backups';

    const readJson = (path: string): any => {
        return JSON.parse(state.texts.get(path) ?? 'null');
    };

    /** Saves a change's backup and undoes it at once, as owa_undo would. */
    async function backUpThenUndo(summary: string, restores: any[]) {
        const original = await saveAgentBackup(summary, restores);
        state.listed = [`${original.id}.meta.json`];
        return { original, result: await undoAgentBackup(original.id) };
    }

    /** A partial undo names its own id, whose backup is marked unfinished. */
    function expectPartialUndo(result: any, message: string) {
        expect(result.isError).toBe(true);
        expect(result.reason).toContain(message);
        const undoId = /owa_undo id "([^"]+)"/.exec(result.reason)?.[1];
        expect(undoId).toMatch(/^\d{8}-\d{9}-[a-z0-9]+$/);
        expect(readJson(`${dir}/${undoId}.meta.json`)).toHaveProperty(
            'failedAt',
        );
    }

    test('reads and puts back a song head through the song class, a slide head through its own', async () => {
        state.existing.add('/songs/One.owl');
        state.existing.add('/docs/Deck.ows');
        state.lyricData.set('/songs/One.owl', { content: 'song head' });
        state.slideData.set('/docs/Deck.ows', { items: ['slide head'] });

        expect(await snapshotAgentEditing('lyric', '/songs/One.owl')).toEqual({
            type: 'editing',
            kind: 'lyric',
            filePath: '/songs/One.owl',
            text: JSON.stringify({ content: 'song head' }, null, 2),
        });
        expect(await snapshotAgentEditing('slide', '/docs/Deck.ows')).toEqual({
            type: 'editing',
            kind: 'slide',
            filePath: '/docs/Deck.ows',
            text: JSON.stringify({ items: ['slide head'] }, null, 2),
        });
        const { result } = await backUpThenUndo('Edited both', [
            {
                type: 'editing',
                kind: 'lyric',
                filePath: '/songs/One.owl',
                text: JSON.stringify({ content: 'old song' }),
            },
            {
                type: 'editing',
                kind: 'slide',
                filePath: '/docs/Deck.ows',
                text: JSON.stringify({ items: ['old slide'] }),
            },
        ]);
        expect(result).toMatchObject({ undone: 'Edited both' });
        expect(state.lyricData.get('/songs/One.owl')).toEqual({
            content: 'old song',
        });
        expect(state.slideData.get('/docs/Deck.ows')).toEqual({
            items: ['old slide'],
        });
        expect(mocks.fireUpdateEvent).toHaveBeenCalledTimes(2);
    });

    test('a document that is not on disk has no head to back up', async () => {
        expect(
            await snapshotAgentEditing('lyric', '/songs/Gone.owl'),
        ).toBeNull();
        expect(
            await snapshotAgentEditing('slide', '/docs/Gone.ows'),
        ).toBeNull();
        expect(mocks.documentRead).not.toHaveBeenCalled();
    });

    test('trashing a slide document runs its own clean-up, not the plain-file one', async () => {
        state.existing.add('/docs/Deck.ows');

        await trashAgentFile('/docs/Deck.ows', 'slide');
        expect(state.existing.has('/docs/Deck.ows')).toBe(false);
        expect(mocks.slidePreDelete).toHaveBeenCalledExactlyOnceWith(
            '/docs/Deck.ows',
        );
        expect(mocks.lyricPreDelete).not.toHaveBeenCalled();
        expect(mocks.deleteMetaDataFile).not.toHaveBeenCalled();
    });

    test('a backup whose meta file never lands is refused, and the copy made for it is let go', async () => {
        state.existing.add('/media/Photo.png');
        state.texts.set('/media/Photo.png', 'bytes');
        mocks.fsWriteFile.mockImplementation(
            async (path: string, text: string) => {
                if (!path.endsWith('.meta.json')) {
                    state.existing.add(path);
                }
                state.texts.set(path, text);
            },
        );
        const change = vi.fn(async () => 'trashed');

        await expect(
            runWithAgentBackup(
                'Moved the picture to the trash',
                [
                    {
                        type: 'blob',
                        filePath: '/media/Photo.png',
                        sourcePath: '/media/Photo.png',
                    },
                ],
                change,
            ),
        ).rejects.toThrow(
            'Nothing was changed: the backup that lets it be undone could ' +
                'not be saved first (the backup file was not written)',
        );
        expect(change).not.toHaveBeenCalled();
        const [[, blobPath]] = mocks.fsCloneFile.mock.calls;
        expect(blobPath).toMatch(/^\/data\/agent-backups\/.+\.blob-0\.bin$/);
        expect(mocks.fsDeleteFile).toHaveBeenCalledWith(blobPath);
        expect(state.existing.has(blobPath)).toBe(false);
    });

    test('a picture that is gone, or a change too large to keep, is refused before anything is written', async () => {
        state.existing.add('/media/A.png');
        state.texts.set('/media/A.png', 'a');

        await expect(
            saveAgentBackup('Moved two pictures to the trash', [
                {
                    type: 'blob',
                    filePath: '/media/A.png',
                    sourcePath: '/media/A.png',
                },
                {
                    type: 'blob',
                    filePath: '/media/B.png',
                    sourcePath: '/media/B.png',
                },
            ]),
        ).rejects.toThrow('there is no file at "/media/B.png"');
        // The copy already made for the first picture orphans nothing.
        const [[, copiedPath]] = mocks.fsCloneFile.mock.calls;
        expect(mocks.fsDeleteFile).toHaveBeenCalledWith(copiedPath);
        expect(mocks.fsWriteFile).not.toHaveBeenCalled();

        mocks.fsCloneFile.mockClear();
        await expect(
            saveAgentBackup('Changed a huge slide document', [
                {
                    type: 'file',
                    filePath: '/docs/Huge.ows',
                    text: 'x'.repeat(25 * 1024 * 1024),
                },
            ]),
        ).rejects.toThrow('what it would change is too large to back up');
        expect(mocks.fsWriteFile).not.toHaveBeenCalled();
        expect(mocks.fsCloneFile).not.toHaveBeenCalled();
    });

    test('backups older than thirty days are let go with their copies, the new one kept', async () => {
        const old = '20200101-000000000-aaaa';
        state.listed = [
            `${old}.meta.json`,
            `${old}.data.json`,
            `${old}.blob-0.bin`,
            'readme.txt',
        ];
        for (const fileName of state.listed) {
            state.existing.add(`${dir}/${fileName}`);
        }

        const meta = await saveAgentBackup('Changed a song', [
            { type: 'file', filePath: '/songs/One.owl', text: 'old' },
        ]);
        // Meta first, so no list ever offers an undo whose data is gone.
        expect(
            mocks.fsDeleteFile.mock.calls.map(([path]) => {
                return path;
            }),
        ).toEqual([
            `${dir}/${old}.meta.json`,
            `${dir}/${old}.data.json`,
            `${dir}/${old}.blob-0.bin`,
        ]);
        expect(state.existing.has(`${dir}/${meta.id}.meta.json`)).toBe(true);
        expect(state.existing.has(`${dir}/readme.txt`)).toBe(true);
    });

    test('a backup that could not let an old one go is still a backup', async () => {
        state.listError = new Error('cannot list the folder');

        const meta = await saveAgentBackup('Changed a song', [
            { type: 'file', filePath: '/songs/One.owl', text: 'old' },
        ]);
        expect(meta.summary).toBe('Changed a song');
        expect(state.existing.has(`${dir}/${meta.id}.data.json`)).toBe(true);
        expect(state.existing.has(`${dir}/${meta.id}.meta.json`)).toBe(true);
        expect(mocks.handleError).toHaveBeenCalledWith(state.listError);
    });

    test('lists changes newest first and skips a meta file that cannot be read', async () => {
        state.existing.add(dir);
        const metaTextList: [string, string][] = [
            [
                '20260101-000000000-aaaa',
                JSON.stringify({
                    id: '20260101-000000000-aaaa',
                    at: '2026-01-01',
                    summary: 'First',
                    filePaths: [],
                }),
            ],
            [
                '20260201-000000000-bbbb',
                JSON.stringify({
                    id: '20260201-000000000-bbbb',
                    at: '2026-02-01',
                    summary: 'Second',
                    filePaths: [],
                }),
            ],
            ['20260301-000000000-cccc', '{not json'],
        ];
        for (const [id, text] of metaTextList) {
            state.listed.push(`${id}.meta.json`);
            state.existing.add(`${dir}/${id}.meta.json`);
            state.texts.set(`${dir}/${id}.meta.json`, text);
        }

        const listed = await listAgentBackups();
        expect(
            listed.changes.map((one) => {
                return one.summary;
            }),
        ).toEqual(['Second', 'First']);
        expect(mocks.handleError).toHaveBeenCalledWith(expect.any(SyntaxError));
    });

    test('a rename the file refuses is an error, and nothing moves with it', async () => {
        const fileSource = await import('./FileSource');
        vi.spyOn(fileSource.default, 'getInstance').mockReturnValueOnce({
            name: 'One',
            renameTo: async () => null,
        } as any);

        await expect(
            renameAgentFile('/songs/One.owl', 'Two', 'lyric'),
        ).rejects.toThrow(
            '"One" could not be renamed. Either it is not there, or ' +
                'something called "Two" already is.',
        );
        expect(mocks.moveFilePath).not.toHaveBeenCalled();
        expect(mocks.renameAllMaterialFiles).not.toHaveBeenCalled();
    });

    test.each([
        [
            'a rename whose file is gone',
            [{ type: 'rename', from: '/songs/Old.owl', to: '/songs/New.owl' }],
            '"New" is not there any more, so it cannot be renamed back.',
        ],
        [
            'a picture with no copy kept',
            [{ type: 'blob', filePath: '/media/P.png' }],
            '"P" has no copy kept beside its backup, so it cannot be put back.',
        ],
        [
            'an earlier state of a document that is gone',
            [
                {
                    type: 'editing',
                    kind: 'presentingFlow',
                    filePath: '/flows/S.owf',
                    text: '{"items":[]}',
                },
            ],
            '"S" is not there any more, so its earlier state cannot be put ' +
                'back in.',
        ],
    ])(
        'undo stops at %s, and says how to reverse what it did',
        async (_label, restores, message) => {
            const { original, result } = await backUpThenUndo(
                'A change',
                restores as any[],
            );
            expectPartialUndo(
                result,
                `Part of "A change" could not be put back: ${message}`,
            );
            expect(
                readJson(`${dir}/${original.id}.meta.json`),
            ).not.toHaveProperty('undoneAt');
        },
    );

    test('undo stops at a picture whose kept copy is gone, leaving the file as it is', async () => {
        const filePath = '/media/Photo.png';
        state.existing.add(filePath);
        state.texts.set(filePath, 'old-binary');
        const original = await saveAgentBackup('Changed photo', [
            { type: 'blob', filePath, sourcePath: filePath },
        ]);
        state.listed = [`${original.id}.meta.json`];
        state.existing.delete(`${dir}/${original.id}.blob-0.bin`);
        state.texts.set(filePath, 'new-binary');

        expectPartialUndo(
            await undoAgentBackup(original.id),
            'The copy of "Photo" kept beside its backup is gone, so it ' +
                'cannot be put back.',
        );
        expect(state.texts.get(filePath)).toBe('new-binary');
    });

    test('undo puts an installed Bible back and drops its parsed copies', async () => {
        const filePath = '/bibles/KJV.xml';
        state.existing.add(filePath);
        state.texts.set(filePath, 'new xml');

        const { original, result } = await backUpThenUndo(
            'Changed the Bible KJV',
            [{ type: 'file', filePath, text: 'old xml', bibleKey: 'KJV' }],
        );
        expect(result).toMatchObject({ undone: 'Changed the Bible KJV' });
        expect(state.texts.get(filePath)).toBe('old xml');
        expect(mocks.clearBibleXMLCache).toHaveBeenCalledExactlyOnceWith('KJV');
        // Its own undo carries the key too, so redoing it drops them again.
        const { undoneBy } = readJson(`${dir}/${original.id}.meta.json`);
        expect(readJson(`${dir}/${undoneBy}.data.json`).restores).toEqual([
            { type: 'file', filePath, text: 'new xml', bibleKey: 'KJV' },
        ]);
    });

    test('undo of a study file trashes it and tells the Resources panel', async () => {
        const filePath = '/data/resources/Default/MAT.3.3-7 The Voice.md';
        state.existing.add(filePath);
        state.texts.set(filePath, 'study');

        const { original, result } = await backUpThenUndo(
            'Made the study file',
            [{ type: 'file', filePath, text: null, isResource: true }],
        );
        expect(result).toMatchObject({ undone: 'Made the study file' });
        expect(state.existing.has(filePath)).toBe(false);
        expect(
            mocks.invalidateResourcesScanCache,
        ).toHaveBeenCalledExactlyOnceWith('/data/resources/Default');
        expect(mocks.announceResourcesChanged).toHaveBeenCalledOnce();
        // Its own undo carries the mark too, so redoing it tells the panel.
        const { undoneBy } = readJson(`${dir}/${original.id}.meta.json`);
        expect(readJson(`${dir}/${undoneBy}.data.json`).restores).toEqual([
            { type: 'file', filePath, text: 'study', isResource: true },
        ]);
    });

    test('undo writes nothing into a document already in the state it would put back', async () => {
        const filePath = '/flows/Service.owf';
        state.existing.add(filePath);
        state.flowData = { items: ['same'] };

        const { result } = await backUpThenUndo('Changed flow', [
            {
                type: 'editing',
                kind: 'presentingFlow',
                filePath,
                text: JSON.stringify({ items: ['same'] }),
            },
        ]);
        expect(result).toMatchObject({ undone: 'Changed flow' });
        expect(mocks.saveFlow).not.toHaveBeenCalled();
        expect(mocks.fireUpdateEvent).not.toHaveBeenCalled();
    });

    test("undoing a document's file keeps its unsaved head in the undo's own backup", async () => {
        const filePath = '/flows/Service.owf';
        state.existing.add(filePath);
        state.texts.set(filePath, 'saved now');
        state.flowData = { items: ['head now'] };

        const { original } = await backUpThenUndo('Changed flow file', [
            {
                type: 'file',
                filePath,
                text: 'saved before',
                kind: 'presentingFlow',
            },
        ]);
        expect(state.texts.get(filePath)).toBe('saved before');
        const { undoneBy } = readJson(`${dir}/${original.id}.meta.json`);
        expect(readJson(`${dir}/${undoneBy}.data.json`).restores).toEqual([
            {
                type: 'file',
                filePath,
                text: 'saved now',
                kind: 'presentingFlow',
            },
            {
                type: 'editing',
                kind: 'presentingFlow',
                filePath,
                text: JSON.stringify({ items: ['head now'] }, null, 2),
            },
        ]);
    });

    test('undo changes nothing when its own backup cannot be saved', async () => {
        const filePath = '/songs/One.owl';
        state.existing.add(filePath);
        state.texts.set(filePath, 'new song');
        const original = await saveAgentBackup('Changed song', [
            { type: 'file', filePath, text: 'old song' },
        ]);
        state.listed = [`${original.id}.meta.json`];
        mocks.fsWriteFile.mockRejectedValueOnce(new Error('disk full'));

        await expect(undoAgentBackup(original.id)).resolves.toEqual({
            isError: true,
            reason: genNoBackupReason(new Error('disk full')),
        });
        expect(state.texts.get(filePath)).toBe('new song');
        expect(readJson(`${dir}/${original.id}.meta.json`)).not.toHaveProperty(
            'undoneAt',
        );
    });

    test('undo names the later changes to the same file that went back with it', async () => {
        state.existing.add(dir);
        const now = Date.now();
        const first = genAgentBackupId(new Date(now - 3000), 0.1);
        const later = genAgentBackupId(new Date(now - 2000), 0.2);
        const elsewhere = genAgentBackupId(new Date(now - 1000), 0.3);
        const writeMeta = (id: string, summary: string, filePath: string) => {
            state.listed.push(`${id}.meta.json`);
            state.existing.add(`${dir}/${id}.meta.json`);
            state.texts.set(
                `${dir}/${id}.meta.json`,
                JSON.stringify({ id, at: '', summary, filePaths: [filePath] }),
            );
        };
        writeMeta(first, 'Changed the song', '/songs/One.owl');
        writeMeta(later, 'Changed the song again', '/songs/One.owl');
        writeMeta(elsewhere, 'Changed another song', '/songs/Two.owl');
        state.existing.add(`${dir}/${first}.data.json`);
        state.texts.set(
            `${dir}/${first}.data.json`,
            JSON.stringify({
                id: first,
                restores: [
                    { type: 'file', filePath: '/songs/One.owl', text: 'v1' },
                ],
            }),
        );
        state.existing.add('/songs/One.owl');
        state.texts.set('/songs/One.owl', 'v3');

        const result = await undoAgentBackup(first);
        expect(result).toMatchObject({
            undone: 'Changed the song',
            laterChanges: ['Changed the song again'],
        });
        expect(result.note).toContain(
            'Later changes to the same file went back with it',
        );
        expect(state.texts.get('/songs/One.owl')).toBe('v1');
    });

    test('an undo request that throws is answered, not thrown', async () => {
        state.existing.add(dir);
        state.listError = new Error('folder unreadable');

        await expect(
            handleAgentUndoRequest({ action: 'list' }),
        ).resolves.toEqual({ isError: true, reason: 'folder unreadable' });
        expect(mocks.handleError).toHaveBeenCalledWith(state.listError);
    });
});
