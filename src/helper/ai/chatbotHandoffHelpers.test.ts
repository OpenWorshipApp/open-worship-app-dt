import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isEnabled: true,
    askAiCaution: vi.fn(),
    askToEnableAI: vi.fn(),
    openChatbotPage: vi.fn(),
    requestChatbotAsk: vi.fn(),
    requestChatbotFile: vi.fn(),
    requestChatbotLookup: vi.fn(),
    requestChatbotReport: vi.fn(),
}));

vi.mock('./aiCautionHelpers', () => ({ askAiCaution: h.askAiCaution }));
vi.mock('./aiEnableHelpers', () => ({ askToEnableAI: h.askToEnableAI }));
vi.mock('./aiHelpers', () => ({ getIsAIEnabled: () => h.isEnabled }));
vi.mock('../domHelpers', () => ({ openChatbotPage: h.openChatbotPage }));
vi.mock('./chatbotHandoffStoreHelpers', () => ({
    requestChatbotAsk: h.requestChatbotAsk,
    requestChatbotFile: h.requestChatbotFile,
    requestChatbotLookup: h.requestChatbotLookup,
    requestChatbotReport: h.requestChatbotReport,
}));

import {
    openChatbotAsking,
    openChatbotReporting,
    openChatbotWithFile,
    openChatbotWithLookup,
} from './chatbotHandoffHelpers';

const LOOKUP_ASK = {
    kind: 'verse' as const,
    target: 'GEN 2:19-21',
    title: 'Genesis 2:19-21',
};
const READING = { bookKey: 'JHN', chapter: 3, title: 'John 3' };

// Each opener, with the request it must leave behind for the chat window.
const OPENERS: [
    string,
    () => Promise<boolean>,
    ReturnType<typeof vi.fn>,
    unknown[],
][] = [
    [
        'asking',
        () => openChatbotAsking('Import a Bible in Khmer'),
        h.requestChatbotAsk,
        ['Import a Bible in Khmer'],
    ],
    [
        'reporting',
        () => openChatbotReporting('TypeError: x is undefined'),
        h.requestChatbotReport,
        ['TypeError: x is undefined'],
    ],
    [
        'a file',
        () => openChatbotWithFile('/resources/JHN.3.pdf', READING),
        h.requestChatbotFile,
        ['/resources/JHN.3.pdf', READING],
    ],
    [
        'a lookup',
        () => openChatbotWithLookup(LOOKUP_ASK),
        h.requestChatbotLookup,
        [LOOKUP_ASK],
    ],
];

beforeEach(() => {
    h.isEnabled = true;
    h.askAiCaution.mockResolvedValue(true);
});

describe('opening the assistant already asked', () => {
    test.each(OPENERS)(
        '%s: AI switched off asks to turn it on and opens nothing',
        async (_name, open, request) => {
            h.isEnabled = false;
            expect(await open()).toBe(false);
            expect(h.askToEnableAI).toHaveBeenCalledTimes(1);
            expect(h.askAiCaution).not.toHaveBeenCalled();
            expect(request).not.toHaveBeenCalled();
            expect(h.openChatbotPage).not.toHaveBeenCalled();
        },
    );

    test.each(OPENERS)(
        '%s: a refused caution leaves no request behind',
        async (_name, open, request) => {
            h.askAiCaution.mockResolvedValue(false);
            expect(await open()).toBe(false);
            expect(h.askAiCaution).toHaveBeenCalledWith('assistant');
            expect(request).not.toHaveBeenCalled();
            expect(h.openChatbotPage).not.toHaveBeenCalled();
        },
    );

    test.each(OPENERS)(
        '%s: an accepted caution leaves the request, then opens the window',
        async (_name, open, request, args) => {
            expect(await open()).toBe(true);
            expect(request).toHaveBeenCalledWith(...args);
            expect(h.openChatbotPage).toHaveBeenCalledTimes(1);
            expect(request.mock.invocationCallOrder[0]).toBeLessThan(
                h.openChatbotPage.mock.invocationCallOrder[0],
            );
        },
    );

    test('a report from the Help button asks what happened', async () => {
        await openChatbotReporting();
        expect(h.requestChatbotReport).toHaveBeenCalledWith('');
    });

    test('a file with no passage being read goes over alone', async () => {
        await openChatbotWithFile('/resources/family-tree.jpeg');
        expect(h.requestChatbotFile).toHaveBeenCalledWith(
            '/resources/family-tree.jpeg',
            null,
        );
    });
});
