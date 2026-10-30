// @vitest-environment jsdom
/**
 * `owa_bible_note`'s worker, past its happy paths (those are in
 * `agentDataDispatch.coverage.test.ts`): a notes file is written straight
 * to disk, so the backup taken first -- the file AND the editing head a note
 * window left above it -- is the only undo. Every refusal must leave the
 * file alone, every failure must say so and point at `owa_undo`, a verse's
 * marks are never re-worded, and a change is made to a file read FRESH
 * inside the backup. The note text helpers and the file-name rules are the
 * real ones, so what is written is the note editor's own content.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dir: '/notes' as string | null,
        // `/notes/Default.own` -> the notes the file holds.
        files: {} as Record<string, any>,
        escapingNames: new Set<string>(),
    },
    mocks: {
        handleError: vi.fn(),
        fromFilePath: vi.fn(),
        getDefault: vi.fn(),
        createNote: vi.fn(),
        findAgentFreeName: vi.fn(),
        renameAgentFile: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentEditing: vi.fn(),
        snapshotAgentFile: vi.fn(),
        snapshotAgentFileForDelete: vi.fn(),
        snapshotAgentSidecars: vi.fn(),
        trashAgentFile: vi.fn(),
    },
}));

vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: () => ['own'],
}));
vi.mock('./constants', () => ({
    dirSourceSettingNames: { BIBLE_NOTES: 'bible-notes' },
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (settingName: string) => {
            return settingName === 'bible-notes' ? state.dir : null;
        },
    },
}));
vi.mock('../bible-list/note/Note', () => ({
    default: {
        fromFilePath: mocks.fromFilePath,
        getDefault: mocks.getDefault,
        create: mocks.createNote,
    },
}));
vi.mock('../bible-list/note/NoteItem', () => ({
    default: class NoteItem {
        static genNewJsonData() {
            return { title: '', content: '', metadata: {} };
        }
        constructor(json: object) {
            Object.assign(this, json);
        }
    },
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: class NoBackupError extends Error {},
    findAgentFreeName: mocks.findAgentFreeName,
    genNoBackupReason: (error: unknown) => {
        return `Nothing was changed: no backup (${(error as Error).message}).`;
    },
    genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
    listAgentFiles: async (dirPath: string) => {
        return Object.keys(state.files)
            .filter((filePath) => filePath.startsWith(`${dirPath}/`))
            .map((filePath) => ({
                filePath,
                name: filePath.slice(dirPath.length + 1).replace(/\.own$/, ''),
            }))
            .sort((one, other) => {
                if (one.name === 'Default' || other.name === 'Default') {
                    return one.name === 'Default' ? -1 : 1;
                }
                return one.name.localeCompare(other.name);
            });
    },
    renameAgentFile: mocks.renameAgentFile,
    runWithAgentBackup: mocks.runWithAgentBackup,
    snapshotAgentEditing: mocks.snapshotAgentEditing,
    snapshotAgentFile: mocks.snapshotAgentFile,
    snapshotAgentFileForDelete: mocks.snapshotAgentFileForDelete,
    snapshotAgentSidecars: mocks.snapshotAgentSidecars,
    toAgentFilePath: (dirPath: string, name: string, extension: string) => {
        return state.escapingNames.has(name)
            ? null
            : `${dirPath}/${name}.${extension}`;
    },
    trashAgentFile: mocks.trashAgentFile,
}));

import { NoBackupError } from './agentBackupHelpers';
import { handleAgentNoteRequest } from './agentNoteHelpers';
import { readLexicalText, toLexicalContent } from './agentNoteTextHelpers';

function genNoteItem(id: number, title: string, text = '') {
    return {
        id,
        isVerseItem: false,
        title,
        content: toLexicalContent(text),
    };
}

function genVerseItem(id: number) {
    return {
        id,
        isVerseItem: true,
        title: 'John 3:16',
        verseKey: 'JHN 3:16',
        highlights: [{ text: 'God so loved', color: '#ff0' }],
        comments: [{ text: 'the world', comment: 'all of it' }],
    };
}

function genNoteFile(items: any[]) {
    const note = {
        items,
        get maxItemId() {
            return items.reduce((max, one) => Math.max(max, one.id), 0);
        },
        getItemById: vi.fn((id: number) => {
            return items.find((one) => one.id === id) ?? null;
        }),
        addNoteItem: vi.fn((item: any) => {
            items.push({ ...item, id: note.maxItemId + 1 });
        }),
        updateNoteItem: vi.fn(),
        deleteItem: vi.fn(),
        save: vi.fn(async () => true),
        syncItemEditingHistory: vi.fn(),
    };
    return note;
}

beforeEach(() => {
    state.dir = '/notes';
    state.files = {};
    state.escapingNames = new Set();
    mocks.fromFilePath.mockImplementation(async (filePath: string) => {
        return state.files[filePath] ?? null;
    });
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => ({ meta: { id: 'undo-1' }, value: await change() }),
    );
    mocks.snapshotAgentFile.mockImplementation(async (filePath: string) => {
        return { type: 'file', filePath, text: 'as saved' };
    });
    mocks.snapshotAgentEditing.mockResolvedValue(null);
    mocks.snapshotAgentSidecars.mockResolvedValue([]);
    mocks.snapshotAgentFileForDelete.mockImplementation(
        async (filePath: string) => [{ type: 'file', filePath, text: 'x' }],
    );
    mocks.findAgentFreeName.mockImplementation(
        async (_dirPath: string, name: string) => `${name} (2)`,
    );
    mocks.createNote.mockResolvedValue({});
    mocks.renameAgentFile.mockResolvedValue('/notes/Renamed.own');
});

function request(fields: Record<string, unknown>) {
    return handleAgentNoteRequest(fields);
}

describe('which file', () => {
    test('one file is listed by its name, placeholders left out; a missing one names the files there are', async () => {
        state.files = {
            '/notes/Default.own': genNoteFile([]),
            '/notes/Study.own': genNoteFile([
                genNoteItem(2, 'Grace', 'Saved by grace.'),
                { id: -1 },
            ]),
        };
        await expect(
            request({ action: 'list', file: 'Study' }),
        ).resolves.toEqual({
            files: [
                {
                    name: 'Study',
                    count: 1,
                    notes: [
                        {
                            id: 2,
                            kind: 'note',
                            title: 'Grace',
                            firstWords: 'Saved by grace.',
                        },
                    ],
                },
            ],
        });
        await expect(
            request({ action: 'list', file: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'There is no notes file called "Easter". The files are ' +
                '"Default", "Study".',
        });
        state.files = {};
        await expect(
            request({ action: 'read', id: 1, file: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'There is no notes file called "Easter". There are none yet ' +
                '-- "add" writes into Default, which is made on the way.',
        });
    });

    test('a bad file name, or one that would leave the folder, is refused', async () => {
        await expect(
            request({ action: 'list', file: 'a/b' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('A name cannot contain any of'),
        });
        state.escapingNames.add('Study');
        await expect(
            request({ action: 'list', file: 'Study' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That file name would not stay inside the notes folder.',
        });
    });

    test('a file that cannot be read is not changed', async () => {
        state.files = { '/notes/Default.own': null };
        await expect(request({ action: 'read', id: 1 })).resolves.toEqual({
            isError: true,
            reason: 'The notes file "Default" could not be read.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });
});

describe('reading a note', () => {
    test('a note is its words, with the verses it names; a long one is cut', async () => {
        const mention = {
            root: {
                type: 'root',
                children: [
                    {
                        type: 'paragraph',
                        children: [
                            { type: 'text', text: 'See ' },
                            {
                                type: 'mention',
                                mentionKind: 'bible-verse',
                                mentionName: '(KJV) John 3:16',
                                text: '(KJV) John 3:16',
                            },
                        ],
                    },
                ],
            },
        };
        state.files = {
            '/notes/Default.own': genNoteFile([
                {
                    id: 1,
                    isVerseItem: false,
                    title: 'Love',
                    content: JSON.stringify(mention),
                },
                genNoteItem(2, 'Long', 'w'.repeat(20001)),
            ]),
        };
        const love: any = await request({ action: 'read', id: 1 });
        expect(love).toEqual({
            file: 'Default',
            id: 1,
            kind: 'note',
            title: 'Love',
            text: 'See (KJV) John 3:16',
            verses: ['(KJV) John 3:16'],
        });
        const long: any = await request({ action: 'read', id: 2 });
        expect(long.text).toHaveLength(20001);
        expect(long.text.endsWith('…')).toBe(true);
        expect(long).not.toHaveProperty('verses');
    });

    test('an id that is not a whole number, or not in the file, is refused', async () => {
        state.files = {
            '/notes/Default.own': genNoteFile([genNoteItem(4, 'Only')]),
        };
        await expect(request({ action: 'read', id: 1.5 })).resolves.toEqual({
            isError: true,
            reason: 'Say which note: its `id`, from action "list".',
        });
        await expect(request({ action: 'read', id: 9 })).resolves.toEqual({
            isError: true,
            reason:
                'The notes file "Default" has no note with the id 9. Its ids ' +
                'are 4 -- action "list" says which is which.',
        });
        state.files = { '/notes/Default.own': genNoteFile([]) };
        await expect(request({ action: 'read', id: 9 })).resolves.toEqual({
            isError: true,
            reason:
                'The notes file "Default" has no note with the id 9. It is ' +
                'empty.',
        });
    });
});

describe('add', () => {
    test.each([
        [{ text: 'words' }, 'A new note needs a `title`.'],
        [
            { title: 't'.repeat(201) },
            "A note's title is at most 200 characters.",
        ],
        [
            { title: 'Long', text: 'x'.repeat(20001) },
            "A note's text is at most 20000 characters.",
        ],
        [
            { title: 'Easter', file: 'Easter' },
            expect.stringContaining('There is no notes file called "Easter"'),
        ],
    ])('%o is refused before any backup', async (fields, reason) => {
        state.files = { '/notes/Default.own': genNoteFile([]) };
        await expect(request({ action: 'add', ...fields })).resolves.toEqual({
            isError: true,
            reason,
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('into an existing file: the file and its editing head are backed up, the words written as the editor writes them', async () => {
        const note = genNoteFile([genNoteItem(3, 'Before')]);
        state.files = { '/notes/Default.own': note };
        const head = {
            type: 'editing',
            kind: 'note',
            filePath: '/notes/Default.own',
            text: 'unsaved typing',
        };
        mocks.snapshotAgentEditing.mockResolvedValue(head);
        await expect(
            request({ action: 'add', title: 'Sunday', text: 'Line one\nTwo' }),
        ).resolves.toEqual({
            file: 'Default',
            added: 'Sunday',
            id: 4,
            undoId: 'undo-1',
        });
        expect(mocks.snapshotAgentFile).toHaveBeenCalledWith(
            '/notes/Default.own',
            'note',
        );
        expect(mocks.snapshotAgentEditing).toHaveBeenCalledWith(
            'note',
            '/notes/Default.own',
        );
        expect(mocks.runWithAgentBackup).toHaveBeenCalledWith(
            'Wrote the note “Sunday” in “Default”',
            [
                {
                    type: 'file',
                    filePath: '/notes/Default.own',
                    text: 'as saved',
                },
                head,
            ],
            expect.any(Function),
        );
        const added = note.addNoteItem.mock.calls[0][0];
        expect(added.title).toBe('Sunday');
        expect(added.content).toBe(toLexicalContent('Line one\nTwo'));
        expect(readLexicalText(added.content)).toBe('Line one\nTwo');
        expect(note.save).toHaveBeenCalledOnce();
    });

    test('into a Default not there yet: made on the way, its undo is "there was none"', async () => {
        const made = genNoteFile([]);
        mocks.getDefault.mockResolvedValue(made);
        await expect(
            request({ action: 'add', title: 'First' }),
        ).resolves.toMatchObject({ file: 'Default', added: 'First', id: 1 });
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            { type: 'file', filePath: '/notes/Default.own', text: null },
        ]);
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
        // No text: the empty content a new note in the panel holds.
        expect(made.addNoteItem.mock.calls[0][0].content).toBe('');
    });

    test('no backup, no Default, or a file that will not save: reported, not claimed', async () => {
        state.files = { '/notes/Default.own': genNoteFile([]) };
        mocks.snapshotAgentFile.mockRejectedValueOnce(new Error('disk busy'));
        await expect(request({ action: 'add', title: 'X' })).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (disk busy).',
        });

        state.files = {};
        mocks.getDefault.mockResolvedValue(null);
        await expect(request({ action: 'add', title: 'X' })).resolves.toEqual({
            isError: true,
            reason:
                'Writing the note “X” could not be finished: the Default ' +
                'notes file could not be made. Anything it did get to do can ' +
                'be put back with owa_undo.',
        });

        const note = genNoteFile([]);
        note.save.mockResolvedValue(false);
        state.files = { '/notes/Default.own': note };
        await expect(
            request({ action: 'add', title: 'X' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'the notes file could not be saved.',
            ),
        });

        mocks.runWithAgentBackup.mockRejectedValueOnce(
            new NoBackupError('The backup folder is full.'),
        );
        await expect(request({ action: 'add', title: 'X' })).resolves.toEqual({
            isError: true,
            reason: 'The backup folder is full.',
        });
    });
});

describe('update', () => {
    let note: ReturnType<typeof genNoteFile>;
    beforeEach(() => {
        note = genNoteFile([genNoteItem(3, 'Before', 'old'), genVerseItem(4)]);
        state.files = { '/notes/Default.own': note };
    });

    test.each([
        [{ id: 3 }, 'Give a new `title`, a new `text`, or both.'],
        [
            { id: 3, title: 't'.repeat(201) },
            "A note's title is at most 200 characters.",
        ],
        [{ title: 'New' }, 'Say which note: its `id`, from action "list".'],
        [
            { id: 8, title: 'New' },
            expect.stringContaining('has no note with the id 8.'),
        ],
        [
            { id: 4, text: 'new words' },
            "That is a verse's highlights and comments, not a note -- its " +
                'comments are changed in the Reader.',
        ],
    ])('%o is refused before any backup', async (fields, reason) => {
        await expect(request({ action: 'update', ...fields })).resolves.toEqual(
            { isError: true, reason },
        );
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(note.save).not.toHaveBeenCalled();
    });

    test('a verse’s marks can be renamed whole, its words never touched', async () => {
        await expect(
            request({ action: 'update', id: 4, title: 'For God so loved' }),
        ).resolves.toMatchObject({ updated: 'For God so loved', id: 4 });
        const updated = note.updateNoteItem.mock.calls[0][0];
        expect(updated.title).toBe('For God so loved');
        expect(updated.verseKey).toBe('JHN 3:16');
        expect(note.syncItemEditingHistory).not.toHaveBeenCalled();
    });

    test('new words alone keep the title, and reach the note window’s head too', async () => {
        await expect(
            request({ action: 'update', id: 3, text: 'new words' }),
        ).resolves.toEqual({
            file: 'Default',
            updated: 'Before',
            id: 3,
            undoId: 'undo-1',
        });
        const updated = note.updateNoteItem.mock.calls[0][0];
        expect(updated.content).toBe(toLexicalContent('new words'));
        expect(note.syncItemEditingHistory).toHaveBeenCalledWith(updated);
    });

    test('no backup, a note gone meanwhile, or a file that will not save is reported', async () => {
        mocks.snapshotAgentEditing.mockRejectedValueOnce(
            new Error('head unreadable'),
        );
        await expect(
            request({ action: 'update', id: 3, title: 'New' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (head unreadable).',
        });

        mocks.fromFilePath
            .mockResolvedValueOnce(note)
            .mockResolvedValueOnce(genNoteFile([]));
        await expect(
            request({ action: 'update', id: 3, title: 'New' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Changing the note “Before” could not be finished: the note ' +
                'is not in the file any more. Anything it did get to do can ' +
                'be put back with owa_undo.',
        });

        note.save.mockResolvedValue(false);
        await expect(
            request({ action: 'update', id: 3, text: 'x' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'the notes file could not be saved.',
            ),
        });
        expect(note.syncItemEditingHistory).not.toHaveBeenCalled();
    });
});

describe('delete', () => {
    test('the file, its head and its sidecars are backed up before the note goes', async () => {
        const note = genNoteFile([genNoteItem(3, 'Before')]);
        state.files = { '/notes/Default.own': note };
        mocks.snapshotAgentSidecars.mockResolvedValue([
            {
                type: 'file',
                filePath: '/notes/Default.own.bg.json',
                text: '{}',
            },
        ]);
        await expect(request({ action: 'delete', id: 3 })).resolves.toEqual({
            file: 'Default',
            deleted: 'Before',
            undoId: 'undo-1',
        });
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            { type: 'file', filePath: '/notes/Default.own', text: 'as saved' },
            {
                type: 'file',
                filePath: '/notes/Default.own.bg.json',
                text: '{}',
            },
        ]);
        expect(note.deleteItem).toHaveBeenCalledWith(note.items[0]);
    });

    test('a missing note, no backup, a note gone meanwhile, or a failed save is reported', async () => {
        const note = genNoteFile([genNoteItem(3, 'Before')]);
        state.files = { '/notes/Default.own': note };
        await expect(
            request({ action: 'delete', id: 5 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('has no note with the id 5.'),
        });
        mocks.snapshotAgentSidecars.mockRejectedValueOnce(
            new Error('sidecar locked'),
        );
        await expect(request({ action: 'delete', id: 3 })).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (sidecar locked).',
        });
        mocks.fromFilePath
            .mockResolvedValueOnce(note)
            .mockResolvedValueOnce(genNoteFile([]));
        await expect(
            request({ action: 'delete', id: 3 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'Removing the note “Before” could not be finished: the note ' +
                    'is not in the file any more.',
            ),
        });
        note.save.mockResolvedValue(false);
        await expect(
            request({ action: 'delete', id: 3 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'the notes file could not be saved.',
            ),
        });
    });
});

describe('whole files', () => {
    test('a new file is never made over one, nor under a bad name, and a failure is reported', async () => {
        state.files = { '/notes/Sunday.own': genNoteFile([]) };
        await expect(
            request({ action: 'create-file', file: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'A notes file called "Sunday" is already there. "Sunday (2)" ' +
                'is free.',
        });
        await expect(
            request({ action: 'create-file', file: '.hidden' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'A name cannot start with a dot.',
        });
        state.escapingNames.add('Easter');
        await expect(
            request({ action: 'create-file', file: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That file name would not stay inside the notes folder.',
        });
        expect(mocks.createNote).not.toHaveBeenCalled();

        mocks.createNote.mockResolvedValue(null);
        await expect(
            request({ action: 'create-file', file: 'Advent' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Making the notes file “Advent” could not be finished: the ' +
                'notes file could not be made. Anything it did get to do can ' +
                'be put back with owa_undo.',
        });
    });

    test('renaming takes the editing history along; Default says it comes back', async () => {
        state.files = {
            '/notes/Default.own': genNoteFile([]),
            '/notes/Sunday.own': genNoteFile([]),
        };
        await expect(
            request({ action: 'rename-file', newName: 'Old' }),
        ).resolves.toEqual({
            renamedFrom: 'Default',
            renamedTo: 'Old',
            undoId: 'undo-1',
            note:
                'The app makes a new Default notes file the next time the ' +
                'Bible Notes panel shows.',
        });
        expect(mocks.runWithAgentBackup.mock.calls[0][1]).toEqual([
            {
                type: 'rename',
                from: '/notes/Default.own',
                to: '/notes/Old.own',
                kind: 'note',
            },
        ]);
        expect(mocks.renameAgentFile).toHaveBeenCalledWith(
            '/notes/Default.own',
            'Old',
            'note',
        );
    });

    test('a rename onto a taken, bad or escaping name, or from a missing file, is refused; a failure is reported', async () => {
        state.files = {
            '/notes/Default.own': genNoteFile([]),
            '/notes/Sunday.own': genNoteFile([]),
        };
        await expect(
            request({
                action: 'rename-file',
                file: 'Default',
                newName: 'Sunday',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'A notes file called "Sunday" is already there, so ' +
                '"Default" was not renamed.',
        });
        await expect(
            request({ action: 'rename-file', newName: '' }),
        ).resolves.toEqual({ isError: true, reason: 'Give the file a name.' });
        state.escapingNames.add('Away');
        await expect(
            request({ action: 'rename-file', newName: 'Away' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That new name would not stay inside the notes folder.',
        });
        await expect(
            request({ action: 'rename-file', file: 'Easter', newName: 'X' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'There is no notes file called "Easter"',
            ),
        });
        expect(mocks.renameAgentFile).not.toHaveBeenCalled();

        mocks.renameAgentFile.mockRejectedValue(new Error('file in use'));
        await expect(
            request({ action: 'rename-file', file: 'Sunday', newName: 'X' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Renaming the notes file “Sunday” could not be finished: file ' +
                'in use Anything it did get to do can be put back with ' +
                'owa_undo.',
        });
    });

    test('a whole file goes to the trash with its history, counted by its real notes', async () => {
        state.files = {
            '/notes/Sunday.own': genNoteFile([genNoteItem(1, 'a'), { id: -1 }]),
        };
        await expect(
            request({ action: 'delete-file', file: 'Sunday' }),
        ).resolves.toEqual({
            deleted: 'Sunday',
            isInTrash: true,
            count: 1,
            undoId: 'undo-1',
            note: 'It is in the trash, and owa_undo puts it back.',
        });
        expect(mocks.snapshotAgentFileForDelete).toHaveBeenCalledWith(
            '/notes/Sunday.own',
            'note',
        );
        expect(mocks.trashAgentFile).toHaveBeenCalledWith(
            '/notes/Sunday.own',
            'note',
        );
    });

    test('a file that is not there, cannot be backed up, or will not go to the trash is reported', async () => {
        await expect(
            request({ action: 'delete-file', file: 'Easter' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'There is no notes file called "Easter"',
            ),
        });
        state.files = { '/notes/Default.own': genNoteFile([]) };
        mocks.snapshotAgentFileForDelete.mockRejectedValueOnce(
            new Error('cannot read'),
        );
        await expect(request({ action: 'delete-file' })).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (cannot read).',
        });
        expect(mocks.trashAgentFile).not.toHaveBeenCalled();
        mocks.trashAgentFile.mockRejectedValue(new Error('on a USB stick'));
        await expect(request({ action: 'delete-file' })).resolves.toEqual({
            isError: true,
            reason:
                'Moving the notes file “Default” to the trash could not be ' +
                'finished: on a USB stick Anything it did get to do can be ' +
                'put back with owa_undo.',
        });
    });
});
