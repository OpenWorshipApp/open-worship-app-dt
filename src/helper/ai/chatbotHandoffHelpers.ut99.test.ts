import { beforeEach, describe, expect, test, vi } from 'vitest';

// The two questions (the master switch, the caution), the store the chat
// window takes the request from, and the window opener -- all faked, so
// what is under test is the order they are asked in.
const h = vi.hoisted(() => ({
    isAIEnabled: true,
    askAiCaution: vi.fn(),
    askToEnableAI: vi.fn(),
    openChatbotPage: vi.fn(),
    requestChatbotAsk: vi.fn(),
    requestChatbotReport: vi.fn(),
    requestChatbotFile: vi.fn(),
    requestChatbotLookup: vi.fn(),
}));

vi.mock('./aiCautionHelpers', () => ({ askAiCaution: h.askAiCaution }));
vi.mock('./aiEnableHelpers', () => ({ askToEnableAI: h.askToEnableAI }));
vi.mock('./aiHelpers', () => ({ getIsAIEnabled: () => h.isAIEnabled }));
vi.mock('../domHelpers', () => ({ openChatbotPage: h.openChatbotPage }));
vi.mock('./chatbotHandoffStoreHelpers', () => ({
    requestChatbotAsk: h.requestChatbotAsk,
    requestChatbotReport: h.requestChatbotReport,
    requestChatbotFile: h.requestChatbotFile,
    requestChatbotLookup: h.requestChatbotLookup,
}));

import {
    openChatbotAsking,
    openChatbotReporting,
    openChatbotWithFile,
    openChatbotWithLookup,
} from './chatbotHandoffHelpers';

const LOOKUP = {
    kind: 'verse' as const,
    target: 'JHN 3:16',
    title: 'John 3:16',
    bibleKey: 'KJV',
};
const READING = { bookKey: 'MAT', chapter: 18, title: 'Matthew 18' };

const CASES = [
    {
        name: 'openChatbotAsking',
        open: () => openChatbotAsking('Import a Khmer Bible'),
        request: () => h.requestChatbotAsk,
        args: ['Import a Khmer Bible'],
    },
    {
        name: 'openChatbotReporting',
        open: () => openChatbotReporting('The screen went black'),
        request: () => h.requestChatbotReport,
        args: ['The screen went black'],
    },
    {
        name: 'openChatbotWithFile',
        open: () => openChatbotWithFile('/data/MAT.18.pdf', READING),
        request: () => h.requestChatbotFile,
        args: ['/data/MAT.18.pdf', READING, null],
    },
    {
        name: 'openChatbotWithLookup',
        open: () => openChatbotWithLookup(LOOKUP),
        request: () => h.requestChatbotLookup,
        args: [LOOKUP],
    },
];

beforeEach(() => {
    h.isAIEnabled = true;
    h.askAiCaution.mockResolvedValue(true);
    h.askToEnableAI.mockResolvedValue(undefined);
});

describe.each(CASES)('$name', ({ open, request, args }) => {
    test('with AI off, offers to turn it on and leaves the request unmade', async () => {
        h.isAIEnabled = false;
        expect(await open()).toBe(false);
        expect(h.askToEnableAI).toHaveBeenCalledTimes(1);
        expect(h.askAiCaution).not.toHaveBeenCalled();
        expect(request()).not.toHaveBeenCalled();
        expect(h.openChatbotPage).not.toHaveBeenCalled();
    });

    test('a caution answered Cancel opens nothing', async () => {
        h.askAiCaution.mockResolvedValue(false);
        expect(await open()).toBe(false);
        expect(h.askAiCaution).toHaveBeenCalledWith('assistant');
        expect(h.askToEnableAI).not.toHaveBeenCalled();
        expect(request()).not.toHaveBeenCalled();
        expect(h.openChatbotPage).not.toHaveBeenCalled();
    });

    test('a caution answered Open leaves the request, THEN opens the window', async () => {
        expect(await open()).toBe(true);
        expect(request()).toHaveBeenCalledWith(...args);
        expect(h.openChatbotPage).toHaveBeenCalledTimes(1);
        // The window takes the request as it opens: it must be there first.
        expect(request().mock.invocationCallOrder[0]).toBeLessThan(
            h.openChatbotPage.mock.invocationCallOrder[0],
        );
    });
});

describe('the defaults', () => {
    test('a report with no problem asks the person what happened', async () => {
        expect(await openChatbotReporting()).toBe(true);
        expect(h.requestChatbotReport).toHaveBeenCalledWith('');
    });

    test('a file with no passage carries none', async () => {
        expect(await openChatbotWithFile('/data/notes.md')).toBe(true);
        expect(h.requestChatbotFile).toHaveBeenCalledWith(
            '/data/notes.md',
            null,
            null,
        );
    });
});
