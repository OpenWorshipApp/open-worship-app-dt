import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => {
    return { store: new Map<string, string>() };
});

vi.mock('../settingHelpers', () => {
    return {
        getSettingForce: (key: string) => {
            return store.get(key) ?? null;
        },
        setSetting: (key: string, value: string) => {
            store.set(key, value);
        },
        removeSetting: (key: string) => {
            store.delete(key);
        },
    };
});

import {
    requestChatbotAsk,
    requestChatbotBibleListPaste,
    requestChatbotForeground,
    takeChatbotAsk,
    takeChatbotBibleListPaste,
    takeChatbotForegroundRequest,
} from './chatbotHandoffStoreHelpers';

const KEY = 'chatbot-handoff-foreground';

// WHICH session of which foreground component a chip's menu or a panel's
// robot hands to the assistant: taken once, within half a minute, and only
// as a component and session the app has.
describe('a foreground session handed to the assistant', () => {
    beforeEach(() => {
        store.clear();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('is taken once, as the session it was', () => {
        requestChatbotForeground({
            widget: 'marquee-top',
            sessionId: 's1k9',
            sessionName: 'Welcome',
        });
        expect(takeChatbotForegroundRequest()).toEqual({
            widget: 'marquee-top',
            sessionId: 's1k9',
            sessionName: 'Welcome',
        });
        expect(takeChatbotForegroundRequest()).toBeNull();
        expect(store.size).toBe(0);
    });

    it("carries a camera's device and name, and a panel's Default session", () => {
        requestChatbotForeground({
            widget: 'camera',
            sessionId: '',
            sessionName: '',
            itemId: 'device-7',
            itemLabel: '  Front   camera ',
        });
        expect(takeChatbotForegroundRequest()).toEqual({
            widget: 'camera',
            sessionId: '',
            sessionName: '',
            itemId: 'device-7',
            itemLabel: 'Front camera',
        });
    });

    it('keeps a foreground session apart from a question', () => {
        requestChatbotAsk('Import a Bible for me');
        requestChatbotForeground({
            widget: 'countdown',
            sessionId: '',
            sessionName: 'Default',
        });
        expect(takeChatbotForegroundRequest()?.widget).toBe('countdown');
        expect(takeChatbotAsk()).toBe('Import a Bible for me');
    });

    it('leaves nothing for a component or session the app has not got', () => {
        requestChatbotForeground({
            widget: 'fireworks' as any,
            sessionId: '',
            sessionName: '',
        });
        requestChatbotForeground({
            widget: 'quick-text',
            sessionId: '../other',
            sessionName: '',
        });
        expect(store.has(KEY)).toBe(false);
        expect(takeChatbotForegroundRequest()).toBeNull();
    });

    it('is nothing after half a minute', () => {
        vi.useFakeTimers();
        requestChatbotForeground({
            widget: 'stopwatch',
            sessionId: '',
            sessionName: 'Default',
        });
        vi.advanceTimersByTime(29 * 1000);
        expect(store.has(KEY)).toBe(true);
        vi.advanceTimersByTime(2 * 1000);
        expect(takeChatbotForegroundRequest()).toBeNull();
        // Read once, it is gone whether or not it was still good.
        expect(store.has(KEY)).toBe(false);
    });

    it('is nothing when the setting was written by hand', () => {
        for (const raw of [
            'not json',
            JSON.stringify({ widget: 'countdown', sessionId: '' }),
            JSON.stringify({ widget: 'countdown', at: 'now' }),
            JSON.stringify({
                widget: 'nothing',
                sessionId: '',
                at: Date.now(),
            }),
            'null',
        ]) {
            store.set(KEY, raw);
            expect(takeChatbotForegroundRequest()).toBeNull();
            expect(store.has(KEY)).toBe(false);
        }
    });

    it('takes a hand-written one that is whole and fresh, field by field', () => {
        store.set(
            KEY,
            JSON.stringify({
                widget: 'time',
                sessionId: 's2',
                sessionName: 'Clock',
                at: Date.now(),
                extra: 'dropped',
            }),
        );
        expect(takeChatbotForegroundRequest()).toEqual({
            widget: 'time',
            sessionId: 's2',
            sessionName: 'Clock',
        });
    });
});

// The Bibles panel's Add Bible Item → Open in Chatbot (EC-760): no words,
// only that it was asked -- once, within half a minute, apart from the
// other kinds.
describe('a Bibles list paste asked of the assistant', () => {
    const PASTE_KEY = 'chatbot-handoff-bible-list';

    beforeEach(() => {
        store.clear();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('is taken once, and is no other kind of request', () => {
        requestChatbotBibleListPaste();
        expect(store.has(PASTE_KEY)).toBe(true);
        expect(takeChatbotAsk()).toBeNull();
        expect(takeChatbotBibleListPaste()).toBe(true);
        expect(takeChatbotBibleListPaste()).toBe(false);
        expect(store.size).toBe(0);
    });

    it('is not taken when stale, and is cleared all the same', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-14T09:00:00Z'));
        requestChatbotBibleListPaste();
        vi.setSystemTime(new Date('2026-11-14T09:00:31Z'));
        expect(takeChatbotBibleListPaste()).toBe(false);
        expect(store.size).toBe(0);
    });

    it('a hand-edited setting asks nothing', () => {
        store.set(PASTE_KEY, 'not json');
        expect(takeChatbotBibleListPaste()).toBe(false);
        store.set(PASTE_KEY, JSON.stringify({ at: 'now' }));
        expect(takeChatbotBibleListPaste()).toBe(false);
        expect(store.size).toBe(0);
    });
});
