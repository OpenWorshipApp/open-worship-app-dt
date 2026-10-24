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
    requestChatbotFile,
    requestChatbotLookup,
    requestChatbotReport,
    takeChatbotAsk,
    takeChatbotFile,
    takeChatbotFileRequest,
    takeChatbotLookup,
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

// The Resources panel's 🤖: a file to ask about.
describe('a file handed to the assistant', () => {
    beforeEach(() => {
        store.clear();
        vi.useRealTimers();
    });

    it('is taken once, whole, apart from a question and a report', () => {
        const longPath = `C:/Users/me/${'deep/'.repeat(150)}LUK.6.pdf`;
        requestChatbotFile(longPath);
        requestChatbotAsk('Import a Bible for me');
        // Never cut: half a path is another file, or none.
        expect(takeChatbotFile()).toBe(longPath);
        expect(takeChatbotFile()).toBeNull();
        expect(takeChatbotAsk()).toBe('Import a Bible for me');
    });

    // 2026-10-22: the Reader's passage rides with it, checked both ways.
    it('carries the passage the Reader is on, and drops one that is not', () => {
        const reading = {
            bookKey: 'MAT',
            chapter: 18,
            verseStart: 15,
            verseEnd: 17,
            title: 'ម៉ាថាយ ១៨:១៥-១៧',
            bibleKey: 'ពគប',
        };
        requestChatbotFile('/r/pdf/MAT.18.pdf', reading);
        expect(takeChatbotFileRequest()).toEqual({
            filePath: '/r/pdf/MAT.18.pdf',
            reading,
        });
        requestChatbotFile('/r/pdf/MAT.18.pdf');
        expect(takeChatbotFileRequest()).toEqual({
            filePath: '/r/pdf/MAT.18.pdf',
            reading: null,
        });
        // A hand-edited setting: the file still opens, the reading does not.
        store.set(
            'chatbot-handoff-file',
            JSON.stringify({
                filePath: '/r/pdf/MAT.18.pdf',
                reading: { bookKey: 'mat; rm -rf', chapter: 18, title: 'x' },
                at: Date.now(),
            }),
        );
        expect(takeChatbotFileRequest()).toEqual({
            filePath: '/r/pdf/MAT.18.pdf',
            reading: null,
        });
        // A backwards range keeps the chapter and loses the verses.
        requestChatbotFile('/r/pdf/MAT.18.pdf', {
            ...reading,
            verseStart: 17,
            verseEnd: 15,
        });
        expect(takeChatbotFileRequest()?.reading).toEqual({
            bookKey: 'MAT',
            chapter: 18,
            title: 'ម៉ាថាយ ១៨:១៥-១៧',
            bibleKey: 'ពគប',
        });
    });

    it('is nothing after half a minute, or past what a path can be', () => {
        vi.useFakeTimers();
        requestChatbotFile('/r/LUK.6.pdf');
        vi.advanceTimersByTime(31 * 1000);
        expect(takeChatbotFile()).toBeNull();
        requestChatbotFile(`/${'x'.repeat(5000)}.pdf`);
        expect(store.size).toBe(0);
        store.set('chatbot-handoff-file', JSON.stringify({ filePath: '' }));
        expect(takeChatbotFile()).toBeNull();
        store.set('chatbot-handoff-file', 'not json');
        expect(takeChatbotFile()).toBeNull();
    });
});

// A Lookup Detail panel's 🤖: which person, place or passage.
describe('a record handed to the assistant', () => {
    beforeEach(() => {
        store.clear();
        vi.useRealTimers();
    });

    it('is taken once, apart from the other kinds', () => {
        requestChatbotLookup({
            kind: 'location',
            target: 'eden',
            title: 'Garden of Eden',
            langCode: 'en',
            page: 'https://localhost:3000/reader.html',
        });
        requestChatbotAsk('Import a Bible for me');
        expect(takeChatbotLookup()).toEqual({
            kind: 'location',
            target: 'eden',
            title: 'Garden of Eden',
            langCode: 'en',
            page: 'https://localhost:3000/reader.html',
        });
        expect(takeChatbotLookup()).toBeNull();
        expect(takeChatbotAsk()).toBe('Import a Bible for me');
    });

    it('is nothing after half a minute, or when the setting was edited', () => {
        vi.useFakeTimers();
        requestChatbotLookup({ kind: 'verse', target: 'JHN 3:16', title: '' });
        vi.advanceTimersByTime(31 * 1000);
        expect(takeChatbotLookup()).toBeNull();
        requestChatbotLookup({ kind: 'song' as any, target: 'x', title: 'x' });
        expect(store.size).toBe(0);
        store.set(
            'chatbot-handoff-lookup',
            JSON.stringify({ kind: 'name', target: '', at: Date.now() }),
        );
        expect(takeChatbotLookup()).toBeNull();
        store.set('chatbot-handoff-lookup', 'not json');
        expect(takeChatbotLookup()).toBeNull();
    });
});
