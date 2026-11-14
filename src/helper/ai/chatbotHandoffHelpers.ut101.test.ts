import { beforeEach, describe, expect, test, vi } from 'vitest';

// A foreground session handed to the assistant: the same two questions as
// every other way in (the master switch, the caution), then the request,
// then the window -- in that order, because the window takes the request as
// it opens.
const h = vi.hoisted(() => ({
    isAIEnabled: true,
    askAiCaution: vi.fn(),
    askToEnableAI: vi.fn(),
    openChatbotPage: vi.fn(),
    requestChatbotForeground: vi.fn(),
    requestChatbotBibleListPaste: vi.fn(),
}));

vi.mock('./aiCautionHelpers', () => ({ askAiCaution: h.askAiCaution }));
vi.mock('./aiEnableHelpers', () => ({ askToEnableAI: h.askToEnableAI }));
vi.mock('./aiHelpers', () => ({ getIsAIEnabled: () => h.isAIEnabled }));
vi.mock('../domHelpers', () => ({ openChatbotPage: h.openChatbotPage }));
vi.mock('./chatbotHandoffStoreHelpers', () => ({
    requestChatbotAsk: vi.fn(),
    requestChatbotReport: vi.fn(),
    requestChatbotFile: vi.fn(),
    requestChatbotLookup: vi.fn(),
    requestChatbotForeground: h.requestChatbotForeground,
    requestChatbotBibleListPaste: h.requestChatbotBibleListPaste,
}));

import {
    openChatbotForBibleListPaste,
    openChatbotWithForeground,
} from './chatbotHandoffHelpers';

const ASK = {
    widget: 'countdown' as const,
    sessionId: 's1abc',
    sessionName: 'Offering',
};

beforeEach(() => {
    h.isAIEnabled = true;
    h.askAiCaution.mockResolvedValue(true);
    h.askToEnableAI.mockResolvedValue(undefined);
});

describe('openChatbotWithForeground', () => {
    test('with AI off, offers to turn it on and hands nothing over', async () => {
        h.isAIEnabled = false;
        expect(await openChatbotWithForeground(ASK)).toBe(false);
        expect(h.askToEnableAI).toHaveBeenCalledTimes(1);
        expect(h.askAiCaution).not.toHaveBeenCalled();
        expect(h.requestChatbotForeground).not.toHaveBeenCalled();
        expect(h.openChatbotPage).not.toHaveBeenCalled();
    });

    test('a caution answered Cancel opens nothing', async () => {
        h.askAiCaution.mockResolvedValue(false);
        expect(await openChatbotWithForeground(ASK)).toBe(false);
        expect(h.askAiCaution).toHaveBeenCalledWith('assistant');
        expect(h.requestChatbotForeground).not.toHaveBeenCalled();
        expect(h.openChatbotPage).not.toHaveBeenCalled();
    });

    test('a caution answered Open leaves the session, THEN opens the window', async () => {
        expect(await openChatbotWithForeground(ASK)).toBe(true);
        expect(h.requestChatbotForeground).toHaveBeenCalledWith(ASK);
        expect(h.openChatbotPage).toHaveBeenCalledTimes(1);
        expect(
            h.requestChatbotForeground.mock.invocationCallOrder[0],
        ).toBeLessThan(h.openChatbotPage.mock.invocationCallOrder[0]);
    });
});

// The Bibles panel's Add Bible Item → Open in Chatbot (EC-760): the same
// two questions, then the ask, then the window.
describe('openChatbotForBibleListPaste', () => {
    beforeEach(() => {
        h.requestChatbotBibleListPaste.mockClear();
        h.openChatbotPage.mockClear();
        h.askToEnableAI.mockClear();
    });

    test('with AI off, offers to turn it on and hands nothing over', async () => {
        h.isAIEnabled = false;
        expect(await openChatbotForBibleListPaste()).toBe(false);
        expect(h.askToEnableAI).toHaveBeenCalledTimes(1);
        expect(h.requestChatbotBibleListPaste).not.toHaveBeenCalled();
        expect(h.openChatbotPage).not.toHaveBeenCalled();
    });

    test('a caution answered Cancel opens nothing', async () => {
        h.askAiCaution.mockResolvedValue(false);
        expect(await openChatbotForBibleListPaste()).toBe(false);
        expect(h.requestChatbotBibleListPaste).not.toHaveBeenCalled();
        expect(h.openChatbotPage).not.toHaveBeenCalled();
    });

    test('a caution answered Open leaves the ask, THEN opens the window', async () => {
        expect(await openChatbotForBibleListPaste()).toBe(true);
        expect(h.requestChatbotBibleListPaste).toHaveBeenCalledTimes(1);
        expect(h.openChatbotPage).toHaveBeenCalledTimes(1);
        expect(
            h.requestChatbotBibleListPaste.mock.invocationCallOrder[0],
        ).toBeLessThan(h.openChatbotPage.mock.invocationCallOrder[0]);
    });
});
