// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    sendDataSync: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: { messageUtils: { sendDataSync: h.sendDataSync } },
}));

import {
    getAiChatWindowSlot,
    handAiChatTab,
    takeHandedAiChatTab,
    toAiChatWindowSlot,
} from './aiChatWindowSlotHelpers';

beforeEach(() => {
    h.sendDataSync.mockReset();
});

describe('toAiChatWindowSlot', () => {
    test('a whole number within the cap is a slot; anything else is 0', () => {
        expect(toAiChatWindowSlot(0)).toBe(0);
        expect(toAiChatWindowSlot(3)).toBe(3);
        expect(toAiChatWindowSlot(7)).toBe(7);
        // One past the cap would name a setting nothing ever cleans up.
        expect(toAiChatWindowSlot(8)).toBe(0);
        expect(toAiChatWindowSlot(-1)).toBe(0);
        expect(toAiChatWindowSlot(1.5)).toBe(0);
        expect(toAiChatWindowSlot('2')).toBe(0);
        expect(toAiChatWindowSlot(null)).toBe(0);
        expect(toAiChatWindowSlot(Number.NaN)).toBe(0);
    });
});

describe('getAiChatWindowSlot', () => {
    test('a main process that cannot answer is slot 0, asked once', () => {
        h.sendDataSync.mockImplementation(() => {
            throw new Error('no ipc');
        });
        expect(getAiChatWindowSlot()).toBe(0);
        expect(h.sendDataSync).toHaveBeenCalledWith(
            'main:app:ai-chat-window-slot',
        );
        h.sendDataSync.mockReturnValue(5);
        // Kept for the window's whole life: the main process is not asked
        // again, even once it could answer.
        expect(getAiChatWindowSlot()).toBe(0);
        expect(h.sendDataSync).toHaveBeenCalledTimes(1);
    });
});

describe('handing a tab to a new window', () => {
    test('taken in only when the main process says exactly true', () => {
        const tab = { id: 'tab-1', providerKey: 'claude' };
        h.sendDataSync.mockReturnValue(true);
        expect(handAiChatTab('uuid-1', tab)).toBe(true);
        expect(h.sendDataSync).toHaveBeenCalledWith(
            'main:app:ai-chat-hand-tab',
            { uuid: 'uuid-1', tab },
        );
        h.sendDataSync.mockReturnValue('yes');
        expect(handAiChatTab('uuid-2', tab)).toBe(false);
        h.sendDataSync.mockReturnValue(false);
        expect(handAiChatTab('uuid-3', tab)).toBe(false);
    });

    test('a failing hand-over is false, never a throw', () => {
        h.sendDataSync.mockImplementation(() => {
            throw new Error('window closing');
        });
        expect(handAiChatTab('uuid-1', {})).toBe(false);
    });

    test('the handed tab is read as the main process gives it, or null', () => {
        const raw = { id: 'tab-9', providerKey: 'gemini' };
        h.sendDataSync.mockReturnValue(raw);
        expect(takeHandedAiChatTab()).toBe(raw);
        expect(h.sendDataSync).toHaveBeenCalledWith(
            'main:app:ai-chat-take-tab',
        );
        h.sendDataSync.mockImplementation(() => {
            throw new Error('no ipc');
        });
        expect(takeHandedAiChatTab()).toBeNull();
    });
});
