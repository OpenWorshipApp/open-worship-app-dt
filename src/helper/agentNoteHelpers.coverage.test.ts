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

// The notes worker behind `owa_bible_note`. A notes file is written straight
// to disk on every change, so the backup taken first is the only undo: no
// backup, no change; a refused name stays refused; a verse's marks are never
// re-texted; every failure is an answer, not a throw. The note-text helpers
// and the name rules are the real ones, so what is written is the editor's
// own shape and what is refused is what the tool refuses.
const { state, mocks } = vi.hoisted(() => ({
    state: { dir: '/notes' as string | null },
    mocks: {
        handleError: vi.fn(),
        getDirPath: vi.fn(),
        fromFilePath: vi.fn(),
        getDefault: vi.fn(),
        createNote: vi.fn(),
        listAgentFiles: vi.fn(),
        findAgentFreeName: vi.fn(),
        renameAgentFile: vi.fn(),
        runWithAgentBackup: vi.fn(),
        snapshotAgentEditing: vi.fn(),
        snapshotAgentFile: vi.fn(),
        snapshotAgentFileForDelete: vi.fn(),
        snapshotAgentSidecars: vi.fn(),
        toAgentFilePath: vi.fn(),
        trashAgentFile: vi.fn(),
    },
}));

vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: () => ['own'],
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./DirSource', () => ({
    default: {
        getDirPathBySettingName: (name: string) => mocks.getDirPath(name),
    },
}));
vi.mock('../bible-list/note/Note', () => ({
    default: {
        fromFilePath: (filePath: string) => mocks.fromFilePath(filePath),
        getDefault: () => mocks.getDefault(),
        create: (dirPath: string, name: string) =>
            mocks.createNote(dirPath, name),
    },
}));
vi.mock('../bible-list/note/NoteItem', () => ({
    default: class NoteItem {
        static genNewJsonData() {
            return { title: 'Unnamed', content: '', metadata: { id: -1 } };
        }
        constructor(json: Record<string, unknown>) {
            Object.assign(this, json);
        }
    },
}));
vi.mock('./agentBackupHelpers', () => {
    class NoBackupError extends Error {}
    return {
        NoBackupError,
        findAgentFreeName: (...args: any[]) => mocks.findAgentFreeName(...args),
        genNoBackupReason: (error: any) =>
            `Nothing was changed: no backup (${error?.message ?? error}).`,
        genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
        listAgentFiles: (...args: any[]) => mocks.listAgentFiles(...args),
        renameAgentFile: (...args: any[]) => mocks.renameAgentFile(...args),
        runWithAgentBackup: (...args: any[]) =>
            mocks.runWithAgentBackup(...args),
        snapshotAgentEditing: (...args: any[]) =>
            mocks.snapshotAgentEditing(...args),
        snapshotAgentFile: (...args: any[]) => mocks.snapshotAgentFile(...args),
        snapshotAgentFileForDelete: (...args: any[]) =>
            mocks.snapshotAgentFileForDelete(...args),
        snapshotAgentSidecars: (...args: any[]) =>
            mocks.snapshotAgentSidecars(...args),
        toAgentFilePath: (...args: any[]) => mocks.toAgentFilePath(...args),
        trashAgentFile: (...args: any[]) => mocks.trashAgentFile(...args),
    };
});

import { handleAgentNoteRequest } from './agentNoteHelpers';
import { NoBackupError } from './agentBackupHelpers';
import { dirSourceSettingNames } from './constants';
import { readLexicalText, toLexicalContent } from './agentNoteTextHelpers';

const DIR = '/notes';
const DEFAULT_PATH = `${DIR}/Default.own`;
const SUNDAY_PATH = `${DIR}/Sunday.own`;

function genFiles(...names: string[]) {
    return names.map((name) => {
        return { name, filePath: `${DIR}/${name}.own` };
    });
}

function genNoteItem(id: number, title: string, text = '') {
    return { id, isVerseItem: false, title, content: toLexicalContent(text) };
}

function genVerseItem(id: number, title: string) {
    return {
        id,
        isVerseItem: true,
        title,
        verseKey: 'JHN 3:16',
        highlights: [],
        comments: [],
    };
}

function genNote(items: any[], { isSaved = true } = {}) {
    return {
        items,
        maxItemId: items.reduce((max, item) => Math.max(max, item.id), 0),
        getItemById: (id: number) => {
            return (
                items.find((item) => {
                    return item.id === id;
                }) ?? null
            );
        },
        addNoteItem: vi.fn(),
        updateNoteItem: vi.fn(),
        deleteItem: vi.fn(),
        save: vi.fn(async () => isSaved),
        syncItemEditingHistory: vi.fn(async () => undefined),
    };
}

function getRestores() {
    return mocks.runWithAgentBackup.mock.calls.at(-1)?.[1];
}

beforeEach(() => {
    state.dir = DIR;
    mocks.getDirPath.mockImplementation(() => state.dir);
    mocks.toAgentFilePath.mockImplementation(
        (dir: string, name: string, extension: string) => {
            return `${dir}/${name}.${extension}`;
        },
    );
    mocks.listAgentFiles.mockResolvedValue(genFiles('Default', 'Sunday'));
    mocks.runWithAgentBackup.mockImplementation(
        async (
            _summary: string,
            _restores: unknown[],
            change: () => Promise<unknown>,
        ) => {
            return { meta: { id: 'undo-1' }, value: await change() };
        },
    );
    mocks.snapshotAgentFile.mockImplementation(async (filePath: string) => {
        return { type: 'file', filePath, text: 'saved notes' };
    });
    mocks.snapshotAgentEditing.mockResolvedValue(null);
    mocks.snapshotAgentSidecars.mockResolvedValue([]);
    mocks.snapshotAgentFileForDelete.mockImplementation(
        async (filePath: string) => {
            return [{ type: 'file', filePath, text: 'saved notes' }];
        },
    );
    mocks.findAgentFreeName.mockResolvedValue('Sunday (2)');
    mocks.renameAgentFile.mockResolvedValue(`${DIR}/Monday.own`);
    mocks.trashAgentFile.mockResolvedValue(undefined);
    mocks.createNote.mockResolvedValue({});
});

describe('the request', () => {
    test('an unknown action and a missing folder are answered', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'hasOwnProperty' }),
        ).resolves.toMatchObject({
            isError: true,
            reason: expect.stringContaining('Unknown action.'),
        });
        state.dir = null;
        await expect(
            handleAgentNoteRequest({ action: 'list' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('No Bible notes folder'),
        });
        expect(mocks.getDirPath).toHaveBeenCalledWith(
            dirSourceSettingNames.BIBLE_NOTES,
        );
    });

    test('a file that cannot be read is an answer, not a throw', async () => {
        mocks.fromFilePath.mockResolvedValue(null);
        await expect(
            handleAgentNoteRequest({ action: 'read', file: 'Sunday', id: 1 }),
        ).resolves.toEqual({
            isError: true,
            reason: 'The notes file "Sunday" could not be read.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });
});

describe('naming a file', () => {
    test('one named file is listed alone, truncated past sixty notes', async () => {
        const items = [
            { id: -1 },
            ...Array.from({ length: 61 }, (_, index) => {
                return genNoteItem(index + 1, `Note ${index + 1}`, 'words');
            }),
        ];
        mocks.fromFilePath.mockResolvedValue(genNote(items));
        const result: any = await handleAgentNoteRequest({
            action: 'list',
            file: 'Sunday',
        });
        expect(mocks.fromFilePath).toHaveBeenCalledExactlyOnceWith(SUNDAY_PATH);
        expect(result.files).toHaveLength(1);
        expect(result.files[0]).toMatchObject({
            name: 'Sunday',
            count: 61,
            isTruncated: true,
        });
        expect(result.files[0].notes).toHaveLength(60);
        expect(result.files[0].notes[0]).toEqual({
            id: 1,
            kind: 'note',
            title: 'Note 1',
            firstWords: 'words',
        });
        expect(result).not.toHaveProperty('fileCount');
    });

    test('more than thirty files are named thirty at a time', async () => {
        const names = Array.from({ length: 32 }, (_, index) => {
            return `File ${index + 1}`;
        });
        mocks.listAgentFiles.mockResolvedValue(genFiles(...names));
        mocks.fromFilePath.mockResolvedValue(null);
        const result: any = await handleAgentNoteRequest({ action: 'list' });
        expect(result).toMatchObject({ isTruncated: true, fileCount: 32 });
        expect(result.files).toHaveLength(30);
        expect(result.files[29]).toEqual({
            name: 'File 30',
            count: 0,
            notes: [],
        });
    });

    test('a file that is not there is refused with the files that are', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'list', file: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'There is no notes file called "Easter". The files are ' +
                '"Default", "Sunday".',
        });
        mocks.listAgentFiles.mockResolvedValue([]);
        await expect(
            handleAgentNoteRequest({ action: 'read', file: 'Easter', id: 1 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'There are none yet -- "add" writes into Default',
            ),
        });
        expect(mocks.fromFilePath).not.toHaveBeenCalled();
    });

    test('a bad name is refused, not cleaned, and a path outside the folder too', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'list', file: 'a\\b' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('A name cannot contain'),
        });
        await expect(
            handleAgentNoteRequest({ action: 'read', file: 'NUL.old', id: 1 }),
        ).resolves.toMatchObject({
            reason: '"NUL.old" is a name this computer reserves for itself.',
        });
        expect(mocks.toAgentFilePath).not.toHaveBeenCalled();
        mocks.toAgentFilePath.mockReturnValueOnce(null);
        await expect(
            handleAgentNoteRequest({ action: 'list', file: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'That file name would not stay inside the notes folder.',
        });
        expect(mocks.listAgentFiles).not.toHaveBeenCalled();
    });
});

describe('read', () => {
    test('needs an integer id', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'read', id: '3' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Say which note: its `id`, from action "list".',
        });
        expect(mocks.listAgentFiles).not.toHaveBeenCalled();
    });

    test('a long note is cut, and the verses it mentions are named once', async () => {
        const mention = {
            type: 'mention',
            mentionKind: 'bible-verse',
            mentionName: '(KJV) John 3:16',
            text: '@John 3:16',
        };
        const content = JSON.stringify({
            root: {
                type: 'root',
                children: [
                    {
                        type: 'paragraph',
                        children: [
                            { type: 'text', text: 'See ' },
                            mention,
                            { ...mention },
                        ],
                    },
                ],
            },
        });
        mocks.fromFilePath.mockResolvedValue(
            genNote([
                { id: 1, isVerseItem: false, title: 'Mentions', content },
                genNoteItem(2, 'Long', 'x'.repeat(20005)),
            ]),
        );
        await expect(
            handleAgentNoteRequest({ action: 'read', id: 1 }),
        ).resolves.toEqual({
            file: 'Default',
            id: 1,
            kind: 'note',
            title: 'Mentions',
            text: 'See @John 3:16@John 3:16',
            verses: ['(KJV) John 3:16'],
        });
        const long: any = await handleAgentNoteRequest({
            action: 'read',
            id: 2,
        });
        expect(long.text).toBe(`${'x'.repeat(20000)}…`);
        expect(long).not.toHaveProperty('verses');
    });
});

describe('add', () => {
    test('needs a title within bounds and a file that is there', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'add', title: ' ' }),
        ).resolves.toMatchObject({ reason: 'A new note needs a `title`.' });
        await expect(
            handleAgentNoteRequest({ action: 'add', title: 't'.repeat(201) }),
        ).resolves.toMatchObject({
            reason: "A note's title is at most 200 characters.",
        });
        await expect(
            handleAgentNoteRequest({
                action: 'add',
                title: 'Sermon',
                text: 'w'.repeat(20001),
            }),
        ).resolves.toMatchObject({
            reason: "A note's text is at most 20000 characters.",
        });
        expect(mocks.listAgentFiles).not.toHaveBeenCalled();
        await expect(
            handleAgentNoteRequest({
                action: 'add',
                file: 'Easter',
                title: 'Sermon',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no notes file called "Easter"'),
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('backs up the file AND its editing head before writing the editor shape', async () => {
        const note = genNote([genNoteItem(4, 'Old')]);
        mocks.fromFilePath.mockResolvedValue(note);
        mocks.snapshotAgentEditing.mockResolvedValue({
            type: 'editing',
            filePath: SUNDAY_PATH,
            text: 'head',
        });
        await expect(
            handleAgentNoteRequest({
                action: 'add',
                file: 'Sunday',
                title: ' Sermon ',
                text: 'first line\nsecond line',
            }),
        ).resolves.toEqual({
            file: 'Sunday',
            added: 'Sermon',
            id: 5,
            filePath: SUNDAY_PATH,
            undoId: 'undo-1',
        });
        expect(mocks.snapshotAgentFile).toHaveBeenCalledWith(
            SUNDAY_PATH,
            'note',
        );
        expect(mocks.snapshotAgentEditing).toHaveBeenCalledWith(
            'note',
            SUNDAY_PATH,
        );
        expect(getRestores()).toEqual([
            { type: 'file', filePath: SUNDAY_PATH, text: 'saved notes' },
            { type: 'editing', filePath: SUNDAY_PATH, text: 'head' },
        ]);
        const added = note.addNoteItem.mock.calls[0][0];
        expect(added.title).toBe('Sermon');
        expect(readLexicalText(added.content)).toBe('first line\nsecond line');
    });

    test('no backup, no change', async () => {
        const note = genNote([]);
        mocks.fromFilePath.mockResolvedValue(note);
        mocks.runWithAgentBackup.mockRejectedValueOnce(
            new NoBackupError('Nothing was changed: the backup failed.'),
        );
        await expect(
            handleAgentNoteRequest({ action: 'add', title: 'Sermon' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: the backup failed.',
        });
        expect(note.addNoteItem).not.toHaveBeenCalled();
        expect(note.save).not.toHaveBeenCalled();
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('a missing Default is made on the way, and one that cannot be is unfinished', async () => {
        mocks.listAgentFiles.mockResolvedValue(genFiles('Sunday'));
        const made = genNote([]);
        mocks.getDefault.mockResolvedValueOnce(made);
        await expect(
            handleAgentNoteRequest({ action: 'add', title: 'Sermon' }),
        ).resolves.toMatchObject({ file: 'Default', added: 'Sermon', id: 1 });
        expect(getRestores()).toEqual([
            { type: 'file', filePath: DEFAULT_PATH, text: null },
        ]);
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
        // No text is a note with no words yet, as a new note in the panel.
        expect(made.addNoteItem.mock.calls[0][0].content).toBe('');

        mocks.getDefault.mockResolvedValueOnce(null);
        await expect(
            handleAgentNoteRequest({ action: 'add', title: 'Sermon' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Writing the note “Sermon” could not be finished: the ' +
                'Default notes file could not be made. Anything it did get ' +
                'to do can be put back with owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });

    test('a file that will not save, or a failed snapshot, is reported', async () => {
        const unsaved = genNote([], { isSaved: false });
        mocks.fromFilePath.mockResolvedValue(unsaved);
        await expect(
            handleAgentNoteRequest({ action: 'add', title: 'Sermon' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'could not be finished: the notes file could not be saved.',
            ),
        });
        mocks.snapshotAgentEditing.mockRejectedValueOnce(
            new Error('history locked'),
        );
        await expect(
            handleAgentNoteRequest({ action: 'add', title: 'Sermon' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (history locked).',
        });
        expect(unsaved.addNoteItem).toHaveBeenCalledOnce();
    });
});

describe('update', () => {
    test('needs something to change, within bounds, on a note that is there', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'update', id: 1 }),
        ).resolves.toMatchObject({
            reason: 'Give a new `title`, a new `text`, or both.',
        });
        await expect(
            handleAgentNoteRequest({
                action: 'update',
                id: 1,
                title: 'T'.repeat(201),
            }),
        ).resolves.toMatchObject({
            reason: "A note's title is at most 200 characters.",
        });
        mocks.fromFilePath.mockResolvedValue(
            genNote([{ id: -1 }, genNoteItem(2, 'A'), genNoteItem(5, 'B')]),
        );
        await expect(
            handleAgentNoteRequest({ action: 'update', id: 7, text: 'x' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'The notes file "Default" has no note with the id 7. Its ids ' +
                'are 2, 5 -- action "list" says which is which.',
        });
        mocks.fromFilePath.mockResolvedValue(genNote([{ id: -1 }]));
        await expect(
            handleAgentNoteRequest({ action: 'update', id: -1, text: 'x' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('It is empty.'),
        });
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
    });

    test('a new title alone keeps the words and the editing history', async () => {
        const item = genNoteItem(2, 'Old title', 'kept words');
        const note = genNote([item]);
        mocks.fromFilePath.mockResolvedValue(note);
        await expect(
            handleAgentNoteRequest({
                action: 'update',
                id: 2,
                title: 'New title',
            }),
        ).resolves.toEqual({
            file: 'Default',
            updated: 'New title',
            id: 2,
            undoId: 'undo-1',
        });
        expect(note.updateNoteItem).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'New title' }),
            true,
        );
        expect(readLexicalText(item.content)).toBe('kept words');
        expect(note.syncItemEditingHistory).not.toHaveBeenCalled();
    });

    test('a verse-marks item can be renamed whole, and new words keep its title', async () => {
        const verseItem = genVerseItem(3, 'John 3:16');
        const noteItem = genNoteItem(4, 'Kept title', 'old');
        const note = genNote([verseItem, noteItem]);
        mocks.fromFilePath.mockResolvedValue(note);
        await expect(
            handleAgentNoteRequest({
                action: 'update',
                id: 3,
                title: 'For God so loved',
            }),
        ).resolves.toMatchObject({ updated: 'For God so loved' });
        expect(verseItem).toMatchObject({ verseKey: 'JHN 3:16' });
        await expect(
            handleAgentNoteRequest({ action: 'update', id: 4, text: 'new' }),
        ).resolves.toMatchObject({ updated: 'Kept title' });
        expect(readLexicalText(noteItem.content)).toBe('new');
        expect(note.syncItemEditingHistory).toHaveBeenCalledWith(noteItem);
    });

    test('a failed snapshot changes nothing', async () => {
        const note = genNote([genNoteItem(2, 'A')]);
        mocks.fromFilePath.mockResolvedValue(note);
        mocks.snapshotAgentFile.mockRejectedValueOnce(new Error('denied'));
        await expect(
            handleAgentNoteRequest({ action: 'update', id: 2, text: 'x' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (denied).',
        });
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
        expect(note.updateNoteItem).not.toHaveBeenCalled();
    });

    test('a note gone from the fresh copy, or a file that will not save, is unfinished', async () => {
        mocks.fromFilePath
            .mockResolvedValueOnce(genNote([genNoteItem(2, 'A')]))
            .mockResolvedValueOnce(genNote([]));
        await expect(
            handleAgentNoteRequest({ action: 'update', id: 2, text: 'x' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Changing the note “A” could not be finished: the note is ' +
                'not in the file any more. Anything it did get to do can be ' +
                'put back with owa_undo.',
        });
        const unsaved = genNote([genNoteItem(2, 'A')], { isSaved: false });
        mocks.fromFilePath.mockResolvedValue(unsaved);
        await expect(
            handleAgentNoteRequest({ action: 'update', id: 2, text: 'x' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'the notes file could not be saved.',
            ),
        });
        // The editing head is only synced once the file holds the words.
        expect(unsaved.syncItemEditingHistory).not.toHaveBeenCalled();
    });
});

describe('delete', () => {
    test('needs a note that is there', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'delete' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('Say which note'),
        });
        await expect(
            handleAgentNoteRequest({
                action: 'delete',
                file: 'Easter',
                id: 1,
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no notes file called "Easter"'),
        });
        expect(mocks.snapshotAgentFile).not.toHaveBeenCalled();
    });

    test('backs up the file, its head and its sidecars, and removes nothing unbacked', async () => {
        const item = genNoteItem(2, 'A');
        const note = genNote([item]);
        mocks.fromFilePath.mockResolvedValue(note);
        mocks.snapshotAgentSidecars.mockResolvedValueOnce([
            { type: 'file', filePath: `${DEFAULT_PATH}.bg.json`, text: '{}' },
        ]);
        await expect(
            handleAgentNoteRequest({ action: 'delete', id: 2 }),
        ).resolves.toEqual({ file: 'Default', deleted: 'A', undoId: 'undo-1' });
        expect(getRestores()).toEqual([
            { type: 'file', filePath: DEFAULT_PATH, text: 'saved notes' },
            { type: 'file', filePath: `${DEFAULT_PATH}.bg.json`, text: '{}' },
        ]);
        expect(note.deleteItem).toHaveBeenCalledWith(item);

        mocks.snapshotAgentSidecars.mockRejectedValueOnce(new Error('locked'));
        await expect(
            handleAgentNoteRequest({ action: 'delete', id: 2 }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (locked).',
        });
        expect(note.deleteItem).toHaveBeenCalledOnce();
    });

    test('a note gone from the fresh copy, or a file that will not save, is unfinished', async () => {
        mocks.fromFilePath
            .mockResolvedValueOnce(genNote([genNoteItem(2, 'A')]))
            .mockResolvedValueOnce(genNote([]));
        await expect(
            handleAgentNoteRequest({ action: 'delete', id: 2 }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Removing the note “A” could not be finished: the note is not ' +
                'in the file any more. Anything it did get to do can be put ' +
                'back with owa_undo.',
        });
        const unsaved = genNote([genNoteItem(2, 'A')], { isSaved: false });
        mocks.fromFilePath.mockResolvedValue(unsaved);
        await expect(
            handleAgentNoteRequest({ action: 'delete', id: 2 }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining(
                'the notes file could not be saved.',
            ),
        });
        expect(unsaved.deleteItem).toHaveBeenCalledOnce();
    });
});

describe('whole files', () => {
    test('create-file refuses a bad name, a path outside, and a taken name', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'create-file', file: '.hidden' }),
        ).resolves.toMatchObject({
            reason: 'A name cannot start with a dot.',
        });
        mocks.toAgentFilePath.mockReturnValueOnce(null);
        await expect(
            handleAgentNoteRequest({ action: 'create-file', file: 'Easter' }),
        ).resolves.toMatchObject({
            reason: 'That file name would not stay inside the notes folder.',
        });
        await expect(
            handleAgentNoteRequest({ action: 'create-file', file: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'A notes file called "Sunday" is already there. "Sunday (2)" ' +
                'is free.',
        });
        expect(mocks.findAgentFreeName).toHaveBeenCalledWith(
            DIR,
            'Sunday',
            'own',
        );
        expect(mocks.createNote).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('create-file that makes nothing is unfinished', async () => {
        mocks.createNote.mockResolvedValue(null);
        await expect(
            handleAgentNoteRequest({ action: 'create-file', file: 'Easter' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Making the notes file “Easter” could not be finished: the ' +
                'notes file could not be made. Anything it did get to do can ' +
                'be put back with owa_undo.',
        });
        expect(getRestores()).toEqual([
            { type: 'file', filePath: `${DIR}/Easter.own`, text: null },
        ]);
    });

    test('rename-file refuses before renaming anything', async () => {
        await expect(
            handleAgentNoteRequest({
                action: 'rename-file',
                file: 'Easter',
                newName: 'Lent',
            }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no notes file called "Easter"'),
        });
        await expect(
            handleAgentNoteRequest({
                action: 'rename-file',
                file: 'Sunday',
                newName: 'Lent.',
            }),
        ).resolves.toMatchObject({
            reason: 'A name cannot end with a dot.',
        });
        mocks.toAgentFilePath
            .mockImplementationOnce((dir: string, name: string) => {
                return `${dir}/${name}.own`;
            })
            .mockReturnValueOnce(null);
        await expect(
            handleAgentNoteRequest({
                action: 'rename-file',
                file: 'Sunday',
                newName: 'Lent',
            }),
        ).resolves.toMatchObject({
            reason: 'That new name would not stay inside the notes folder.',
        });
        await expect(
            handleAgentNoteRequest({
                action: 'rename-file',
                file: 'Sunday',
                newName: 'Default',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'A notes file called "Default" is already there, so ' +
                '"Sunday" was not renamed.',
        });
        expect(mocks.renameAgentFile).not.toHaveBeenCalled();
        expect(mocks.runWithAgentBackup).not.toHaveBeenCalled();
    });

    test('renaming Default takes its editing history along and says a new one is made', async () => {
        await expect(
            handleAgentNoteRequest({
                action: 'rename-file',
                newName: 'Archive',
            }),
        ).resolves.toEqual({
            renamedFrom: 'Default',
            renamedTo: 'Archive',
            undoId: 'undo-1',
            note:
                'The app makes a new Default notes file the next time the ' +
                'Bible Notes panel shows.',
        });
        expect(getRestores()).toEqual([
            {
                type: 'rename',
                from: DEFAULT_PATH,
                to: `${DIR}/Archive.own`,
                kind: 'note',
            },
        ]);
        expect(mocks.renameAgentFile).toHaveBeenCalledWith(
            DEFAULT_PATH,
            'Archive',
            'note',
        );
    });

    test('a rename that fails is unfinished', async () => {
        mocks.renameAgentFile.mockRejectedValueOnce(
            new Error('"Sunday" could not be renamed.'),
        );
        await expect(
            handleAgentNoteRequest({
                action: 'rename-file',
                file: 'Sunday',
                newName: 'Lent',
            }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Renaming the notes file “Sunday” could not be finished: ' +
                '"Sunday" could not be renamed. Anything it did get to do can ' +
                'be put back with owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });

    test('delete-file sends Default to the trash with its history, and an undo id', async () => {
        mocks.fromFilePath.mockResolvedValue(
            genNote([{ id: -1 }, genNoteItem(1, 'A'), genNoteItem(2, 'B')]),
        );
        await expect(
            handleAgentNoteRequest({ action: 'delete-file' }),
        ).resolves.toEqual({
            deleted: 'Default',
            isInTrash: true,
            count: 2,
            undoId: 'undo-1',
            note:
                'It is in the trash, and owa_undo puts it back. The app makes ' +
                'a new Default notes file the next time the Bible Notes panel ' +
                'shows.',
        });
        expect(mocks.snapshotAgentFileForDelete).toHaveBeenCalledWith(
            DEFAULT_PATH,
            'note',
        );
        expect(mocks.trashAgentFile).toHaveBeenCalledWith(DEFAULT_PATH, 'note');
    });

    test('delete-file refuses a missing file and trashes nothing unbacked', async () => {
        await expect(
            handleAgentNoteRequest({ action: 'delete-file', file: 'Easter' }),
        ).resolves.toMatchObject({
            reason: expect.stringContaining('no notes file called "Easter"'),
        });
        mocks.fromFilePath.mockResolvedValue(genNote([]));
        mocks.snapshotAgentFileForDelete.mockRejectedValueOnce(
            new Error('too big'),
        );
        await expect(
            handleAgentNoteRequest({ action: 'delete-file', file: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason: 'Nothing was changed: no backup (too big).',
        });
        expect(mocks.trashAgentFile).not.toHaveBeenCalled();
    });

    test('a file the trash will not take is reported, not deleted outright', async () => {
        mocks.fromFilePath.mockResolvedValue(genNote([]));
        mocks.trashAgentFile.mockRejectedValueOnce(
            new Error('"Sunday" could not be moved to the trash.'),
        );
        await expect(
            handleAgentNoteRequest({ action: 'delete-file', file: 'Sunday' }),
        ).resolves.toEqual({
            isError: true,
            reason:
                'Moving the notes file “Sunday” to the trash could not be ' +
                'finished: "Sunday" could not be moved to the trash. Anything ' +
                'it did get to do can be put back with owa_undo.',
        });
        expect(mocks.handleError).toHaveBeenCalledOnce();
    });
});
