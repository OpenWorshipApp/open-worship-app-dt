// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../../test-setup/langPackageDirs';

// **Open in Chatbot** on a foreground session: the menu item a chip carries
// while AI is on, and the press that hands the session to the help window
// (loaded at the press) -- a failure there reported, never thrown at a menu.
const h = vi.hoisted(() => ({
    isAIEnabled: true,
    dictionaries: [] as Record<string, string>[],
    openChatbotWithForeground: vi.fn(),
    handleError: vi.fn(),
}));

// English labels, while every installed package's dictionary is held to
// having the key: a label missing in any of them throws as in a dev window.
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of h.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
}));
vi.mock('./aiHelpers', () => ({ getIsAIEnabled: () => h.isAIEnabled }));
vi.mock('../errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./chatbotHandoffHelpers', () => ({
    openChatbotWithForeground: h.openChatbotWithForeground,
}));

import {
    genForegroundOpenInChatbotContextMenu,
    openForegroundInChatbot,
} from './foregroundChatbotMenuHelpers';

const ASK = {
    widget: 'quick-text' as const,
    sessionId: 's1q',
    sessionName: 'John 3:16',
};

beforeEach(() => {
    h.isAIEnabled = true;
    h.dictionaries = readLangPackageDictionaries();
    h.openChatbotWithForeground.mockResolvedValue(true);
});

describe('openForegroundInChatbot', () => {
    test('hands the session to the help window and says whether it opened', async () => {
        expect(await openForegroundInChatbot(ASK)).toBe(true);
        expect(h.openChatbotWithForeground).toHaveBeenCalledWith(ASK);
        h.openChatbotWithForeground.mockResolvedValue(false);
        expect(await openForegroundInChatbot(ASK)).toBe(false);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('reports a failure to open it and answers false, never throws', async () => {
        const error = new Error('the window would not open');
        h.openChatbotWithForeground.mockRejectedValue(error);
        expect(await openForegroundInChatbot(ASK)).toBe(false);
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});

describe('genForegroundOpenInChatbotContextMenu', () => {
    test('offers nothing while AI is off', () => {
        h.isAIEnabled = false;
        expect(genForegroundOpenInChatbotContextMenu(ASK)).toEqual([]);
        expect(h.openChatbotWithForeground).not.toHaveBeenCalled();
    });

    test('offers one robot item that opens the help window on the session', async () => {
        const items = genForegroundOpenInChatbotContextMenu(ASK);
        expect(items).toHaveLength(1);
        const [item] = items;
        expect(item.menuElement).toBe('Open in Chatbot');
        expect(renderToStaticMarkup(<>{item.childBefore}</>)).toContain(
            'bi bi-robot',
        );
        expect(h.openChatbotWithForeground).not.toHaveBeenCalled();
        item.onSelect?.(new MouseEvent('click'));
        await vi.waitFor(() => {
            expect(h.openChatbotWithForeground).toHaveBeenCalledWith(ASK);
        });
    });
});
