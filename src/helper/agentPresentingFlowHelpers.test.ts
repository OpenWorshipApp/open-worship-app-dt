import { beforeEach, describe, expect, test, vi } from 'vitest';

// The worker behind `owa_presenting_flow`, driven against a run sheet that
// lives in memory: what each action asks the sheet to do, what it refuses, and
// that every change takes its backup first. The disk, the trash and the real
// `PresentingFlow` are mocked -- the rules are the subject, not the file.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dirPath: '/flows' as string | null,
        documentsDirPath: '/documents' as string | null,
        files: ['/flows/Sunday.owapf'] as string[],
        documents: {
            appDocument: ['/documents/Welcome.ows'],
            lyric: ['/documents/Amazing Grace.owl'],
        } as Record<string, string[]>,
        items: [] as any[],
        // The sheet reading back as nothing (a damaged file), or throwing.
        isUnreadable: false,
        readError: null as Error | null,
    },
    mocks: {
        handleError: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentEditing: vi.fn(),
        snapshotAgentFileForDelete: vi.fn(),
        renameAgentFile: vi.fn(),
        trashAgentFile: vi.fn(),
        create: vi.fn(),
        addItem: vi.fn(),
        addActionItem: vi.fn(),
        removeItemAtIndex: vi.fn(),
        duplicateItemAtIndex: vi.fn(),
        moveItemToIndex: vi.fn(),
        setItemDisabled: vi.fn(),
        resolveBibleItem: vi.fn(),
    },
}));

function toItem(json: any) {
    return {
        title: json.title ?? json.data,
        type: json.type,
        data: json.data,
        isError: json.type === 'error',
        isAction: json.type === 'action',
        isDisabled: json.isDisabled === true,
        screenIds: json.screenIds ?? [],
    };
}

vi.mock('../presenting-flow/PresentingFlow', () => ({
    default: {
        create: (...args: any[]) => mocks.create(...args),
        getInstance: () => ({
            getItems: async () => {
                if (state.readError !== null) {
                    throw state.readError;
                }
                return state.isUnreadable ? null : state.items.map(toItem);
            },
            addItem: (...args: any[]) => mocks.addItem(...args),
            addActionItem: (...args: any[]) => mocks.addActionItem(...args),
            removeItemAtIndex: (...args: any[]) =>
                mocks.removeItemAtIndex(...args),
            duplicateItemAtIndex: (...args: any[]) =>
                mocks.duplicateItemAtIndex(...args),
            moveItemToIndex: (...args: any[]) => mocks.moveItemToIndex(...args),
            setItemDisabled: (...args: any[]) => mocks.setItemDisabled(...args),
        }),
    },
}));
vi.mock('../presenting-flow/presentingFlowActionHelpers', () => ({
    presentingFlowActionList: [
        { id: 'clear-all', label: 'Clear All', target: 'screen' },
        {
            id: 'screen-show',
            label: 'Screen: Show',
            target: 'screen',
            requiresScreenIds: true,
        },
        { id: 'next-timeout', label: 'Next: Timeout', target: 'run' },
    ],
    findPresentingFlowAction: (id: string) =>
        [
            { id: 'clear-all', label: 'Clear All', target: 'screen' },
            {
                id: 'screen-show',
                label: 'Screen: Show',
                target: 'screen',
                requiresScreenIds: true,
            },
            { id: 'next-timeout', label: 'Next: Timeout', target: 'run' },
        ].find((one) => one.id === id) ?? null,
}));
vi.mock('./agentBibleHelpers', () => ({
    MAX_REFERENCE_LENGTH: 100,
    resolveVersionOrder: async (version: string | null) =>
        version === 'NOPE'
            ? { reason: 'There is no Bible called "NOPE".', versions: ['KJV'] }
            : {
                  order: [version ?? 'KJV'],
                  installed: [version ?? 'KJV'],
              },
    resolveBibleItem: (...args: any[]) => mocks.resolveBibleItem(...args),
}));
vi.mock('./DragInf', () => ({
    DragTypeEnum: { APP_DOCUMENT: 'appDocument', BIBLE_ITEM: 'bibleItem' },
}));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => {
            const fullName = filePath.split('/').at(-1) ?? '';
            return {
                filePath,
                fullName,
                name: fullName.replace(/\.[^.]+$/, ''),
                fireUpdateEvent: vi.fn(),
            };
        },
    },
}));
vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (settingName: string) =>
            settingName === 'flows' ? state.dirPath : state.documentsDirPath,
    },
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: {
        PRESENTING_FLOW: 'flows',
        APP_DOCUMENT: 'documents',
    },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../../tools/owa-devtools-mcp/agentFileName.mjs', () => ({
    checkAgentFileName: (value: unknown) =>
        typeof value === 'string' && value.trim() !== '' && !value.includes('/')
            ? null
            : 'A name is required.',
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async (filePath: string) =>
        state.files.includes(filePath),
    fsListFilesWithMimetype: async (_dir: string, mimetypeName: string) =>
        state.documents[mimetypeName] ?? [],
    getMimetypeExtensions: () => ['owapf'],
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
    findAgentFreeName: async (_dir: string, name: string) => `${name} (2)`,
    genNoBackupReason: (error: unknown) => String(error),
    genUndoField: () => ({ undoId: 'backup-id' }),
    listAgentFiles: async () =>
        state.files.map((filePath) => ({
            filePath,
            name: filePath
                .split('/')
                .at(-1)
                ?.replace(/\.[^.]+$/, ''),
        })),
    renameAgentFile: (...args: any[]) => mocks.renameAgentFile(...args),
    runWithAgentBackup: (...args: any[]) => mocks.runWithAgentBackup(...args),
    snapshotAgentEditing: (...args: any[]) =>
        mocks.snapshotAgentEditing(...args),
    snapshotAgentFileForDelete: (...args: any[]) =>
        mocks.snapshotAgentFileForDelete(...args),
    // A name that would climb out of the folder has no path in it.
    toAgentFilePath: (dir: string, name: string, extension: string) =>
        name.startsWith('..') ? null : `${dir}/${name}.${extension}`,
    trashAgentFile: (...args: any[]) => mocks.trashAgentFile(...args),
}));

import { handleAgentPresentingFlowRequest } from './agentPresentingFlowHelpers';
import { NoBackupError } from './agentBackupHelpers';

const SUNDAY = '/flows/Sunday.owapf';

beforeEach(() => {
    vi.clearAllMocks();
    state.dirPath = '/flows';
    state.documentsDirPath = '/documents';
    state.files = [SUNDAY];
    state.documents = {
        appDocument: ['/documents/Welcome.ows'],
        lyric: ['/documents/Amazing Grace.owl'],
    };
    state.items = [
        {
            type: 'appDocument',
            title: 'Welcome',
            data: '/documents/Welcome.ows',
        },
        { type: 'action', data: 'clear-all', title: 'Clear All' },
    ];
    state.isUnreadable = false;
    state.readError = null;
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => ({ meta: { id: 'backup-id' }, value: await change() }),
    );
    mocks.snapshotAgentEditing.mockResolvedValue({ type: 'editing' });
    mocks.snapshotAgentFileForDelete.mockResolvedValue([{ type: 'file' }]);
    for (const name of [
        'addItem',
        'addActionItem',
        'removeItemAtIndex',
        'duplicateItemAtIndex',
        'moveItemToIndex',
        'setItemDisabled',
    ] as const) {
        mocks[name].mockResolvedValue(true);
    }
    mocks.create.mockImplementation(async (dir: string, name: string) => ({
        name,
        filePath: `${dir}/${name}.owapf`,
        fireUpdateEvent: vi.fn(),
    }));
    mocks.renameAgentFile.mockResolvedValue('/flows/Monday.owapf');
});

describe('owa_presenting_flow worker', () => {
    test('lists the sheets and reads one with its lines', async () => {
        await expect(
            handleAgentPresentingFlowRequest({ action: 'list' }),
        ).resolves.toEqual({
            folder: '/flows',
            count: 1,
            names: ['Sunday'],
            isTruncated: false,
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'info',
                name: 'Sunday',
            }),
        ).resolves.toEqual({
            name: 'Sunday',
            filePath: SUNDAY,
            count: 2,
            lines: [
                { n: 1, title: 'Welcome', kind: 'appDocument' },
                { n: 2, title: 'Clear All', kind: 'action:clear-all' },
            ],
        });
    });

    test('refuses with the sheets there are, a missing folder and an unknown action', async () => {
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'info',
                name: 'Monday',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('"Sunday"'),
        });
        await expect(
            handleAgentPresentingFlowRequest({ action: 'wat', name: 'Sunday' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Unknown action'),
        });
        state.dirPath = null;
        await expect(
            handleAgentPresentingFlowRequest({ action: 'list' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('No Presenting Flows folder'),
        });
    });

    test('creates, renames and trashes a sheet, each behind a backup', async () => {
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'create',
                name: 'Monday',
            }),
        ).resolves.toMatchObject({ created: 'Monday', undoId: 'backup-id' });
        expect(mocks.create).toHaveBeenCalledWith('/flows', 'Monday');
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            {
                type: 'file',
                filePath: '/flows/Monday.owapf',
                text: null,
                kind: 'presentingFlow',
            },
        ]);
        // A taken name is refused with a free one, never overwritten.
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'create',
                name: 'Sunday',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('"Sunday (2)" is free'),
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'rename',
                name: 'Sunday',
                newName: 'Monday',
            }),
        ).resolves.toMatchObject({
            renamedFrom: 'Sunday',
            renamedTo: 'Monday',
        });
        expect(mocks.renameAgentFile).toHaveBeenCalledWith(
            SUNDAY,
            'Monday',
            'presentingFlow',
        );
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'delete',
                name: 'Sunday',
            }),
        ).resolves.toMatchObject({ deleted: 'Sunday', isInTrash: true });
        expect(mocks.snapshotAgentFileForDelete).toHaveBeenCalledWith(
            SUNDAY,
            'presentingFlow',
        );
        expect(mocks.trashAgentFile).toHaveBeenCalledWith(
            SUNDAY,
            'presentingFlow',
        );
    });

    test('adds a document by its Documents-list name, the way a drop does', async () => {
        mocks.addItem.mockImplementation(async () => {
            state.items.push({
                type: 'appDocument',
                title: 'Amazing Grace',
                data: '/documents/Amazing Grace.owl',
            });
            return true;
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                document: 'Amazing Grace',
            }),
        ).resolves.toMatchObject({
            added: 'Amazing Grace',
            line: 3,
            count: 3,
            undoId: 'backup-id',
        });
        expect(mocks.addItem).toHaveBeenCalledWith(
            {
                type: 'appDocument',
                item: { filePath: '/documents/Amazing Grace.owl' },
            },
            { type: 'appDocument', data: '/documents/Amazing Grace.owl' },
            undefined,
        );
        expect(mocks.snapshotAgentEditing).toHaveBeenCalledWith(
            'presentingFlow',
            SUNDAY,
        );
    });

    test('names a document it cannot find, and two that share a name', async () => {
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                document: 'Nowhere',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('no document called "Nowhere"'),
        });
        state.documents.appDocument.push('/documents/Amazing Grace.ows');
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                document: 'Amazing Grace',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('"Amazing Grace.owl"'),
        });
        expect(mocks.addItem).not.toHaveBeenCalled();
    });

    test('adds a passage through the Bible resolvers, at a chosen line', async () => {
        const dragData = { type: 'bibleItem', data: 'serialized' };
        const bibleItem = { dragSerialize: () => dragData };
        mocks.resolveBibleItem.mockResolvedValue(bibleItem);
        mocks.addItem.mockImplementation(async () => {
            state.items.splice(0, 0, {
                type: 'bibleItem',
                title: 'John 3:16',
            });
            return true;
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                reference: 'John 3:16',
                at: 1,
            }),
        ).resolves.toMatchObject({ added: 'John 3:16', line: 1, count: 3 });
        expect(mocks.addItem).toHaveBeenCalledWith(
            { type: 'bibleItem', item: bibleItem },
            dragData,
            0,
        );
        mocks.resolveBibleItem.mockResolvedValue(null);
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                reference: 'Nonsense 99:99',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('could not be read as a passage'),
        });
    });

    test('adds an action by id, insisting on screens where the app does', async () => {
        mocks.addActionItem.mockImplementation(async () => {
            state.items.push({
                type: 'action',
                data: 'next-timeout',
                title: 'Next: Timeout',
            });
            return true;
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                actionId: 'next-timeout',
                seconds: 30,
            }),
        ).resolves.toMatchObject({ added: 'Next: Timeout', line: 3, count: 3 });
        expect(mocks.addActionItem).toHaveBeenCalledWith(
            'next-timeout',
            { actionNumber: 30 },
            undefined,
            [],
        );
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                actionId: 'screen-show',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('screenIds'),
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                actionId: 'no-such-thing',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'clear-all, screen-show, next-timeout',
            ),
        });
        await expect(
            handleAgentPresentingFlowRequest({ action: 'add', name: 'Sunday' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Say what to add'),
        });
    });

    test('removes, copies, moves and parks a line, by number, after a backup', async () => {
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'remove',
                name: 'Sunday',
                line: 2,
            }),
        ).resolves.toMatchObject({ removed: 'Clear All', line: 2 });
        expect(mocks.removeItemAtIndex).toHaveBeenCalledWith(1);
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'duplicate',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toMatchObject({ copied: 'Welcome', line: 2 });
        expect(mocks.duplicateItemAtIndex).toHaveBeenCalledWith(0);
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'move',
                name: 'Sunday',
                line: 1,
                to: 2,
            }),
        ).resolves.toMatchObject({ moved: 'Welcome', from: 1, to: 2 });
        expect(mocks.moveItemToIndex).toHaveBeenCalledWith(0, 1);
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'park',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toMatchObject({ parked: 'Welcome', isParked: true });
        expect(mocks.setItemDisabled).toHaveBeenCalledWith(0, true);
        // Every change above took its backup first.
        expect(mocks.snapshotAgentEditing).toHaveBeenCalledTimes(4);
        expect(mocks.runWithAgentBackup).toHaveBeenCalledTimes(4);
    });

    test('refuses a line that is not there and a park that changes nothing', async () => {
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'remove',
                name: 'Sunday',
                line: 9,
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('1 to 2'),
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'move',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('`to` 1 to 2'),
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'unpark',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toMatchObject({ didChange: false, isParked: false });
        expect(mocks.setItemDisabled).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('says the sheet is as it was when the app refuses the change', async () => {
        mocks.addActionItem.mockResolvedValue(false);
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                actionId: 'clear-all',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('left the sheet as it was'),
        });
    });
});

describe('owa_presenting_flow worker: what it reads back and what it refuses', () => {
    test('reads a parked line, the screens a line runs on and a damaged line', async () => {
        state.items = [
            {
                type: 'appDocument',
                title: 'Welcome',
                data: '/documents/Welcome.ows',
                isDisabled: true,
            },
            {
                type: 'action',
                data: 'screen-show',
                title: 'Screen: Show',
                screenIds: [1, 2],
            },
            { type: 'error', title: 'whatever was there' },
        ];
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'info',
                name: 'Sunday',
            }),
        ).resolves.toEqual({
            name: 'Sunday',
            filePath: SUNDAY,
            count: 3,
            lines: [
                { n: 1, title: 'Welcome', kind: 'appDocument', isParked: true },
                {
                    n: 2,
                    title: 'Screen: Show',
                    kind: 'action:screen-show',
                    screenIds: [1, 2],
                },
                { n: 3, title: 'invalid line', kind: 'error' },
            ],
        });
    });

    test('cuts a long sheet and a long list of sheets, and says so', async () => {
        state.items = Array.from({ length: 201 }, (_, index) => {
            return { type: 'slide', title: `Line ${index + 1}` };
        });
        const info: any = await handleAgentPresentingFlowRequest({
            action: 'info',
            name: 'Sunday',
        });
        expect(info.count).toBe(201);
        expect(info.lines).toHaveLength(200);
        expect(info.isTruncated).toBe(true);
        state.files = Array.from({ length: 61 }, (_, index) => {
            return `/flows/Sheet ${index + 1}.owapf`;
        });
        const list: any = await handleAgentPresentingFlowRequest({
            action: 'list',
        });
        expect(list.count).toBe(61);
        expect(list.names).toHaveLength(60);
        expect(list.isTruncated).toBe(true);
    });

    test('a sheet that reads back as nothing is said so, and nothing is changed', async () => {
        state.isUnreadable = true;
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'info',
                name: 'Sunday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The run sheet "Sunday" could not be read.',
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'remove',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The run sheet "Sunday" could not be read.',
        });
        expect(mocks.removeItemAtIndex).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('no snapshot of the sheet, no change', async () => {
        mocks.snapshotAgentEditing.mockResolvedValue(null);
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'park',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'The run sheet "Sunday" could not be read, so it was not ' +
                'changed.',
        });
        expect(mocks.setItemDisabled).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('a backup that cannot be saved is refused in its own words, and the line stays', async () => {
        mocks.runWithAgentBackup.mockRejectedValueOnce(
            new NoBackupError(
                'No backup could be saved, so nothing was changed.',
            ),
        );
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'duplicate',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'No backup could be saved, so nothing was changed.',
        });
        expect(mocks.duplicateItemAtIndex).not.toHaveBeenCalled();
        // A missing backup is an answer, not an error to report.
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('a delete whose snapshot fails trashes nothing', async () => {
        mocks.snapshotAgentFileForDelete.mockRejectedValueOnce(
            new Error('disk full'),
        );
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'delete',
                name: 'Sunday',
            }),
        ).resolves.toEqual({ isError: true, reason: 'Error: disk full' });
        expect(mocks.trashAgentFile).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('refuses a name that is no name, or that would leave the folder, before touching a file', async () => {
        const refusals: [Record<string, unknown>, string][] = [
            [{ action: 'create', name: '' }, 'A name is required.'],
            [
                { action: 'create', name: '..Escape' },
                'That name would not stay inside the Presenting Flows folder.',
            ],
            [{ action: 'info', name: 'a/b' }, 'A name is required.'],
            [
                { action: 'info', name: '..Sunday' },
                'That name would not stay inside the Presenting Flows folder.',
            ],
            [
                { action: 'rename', name: 'Sunday', newName: ' ' },
                'A name is required.',
            ],
            [
                { action: 'rename', name: 'Sunday', newName: '..Up' },
                'That new name would not stay inside the Presenting Flows ' +
                    'folder.',
            ],
        ];
        for (const [request, reason] of refusals) {
            await expect(
                handleAgentPresentingFlowRequest(request),
                JSON.stringify(request),
            ).resolves.toEqual({ isError: true, reason });
        }
        state.files = [SUNDAY, '/flows/Monday.owapf'];
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'rename',
                name: 'Sunday',
                newName: 'Monday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Something called "Monday" is already there, so "Sunday" ' +
                'was not renamed.',
        });
        state.files = [];
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'info',
                name: 'Sunday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'There is no run sheet called "Sunday". There are none yet ' +
                '-- action "create" makes one.',
        });
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.renameAgentFile).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('says what could not be finished, and that owa_undo puts back what was done', async () => {
        mocks.create.mockResolvedValueOnce(null);
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'create',
                name: 'Monday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Making the run sheet “Monday” could not be finished: The ' +
                'run sheet could not be created. Anything it did get to do ' +
                'can be put back with owa_undo.',
        });
        mocks.renameAgentFile.mockRejectedValueOnce('the file is in use');
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'rename',
                name: 'Sunday',
                newName: 'Monday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Renaming the run sheet “Sunday” could not be finished: the ' +
                'file is in use Anything it did get to do can be put back ' +
                'with owa_undo.',
        });
        mocks.trashAgentFile.mockRejectedValueOnce(
            new Error('the trash is unavailable'),
        );
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'delete',
                name: 'Sunday',
            }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining(
                'Moving the run sheet “Sunday” to the trash could not be ' +
                    'finished: the trash is unavailable',
            ),
        });
        expect(mocks.handleError).toHaveBeenCalledTimes(3);
    });

    test('refuses an add with no Documents folder, an over-long reference, two things at once or an unknown version', async () => {
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                document: 'Welcome',
                reference: 'John 3:16',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Say what to add'),
        });
        state.documentsDirPath = null;
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                document: 'Welcome',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'No Documents folder is set up yet.',
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                reference: 'J'.repeat(101),
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('longer than a reference'),
        });
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                reference: 'John 3:16',
                version: 'NOPE',
            }),
        ).resolves.toEqual({
            isError: true,
            reason: 'There is no Bible called "NOPE".',
        });
        expect(mocks.resolveBibleItem).not.toHaveBeenCalled();
        expect(mocks.addItem).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('an action on screens keeps only the whole-number screen ids, at the line asked', async () => {
        mocks.addActionItem.mockImplementation(
            async (_id: string, _data: unknown, toIndex?: number) => {
                state.items.splice(toIndex ?? state.items.length, 0, {
                    type: 'action',
                    data: 'screen-show',
                    title: 'Screen: Show',
                });
                return true;
            },
        );
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'add',
                name: 'Sunday',
                actionId: 'screen-show',
                screenIds: [1, 'two', 2.5, 3],
                at: 2,
            }),
        ).resolves.toMatchObject({
            added: 'Screen: Show',
            line: 2,
            count: 3,
            sheet: 'Sunday',
        });
        expect(mocks.addActionItem).toHaveBeenCalledWith(
            'screen-show',
            {},
            1,
            [1, 3],
        );
    });

    test('parks a parked line no further, and puts one back in play', async () => {
        state.items[0].isDisabled = true;
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'park',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toEqual({
            sheet: 'Sunday',
            line: 1,
            isParked: true,
            didChange: false,
            note: 'That line was parked already.',
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'unpark',
                name: 'Sunday',
                line: 1,
            }),
        ).resolves.toEqual({
            unparked: 'Welcome',
            line: 1,
            isParked: false,
            sheet: 'Sunday',
            note: 'It takes part in the run again.',
            undoId: 'backup-id',
        });
        expect(mocks.setItemDisabled).toHaveBeenCalledWith(0, false);
        expect(mocks.snapshotAgentEditing).toHaveBeenCalledOnce();
    });

    test('an unexpected failure is answered, never thrown', async () => {
        state.readError = new Error('the disk went away');
        await expect(
            handleAgentPresentingFlowRequest({
                action: 'info',
                name: 'Sunday',
            }),
        ).resolves.toEqual({ isError: true, reason: 'the disk went away' });
        expect(mocks.handleError).toHaveBeenCalledWith(state.readError);
    });
});
