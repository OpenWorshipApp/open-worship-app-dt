import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAiEnabled: true,
    openChatbotWithFile: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('./aiHelpers', () => ({
    getIsAIEnabled: () => h.isAiEnabled,
}));
vi.mock('./chatbotHandoffHelpers', () => ({
    openChatbotWithFile: h.openChatbotWithFile,
}));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
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
});

describe('Open in Chatbot on a Bible note', () => {
    test('is one robot item that opens the help window on THAT note', async () => {
        const [item, ...rest] = genNoteOpenInChatbotContextMenu(NOTE_PATH, 3);
        expect(rest).toEqual([]);
        expect(item.menuElement).toBe('Open in Chatbot');
        expect(item.childBefore).toBe('icon:robot');
        item.onSelect?.({} as any, {} as any);
        await vi.dynamicImportSettled();
        // The file holds many notes: the id says which one.
        expect(h.openChatbotWithFile).toHaveBeenCalledWith(NOTE_PATH, null, 3);
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
