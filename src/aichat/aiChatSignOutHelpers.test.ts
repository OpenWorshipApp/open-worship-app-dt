import { describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    electronSendAsync: vi.fn(),
}));

// The real `appHelpers` reaches `appProvider`, which touches `document`.
vi.mock('../server/appHelpers', () => ({
    electronSendAsync: h.electronSendAsync,
}));

import { clearAiChatSiteData } from './aiChatSignOutHelpers';

describe('clearAiChatSiteData', () => {
    test('asks the main process to throw the guest partition away', async () => {
        h.electronSendAsync.mockResolvedValue(true);
        await expect(clearAiChatSiteData()).resolves.toBe(true);
        expect(h.electronSendAsync).toHaveBeenCalledTimes(1);
        expect(h.electronSendAsync).toHaveBeenCalledWith(
            'main:app:clear-ai-chat-data',
        );
    });

    test('a refusal reaches the window, which keeps the tabs', async () => {
        h.electronSendAsync.mockRejectedValue(new Error('clear failed'));
        await expect(clearAiChatSiteData()).rejects.toThrow('clear failed');
    });
});
