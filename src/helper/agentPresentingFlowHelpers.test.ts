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
            getItems: async () => state.items.map(toItem),
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
    resolveVersionOrder: async (version: string | null) => ({
        order: [version ?? 'KJV'],
        installed: [version ?? 'KJV'],
    }),
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
    toAgentFilePath: (dir: string, name: string, extension: string) =>
        `${dir}/${name}.${extension}`,
    trashAgentFile: (...args: any[]) => mocks.trashAgentFile(...args),
}));

import { handleAgentPresentingFlowRequest } from './agentPresentingFlowHelpers';

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
