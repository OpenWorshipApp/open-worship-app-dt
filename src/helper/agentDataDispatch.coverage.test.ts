import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dir: null as string | null,
        throwDir: false,
        bible: null as any,
        note: null as any,
    },
    mocks: { handleError: vi.fn(), fsList: vi.fn(), listAgentFiles: vi.fn() },
}));

vi.mock('../server/appProvider', () => ({ default: { isPageReader: false } }));
vi.mock('../bible-list/Bible', () => ({
    default: {
        getDirSourceSettingName: () => 'bibles',
        fromFilePath: async () => state.bible,
    },
}));
vi.mock('../bible-list/note/Note', () => ({
    default: { fromFilePath: async () => state.note },
}));
vi.mock('../bible-list/note/NoteItem', () => ({ default: class NoteItem {} }));
vi.mock('./FileSource', () => ({
    default: {
        getInstance: (path: string) => ({
            name: path.split('/').at(-1)?.split('.')[0],
        }),
    },
}));
vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: () => {
            if (state.throwDir) throw new Error('dir failed');
            return state.dir;
        },
    },
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: { DOCUMENT: 'documents', BIBLE_NOTES: 'notes' },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../../tools/owa-devtools-mcp/agentFileName.mjs', () => ({
    checkAgentFileName: (value: unknown) =>
        typeof value === 'string' && value.trim() !== ''
            ? null
            : 'A name is required.',
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: vi.fn(),
    fsListFilesWithMimetype: (...args: any[]) => mocks.fsList(...args),
    getMimetypeExtensions: (kind: string) => [
        kind === 'note' ? '.own' : kind === 'bible' ? '.owb' : '.ows',
    ],
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    findAgentFreeName: vi.fn(),
    genNoBackupReason: (error: unknown) => String(error),
    genUndoField: () => ({}),
    listAgentFiles: (...args: any[]) => mocks.listAgentFiles(...args),
    renameAgentFile: vi.fn(),
    runWithAgentBackup: vi.fn(),
    snapshotAgentEditing: vi.fn(),
    snapshotAgentFile: vi.fn(),
    snapshotAgentFileForDelete: vi.fn(),
    snapshotAgentSidecars: vi.fn(),
    toAgentFilePath: (dir: string, name: string, ext: string) =>
        `${dir}/${name}${ext}`,
    trashAgentFile: vi.fn(),
}));
vi.mock('./agentSlideHelpers', () => ({
    applyAgentSlideAction: vi.fn(),
    checkIsAgentSlideAction: () => false,
    readAgentSlideDocument: vi.fn(),
    readAgentSlideRequest: vi.fn(),
}));
vi.mock('./agentNoteTextHelpers', () => ({
    AGENT_NOTE_TEXT_MAX_CHARS: 20000,
    readLexicalMentions: () => [],
    readLexicalText: () => '',
    toFirstWords: (value: string) => value,
    toLexicalContent: (value: string) => value,
}));

import { handleAgentFileRequest } from './agentFileHelpers';
import { handleAgentBibleListRequest } from './agentBibleListHelpers';
import { handleAgentNoteRequest } from './agentNoteHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.dir = null;
    state.throwDir = false;
    state.bible = null;
    state.note = null;
    mocks.fsList.mockResolvedValue([]);
    mocks.listAgentFiles.mockResolvedValue([]);
});

describe('agent data request dispatch boundaries', () => {
    test('file requests reject unknown kinds, missing folders, names, content, and actions', async () => {
        await expect(handleAgentFileRequest({} as any)).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('Unknown kind'),
        });
        await expect(
            handleAgentFileRequest({ kind: 'lyric', action: 'list' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('No Documents folder'),
        });
        state.dir = '/documents';
        await expect(
            handleAgentFileRequest({ kind: 'lyric', action: 'info' } as any),
        ).resolves.toMatchObject({ reason: 'A name is required.' });
        await expect(
            handleAgentFileRequest({
                kind: 'lyric',
                action: 'create',
                name: 'Song',
            } as any),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Content is required'),
        });
        await expect(
            handleAgentFileRequest({
                kind: 'lyric',
                action: 'mystery',
                name: 'Song',
            } as any),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Unknown action'),
        });
        await expect(
            handleAgentFileRequest({
                kind: 'slide',
                action: 'mystery',
                name: 'Deck',
            } as any),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('add-slide'),
        });
        mocks.fsList.mockResolvedValueOnce([
            '/documents/Alpha.owl',
            '/documents/Beta.owl',
        ]);
        await expect(
            handleAgentFileRequest({ kind: 'lyric', action: 'list' }),
        ).resolves.toMatchObject({
            folder: '/documents',
            count: 2,
            names: ['Alpha', 'Beta'],
            isTruncated: false,
        });
        state.throwDir = true;
        await expect(
            handleAgentFileRequest({ kind: 'lyric', action: 'list' }),
        ).resolves.toMatchObject({ reason: 'dir failed' });
        expect(mocks.handleError).toHaveBeenCalled();
    });

    test('Bible-list requests validate actions and configuration and contain exceptions', async () => {
        await expect(
            handleAgentBibleListRequest({ action: 'wat' } as any),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Unknown action'),
        });
        await expect(
            handleAgentBibleListRequest({ action: 'list' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('No Bibles folder'),
        });
        state.dir = '/bibles';
        mocks.listAgentFiles.mockResolvedValueOnce([
            { name: 'Default', filePath: '/bibles/Default.owb' },
        ]);
        state.bible = {
            items: [
                {
                    id: 1,
                    bibleKey: 'KJV',
                    toTitleWithBibleKey: async () => 'John 3:16',
                },
            ],
        };
        await expect(
            handleAgentBibleListRequest({ action: 'list' }),
        ).resolves.toEqual({
            where: 'Presenter',
            lists: [
                {
                    name: 'Default',
                    count: 1,
                    items: [{ id: 1, title: 'John 3:16' }],
                },
            ],
        });
        state.throwDir = true;
        await expect(
            handleAgentBibleListRequest({ action: 'list' }),
        ).resolves.toMatchObject({ reason: 'dir failed' });
        expect(mocks.handleError).toHaveBeenCalled();
    });

    test('note requests validate actions and configuration and contain exceptions', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'wat' } as any),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Unknown action'),
        });
        await expect(
            handleAgentNoteRequest({ action: 'list' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('No Bible notes folder'),
        });
        state.dir = '/notes';
        mocks.listAgentFiles.mockResolvedValueOnce([
            { name: 'Default', filePath: '/notes/Default.own' },
        ]);
        state.note = {
            items: [
                { id: -1 },
                {
                    id: 1,
                    isVerseItem: true,
                    title: 'Verse',
                    verseKey: 'JHN.3.16',
                    highlights: [1],
                    comments: [1, 2],
                },
                { id: 2, isVerseItem: false, title: 'Note', content: 'Words' },
            ],
        };
        await expect(
            handleAgentNoteRequest({ action: 'list' }),
        ).resolves.toEqual({
            files: [
                {
                    name: 'Default',
                    count: 2,
                    notes: [
                        {
                            id: 1,
                            kind: 'verse-marks',
                            title: 'Verse',
                            verse: 'JHN.3.16',
                            highlights: 1,
                            comments: 2,
                        },
                        { id: 2, kind: 'note', title: 'Note', firstWords: '' },
                    ],
                },
            ],
        });
        state.throwDir = true;
        await expect(
            handleAgentNoteRequest({ action: 'list' }),
        ).resolves.toMatchObject({ reason: 'dir failed' });
        expect(mocks.handleError).toHaveBeenCalled();
    });
});
