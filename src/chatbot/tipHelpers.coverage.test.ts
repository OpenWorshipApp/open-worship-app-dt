import { beforeEach, describe, expect, test, vi } from 'vitest';

// The day the 💡 line comes back, as Settings → General's list of what was
// put away reads it.
const { settingMap } = vi.hoisted(() => ({
    settingMap: new Map<string, string>(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));

import {
    CHAT_TIP_HIDE_MS,
    hideChatTip,
    readChatTipsHiddenAt,
    showChatTips,
} from './tipHelpers';

beforeEach(() => {
    settingMap.clear();
});

describe('the day a hidden tip line comes back', () => {
    test('is the day the hide set, until it comes', () => {
        const now = 1_700_000_000_000;
        expect(readChatTipsHiddenAt(now)).toBeNull();
        hideChatTip(now);
        expect(readChatTipsHiddenAt(now + 1)).toBe(now + CHAT_TIP_HIDE_MS);
        // The day has come: nothing is hidden, so nothing to restore.
        expect(readChatTipsHiddenAt(now + CHAT_TIP_HIDE_MS)).toBeNull();
    });

    test('is not believed further off than twice the hide, nor when it is no time', () => {
        hideChatTip(5 * CHAT_TIP_HIDE_MS);
        expect(readChatTipsHiddenAt(0)).toBeNull();
        settingMap.set('chatbot-tip-hidden-until', 'tomorrow');
        expect(readChatTipsHiddenAt(0)).toBeNull();
    });

    test('is gone once Show again brings the line back', () => {
        const now = 1_700_000_000_000;
        hideChatTip(now);
        showChatTips();
        expect(readChatTipsHiddenAt(now + 1)).toBeNull();
    });
});
