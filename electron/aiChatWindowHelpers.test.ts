import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import {
    AI_CHAT_SIGNED_OUT_CHANNEL,
    checkIsAiChatPageUrl,
    claimAiChatWindowSlot,
    handAiChatTab,
    takeAiChatTab,
    tellOtherAiChatWindowsSignedOut,
} from './aiChatWindowHelpers';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow, createMockWebContents } from './testUtils';

const AI_CHAT_URL = 'https://localhost:3000/aichat.html?uuid=aichat_1';

// A web contents that can be destroyed, the way the real one ends.
function createPage(url = AI_CHAT_URL) {
    const destroyedListeners: (() => void)[] = [];
    const contents = createMockWebContents({
        getURL: vi.fn(() => url),
        once: vi.fn((event: string, listener: () => void) => {
            if (event === 'destroyed') {
                destroyedListeners.push(listener);
            }
        }),
    });
    return {
        contents,
        destroy: () => {
            for (const listener of destroyedListeners) {
                listener();
            }
        },
    };
}

describe('aiChatWindowHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
        // No hand-off left over from another test.
        takeAiChatTab(createPage().contents as any);
    });

    test('names the AI Chat page and nothing else', () => {
        expect(checkIsAiChatPageUrl(AI_CHAT_URL)).toBe(true);
        expect(checkIsAiChatPageUrl('owa://local/aichat.html')).toBe(true);
        expect(
            checkIsAiChatPageUrl('https://localhost:3000/chatbot.html'),
        ).toBe(false);
        expect(checkIsAiChatPageUrl('not a url')).toBe(false);
    });

    test('hands out the lowest free slot and keeps it for the window', () => {
        const first = createPage();
        const second = createPage();
        const third = createPage();
        expect(claimAiChatWindowSlot(first.contents as any)).toBe(0);
        expect(claimAiChatWindowSlot(second.contents as any)).toBe(1);
        // Asked again -- a reload -- the same window keeps its slot.
        expect(claimAiChatWindowSlot(first.contents as any)).toBe(0);
        // A closed window's slot is the next one handed out.
        first.destroy();
        expect(claimAiChatWindowSlot(third.contents as any)).toBe(0);
        second.destroy();
        third.destroy();
    });

    test('a page that is not the AI Chat window holds no slot', () => {
        const other = createPage('https://localhost:3000/presenter.html');
        const aiChat = createPage();
        expect(claimAiChatWindowSlot(other.contents as any)).toBe(0);
        // ... and so takes none from the AI Chat window.
        expect(claimAiChatWindowSlot(aiChat.contents as any)).toBe(0);
        aiChat.destroy();
    });

    test('a handed tab is taken once, by the window opened for it', () => {
        const from = createPage();
        const tab = { id: 'tab-1', providerKey: 'claude' };
        expect(
            handAiChatTab(from.contents as any, { uuid: 'aichat_9', tab }),
        ).toBe(true);
        // Another AI Chat window is not the one it was handed to.
        expect(takeAiChatTab(createPage().contents as any)).toBeNull();
        const to = createPage(
            'https://localhost:3000/aichat.html?uuid=aichat_9',
        );
        expect(takeAiChatTab(to.contents as any)).toEqual(tab);
        expect(takeAiChatTab(to.contents as any)).toBeNull();
    });

    test('refuses a hand-off from any other page, or of anything but a tab', () => {
        const presenter = createPage('https://localhost:3000/presenter.html');
        expect(
            handAiChatTab(presenter.contents as any, {
                uuid: 'aichat_9',
                tab: {},
            }),
        ).toBe(false);
        const from = createPage();
        expect(handAiChatTab(from.contents as any, { tab: {} })).toBe(false);
        expect(
            handAiChatTab(from.contents as any, {
                uuid: 'aichat_9',
                tab: { title: 'x'.repeat(9000) },
            }),
        ).toBe(false);
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        expect(
            handAiChatTab(from.contents as any, {
                uuid: 'aichat_9',
                tab: cyclic,
            }),
        ).toBe(false);
    });

    test('a hand-off nobody took in time is dropped', () => {
        vi.useFakeTimers();
        try {
            const from = createPage();
            handAiChatTab(from.contents as any, {
                uuid: 'aichat_9',
                tab: { id: 'late' },
            });
            vi.advanceTimersByTime(31_000);
            const to = createPage(
                'https://localhost:3000/aichat.html?uuid=aichat_9',
            );
            expect(takeAiChatTab(to.contents as any)).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test('a sign-out is told to every OTHER AI Chat window', () => {
        const senderWin = createMockBrowserWindow({
            webContents: createMockWebContents({
                getURL: vi.fn(() => AI_CHAT_URL),
            }),
        });
        const otherWin = createMockBrowserWindow({
            webContents: createMockWebContents({
                getURL: vi.fn(() => AI_CHAT_URL.replace('_1', '_2')),
            }),
        });
        const presenterWin = createMockBrowserWindow();
        electronMockState.browserWindows.push(
            senderWin,
            otherWin,
            presenterWin,
        );

        tellOtherAiChatWindowsSignedOut(senderWin.webContents as any);

        expect(otherWin.webContents.send).toHaveBeenCalledWith(
            AI_CHAT_SIGNED_OUT_CHANNEL,
        );
        expect(senderWin.webContents.send).not.toHaveBeenCalled();
        expect(presenterWin.webContents.send).not.toHaveBeenCalled();
    });
});
