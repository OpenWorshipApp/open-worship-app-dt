import { describe, expect, test, vi } from 'vitest';

// The foreground lines the assistant writes from words, past
// `agentFlowForegroundRules.test.ts`: every field each widget refuses, what a
// new line is given when a field is left out, and what a CHANGED line keeps.

vi.mock('../presenter-foreground/foregroundDragHelpers', () => ({
    COUNTDOWN_LEAD_SECOND: 1,
}));

import {
    genAgentForegroundData,
    pickForegroundLook,
} from './agentFlowForegroundRules';

const genId = () => 'clock-id';

function genNew(widget: string, fields: Record<string, unknown>) {
    return genAgentForegroundData(widget, fields, {}, genId);
}

function genChanged(
    widget: string,
    fields: Record<string, unknown>,
    existing: Record<string, unknown>,
) {
    return genAgentForegroundData(widget, fields, { existing }, genId);
}

describe('countdown', () => {
    test('a date that is not one is refused, and so is a non-string', () => {
        for (const dateTime of ['next sunday', 1763200800000]) {
            expect(genNew('countdown', { dateTime })).toEqual({
                reason: expect.stringContaining('`dateTime` is a date'),
            });
        }
    });

    test('longer than a day is a date, not a length', () => {
        expect(genNew('countdown', { seconds: 24 * 3600 })).toEqual({
            data: { durationSecond: 24 * 3600 + 1, isAutoStart: true },
        });
        expect(genNew('countdown', { seconds: 24 * 3600 + 1 })).toEqual({
            reason: expect.stringContaining('up to a day'),
        });
    });

    test('a changed countdown keeps its start and its length unless told', () => {
        const existing = {
            dateTime: '2026-11-15T10:00:00.000Z',
            isAutoStart: false,
        };
        expect(genChanged('countdown', {}, existing)).toEqual({
            data: existing,
        });
        // A length given takes the date away.
        expect(genChanged('countdown', { seconds: 90.4 }, existing)).toEqual({
            data: { durationSecond: 91, isAutoStart: false },
        });
        // `autoStart` given is the one thing changed.
        expect(genChanged('countdown', { autoStart: true }, existing)).toEqual({
            data: { ...existing, isAutoStart: true },
        });
    });
});

describe('stopwatch', () => {
    test('autoStart false is kept; a changed one keeps its own', () => {
        expect(genNew('stopwatch', { autoStart: false })).toEqual({
            data: { isAutoStart: false },
        });
        expect(
            genChanged('stopwatch', {}, { isAutoStart: false, id: 'x' }),
        ).toEqual({ data: { isAutoStart: false, id: 'x' } });
    });
});

describe('time (a clock)', () => {
    test("a new clock with no offset starts on this device's", () => {
        // Phnom Penh: the browser says -420 minutes, the panel says +7 hours.
        vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-420);
        expect(genNew('time', {})).toEqual({
            data: {
                id: 'clock-id',
                timezoneMinuteOffset: 7,
                title: null,
                is24HourFormat: false,
            },
        });
    });

    test('a title that is no words is none; a long one is cut at 80', () => {
        const longTitle = `  ${'x'.repeat(120)}  `;
        const result = genNew('time', {
            utcOffset: -5,
            title: longTitle,
            is24Hour: true,
        }) as { data: Record<string, unknown> };
        expect(result.data.title).toBe('x'.repeat(80));
        expect(result.data.is24HourFormat).toBe(true);
        expect(result.data.timezoneMinuteOffset).toBe(-5);
        expect(
            genNew('time', { utcOffset: 0, title: '   ' }) as any,
        ).toMatchObject({ data: { title: null, timezoneMinuteOffset: 0 } });
    });

    test('an offset outside -12..14, or not a number, is refused', () => {
        for (const utcOffset of [-13, 15, '7', Number.NaN]) {
            expect(genNew('time', { utcOffset })).toEqual({
                reason: expect.stringContaining('`utcOffset` is hours'),
            });
        }
        expect(genNew('time', { utcOffset: 14 })).toHaveProperty('data');
        expect(genNew('time', { utcOffset: -12 })).toHaveProperty('data');
    });

    test('a changed clock keeps its id, offset and title', () => {
        const existing = {
            id: 'old-clock',
            timezoneMinuteOffset: 9,
            title: 'Tokyo',
            is24HourFormat: true,
        };
        expect(genChanged('time', { is24Hour: false }, existing)).toEqual({
            data: { ...existing, is24HourFormat: false },
        });
        expect(genChanged('time', {}, existing)).toEqual({ data: existing });
    });
});

describe('message', () => {
    test('one message and several at once is refused', () => {
        expect(genNew('message', { text: 'A', texts: ['B'] })).toEqual({
            reason: expect.stringContaining('Give one message as `text`'),
        });
    });

    test('a text with no words, or none at all, is refused', () => {
        expect(genNew('message', { text: '   ' })).toEqual({
            reason: '`text` is the message, words and all.',
        });
        expect(genNew('message', { text: 5 })).toHaveProperty('reason');
        expect(genNew('message', {})).toEqual({
            reason: 'Say what the message says (`text`).',
        });
    });

    test('texts: 1 to 20 with words, the blank ones left out', () => {
        expect(genNew('message', { texts: [] })).toEqual({
            reason: expect.stringContaining('1 to 20 messages'),
        });
        expect(genNew('message', { texts: 'not a list' })).toHaveProperty(
            'reason',
        );
        expect(
            genNew('message', {
                texts: Array.from({ length: 21 }, (_v, i) => `m${i}`),
            }),
        ).toHaveProperty('reason');
        // A single one does not rotate; blanks and non-words are dropped.
        expect(genNew('message', { texts: ['  Only  ', ' ', 3] })).toEqual({
            data: { textList: ['Only'], intervalSecond: null },
        });
        // Several with no interval of their own hold ten seconds each.
        expect(genNew('message', { texts: ['A', 'B'] })).toEqual({
            data: { textList: ['A', 'B'], intervalSecond: 10 },
        });
        expect(
            genNew('message', { texts: ['A', 'B'], intervalSecond: -1 }),
        ).toEqual({ data: { textList: ['A', 'B'], intervalSecond: 10 } });
    });

    test('a changed message: an interval that is not a time is refused', () => {
        const existing = { textList: ['A', 'B'], intervalSecond: 5 };
        expect(genChanged('message', { intervalSecond: 0 }, existing)).toEqual({
            reason: '`intervalSecond` is how long each message holds.',
        });
        expect(genChanged('message', {}, existing)).toEqual({
            data: existing,
        });
    });

    test('a message past 2000 characters is cut there', () => {
        const result = genNew('message', { text: 'a'.repeat(2500) }) as {
            data: { textList: string[] };
        };
        expect(result.data.textList).toEqual(['a'.repeat(2000)]);
    });
});

describe('marquee', () => {
    test('scrolling words are needed, and must be words', () => {
        expect(genNew('marquee-top', {})).toEqual({
            reason: 'Say what scrolls across (`text`).',
        });
        expect(genNew('marquee-top', { text: '  ' })).toEqual({
            reason: '`text` is the words that scroll across.',
        });
    });

    test('a speed in range is rounded; out of range or no number is refused', () => {
        expect(genNew('marquee-top', { text: 'Hi', speed: 250.6 })).toEqual({
            data: { text: 'Hi', speedPercentage: 251 },
        });
        for (const speed of [9, 1001, '200']) {
            expect(genNew('marquee-top', { text: 'Hi', speed })).toEqual({
                reason: expect.stringContaining('`speed` is 10 to 1000'),
            });
        }
    });

    test('a changed marquee keeps its words and pace unless told', () => {
        const existing = { text: 'Old', speedPercentage: 150 };
        expect(genChanged('marquee-bottom', {}, existing)).toEqual({
            data: existing,
        });
        expect(genChanged('marquee-bottom', { speed: 10 }, existing)).toEqual({
            data: { text: 'Old', speedPercentage: 10 },
        });
    });
});

describe('quick text', () => {
    test('words are needed, and must be words', () => {
        expect(genNew('quick-text', {})).toEqual({
            reason: 'Say what the quick text says (`text`).',
        });
        expect(genNew('quick-text', { text: '' })).toEqual({
            reason: '`text` is the words, in markdown.',
        });
    });

    test('a delay of 0 or more and a positive life are kept as given', () => {
        expect(
            genNew('quick-text', {
                text: '# Pray',
                delaySecond: 2.5,
                liveSecond: 12,
            }),
        ).toEqual({
            data: {
                markdownText: '# Pray',
                timeSecondDelay: 2.5,
                timeSecondToLive: 12,
            },
        });
        expect(
            genNew('quick-text', { text: 'x', delaySecond: 0 }),
        ).toMatchObject({ data: { timeSecondDelay: 0 } });
    });

    test('a negative or non-number delay, or a life of 0, is refused', () => {
        for (const delaySecond of [-1, '3', Number.POSITIVE_INFINITY]) {
            expect(genNew('quick-text', { text: 'x', delaySecond })).toEqual({
                reason: '`delaySecond` is seconds before it shows, 0 or more.',
            });
        }
        for (const liveSecond of [0, -2, '5']) {
            expect(genNew('quick-text', { text: 'x', liveSecond })).toEqual({
                reason: '`liveSecond` is how many seconds it stays up.',
            });
        }
    });

    test('a changed quick text keeps its timing when only words change', () => {
        expect(
            genChanged(
                'quick-text',
                { text: 'New words' },
                {
                    markdownText: 'Old',
                    timeSecondDelay: 4,
                    timeSecondToLive: 9,
                },
            ),
        ).toEqual({
            data: {
                markdownText: 'New words',
                timeSecondDelay: 4,
                timeSecondToLive: 9,
            },
        });
    });
});

describe('the look a new line borrows', () => {
    test('nothing from what is not an object; no null style, no false layer', () => {
        expect(pickForegroundLook(null)).toEqual({});
        expect(pickForegroundLook('fade')).toEqual({});
        expect(
            pickForegroundLook({
                extraStyle: null,
                isBehind: false,
                transitionEffect: undefined,
            }),
        ).toEqual({});
    });

    test('a widget that is not a string is refused by name', () => {
        expect(genNew(undefined as any, {})).toEqual({
            reason: expect.stringContaining('`widget` is one of countdown'),
        });
    });
});
