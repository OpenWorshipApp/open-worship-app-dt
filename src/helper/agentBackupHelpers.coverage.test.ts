import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        existing: new Set<string>(),
        texts: new Map<string, string>(),
        listed: [] as string[],
        mimeFiles: [] as string[],
    },
    mocks: { handleError: vi.fn() },
}));

vi.mock('./constants', () => ({
    appManagedDataDirNames: { AGENT_BACKUP: 'agent-backups' },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: async (path: string) => state.existing.has(path),
    fsCheckFileExist: async (path: string) => state.existing.has(path),
    fsCreateDir: vi.fn(),
    fsDeleteFile: vi.fn(),
    fsListFiles: async () => state.listed,
    fsListFilesWithMimetype: async () => state.mimeFiles,
    fsReadFile: async (path: string) => state.texts.get(path) ?? '',
    fsWriteFile: vi.fn(async (path: string, text: string) => {
        state.existing.add(path);
        state.texts.set(path, text);
    }),
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
        }),
    },
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
    snapshotAgentFile,
    snapshotAgentSidecars,
    toAgentFilePath,
    undoAgentBackup,
} from './agentBackupHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.existing.clear();
    state.texts.clear();
    state.listed = [];
    state.mimeFiles = [];
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
});
