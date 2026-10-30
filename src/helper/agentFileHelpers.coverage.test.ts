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
    isSlideAction: false,
    applySlideAction: vi.fn(),
    readSlideDocument: vi.fn(),
    readSlideRequest: vi.fn(),
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
    checkIsAgentSlideAction: () => h.isSlideAction,
    applyAgentSlideAction: (...args: unknown[]) => h.applySlideAction(...args),
    readAgentSlideDocument: (...args: unknown[]) =>
        h.readSlideDocument(...args),
    readAgentSlideRequest: (...args: unknown[]) => h.readSlideRequest(...args),
}));

// The canvas classes a slide action's boxes are checked with, loaded only on
// that path (the slide-action tests at the end of this file).
const slideCanvas = vi.hoisted(() => {
    class CanvasItemError {}
    return {
        CanvasItemError,
        canvasItemFromJson: vi.fn(),
        textDefaults: {
            id: -1,
            type: 'text',
            text: 'Open Worship app',
            color: '#FFFFFF',
            fontSize: 60,
        },
    };
});
vi.mock('../slide-editor/canvas/Canvas', () => ({
    default: { canvasItemFromJson: slideCanvas.canvasItemFromJson },
}));
vi.mock('../slide-editor/canvas/CanvasItem', () => ({
    CanvasItemError: slideCanvas.CanvasItemError,
}));
vi.mock('../slide-editor/canvas/CanvasItemText', () => ({
    default: {
        genDefaultItem: () => ({
            toJson: () => ({ ...slideCanvas.textDefaults }),
        }),
    },
}));
vi.mock('../app-document-list/Slide', () => ({
    default: { getDefaultDim: () => ({ width: 1280, height: 720 }) },
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

describe('slide actions: checked, backed up, then one history entry', () => {
    const slidePath = '/documents/Example.ows';
    const genChange = (fields: Record<string, unknown> = {}) => ({
        didChange: true,
        json: { metadata: { ...metadata }, items: newItems },
        checkItems: [{ item: { id: 3, type: 'text' } }],
        summary: 'Added slide 2 to “Example”',
        result: { added: 2 },
        note: 'Its box is centred.',
        ...fields,
    });
    const request = (kind: AgentFileKindNameType = 'slide') =>
        handleAgentFileRequest({
            kind,
            action: 'add-slide' as any,
            name: 'Example',
        });

    beforeEach(() => {
        h.isSlideAction = true;
        h.readSlideRequest.mockReturnValue({ action: 'add-slide' });
        h.applySlideAction.mockReturnValue(genChange());
        slideCanvas.canvasItemFromJson.mockReturnValue({});
    });

    test('a song has no slides of its own: refused before anything is read', async () => {
        await expect(request('lyric')).resolves.toEqual({
            isError: true,
            reason:
                "A song's slides are made from its words, so it has no " +
                'slides of its own to change. Change its words with action ' +
                '"update".',
        });
        expect(h.readSlideRequest).not.toHaveBeenCalled();
        expect(h.exists).not.toHaveBeenCalled();
    });

    test('a document that is not there is refused before it is read', async () => {
        h.exists.mockResolvedValue(false);
        await expect(request()).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining(
                'There is no slide document called "Example"',
            ),
        });
        expect(h.getJsonData).not.toHaveBeenCalled();
    });

    test('the change is made to the head, checked, backed up and written once', async () => {
        const result = await request();
        expect(result).toEqual({
            added: 2,
            isSaved: false,
            undoId: 'undo-1',
            note:
                'Its box is centred. The change is in the document but NOT ' +
                'on disk yet: it shows a * beside its name, Ctrl+Z undoes ' +
                'it, and the user presses Save to keep it. Tell them that.',
        });
        const [action, json, checked, options] = h.applySlideAction.mock
            .calls[0] as any[];
        expect([action, json, checked]).toEqual([
            'add-slide',
            { metadata, items: oldItems },
            { action: 'add-slide' },
        ]);
        // A new box is the app's own default text box, on the app's own
        // default slide size.
        expect(options.name).toBe('Example');
        expect(options.genTextDefaults()).toEqual(slideCanvas.textDefaults);
        expect(options.getDefaultDim()).toEqual({ width: 1280, height: 720 });
        expect(h.validate).toHaveBeenCalledWith(genChange().json);
        expect(slideCanvas.canvasItemFromJson).toHaveBeenCalledWith({
            id: 3,
            type: 'text',
        });
        expect(h.snapshotEditing).toHaveBeenCalledWith('slide', slidePath);
        expect(h.backup).toHaveBeenCalledWith(
            'Added slide 2 to “Example”',
            [expect.objectContaining({ type: 'editing', filePath: slidePath })],
            expect.any(Function),
        );
        expect(h.setJsonData).toHaveBeenCalledExactlyOnceWith(genChange().json);
        expect(h.refresh).toHaveBeenCalledExactlyOnceWith();
        expect(h.backup.mock.invocationCallOrder[0]).toBeLessThan(
            h.setJsonData.mock.invocationCallOrder[0],
        );
    });

    test('a change with no box written needs no canvas check, and says only that Save is needed', async () => {
        h.applySlideAction.mockReturnValue(
            genChange({ checkItems: [], note: '' }),
        );
        const result = await request();
        expect(result.note).toMatch(/^The change is in the document/);
        expect(slideCanvas.canvasItemFromJson).not.toHaveBeenCalled();
        expect(h.setJsonData).toHaveBeenCalledOnce();
    });

    test('a change the slide rules refuse, or one that changes nothing, writes nothing', async () => {
        h.applySlideAction.mockReturnValueOnce({
            isError: true,
            reason: 'There is no slide 9 in “Example”.',
        });
        await expect(request()).resolves.toEqual({
            isError: true,
            reason: 'There is no slide 9 in “Example”.',
        });
        h.applySlideAction.mockReturnValueOnce({
            didChange: false,
            result: { moved: 1 },
            note: 'Slide 1 is already there.',
        });
        await expect(request()).resolves.toEqual({
            moved: 1,
            didChange: false,
            note: 'Slide 1 is already there.',
        });
        expect(h.snapshotEditing).not.toHaveBeenCalled();
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.setJsonData).not.toHaveBeenCalled();
    });

    test('a document the app would not open after the change is refused before any backup', async () => {
        h.validate.mockImplementation(() => {
            throw new Error('Invalid slide data');
        });
        await expect(request()).resolves.toEqual({
            isError: true,
            reason:
                'This app would not open the document after that change, ' +
                'so it was not made: Invalid slide data',
        });
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.setJsonData).not.toHaveBeenCalled();
    });

    test('a box the slide editor would not open is refused by its id', async () => {
        slideCanvas.canvasItemFromJson.mockReturnValue(
            new slideCanvas.CanvasItemError(),
        );
        await expect(request()).resolves.toEqual({
            isError: true,
            reason:
                'Box 3 would not open in the slide editor after that ' +
                'change, so nothing was changed. Read the slide with action ' +
                '"slides" and send only the fields to change.',
        });
        expect(h.backup).not.toHaveBeenCalled();
    });

    test('an unreadable head, a failed backup and a failed write are each reported, never claimed', async () => {
        h.snapshotEditing.mockResolvedValueOnce(null);
        await expect(request()).resolves.toEqual({
            isError: true,
            reason: '"Example" could not be read, so it was not changed.',
        });
        expect(h.backup).not.toHaveBeenCalled();

        h.backup.mockRejectedValueOnce(
            new NoBackupError('The backup folder is full.'),
        );
        await expect(request()).resolves.toEqual({
            isError: true,
            reason: 'The backup folder is full.',
        });
        expect(h.setJsonData).not.toHaveBeenCalled();

        const failure = new Error('disk full');
        h.setJsonData.mockRejectedValueOnce(failure);
        await expect(request()).resolves.toEqual({
            isError: true,
            reason:
                'Added slide 2 to “Example” could not be finished: disk ' +
                'full Anything it did get to do can be put back with ' +
                'owa_undo.',
        });
        expect(h.error).toHaveBeenCalledWith(failure);
        expect(h.refresh).not.toHaveBeenCalled();
    });
});

describe('finding a song by its title', () => {
    test('the user’s own songs of that name come back beside the collection’s hymn, and nothing is written', async () => {
        h.list.mockResolvedValue([
            '/documents/Amazing Grace.owl',
            '/documents/amazing grace (2).owl',
            '/documents/Grace Alone.owl',
        ]);
        const result: any = await handleAgentFileRequest({
            kind: 'lyric',
            action: 'find',
            name: '  Amazing Grace  ',
        });
        expect(result).toMatchObject({
            asked: 'Amazing Grace',
            yours: ['Amazing Grace', 'amazing grace (2)'],
            found: {
                title: 'Amazing Grace',
                authors: ['John Newton'],
                year: '1779',
            },
            nearest: [],
            collectionSize: 36,
        });
        // The words are the collection's own, ready for a create.
        expect(result.found.content).toContain('- Title: Amazing Grace');
        expect(h.list).toHaveBeenCalledWith('/documents', 'lyric');
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.create).not.toHaveBeenCalled();
    });

    test('only a song is found by its title, and the title has to be given', async () => {
        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'find',
                name: 'Amazing Grace',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Only a song can be found by its title.',
        });
        for (const name of [undefined, '   ', 'x'.repeat(121)]) {
            await expect(
                handleAgentFileRequest({ kind: 'lyric', action: 'find', name }),
            ).resolves.toEqual({
                isError: true,
                reason: 'Give the title of the song to find.',
            });
        }
        expect(h.list).not.toHaveBeenCalled();
    });
});

describe('the refusals and failures the lifecycle tests leave out', () => {
    test('slide content that is not JSON is refused before any backup', async () => {
        h.exists.mockResolvedValue(false);
        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'create',
                name: 'Example',
                content: '{ not json',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringMatching(/^That is not valid JSON\. Slide/),
        });
        expect(h.backup).not.toHaveBeenCalled();
    });

    test('a create the document class could not make is reported, not claimed', async () => {
        h.exists.mockResolvedValue(false);
        h.create.mockResolvedValue(null);
        await expect(
            handleAgentFileRequest({
                kind: 'lyric',
                action: 'create',
                name: 'Example',
                content: 'new song',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Making the song “Example” could not be finished: The song ' +
                'could not be created. Anything it did get to do can be put ' +
                'back with owa_undo.',
        });
        expect(h.refresh).not.toHaveBeenCalled();
    });

    test('a hundred names taken: the free name is a stamp of the time', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
            const stamp = Date.now().toString(36);
            await expect(
                handleAgentFileRequest({
                    kind: 'slide',
                    action: 'create',
                    name: 'Example',
                    content: JSON.stringify({ items: newItems }),
                }),
            ).resolves.toMatchObject({
                isError: true,
                reason: expect.stringContaining(`"Example (${stamp})" is free`),
            });
            // The name itself, then "(2)" to "(99)".
            expect(h.exists).toHaveBeenCalledTimes(1 + 98);
        } finally {
            vi.useRealTimers();
        }
    });

    test.each<AgentFileKindNameType>(['slide', 'lyric'])(
        'an update of a %s whose head cannot be read is reported after its backup',
        async (kind) => {
            h.getJsonData.mockResolvedValue(null);
            await expect(
                handleAgentFileRequest({
                    kind,
                    action: 'update',
                    name: 'Example',
                    content:
                        kind === 'slide'
                            ? JSON.stringify({ items: newItems })
                            : 'new song',
                }),
            ).resolves.toEqual({
                isError: true,
                reason:
                    `Changing the ${kind === 'slide' ? 'slide document' : 'song'} ` +
                    '“Example” could not be finished: "Example" could not be ' +
                    'read. Anything it did get to do can be put back with ' +
                    'owa_undo.',
            });
            expect(h.backup).toHaveBeenCalledOnce();
            expect(h.setJsonData).not.toHaveBeenCalled();
            expect(h.setContent).not.toHaveBeenCalled();
            expect(h.refresh).not.toHaveBeenCalled();
        },
    );

    test('a song whose words open-lyric cannot read is still described, without its parts', async () => {
        const failure = new Error('not a song');
        h.getInfo.mockImplementation(() => {
            throw failure;
        });
        await expect(
            handleAgentFileRequest({
                kind: 'lyric',
                action: 'info',
                name: 'Example',
            }),
        ).resolves.toMatchObject({
            name: 'Example',
            characters: 'saved song'.length,
            title: null,
            key: null,
            sections: [],
        });
        expect(h.error).toHaveBeenCalledWith(failure);
    });

    test('a document that cannot be read is not reported as having unsaved changes', async () => {
        h.getJsonData.mockResolvedValue(null);
        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'info',
                name: 'Example',
            }),
        ).resolves.toMatchObject({
            hasUnsavedChanges: false,
            slideCount: 0,
            dimensions: null,
        });
    });

    test('a rename onto a name outside the folder, or a bad new name, is refused', async () => {
        h.join.mockImplementation((dir: string, file: string) =>
            file.startsWith('Renamed')
                ? '/elsewhere/Renamed.ows'
                : path.posix.join(dir, file),
        );
        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'rename',
                name: 'Example',
                newName: 'Renamed',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That new name would not stay inside the Documents folder.',
        });
        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'rename',
                name: 'Example',
                newName: '../Renamed',
            }),
        ).resolves.toMatchObject({ isError: true });
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.rename).not.toHaveBeenCalled();
    });
});

describe('revert: the saved state put back behind a backup', () => {
    const revert = () =>
        handleAgentFileRequest({
            kind: 'slide',
            action: 'revert',
            name: 'Example',
        });

    beforeEach(() => {
        // The head differs from the saved file.
        h.getJsonData.mockImplementation(async (isOriginal?: boolean) => ({
            metadata,
            items: isOriginal ? oldItems : newItems,
        }));
    });

    test('a document that is not there is refused', async () => {
        h.exists.mockResolvedValue(false);
        await expect(revert()).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('There is no slide document'),
        });
        expect(h.getJsonData).not.toHaveBeenCalled();
    });

    test('a saved file that cannot be read, or a head that cannot be kept, changes nothing', async () => {
        h.getJsonData.mockImplementation(async (isOriginal?: boolean) =>
            isOriginal ? null : { metadata, items: newItems },
        );
        await expect(revert()).resolves.toEqual({
            isError: true,
            reason: '"Example" could not be read, so it was not changed.',
        });
        expect(h.snapshotEditing).not.toHaveBeenCalled();

        h.getJsonData.mockImplementation(async (isOriginal?: boolean) => ({
            metadata,
            items: isOriginal ? oldItems : newItems,
        }));
        h.snapshotEditing.mockResolvedValueOnce(null);
        await expect(revert()).resolves.toEqual({
            isError: true,
            reason: '"Example" could not be read, so it was not changed.',
        });
        expect(h.backup).not.toHaveBeenCalled();
        expect(h.setJsonData).not.toHaveBeenCalled();
    });

    test('a write that fails after the backup is reported with the way back', async () => {
        h.setJsonData.mockRejectedValue(new Error('disk full'));
        await expect(revert()).resolves.toEqual({
            isError: true,
            reason:
                'Putting the slide document “Example” back could not be ' +
                'finished: disk full Anything it did get to do can be put ' +
                'back with owa_undo.',
        });
        expect(h.backup).toHaveBeenCalledOnce();
        expect(h.setJsonData).toHaveBeenCalledWith({
            metadata,
            items: oldItems,
        });
        expect(h.refresh).not.toHaveBeenCalled();
    });
});
