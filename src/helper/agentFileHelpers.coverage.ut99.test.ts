// @vitest-environment jsdom

import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));

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
    isSlideAction: false,
    applySlideAction: vi.fn(),
    readSlideDocument: vi.fn(),
    readSlideRequest: vi.fn(),
    canvasItemFromJson: vi.fn(),
    CanvasItemError: class CanvasItemError {},
    textDefaults: { type: 'text', text: 'Open Worship app', fontSize: 60 },
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
            setJsonData: h.setJsonData,
            getContent: h.getContent,
            setContent: h.setContent,
        }),
    },
}));
// What a slide action's boxes are checked with, and the defaults it is
// handed; the slide rules themselves are `agentSlideHelpers.test.ts`'s.
vi.mock('../slide-editor/canvas/Canvas', () => ({
    default: {
        canvasItemFromJson: (...args: unknown[]) =>
            h.canvasItemFromJson(...args),
    },
}));
vi.mock('../slide-editor/canvas/CanvasItem', () => ({
    CanvasItemError: h.CanvasItemError,
}));
vi.mock('../slide-editor/canvas/CanvasItemText', () => ({
    default: { genDefaultItem: () => ({ toJson: () => h.textDefaults }) },
}));
vi.mock('../app-document-list/Slide', () => ({
    default: { getDefaultDim: () => ({ width: 1280, height: 720 }) },
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
    // `update-slides` / `add-slides` (`owa_slide_edit`) and the whole-words
    // read: not what these tests drive.
    AGENT_SLIDE_LIMITS: { shownTextChars: 300, fullTextChars: 5000 },
    applyAgentSlideBatch: vi.fn(),
    checkIsAgentSlideBatchAction: () => false,
    readAgentSlideBatchRequest: vi.fn(),
    checkIsAgentSlideAction: () => h.isSlideAction,
    applyAgentSlideAction: (...args: unknown[]) => h.applySlideAction(...args),
    readAgentSlideDocument: (...args: unknown[]) =>
        h.readSlideDocument(...args),
    readAgentSlideRequest: (...args: unknown[]) => h.readSlideRequest(...args),
}));

import { NoBackupError } from './agentBackupHelpers';
import { handleAgentFileRequest } from './agentFileHelpers';
import type {
    AgentFileKindNameType,
    AgentFileRequestType,
} from './agentFileHelpers';
import { publicDomainSongCatalog } from '../plugins/public-domain-songs/publicDomainSongsData';

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
    h.isSlideAction = false;
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

describe('slide action request routing', () => {
    test('rejects a malformed action before reading the document, then returns its slide list', async () => {
        h.isSlideAction = true;
        h.readSlideRequest.mockReturnValueOnce({
            isError: true,
            reason: 'The slide action is incomplete.',
        });

        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'add-slide' as any,
                name: 'Example',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The slide action is incomplete.',
        });
        expect(h.exists).not.toHaveBeenCalled();
        expect(h.getJsonData).not.toHaveBeenCalled();

        h.readSlideRequest.mockReturnValueOnce({ action: 'slides' });
        const slides = {
            name: 'Example',
            slides: [{ number: 1, name: 'Opening' }],
        };
        h.readSlideDocument.mockReturnValueOnce({ slideDocument: slides });

        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'slides' as any,
                name: 'Example',
            }),
        ).resolves.toEqual(slides);
        expect(h.readSlideDocument).toHaveBeenCalledWith(
            { metadata: { ...metadata }, items: oldItems },
            'Example',
            { action: 'slides' },
            // The usual cut: only `owa_slide_edit` asks for whole words.
            300,
        );
        expect(h.snapshotEditing).not.toHaveBeenCalled();
        expect(h.setJsonData).not.toHaveBeenCalled();
    });

    test('does not change a slide document that cannot be read', async () => {
        h.isSlideAction = true;
        h.readSlideRequest.mockReturnValue({ action: 'slides' });
        h.getJsonData.mockResolvedValue(null);

        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'slides' as any,
                name: 'Example',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('could not be read'),
        });
        expect(h.readSlideDocument).not.toHaveBeenCalled();
        expect(h.snapshotEditing).not.toHaveBeenCalled();
    });
});

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

const KIND_LABEL_MAP: Record<AgentFileKindNameType, string> = {
    lyric: 'song',
    slide: 'slide document',
};

function genContentOf(kind: AgentFileKindNameType) {
    return kind === 'slide' ? JSON.stringify({ items: newItems }) : 'new song';
}

describe.each<AgentFileKindNameType>(['lyric', 'slide'])(
    '%s document lifecycle edges',
    (kind) => {
        const label = KIND_LABEL_MAP[kind];
        const filePath = `/documents/Example.${kind === 'slide' ? 'ows' : 'owl'}`;
        const request = (extra: Partial<AgentFileRequestType>) => {
            return handleAgentFileRequest({ kind, name: 'Example', ...extra });
        };

        test('an update whose document cannot be read back is reported with the undo route', async () => {
            h.getJsonData.mockResolvedValue(null);
            expect(
                await request({
                    action: 'update',
                    content: genContentOf(kind),
                }),
            ).toEqual({
                isError: true,
                reason:
                    `Changing the ${label} “Example” could not be finished: ` +
                    '"Example" could not be read. Anything it did get to do ' +
                    'can be put back with owa_undo.',
            });
            // The backup was taken first; nothing was written after it.
            expect(h.backup).toHaveBeenCalledOnce();
            expect(h.setJsonData).not.toHaveBeenCalled();
            expect(h.setContent).not.toHaveBeenCalled();
            expect(h.refresh).not.toHaveBeenCalled();
            expect(h.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: '"Example" could not be read.',
                }),
            );
        });

        test('a create the app answers with nothing is reported, and announced nowhere', async () => {
            h.exists.mockResolvedValue(false);
            h.create.mockResolvedValue(null);
            expect(
                await request({
                    action: 'create',
                    content: genContentOf(kind),
                }),
            ).toEqual({
                isError: true,
                reason:
                    `Making the ${label} “Example” could not be finished: ` +
                    `The ${label} could not be created. Anything it did get ` +
                    'to do can be put back with owa_undo.',
            });
            expect(h.refresh).not.toHaveBeenCalled();
        });

        test('with every numbered name taken, a create offers one stamped by the time', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(36 ** 5);
            expect(
                await request({
                    action: 'create',
                    content: genContentOf(kind),
                }),
            ).toMatchObject({
                isError: true,
                reason: expect.stringContaining('"Example (100000)" is free'),
            });
            // The name asked for, then (2) to (99).
            expect(h.exists).toHaveBeenCalledTimes(99);
            expect(h.backup).not.toHaveBeenCalled();
            expect(h.create).not.toHaveBeenCalled();
        });

        test('revert names a missing document and reads nothing', async () => {
            h.exists.mockResolvedValue(false);
            expect(await request({ action: 'revert' })).toEqual({
                isError: true,
                reason:
                    `There is no ${label} called "Example". Use action ` +
                    '"list" to see what is there.',
            });
            expect(h.getJsonData).not.toHaveBeenCalled();
            expect(h.snapshotEditing).not.toHaveBeenCalled();
        });

        test('revert changes nothing when the saved file cannot be read', async () => {
            h.getJsonData.mockImplementation(async (original?: boolean) => {
                return original ? null : { metadata, items: newItems };
            });
            expect(await request({ action: 'revert' })).toEqual({
                isError: true,
                reason: '"Example" could not be read, so it was not changed.',
            });
            expect(h.snapshotEditing).not.toHaveBeenCalled();
            expect(h.backup).not.toHaveBeenCalled();
            expect(h.setJsonData).not.toHaveBeenCalled();
        });

        test('revert changes nothing when the unsaved state cannot be backed up', async () => {
            h.getJsonData.mockImplementation(async (original?: boolean) => {
                return { metadata, items: original ? oldItems : newItems };
            });
            h.snapshotEditing.mockResolvedValue(null);
            expect(await request({ action: 'revert' })).toEqual({
                isError: true,
                reason: '"Example" could not be read, so it was not changed.',
            });
            expect(h.backup).not.toHaveBeenCalled();
            expect(h.setJsonData).not.toHaveBeenCalled();
        });

        test('revert puts the saved state back behind a backup, and a failed write says so', async () => {
            const saved = { metadata, items: oldItems };
            h.getJsonData.mockImplementation(async (original?: boolean) => {
                return original ? saved : { metadata, items: newItems };
            });
            expect(await request({ action: 'revert' })).toMatchObject({
                reverted: 'Example',
                filePath,
                isSaved: true,
                undoId: 'undo-1',
            });
            expect(h.snapshotEditing).toHaveBeenCalledWith(kind, filePath);
            expect(h.setJsonData).toHaveBeenCalledExactlyOnceWith(saved);
            expect(h.backup.mock.invocationCallOrder[0]).toBeLessThan(
                h.setJsonData.mock.invocationCallOrder[0],
            );
            expect(h.refresh).toHaveBeenCalledOnce();

            h.refresh.mockClear();
            h.setJsonData.mockRejectedValue(new Error('disk full'));
            expect(await request({ action: 'revert' })).toEqual({
                isError: true,
                reason:
                    `Putting the ${label} “Example” back could not be ` +
                    'finished: disk full Anything it did get to do can be put ' +
                    'back with owa_undo.',
            });
            expect(h.refresh).not.toHaveBeenCalled();
        });

        test('a rename to a name outside the folder, or one the computer keeps, is refused', async () => {
            h.join.mockImplementation((dir: string, file: string) => {
                return file.startsWith('Away.')
                    ? `/outside/${file}`
                    : path.posix.join(dir, file);
            });
            expect(
                await request({ action: 'rename', newName: 'Away' }),
            ).toEqual({
                isError: true,
                reason:
                    'That new name would not stay inside the Documents ' +
                    'folder.',
            });
            expect(await request({ action: 'rename', newName: 'NUL' })).toEqual(
                {
                    isError: true,
                    reason: '"NUL" is a name this computer reserves for itself.',
                },
            );
            expect(await request({ action: 'rename' })).toEqual({
                isError: true,
                reason: 'Give the file a name.',
            });
            expect(h.backup).not.toHaveBeenCalled();
            expect(h.rename).not.toHaveBeenCalled();
        });

        test('an unknown action names what this kind takes, and content is required', async () => {
            expect(
                await request({ action: 'mystery' as any }).then((result) => {
                    return result.reason;
                }),
            ).toBe(
                'Unknown action. Use list, info, create, update, rename, ' +
                    'revert or delete' +
                    (kind === 'slide'
                        ? ', or one slide at a time: slides, add-slide, ' +
                          'update-slide, delete-slide, move-slide, ' +
                          'duplicate-slide.'
                        : '.'),
            );
            expect(await request({ action: 'create', content: '  ' })).toEqual({
                isError: true,
                reason: `Content is required to create a ${label}.`,
            });
            expect(await request({ action: 'update' })).toEqual({
                isError: true,
                reason: `Content is required to update a ${label}.`,
            });
            expect(h.backup).not.toHaveBeenCalled();
        });
    },
);

describe('document request edges', () => {
    test('an unknown kind, no Documents folder, or a failure outside any change is answered', async () => {
        expect(
            await handleAgentFileRequest({
                kind: 'hymn' as any,
                action: 'list',
            }),
        ).toEqual({
            isError: true,
            reason: 'Unknown kind. Use "lyric" or "slide".',
        });
        h.dir.mockReturnValue(null);
        expect(
            await handleAgentFileRequest({ kind: 'lyric', action: 'list' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining(
                'No Documents folder is set up yet',
            ),
        });
        const failure = new Error('settings unreadable');
        h.dir.mockImplementation(() => {
            throw failure;
        });
        expect(
            await handleAgentFileRequest({ kind: 'lyric', action: 'list' }),
        ).toEqual({ isError: true, reason: 'settings unreadable' });
        expect(h.error).toHaveBeenCalledWith(failure);
        expect(h.list).not.toHaveBeenCalled();
    });

    test('a song open-lyric cannot describe is still described, without its parts', async () => {
        const failure = new Error('bad markdown');
        h.getInfo.mockImplementation(() => {
            throw failure;
        });
        expect(
            await handleAgentFileRequest({
                kind: 'lyric',
                action: 'info',
                name: 'Example',
            }),
        ).toEqual({
            name: 'Example',
            filePath: '/documents/Example.owl',
            hasUnsavedChanges: false,
            characters: 'saved song'.length,
            title: null,
            key: null,
            metaLine: null,
            structureLine: null,
            sections: [],
        });
        expect(h.error).toHaveBeenCalledWith(failure);
    });

    test('a slide document that cannot be read is described as empty and clean', async () => {
        h.getJsonData.mockResolvedValue(null);
        expect(
            await handleAgentFileRequest({
                kind: 'slide',
                action: 'info',
                name: 'Example',
            }),
        ).toEqual({
            name: 'Example',
            filePath: '/documents/Example.ows',
            hasUnsavedChanges: false,
            slideCount: 0,
            dimensions: null,
        });
    });
});

describe('finding a song by its title', () => {
    const find = (name?: string) => {
        return handleAgentFileRequest({ kind: 'lyric', action: 'find', name });
    };

    test("lists the user's own copies beside the collection's hymn", async () => {
        h.list.mockResolvedValue([
            '/documents/Amazing Grace.owl',
            '/documents/amazing grace (2).owl',
            '/documents/Grace Alone.owl',
        ]);
        const result: any = await find('  Amazing Grace ');
        expect(result).toMatchObject({
            asked: 'Amazing Grace',
            yours: ['Amazing Grace', 'amazing grace (2)'],
            nearest: [],
            collectionSize: publicDomainSongCatalog.length,
        });
        expect(result.found).toMatchObject({
            title: 'Amazing Grace',
            content: expect.stringContaining('- Title: Amazing Grace'),
        });
        expect(h.list).toHaveBeenCalledWith('/documents', 'lyric');
        // A find reads; it writes nothing and takes no backup.
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.create).not.toHaveBeenCalled();
    });

    test('a short title matches only a song of exactly that name, and five copies at most', async () => {
        h.list.mockResolvedValue([
            '/documents/Rock.owl',
            '/documents/Rock of Ages.owl',
            '/documents/The Rock.owl',
        ]);
        const short: any = await find('Rock');
        expect(short.yours).toEqual(['Rock', 'The Rock']);
        expect(short.found).toBeNull();
        expect(short.nearest).toContain('Rock of Ages');

        h.list.mockResolvedValue(
            Array.from({ length: 7 }, (_v, index) => {
                return `/documents/Amazing Grace (${index + 2}).owl`;
            }),
        );
        const many: any = await find('Amazing Grace');
        expect(many.yours).toEqual(
            Array.from({ length: 5 }, (_v, index) => {
                return `Amazing Grace (${index + 2})`;
            }),
        );
    });

    test('is for a song, by a title of a sensible length', async () => {
        expect(
            await handleAgentFileRequest({
                kind: 'slide',
                action: 'find',
                name: 'Amazing Grace',
            }),
        ).toEqual({
            isError: true,
            reason: 'Only a song can be found by its title.',
        });
        const noTitle = {
            isError: true,
            reason: 'Give the title of the song to find.',
        };
        expect(await find('   ')).toEqual(noTitle);
        expect(await find()).toEqual(noTitle);
        expect(await find('x'.repeat(121))).toEqual(noTitle);
        expect(h.list).not.toHaveBeenCalled();
    });
});

describe('slide action pipeline', () => {
    const filePath = '/documents/Example.ows';
    const checked = { slide: 1, specs: [{ id: 1, text: 'Hi' }] };
    const box = { id: 1, type: 'text', text: 'Hi' };
    const changedJson = { metadata, items: newItems };
    const genChange = (extra: Record<string, unknown> = {}) => {
        return {
            didChange: true,
            json: changedJson,
            summary: 'Changed slide 1 of “Example”',
            checkItems: [{ item: box }],
            result: { updated: 1 },
            ...extra,
        };
    };
    const slideRequest = (extra: Partial<AgentFileRequestType> = {}) => {
        return handleAgentFileRequest({
            kind: 'slide',
            action: 'update-slide' as any,
            name: 'Example',
            slide: 1,
            items: [{ id: 1, text: 'Hi' }],
            ...extra,
        });
    };
    const expectNothingWritten = () => {
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.setJsonData).not.toHaveBeenCalled();
        expect(h.refresh).not.toHaveBeenCalled();
    };

    beforeEach(() => {
        h.isSlideAction = true;
        h.readSlideRequest.mockReturnValue(checked);
        h.applySlideAction.mockReturnValue(genChange());
        h.canvasItemFromJson.mockReturnValue({});
    });

    test('writes one history entry behind a backup, once both validators passed', async () => {
        h.applySlideAction.mockReturnValue(genChange({ note: 'Box 1 moved.' }));
        const result = await slideRequest();
        expect(result).toMatchObject({
            updated: 1,
            isSaved: false,
            undoId: 'undo-1',
        });
        expect(result.note).toMatch(
            /^Box 1 moved\. The change is in the document/,
        );
        expect(h.readSlideRequest).toHaveBeenCalledWith(
            'update-slide',
            expect.objectContaining({ slide: 1 }),
        );
        const [action, json, request, context] =
            h.applySlideAction.mock.calls[0];
        expect([action, json, request]).toEqual([
            'update-slide',
            { metadata, items: oldItems },
            checked,
        ]);
        expect(context.name).toBe('Example');
        expect(context.genTextDefaults()).toEqual(h.textDefaults);
        expect(context.getDefaultDim()).toEqual({ width: 1280, height: 720 });
        expect(h.validate).toHaveBeenCalledWith(changedJson);
        expect(h.canvasItemFromJson).toHaveBeenCalledExactlyOnceWith(box);
        expect(h.snapshotEditing).toHaveBeenCalledWith('slide', filePath);
        expect(h.backup).toHaveBeenCalledWith(
            'Changed slide 1 of “Example”',
            [expect.objectContaining({ type: 'editing', filePath })],
            expect.any(Function),
        );
        expect(h.setJsonData).toHaveBeenCalledExactlyOnceWith(changedJson);
        expect(h.backup.mock.invocationCallOrder[0]).toBeLessThan(
            h.setJsonData.mock.invocationCallOrder[0],
        );
        expect(h.refresh).toHaveBeenCalledExactlyOnceWith();
    });

    test('a change with no boxes to check skips the box validator', async () => {
        h.applySlideAction.mockReturnValue(genChange({ checkItems: [] }));
        expect(await slideRequest()).toMatchObject({ updated: 1 });
        expect(h.canvasItemFromJson).not.toHaveBeenCalled();
        expect(h.setJsonData).toHaveBeenCalledExactlyOnceWith(changedJson);
    });

    test('a change that changes nothing is answered without a backup', async () => {
        h.applySlideAction.mockReturnValue(
            genChange({
                didChange: false,
                note: 'Those were already its values, so nothing was changed.',
            }),
        );
        expect(await slideRequest()).toEqual({
            updated: 1,
            didChange: false,
            note: 'Those were already its values, so nothing was changed.',
        });
        expect(h.validate).not.toHaveBeenCalled();
        expect(h.snapshotEditing).not.toHaveBeenCalled();
        expectNothingWritten();
    });

    test('a refused change writes nothing', async () => {
        h.applySlideAction.mockReturnValue({
            isError: true,
            reason: 'Box 1 of `items`: box 1 is locked in the slide editor.',
        });
        expect(await slideRequest()).toEqual({
            isError: true,
            reason: 'Box 1 of `items`: box 1 is locked in the slide editor.',
        });
        expect(h.validate).not.toHaveBeenCalled();
        expectNothingWritten();
    });

    test('a document the app would not open after the change writes nothing', async () => {
        h.validate.mockImplementation(() => {
            throw new Error('Invalid slide data');
        });
        expect(await slideRequest()).toEqual({
            isError: true,
            reason:
                'This app would not open the document after that change, so ' +
                'it was not made: Invalid slide data',
        });
        expect(h.canvasItemFromJson).not.toHaveBeenCalled();
        expect(h.snapshotEditing).not.toHaveBeenCalled();
        expectNothingWritten();
    });

    test.each([
        ['the red error box', () => new h.CanvasItemError()],
        ['no box at all', () => null],
    ])(
        'a box the editor would read as %s writes nothing',
        async (_label, genItem) => {
            h.canvasItemFromJson.mockImplementation(genItem);
            expect(await slideRequest()).toEqual({
                isError: true,
                reason:
                    'Box 1 would not open in the slide editor after that change, ' +
                    'so nothing was changed. Read the slide with action "slides" ' +
                    'and send only the fields to change.',
            });
            expect(h.snapshotEditing).not.toHaveBeenCalled();
            expectNothingWritten();
        },
    );

    test('a head that cannot be backed up, or a backup that fails, leaves the document as it was', async () => {
        h.snapshotEditing.mockResolvedValue(null);
        expect(await slideRequest()).toEqual({
            isError: true,
            reason: '"Example" could not be read, so it was not changed.',
        });
        expectNothingWritten();

        h.snapshotEditing.mockResolvedValue({ type: 'editing', filePath });
        h.backup.mockRejectedValue(
            new NoBackupError('Backup storage is unavailable'),
        );
        expect(await slideRequest()).toEqual({
            isError: true,
            reason: 'Backup storage is unavailable',
        });
        expect(h.setJsonData).not.toHaveBeenCalled();
        expect(h.refresh).not.toHaveBeenCalled();
    });

    test('a write that fails after its backup is reported with the undo route', async () => {
        const failure = new Error('disk full');
        h.setJsonData.mockRejectedValue(failure);
        expect(await slideRequest()).toEqual({
            isError: true,
            reason:
                'Changed slide 1 of “Example” could not be finished: disk ' +
                'full Anything it did get to do can be put back with owa_undo.',
        });
        expect(h.error).toHaveBeenCalledWith(failure);
        expect(h.refresh).not.toHaveBeenCalled();
    });

    test('a song has no slides of its own, and a missing document is named', async () => {
        expect(
            await slideRequest({ kind: 'lyric' }).then((result) => {
                return result.reason;
            }),
        ).toBe(
            "A song's slides are made from its words, so it has no slides of " +
                'its own to change. Change its words with action "update".',
        );
        expect(h.readSlideRequest).not.toHaveBeenCalled();

        h.exists.mockResolvedValue(false);
        expect(await slideRequest()).toEqual({
            isError: true,
            reason:
                'There is no slide document called "Example". Use action ' +
                '"list" to see what is there.',
        });
        expect(h.getJsonData).not.toHaveBeenCalled();
        expect(h.applySlideAction).not.toHaveBeenCalled();
    });
});
