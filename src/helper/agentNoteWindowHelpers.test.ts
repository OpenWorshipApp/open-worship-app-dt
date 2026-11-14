import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        sessionId: 'default' as string | null,
        isThere: true,
        note: null as any,
        openNoteWindow: vi.fn(),
    };
});

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async () => h.isThere,
    pathBasename: (path: string) => path.split(/[\\/]/).pop(),
}));
vi.mock('../media-sessions/folderSessionPathHelpers', () => ({
    findSessionIdByFilePath: () => h.sessionId,
}));
vi.mock('../bible-list/note/bibleNotePreviewHelpers', () => ({
    checkIsBibleNoteFileName: (name: string) => name.endsWith('.own'),
}));
vi.mock('../bible-list/note/Note', () => ({
    default: { fromFilePath: async () => h.note },
}));
vi.mock('../bible-list/note/noteWindowOpenHelpers', () => ({
    openNoteWindow: h.openNoteWindow,
}));

import { handleAgentNoteWindowRequest } from './agentNoteWindowHelpers';

const FILE_PATH = 'C:/data/bible-notes/Default.own';

beforeEach(() => {
    h.sessionId = 'default';
    h.isThere = true;
    h.openNoteWindow.mockReset();
    h.note = {
        getItemById: (id: number) => {
            return id === 3 ? { id: 3, isVerseItem: false } : null;
        },
    };
});

function ask(request: Record<string, unknown>) {
    return handleAgentNoteWindowRequest({
        filePath: FILE_PATH,
        noteId: 3,
        ...request,
    }) as Promise<any>;
}

describe("opening a note's own window for the note conversation", () => {
    test('opens it the way its row does, by its file name, path and id', async () => {
        expect(await ask({})).toEqual({ isOpened: true });
        expect(h.openNoteWindow).toHaveBeenCalledWith(
            'Default.own',
            FILE_PATH,
            3,
        );
    });

    test('opens nothing for a file outside the Bible Notes folders, or gone', async () => {
        h.sessionId = null;
        expect((await ask({})).reason).toMatch(/not a notes file/);
        h.sessionId = 'default';
        expect((await ask({ filePath: 'C:/x/a.txt' })).reason).toMatch(
            /not a notes file/,
        );
        h.isThere = false;
        expect((await ask({})).reason).toMatch(/not there any more/);
        expect(h.openNoteWindow).not.toHaveBeenCalled();
    });

    test("opens nothing for a note not in the file, a bad id or a verse's marks", async () => {
        expect((await ask({ noteId: 9 })).reason).toMatch(/not in the file/);
        expect((await ask({ noteId: -1 })).reason).toMatch(/note number/);
        h.note = {
            getItemById: () => ({ id: 3, isVerseItem: true }),
        };
        expect((await ask({})).reason).toMatch(/highlights and comments/);
        expect(h.openNoteWindow).not.toHaveBeenCalled();
    });
});
