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
        hasHistory: true,
        backups: [] as { summary: string; restores: any[] }[],
        notified: [] as string[],
        failBackup: false,
        resolveVersionOrder: vi.fn(),
        resolveBibleItem: vi.fn(),
        handleError: vi.fn(),
    };
});

vi.mock('./errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async () => h.isThere,
    fsReadFile: async () => h.fileText,
    pathBasename: (path: string) => path.split(/[\\/]/).pop(),
}));
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
        h.backups.push({ summary, restores });
        return { meta: { id: 'u1' }, value: await change() };
    },
    snapshotAgentEditing: async (kind: string, filePath: string) => {
        return h.hasHistory
            ? { type: 'editing', kind, filePath, text: '{"head":true}' }
            : null;
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
    getBibleFontFamily: async () => 'serif',
}));

import { handleAgentNoteEditRequest } from './agentNoteEditHelpers';
import { genNoteContentHash } from './agentNoteBlockHelpers';

const FILE_PATH = 'C:/data/bible-notes/Default.own';

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
        getItemById: vi.fn((id: number) => (id === item.id ? item : null)),
        addItemEditingHistory: vi.fn(async () => {}),
        updateNoteItem: vi.fn(),
        save: vi.fn(async () => true),
    };
}

const CONTENT = genContent(['Grace', 'Mercy']);
let noteItem: any;

beforeEach(() => {
    h.sessionId = 'default';
    h.isThere = true;
    h.hasHistory = true;
    h.failBackup = false;
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
    h.resolveVersionOrder.mockReset().mockResolvedValue({
        order: ['KJV'],
        installed: ['KJV'],
    });
    h.resolveBibleItem.mockReset();
    h.handleError.mockReset();
});

function ask(request: Record<string, unknown>) {
    return handleAgentNoteEditRequest({
        filePath: FILE_PATH,
        noteId: 3,
        ...request,
    }) as Promise<any>;
}

describe('reading one note', () => {
    test('its blocks, its name, its file and its hash, from the editing head', async () => {
        const answer = await ask({ action: 'read' });
        expect(answer).toMatchObject({
            name: 'Sunday',
            file: 'Default',
            hash: genNoteContentHash(CONTENT),
            blockCount: 2,
        });
        expect(answer.blocks.map((block: any) => block.text)).toEqual([
            'Grace',
            'Mercy',
        ]);
    });

    test('a file outside the Bible Notes folders, or no note file, is refused', async () => {
        h.sessionId = null;
        expect((await ask({ action: 'read' })).reason).toMatch(
            /not a notes file/,
        );
        h.sessionId = 'default';
        expect(
            (await ask({ action: 'read', filePath: 'C:/x/Default.txt' }))
                .reason,
        ).toMatch(/not a notes file/);
        h.isThere = false;
        expect((await ask({ action: 'read' })).reason).toMatch(
            /not there any more/,
        );
    });

    test('a missing note, a bad id and a verse mark are refused', async () => {
        expect((await ask({ action: 'read', noteId: 9 })).reason).toMatch(
            /not in the file/,
        );
        expect((await ask({ action: 'read', noteId: -1 })).reason).toMatch(
            /note number/,
        );
        noteItem.isVerseItem = true;
        expect((await ask({ action: 'read' })).reason).toMatch(
            /highlights and comments/,
        );
    });

    test('an unknown action is said so', async () => {
        expect((await ask({ action: 'delete' })).reason).toMatch(
            /read or edit/,
        );
    });
});

describe('changing one note', () => {
    test('writes ONE history step from the head, backed up, and tells an open window', async () => {
        const answer = await ask({
            action: 'edit',
            hash: genNoteContentHash(CONTENT),
            changes: [{ block: 2, text: 'Mercy and **truth**' }],
        });
        expect(answer).toMatchObject({
            name: 'Sunday',
            isChanged: true,
            isSaved: false,
            undoId: 'u1',
        });
        expect(h.headNote.addItemEditingHistory).toHaveBeenCalledWith(noteItem);
        expect(noteItem.content).toContain('"truth"');
        expect(answer.hash).toBe(genNoteContentHash(noteItem.content));
        expect(h.backups).toHaveLength(1);
        expect(h.backups[0].restores).toEqual([
            {
                type: 'editing',
                kind: 'note',
                filePath: FILE_PATH,
                text: '{"head":true}',
            },
        ]);
        expect(h.backups[0].summary).toContain('"Sunday"');
        expect(h.notified).toEqual([FILE_PATH]);
        // The title is the list's: not touched.
        expect(h.savedNote.save).not.toHaveBeenCalled();
    });

    test('a note with no history yet keeps the FILE as the head the undo puts back', async () => {
        h.hasHistory = false;
        h.fileText = '{"items":[]}';
        await ask({ action: 'edit', changes: [{ block: 1, text: 'Hope' }] });
        expect(h.backups[0].restores).toEqual([
            {
                type: 'editing',
                kind: 'note',
                filePath: FILE_PATH,
                text: JSON.stringify({ items: [] }, null, 2),
            },
        ]);
    });

    test('a new title is saved to the file, as Edit Title does', async () => {
        const answer = await ask({ action: 'edit', title: 'Sunday sermon' });
        expect(answer.name).toBe('Sunday sermon');
        expect(h.headNote.addItemEditingHistory).not.toHaveBeenCalled();
        const savedItem = h.savedNote.getItemById(3);
        expect(savedItem.title).toBe('Sunday sermon');
        expect(h.savedNote.updateNoteItem).toHaveBeenCalledWith(
            savedItem,
            true,
        );
        expect(h.savedNote.save).toHaveBeenCalledOnce();
        expect(h.backups[0].restores).toEqual([
            { type: 'file', filePath: FILE_PATH, text: 'file', kind: 'note' },
        ]);
    });

    test('a note typed into since it was read is read again first', async () => {
        const answer = await ask({
            action: 'edit',
            hash: 'stale',
            changes: [{ block: 1, text: 'Hope' }],
        });
        expect(answer.reason).toMatch(/read it again/);
        expect(h.backups).toHaveLength(0);
    });

    test('a new verse is read from the installed Bible, never from the model', async () => {
        h.resolveBibleItem.mockResolvedValue({
            bibleKey: 'KJV',
            toTitleWithBibleKey: async () => '(KJV) Romans 8:28',
            toTitle: async () => 'Romans 8:28',
            toText: async () => '(28): And we know',
        });
        await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'See [^Romans 8:28]' }],
        });
        expect(h.resolveBibleItem).toHaveBeenCalledWith('Romans 8:28', ['KJV']);
        const mention = JSON.parse(noteItem.content).root.children[0]
            .children[1];
        expect(mention).toMatchObject({
            type: 'mention',
            mentionKind: 'bible-verse',
            mentionName: '(KJV) Romans 8:28',
            mentionData: '(28): And we know',
            style: 'font-family: serif;',
        });
    });

    test('a verse no Bible can read refuses the whole change', async () => {
        h.resolveBibleItem.mockResolvedValue(null);
        const answer = await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'See [^Hezekiah 9:9]' }],
        });
        expect(answer.reason).toMatch(/Hezekiah 9:9/);
        expect(h.backups).toHaveLength(0);
    });

    test('words given back as they are change nothing and back nothing up', async () => {
        const answer = await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'Grace' }],
        });
        expect(answer.isChanged).toBe(false);
        expect(h.backups).toHaveLength(0);
        expect(h.notified).toEqual([]);
    });

    test('no backup, no change', async () => {
        h.failBackup = true;
        const answer = await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'Hope' }],
        });
        expect(answer.reason).toMatch(/no backup/);
        expect(h.headNote.addItemEditingHistory).not.toHaveBeenCalled();
    });

    test('nothing to change, or changes that are no list, are refused', async () => {
        expect((await ask({ action: 'edit' })).reason).toMatch(
            /Nothing to change/,
        );
        expect((await ask({ action: 'edit', changes: 'x' })).reason).toMatch(
            /list of changes/,
        );
    });
});
