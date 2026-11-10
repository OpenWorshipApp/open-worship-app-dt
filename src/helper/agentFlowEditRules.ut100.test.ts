// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// The assistant's batch on a presenting flow (`agentFlowEditRules.ts`), past
// what `agentFlowEditRules.test.ts` reads: every refusal the batch can give
// -- each says what was wrong and where -- and the CC, slide and removal
// rules on the stored json. Run against the REAL action registry and the
// real `PresentingFlowItem` rules; the same stand-ins as that file for what
// reaches the app.

vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => {
            return { name: filePath.split('/').at(-1)?.split('.')[0] ?? '' };
        },
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        appType: 'desktop',
        envUtils: { isFEUseEffectWarning: false },
        fileUtils: {},
        isDesktop: true,
        isPageAppDocumentEditor: false,
        isPagePresenter: true,
        isPageReader: false,
        isPageScreen: false,
        pathUtils: { sep: '/' },
        systemUtils: { isDev: false, isWindows: true },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('./errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('./loggerHelpers', () => ({ appError: vi.fn() }));
vi.mock('./dragHelpers', () => ({ deserializeDragData: vi.fn() }));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toTitle: vi.fn() },
}));
vi.mock('./bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: vi.fn(async () => ''),
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    varyAppDocumentFromFilePath: vi.fn(),
}));
vi.mock('../lyric-list/lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: vi.fn(),
}));
vi.mock('../presenting-flow/presentingFlowHelpers', () => ({
    toDocumentIcon: () => ['file', 'blue'],
    toDragTypeIconName: (type: string) => `drag-${type}`,
}));
vi.mock('../presenting-flow/presentingFlowAutoNextHelpers', () => ({
    jumpPresentingFlowRunToCcItem: vi.fn(),
    startPresentingFlowAutoNext: vi.fn(),
    startPresentingFlowAutoNextAtTime: vi.fn(),
    stopPresentingFlowAutoNextInterval: vi.fn(),
}));
vi.mock('../_screen/managers/screenSlideMediaControlHelpers', () => ({
    applyScreenSlideMediaControl: vi.fn(),
}));
vi.mock('../event/KeyboardEventListener', () => ({
    default: class {},
    checkIsControlKeys: () => false,
}));

import {
    MAX_AGENT_FLOW_CHANGES,
    applyAgentFlowChanges,
    applyAgentFlowRemoval,
    readAgentFlowChangeNeeds,
    toAgentFlowActionKey,
    toAgentFlowColorName,
    toAgentFlowColorNote,
    type AgentFlowPreparedType,
} from './agentFlowEditRules';

let uuidIndex = 0;

function genPrepared(
    titles: string[],
    extra: Partial<AgentFlowPreparedType> = {},
): AgentFlowPreparedType {
    return {
        titles,
        addedItemJsonMap: new Map(),
        slideIdListMap: new Map(),
        screenIdList: [0, 1],
        genId: () => `new-${++uuidIndex}`,
        ...extra,
    };
}

function genSong(extra: Record<string, unknown> = {}): any {
    return {
        type: 'appDocument',
        uuid: 'song-1',
        filePath: '/documents/Amazing Grace.owl',
        data: '/documents/Amazing Grace.owl',
        title: 'Amazing Grace',
        ...extra,
    };
}

function genVerse(extra: Record<string, unknown> = {}): any {
    return {
        type: 'bibleItem',
        uuid: 'verse-1',
        data: { key: 'JHN 3:16' },
        title: 'John 3:16',
        ...extra,
    };
}

function genSermon(extra: Record<string, unknown> = {}): any {
    return {
        type: 'appDocument',
        uuid: 'sermon-1',
        filePath: '/documents/Sermon.ows',
        data: '/documents/Sermon.ows',
        title: 'Sermon',
        ...extra,
    };
}

function genAction(
    data: string,
    uuid: string,
    extra: Record<string, unknown> = {},
): any {
    return { type: 'action', uuid, data, ...extra };
}

function genSheet(): any[] {
    return [genSong(), genVerse(), genSermon()];
}

const TITLES = ['Amazing Grace', 'John 3:16', 'Sermon'];
const SLIDES = new Map([[3, [101, 102, 103]]]);

/** Apply one change to a sheet and answer the result. */
function applyOne(
    sheet: any[],
    change: Record<string, any>,
    titles = TITLES,
    extra: Partial<AgentFlowPreparedType> = {},
) {
    return applyAgentFlowChanges(sheet, [change], genPrepared(titles, extra));
}

function expectReason(result: unknown, reason: string) {
    expect(result).toEqual({ reason });
}

beforeEach(() => {
    uuidIndex = 0;
});

describe('the small readers', () => {
    test('a colour that is not words is refused; nothing at all takes it off', () => {
        expect(toAgentFlowColorNote(5)).toEqual({
            reason: '`color` is a colour name, "#RRGGBB", or "none".',
        });
        expect(toAgentFlowColorNote(null)).toEqual({ colorNote: null });
        expect(toAgentFlowColorNote('')).toEqual({ colorNote: null });
        // A name of the long list, said with spaces and capitals.
        expect(toAgentFlowColorNote(' Alice Blue ')).toEqual({
            colorNote: '#F0F8FF',
        });
    });

    test('a colour read back as a name only when it is a main one', () => {
        expect(toAgentFlowColorName(5)).toBeNull();
        expect(toAgentFlowColorName('')).toBeNull();
        expect(toAgentFlowColorName('#ff0000')).toBe('red');
    });

    test('a shortcut that is no words, or no key, is not one', () => {
        expect(toAgentFlowActionKey(5)).toBeNull();
        expect(toAgentFlowActionKey('')).toBeNull();
        expect(toAgentFlowActionKey(' + ')).toBeNull();
        // A bare key takes the run's own keys away: refused.
        expect(toAgentFlowActionKey('a')).toBeNull();
        expect(toAgentFlowActionKey('command+shift+f5')).toBe('Ctrl+Shift+F5');
    });
});

describe('what the worker has to read first: refusals', () => {
    test(`more than ${MAX_AGENT_FLOW_CHANGES} changes is refused`, () => {
        const changes = Array.from(
            { length: MAX_AGENT_FLOW_CHANGES + 1 },
            () => {
                return { line: 1, park: true };
            },
        );
        expectReason(
            readAgentFlowChangeNeeds(changes, 3),
            'At most 120 changes go in one call.',
        );
        expect(
            readAgentFlowChangeNeeds(changes.slice(1), 3),
        ).not.toHaveProperty('reason');
    });

    test.each([
        [[5], 'Change 1 is not an object.'],
        [[{ line: 1, park: true }, null], 'Change 2 is not an object.'],
        [
            [{ line: 1, park: true, after: 9 }],
            'Change 1: `after` is a line number as the sheet reads now, 1 to ' +
                '3. A line added in this call has no number yet: adds with ' +
                'the same `after` go in the order given.',
        ],
        [
            [{ add: { actionId: 'clear-all' }, after: -1 }],
            'Change 1: `after` is a line number as the sheet reads now, 1 to ' +
                '3. A line added in this call has no number yet: adds with ' +
                'the same `after` go in the order given.',
        ],
        [[{ add: 5 }], 'Change 1: `add` is an object.'],
        [[{ add: null }], 'Change 1: `add` is an object.'],
        [
            [{ add: { document: 'Welcome', actionId: 'clear-all' } }],
            'Change 1: `add` is ONE of a `document` (a Documents name), a ' +
                '`reference` (a Bible passage), an `actionId`, or a ' +
                '`foreground` ({widget, …}).',
        ],
        [
            [{ add: {} }],
            'Change 1: `add` is ONE of a `document` (a Documents name), a ' +
                '`reference` (a Bible passage), an `actionId`, or a ' +
                '`foreground` ({widget, …}).',
        ],
        [
            [{ add: { document: '   ' } }],
            'Change 1: `document` is a Documents name.',
        ],
        [
            [{ add: { reference: 7 } }],
            'Change 1: `reference` is a passage such as "John 3:16".',
        ],
        [
            [{ add: { actionId: 'jump-to', target: 4 } }],
            'Change 1: `target` is a line number as the sheet reads now, 1 to 3.',
        ],
        [
            [{ line: 1, cc: { add: { line: 0 } } }],
            'Change 1: `cc.add.line` is a line number as the sheet reads now, ' +
                '1 to 3.',
        ],
        [
            [{ line: 1.5, park: true }],
            'Change 1: `line` is a line number as the sheet reads now, 1 to 3. ' +
                'A change names the `line` it changes, or `add`s one.',
        ],
    ])('%j is refused', (changes, reason) => {
        expectReason(readAgentFlowChangeNeeds(changes, 3), reason);
    });

    test('a passage with no version reads in any; a target in range is fine', () => {
        expect(
            readAgentFlowChangeNeeds(
                [
                    { add: { reference: ' Psalm 23 ' } },
                    { add: { actionId: 'jump-to', target: 3 }, after: 0 },
                    { line: 2, cc: null },
                ],
                3,
            ),
        ).toEqual({
            documentMap: new Map(),
            referenceMap: new Map([
                [0, { reference: 'Psalm 23', version: null }],
            ]),
            slideLineSet: new Set(),
        });
    });
});

describe('adding a line', () => {
    test('a document as the worker prepared it, re-keyed, coloured, placed', () => {
        const sheet = genSheet();
        const prepared = {
            type: 'appDocument',
            filePath: '/documents/Welcome.ows',
            data: '/documents/Welcome.ows',
            title: 'Welcome',
        } as any;
        const result = applyOne(
            sheet,
            { add: { document: 'Welcome', color: 'red' }, after: 1 },
            TITLES,
            { addedItemJsonMap: new Map([[0, prepared]]) },
        );
        expect(result).toEqual({
            changed: ['added "Welcome" after line 1 "Amazing Grace"'],
        });
        expect(sheet[1]).toEqual({
            ...prepared,
            uuid: 'new-1',
            colorNote: '#FF0000',
        });
        // The worker's own copy is left as it was.
        expect(prepared).not.toHaveProperty('uuid');
        expect(prepared).not.toHaveProperty('colorNote');
    });

    test('a document or passage the worker could not read is refused', () => {
        expectReason(
            applyOne(genSheet(), { add: { reference: 'Psalm 23' } }),
            'Change 1: what it adds could not be read.',
        );
    });

    test('an `after` on an empty sheet says to leave it out (EC-469)', () => {
        expectReason(
            readAgentFlowChangeNeeds(
                [
                    { add: { actionId: 'clear-all' }, after: 0 },
                    { add: { actionId: 'clear-all' }, after: 1 },
                ],
                0,
            ),
            'Change 2: the sheet has no lines yet -- leave `after` out and ' +
                'the adds go in the order given.',
        );
    });

    test('a foreground that is not {widget, …} is refused, naming the widgets', () => {
        expectReason(
            applyOne(genSheet(), { add: { foreground: 5 } }),
            'Change 1: `foreground` is {widget, …} -- widget one of ' +
                'countdown, stopwatch, time, message, marquee-top, ' +
                'marquee-bottom, quick-text.',
        );
    });

    // EC-469: the three shapes a model wrote for one countdown, eleven
    // refusals in a row, each now read as the countdown it meant.
    test.each([
        [{ add: { foreground: { widget: 'countdown' }, seconds: 300 } }],
        [{ add: { foreground: { countdown: { seconds: 300 } } } }],
        [{ add: { foreground: { countdown: 300 } } }],
        [{ add: { foreground: 'countdown', seconds: 300 } }],
    ])('a countdown written as %j is added', (change) => {
        const sheet = genSheet();
        const result = applyOne(sheet, change);
        expect(result).not.toHaveProperty('reason');
        expect(sheet.at(-1)).toMatchObject({
            type: 'foreground',
            data: {
                target: 'countdown',
                data: { durationSecond: 301, isAutoStart: true },
            },
        });
    });

    test('a countdown with no length says where `seconds` goes', () => {
        expectReason(
            applyOne(genSheet(), { add: { foreground: 'countdown' } }),
            'Change 1: Say how long the countdown runs, INSIDE ' +
                '`foreground`: {widget: "countdown", seconds: 300} is five ' +
                'minutes; or the time it counts to, as `dateTime`.',
        );
    });

    test('a message written as {message: words} is added with them', () => {
        const sheet = genSheet();
        const result = applyOne(sheet, {
            add: { foreground: { message: 'Potluck after the service' } },
        });
        expect(result).toEqual({
            changed: ['added "Messages: Potluck after the service" at the end'],
        });
    });

    test('a message is added with the title a drag would give it', () => {
        const sheet = genSheet();
        const result = applyOne(sheet, {
            add: { foreground: { widget: 'message', text: 'Welcome all' } },
        });
        expect(result).toEqual({
            changed: ['added "Messages: Welcome all" at the end'],
        });
        expect(sheet.at(-1)).toEqual({
            type: 'foreground',
            uuid: 'new-1',
            data: {
                target: 'message',
                data: { textList: ['Welcome all'], intervalSecond: null },
            },
            title: 'Messages: Welcome all',
            extraStyle: {},
        });
    });

    test('a foreground refused by its own rules says why', () => {
        expectReason(
            applyOne(genSheet(), {
                add: { foreground: { widget: 'marquee-top' } },
            }),
            'Change 1: Say what scrolls across (`text`).',
        );
    });

    test.each([
        [
            { actionId: 'next-timeout', seconds: 0 },
            'Change 1: `seconds` is a number of seconds above 0.',
        ],
        [
            { actionId: 'next-timeout', seconds: 5, time: '10:00' },
            'Change 1: A line is armed with ONE of `seconds`, `time` or ' +
                '`key`, never two.',
        ],
        [
            { actionId: 'next-timeout', time: '25:00' },
            'Change 1: `time` is a time of day in 24-hour form, "HH:mm" -- ' +
                '"19:05".',
        ],
        [
            { actionId: 'keyboard-event', key: 'Alt+A' },
            'Change 1: `key` is a shortcut of Ctrl and/or Shift and one key ' +
                '-- "Ctrl+Shift+A", "Shift+F5".',
        ],
        [
            { actionId: 'clear-all', seconds: 5 },
            'Change 1: Clear All is not armed with anything.',
        ],
        [
            { actionId: 'next-timeout', key: 'Ctrl+B' },
            'Change 1: Next: Timeout is not armed with a shortcut.',
        ],
        [
            { actionId: 'next-interval', time: '10:00' },
            'Change 1: Next: Interval cannot be armed with a time of day.',
        ],
        [
            { actionId: 'keyboard-event', seconds: 3 },
            'Change 1: Keyboard Event is not armed with seconds.',
        ],
        [
            { actionId: 'clear-all', screenIds: '0' },
            'Change 1: `screenIds` is a list of screen numbers.',
        ],
        [
            { actionId: 'clear-all', screenIds: [0, -1] },
            'Change 1: `screenIds` is a list of screen numbers.',
        ],
        [
            { actionId: 'clear-all', target: 1 },
            'Change 1: only a Jump to takes a `target`.',
        ],
        [
            { actionId: 'clear-all', color: 'sparkly' },
            'Change 1: "sparkly" is not a colour the colour menu has -- say ' +
                'a name such as red, blue, green, yellow, purple, orange, or ' +
                '"#RRGGBB".',
        ],
    ])('an action %j is refused', (add, reason) => {
        const sheet = genSheet();
        expectReason(applyOne(sheet, { add }), reason);
        expect(sheet).toHaveLength(3);
    });

    test('a Jump to an invalid line is refused; to a line with no uuid gives it one', () => {
        const withError = [
            genSong(),
            { type: 'error', uuid: 'bad', data: '{broken' },
        ];
        expectReason(
            applyOne(withError, { add: { actionId: 'jump-to', target: 2 } }, [
                'Amazing Grace',
                'Invalid',
            ]),
            'Change 1: line 2 cannot be gone to.',
        );
        const sheet = [genSong({ uuid: undefined })];
        const result = applyOne(
            sheet,
            { add: { actionId: 'jump-to', target: 1 } },
            ['Amazing Grace'],
        );
        expect(result).toEqual({ changed: ['added "Jump to" at the end'] });
        // The target was given an identity, and the jump points at it.
        expect(typeof sheet[0].uuid).toBe('string');
        expect(sheet[0].uuid).not.toBe('');
        expect(sheet[1].ccItems).toEqual([{ uuid: sheet[0].uuid }]);
    });

    test('screens are checked only when the screens are known', () => {
        for (const screenIdList of [null, []]) {
            const sheet = genSheet();
            const result = applyOne(
                sheet,
                { add: { actionId: 'screen-show', screenIds: [7, 7] } },
                TITLES,
                { screenIdList },
            );
            expect(result).toEqual({
                changed: ['added "Screen: Show" at the end'],
            });
            // A screen named twice is pinned once.
            expect(sheet.at(-1).screenIds).toEqual([7]);
        }
    });

    test('a colour of "none" on an add leaves no colour note', () => {
        const sheet = genSheet();
        applyOne(sheet, { add: { actionId: 'clear-all', color: 'none' } });
        expect(sheet.at(-1)).not.toHaveProperty('colorNote');
    });
});

describe('changing a line: refusals', () => {
    test('a line past the sheet is not there', () => {
        expectReason(
            applyOne(genSheet(), { line: 9, park: true }),
            'Change 1: line 9 is not there.',
        );
    });

    test('an invalid line can only be moved', () => {
        const sheet = [...genSheet(), { type: 'error', uuid: 'bad' }];
        const titles = [...TITLES, 'Invalid'];
        expectReason(
            applyOne(sheet, { line: 4, color: 'red' }, titles),
            'Change 1: line 4 "Invalid" is an invalid line -- it can only be ' +
                'moved or removed.',
        );
        expect(applyOne(sheet, { line: 4, after: 0 }, titles)).toEqual({
            changed: ['moved line 4 "Invalid" at the top'],
        });
        expect(sheet[0].uuid).toBe('bad');
    });

    test.each([
        [
            { seconds: 5, time: '10:00' },
            'Change 1: A line is armed with ONE of `seconds`, `time` or ' +
                '`key`, never two.',
        ],
        [
            { key: 'Ctrl+A' },
            'Change 1: line 4 "Next: Timeout (8)": Next: Timeout is not armed ' +
                'with a shortcut.',
        ],
        [
            { clearArming: true },
            'Change 1: line 4 "Next: Timeout (8)" must keep what it is armed ' +
                'with; give it new `seconds` or a `time` instead.',
        ],
        [
            { color: 42 },
            'Change 1: `color` is a colour name, "#RRGGBB", or "none".',
        ],
        [
            { screenIds: [1.5] },
            'Change 1: `screenIds` is a list of screen numbers, [] for none.',
        ],
        [
            { screenIds: [0] },
            'Change 1: line 4 "Next: Timeout (8)" cannot be pinned to a screen.',
        ],
        [
            { slides: [{ slide: 1, park: true }] },
            'Change 1: line 4 "Next: Timeout (8)" is not a document whose ' +
                'slides could be read.',
        ],
        [
            { foreground: { seconds: 5 } },
            'Change 1: line 4 "Next: Timeout (8)" is not a foreground line.',
        ],
    ])('a timeout line given %j is refused', (change, reason) => {
        const sheet = [
            ...genSheet(),
            genAction('next-timeout', 't', { actionNumber: 8 }),
        ];
        expectReason(
            applyOne(sheet, { line: 4, ...change }, [
                ...TITLES,
                'Next: Timeout (8)',
            ]),
            reason,
        );
        expect(sheet[3]).toEqual(
            genAction('next-timeout', 't', { actionNumber: 8 }),
        );
    });

    test('a shortcut another line has is refused; its own is kept', () => {
        const sheet = [
            genAction('keyboard-event', 'k1', { actionKey: 'Ctrl+A' }),
            genAction('keyboard-event', 'k2', { actionKey: 'Ctrl+B' }),
        ];
        const titles = ['Key A', 'Key B'];
        expectReason(
            applyOne(sheet, { line: 2, key: 'ctrl+a' }, titles),
            'Change 1: the shortcut Ctrl+A is already used in this presenting ' +
                'flow -- one shortcut names one line.',
        );
        expect(sheet[1].actionKey).toBe('Ctrl+B');
        expect(applyOne(sheet, { line: 1, key: 'Ctrl+A' }, titles)).toEqual({
            changed: ['line 1 "Key A": shortcut Ctrl+A'],
        });
        expect(applyOne(sheet, { line: 2, key: 'shift+c' }, titles)).toEqual({
            changed: ['line 2 "Key B": shortcut Shift+C'],
        });
        expect(sheet[1].actionKey).toBe('Shift+C');
    });

    test('a Keyboard Event may lose its shortcut; a document never had one', () => {
        const sheet = [
            genAction('keyboard-event', 'k1', { actionKey: 'Ctrl+A' }),
            genSong(),
        ];
        const titles = ['Key A', 'Amazing Grace'];
        expect(applyOne(sheet, { line: 1, clearArming: true }, titles)).toEqual(
            { changed: ['line 1 "Key A": no shortcut'] },
        );
        expect(sheet[0]).not.toHaveProperty('actionKey');
        expectReason(
            applyOne(sheet, { line: 2, clearArming: true }, titles),
            'Change 1: line 2 "Amazing Grace" must keep what it is armed ' +
                'with; give it new `seconds` or a `time` instead.',
        );
    });

    test('Screen: Show cannot be pinned to no screen, nor to an unknown one', () => {
        const sheet = [genAction('screen-show', 'show', { screenIds: [0] })];
        const titles = ['Screen: Show'];
        expectReason(
            applyOne(sheet, { line: 1, screenIds: [] }, titles),
            'Change 1: line 1 "Screen: Show" has to name the screens it runs on.',
        );
        expectReason(
            applyOne(sheet, { line: 1, screenIds: [0, 5, 6] }, titles),
            'Change 1: There is no screen 5, 6; the screens are 0, 1.',
        );
        expect(sheet[0].screenIds).toEqual([0]);
        expect(applyOne(sheet, { line: 1, screenIds: [1, 0] }, titles)).toEqual(
            { changed: ['line 1 "Screen: Show": pinned to screen 1, 0'] },
        );
    });

    test('a line that cannot be read as an item cannot be pinned', () => {
        // A value no copy can take (a function): the item is never built.
        const sheet = [genVerse({ onRead: () => 'x' })];
        expectReason(
            applyOne(sheet, { line: 1, screenIds: [0] }, ['John 3:16']),
            'Change 1: line 1 "John 3:16" cannot be pinned to a screen.',
        );
        expect(sheet[0]).not.toHaveProperty('screenIds');
    });

    test('a colour taken off says none', () => {
        const sheet = [genSong({ colorNote: '#0000FF' })];
        expect(applyOne(sheet, { line: 1, color: null }, ['A'])).toEqual({
            changed: ['line 1 "A": colour none'],
        });
        expect(sheet[0]).not.toHaveProperty('colorNote');
    });

    test('a move after itself is no move', () => {
        const sheet = genSheet();
        expect(applyOne(sheet, { line: 2, after: 2, park: true })).toEqual({
            changed: ['parked line 2 "John 3:16"'],
        });
        expect(sheet.map((one) => one.uuid)).toEqual([
            'song-1',
            'verse-1',
            'sermon-1',
        ]);
        expect(applyOne(sheet, { line: 2, after: 2 })).toEqual({
            reason: expect.stringContaining('changes anything'),
        });
    });
});

describe("a document's slides", () => {
    test.each([
        [
            { slides: [] },
            'Change 1: `slides` is a list of {slide, park, screenIds}.',
        ],
        [
            { slides: 'all' },
            'Change 1: `slides` is a list of {slide, park, screenIds}.',
        ],
        [
            { slides: [{ slide: 4, park: true }] },
            'Change 1: `slide` is a slide number of line 3 "Sermon", 1 to 3.',
        ],
        [
            { slides: [null] },
            'Change 1: `slide` is a slide number of line 3 "Sermon", 1 to 3.',
        ],
        [
            { slides: [{ slide: 1, screenIds: 'one' }] },
            'Change 1: `screenIds` is a list of screen numbers.',
        ],
        [
            { slides: [{ slide: 1, screenIds: [3] }] },
            'Change 1: There is no screen 3; the screens are 0, 1.',
        ],
    ])('%j is refused', (change, reason) => {
        const sheet = genSheet();
        expectReason(
            applyOne(sheet, { line: 3, ...change }, TITLES, {
                slideIdListMap: SLIDES,
            }),
            reason,
        );
    });

    test('a document whose slides were not read is refused', () => {
        expectReason(
            applyOne(genSheet(), { line: 3, slides: [{ slide: 1 }] }),
            'Change 1: line 3 "Sermon" is not a document whose slides could ' +
                'be read.',
        );
    });

    test('a slide put back in play, and its pin taken off', () => {
        const sheet = [
            genSong(),
            genVerse(),
            genSermon({
                disabledSlideIds: [101, 102],
                slideScreenIds: { '101': [0], '102': [1] },
            }),
        ];
        const result = applyOne(
            sheet,
            {
                line: 3,
                slides: [
                    { slide: 2, park: false, screenIds: [] },
                    { slide: 1, park: false },
                ],
            },
            TITLES,
            { slideIdListMap: SLIDES },
        );
        expect(result).toEqual({
            changed: [
                'line 3 "Sermon", slide 2: in play',
                'line 3 "Sermon", slide 2: follows the document',
                'line 3 "Sermon", slide 1: in play',
            ],
        });
        // The last parked slide back in play leaves no list behind.
        expect(sheet[2]).not.toHaveProperty('disabledSlideIds');
        expect(sheet[2].slideScreenIds).toEqual({ '101': [0] });
        applyOne(
            sheet,
            { line: 3, slides: [{ slide: 1, screenIds: [] }] },
            TITLES,
            { slideIdListMap: SLIDES },
        );
        expect(sheet[2]).not.toHaveProperty('slideScreenIds');
    });
});

describe('a foreground line changed', () => {
    test('a change its own rules refuse names the line', () => {
        const sheet: any[] = [
            {
                type: 'foreground',
                uuid: 'fg',
                data: { target: 'countdown', data: { durationSecond: 301 } },
                title: 'Countdown: 5m',
            },
        ];
        expectReason(
            applyOne(sheet, { line: 1, foreground: { seconds: -5 } }, [
                'Countdown: 5m',
            ]),
            'Change 1: line 1 "Countdown: 5m": `seconds` is the countdown ' +
                'length in seconds -- 300 is five minutes -- up to a day.',
        );
        expectReason(
            applyOne(sheet, { line: 1, foreground: null }, ['Countdown: 5m']),
            'Change 1: line 1 "Countdown: 5m" is not a foreground line.',
        );
        expect(sheet[0].data.data).toEqual({ durationSecond: 301 });
    });

    test('a marquee given new words is retitled', () => {
        const sheet: any[] = [
            {
                type: 'foreground',
                uuid: 'fg',
                data: {
                    target: 'marquee-top',
                    data: { text: 'Old', speedPercentage: 100 },
                },
                title: 'Marquee Top: Old',
            },
        ];
        expect(
            applyOne(
                sheet,
                // The widget named again is ignored: a line keeps its kind.
                { line: 1, foreground: { widget: 'countdown', text: 'New' } },
                ['Marquee Top: Old'],
            ),
        ).toEqual({
            changed: ['line 1 "Marquee Top: Old" is now "Marquee Top: New"'],
        });
        expect(sheet[0].data).toEqual({
            target: 'marquee-top',
            data: { text: 'New', speedPercentage: 100 },
        });
    });
});

describe('attaching a CC', () => {
    test.each([
        [
            { cc: 'x' },
            'Change 1: `cc` is an object: {add} to attach, or {index, …} to ' +
                'change one.',
        ],
        [
            { cc: { add: { line: 2 }, screenIds: 'all' } },
            'Change 1: `cc.screenIds` is a list of screen numbers, [] for none.',
        ],
        [
            { cc: { add: { line: 2 }, screenIds: [9] } },
            'Change 1: There is no screen 9; the screens are 0, 1.',
        ],
        [
            { cc: { add: { line: 2 }, mediaControl: { mode: 'rewind' } } },
            'Change 1: `cc.mediaControl` is {mode: "play"|"pause"|"stop", ' +
                'delaySecond, startAtSecond, pauseAfterSecond or ' +
                'pauseAtSecond, volume 0-100, speed}.',
        ],
        [
            { cc: { add: 5 } },
            'Change 1: `cc.add` is {line} (a line of the sheet) or ' +
                '{actionId, …}.',
        ],
        [{ cc: { add: { line: 9 } } }, 'Change 1: line 9 is not there.'],
        [
            { cc: { add: { actionId: 'make-coffee' } } },
            'Change 1: `cc.add` names a `line` of the sheet, or an ' +
                '`actionId` (next-timeout, slide-media-control, a clear).',
        ],
        [
            { cc: { add: { actionId: 'next-timeout', seconds: 'ten' } } },
            'Change 1: `seconds` is a number of seconds above 0.',
        ],
        [
            { cc: { add: { actionId: 'clear-all', seconds: 5 } } },
            'Change 1: Clear All is not armed with anything.',
        ],
        [
            { cc: { add: { actionId: 'slide-media-control' } } },
            'Change 1: A Slide: Media Control needs `cc.mediaControl` -- ' +
                '{mode: "play"} at least.',
        ],
        [
            { cc: { add: { line: 1 } } },
            'Change 1: a line cannot follow itself.',
        ],
        [
            { cc: { add: { line: 2 }, mediaControl: { mode: 'play' } } },
            'Change 1: `cc.mediaControl` is only for a Slide: Media Control.',
        ],
        [
            { cc: { add: { line: 3 } } },
            'Change 1: "Sermon" cannot ride along with a line (a document, ' +
                'audio, a Next: Interval, a Jump to and a Keyboard Event ' +
                'never follow one).',
        ],
        [
            { cc: { slide: 1, add: { line: 2 } } },
            'Change 1: line 1 "Amazing Grace" has no slides to attach to.',
        ],
        [
            { cc: { index: 1 } },
            'Change 1: line 1 "Amazing Grace" has no CC element; `cc.add` ' +
                'attaches one.',
        ],
    ])('on a song, %j is refused', (change, reason) => {
        const sheet = genSheet();
        expectReason(applyOne(sheet, { line: 1, ...change }), reason);
        expect(sheet[0]).not.toHaveProperty('ccItems');
        expect(sheet).toHaveLength(3);
    });

    test('a line that takes no CC says so', () => {
        const sheet = [...genSheet(), genAction('next-timeout', 't')];
        expectReason(
            applyOne(sheet, { line: 4, cc: { add: { line: 2 } } }, [
                ...TITLES,
                'Next: Timeout',
            ]),
            'Change 1: line 4 "Next: Timeout" takes no CC element.',
        );
    });

    test('a CC already there is not attached twice', () => {
        const sheet = [genSong({ ccItems: [{ uuid: 'verse-1' }] }), genVerse()];
        expectReason(
            applyOne(sheet, { line: 1, cc: { add: { line: 2 } } }, [
                'Amazing Grace',
                'John 3:16',
            ]),
            'Change 1: line 1 "Amazing Grace" already has that CC element.',
        );
        expect(sheet[0].ccItems).toEqual([{ uuid: 'verse-1' }]);
    });

    test('a clear rides along pinned to a screen, a new line at the end', () => {
        const sheet = genSheet();
        const result = applyOne(sheet, {
            line: 1,
            cc: { add: { actionId: 'clear-bible' }, screenIds: [1] },
        });
        expect(result).toEqual({
            changed: [
                'line 1 "Amazing Grace" now brings "Clear Long Text" with it ' +
                    '(a new line at the end)',
            ],
        });
        expect(sheet).toHaveLength(4);
        expect(sheet[3].data).toBe('clear-bible');
        expect(sheet[0].ccItems).toEqual([
            { uuid: sheet[3].uuid, screenIds: [1] },
        ]);
    });

    test('a timeout with no seconds is armed with the question default', () => {
        const sheet = genSheet();
        const result = applyOne(sheet, {
            line: 2,
            cc: { add: { actionId: 'next-timeout' }, screenIds: [] },
        });
        expect(result).toEqual({
            changed: [
                'line 2 "John 3:16" now brings "Next: Timeout (10 seconds)" ' +
                    'with it (a new line at the end)',
            ],
        });
        expect(sheet[3]).toMatchObject({
            type: 'action',
            data: 'next-timeout',
            actionNumber: 10,
        });
        // An empty pin is no pin.
        expect(sheet[1].ccItems).toEqual([{ uuid: sheet[3].uuid }]);
    });

    test('a timeout at a time of day says the time', () => {
        const sheet = genSheet();
        const result = applyOne(sheet, {
            line: 1,
            cc: { add: { actionId: 'next-timeout', time: '9:30' } },
        });
        expect(result).toEqual({
            changed: [
                'line 1 "Amazing Grace" now brings "Next: Timeout (at 09:30)" ' +
                    'with it (a new line at the end)',
            ],
        });
        expect(sheet[3].actionTime).toBe('09:30');
    });

    test('a Jump to with no target is given one by `cc`', () => {
        const sheet = [...genSheet(), genAction('jump-to', 'jump')];
        const result = applyOne(sheet, { line: 4, cc: { add: { line: 1 } } }, [
            ...TITLES,
            'Jump to',
        ]);
        expect(result).toEqual({
            changed: ['line 4 "Jump to" goes to "Amazing Grace"'],
        });
        expect(sheet[3].ccItems).toEqual([{ uuid: 'song-1' }]);
    });
});

describe("a slide's CCs", () => {
    test.each([
        [
            { slide: 4, add: { line: 2 } },
            'Change 1: `cc.slide` is a slide number of line 3 "Sermon", 1 to 3.',
        ],
        [
            { slide: 0, add: { line: 2 } },
            'Change 1: `cc.slide` is a slide number of line 3 "Sermon", 1 to 3.',
        ],
    ])('%j is refused', (cc, reason) => {
        expectReason(
            applyOne(genSheet(), { line: 3, cc }, TITLES, {
                slideIdListMap: SLIDES,
            }),
            reason,
        );
    });

    test('a passage and a media control on two slides, then taken off', () => {
        const sheet = genSheet();
        const prepared = { slideIdListMap: SLIDES };
        expect(
            applyAgentFlowChanges(
                sheet,
                [
                    { line: 3, cc: { slide: 2, add: { line: 2 } } },
                    {
                        line: 3,
                        cc: {
                            slide: 1,
                            add: { actionId: 'slide-media-control' },
                            mediaControl: { mode: 'play', volume: 50 },
                        },
                    },
                ],
                genPrepared(TITLES, prepared),
            ),
        ).toEqual({
            changed: [
                'line 3 "Sermon", slide 2 now brings "John 3:16" with it',
                'line 3 "Sermon", slide 1 now brings "Slide: Media Control" ' +
                    'with it (a new line at the end)',
            ],
        });
        const mediaUuid = sheet[3].uuid;
        expect(sheet[3].data).toBe('slide-media-control');
        expect(sheet[2].slideCcItems).toEqual({
            '102': [{ uuid: 'verse-1' }],
            '101': [
                { uuid: mediaUuid, mediaControl: { mode: 'play', volume: 50 } },
            ],
        });
        // The song's own CCs are untouched.
        expect(sheet[2]).not.toHaveProperty('ccItems');
        const titles = [...TITLES, 'Slide: Media Control'];
        expect(
            applyOne(
                sheet,
                {
                    line: 3,
                    cc: { slide: 1, index: 1, mediaControl: { mode: 'pause' } },
                },
                titles,
                prepared,
            ),
        ).toEqual({
            changed: ['line 3 "Sermon", slide 1\'s media control: pause'],
        });
        expect(sheet[2].slideCcItems['101']).toEqual([
            { uuid: mediaUuid, mediaControl: { mode: 'pause' } },
        ]);
        applyOne(
            sheet,
            { line: 3, cc: { slide: 2, index: 1, remove: true } },
            titles,
            prepared,
        );
        expect(Object.keys(sheet[2].slideCcItems)).toEqual(['101']);
        expect(
            applyOne(
                sheet,
                { line: 3, cc: { slide: 1, index: 1, remove: true } },
                titles,
                prepared,
            ),
        ).toEqual({
            changed: [
                'line 3 "Sermon", slide 1 no longer brings "Slide: Media Control"',
            ],
        });
        expect(sheet[2]).not.toHaveProperty('slideCcItems');
    });
});

describe('changing a CC by its number', () => {
    function genWaitSheet(ccRecord: Record<string, unknown> = {}) {
        return [
            genSong({ ccItems: [{ uuid: 'wait', ...ccRecord }] }),
            genAction('next-timeout', 'wait', { actionNumber: 8 }),
        ];
    }
    const WAIT_TITLES = ['Amazing Grace', 'Next: Timeout (8)'];

    test.each([
        [
            { index: 2, remove: true },
            'Change 1: `cc.index` is 1 to 1, a CC of line 1 "Amazing Grace" ' +
                'as read.',
        ],
        [
            { index: 1, seconds: 0 },
            'Change 1: `seconds` is a number of seconds above 0.',
        ],
        [
            { index: 1, key: 'Ctrl+A' },
            'Change 1: a CC element is never armed with a shortcut.',
        ],
        [
            { index: 1, mediaControl: { mode: 'stop' } },
            'Change 1: `cc.mediaControl` is only for a Slide: Media Control.',
        ],
        [
            { index: 1 },
            'Change 1: `cc` with an `index` changes that CC: `remove`, ' +
                '`screenIds`, `seconds` / `time` / `clearArming`, or ' +
                '`mediaControl`.',
        ],
    ])('%j is refused', (cc, reason) => {
        const sheet = genWaitSheet();
        expectReason(applyOne(sheet, { line: 1, cc }, WAIT_TITLES), reason);
        expect(sheet[0].ccItems).toEqual([{ uuid: 'wait' }]);
    });

    test('its pin taken off, its own clock given back, then a time of day', () => {
        const sheet = genWaitSheet({
            screenIds: [0],
            actionArming: { actionNumber: 4 },
        });
        expect(
            applyOne(
                sheet,
                { line: 1, cc: { index: 1, screenIds: [], clearArming: true } },
                WAIT_TITLES,
            ),
        ).toEqual({
            changed: [
                'line 1 "Amazing Grace"\'s "Next: Timeout": follows its line',
                'line 1 "Amazing Grace"\'s "Next: Timeout": its own line\'s time',
            ],
        });
        expect(sheet[0].ccItems).toEqual([{ uuid: 'wait' }]);
        expect(
            applyOne(
                sheet,
                { line: 1, cc: { index: 1, time: '19:30' } },
                WAIT_TITLES,
            ),
        ).toEqual({
            changed: ['line 1 "Amazing Grace"\'s "Next: Timeout": at 19:30'],
        });
        expect(sheet[0].ccItems).toEqual([
            { uuid: 'wait', actionArming: { actionTime: '19:30' } },
        ]);
        // The element itself keeps its own arming.
        expect(sheet[1].actionNumber).toBe(8);
    });

    test('a passage, or a line that is gone, has no clock of its own', () => {
        const sheet = [genSong({ ccItems: [{ uuid: 'verse-1' }] }), genVerse()];
        expectReason(
            applyOne(sheet, { line: 1, cc: { index: 1, seconds: 4 } }, [
                'Amazing Grace',
                'John 3:16',
            ]),
            'Change 1: "John 3:16" is not armed on its own under a line.',
        );
        const gone = [genSong({ ccItems: [{ uuid: 'ghost' }] })];
        expectReason(
            applyOne(gone, { line: 1, cc: { index: 1, clearArming: true } }, [
                'Amazing Grace',
            ]),
            'Change 1: "a line that is gone" is not armed on its own under a ' +
                'line.',
        );
        expect(
            applyOne(gone, { line: 1, cc: { index: 1, remove: true } }, [
                'Amazing Grace',
            ]),
        ).toEqual({
            changed: [
                'line 1 "Amazing Grace" no longer brings "a line that is gone"',
            ],
        });
        expect(gone[0]).not.toHaveProperty('ccItems');
    });
});

describe('remove-lines', () => {
    test('a list that is not one is refused', () => {
        for (const lines of ['1', [], undefined]) {
            expectReason(
                applyAgentFlowRemoval(genSheet(), lines, TITLES),
                '`lines` is a list of line numbers as read.',
            );
        }
    });

    test('a line named twice goes once; a CC of it goes from slides too', () => {
        const sheet: any[] = [
            genSermon({
                ccItems: [{ uuid: 'wait' }, { uuid: 'clear' }],
                slideCcItems: {
                    '101': [{ uuid: 'wait' }],
                    '102': [{ uuid: 'wait' }, { uuid: 'clear' }],
                },
            }),
            genAction('next-timeout', 'wait', { actionNumber: 5 }),
            genAction('clear-all', 'clear'),
            { type: 'action', data: 'clear-bible' },
        ];
        const titles = [
            'Sermon',
            'Next: Timeout (5)',
            'Clear All',
            'Clear Long Text',
        ];
        expect(applyAgentFlowRemoval(sheet, [4, 2, 2], titles)).toEqual({
            changed: [
                'removed line 2 "Next: Timeout (5)"',
                'removed line 4 "Clear Long Text"',
            ],
        });
        expect(sheet.map((one) => one.uuid)).toEqual(['sermon-1', 'clear']);
        expect(sheet[0].ccItems).toEqual([{ uuid: 'clear' }]);
        expect(sheet[0].slideCcItems).toEqual({ '102': [{ uuid: 'clear' }] });
        applyAgentFlowRemoval(sheet, [2], ['Sermon', 'Clear All']);
        expect(sheet).toHaveLength(1);
        expect(sheet[0]).not.toHaveProperty('ccItems');
        expect(sheet[0]).not.toHaveProperty('slideCcItems');
    });
});
