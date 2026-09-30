import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dir: null as string | null,
        throwDir: false,
        bible: null as any,
        note: null as any,
    },
    mocks: {
        handleError: vi.fn(),
        fsList: vi.fn(),
        listAgentFiles: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentFile: vi.fn(),
        snapshotAgentEditing: vi.fn(),
        snapshotAgentFileForDelete: vi.fn(),
        snapshotAgentSidecars: vi.fn(),
        renameAgentFile: vi.fn(),
        trashAgentFile: vi.fn(),
        createNote: vi.fn(),
        createBible: vi.fn(),
        detachBackground: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({ default: { isPageReader: false } }));
vi.mock('../bible-list/Bible', () => ({
    default: {
        getDirSourceSettingName: () => 'bibles',
        fromFilePath: async () => state.bible,
        getDefault: async () => state.bible,
        create: (...args: any[]) => mocks.createBible(...args),
    },
}));
vi.mock('./agentBibleHelpers', () => ({
    MAX_REFERENCE_LENGTH: 100,
    resolveVersionOrder: async (version: string | null) => ({
        order: [version ?? 'KJV'],
        installed: [version ?? 'KJV'],
    }),
    resolveBibleItem: async (reference: string, order: string[]) => ({
        id: 99,
        bibleKey: order[0],
        target: { bookKey: reference, chapter: 1, verseStart: 1, verseEnd: 1 },
        toTitleWithBibleKey: async () => `${order[0]} ${reference}`,
    }),
}));
vi.mock('../bible-list/note/Note', () => ({
    default: {
        fromFilePath: async () => state.note,
        getDefault: async () => state.note,
        create: (...args: any[]) => mocks.createNote(...args),
    },
}));
vi.mock('../bible-list/note/NoteItem', () => ({
    default: class NoteItem {
        static genNewJsonData() {
            return { title: '', content: '' };
        }
        constructor(data: any) {
            Object.assign(this, data);
        }
    },
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        detachBackground: (...args: any[]) => mocks.detachBackground(...args),
    },
}));
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
    renameAgentFile: (...args: any[]) => mocks.renameAgentFile(...args),
    runWithAgentBackup: (...args: any[]) => mocks.runWithAgentBackup(...args),
    snapshotAgentEditing: (...args: any[]) =>
        mocks.snapshotAgentEditing(...args),
    snapshotAgentFile: (...args: any[]) => mocks.snapshotAgentFile(...args),
    snapshotAgentFileForDelete: (...args: any[]) =>
        mocks.snapshotAgentFileForDelete(...args),
    snapshotAgentSidecars: (...args: any[]) =>
        mocks.snapshotAgentSidecars(...args),
    toAgentFilePath: (dir: string, name: string, ext: string) =>
        `${dir}/${name}${ext}`,
    trashAgentFile: (...args: any[]) => mocks.trashAgentFile(...args),
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
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => ({
            meta: { id: 'backup-id' },
            value: await change(),
        }),
    );
    mocks.snapshotAgentFile.mockResolvedValue({ type: 'file' });
    mocks.snapshotAgentEditing.mockResolvedValue(null);
    mocks.snapshotAgentFileForDelete.mockResolvedValue([{ type: 'file' }]);
    mocks.snapshotAgentSidecars.mockResolvedValue([]);
    mocks.createNote.mockResolvedValue({});
    mocks.createBible.mockResolvedValue({});
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

    test('reads, adds, updates and deletes notes through a fresh saved file', async () => {
        state.dir = '/notes';
        mocks.listAgentFiles.mockResolvedValue([
            { name: 'Default', filePath: '/notes/Default.own' },
        ]);
        const noteItem = {
            id: 3,
            isVerseItem: false,
            title: 'Before',
            content: 'old words',
        };
        const note = {
            maxItemId: 3,
            items: [noteItem],
            getItemById: (id: number) => (id === 3 ? noteItem : null),
            addNoteItem: vi.fn(),
            updateNoteItem: vi.fn(),
            deleteItem: vi.fn(),
            save: vi.fn(async () => true),
            syncItemEditingHistory: vi.fn(),
        };
        state.note = note;

        await expect(
            handleAgentNoteRequest({ action: 'read', id: 3 }),
        ).resolves.toMatchObject({
            file: 'Default',
            id: 3,
            kind: 'note',
            title: 'Before',
        });
        await expect(
            handleAgentNoteRequest({
                action: 'add',
                title: 'Added',
                text: 'new',
            }),
        ).resolves.toMatchObject({ added: 'Added', id: 4 });
        expect(note.addNoteItem).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Added', content: 'new' }),
        );
        await expect(
            handleAgentNoteRequest({
                action: 'update',
                id: 3,
                title: 'After',
                text: 'new words',
            }),
        ).resolves.toMatchObject({ updated: 'After', id: 3 });
        expect(note.updateNoteItem).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'After', content: 'new words' }),
            true,
        );
        expect(note.syncItemEditingHistory).toHaveBeenCalledOnce();
        await expect(
            handleAgentNoteRequest({ action: 'delete', id: 3 }),
        ).resolves.toMatchObject({ deleted: 'After' });
        expect(note.deleteItem).toHaveBeenCalledWith(noteItem);
        expect(note.save).toHaveBeenCalledTimes(3);
    });

    test('keeps verse marks read-only and reports unavailable note ids', async () => {
        state.dir = '/notes';
        mocks.listAgentFiles.mockResolvedValue([
            { name: 'Default', filePath: '/notes/Default.own' },
        ]);
        const verseItem = {
            id: 1,
            isVerseItem: true,
            title: 'John 3:16',
            verseKey: 'JHN.3.16',
            highlights: [{ text: 'God', color: '#fff' }],
            comments: [{ text: 'love', comment: 'note' }],
        };
        state.note = {
            items: [verseItem],
            getItemById: (id: number) => (id === 1 ? verseItem : null),
        };

        await expect(
            handleAgentNoteRequest({ action: 'read', id: 1 }),
        ).resolves.toMatchObject({
            kind: 'verse-marks',
            marks: [
                { kind: 'highlight', words: 'God' },
                { kind: 'comment', words: 'love' },
            ],
        });
        await expect(
            handleAgentNoteRequest({ action: 'update', id: 1, text: 'nope' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('highlights and comments'),
        });
        await expect(
            handleAgentNoteRequest({ action: 'read', id: 99 }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('no note with the id 99'),
        });
    });

    test('creates, renames and trashes whole note files with an undo backup', async () => {
        state.dir = '/notes';
        mocks.listAgentFiles.mockResolvedValue([]);
        await expect(
            handleAgentNoteRequest({ action: 'create-file', file: 'Sunday' }),
        ).resolves.toMatchObject({ created: 'Sunday' });
        expect(mocks.createNote).toHaveBeenCalledWith('/notes', 'Sunday');

        mocks.listAgentFiles.mockResolvedValue([
            { name: 'Sunday', filePath: '/notes/Sunday.own' },
        ]);
        state.note = { items: [] };
        await expect(
            handleAgentNoteRequest({
                action: 'rename-file',
                file: 'Sunday',
                newName: 'Monday',
            }),
        ).resolves.toMatchObject({
            renamedFrom: 'Sunday',
            renamedTo: 'Monday',
        });
        expect(mocks.renameAgentFile).toHaveBeenCalledWith(
            '/notes/Sunday.own',
            'Monday',
            'note',
        );
        await expect(
            handleAgentNoteRequest({ action: 'delete-file', file: 'Sunday' }),
        ).resolves.toMatchObject({
            deleted: 'Sunday',
            isInTrash: true,
            count: 0,
        });
        expect(mocks.trashAgentFile).toHaveBeenCalledWith(
            '/notes/Sunday.own',
            'note',
        );
    });

    test('adds, updates and removes a Bible item only after a backup', async () => {
        state.dir = '/bibles';
        mocks.listAgentFiles.mockResolvedValue([
            { name: 'Default', filePath: '/bibles/Default.owb' },
        ]);
        const oldItem = {
            id: 5,
            bibleKey: 'KJV',
            target: { bookKey: 'John', chapter: 1, verseStart: 1, verseEnd: 1 },
            toTitleWithBibleKey: async () => 'KJV John 1:1',
            toVerseFullKey: () => 'JHN.1.1',
        };
        const bible = {
            items: [oldItem],
            maxItemId: 5,
            getItemById: (id: number) => (id === 5 ? oldItem : null),
            addBibleItem: vi.fn(),
            setItemById: vi.fn(),
            deleteItem: vi.fn(),
            save: vi.fn(async () => true),
        };
        state.bible = bible;

        await expect(
            handleAgentBibleListRequest({
                action: 'add',
                reference: 'John 3:16',
            }),
        ).resolves.toMatchObject({
            added: 'KJV John 3:16',
            list: 'Default',
            id: 5,
        });
        expect(bible.addBibleItem).toHaveBeenCalledOnce();
        await expect(
            handleAgentBibleListRequest({
                action: 'update',
                id: 5,
                reference: 'John 3:17',
            }),
        ).resolves.toMatchObject({ updated: 'KJV John 3:17', id: 5 });
        expect(bible.setItemById).toHaveBeenCalledWith(
            5,
            expect.objectContaining({ bibleKey: 'KJV' }),
        );
        await expect(
            handleAgentBibleListRequest({ action: 'delete', id: 5 }),
        ).resolves.toMatchObject({ deleted: 'KJV John 1:1' });
        expect(bible.deleteItem).toHaveBeenCalledWith(oldItem);
        expect(mocks.detachBackground).toHaveBeenCalledWith(
            '/bibles/Default.owb',
            5,
        );
        expect(bible.save).toHaveBeenCalledTimes(3);
    });

    test('creates, renames and trashes Bible lists with recoverable actions', async () => {
        state.dir = '/bibles';
        mocks.listAgentFiles.mockResolvedValue([]);
        await expect(
            handleAgentBibleListRequest({
                action: 'create-list',
                list: 'Sunday',
            }),
        ).resolves.toMatchObject({ where: 'Presenter', created: 'Sunday' });
        expect(mocks.createBible).toHaveBeenCalledWith('/bibles', 'Sunday');

        mocks.listAgentFiles.mockResolvedValue([
            { name: 'Sunday', filePath: '/bibles/Sunday.owb' },
        ]);
        state.bible = { items: [], itemsLength: 0 };
        await expect(
            handleAgentBibleListRequest({
                action: 'rename-list',
                list: 'Sunday',
                newName: 'Monday',
            }),
        ).resolves.toMatchObject({
            renamedFrom: 'Sunday',
            renamedTo: 'Monday',
        });
        expect(mocks.renameAgentFile).toHaveBeenCalledWith(
            '/bibles/Sunday.owb',
            'Monday',
        );
        await expect(
            handleAgentBibleListRequest({
                action: 'delete-list',
                list: 'Sunday',
            }),
        ).resolves.toMatchObject({
            deleted: 'Sunday',
            isInTrash: true,
            count: 0,
        });
        expect(mocks.trashAgentFile).toHaveBeenCalledWith('/bibles/Sunday.owb');
    });
});
