import { beforeEach, describe, expect, test, vi } from 'vitest';

const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));

import {
    genChatTip,
    pickChatTip,
    stepChatTip,
    takeChatTip,
    CHAT_TIP_LIST,
} from './tipHelpers';

beforeEach(() => {
    settingMap.clear();
});

describe('the tips themselves', () => {
    test('are unique, and short enough for the line they sit on', () => {
        const ids = new Set(
            CHAT_TIP_LIST.map((tip) => {
                return tip.id;
            }),
        );
        expect(ids.size).toBe(CHAT_TIP_LIST.length);
        for (const tip of CHAT_TIP_LIST) {
            // Two lines in a 460px window is the whole budget.
            expect(tip.text.length).toBeLessThanOrEqual(110);
            expect(tip.text.length).toBeGreaterThan(20);
        }
    });
});

describe('genChatTip', () => {
    test('never gives back the one just shown', () => {
        for (const tip of CHAT_TIP_LIST) {
            // Every corner of the random range, so no draw can land on it.
            for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
                expect(genChatTip(tip.id, () => value).id).not.toBe(tip.id);
            }
        }
    });

    test('stays inside the list at the top of the range', () => {
        expect(genChatTip(null, () => 0.999999)).toBeDefined();
        expect(genChatTip(null, () => 0)).toBe(CHAT_TIP_LIST[0]);
    });
});

describe('takeChatTip', () => {
    test('remembers what it showed, so the next window opens on another', () => {
        const first = takeChatTip();
        expect(settingMap.get('chatbot-tip-shown')).toBe(first.id);
        expect(takeChatTip().id).not.toBe(first.id);
    });
});

describe('pickChatTip', () => {
    test('remembers too — pressing the line is a way of changing it', () => {
        const tip = pickChatTip(null);
        expect(settingMap.get('chatbot-tip-shown')).toBe(tip.id);
    });
});

describe('stepChatTip', () => {
    test('walks the whole list and comes back to where it started', () => {
        // The reason the arrows are a walk and not two more random picks:
        // pressing → enough times must show everything this window can do.
        const start = CHAT_TIP_LIST[0];
        const seen = new Set<string>();
        let current = start;
        for (let index = 0; index < CHAT_TIP_LIST.length; index++) {
            current = stepChatTip(current.id, 1);
            seen.add(current.id);
        }
        expect(seen.size).toBe(CHAT_TIP_LIST.length);
        expect(current.id).toBe(start.id);
    });

    test('goes back, and wraps backwards off the first one', () => {
        const first = CHAT_TIP_LIST[0];
        const last = CHAT_TIP_LIST[CHAT_TIP_LIST.length - 1];
        // `%` keeps the sign in JavaScript, so this is the case that would
        // otherwise index at -1 and hand back nothing at all.
        expect(stepChatTip(first.id, -1).id).toBe(last.id);
        expect(stepChatTip(last.id, 1).id).toBe(first.id);
    });

    test('a tip that no longer exists starts the walk rather than failing', () => {
        expect(stepChatTip('a-tip-removed-since', 1)).toBeDefined();
        expect(stepChatTip(null, 1)).toBeDefined();
    });

    test('remembers each step, like every other way of changing the tip', () => {
        const stepped = stepChatTip(CHAT_TIP_LIST[0].id, 1);
        expect(settingMap.get('chatbot-tip-shown')).toBe(stepped.id);
    });
});
