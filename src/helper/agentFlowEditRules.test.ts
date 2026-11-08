import { beforeEach, describe, expect, test, vi } from 'vitest';

// The batch the help window's assistant changes a presenting flow with
// (`agentFlowEditRules.ts`), run on plain json against the REAL action
// registry and the real `PresentingFlowItem` rules -- only what reaches the
// app (a file's name, the language, the screen managers' bundle) is stood in.

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

function genSheet(): any[] {
    return [
        {
            type: 'appDocument',
            uuid: 'song-1',
            filePath: '/documents/Amazing Grace.owl',
            data: '/documents/Amazing Grace.owl',
            title: 'Amazing Grace',
        },
        {
            type: 'bibleItem',
            uuid: 'verse-1',
            data: { key: 'JHN 3:16' },
            title: 'John 3:16',
        },
        {
            type: 'appDocument',
            uuid: 'sermon-1',
            filePath: '/documents/Sermon.ows',
            data: '/documents/Sermon.ows',
            title: 'Sermon',
        },
    ];
}

const TITLES = ['Amazing Grace', 'John 3:16', 'Sermon'];

function toShape(list: any[]) {
    return list.map((one) => {
        return one.type === 'action' ? `action:${one.data}` : one.title;
    });
}

beforeEach(() => {
    uuidIndex = 0;
});

describe('a batch names lines as they were read', () => {
    test('a clear after every line, given in one call, lands after each', () => {
        const sheet = genSheet();
        const result = applyAgentFlowChanges(
            sheet,
            [
                { add: { actionId: 'clear-all' }, after: 1 },
                { add: { actionId: 'clear-all' }, after: 2 },
                { add: { actionId: 'clear-all' }, after: 3 },
            ],
            genPrepared(TITLES),
        );
        expect('changed' in result).toBe(true);
        expect(toShape(sheet)).toEqual([
            'Amazing Grace',
            'action:clear-all',
            'John 3:16',
            'action:clear-all',
            'Sermon',
            'action:clear-all',
        ]);
    });

    test('two adds after the same line keep the order they were given in', () => {
        const sheet = genSheet();
        applyAgentFlowChanges(
            sheet,
            [
                { add: { actionId: 'clear-slide' }, after: 1 },
                { add: { actionId: 'clear-bible' }, after: 1 },
            ],
            genPrepared(TITLES),
        );
        expect(toShape(sheet).slice(0, 3)).toEqual([
            'Amazing Grace',
            'action:clear-slide',
            'action:clear-bible',
        ]);
    });

    test('`after: 0` is the top and no `after` is the end', () => {
        const sheet = genSheet();
        applyAgentFlowChanges(
            sheet,
            [
                { add: { actionId: 'clear-all' }, after: 0 },
                { add: { actionId: 'clear-bible' } },
            ],
            genPrepared(TITLES),
        );
        expect(toShape(sheet)).toEqual([
            'action:clear-all',
            'Amazing Grace',
            'John 3:16',
            'Sermon',
            'action:clear-bible',
        ]);
    });

    test('a move then a number still means the line as read', () => {
        const sheet = genSheet();
        applyAgentFlowChanges(
            sheet,
            [
                { line: 3, after: 0 },
                { line: 3, color: 'blue' },
            ],
            genPrepared(TITLES),
        );
        expect(toShape(sheet)).toEqual([
            'Sermon',
            'Amazing Grace',
            'John 3:16',
        ]);
        expect(sheet[0].colorNote).toBe('#0000FF');
    });

    test('a timeout is armed with the question default when no seconds are given', () => {
        const sheet = genSheet();
        applyAgentFlowChanges(
            sheet,
            [{ add: { actionId: 'next-timeout' } }],
            genPrepared(TITLES),
        );
        expect(sheet.at(-1)).toMatchObject({
            type: 'action',
            data: 'next-timeout',
            actionNumber: 10,
        });
    });
});

describe('a refusal anywhere refuses the lot', () => {
    test('an unknown action id names where to look', () => {
        const sheet = genSheet();
        const result = applyAgentFlowChanges(
            sheet,
            [
                { add: { actionId: 'clear-all' }, after: 1 },
                { add: { actionId: 'make-coffee' } },
            ],
            genPrepared(TITLES),
        );
        expect(result).toEqual({
            reason: expect.stringContaining('"make-coffee" is not an action'),
        });
    });

    test('a shortcut already used by another line is refused', () => {
        const sheet = [
            ...genSheet(),
            {
                type: 'action',
                uuid: 'key-1',
                data: 'keyboard-event',
                actionKey: 'Ctrl+A',
            },
        ];
        const result = applyAgentFlowChanges(
            sheet,
            [{ add: { actionId: 'keyboard-event', key: 'ctrl+a' } }],
            genPrepared([...TITLES, 'Keyboard Event (Ctrl+A)']),
        );
        expect(result).toEqual({
            reason: expect.stringContaining('Ctrl+A is already used'),
        });
    });

    test('Screen: Show has to name its screens, and only known ones', () => {
        expect(
            applyAgentFlowChanges(
                genSheet(),
                [{ add: { actionId: 'screen-show' } }],
                genPrepared(TITLES),
            ),
        ).toEqual({
            reason: expect.stringContaining('has to name the screens'),
        });
        expect(
            applyAgentFlowChanges(
                genSheet(),
                [{ add: { actionId: 'screen-show', screenIds: [7] } }],
                genPrepared(TITLES),
            ),
        ).toEqual({ reason: expect.stringContaining('no screen 7') });
    });

    test('a passage is not armed with seconds', () => {
        expect(
            applyAgentFlowChanges(
                genSheet(),
                [{ line: 2, seconds: 5 }],
                genPrepared(TITLES),
            ),
        ).toEqual({ reason: expect.stringContaining('not armed') });
    });

    test('nothing to change is said so', () => {
        expect(
            applyAgentFlowChanges(
                genSheet(),
                [{ line: 1 }],
                genPrepared(TITLES),
            ),
        ).toEqual({ reason: expect.stringContaining('changes anything') });
    });
});

describe('lines changed in place', () => {
    test('a copy is re-keyed and loses its shortcut', () => {
        const sheet = [
            {
                type: 'action',
                uuid: 'key-1',
                data: 'keyboard-event',
                actionKey: 'Shift+F5',
                colorNote: '#FF0000',
            },
        ];
        applyAgentFlowChanges(
            sheet as any,
            [{ line: 1, copy: true }],
            genPrepared(['Keyboard Event']),
        );
        expect(sheet).toHaveLength(2);
        expect(sheet[1].uuid).not.toBe('key-1');
        expect(sheet[1].actionKey).toBeUndefined();
        expect(sheet[1].colorNote).toBe('#FF0000');
    });

    test('a timeout re-armed with a time of day drops its seconds', () => {
        const sheet: any[] = [
            {
                type: 'action',
                uuid: 't',
                data: 'next-timeout',
                actionNumber: 6,
            },
        ];
        applyAgentFlowChanges(
            sheet,
            [{ line: 1, time: '7:05' }],
            genPrepared(['Next: Timeout (6)']),
        );
        expect(sheet[0].actionTime).toBe('07:05');
        expect(sheet[0].actionNumber).toBeUndefined();
    });

    test('parking, a colour and a pin, and taking them off again', () => {
        const sheet = genSheet();
        applyAgentFlowChanges(
            sheet,
            [{ line: 1, park: true, color: 'lime', screenIds: [1] }],
            genPrepared(TITLES),
        );
        expect(sheet[0]).toMatchObject({
            isDisabled: true,
            colorNote: '#00FF00',
            screenIds: [1],
        });
        applyAgentFlowChanges(
            sheet,
            [{ line: 1, park: false, color: 'none', screenIds: [] }],
            genPrepared(TITLES),
        );
        expect(sheet[0].isDisabled).toBeUndefined();
        expect(sheet[0].colorNote).toBeUndefined();
        expect(sheet[0].screenIds).toBeUndefined();
    });

    test("a document's slides parked and pinned by number", () => {
        const sheet = genSheet();
        const result = applyAgentFlowChanges(
            sheet,
            [
                {
                    line: 3,
                    slides: [
                        { slide: 2, park: true },
                        { slide: 1, screenIds: [0] },
                    ],
                },
            ],
            genPrepared(TITLES, {
                slideIdListMap: new Map([[3, [101, 102, 103]]]),
            }),
        );
        expect('changed' in result).toBe(true);
        expect(sheet[2].disabledSlideIds).toEqual([102]);
        expect(sheet[2].slideScreenIds).toEqual({ '101': [0] });
    });

    test('a countdown line is changed and its look kept', () => {
        const sheet: any[] = [
            {
                type: 'foreground',
                uuid: 'fg',
                data: {
                    target: 'countdown',
                    data: {
                        durationSecond: 301,
                        isAutoStart: true,
                        extraStyle: { color: 'red' },
                    },
                },
                title: 'Countdown: 5m',
            },
        ];
        applyAgentFlowChanges(
            sheet,
            [{ line: 1, foreground: { seconds: 600 } }],
            genPrepared(['Countdown: 5m']),
        );
        expect(sheet[0].data.data).toEqual({
            durationSecond: 601,
            isAutoStart: true,
            extraStyle: { color: 'red' },
        });
    });

    test('a new countdown borrows the look of the last one', () => {
        const sheet: any[] = [
            {
                type: 'foreground',
                uuid: 'fg',
                data: {
                    target: 'countdown',
                    data: { durationSecond: 301, extraStyle: { color: 'red' } },
                },
            },
        ];
        applyAgentFlowChanges(
            sheet,
            [{ add: { foreground: { widget: 'countdown', seconds: 120 } } }],
            genPrepared(['Countdown: 5m']),
        );
        expect(sheet[1].data).toEqual({
            target: 'countdown',
            data: {
                durationSecond: 121,
                isAutoStart: true,
                extraStyle: { color: 'red' },
            },
        });
    });

    test("a camera is the panel's to drag in, never words", () => {
        expect(
            applyAgentFlowChanges(
                genSheet(),
                [{ add: { foreground: { widget: 'camera' } } }],
                genPrepared(TITLES),
            ),
        ).toEqual({ reason: expect.stringContaining('Foreground panel') });
    });
});

describe('CC elements', () => {
    test('a timeout CC on a song reuses a timeout line armed the same way', () => {
        const sheet: any[] = [
            ...genSheet(),
            {
                type: 'action',
                uuid: 'wait-8',
                data: 'next-timeout',
                actionNumber: 8,
            },
        ];
        applyAgentFlowChanges(
            sheet,
            [
                {
                    line: 1,
                    cc: { add: { actionId: 'next-timeout', seconds: 8 } },
                },
            ],
            genPrepared([...TITLES, 'Next: Timeout (8)']),
        );
        expect(sheet).toHaveLength(4);
        expect(sheet[0].ccItems).toEqual([{ uuid: 'wait-8' }]);
    });

    test('with none to reuse, the timeout line is added at the end', () => {
        const sheet = genSheet();
        const result = applyAgentFlowChanges(
            sheet,
            [
                {
                    line: 1,
                    cc: { add: { actionId: 'next-timeout', seconds: 5 } },
                },
                {
                    line: 3,
                    cc: { add: { actionId: 'next-timeout', seconds: 5 } },
                },
            ],
            genPrepared(TITLES),
        );
        expect('changed' in result).toBe(true);
        // One line for both: the second found the first one's.
        expect(toShape(sheet)).toEqual([...TITLES, 'action:next-timeout']);
        expect(sheet[0].ccItems[0].uuid).toBe(sheet[3].uuid);
        expect(sheet[2].ccItems[0].uuid).toBe(sheet[3].uuid);
    });

    test('a line that already goes on by itself is not given a second timeout', () => {
        const sheet: any[] = [
            { ...genSheet()[0], ccItems: [{ uuid: 'wait-6' }] },
            {
                type: 'action',
                uuid: 'wait-6',
                data: 'next-timeout',
                actionNumber: 6,
            },
        ];
        expect(
            applyAgentFlowChanges(
                sheet,
                [
                    {
                        line: 1,
                        cc: { add: { actionId: 'next-timeout', seconds: 8 } },
                    },
                ],
                genPrepared(['Amazing Grace', 'Next: Timeout (6)']),
            ),
        ).toEqual({
            reason: expect.stringContaining('cc {index: 1, seconds}'),
        });
    });

    test('an interval never follows a line', () => {
        expect(
            applyAgentFlowChanges(
                genSheet(),
                [
                    {
                        line: 1,
                        cc: { add: { actionId: 'next-interval', seconds: 5 } },
                    },
                ],
                genPrepared(TITLES),
            ),
        ).toEqual({ reason: expect.stringContaining('cannot ride along') });
    });

    test('a Jump to names one line, and a document may be it', () => {
        const sheet = genSheet();
        applyAgentFlowChanges(
            sheet,
            [{ add: { actionId: 'jump-to', target: 1 } }],
            genPrepared(TITLES),
        );
        expect(sheet.at(-1).ccItems).toEqual([{ uuid: 'song-1' }]);
        expect(
            applyAgentFlowChanges(
                sheet,
                [{ line: 4, cc: { add: { line: 2 } } }],
                genPrepared([...TITLES, 'Jump to']),
            ),
        ).toEqual({ reason: expect.stringContaining('only one CC') });
    });

    test('a Slide: Media Control is added only as a CC, with its settings', () => {
        const sheet = genSheet();
        expect(
            applyAgentFlowChanges(
                sheet,
                [{ add: { actionId: 'slide-media-control' } }],
                genPrepared(TITLES),
            ),
        ).toEqual({ reason: expect.stringContaining('only as a CC') });
        applyAgentFlowChanges(
            sheet,
            [
                {
                    line: 3,
                    cc: {
                        add: { actionId: 'slide-media-control' },
                        mediaControl: { mode: 'play', volume: 80 },
                    },
                },
            ],
            genPrepared(TITLES),
        );
        expect(sheet[2].ccItems[0]).toMatchObject({
            mediaControl: { mode: 'play', volume: 80 },
        });
        expect(sheet.at(-1).data).toBe('slide-media-control');
    });

    test('a CC is re-armed, pinned and taken off by its number', () => {
        const sheet: any[] = [
            { ...genSheet()[0], ccItems: [{ uuid: 'wait' }] },
            {
                type: 'action',
                uuid: 'wait',
                data: 'next-timeout',
                actionNumber: 8,
            },
        ];
        applyAgentFlowChanges(
            sheet,
            [{ line: 1, cc: { index: 1, seconds: 4, screenIds: [1] } }],
            genPrepared(['Amazing Grace', 'Next: Timeout (8)']),
        );
        expect(sheet[0].ccItems).toEqual([
            { uuid: 'wait', screenIds: [1], actionArming: { actionNumber: 4 } },
        ]);
        applyAgentFlowChanges(
            sheet,
            [{ line: 1, cc: { index: 1, remove: true } }],
            genPrepared(['Amazing Grace', 'Next: Timeout (8)']),
        );
        expect(sheet[0].ccItems).toBeUndefined();
    });
});

describe('remove-lines', () => {
    test('lines go, and so does whatever followed them', () => {
        const sheet: any[] = [
            { ...genSheet()[0], ccItems: [{ uuid: 'verse-1' }] },
            genSheet()[1],
            genSheet()[2],
        ];
        const result = applyAgentFlowRemoval(sheet, [2, 3], TITLES);
        expect(result).toEqual({
            changed: ['removed line 2 "John 3:16"', 'removed line 3 "Sermon"'],
        });
        expect(sheet).toHaveLength(1);
        expect(sheet[0].ccItems).toBeUndefined();
    });

    test('a number past the sheet is refused', () => {
        expect(applyAgentFlowRemoval(genSheet(), [4], TITLES)).toEqual({
            reason: expect.stringContaining('1 to 3'),
        });
    });
});

describe('what the worker has to read first', () => {
    test('documents, passages and slide maps by change', () => {
        const needs = readAgentFlowChangeNeeds(
            [
                { add: { document: 'Welcome' } },
                { add: { reference: 'Psalm 23', version: 'KJV' } },
                { line: 3, slides: [{ slide: 1, park: true }] },
                { line: 1, cc: { slide: 2, add: { line: 2 } } },
            ],
            3,
        );
        expect(needs).toEqual({
            documentMap: new Map([[0, 'Welcome']]),
            referenceMap: new Map([
                [1, { reference: 'Psalm 23', version: 'KJV' }],
            ]),
            slideLineSet: new Set([3, 1]),
        });
    });

    test('an add and a line in one change, or a line past the end, is refused', () => {
        expect(
            readAgentFlowChangeNeeds([{ add: { actionId: 'x' }, line: 1 }], 3),
        ).toEqual({ reason: expect.stringContaining('both') });
        expect(readAgentFlowChangeNeeds([{ line: 9, park: true }], 3)).toEqual({
            reason: expect.stringContaining('1 to 3'),
        });
        expect(readAgentFlowChangeNeeds([], 3)).toEqual({
            reason: expect.stringContaining('list of changes'),
        });
    });
});

describe('the small readers', () => {
    test('a shortcut in any spelling becomes the stored one', () => {
        expect(toAgentFlowActionKey('ctrl + shift + a')).toBe('Ctrl+Shift+A');
        expect(toAgentFlowActionKey('Shift+Ctrl+f5')).toBe('Ctrl+Shift+F5');
        expect(toAgentFlowActionKey('Alt+A')).toBeNull();
    });

    test('colours by name, by code, and none', () => {
        expect(toAgentFlowColorNote('Blue')).toEqual({ colorNote: '#0000FF' });
        expect(toAgentFlowColorNote('#00ff00')).toEqual({
            colorNote: '#00FF00',
        });
        expect(toAgentFlowColorNote('none')).toEqual({ colorNote: null });
        expect(toAgentFlowColorNote('sparkly')).toHaveProperty('reason');
        expect(toAgentFlowColorName('#0000ff')).toBe('blue');
        expect(toAgentFlowColorName('#123456')).toBe('#123456');
    });
});
