import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAiEnabled: true,
    openChatbotWithFile: vi.fn(),
    handleError: vi.fn(),
    electronSendAsync: vi.fn(),
}));

vi.mock('./aiHelpers', () => ({
    getIsAIEnabled: () => h.isAiEnabled,
}));
vi.mock('./chatbotHandoffHelpers', () => ({
    openChatbotWithFile: h.openChatbotWithFile,
}));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../server/electronSendHelpers', () => ({
    electronSendAsync: h.electronSendAsync,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));

import {
    genNoteOpenInChatbotContextMenu,
    openNoteInChatbot,
} from './noteChatbotMenuHelpers';

const NOTE_PATH = '/notes/Default.own';

beforeEach(() => {
    h.isAiEnabled = true;
    h.openChatbotWithFile.mockReset().mockResolvedValue(true);
    h.handleError.mockReset();
    h.electronSendAsync.mockReset().mockResolvedValue([]);
});

const MAIN_WINDOW = { url: 'https://localhost:3000/reader.html' };
const NOTE_WINDOW = {
    url: 'https://localhost:3000/bibleNote.html?file=Default.own&id=3&uuid=x',
};

// What the help window is opened with once the caution was answered: the
// last argument is run first, as `openChatbotWithFile` runs it.
async function runBeforeOpening() {
    const beforeOpening = h.openChatbotWithFile.mock.calls[0][3];
    await beforeOpening?.();
}

describe('Open in Chatbot on a Bible note', () => {
    test('is one robot item that opens the help window on THAT note', async () => {
        const [item, ...rest] = genNoteOpenInChatbotContextMenu(NOTE_PATH, 3);
        expect(rest).toEqual([]);
        expect(item.menuElement).toBe('Open in Chatbot');
        expect(item.childBefore).toBe('icon:robot');
        item.onSelect?.({} as any, {} as any);
        await vi.dynamicImportSettled();
        // The file holds many notes: the id says which one.
        expect(h.openChatbotWithFile).toHaveBeenCalledWith(
            NOTE_PATH,
            null,
            3,
            null,
        );
    });

    // 2026-11-08, the user: _chatbot should demand select a bible-note
    // window (open one if not opened)_.
    test("from a row, the note's own window is opened when it is not open", async () => {
        h.electronSendAsync.mockResolvedValue([MAIN_WINDOW]);
        const openNoteWindow = vi.fn();
        await openNoteInChatbot(NOTE_PATH, 3, openNoteWindow);
        await runBeforeOpening();
        expect(h.electronSendAsync).toHaveBeenCalledWith(
            'main:app:list-app-windows',
        );
        expect(openNoteWindow).toHaveBeenCalledTimes(1);
    });

    test('an open note window is not opened a second time', async () => {
        h.electronSendAsync.mockResolvedValue([MAIN_WINDOW, NOTE_WINDOW]);
        const openNoteWindow = vi.fn();
        await openNoteInChatbot(NOTE_PATH, 3, openNoteWindow);
        await runBeforeOpening();
        expect(openNoteWindow).not.toHaveBeenCalled();
    });

    test('no window is opened on a guess when the list cannot be read', async () => {
        const openNoteWindow = vi.fn();
        h.electronSendAsync.mockResolvedValue([]);
        await openNoteInChatbot(NOTE_PATH, 3, openNoteWindow);
        await runBeforeOpening();
        h.openChatbotWithFile.mockClear();
        h.electronSendAsync.mockRejectedValue(new Error('no main'));
        await openNoteInChatbot(NOTE_PATH, 3, openNoteWindow);
        await runBeforeOpening();
        expect(openNoteWindow).not.toHaveBeenCalled();
    });

    test('the menu item hands its window opener on', async () => {
        h.electronSendAsync.mockResolvedValue([MAIN_WINDOW]);
        const openNoteWindow = vi.fn();
        const [item] = genNoteOpenInChatbotContextMenu(
            NOTE_PATH,
            3,
            openNoteWindow,
        );
        item.onSelect?.({} as any, {} as any);
        await vi.dynamicImportSettled();
        await runBeforeOpening();
        expect(openNoteWindow).toHaveBeenCalledTimes(1);
    });

    test('is not offered while AI is off', () => {
        h.isAiEnabled = false;
        expect(genNoteOpenInChatbotContextMenu(NOTE_PATH, 0)).toEqual([]);
    });

    test('a window that will not open is handled, not thrown', async () => {
        const error = new Error('no window');
        h.openChatbotWithFile.mockRejectedValue(error);
        expect(await openNoteInChatbot(NOTE_PATH, 0)).toBe(false);
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});
