import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAIEnabled: true,
    openChatbotForBibleListPaste: vi.fn(async () => true),
    handleError: vi.fn(),
}));

vi.mock('./aiHelpers', () => ({
    getIsAIEnabled: () => h.isAIEnabled,
}));
vi.mock('./chatbotHandoffHelpers', () => ({
    openChatbotForBibleListPaste: h.openChatbotForBibleListPaste,
}));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));

import {
    genAddBibleItemContextMenu,
    openBibleListPasteInChatbot,
} from './bibleListChatbotMenuHelpers';

beforeEach(() => {
    h.isAIEnabled = true;
    h.openChatbotForBibleListPaste.mockClear();
    h.handleError.mockClear();
});

// The Bibles panel's Add Bible Item (EC-760): the lookup or the chatbot.
describe('Add Bible Item asks how', () => {
    it('offers the lookup, then the chatbot, while AI is on', async () => {
        const openLookup = vi.fn();
        const items = genAddBibleItemContextMenu(openLookup)!;
        expect(
            items.map((item) => {
                return [item.childBefore, item.menuElement];
            }),
        ).toEqual([
            ['icon:book', 'Bible Lookup'],
            ['icon:robot', 'Open in Chatbot'],
        ]);
        items[0].onSelect!({} as any);
        expect(openLookup).toHaveBeenCalledTimes(1);
        // Nothing of the asking is loaded until the press.
        expect(h.openChatbotForBibleListPaste).not.toHaveBeenCalled();
        items[1].onSelect!({} as any);
        await vi.waitFor(() => {
            expect(h.openChatbotForBibleListPaste).toHaveBeenCalledTimes(1);
        });
        expect(openLookup).toHaveBeenCalledTimes(1);
    });

    it('is no menu while AI is off: the lookup is the one way', () => {
        h.isAIEnabled = false;
        expect(genAddBibleItemContextMenu(vi.fn())).toBeNull();
    });

    it('reports an opening that fails', async () => {
        const error = new Error('no window');
        h.openChatbotForBibleListPaste.mockRejectedValueOnce(error);
        openBibleListPasteInChatbot();
        await vi.waitFor(() => {
            expect(h.handleError).toHaveBeenCalledWith(error);
        });
    });
});
