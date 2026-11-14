// @vitest-environment jsdom

/**
 * What a foreground session HOLDS, as the assistant writes it: the panel's
 * own keys, its own defaults, and a verse read from the installed Bible.
 * Messages are stored through the REAL `toStoredText` of the Messages panel
 * (its React and screen dependencies stubbed below, never called).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        resolveVersionOrder: vi.fn(),
        resolveBibleItem: vi.fn(),
        genBibleItemQuickTextMarkdown: vi.fn(),
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: true,
        isPageScreen: false,
        systemUtils: { isDev: false },
        messageUtils: { listenForData: () => {}, sendData: () => {} },
    },
}));
vi.mock('./settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('./agentBibleHelpers', () => ({
    resolveVersionOrder: h.resolveVersionOrder,
    resolveBibleItem: h.resolveBibleItem,
}));
vi.mock('../presenter-foreground/foregroundQuickTextOpenHelpers', () => ({
    genBibleItemQuickTextMarkdown: h.genBibleItemQuickTextMarkdown,
}));
// The Messages panel's module, loaded for its pure `toStoredText`: what it
// renders with is never reached here. A label read would be a bug.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        throw new Error(`no label is read here: ${key}`);
    },
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: {},
    MESSAGE_ALL_ID: 'message-all',
}));
vi.mock('../presenter-foreground/foregroundHelpers', () => ({}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({}));
vi.mock('../presenter-foreground/ScreensRendererComp', () => ({
    default: () => null,
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({}));
vi.mock('../presenter-foreground/propertiesSettingHelpers', () => ({}));
vi.mock('../presenter-foreground/ForegroundPropRowComp', () => ({
    default: () => null,
}));
vi.mock('../presenter-foreground/ForegroundLayoutComp', () => ({
    default: () => null,
}));
vi.mock('../presenter-foreground/SavedTextSessionButtonsComp', () => ({
    default: () => null,
}));
vi.mock('./dragHelpers', () => ({}));
vi.mock('../presenter-foreground/foregroundDragHelpers', () => ({}));
vi.mock('./timeoutHelpers', () => ({}));
vi.mock('./appHooks', () => ({}));
vi.mock('../event/KeyboardEventListener', () => ({}));
vi.mock('../presenter-foreground/foregroundSessionHelpers', () => ({}));
vi.mock('../toast/toastHelpers', () => ({}));

import {
    checkIsSameContent,
    escapeQuickTextMarkdown,
    parseClockTimeToday,
    parseCountdownAt,
    planForegroundContent,
    readForegroundContent,
    readForegroundVerse,
    toDurationName,
    toPanelDefault,
    type AgentForegroundContentPlanType,
    type AgentForegroundVerseType,
} from './agentForegroundContentHelpers';

// 09:00 local on an ordinary day: every time below is read against it.
const NOW = new Date(2026, 10, 11, 9, 0, 0, 0);

const VERSE: AgentForegroundVerseType = {
    title: '(KJV) John 3:16',
    text: 'For God so loved the world.',
    markdown: '**(KJV) John 3:16**\n\nFor God so loved the world.',
    fontFamily: 'app-Sample Serif',
};

function toWriteMap(plan: unknown) {
    const { writes } = plan as AgentForegroundContentPlanType;
    return Object.fromEntries(
        writes.map((write) => {
            return [write.key, write.value];
        }),
    );
}

beforeEach(() => {
    h.settings.clear();
});

describe('toDurationName', () => {
    it('names a countdown session by its length, hours only when it has them', () => {
        expect(toDurationName(300)).toBe('5:00');
        expect(toDurationName(65)).toBe('1:05');
        expect(toDurationName(5400)).toBe('1:30:00');
        expect(toDurationName(3605)).toBe('1:00:05');
    });
});

describe('parseClockTimeToday', () => {
    it('reads the ways a person says a time of day', () => {
        const hoursOf = (text: string) => {
            const parsed = parseClockTimeToday(text, NOW);
            expect(parsed).toBeInstanceOf(Date);
            const date = parsed as Date;
            return [date.getHours(), date.getMinutes(), date.getDate()];
        };
        expect(hoursOf('10.30')).toEqual([10, 30, 11]);
        expect(hoursOf('6:45 p.m.')).toEqual([18, 45, 11]);
        expect(hoursOf('7pm')).toEqual([19, 0, 11]);
        expect(hoursOf('12 pm')).toEqual([12, 0, 11]);
        expect(hoursOf(' 23:59 ')).toEqual([23, 59, 11]);
    });

    it('is no time at all for words or a bare number', () => {
        expect(parseClockTimeToday('soon', NOW)).toBeNull();
        expect(parseClockTimeToday('10', NOW)).toBeNull();
        expect(parseClockTimeToday('', NOW)).toBeNull();
    });

    it('refuses a time that cannot be on a clock, in a sentence', () => {
        for (const text of ['25:00', '10:75', '13 pm', '0:30 am']) {
            const parsed = parseClockTimeToday(text, NOW);
            expect(parsed).toMatchObject({
                reason: expect.stringContaining('is not a time of day'),
            });
        }
    });

    it('refuses a time already gone today, midnight included', () => {
        expect(parseClockTimeToday('8:15', NOW)).toMatchObject({
            reason: expect.stringContaining('has already passed today'),
        });
        // 12 am is midnight, which this morning has left behind.
        expect(parseClockTimeToday('12am', NOW)).toMatchObject({
            reason: expect.stringContaining('has already passed today'),
        });
        expect(parseClockTimeToday('9:00', NOW)).toMatchObject({
            reason: expect.any(String),
        });
    });
});

describe('parseCountdownAt (EC-580)', () => {
    const partsOf = (text: string) => {
        const parsed = parseCountdownAt(text, NOW);
        expect(parsed).toBeInstanceOf(Date);
        const date = parsed as Date;
        return [
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
        ];
    };

    it('reads a day with its time, and a day alone as its start', () => {
        expect(partsOf('2026-12-25 09:00')).toEqual([2026, 12, 25, 9, 0]);
        expect(partsOf('2026-12-25T6:45 pm')).toEqual([2026, 12, 25, 18, 45]);
        expect(partsOf('2026-12-25')).toEqual([2026, 12, 25, 0, 0]);
        // Today's date with a time still to come is today's time.
        expect(partsOf('2026-11-11 10:30')).toEqual([2026, 11, 11, 10, 30]);
        // A time alone is still a time today.
        expect(partsOf('10:30')).toEqual([2026, 11, 11, 10, 30]);
        // A model writes seconds; the panel holds the minute.
        expect(partsOf('2026-12-25 00:00:00')).toEqual([2026, 12, 25, 0, 0]);
        expect(partsOf('2026-12-25T09:15:30')).toEqual([2026, 12, 25, 9, 15]);
        expect(partsOf('23:45:00')).toEqual([2026, 11, 11, 23, 45]);
    });

    it('refuses a day gone, a day too far or no day, naming today', () => {
        for (const [text, words] of [
            ['2025-12-25 09:00', 'has already passed -- today is 2026-11-11'],
            ['2026-11-11 08:00', 'has already passed -- today is 2026-11-11'],
            ['2027-12-25', 'more than a year away -- today is 2026-11-11'],
            ['2026-02-30 09:00', 'is not a date. Today is 2026-11-11'],
            ['2026-12-25 25:00', 'is not a time of day'],
            ['2026-12-25 09:00:75', 'is not a time of day'],
        ]) {
            expect(parseCountdownAt(text, NOW)).toMatchObject({
                reason: expect.stringContaining(words),
            });
        }
        expect(parseCountdownAt('2026-12-25 soon', NOW)).toBeNull();
        expect(parseCountdownAt('Christmas', NOW)).toBeNull();
    });
});

describe('escapeQuickTextMarkdown', () => {
    it('escapes only what Markdown would act on', () => {
        expect(escapeQuickTextMarkdown('Car park full')).toBe('Car park full');
        expect(escapeQuickTextMarkdown('a*b_c')).toBe(String.raw`a\*b\_c`);
        expect(escapeQuickTextMarkdown('<b>[x]</b>')).toBe(
            String.raw`\<b\>\[x\]\</b\>`,
        );
        expect(escapeQuickTextMarkdown('# Title\n- item\n  > quote')).toBe(
            String.raw`\# Title` +
                '\n' +
                String.raw`\- item` +
                '\n  ' +
                String.raw`\> quote`,
        );
        expect(escapeQuickTextMarkdown('1. first\n2) second')).toBe(
            String.raw`1\. first` + '\n' + String.raw`2\) second`,
        );
    });
});

describe('readForegroundVerse', () => {
    beforeEach(() => {
        h.resolveVersionOrder.mockResolvedValue({
            order: ['KJV'],
            installed: ['KJV'],
        });
        h.genBibleItemQuickTextMarkdown.mockResolvedValue({
            title: VERSE.title,
            markdown: VERSE.markdown,
            fontFamily: VERSE.fontFamily,
        });
    });

    it('reads the passage from the installed Bible, its words on one line', async () => {
        const toText = vi.fn(async () => {
            return '  For God\n so   loved\tthe world. ';
        });
        const bibleItem = { toText };
        h.resolveBibleItem.mockResolvedValue(bibleItem);
        const verse = await readForegroundVerse('John 3:16', ' KJV ');
        expect(h.resolveVersionOrder).toHaveBeenCalledWith('KJV');
        expect(h.resolveBibleItem).toHaveBeenCalledWith('John 3:16', ['KJV']);
        expect(h.genBibleItemQuickTextMarkdown).toHaveBeenCalledWith(bibleItem);
        expect(toText).toHaveBeenCalledWith(undefined, 'parenthesis');
        expect(verse).toEqual({
            title: VERSE.title,
            text: 'For God so loved the world.',
            markdown: VERSE.markdown,
            fontFamily: VERSE.fontFamily,
        });
    });

    it("asks for the lookup's own version when none is named", async () => {
        h.resolveBibleItem.mockResolvedValue({ toText: async () => 'x' });
        await readForegroundVerse('John 3:16', '   ');
        await readForegroundVerse('John 3:16', 7);
        expect(h.resolveVersionOrder.mock.calls).toEqual([[null], [null]]);
    });

    it("answers the version's reason when no Bible can read it", async () => {
        h.resolveVersionOrder.mockResolvedValueOnce({
            reason: 'There is no Bible called "ZZZ".',
        });
        expect(await readForegroundVerse('John 3:16', 'ZZZ')).toEqual({
            reason: 'There is no Bible called "ZZZ".',
        });
        h.resolveVersionOrder.mockResolvedValueOnce({});
        expect(await readForegroundVerse('John 3:16', 'ZZZ')).toEqual({
            reason: 'No Bible could read that.',
        });
        expect(h.resolveBibleItem).not.toHaveBeenCalled();
    });

    it('answers in a sentence when the reference reads as no passage', async () => {
        h.resolveBibleItem.mockResolvedValue(null);
        const result = await readForegroundVerse('Hezekiah 9:9', null);
        expect(result).toMatchObject({
            reason: expect.stringContaining('"Hezekiah 9:9" could not be read'),
        });
        expect(h.genBibleItemQuickTextMarkdown).not.toHaveBeenCalled();
    });
});

describe('planForegroundContent: countdown', () => {
    it("writes a length into the panel's three boxes", async () => {
        const plan = await planForegroundContent(
            'countdown',
            { minutes: 5 },
            '-s2',
            NOW,
        );
        expect(plan).toMatchObject({
            said: '5 minutes',
            name: '5:00',
            countdownMode: 'duration',
        });
        expect(toWriteMap(plan)).toEqual({
            'foreground-hours-setting-s2': '0',
            'foreground-minutes-setting-s2': '5',
            'foreground-seconds-setting-s2': '0',
        });
    });

    it('takes minutes as words, with hours and seconds carried out of them', async () => {
        const plan = await planForegroundContent(
            'countdown',
            { minutes: ' 92.5 ', autoStart: 'Yes' },
            '',
            NOW,
        );
        expect(plan).toMatchObject({ said: '92.5 minutes', name: '1:32:30' });
        const { writes } = plan as AgentForegroundContentPlanType;
        // The auto start goes first, then the length.
        expect(writes[0]).toEqual({
            key: 'foreground-countdown-auto-start-setting',
            value: 'true',
        });
        expect(toWriteMap(plan)).toMatchObject({
            'foreground-hours-setting': '1',
            'foreground-minutes-setting': '32',
            'foreground-seconds-setting': '30',
        });
    });

    it('refuses a length outside a quarter of a minute to a day', async () => {
        for (const minutes of [0.1, 0, -5, 1441]) {
            expect(
                await planForegroundContent('countdown', { minutes }, '', NOW),
            ).toMatchObject({
                reason: expect.stringContaining('from a quarter of a minute'),
            });
        }
        expect(
            await planForegroundContent(
                'countdown',
                { minutes: 0.25 },
                '',
                NOW,
            ),
        ).toMatchObject({ name: '0:15' });
    });

    it("writes a time of day into the panel's date and time boxes", async () => {
        const plan = await planForegroundContent(
            'countdown',
            { at: '10:30' },
            '-s1',
            NOW,
        );
        expect(plan).toMatchObject({
            name: '→ 10:30',
            countdownMode: 'date',
            said: expect.stringMatching(/^to /),
        });
        expect(toWriteMap(plan)).toEqual({
            'foreground-date-setting-s1': '2026-11-11',
            'foreground-time-setting-s1': '10:30',
        });
    });

    it('pads the date box of a single-digit month and day', async () => {
        const plan = await planForegroundContent(
            'countdown',
            { at: '7:05 pm' },
            '',
            new Date(2026, 0, 3, 8, 0, 0, 0),
        );
        expect(toWriteMap(plan)).toEqual({
            'foreground-date-setting': '2026-01-03',
            'foreground-time-setting': '19:05',
        });
    });

    it('refuses a time that is not one, or is gone', async () => {
        expect(
            await planForegroundContent('countdown', { at: 'soon' }, '', NOW),
        ).toMatchObject({
            reason: expect.stringContaining('or give a number of minutes'),
        });
        expect(
            await planForegroundContent('countdown', { at: '8:00' }, '', NOW),
        ).toMatchObject({
            reason: expect.stringContaining('has already passed'),
        });
    });

    it('only switches auto start when that is all it was told', async () => {
        expect(
            await planForegroundContent(
                'countdown',
                { autoStart: 'off' },
                '-a',
                NOW,
            ),
        ).toEqual({
            writes: [
                {
                    key: 'foreground-countdown-auto-start-setting-a',
                    value: 'false',
                },
            ],
            said: '',
            name: '',
        });
        // Not a yes or a no, not a number: nothing asked.
        expect(
            await planForegroundContent(
                'countdown',
                { autoStart: 'maybe', minutes: '' },
                '',
                NOW,
            ),
        ).toBeNull();
        expect(
            await planForegroundContent(
                'countdown',
                { minutes: true },
                '',
                NOW,
            ),
        ).toBeNull();
    });
});

describe('planForegroundContent: stopwatch', () => {
    it('writes its auto start, or nothing', async () => {
        expect(
            await planForegroundContent(
                'stopwatch',
                { autoStart: true },
                '-w',
                NOW,
            ),
        ).toEqual({
            writes: [
                {
                    key: 'foreground-stopwatch-auto-start-setting-w',
                    value: 'true',
                },
            ],
            said: '',
            name: '',
        });
        expect(
            await planForegroundContent('stopwatch', {}, '', NOW),
        ).toBeNull();
    });
});

describe('planForegroundContent: marquees', () => {
    it('writes the words on one line, under its own position', async () => {
        const plan = await planForegroundContent(
            'marquee-bottom',
            { text: '  Welcome \n  everyone   today ' },
            '-m',
            NOW,
        );
        expect(plan).toEqual({
            writes: [
                {
                    key: 'foreground-marquee-bottom-setting-m',
                    value: 'Welcome everyone today',
                },
            ],
            said: '"Welcome everyone today"',
            name: 'Welcome everyone today',
        });
    });

    it('writes a verse as its title and words, named after the verse', async () => {
        const plan = await planForegroundContent(
            'marquee-top',
            { ref: 'John 3:16', verse: VERSE },
            '',
            NOW,
        );
        expect(plan).toMatchObject({
            name: VERSE.title,
            verseTitle: VERSE.title,
        });
        expect(toWriteMap(plan)).toEqual({
            'foreground-marquee-top-setting': `${VERSE.title} — ${VERSE.text}`,
        });
    });

    it('refuses a verse that was not read, and words past a marquee', async () => {
        expect(
            await planForegroundContent(
                'marquee-top',
                { ref: 'John 3:16' },
                '',
                NOW,
            ),
        ).toEqual({ reason: 'The passage was not read.' });
        expect(
            await planForegroundContent(
                'marquee-top',
                { text: 'x'.repeat(601) },
                '',
                NOW,
            ),
        ).toMatchObject({
            reason: expect.stringContaining(
                '601 characters; a marquee holds at most 600',
            ),
        });
        expect(
            await planForegroundContent(
                'marquee-top',
                { text: 'x'.repeat(600) },
                '',
                NOW,
            ),
        ).not.toHaveProperty('reason');
        expect(
            await planForegroundContent('marquee-top', { text: '  ' }, '', NOW),
        ).toBeNull();
    });
});

describe('planForegroundContent: quick text', () => {
    it("writes a verse's Markdown, with its Bible's font for a new session", async () => {
        const plan = await planForegroundContent(
            'quick-text',
            { ref: 'John 3:16', verse: VERSE },
            '-q',
            NOW,
        );
        expect(plan).toEqual({
            writes: [
                {
                    key: 'foreground-quick-text-setting-q',
                    value: VERSE.markdown,
                },
            ],
            said: `${VERSE.title}: "${VERSE.text}"`,
            name: VERSE.title,
            verseTitle: VERSE.title,
            verseFontFamily: VERSE.fontFamily,
        });
        const noFont = await planForegroundContent(
            'quick-text',
            { ref: 'John 3:16', verse: { ...VERSE, fontFamily: '' } },
            '-q',
            NOW,
        );
        expect(noFont).not.toHaveProperty('verseFontFamily');
    });

    it('refuses a verse not read or too long for a quick text', async () => {
        expect(
            await planForegroundContent(
                'quick-text',
                { ref: 'John 3:16' },
                '',
                NOW,
            ),
        ).toEqual({ reason: 'The passage was not read.' });
        expect(
            await planForegroundContent(
                'quick-text',
                {
                    ref: 'Psalm 119',
                    verse: { ...VERSE, markdown: 'w'.repeat(3001) },
                },
                '',
                NOW,
            ),
        ).toMatchObject({
            reason: expect.stringContaining('a quick text holds at most 3000'),
        });
        expect(
            await planForegroundContent(
                'quick-text',
                { text: 'w'.repeat(3001) },
                '',
                NOW,
            ),
        ).toMatchObject({ reason: expect.stringContaining('3001 characters') });
    });

    it('writes typed words as they are, named by their first line', async () => {
        const plan = await planForegroundContent(
            'quick-text',
            { text: '  **Blue car** lights on\nsecond line  ' },
            '',
            NOW,
        );
        expect(plan).toEqual({
            writes: [
                {
                    key: 'foreground-quick-text-setting',
                    value: '**Blue car** lights on\nsecond line',
                },
            ],
            said: '"Blue car lights on"',
            name: 'Blue car lights on',
        });
    });

    it('writes how long it waits and stays, rounded to whole seconds', async () => {
        const plan = await planForegroundContent(
            'quick-text',
            { delay: '2.6', seconds: 30 },
            '-t',
            NOW,
        );
        expect(plan).toMatchObject({ said: '', name: '' });
        expect(toWriteMap(plan)).toEqual({
            'foreground-quick-text-time-delay-t': '3',
            'foreground-quick-text-time-to-live-t': '30',
        });
    });

    it('refuses a wait or a stay outside its bounds', async () => {
        for (const delay of [-1, 601]) {
            expect(
                await planForegroundContent('quick-text', { delay }, '', NOW),
            ).toEqual({ reason: 'delay is seconds, 0-600.' });
        }
        for (const seconds of [0, 601]) {
            expect(
                await planForegroundContent('quick-text', { seconds }, '', NOW),
            ).toEqual({ reason: 'seconds (how long it stays) is 1-600.' });
        }
        expect(
            await planForegroundContent('quick-text', { delay: 0 }, '', NOW),
        ).toMatchObject({
            writes: [{ key: 'foreground-quick-text-time-delay', value: '0' }],
        });
        expect(
            await planForegroundContent('quick-text', { text: 5 }, '', NOW),
        ).toBeNull();
    });
});

describe('planForegroundContent: messages', () => {
    it('stores several messages the way the panel separates them, one under another', async () => {
        const plan = await planForegroundContent(
            'message',
            { texts: ['  Welcome  ', '   ', 'Two\n\n  lines', 7] },
            '-s4',
            NOW,
        );
        expect(plan).toEqual({
            writes: [
                {
                    key: 'foreground-message-setting-s4',
                    // A blank line inside one is closed up; its indent kept.
                    value: 'Welcome\n\nTwo\n  lines',
                },
                {
                    key: 'foreground-message-is-rotating-s4',
                    value: 'false',
                },
            ],
            said: '2 messages',
            name: 'Welcome',
        });
    });

    it('keeps one message one message, its blank lines closed up', async () => {
        const plan = await planForegroundContent(
            'message',
            { text: ' Coffee after\n\n\nthe service ' },
            '',
            NOW,
        );
        expect(toWriteMap(plan)['foreground-message-setting']).toBe(
            'Coffee after\nthe service',
        );
        expect(plan).toMatchObject({
            said: '"Coffee after"',
            name: 'Coffee after',
        });
    });

    it('writes a verse as one message headed by its title', async () => {
        const plan = await planForegroundContent(
            'message',
            { ref: 'John 3:16', verse: VERSE },
            '',
            NOW,
        );
        expect(toWriteMap(plan)['foreground-message-setting']).toBe(
            `${VERSE.title}\n${VERSE.text}`,
        );
        expect(plan).toMatchObject({
            name: VERSE.title,
            verseTitle: VERSE.title,
        });
        expect(
            await planForegroundContent(
                'message',
                { ref: 'John 3:16' },
                '',
                NOW,
            ),
        ).toEqual({ reason: 'The passage was not read.' });
    });

    it('turns rotation on with its interval', async () => {
        const plan = await planForegroundContent(
            'message',
            { texts: ['One', 'Two'], interval: '9.6' },
            '-r',
            NOW,
        );
        expect(toWriteMap(plan)).toEqual({
            'foreground-message-setting-r': 'One\n\nTwo',
            'foreground-message-is-rotating-r': 'true',
            'foreground-message-interval-r': '10',
        });
        const intervalOnly = await planForegroundContent(
            'message',
            { interval: 4 },
            '',
            NOW,
        );
        expect(toWriteMap(intervalOnly)).toEqual({
            'foreground-message-is-rotating': 'true',
            'foreground-message-interval': '4',
        });
    });

    it('refuses too many messages, too many words, or an interval out of bounds', async () => {
        expect(
            await planForegroundContent(
                'message',
                {
                    texts: Array.from({ length: 21 }, (_, index) => {
                        return `m${index}`;
                    }),
                },
                '',
                NOW,
            ),
        ).toEqual({ reason: 'At most 20 messages in a session.' });
        expect(
            await planForegroundContent(
                'message',
                { texts: ['a'.repeat(2000), 'b'.repeat(1000)] },
                '',
                NOW,
            ),
        ).toMatchObject({
            reason: expect.stringContaining('3002 characters; a message'),
        });
        for (const interval of [1, 601]) {
            expect(
                await planForegroundContent(
                    'message',
                    { text: 'x', interval },
                    '',
                    NOW,
                ),
            ).toMatchObject({ reason: expect.stringContaining('2-600') });
        }
        expect(
            await planForegroundContent('message', { texts: [] }, '', NOW),
        ).toBeNull();
    });
});

describe('planForegroundContent: time', () => {
    beforeEach(() => {
        vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
            '00000000-0000-4000-8000-00000000c10c',
        );
    });

    it('gives a session its first clock, listed, set as asked', async () => {
        const plan = await planForegroundContent(
            'time',
            { utcOffset: '7', title: ' Springfield ', is24Hour: 'on' },
            '-s1',
            NOW,
        );
        const clockId = '00000000-0000-4000-8000-00000000c10c';
        expect(plan).toEqual({
            writes: [
                {
                    key: 'foreground-time-id-list-s1',
                    value: JSON.stringify([clockId]),
                },
                {
                    key: `foreground-timezone-minute-offset-setting-${clockId}`,
                    value: '7',
                },
                // A chosen city's zone would put its own offset back.
                {
                    key: `foreground-timezone-name-setting-${clockId}`,
                    value: null,
                },
                {
                    key: `foreground-city-name-setting-${clockId}`,
                    value: 'Springfield',
                },
                {
                    key: `foreground-time-is-24-hour-format-setting-${clockId}`,
                    value: 'true',
                },
            ],
            said: 'Springfield UTC+7',
            name: 'Springfield',
            clockId,
            newClockIdList: [clockId],
        });
    });

    it("changes the session's first clock when it has some", async () => {
        h.settings.set('foreground-time-id-list', JSON.stringify(['c1', 'c2']));
        const plan = await planForegroundContent(
            'time',
            { utcOffset: -5 },
            '',
            NOW,
        );
        expect(plan).toEqual({
            writes: [
                {
                    key: 'foreground-timezone-minute-offset-setting-c1',
                    value: '-5',
                },
                { key: 'foreground-timezone-name-setting-c1', value: null },
            ],
            said: 'UTC-5',
            name: 'UTC-5',
            clockId: 'c1',
        });
        expect(globalThis.crypto.randomUUID).not.toHaveBeenCalled();
        const formatOnly = await planForegroundContent(
            'time',
            { is24Hour: false },
            '',
            NOW,
        );
        expect(formatOnly).toMatchObject({ said: 'the clock', name: '' });
        expect(
            await planForegroundContent('time', { utcOffset: 0 }, '', NOW),
        ).toMatchObject({ said: 'UTC+0' });
    });

    it('refuses an offset no zone has and a title that is not a name', async () => {
        for (const utcOffset of [-13, 15]) {
            expect(
                await planForegroundContent('time', { utcOffset }, '', NOW),
            ).toMatchObject({ reason: expect.stringContaining('-12 to 14') });
        }
        expect(
            await planForegroundContent(
                'time',
                { title: 'a'.repeat(41) },
                '',
                NOW,
            ),
        ).toMatchObject({ reason: expect.stringContaining('short name') });
        h.settings.set('foreground-time-id-list', JSON.stringify(['c1']));
        expect(await planForegroundContent('time', {}, '', NOW)).toBeNull();
    });

    // 2026-11-13, EC-556: "put the time on the screen" on a new install was
    // refused -- the session held no clock until its panel was opened.
    it('gives a session with no clock one on this computer’s time', async () => {
        const plan: any = await planForegroundContent('time', {}, '-s1', NOW);
        expect(plan.name).toBe('');
        expect(plan.newClockIdList).toEqual([plan.clockId]);
        expect(plan.writes).toEqual([
            {
                key: 'foreground-time-id-list-s1',
                value: JSON.stringify([plan.clockId]),
            },
        ]);
        // No offset is written: the clock follows the computer.
        expect(
            plan.writes.some((one: any) => {
                return one.key.includes('timezone');
            }),
        ).toBe(false);
    });
});

describe('planForegroundContent: no words of its own', () => {
    it('has nothing to write for a component that holds a file or a device', async () => {
        for (const widget of ['video', 'camera', 'long-text'] as const) {
            expect(
                await planForegroundContent(widget, { text: 'x' }, '', NOW),
            ).toBeNull();
        }
    });
});

describe('checkIsSameContent', () => {
    it("reads a key nobody wrote as the panel's default: a fresh Default IS five minutes", async () => {
        const five = await planForegroundContent(
            'countdown',
            { minutes: 5 },
            '',
            NOW,
        );
        expect(checkIsSameContent(five as AgentForegroundContentPlanType)).toBe(
            true,
        );
        const six = await planForegroundContent(
            'countdown',
            { minutes: 6 },
            '',
            NOW,
        );
        expect(checkIsSameContent(six as AgentForegroundContentPlanType)).toBe(
            false,
        );
        h.settings.set('foreground-minutes-setting', '6');
        expect(checkIsSameContent(six as AgentForegroundContentPlanType)).toBe(
            true,
        );
        expect(checkIsSameContent(five as AgentForegroundContentPlanType)).toBe(
            false,
        );
    });

    it('takes an empty stored value as the default too', () => {
        h.settings.set('foreground-message-interval-a', '');
        expect(
            checkIsSameContent({
                writes: [{ key: 'foreground-message-interval-a', value: '8' }],
                said: '',
                name: '',
            }),
        ).toBe(true);
    });

    it('counts a removal as the same when nothing is stored', () => {
        const plan: AgentForegroundContentPlanType = {
            writes: [
                { key: 'foreground-timezone-name-setting-c1', value: null },
            ],
            said: '',
            name: '',
        };
        expect(checkIsSameContent(plan)).toBe(true);
        h.settings.set('foreground-timezone-name-setting-c1', '');
        expect(checkIsSameContent(plan)).toBe(true);
        h.settings.set('foreground-timezone-name-setting-c1', 'Zone/Somewhere');
        expect(checkIsSameContent(plan)).toBe(false);
    });

    it('needs every write to match', () => {
        h.settings.set('foreground-marquee-top-setting', 'Welcome');
        expect(
            checkIsSameContent({
                writes: [
                    { key: 'foreground-marquee-top-setting', value: 'Welcome' },
                    {
                        key: 'foreground-marquee-top-speed-percentage',
                        value: '150',
                    },
                ],
                said: '',
                name: '',
            }),
        ).toBe(false);
    });
});

describe('toPanelDefault', () => {
    it("answers a box's default by its key's name, whatever the session", () => {
        expect(toPanelDefault('foreground-minutes-setting')).toBe('5');
        expect(toPanelDefault('foreground-minutes-setting-s2')).toBe('5');
        expect(toPanelDefault('foreground-hours-setting-s2')).toBe('0');
        expect(toPanelDefault('foreground-quick-text-time-to-live-q')).toBe(
            '5',
        );
        expect(toPanelDefault('foreground-quick-text-time-delay')).toBe('0');
        expect(toPanelDefault('foreground-quick-text-is-infinite-a')).toBe(
            'false',
        );
        expect(toPanelDefault('foreground-message-interval-x')).toBe('8');
        expect(toPanelDefault('foreground-stopwatch-auto-start-setting')).toBe(
            'false',
        );
        // A longer key that only starts the same is another key.
        expect(toPanelDefault('foreground-minutes-settings')).toBeNull();
        expect(toPanelDefault('foreground-marquee-top-setting')).toBeNull();
    });
});

describe('readForegroundContent', () => {
    it("reads a countdown at the panel's defaults, then as set", () => {
        expect(readForegroundContent('countdown', '-c', NOW)).toEqual({
            hours: '0',
            minutes: '5',
            seconds: '0',
            toDate: undefined,
            toTime: undefined,
            autoStart: false,
            // The model knows no date; `at` on another day needs it (EC-580).
            today: '2026-11-11',
        });
        h.settings.set('foreground-hours-setting-c', '1');
        h.settings.set('foreground-date-setting-c', '2026-11-11');
        h.settings.set('foreground-time-setting-c', '10:30');
        h.settings.set('foreground-countdown-auto-start-setting-c', 'true');
        expect(readForegroundContent('countdown', '-c')).toMatchObject({
            hours: '1',
            toDate: '2026-11-11',
            toTime: '10:30',
            autoStart: true,
        });
    });

    it("reads a stopwatch's auto start", () => {
        expect(readForegroundContent('stopwatch', '')).toEqual({
            autoStart: false,
        });
        h.settings.set('foreground-stopwatch-auto-start-setting', 'true');
        expect(readForegroundContent('stopwatch', '')).toEqual({
            autoStart: true,
        });
    });

    it('reads a marquee, its size `auto` until one is set', () => {
        expect(readForegroundContent('marquee-top', '-m')).toEqual({
            text: '',
            fontSize: 'auto',
            speed: 100,
        });
        h.settings.set('foreground-marquee-bottom-setting-m', 'Welcome');
        h.settings.set('foreground-marquee-bottom-font-size-m', '48');
        h.settings.set('foreground-marquee-bottom-speed-percentage-m', '150');
        expect(readForegroundContent('marquee-bottom', '-m')).toEqual({
            text: 'Welcome',
            fontSize: 48,
            speed: 150,
        });
    });

    it("reads a quick text's words and timing", () => {
        expect(readForegroundContent('quick-text', '')).toEqual({
            text: '',
            delay: 0,
            seconds: 5,
            infinite: false,
        });
        h.settings.set('foreground-quick-text-setting', 'Hello');
        h.settings.set('foreground-quick-text-time-delay', '2');
        h.settings.set('foreground-quick-text-time-to-live', '12');
        h.settings.set('foreground-quick-text-is-infinite', 'true');
        expect(readForegroundContent('quick-text', '')).toEqual({
            text: 'Hello',
            delay: 2,
            seconds: 12,
            infinite: true,
        });
    });

    it('reads the messages one by one, blank editors left out', () => {
        expect(readForegroundContent('message', '-s')).toEqual({
            texts: [],
            rotate: false,
            interval: 8,
        });
        h.settings.set(
            'foreground-message-setting-s',
            'First\n\n  \n\n Second\nline ',
        );
        h.settings.set('foreground-message-is-rotating-s', 'true');
        h.settings.set('foreground-message-interval-s', '12');
        expect(readForegroundContent('message', '-s')).toEqual({
            texts: ['First', 'Second\nline'],
            rotate: true,
            interval: 12,
        });
    });

    it("reads each clock of a Time session, the computer's zone when none is set", () => {
        h.settings.set(
            'foreground-time-id-list-t',
            JSON.stringify(['c1', 'c2']),
        );
        h.settings.set('foreground-city-name-setting-c1', 'Springfield');
        h.settings.set('foreground-timezone-minute-offset-setting-c1', '5.5');
        h.settings.set('foreground-time-is-24-hour-format-setting-c1', 'true');
        expect(readForegroundContent('time', '-t')).toEqual({
            clocks: [
                {
                    id: 'c1',
                    title: 'Springfield',
                    utcOffset: 5.5,
                    is24Hour: true,
                },
                {
                    id: 'c2',
                    title: null,
                    utcOffset: -new Date().getTimezoneOffset() / 60,
                    is24Hour: false,
                },
            ],
        });
    });

    it('has nothing to read for a component with no words', () => {
        expect(readForegroundContent('camera', '')).toEqual({});
        expect(readForegroundContent('long-text', '')).toEqual({});
    });
});
