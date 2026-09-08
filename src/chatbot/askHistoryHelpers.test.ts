import { beforeEach, describe, expect, test, vi } from 'vitest';

// The store the walk is written to. A plain map, so a test can hand the loader
// a hand-edited file and see what it makes of it.
const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));

import {
    genAskHistoryFromSessions,
    loadAskHistory,
    saveAskHistory,
    toAskHistoryAdded,
    toAskHistoryIndex,
    MAX_ASK_HISTORY_COUNT,
    NO_ASK_HISTORY_INDEX,
} from './askHistoryHelpers';
import type { ChatSessionType } from './chatSessionHelpers';

const SETTING_NAME = 'chatbot-ask-history';

function genSession(
    messages: { author: 'you' | 'bot'; text: string; note?: string }[],
): ChatSessionType {
    return {
        id: 's1',
        title: '',
        messages: messages.map((one, index) => {
            return { id: index + 1, ...one };
        }),
        draft: '',
        focus: 'presenter',
        isFocusChosen: false,
        provider: null,
        model: '',
        isLocked: false,
    };
}

beforeEach(() => {
    settingMap.clear();
});

describe('toAskHistoryAdded', () => {
    test('puts the newest question at the front', () => {
        const history = toAskHistoryAdded(['older'], 'newer');
        expect(history).toEqual(['newer', 'older']);
    });

    test('trims, and refuses nothing at all', () => {
        expect(toAskHistoryAdded([], '  spaced  ')).toEqual(['spaced']);
        const history = ['one'];
        expect(toAskHistoryAdded(history, '   ')).toBe(history);
    });

    test('moves a repeated question rather than storing it twice', () => {
        const history = toAskHistoryAdded(['b', 'a'], 'a');
        expect(history).toEqual(['a', 'b']);
    });

    test('caps the count, dropping the oldest', () => {
        let history: string[] = [];
        for (let index = 0; index < MAX_ASK_HISTORY_COUNT + 5; index += 1) {
            history = toAskHistoryAdded(history, `question ${index}`);
        }
        expect(history).toHaveLength(MAX_ASK_HISTORY_COUNT);
        expect(history[0]).toBe(`question ${MAX_ASK_HISTORY_COUNT + 4}`);
        expect(history).not.toContain('question 0');
    });

    test('does not remember a whole pasted document', () => {
        const history = toAskHistoryAdded([], 'x'.repeat(2001));
        expect(history).toEqual([]);
    });

    test('keeps the whole blob under its budget', () => {
        let history: string[] = [];
        for (let index = 0; index < MAX_ASK_HISTORY_COUNT; index += 1) {
            history = toAskHistoryAdded(
                history,
                `${index} ${'x'.repeat(1900)}`,
            );
        }
        expect(history.join('').length).toBeLessThanOrEqual(20000);
        expect(history.length).toBeLessThan(MAX_ASK_HISTORY_COUNT);
    });
});

describe('toAskHistoryIndex', () => {
    test('walks back and forward', () => {
        expect(toAskHistoryIndex(3, NO_ASK_HISTORY_INDEX, 1)).toBe(0);
        expect(toAskHistoryIndex(3, 0, 1)).toBe(1);
        expect(toAskHistoryIndex(3, 1, -1)).toBe(0);
        expect(toAskHistoryIndex(3, 0, -1)).toBe(NO_ASK_HISTORY_INDEX);
    });

    test('clamps at both ends rather than wrapping', () => {
        expect(toAskHistoryIndex(3, 2, 1)).toBe(2);
        expect(toAskHistoryIndex(3, NO_ASK_HISTORY_INDEX, -1)).toBe(
            NO_ASK_HISTORY_INDEX,
        );
    });

    test('has nowhere to go with nothing asked yet', () => {
        expect(toAskHistoryIndex(0, NO_ASK_HISTORY_INDEX, 1)).toBe(
            NO_ASK_HISTORY_INDEX,
        );
    });
});

describe('loadAskHistory', () => {
    test('reads back what was saved', () => {
        saveAskHistory(['second', 'first']);
        expect(loadAskHistory()).toEqual(['second', 'first']);
    });

    test('survives a hand-edited file', () => {
        settingMap.set(SETTING_NAME, '{not json');
        expect(loadAskHistory()).toEqual([]);
    });

    test('drops what a hand-edited file should not hold', () => {
        settingMap.set(
            SETTING_NAME,
            JSON.stringify(['a', 42, '', 'a', 'x'.repeat(3000), 'b']),
        );
        expect(loadAskHistory()).toEqual(['a', 'b']);
    });

    test('seeds from the saved conversations the first time only', () => {
        const sessions = [
            genSession([
                { author: 'you', text: 'first question' },
                { author: 'bot', text: 'an answer' },
                { author: 'you', text: 'second question' },
            ]),
        ];
        expect(loadAskHistory(sessions)).toEqual([
            'second question',
            'first question',
        ]);
        saveAskHistory(['only this']);
        expect(loadAskHistory(sessions)).toEqual(['only this']);
    });
});

describe('genAskHistoryFromSessions', () => {
    test('leaves out what the user did not type', () => {
        const history = genAskHistoryFromSessions([
            genSession([
                { author: 'you', text: 'mine' },
                {
                    author: 'you',
                    text: 'DO: press the thing',
                    note: 'Asked for the walkthrough card.',
                },
                { author: 'bot', text: 'not a question' },
            ]),
        ]);
        expect(history).toEqual(['mine']);
    });

    test('is newest first and holds one of each', () => {
        const history = genAskHistoryFromSessions([
            genSession([
                { author: 'you', text: 'same' },
                { author: 'you', text: 'other' },
                { author: 'you', text: 'same' },
            ]),
        ]);
        expect(history).toEqual(['same', 'other']);
    });
});
