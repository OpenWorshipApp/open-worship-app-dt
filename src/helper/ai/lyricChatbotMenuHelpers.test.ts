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
    genLyricOpenInChatbotContextMenu,
    openLyricInChatbot,
} from './lyricChatbotMenuHelpers';

const SONG_PATH = '/docs/Still here.owl';

beforeEach(() => {
    h.isAiEnabled = true;
    h.openChatbotWithFile.mockReset().mockResolvedValue(true);
    h.handleError.mockReset();
});

describe('Open in Chatbot on a song', () => {
    test('is one robot item that opens the help window on the song', async () => {
        const [item, ...rest] = genLyricOpenInChatbotContextMenu(SONG_PATH);
        expect(rest).toEqual([]);
        expect(item.menuElement).toBe('Open in Chatbot');
        expect(item.childBefore).toBe('icon:robot');
        item.onSelect?.({} as any, {} as any);
        await vi.dynamicImportSettled();
        expect(h.openChatbotWithFile).toHaveBeenCalledWith(SONG_PATH);
    });

    test('is not offered while AI is off', () => {
        h.isAiEnabled = false;
        expect(genLyricOpenInChatbotContextMenu(SONG_PATH)).toEqual([]);
    });

    test('a window that will not open is handled, not thrown', async () => {
        const error = new Error('no window');
        h.openChatbotWithFile.mockRejectedValue(error);
        expect(await openLyricInChatbot(SONG_PATH)).toBe(false);
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});
