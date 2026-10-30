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
        saveFlow: vi.fn(),
        removeFlowSettings: vi.fn(),
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
    fsListFiles: async () => state.listed,
    fsListFilesWithMimetype: async () => state.mimeFiles,
    fsReadFile: async (path: string) => state.texts.get(path) ?? '',
    fsWriteFile: mocks.fsWriteFile,
    getFileFullName: (path: string) => path.split('/').at(-1),
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

// The document classes and the Bible cache only the tests at the end of this
// file reach: a song's and a slide document's editing head, and the parsed
// Bible an undone Bible file must not keep serving.
const docs = vi.hoisted(() => ({
    lyricJson: null as Record<string, unknown> | null,
    slideJson: null as Record<string, unknown> | null,
    clearBibleXMLCache: vi.fn(),
}));
vi.mock('../lyric-list/Lyric', () => ({
    default: {
        getInstance: () => ({ getJsonData: async () => docs.lyricJson }),
    },
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        getInstance: () => ({ getJsonData: async () => docs.slideJson }),
    },
}));
vi.mock('../setting/bible-setting/bibleXMLHelpers', () => ({
    clearBibleXMLCache: docs.clearBibleXMLCache,
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

beforeEach(() => {
    vi.clearAllMocks();
    state.existing.clear();
    state.texts.clear();
    state.listed = [];
    state.mimeFiles = [];
    state.noteHasHistories = false;
    state.noteEditingData = null;
    state.flowData = null;
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

const BACKUP_DIR = '/data/agent-backups';

function readStored(fileName: string) {
    return JSON.parse(state.texts.get(`${BACKUP_DIR}/${fileName}`) ?? 'null');
}

describe('the store refuses rather than keeping half a backup', () => {
    beforeEach(() => {
        docs.lyricJson = null;
        docs.slideJson = null;
        // A delete answers with a promise, as the real one does.
        mocks.fsDeleteFile.mockResolvedValue(undefined);
    });

    test('a song’s and a slide document’s unsaved head are what is backed up; a file not there has none', async () => {
        state.existing.add('/docs/Hymn.owl');
        state.existing.add('/docs/Deck.ows');
        docs.lyricJson = { content: 'unsaved words' };
        docs.slideJson = { items: [{ id: 1 }] };
        expect(await snapshotAgentEditing('lyric', '/docs/Hymn.owl')).toEqual({
            type: 'editing',
            kind: 'lyric',
            filePath: '/docs/Hymn.owl',
            text: JSON.stringify(docs.lyricJson, null, 2),
        });
        expect(await snapshotAgentEditing('slide', '/docs/Deck.ows')).toEqual({
            type: 'editing',
            kind: 'slide',
            filePath: '/docs/Deck.ows',
            text: JSON.stringify(docs.slideJson, null, 2),
        });
        expect(
            await snapshotAgentEditing('slide', '/docs/Gone.ows'),
        ).toBeNull();
    });

    test('a meta file that does not land on disk fails the backup, and the copies it made are let go', async () => {
        state.existing.add('/media/Photo.png');
        state.texts.set('/media/Photo.png', 'binary');
        mocks.fsWriteFile.mockImplementation(
            async (path: string, text: string) => {
                // The data file lands; the meta file never does.
                if (!path.endsWith('.meta.json')) {
                    state.existing.add(path);
                    state.texts.set(path, text);
                }
            },
        );
        await expect(
            saveAgentBackup('Deleted a photo', [
                {
                    type: 'blob',
                    filePath: '/media/Photo.png',
                    sourcePath: '/media/Photo.png',
                },
            ]),
        ).rejects.toThrow('the backup file was not written');
        expect(mocks.fsDeleteFile).toHaveBeenCalledWith(
            expect.stringMatching(/^\/data\/agent-backups\/.+\.blob-0\.bin$/),
        );
    });

    test('a file to keep a copy of that is not there refuses the backup, and an earlier copy is let go even if that fails', async () => {
        state.existing.add('/media/One.png');
        mocks.fsDeleteFile.mockRejectedValue(new Error('locked'));
        await expect(
            saveAgentBackup('Deleted two photos', [
                {
                    type: 'blob',
                    filePath: '/media/One.png',
                    sourcePath: '/media/One.png',
                },
                {
                    type: 'blob',
                    filePath: '/media/Gone.png',
                    sourcePath: '/media/Gone.png',
                },
            ]),
        ).rejects.toThrow('there is no file at "/media/Gone.png"');
        expect(mocks.fsCloneFile).toHaveBeenCalledOnce();
        expect(mocks.fsDeleteFile).toHaveBeenCalledWith(
            expect.stringMatching(/\.blob-0\.bin$/),
        );
        expect(mocks.handleError).toHaveBeenCalledWith(new Error('locked'));
        expect(mocks.fsWriteFile).not.toHaveBeenCalled();
    });

    test('what is too large to back up is refused before any copy is made', async () => {
        await expect(
            saveAgentBackup('Rewrote a huge file', [
                {
                    type: 'file',
                    filePath: '/docs/Huge.ows',
                    text: 'x'.repeat(25 * 1024 * 1024),
                },
            ]),
        ).rejects.toThrow('what it would change is too large to back up');
        expect(mocks.fsWriteFile).not.toHaveBeenCalled();
    });

    test('backups older than thirty days go, with their copies; a prune that fails keeps the new backup', async () => {
        const oldId = '20240101-000000000-aaaa';
        state.listed = [
            `${oldId}.meta.json`,
            `${oldId}.data.json`,
            `${oldId}.blob-0.bin`,
            'not-a-backup.txt',
        ];
        const meta = await saveAgentBackup('Changed a song', [
            { type: 'file', filePath: '/songs/One.owl', text: 'old' },
        ]);
        expect(mocks.fsDeleteFile.mock.calls.map(([path]) => path)).toEqual([
            `${BACKUP_DIR}/${oldId}.meta.json`,
            `${BACKUP_DIR}/${oldId}.data.json`,
            `${BACKUP_DIR}/${oldId}.blob-0.bin`,
        ]);
        expect(readStored(`${meta.id}.meta.json`)).toMatchObject({
            summary: 'Changed a song',
        });

        mocks.fsDeleteFile.mockRejectedValue(new Error('locked'));
        await expect(
            saveAgentBackup('Changed it again', [
                { type: 'file', filePath: '/songs/One.owl', text: 'older' },
            ]),
        ).resolves.toMatchObject({ summary: 'Changed it again' });
        expect(mocks.handleError).toHaveBeenCalledWith(new Error('locked'));
    });

    test('a rename the file system does not make is an error, never a quiet success', async () => {
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
});

describe('undo, when what it would put back is not there', () => {
    beforeEach(() => {
        docs.lyricJson = null;
        docs.slideJson = null;
    });

    async function saveListed(summary: string, restores: any[]) {
        const meta = await saveAgentBackup(summary, restores);
        state.listed = [...state.listed, `${meta.id}.meta.json`];
        return meta;
    }

    test('the list is newest first, and a meta file that will not parse is passed over', async () => {
        state.existing.add(BACKUP_DIR);
        const one = '20260101-000000000-aaaa';
        const two = '20260102-000000000-bbbb';
        for (const id of [one, two]) {
            state.existing.add(`${BACKUP_DIR}/${id}.meta.json`);
            state.texts.set(
                `${BACKUP_DIR}/${id}.meta.json`,
                JSON.stringify({ id, at: id, summary: id, filePaths: [] }),
            );
        }
        state.existing.add(`${BACKUP_DIR}/20260103-000000000-cccc.meta.json`);
        state.texts.set(
            `${BACKUP_DIR}/20260103-000000000-cccc.meta.json`,
            '{ broken',
        );
        state.listed = [
            `${one}.meta.json`,
            '20260103-000000000-cccc.meta.json',
            `${two}.meta.json`,
        ];
        const listed = await listAgentBackups();
        expect(listed.changes.map((change) => change.id)).toEqual([two, one]);
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });

    test('a renamed file that is gone cannot be renamed back: the undo says how far it got', async () => {
        const original = await saveListed('Renamed a song', [
            { type: 'rename', from: '/songs/Old.owl', to: '/songs/New.owl' },
        ]);
        const result = await undoAgentBackup(original.id);
        expect(result).toMatchObject({
            isError: true,
            reason: expect.stringContaining(
                'Part of "Renamed a song" could not be put back: "New" is ' +
                    'not there any more, so it cannot be renamed back. ' +
                    'Whatever was put back can be reversed with owa_undo id',
            ),
        });
        // The original is NOT marked undone; the undo's own backup is
        // marked unfinished.
        expect(readStored(`${original.id}.meta.json`)).not.toHaveProperty(
            'undoneAt',
        );
        const undoId = /owa_undo id "([^"]+)"/.exec(
            result.reason as string,
        )?.[1];
        expect(readStored(`${undoId}.meta.json`)).toHaveProperty('failedAt');
    });

    test('a binary change with no copy, or whose copy is gone, is not put back', async () => {
        state.existing.add('/media/Photo.png');
        const noCopy = await saveListed('Changed a photo', [
            { type: 'blob', filePath: '/media/Photo.png' },
        ]);
        await expect(undoAgentBackup(noCopy.id)).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining(
                '"Photo" has no copy kept beside its backup, so it cannot be ' +
                    'put back.',
            ),
        });

        state.texts.set('/media/Photo.png', 'old picture');
        const copied = await saveListed('Changed it again', [
            {
                type: 'blob',
                filePath: '/media/Photo.png',
                sourcePath: '/media/Photo.png',
            },
        ]);
        state.existing.delete(`${BACKUP_DIR}/${copied.id}.blob-0.bin`);
        await expect(undoAgentBackup(copied.id)).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining(
                'The copy of "Photo" kept beside its backup is gone, so it ' +
                    'cannot be put back.',
            ),
        });
    });

    test('an earlier state of a document that is gone cannot be put back in', async () => {
        const original = await saveListed('Changed a run sheet', [
            {
                type: 'editing',
                filePath: '/flows/Service.owf',
                kind: 'presentingFlow',
                text: JSON.stringify({ items: ['old'] }),
            },
        ]);
        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining(
                '"Service" is not there any more, so its earlier state ' +
                    'cannot be put back in.',
            ),
        });
        expect(mocks.saveFlow).not.toHaveBeenCalled();
    });

    test('a document already in the wanted state is not written again', async () => {
        state.existing.add('/flows/Service.owf');
        state.flowData = { items: ['same'] };
        const original = await saveListed('Changed a run sheet', [
            {
                type: 'editing',
                filePath: '/flows/Service.owf',
                kind: 'presentingFlow',
                text: JSON.stringify({ items: ['same'] }),
            },
        ]);
        await expect(undoAgentBackup(original.id)).resolves.toMatchObject({
            undone: 'Changed a run sheet',
        });
        expect(mocks.saveFlow).not.toHaveBeenCalled();
        expect(mocks.fireUpdateEvent).not.toHaveBeenCalled();
    });

    test('a Bible file put back drops that Bible’s parsed caches, and its undo remembers whose it is', async () => {
        state.existing.add('/bibles/KJV.xml');
        state.texts.set('/bibles/KJV.xml', '<new/>');
        const original = await saveListed('Renamed the KJV', [
            {
                type: 'file',
                filePath: '/bibles/KJV.xml',
                text: '<old/>',
                bibleKey: 'KJV',
            },
        ]);
        const result = await undoAgentBackup(original.id);
        expect(result).toMatchObject({ undone: 'Renamed the KJV' });
        expect(state.texts.get('/bibles/KJV.xml')).toBe('<old/>');
        expect(docs.clearBibleXMLCache).toHaveBeenCalledWith('KJV');
        expect(readStored(`${result.undoId}.data.json`).restores).toEqual([
            {
                type: 'file',
                filePath: '/bibles/KJV.xml',
                text: '<new/>',
                bibleKey: 'KJV',
            },
        ]);
    });

    test('undoing a song file also keeps the unsaved head it would bury', async () => {
        state.existing.add('/songs/One.owl');
        state.texts.set('/songs/One.owl', 'saved words');
        docs.lyricJson = { content: 'unsaved words' };
        const original = await saveListed('Changed a song', [
            {
                type: 'file',
                filePath: '/songs/One.owl',
                text: 'older words',
                kind: 'lyric',
            },
        ]);
        const result = await undoAgentBackup(original.id);
        expect(readStored(`${result.undoId}.data.json`).restores).toEqual([
            {
                type: 'file',
                filePath: '/songs/One.owl',
                text: 'saved words',
                kind: 'lyric',
            },
            {
                type: 'editing',
                kind: 'lyric',
                filePath: '/songs/One.owl',
                text: JSON.stringify(docs.lyricJson, null, 2),
            },
        ]);
    });

    test('an undo whose own backup cannot be saved changes nothing', async () => {
        state.existing.add('/songs/One.owl');
        state.texts.set('/songs/One.owl', 'new words');
        const original = await saveListed('Changed a song', [
            { type: 'file', filePath: '/songs/One.owl', text: 'old words' },
        ]);
        mocks.fsWriteFile.mockRejectedValue(new Error('disk full'));
        await expect(undoAgentBackup(original.id)).resolves.toEqual({
            isError: true,
            reason: genNoBackupReason(new Error('disk full')),
        });
        expect(state.texts.get('/songs/One.owl')).toBe('new words');
    });

    test('undoing a change also takes back later changes to the same file, and says so', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            state.existing.add('/songs/One.owl');
            vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
            const first = await saveListed('Changed a song', [
                { type: 'file', filePath: '/songs/One.owl', text: 'v1' },
            ]);
            vi.setSystemTime(new Date('2026-10-28T10:05:00Z'));
            await saveListed('Changed it again', [
                { type: 'file', filePath: '/songs/One.owl', text: 'v2' },
            ]);
            vi.setSystemTime(new Date('2026-10-28T10:06:00Z'));
            await saveListed('Changed another song', [
                { type: 'file', filePath: '/songs/Two.owl', text: 'x' },
            ]);
            vi.setSystemTime(new Date('2026-10-28T10:10:00Z'));
            const result = await undoAgentBackup(first.id);
            expect(result).toMatchObject({
                undone: 'Changed a song',
                laterChanges: ['Changed it again'],
                note: expect.stringContaining(
                    'Later changes to the same file went back with it',
                ),
            });
            expect(state.texts.get('/songs/One.owl')).toBe('v1');
        } finally {
            vi.useRealTimers();
        }
    });

    test('a request that breaks part way still answers, as a refusal', async () => {
        state.existing.add(BACKUP_DIR);
        state.listed = null as unknown as string[];
        await expect(
            handleAgentUndoRequest({ action: 'undo' }),
        ).resolves.toMatchObject({ isError: true });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });
});
