// @vitest-environment jsdom

import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    dir: vi.fn(),
    exists: vi.fn(),
    list: vi.fn(),
    join: vi.fn(),
    getFile: vi.fn(),
    refresh: vi.fn(),
    validate: vi.fn(),
    checkMarkdown: vi.fn(),
    create: vi.fn(),
    getJsonData: vi.fn(),
    setJsonData: vi.fn(),
    getContent: vi.fn(),
    setContent: vi.fn(),
    getInfo: vi.fn(),
    backup: vi.fn(),
    snapshotEditing: vi.fn(),
    snapshotDelete: vi.fn(),
    rename: vi.fn(),
    trash: vi.fn(),
    error: vi.fn(),
}));

vi.mock('./DirSource', () => ({ default: { getDirPathBySettingName: h.dir } }));
vi.mock('./constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'documents' },
}));
vi.mock('./errorHelpers', () => ({ handleError: h.error }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: h.exists,
    fsListFilesWithMimetype: h.list,
    getMimetypeExtensions: (kind: string) => [kind === 'lyric' ? 'owl' : 'ows'],
    pathJoin: h.join,
}));
vi.mock('./FileSource', () => ({ default: { getInstance: h.getFile } }));
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        validate: h.validate,
        createWithContent: h.create,
        getInstance: () => ({
            getJsonData: h.getJsonData,
            setJsonData: h.setJsonData,
        }),
    },
}));
vi.mock('../lyric-list/Lyric', () => ({
    default: {
        createWithContent: h.create,
        getInstance: () => ({
            getJsonData: h.getJsonData,
            getContent: h.getContent,
            setContent: h.setContent,
        }),
    },
}));
vi.mock('open-lyric', () => ({
    EditorOpenLyricPlugin: class {
        getOpenLyricApi() {
            return { document: { checkMarkdown: h.checkMarkdown } };
        }
    },
    OpenLyric: class {
        getInfo = h.getInfo;
    },
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    genNoBackupReason: (error: Error) => `Backup failed: ${error.message}`,
    genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
    runWithAgentBackup: h.backup,
    snapshotAgentEditing: h.snapshotEditing,
    snapshotAgentFileForDelete: h.snapshotDelete,
    renameAgentFile: h.rename,
    trashAgentFile: h.trash,
}));

// The lifecycle is under test; slide-edit algorithms have their own suite.
vi.mock('./agentSlideHelpers', () => ({
    checkIsAgentSlideAction: () => false,
    applyAgentSlideAction: vi.fn(),
    readAgentSlideDocument: vi.fn(),
    readAgentSlideRequest: vi.fn(),
}));

import { NoBackupError } from './agentBackupHelpers';
import { handleAgentFileRequest } from './agentFileHelpers';
import type {
    AgentFileKindNameType,
    AgentFileRequestType,
} from './agentFileHelpers';

const metadata = {
    initDate: '2026-01-01',
    fileVersion: 1,
    app: 'open-worship',
};
const oldItems = [
    { id: 1, canvasItems: [], metadata: { width: 1920, height: 1080 } },
];
const newItems = [
    { id: 2, canvasItems: [], metadata: { width: 1280, height: 720 } },
];

beforeEach(() => {
    h.dir.mockReturnValue('/documents');
    h.join.mockImplementation(path.posix.join);
    h.exists.mockResolvedValue(true);
    h.list.mockResolvedValue([]);
    h.getFile.mockImplementation((filePath: string) => ({
        name: path.posix.parse(filePath).name,
        filePath,
        fireUpdateEvent: h.refresh,
    }));
    h.create.mockImplementation(async (_dir: string, name: string) => ({
        name,
        filePath: '/documents/created',
        fireUpdateEvent: h.refresh,
    }));
    h.getJsonData.mockResolvedValue({
        metadata: { ...metadata },
        items: structuredClone(oldItems),
    });
    h.getContent.mockResolvedValue('saved song');
    h.checkMarkdown.mockReturnValue(true);
    h.getInfo.mockReturnValue({
        title: 'Example',
        key: 'C',
        metaLine: '4/4',
        structureLine: 'V1',
        sections: [{ partName: 'Verse 1' }],
    });
    h.snapshotEditing.mockImplementation(
        async (kind: string, filePath: string) => ({
            type: 'editing',
            kind,
            filePath,
            json: { metadata, items: oldItems },
        }),
    );
    h.snapshotDelete.mockResolvedValue([
        { type: 'file', text: 'original bytes' },
    ]);
    h.backup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => ({
            meta: { id: 'undo-1' },
            value: await change(),
        }),
    );
    h.rename.mockResolvedValue('/documents/Renamed');
});

describe.each<AgentFileKindNameType>(['slide', 'lyric'])(
    '%s document lifecycle',
    (kind) => {
        const filePath = `/documents/Example.${kind === 'slide' ? 'ows' : 'owl'}`;
        const content =
            kind === 'slide'
                ? JSON.stringify({
                      metadata: { initDate: 'untrusted date' },
                      items: newItems,
                  })
                : 'new song';
        const request = (
            action: AgentFileRequestType['action'],
            extra: Partial<AgentFileRequestType> = {},
        ) =>
            handleAgentFileRequest({
                kind,
                action,
                name: 'Example',
                content,
                ...extra,
            });

        test('backs up an absent file before creating it and returns an undo handle', async () => {
            h.exists.mockResolvedValue(false);
            let releaseBackup!: () => void;
            const ready = new Promise<void>((resolve) => {
                releaseBackup = resolve;
            });
            h.backup.mockImplementationOnce(
                async (_summary, _restores, change) => {
                    await ready;
                    return {
                        meta: { id: 'undo-create' },
                        value: await change(),
                    };
                },
            );
            const pending = request('create');
            await vi.waitFor(() => expect(h.backup).toHaveBeenCalledOnce());
            expect(h.create).not.toHaveBeenCalled();
            releaseBackup();
            expect(await pending).toMatchObject({
                created: 'Example',
                undoId: 'undo-create',
            });
            expect(h.backup).toHaveBeenCalledWith(
                expect.any(String),
                [{ type: 'file', filePath, text: null, kind }],
                expect.any(Function),
            );
            expect(h.create).toHaveBeenCalledExactlyOnceWith(
                '/documents',
                'Example',
                kind === 'slide' ? newItems : content,
            );
            expect(h.refresh).toHaveBeenCalledExactlyOnceWith();
        });

        test('refuses collisions and suggests the first free name without writing', async () => {
            h.exists.mockImplementation(
                async (candidate: string) => !candidate.includes('(3)'),
            );
            expect(await request('create')).toMatchObject({
                isError: true,
                reason: expect.stringContaining('"Example (3)" is free'),
            });
            expect(h.create).not.toHaveBeenCalled();
            expect(h.backup).not.toHaveBeenCalled();
        });

        test.each(['create', 'update', 'rename', 'delete'] as const)(
            'a failed backup prevents %s and is reported without a success event',
            async (action) => {
                h.exists.mockImplementation(
                    async (candidate: string) =>
                        action !== 'create' && candidate === filePath,
                );
                h.backup.mockRejectedValue(
                    new NoBackupError('Backup storage is unavailable'),
                );
                expect(await request(action, { newName: 'Renamed' })).toEqual({
                    isError: true,
                    reason: 'Backup storage is unavailable',
                });
                expect(h.create).not.toHaveBeenCalled();
                expect(h.setJsonData).not.toHaveBeenCalled();
                expect(h.setContent).not.toHaveBeenCalled();
                expect(h.rename).not.toHaveBeenCalled();
                expect(h.trash).not.toHaveBeenCalled();
                expect(h.refresh).not.toHaveBeenCalled();
            },
        );

        test('updates the editing state, preserving metadata, and reports that Save is still needed', async () => {
            const result = await request('update');
            expect(result).toMatchObject({
                updated: 'Example',
                filePath,
                isSaved: false,
                undoId: 'undo-1',
            });
            expect(result.note).toContain('Ctrl+Z');
            expect(h.snapshotEditing).toHaveBeenCalledExactlyOnceWith(
                kind,
                filePath,
            );
            expect(h.backup.mock.calls[0][1]).toEqual([
                {
                    type: 'editing',
                    kind,
                    filePath,
                    json: { metadata, items: oldItems },
                },
            ]);
            if (kind === 'slide') {
                expect(h.setJsonData).toHaveBeenCalledExactlyOnceWith({
                    metadata,
                    items: newItems,
                });
            } else {
                expect(h.setContent).toHaveBeenCalledExactlyOnceWith(content);
            }
            expect(h.create).not.toHaveBeenCalled();
            expect(h.refresh).toHaveBeenCalledExactlyOnceWith();
        });

        test('refuses an update when the editing state cannot be snapshotted', async () => {
            h.snapshotEditing.mockResolvedValue(null);
            expect(await request('update')).toMatchObject({
                isError: true,
                reason: expect.stringContaining('not changed'),
            });
            expect(h.backup).not.toHaveBeenCalled();
            expect(h.setJsonData).not.toHaveBeenCalled();
            expect(h.setContent).not.toHaveBeenCalled();
        });

        test('backs up a rename and delegates history/sidecar handling with the document kind', async () => {
            h.exists.mockImplementation(
                async (candidate: string) => candidate === filePath,
            );
            expect(
                await request('rename', { newName: 'Renamed' }),
            ).toMatchObject({
                renamedFrom: 'Example',
                renamedTo: 'Renamed',
                undoId: 'undo-1',
            });
            expect(h.backup.mock.calls[0][1]).toEqual([
                {
                    type: 'rename',
                    from: filePath,
                    to: filePath.replace('Example', 'Renamed'),
                    kind,
                },
            ]);
            expect(h.rename).toHaveBeenCalledExactlyOnceWith(
                filePath,
                'Renamed',
                kind,
            );
        });

        test('refuses renaming onto an existing document', async () => {
            expect(await request('rename', { newName: 'Taken' })).toMatchObject(
                {
                    isError: true,
                    reason: expect.stringContaining('not renamed'),
                },
            );
            expect(h.backup).not.toHaveBeenCalled();
            expect(h.rename).not.toHaveBeenCalled();
        });

        test('snapshots the saved file and editing state before trashing it', async () => {
            const restores = [
                { type: 'file', filePath, text: 'saved' },
                {
                    type: 'editing',
                    filePath,
                    kind,
                    json: { metadata, items: oldItems },
                },
            ];
            h.snapshotDelete.mockResolvedValue(restores);
            expect(await request('delete')).toMatchObject({
                deleted: 'Example',
                isInTrash: true,
                undoId: 'undo-1',
            });
            expect(h.snapshotDelete).toHaveBeenCalledExactlyOnceWith(
                filePath,
                kind,
            );
            expect(h.backup).toHaveBeenCalledWith(
                expect.any(String),
                restores,
                expect.any(Function),
            );
            expect(h.trash).toHaveBeenCalledExactlyOnceWith(filePath, kind);
            expect(h.snapshotDelete.mock.invocationCallOrder[0]).toBeLessThan(
                h.backup.mock.invocationCallOrder[0],
            );
            expect(h.backup.mock.invocationCallOrder[0]).toBeLessThan(
                h.trash.mock.invocationCallOrder[0],
            );
        });

        test('leaves the file alone when the deletion snapshot fails', async () => {
            h.snapshotDelete.mockRejectedValue(
                new Error('cannot read sidecar'),
            );
            expect(await request('delete')).toEqual({
                isError: true,
                reason: 'Backup failed: cannot read sidecar',
            });
            expect(h.backup).not.toHaveBeenCalled();
            expect(h.trash).not.toHaveBeenCalled();
        });

        test.each(['info', 'update', 'rename', 'delete'] as const)(
            'refuses %s for a missing file',
            async (action) => {
                h.exists.mockResolvedValue(false);
                expect(
                    await request(action, { newName: 'Renamed' }),
                ).toMatchObject({
                    isError: true,
                    reason: expect.stringContaining('There is no'),
                });
                expect(h.backup).not.toHaveBeenCalled();
            },
        );

        test('reports a failed write after backup without claiming success', async () => {
            h.exists.mockResolvedValue(false);
            const failure = new Error('disk full');
            h.create.mockRejectedValue(failure);
            expect(await request('create')).toMatchObject({
                isError: true,
                reason: expect.stringContaining('owa_undo'),
            });
            expect(h.error).toHaveBeenCalledWith(failure);
            expect(h.refresh).not.toHaveBeenCalled();
        });

        test('ignores save timestamps when reporting whether the document is dirty', async () => {
            h.getJsonData.mockImplementation(async (original?: boolean) => ({
                metadata: {
                    ...metadata,
                    lastEditDate: original ? 'before' : 'after',
                },
                items: oldItems,
            }));
            expect(await request('info')).toMatchObject({
                name: 'Example',
                filePath,
                hasUnsavedChanges: false,
            });
            h.getJsonData.mockImplementation(async (original?: boolean) => ({
                metadata,
                items: original ? oldItems : newItems,
            }));
            expect(await request('info')).toMatchObject({
                hasUnsavedChanges: true,
            });
            expect(h.backup).not.toHaveBeenCalled();
        });
    },
);

describe('document request boundaries', () => {
    test.each(['../outside', 'folder/name', 'NUL', '.hidden'])(
        'rejects the name %s before validating content or writing',
        async (name) => {
            expect(
                await handleAgentFileRequest({
                    kind: 'slide',
                    action: 'create',
                    name,
                    content: 'broken JSON',
                }),
            ).toMatchObject({ isError: true });
            expect(h.validate).not.toHaveBeenCalled();
            expect(h.exists).not.toHaveBeenCalled();
            expect(h.backup).not.toHaveBeenCalled();
        },
    );

    test('checks containment on the joined path before creating anything', async () => {
        h.join.mockReturnValue('/outside/Example.ows');
        expect(
            await handleAgentFileRequest({
                kind: 'slide',
                action: 'create',
                name: 'Example',
                content: JSON.stringify({ items: newItems }),
            }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('Documents folder'),
        });
        expect(h.exists).not.toHaveBeenCalled();
        expect(h.backup).not.toHaveBeenCalled();
    });

    test('refuses a song rejected by its validator before reserving any backup', async () => {
        h.checkMarkdown.mockReturnValue(false);
        expect(
            await handleAgentFileRequest({
                kind: 'lyric',
                action: 'create',
                name: 'Example',
                content: 'invalid song',
            }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('Open Lyric refused'),
        });
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.create).not.toHaveBeenCalled();
    });

    test('reports the full library count but reads names for at most 60 entries', async () => {
        h.list.mockResolvedValue(
            Array.from(
                { length: 75 },
                (_, i) => `/documents/Document ${i}.ows`,
            ),
        );
        const result = await handleAgentFileRequest({
            kind: 'slide',
            action: 'list',
        });
        expect(result).toMatchObject({ count: 75, isTruncated: true });
        expect(result.names).toEqual(
            Array.from({ length: 60 }, (_, i) => `Document ${i}`),
        );
        expect(h.getFile).toHaveBeenCalledTimes(60);
        expect(h.getJsonData).not.toHaveBeenCalled();
    });
});
