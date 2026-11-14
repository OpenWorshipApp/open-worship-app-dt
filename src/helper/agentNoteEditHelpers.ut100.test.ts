/**
 * `owa_note_edit`'s worker (`agentNoteEditHelpers.ts`) where things go
 * wrong: an older note, a language face that fails to load, a lookup that
 * cannot be asked, a rename that cannot be saved, an echo step that cannot
 * be stepped over, the ¶ setting broken or failing to back up, and the
 * Default Example added through the worker.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    class NoBackupError extends Error {}
    return {
        NoBackupError,
        sessionId: 'default' as string | null,
        isThere: true,
        fileText: '',
        headNote: null as any,
        savedNote: null as any,
        backups: [] as { summary: string; restores: any[] }[],
        notified: [] as string[],
        failBackup: false,
        backupError: null as Error | null,
        resolveVersionOrder: vi.fn(),
        resolveBibleItem: vi.fn(),
        handleError: vi.fn(),
        langList: [] as any[],
        langError: null as Error | null,
        lookupError: null as Error | null,
        lookupReleased: 0,
        homeStorage: new Map<string, string>(),
        controller: null as any,
    };
});

vi.mock('./errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async () => h.isThere,
    fsReadFile: async () => h.fileText,
    pathBasename: (path: string) => path.split(/[\\/]/).pop(),
    pathResolve: (path: string) => path.replace(/\\/g, '/'),
    toPathCompareKey: (path: string) => path.toLowerCase(),
}));
vi.mock(
    '../bible-list/note/noteWindowControllerHelpers',
    async (importOriginal) => ({
        ...(await importOriginal<object>()),
        getNoteWindowController: () => h.controller,
    }),
);
vi.mock('../media-sessions/folderSessionPathHelpers', () => ({
    findSessionIdByFilePath: () => h.sessionId,
}));
vi.mock('../bible-list/note/bibleNotePreviewHelpers', () => ({
    checkIsBibleNoteFileName: (name: string) => name.endsWith('.own'),
}));
vi.mock('../bible-list/note/noteHeadChangeHelpers', () => ({
    notifyNoteHeadChanged: (filePath: string) => h.notified.push(filePath),
}));
vi.mock('./agentBackupHelpers', () => ({
    NoBackupError: h.NoBackupError,
    genUndoField: (meta: any) => ({ undoId: meta.id, undo: 'owa_undo' }),
    runWithAgentBackup: async (
        summary: string,
        restores: any[],
        change: () => Promise<unknown>,
    ) => {
        if (h.failBackup) {
            throw new h.NoBackupError('Nothing was changed: no backup.');
        }
        if (h.backupError !== null) {
            throw h.backupError;
        }
        h.backups.push({ summary, restores });
        return { meta: { id: 'u1' }, value: await change() };
    },
    snapshotAgentEditing: async (kind: string, filePath: string) => {
        return { type: 'editing', kind, filePath, text: '{"head":true}' };
    },
    snapshotAgentFile: async (filePath: string, kind: string) => {
        return { type: 'file', filePath, text: 'file', kind };
    },
}));
vi.mock('../bible-list/note/Note', () => ({
    default: {
        fromFilePathEditing: async () => h.headNote,
        fromFilePath: async () => h.savedNote,
    },
}));
vi.mock('./agentBibleHelpers', () => ({
    resolveVersionOrder: h.resolveVersionOrder,
    resolveBibleItem: h.resolveBibleItem,
}));
vi.mock('./bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: async () => '',
}));
vi.mock('../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => h.homeStorage.get(key) ?? null,
        setItem: (key: string, value: string) => {
            h.homeStorage.set(key, value);
        },
        removeItem: (key: string) => {
            h.homeStorage.delete(key);
        },
    },
}));
vi.mock('../lang/langHelpers', () => ({
    initAllLangCss: async () => {
        if (h.langError !== null) {
            throw h.langError;
        }
        return h.langList;
    },
}));
vi.mock('../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: async () => {
        if (h.lookupError !== null) {
            throw h.lookupError;
        }
        return {
            namesLookupManager: { searchNames: () => [] },
            locationsLookupManager: { searchLocations: () => [] },
        };
    },
    releaseLookupData: () => {
        h.lookupReleased++;
    },
}));

import exampleData from './agentNoteDefaultExample.json';
import {
    genNewNoteContent,
    handleAgentNoteEditRequest,
} from './agentNoteEditHelpers';
import { genNoteContentHash, readNoteBlocks } from './agentNoteBlockHelpers';
import { NOTE_STANDARD_FONT_LIST } from './agentNoteStyleHelpers';
import { NOTE_WINDOW_MISSING_CODE } from '../bible-list/note/noteWindowControllerHelpers';

const FILE_PATH = 'C:/data/bible-notes/Default.own';
const SETTINGS_KEY = 'lexical-playground-settings';

function genContent(words: string[]) {
    return JSON.stringify({
        root: {
            children: words.map((word) => {
                return {
                    children: [
                        {
                            detail: 0,
                            format: 0,
                            mode: 'normal',
                            style: '',
                            text: word,
                            type: 'text',
                            version: 1,
                        },
                    ],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'paragraph',
                    version: 1,
                    textFormat: 0,
                    textStyle: '',
                };
            }),
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
        },
    });
}

function genNote(item: any) {
    return {
        items: [item],
        historyUndo: vi.fn(async () => true),
        historyRedo: vi.fn(async () => true),
        getItemById: vi.fn((id: number) => (id === item.id ? item : null)),
        addItemEditingHistory: vi.fn(async () => {}),
        updateNoteItem: vi.fn(),
        save: vi.fn(async () => true),
    };
}

const CONTENT = genContent(['Grace', 'Mercy']);
let noteItem: any;

function genController(overrides: Record<string, unknown> = {}) {
    return {
        filePath: FILE_PATH,
        noteId: 3,
        isReadOnly: false,
        isMounted: () => true,
        readContent: () => noteItem.content,
        writeContent: vi.fn(async (content: string) => {
            noteItem.content = content;
            await h.headNote.addItemEditingHistory(noteItem);
            return true;
        }),
        flush: vi.fn(async () => {}),
        ...overrides,
    };
}

beforeEach(() => {
    h.sessionId = 'default';
    h.isThere = true;
    h.failBackup = false;
    h.backupError = null;
    h.backups = [];
    h.notified = [];
    h.fileText = JSON.stringify({ items: [] });
    noteItem = {
        id: 3,
        title: 'Sunday',
        content: CONTENT,
        isVerseItem: false,
    };
    h.headNote = genNote(noteItem);
    h.savedNote = genNote({ ...noteItem });
    h.controller = genController();
    h.resolveVersionOrder.mockResolvedValue({
        order: ['KJV'],
        installed: ['KJV'],
    });
    h.resolveBibleItem.mockResolvedValue(null);
    h.langList = [];
    h.langError = null;
    h.lookupError = null;
    h.lookupReleased = 0;
    h.homeStorage = new Map();
});

function ask(request: Record<string, unknown>) {
    return handleAgentNoteEditRequest({
        filePath: FILE_PATH,
        noteId: 3,
        ...request,
    }) as Promise<any>;
}

describe('reading', () => {
    test('a note kept in the older form cannot be read', async () => {
        noteItem.content = '<p>An older note</p>';
        expect(await ask({ action: 'read' })).toEqual({
            isError: true,
            reason:
                'This note is kept in an older form that cannot be read ' +
                'here. Ask the person to open it in its own window once.',
        });
    });

    test("a language face that fails to load leaves the font box's six", async () => {
        const error = new Error('css failed');
        h.langError = error;
        const answer = await ask({ action: 'read' });
        expect(answer.fonts).toEqual(
            [...NOTE_STANDARD_FONT_LIST].sort((one, other) => {
                return one.localeCompare(other);
            }),
        );
        expect(h.handleError).toHaveBeenCalledWith(error);
    });

    test('anything that throws on the way is said, never thrown', async () => {
        const error = new Error('The window went away.');
        h.controller = genController({
            flush: vi.fn(async () => {
                throw error;
            }),
        });
        expect(await ask({ action: 'read' })).toEqual({
            isError: true,
            reason: 'The window went away.',
        });
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});

describe('changing', () => {
    test("the editor's Default Example is added after the block asked", async () => {
        const answer = await ask({
            action: 'edit',
            changes: [{ after: 2, kind: 'example' }],
        });
        expect(answer).toMatchObject({ isChanged: true, undoId: 'u1' });
        const exampleCount = readNoteBlocks(
            JSON.stringify({
                root: {
                    children: exampleData.nodes,
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'root',
                    version: 1,
                },
            }),
        )!.blockCount;
        const read = readNoteBlocks(noteItem.content)!;
        expect(exampleCount).toBeGreaterThan(0);
        expect(read.blockCount).toBe(2 + exampleCount);
        expect(read.blocks.slice(0, 2).map((block) => block.text)).toEqual([
            'Grace',
            'Mercy',
        ]);
        expect(read.blocks[2].kind).toBe('h1');
    });

    test('a rename the saved file cannot be read for is not finished', async () => {
        h.savedNote = null;
        const answer = await ask({ action: 'edit', title: 'Easter' });
        expect(answer).toEqual({
            isError: true,
            reason:
                'The change could not be finished: The note could not be ' +
                'read to rename. Anything it did get to do can be put back ' +
                'with owa_undo.',
        });
        expect(h.handleError).toHaveBeenCalledTimes(1);
        expect(h.notified).toEqual([]);
    });

    test('a rename the notes file cannot be saved for is not finished', async () => {
        h.savedNote.save.mockResolvedValue(false);
        const answer = await ask({ action: 'edit', title: 'Easter' });
        expect(answer.reason).toBe(
            'The change could not be finished: The notes file could not be ' +
                'saved. Anything it did get to do can be put back with ' +
                'owa_undo.',
        );
        // The rename was tried on the saved file, and backed up first.
        expect(h.savedNote.updateNoteItem).toHaveBeenCalledTimes(1);
        expect(h.backups[0].restores).toEqual([
            { type: 'file', filePath: FILE_PATH, text: 'file', kind: 'note' },
        ]);
    });
});

describe('undo and redo', () => {
    test('with no note window open, nothing is stepped', async () => {
        h.controller = null;
        const answer = await ask({ action: 'undo' });
        expect(answer).toMatchObject({
            isError: true,
            code: NOTE_WINDOW_MISSING_CODE,
        });
        expect(h.headNote.historyUndo).not.toHaveBeenCalled();
    });

    test('an echo step that cannot be stepped over is answered as the step it was', async () => {
        const before = h.headNote;
        // The same note as it reads, its keys in another order.
        const echo = JSON.stringify(JSON.parse(CONTENT), (_key, value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return Object.fromEntries(Object.entries(value).reverse());
            }
            return value;
        });
        const echoNote = genNote({ ...noteItem, content: echo });
        let count = 0;
        before.historyUndo.mockImplementation(async () => {
            count++;
            if (count === 1) {
                h.headNote = echoNote;
                return true;
            }
            return false;
        });
        const answer = await ask({ action: 'undo' });
        expect(count).toBe(2);
        expect(answer).toEqual({
            name: 'Sunday',
            isChanged: true,
            hash: genNoteContentHash(echo),
            summary: "one step back in the note's history",
            isSaved: false,
        });
        expect(h.notified).toEqual([FILE_PATH]);
    });
});

describe('the ¶ view', () => {
    test('with no note window open, nothing is set', async () => {
        h.controller = null;
        const answer = await ask({ action: 'view', invisibleCharacters: true });
        expect(answer.code).toBe(NOTE_WINDOW_MISSING_CODE);
        expect(h.homeStorage.size).toBe(0);
    });

    test('a broken stored setting is read as none, and backed up as it was', async () => {
        h.homeStorage.set(SETTINGS_KEY, '{oops');
        const answer = await ask({ action: 'view', invisibleCharacters: true });
        expect(answer).toMatchObject({
            isChanged: true,
            summary: 'spaces and line ends shown (the ¶ on)',
        });
        expect(h.homeStorage.get(SETTINGS_KEY)).toBe(
            '{"showInvisibleCharacters":true}',
        );
        expect(h.backups[0].restores[0].text).toBe('{oops');
    });

    test('hidden again when it was the only setting: the key goes', async () => {
        h.homeStorage.set(SETTINGS_KEY, '{"showInvisibleCharacters":true}');
        const answer = await ask({
            action: 'view',
            invisibleCharacters: false,
        });
        expect(answer).toMatchObject({
            isChanged: true,
            summary: 'spaces and line ends hidden (the ¶ off)',
        });
        expect(h.homeStorage.has(SETTINGS_KEY)).toBe(false);
    });

    test('no backup, nothing set; a failure is said', async () => {
        h.failBackup = true;
        expect(
            await ask({ action: 'view', invisibleCharacters: true }),
        ).toEqual({ isError: true, reason: 'Nothing was changed: no backup.' });
        expect(h.homeStorage.size).toBe(0);
        expect(h.handleError).not.toHaveBeenCalled();
        h.failBackup = false;
        const error = new Error('Storage is full.');
        h.backupError = error;
        expect(
            await ask({ action: 'view', invisibleCharacters: true }),
        ).toEqual({ isError: true, reason: 'Storage is full.' });
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(h.notified).toEqual([]);
    });
});

describe('a new note from mark-up', () => {
    test('a name the lookup cannot be asked for stays its words', async () => {
        const error = new Error('lookup data missing');
        h.lookupError = error;
        const content = await genNewNoteContent('Moses met [@Aaron] there');
        expect(content).not.toBeNull();
        expect(
            readNoteBlocks(content!)!.blocks.map((block) => block.text),
        ).toEqual(['Moses met Aaron there']);
        const paragraph = JSON.parse(content!).root.children[0];
        for (const one of paragraph.children) {
            expect(one.type).toBe('text');
        }
        expect(h.handleError).toHaveBeenCalledWith(error);
        // Never acquired, so nothing to give back.
        expect(h.lookupReleased).toBe(0);
    });
});
