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
        langList: [] as any[],
        lookupRecords: [] as any[],
        lookupReleased: 0,
        homeStorage: new Map<string, string>(),
        // The note window the worker runs in (`noteWindowControllerHelpers`).
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
    initAllLangCss: async () => h.langList,
}));
vi.mock('../location-name-lookup/lookupDataHelpers', () => ({
    acquireLookupData: async () => ({
        namesLookupManager: { searchNames: () => h.lookupRecords },
        locationsLookupManager: { searchLocations: () => h.lookupRecords },
    }),
    releaseLookupData: () => {
        h.lookupReleased++;
    },
}));

import {
    genNewNoteContent,
    handleAgentNoteEditRequest,
} from './agentNoteEditHelpers';
import { genNoteContentHash, readNoteBlocks } from './agentNoteBlockHelpers';

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

/**
 * The note's own window as the worker meets it: it shows `noteItem`, and a
 * change put into its editor is kept the way its own save keeps typing.
 */
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
    h.controller = genController();
    h.resolveVersionOrder.mockReset().mockResolvedValue({
        order: ['KJV'],
        installed: ['KJV'],
    });
    h.resolveBibleItem.mockReset();
    h.handleError.mockReset();
    h.langList = [];
    h.lookupRecords = [];
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
        // A window still open on a note taken out of its file.
        h.controller = genController({ noteId: 9 });
        expect((await ask({ action: 'read', noteId: 9 })).reason).toMatch(
            /not in the file/,
        );
        h.controller = genController();
        expect((await ask({ action: 'read', noteId: -1 })).reason).toMatch(
            /note number/,
        );
        noteItem.isVerseItem = true;
        expect((await ask({ action: 'read' })).reason).toMatch(
            /highlights and comments/,
        );
    });

    // 2026-11-08, the user: _it's dangerous to read and modify wrong file …
    // bible-note chatbot should depend on bible-note UI controller_.
    test('only in the note window that shows THAT note: no window, or another note, is refused', async () => {
        h.controller = null;
        expect(await ask({ action: 'read' })).toMatchObject({
            isError: true,
            code: 'not-note-window',
        });
        // The same file name and note number in ANOTHER Bible Notes folder.
        h.controller = genController({
            filePath: 'C:/other-session/bible-notes/Default.own',
        });
        const refused = await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'Hope' }],
        });
        expect(refused).toMatchObject({
            isError: true,
            code: 'other-note-window',
        });
        expect(h.controller.writeContent).not.toHaveBeenCalled();
        expect(h.backups).toHaveLength(0);
        // Another note of the same file.
        h.controller = genController({ noteId: 4 });
        expect((await ask({ action: 'read' })).code).toBe('other-note-window');
        // The same path written another way is the same file.
        h.controller = genController({
            filePath: 'C:\\data\\bible-notes\\DEFAULT.own',
        });
        expect((await ask({ action: 'read' })).name).toBe('Sunday');
    });

    test('reads what the editor SHOWS, after keeping what was just typed', async () => {
        const shown = genContent(['Grace', 'Mercy', 'typed a moment ago']);
        h.controller = genController({ readContent: () => shown });
        const answer = await ask({ action: 'read' });
        expect(h.controller.flush).toHaveBeenCalled();
        expect(answer.hash).toBe(genNoteContentHash(shown));
        expect(answer.blocks.map((block: any) => block.text)).toEqual([
            'Grace',
            'Mercy',
            'typed a moment ago',
        ]);
    });

    test('an unknown action is said so', async () => {
        expect((await ask({ action: 'delete' })).reason).toMatch(
            /read, edit, undo, redo or view/,
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
        const answer = await ask({
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
        // Which Bible it came from is said, whichever was asked.
        expect(answer.summary).toContain(
            'new verses read from the Bible: (KJV) Romans 8:28',
        );
    });

    test('a verse token naming a Bible is read from THAT Bible, whatever the lookup is on', async () => {
        h.resolveVersionOrder.mockImplementation(async (key: string | null) => {
            return key === null
                ? { order: ['TQAB', 'KJV'], installed: ['TQAB', 'KJV'] }
                : { order: [key], installed: ['TQAB', 'KJV'] };
        });
        h.resolveBibleItem.mockImplementation(
            async (ref: string, order: string[]) => {
                return {
                    bibleKey: order[0],
                    toTitleWithBibleKey: async () => `(${order[0]}) ${ref}`,
                    toTitle: async () => ref,
                    toText: async () => '(1): Now faith',
                };
            },
        );
        const answer = await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'Faith [^(KJV) Hebrews 11:1]' }],
        });
        expect(h.resolveBibleItem).toHaveBeenCalledWith('Hebrews 11:1', [
            'KJV',
        ]);
        expect(answer.summary).toContain('(KJV) Hebrews 11:1');
        // A Bible not installed refuses the change, in a sentence.
        h.resolveVersionOrder.mockResolvedValue({
            reason: 'No Bible version called "XYZ" is installed.',
        });
        const refused = await ask({
            action: 'edit',
            changes: [{ block: 2, text: 'Mercy [^(XYZ) John 3:16]' }],
        });
        expect(refused.reason).toMatch(/XYZ/);
    });

    test('a change goes INTO the editor; one it does not take changes nothing it says', async () => {
        await ask({ action: 'edit', changes: [{ block: 1, text: 'Hope' }] });
        expect(h.controller.writeContent).toHaveBeenCalledOnce();
        expect(JSON.parse(h.controller.writeContent.mock.calls[0][0])).toEqual(
            JSON.parse(noteItem.content),
        );
        h.controller = genController({
            writeContent: vi.fn(async () => false),
        });
        const answer = await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'Love' }],
        });
        expect(answer.reason).toMatch(/did not take the change/);
    });

    test('a read-only preview window is read, never changed', async () => {
        h.controller = genController({ isReadOnly: true });
        expect((await ask({ action: 'read' })).name).toBe('Sunday');
        const answer = await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'Hope' }],
        });
        expect(answer.reason).toMatch(/read-only/);
        expect(h.controller.writeContent).not.toHaveBeenCalled();
        expect(h.backups).toHaveLength(0);
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

// 2026-11-08, the user: _make chatbot able to use all toolbar operations_.
// The parts of the toolbar the worker does: Undo, Redo, the font box's list
// and a new person or place mention (named after the inventory,
// `agentNoteToolbarParity.test.ts`).
describe("the note editor's toolbar, in the worker", () => {
    // The head after one step of the history: what the next read finds.
    function stepTo(words: string[], others: any[] = []) {
        const stepped = { ...noteItem, content: genContent(words) };
        const after = genNote(stepped);
        after.items = [stepped, ...others];
        return after;
    }

    test('toolbar: undo', async () => {
        const before = h.headNote;
        const after = stepTo(['Grace']);
        before.historyUndo.mockImplementation(async () => {
            h.headNote = after;
            return true;
        });
        const answer = await ask({ action: 'undo' });
        expect(before.historyUndo).toHaveBeenCalledTimes(1);
        expect(answer).toMatchObject({
            name: 'Sunday',
            isChanged: true,
            hash: genNoteContentHash(genContent(['Grace'])),
            isSaved: false,
        });
        // An open note window shows it.
        expect(h.notified).toEqual([FILE_PATH]);
        // Nothing left to go back to is said so.
        h.headNote = genNote(noteItem);
        h.headNote.historyUndo.mockResolvedValue(false);
        expect((await ask({ action: 'undo' })).reason).toMatch(
            /nothing kept to go back to/,
        );
    });

    // Seen live 2026-11-08: an open note window wrote a change back its own
    // way as a step of its own, and "undo that" took back only that step.
    test('a step that only re-wrote the note is stepped over', async () => {
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
            h.headNote = count === 1 ? echoNote : stepTo(['Grace']);
            return true;
        });
        const answer = await ask({ action: 'undo' });
        expect(count).toBe(2);
        expect(answer.hash).toBe(genNoteContentHash(genContent(['Grace'])));
    });

    test('toolbar: redo', async () => {
        const before = h.headNote;
        before.historyRedo.mockImplementation(async () => {
            h.headNote = stepTo(['Grace', 'Mercy', 'Peace']);
            return true;
        });
        const answer = await ask({ action: 'redo' });
        expect(before.historyRedo).toHaveBeenCalledTimes(1);
        expect(answer.isChanged).toBe(true);
        h.headNote = genNote(noteItem);
        h.headNote.historyRedo.mockResolvedValue(false);
        expect((await ask({ action: 'redo' })).reason).toMatch(
            /nothing undone/,
        );
    });

    test("a step that was another note's of the file is taken back and refused", async () => {
        const other = {
            id: 4,
            title: 'Other',
            content: 'a',
            isVerseItem: false,
        };
        const before = genNote(noteItem);
        before.items = [noteItem, other];
        h.headNote = before;
        before.historyUndo.mockImplementation(async () => {
            const after = genNote({ ...noteItem });
            after.items = [{ ...noteItem }, { ...other, content: 'b' }];
            h.headNote = after;
            return true;
        });
        const answer = await ask({ action: 'undo' });
        expect(answer.reason).toMatch(/another of its notes/);
        // ...and put forward again, so the other note keeps its change.
        expect(before.historyRedo).toHaveBeenCalledTimes(1);
        expect(h.notified).toEqual([]);
    });

    test("a read lists the font box's fonts, an installed language's face too", async () => {
        h.langList = [{ fontFamily: 'app-Xx-Face' }, { langCode: 'en' }];
        const answer = await ask({ action: 'read' });
        expect(answer.fonts).toContain('Georgia');
        expect(answer.fonts).toContain('app-Xx-Face');
        // A font change is checked against that same list.
        const changed = await ask({
            action: 'edit',
            changes: [{ block: 1, font: 'app-xx-face' }],
        });
        expect(changed.isChanged).toBe(true);
        const written = h.headNote.addItemEditingHistory.mock.calls[0][0];
        expect(written.content).toContain('font-family: app-Xx-Face;');
    });

    test('a new person is a mention from the names lookup, read only for it', async () => {
        h.lookupRecords = [
            { id: 'n-1', name: 'Moses', kjvName: 'Moses' },
            { id: 'n-2', name: 'Mosera' },
        ];
        const answer = await ask({
            action: 'edit',
            changes: [{ block: 1, text: 'Grace to [@moses]' }],
        });
        expect(answer.isChanged).toBe(true);
        const written = JSON.parse(
            h.headNote.addItemEditingHistory.mock.calls[0][0].content,
        );
        expect(written.root.children[0].children[1]).toMatchObject({
            type: 'mention',
            mentionKind: 'mention',
            mentionId: 'n-1',
            mentionName: 'Moses',
            text: 'moses',
        });
        // Given back at once.
        expect(h.lookupReleased).toBe(1);
        // A change with no new name never reads the lookup.
        await ask({ action: 'edit', changes: [{ block: 2, text: 'Peace' }] });
        expect(h.lookupReleased).toBe(1);
    });
});

// The two toolbar controls that keep nothing in the note: the ¶ view and
// Link block text are the editor's own keys of the app's home storage.
describe("the note editor's own keys", () => {
    const SETTINGS_KEY = 'lexical-playground-settings';
    const LINKS_KEY = 'lexical-playground-block-text-links';

    test('toolbar: show-invisible-characters', async () => {
        h.homeStorage.set(SETTINGS_KEY, '{"isCodeShiki":true}');
        const shown = await ask({ action: 'view', invisibleCharacters: true });
        expect(shown).toMatchObject({ isChanged: true, undoId: 'u1' });
        // Kept as the editor keeps it: only what differs from its defaults.
        expect(JSON.parse(h.homeStorage.get(SETTINGS_KEY)!)).toEqual({
            isCodeShiki: true,
            showInvisibleCharacters: true,
        });
        // Backed up as it was, and the note window told.
        expect(h.backups[0].restores).toEqual([
            {
                type: 'home-setting',
                key: SETTINGS_KEY,
                text: '{"isCodeShiki":true}',
                filePath: FILE_PATH,
            },
        ]);
        expect(h.notified).toEqual([FILE_PATH]);
        // Asked again, nothing to do.
        expect(
            (await ask({ action: 'view', invisibleCharacters: true }))
                .isChanged,
        ).toBe(false);
        await ask({ action: 'view', invisibleCharacters: false });
        expect(JSON.parse(h.homeStorage.get(SETTINGS_KEY)!)).toEqual({
            isCodeShiki: true,
        });
        expect((await ask({ action: 'view' })).reason).toMatch(
            /invisibleCharacters/,
        );
    });

    test("toolbar: link-block-text -- added to the editor's own list", async () => {
        h.homeStorage.set(LINKS_KEY, '[{"id":"older"}]');
        const answer = await ask({
            action: 'edit',
            changes: [{ block: 2, linkTo: 1 }],
        });
        expect(answer).toMatchObject({ isChanged: true, undoId: 'u1' });
        const links = JSON.parse(h.homeStorage.get(LINKS_KEY)!);
        expect(links).toHaveLength(2);
        expect(links[0]).toEqual({ id: 'older' });
        expect(links[1]).toMatchObject({
            kind: 'direction-to',
            from: { blockPaths: [[1]] },
            to: { blockPaths: [[0]] },
        });
        // The note itself is not written: only the list, backed up first.
        expect(h.headNote.addItemEditingHistory).not.toHaveBeenCalled();
        expect(h.backups[0].restores).toEqual([
            {
                type: 'home-setting',
                key: LINKS_KEY,
                text: '[{"id":"older"}]',
                filePath: FILE_PATH,
            },
        ]);
        expect(h.notified).toEqual([FILE_PATH]);
    });
});

// `owa_bible_note add` with mark-up (2026-11-08): a new note built by the
// rules a change is, a verse read from the installed Bible.
describe('genNewNoteContent', () => {
    test('headings, lists and a verse from the installed Bible', async () => {
        h.resolveBibleItem.mockImplementation(async (ref: string) => {
            return ref === 'Genesis 2:7'
                ? {
                      bibleKey: 'KJV',
                      toTitleWithBibleKey: async () => '(KJV) Genesis 2:7',
                      toTitle: async () => 'Genesis 2:7',
                      toText: async () => '(7): And the LORD God formed man',
                  }
                : null;
        });
        const content = await genNewNoteContent(
            '# Creation\n## Key verses\n- [^Genesis 2:7] man formed\n' +
                '- [^Hezekiah 9:9] no such book',
            'Creation',
        );
        expect(content).not.toBeNull();
        const blocks = readNoteBlocks(content!)!.blocks;
        expect(
            blocks.map((block) => {
                return [block.kind, block.text];
            }),
        ).toEqual([
            ['h2', 'Key verses'],
            ['bullet', '[^(KJV) Genesis 2:7] man formed'],
            // No Bible has it: the note is made, the reference its words.
            ['bullet', 'Hezekiah 9:9 no such book'],
        ]);
        const mention = JSON.parse(content!).root.children[1].children[0]
            .children[0];
        expect(mention).toMatchObject({
            type: 'mention',
            mentionKind: 'bible-verse',
            mentionName: '(KJV) Genesis 2:7',
        });
        // Nothing written, nothing backed up: the caller writes the file.
        expect(h.backups).toHaveLength(0);
    });

    test('no Bible at all leaves every verse as its words', async () => {
        h.resolveVersionOrder.mockResolvedValue({ reason: 'No Bible.' });
        const content = await genNewNoteContent('- read [^John 3:16]');
        expect(
            readNoteBlocks(content!)!.blocks.map((block) => block.text),
        ).toEqual(['read John 3:16']);
    });

    test('words that are only the title make an empty note; too many blocks, none', async () => {
        await expect(genNewNoteContent('# Sunday', 'Sunday')).resolves.toBe('');
        await expect(
            genNewNoteContent(
                Array.from({ length: 201 }, (_, index) => {
                    return `- point ${index}`;
                }).join('\n'),
            ),
        ).resolves.toBeNull();
    });
});
