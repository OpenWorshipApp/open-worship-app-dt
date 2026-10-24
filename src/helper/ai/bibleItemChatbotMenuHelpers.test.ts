import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAIEnabled: true,
    openChatbotWithBibleItem: vi.fn(async (_bibleItem: unknown) => true),
    handleError: vi.fn(),
}));

vi.mock('./aiHelpers', () => ({
    getIsAIEnabled: () => h.isAIEnabled,
}));
vi.mock('./bibleItemAskHelpers', () => ({
    openChatbotWithBibleItem: h.openChatbotWithBibleItem,
}));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));

import {
    genOpenInChatbotContextMenu,
    openBibleItemInChatbot,
} from './bibleItemChatbotMenuHelpers';

const bibleItem = { bibleKey: 'KJV' } as any;

beforeEach(() => {
    h.isAIEnabled = true;
    h.openChatbotWithBibleItem.mockClear();
    h.handleError.mockClear();
});

describe('Open in Chatbot beside a passage’s Open', () => {
    it('hands the passage to the assistant as the 🤖 does', async () => {
        const items = genOpenInChatbotContextMenu(bibleItem);
        expect(items).toHaveLength(1);
        expect(items[0].menuElement).toBe('Open in Chatbot');
        expect(items[0].childBefore).toBe('icon:robot');
        // Nothing of the asking is loaded until the press.
        expect(h.openChatbotWithBibleItem).not.toHaveBeenCalled();
        items[0].onSelect!({} as any);
        await vi.waitFor(() => {
            expect(h.openChatbotWithBibleItem).toHaveBeenCalledWith(bibleItem);
        });
    });

    it('is not offered while AI is off', () => {
        h.isAIEnabled = false;
        expect(genOpenInChatbotContextMenu(bibleItem)).toEqual([]);
    });

    it('reports an opening that fails', async () => {
        const error = new Error('no window');
        h.openChatbotWithBibleItem.mockRejectedValueOnce(error);
        openBibleItemInChatbot(bibleItem);
        await vi.waitFor(() => {
            expect(h.handleError).toHaveBeenCalledWith(error);
        });
    });
});
