import { beforeEach, describe, expect, test, vi } from 'vitest';

// `revert` on the document tools: the editor's Discard made undoable. The
// saved file's content goes back into the editing history behind a backup of
// the head it replaces; a document already matching its file is left alone.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        saved: { metadata: {}, content: 'saved words' } as any,
        head: { metadata: {}, content: 'edited words' } as any,
    },
    mocks: {
        setJsonData: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentEditing: vi.fn(),
        fireUpdateEvent: vi.fn(),
    },
}));

vi.mock('../lyric-list/Lyric', () => ({
    default: {
        getInstance: () => ({
            getJsonData: async (isOriginal = false) =>
                isOriginal ? state.saved : state.head,
            setJsonData: (...args: any[]) => mocks.setJsonData(...args),
        }),
    },
}));
vi.mock('../app-document-list/AppDocument', () => ({ default: {} }));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            name: filePath.split('/').at(-1)?.split('.')[0],
            fireUpdateEvent: mocks.fireUpdateEvent,
        }),
    },
}));
vi.mock('./DirSource', () => ({
    default: { getDirPathBySettingName: () => '/documents' },
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'documents' },
}));
vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../../tools/owa-devtools-mcp/agentFileName.mjs', () => ({
    checkAgentFileName: () => null,
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async () => true,
    fsListFilesWithMimetype: async () => [],
    getMimetypeExtensions: () => ['owl'],
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    genNoBackupReason: (error: unknown) => String(error),
    genUndoField: () => ({ undoId: 'backup-id' }),
    renameAgentFile: vi.fn(),
    runWithAgentBackup: (...args: any[]) => mocks.runWithAgentBackup(...args),
    snapshotAgentEditing: (...args: any[]) =>
        mocks.snapshotAgentEditing(...args),
    snapshotAgentFileForDelete: vi.fn(),
    trashAgentFile: vi.fn(),
}));
vi.mock('./agentSlideHelpers', () => ({
    applyAgentSlideAction: vi.fn(),
    checkIsAgentSlideAction: () => false,
    readAgentSlideDocument: vi.fn(),
    readAgentSlideRequest: vi.fn(),
}));

import { handleAgentFileRequest } from './agentFileHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.head = { metadata: {}, content: 'edited words' };
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => ({ meta: { id: 'backup-id' }, value: await change() }),
    );
    mocks.snapshotAgentEditing.mockResolvedValue({
        type: 'editing',
        kind: 'lyric',
        filePath: '/documents/Amazing Grace.owl',
        text: '{}',
    });
});

describe('revert', () => {
    test('puts the saved content back into the history behind a backup', async () => {
        await expect(
            handleAgentFileRequest({
                kind: 'lyric',
                action: 'revert',
                name: 'Amazing Grace',
            }),
        ).resolves.toMatchObject({
            reverted: 'Amazing Grace',
            isSaved: true,
            undoId: 'backup-id',
        });
        expect(mocks.snapshotAgentEditing).toHaveBeenCalledWith(
            'lyric',
            '/documents/Amazing Grace.owl',
        );
        expect(mocks.runWithAgentBackup.mock.calls[0][0]).toContain(
            'back to its saved state',
        );
        expect(mocks.setJsonData).toHaveBeenCalledWith(state.saved);
        expect(mocks.fireUpdateEvent).toHaveBeenCalledOnce();
    });

    test('changes nothing when the document already matches its file', async () => {
        state.head = { metadata: {}, content: 'saved words' };
        await expect(
            handleAgentFileRequest({
                kind: 'lyric',
                action: 'revert',
                name: 'Amazing Grace',
            }),
        ).resolves.toMatchObject({ didChange: false });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(mocks.setJsonData).not.toHaveBeenCalled();
    });
});
