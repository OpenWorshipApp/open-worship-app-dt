import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    requestChatbotReport,
    takeChatbotAsk,
    takeChatbotReport,
    toProblemText,
} from './chatbotHandoffStoreHelpers';

describe('a job handed to the assistant by another window', () => {
    beforeEach(() => {
        store.clear();
        vi.useRealTimers();
    });

    it('is taken once', () => {
        requestChatbotAsk('Import a Bible for me');
        expect(takeChatbotAsk()).toBe('Import a Bible for me');
        expect(takeChatbotAsk()).toBeNull();
        expect(store.size).toBe(0);
    });

    // Help's third row leaves no words: the person is to be asked.
    it('carries a problem to report, or none when the person is to be asked', () => {
        requestChatbotReport('The app showed an error: boom');
        expect(takeChatbotReport()).toBe('The app showed an error: boom');
        expect(takeChatbotReport()).toBeNull();
        requestChatbotReport('');
        expect(takeChatbotReport()).toBe('');
        expect(takeChatbotReport()).toBeNull();
    });

    it('keeps a question and a report apart', () => {
        requestChatbotAsk('Import a Bible for me');
        requestChatbotReport('boom');
        expect(takeChatbotReport()).toBe('boom');
        expect(takeChatbotAsk()).toBe('Import a Bible for me');
        // An empty question is no question; an empty report is a request.
        requestChatbotAsk('   ');
        expect(takeChatbotAsk()).toBeNull();
    });

    // A window that then failed to open must not start a report the next
    // time somebody opens the assistant for something else.
    it('is nothing after half a minute, or when the file was written by hand', () => {
        vi.useFakeTimers();
        requestChatbotReport('boom');
        vi.advanceTimersByTime(31 * 1000);
        expect(takeChatbotReport()).toBeNull();
        expect(store.size).toBe(0);
        store.set('chatbot-handoff-report', 'not json');
        expect(takeChatbotReport()).toBeNull();
        store.set('chatbot-handoff-report', JSON.stringify({ text: 5 }));
        expect(takeChatbotReport()).toBeNull();
    });

    it('cuts what is handed over to a few lines', () => {
        requestChatbotReport('x'.repeat(5000));
        expect(takeChatbotReport()).toHaveLength(600);
    });
});

describe('toProblemText', () => {
    it('says the kind, the message and the window in one line', () => {
        expect(
            toProblemText(
                new ReferenceError('a is not defined'),
                'Presenter (🖥️)',
            ),
        ).toBe(
            'The app showed an error in the Presenter (🖥️) window: ' +
                'ReferenceError: a is not defined',
        );
        expect(toProblemText('ResizeObserver loop\n limit', '')).toBe(
            'The app showed an error: ResizeObserver loop limit',
        );
    });

    it('says what it can of a rejection with nothing in it', () => {
        expect(toProblemText(undefined, 'Reader')).toBe(
            'The app showed an error in the Reader window',
        );
        expect(toProblemText({ name: 'Canceled' }, '')).toBe(
            'The app showed an error: Canceled',
        );
    });

    // An error's own message names the file it could not open.
    it('takes the account name out of a path in the message', () => {
        expect(
            toProblemText(
                new Error(
                    "ENOENT: no such file or directory, open 'C:\\Users\\somebody\\AppData\\x.json'",
                ),
                'Presenter',
            ),
        ).toBe(
            'The app showed an error in the Presenter window: Error: ' +
                "ENOENT: no such file or directory, open 'C:\\Users\\~\\AppData\\x.json'",
        );
    });

    // Paths name the computer's account; the report reads the console.
    it('never carries the stack', () => {
        const error = new Error('boom');
        error.stack = 'Error: boom\n    at C:\\Users\\somebody\\app.js:1:1';
        expect(toProblemText(error, 'Presenter')).not.toContain('somebody');
        expect(toProblemText(new Error('x'.repeat(5000)), '').length).toBe(600);
    });
});
