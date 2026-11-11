import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    openPopupWindow: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: { chatbotHomePage: 'https://app.local/chatbot.html' },
}));
vi.mock('./popupWindowHelpers', () => ({
    openPopupWindow: h.openPopupWindow,
}));

import { openChatbotPage } from './chatbotPageHelpers';

beforeEach(() => {
    h.openPopupWindow.mockReset();
});

// A leaf since 2026-11-11, for the Markdown Preview's 🤖: the help window
// opens the way every other press opens it.
describe('opening the help window', () => {
    it('opens it beside the app, glassy, under one url id', () => {
        const opened = {};
        h.openPopupWindow.mockReturnValue(opened);
        expect(openChatbotPage()).toBe(opened);
        expect(h.openPopupWindow).toHaveBeenCalledWith(
            'https://app.local/chatbot.html',
            expect.stringMatching(/^chatbot_\d+$/),
            // The url id main finds an open help window by.
            'chatbot',
            {
                width: 460,
                height: 640,
                appGlassy: true,
                appAlignHorizontal: 'right',
                appAlignVertical: 'center',
                appFollowScale: true,
                appTopToMain: true,
            },
        );
    });
});
