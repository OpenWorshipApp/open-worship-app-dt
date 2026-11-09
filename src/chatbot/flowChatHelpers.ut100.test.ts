import { describe, expect, test } from 'vitest';

import {
    pickOpenDocumentKind,
    toFlowFileText,
    toFlowSheetText,
} from './flowChatHelpers';

// The sheet a presenting-flow conversation shows the model, past what
// `flowChatHelpers.test.ts` reads: slides pinned and carrying CCs, a slide
// list, an empty or a cut sheet, and the arming facts of each line.

const FLOW = 'C:\\data\\presenting-flows\\Sunday.owpf';

function genFile(filePath: string, id = 1) {
    return {
        id,
        kind: 'text',
        name: filePath.split(/[\\/]/).pop(),
        filePath,
    } as any;
}

describe('which document a tab is about', () => {
    test('nothing since the files were closed is no kind at all', () => {
        const messages = [
            { id: 1, author: 'you', attachments: [genFile(FLOW)] },
            { id: 2, author: 'bot' },
            { id: 3, author: 'you' },
        ];
        // Walking back reaches the close before it reaches the flow.
        expect(pickOpenDocumentKind(messages, 2)).toBeNull();
        // Without the close, the flow is still the one open.
        expect(pickOpenDocumentKind(messages)).toBe('flow');
    });

    test('a flow wins over slides attached on the same question', () => {
        expect(
            pickOpenDocumentKind([
                {
                    id: 1,
                    author: 'you',
                    attachments: [
                        genFile(FLOW),
                        genFile('C:\\docs\\Sermon.ows', 2),
                    ],
                },
            ]),
        ).toBe('flow');
    });
});

describe('the sheet as the model reads it', () => {
    test("a document's slides: pinned, their CCs and the slide list", () => {
        const text = toFlowSheetText({
            count: 1,
            screens: [],
            lines: [
                {
                    n: 1,
                    title: 'Sermon',
                    kind: 'document',
                    slides: {
                        count: 3,
                        pinned: [
                            { slide: 1, screenIds: [0] },
                            { slide: 2, screenIds: [0, 1] },
                        ],
                        cc: [
                            {
                                slide: 2,
                                cc: [
                                    {
                                        n: 1,
                                        follows: 4,
                                        title: 'Slide: Media Control',
                                        mediaControl: {
                                            mode: 'play',
                                            volume: 80,
                                        },
                                    },
                                    {
                                        n: 2,
                                        follows: null,
                                        title: 'a line that is gone',
                                    },
                                ],
                            },
                        ],
                        list: ['1: Title', '2', '3: End'],
                    },
                },
            ],
        });
        const lines = (text ?? '').split('\n');
        // No screens: the head says the count alone.
        expect(lines[0]).toBe('Lines: 1');
        expect(lines).toContain(
            '  Slides: 3 slides; slide 1 on screen 0, slide 2 on screen 0, 1',
        );
        expect(lines).toContain(
            '  Slide 2 CC: 1. "Slide: Media Control" (its element is line 4, ' +
                'media {"mode":"play","volume":80}); 2. "a line that is gone" ' +
                '(its element is a line that is gone)',
        );
        expect(lines).toContain('  Slide list: 1: Title | 2 | 3: End');
    });

    test("every line's arming and pins are said; a string media mode as is", () => {
        const text = toFlowSheetText({
            count: 3,
            lines: [
                {
                    n: 1,
                    title: 'Next: Timeout',
                    kind: 'action:next-timeout',
                    time: '19:05',
                    isParked: true,
                    screenIds: [1],
                },
                {
                    n: 2,
                    title: 'Keyboard Event',
                    kind: 'action:keyboard-event',
                    key: 'Ctrl+Shift+A',
                    cc: [
                        {
                            n: 1,
                            follows: 3,
                            title: 'Clear All',
                            screenIds: [0],
                            time: '07:30',
                            mediaControl: 'stop',
                        },
                    ],
                },
                {
                    n: 3,
                    title: 'Jump to',
                    kind: 'action:jump-to',
                    goesTo: 1,
                },
            ],
        });
        expect(text).toContain(
            'Line 1: "Next: Timeout" (action:next-timeout; parked; at 19:05; ' +
                'pinned to screen 1)',
        );
        expect(text).toContain(
            'Line 2: "Keyboard Event" (action:keyboard-event; key Ctrl+Shift+A)',
        );
        expect(text).toContain(
            '  CC (shown with this line): 1. "Clear All" (its element is ' +
                'line 3, screen 0, at 07:30, media stop)',
        );
        expect(text).toContain(
            'Line 3: "Jump to" (action:jump-to; goes to line 1)',
        );
    });

    test('a sheet with no lines says so, and a cut one says there is more', () => {
        expect(toFlowSheetText({ count: 0, lines: [] })).toBe(
            'Lines: 0\n(no lines yet)',
        );
        // No `lines` at all reads as none, its count from the list.
        expect(toFlowSheetText({})).toBe('Lines: 0\n(no lines yet)');
        const cut = toFlowSheetText({
            count: 250,
            lines: [{ n: 1, title: 'Welcome', kind: 'document' }],
            isTruncated: true,
            documentChoices: [],
        });
        expect(cut).toContain('Lines: 250');
        expect(cut).toContain('… more lines than shown');
        expect(cut).toContain('Documents: (none)');
    });

    test('a sheet past what a question may carry is cut and says so', () => {
        const lines = Array.from({ length: 400 }, (_value, index) => {
            return {
                n: index + 1,
                title: `A song with a long enough title number ${index + 1}`,
                kind: 'document',
            };
        });
        const text = toFlowSheetText({ count: lines.length, lines }) ?? '';
        expect(text.endsWith('\n[... the rest was not included]')).toBe(true);
        expect(text.length).toBe(
            14000 + '\n[... the rest was not included]'.length,
        );
    });

    test('anything not an object reads as nothing', () => {
        expect(toFlowSheetText('lines')).toBeNull();
        expect(toFlowSheetText(undefined)).toBeNull();
    });
});

describe('the attachment of a flow file', () => {
    test('a line with no title is named by its kind', () => {
        expect(
            toFlowFileText(
                JSON.stringify({
                    items: [{ type: 'bibleItem', title: '  ' }, {}],
                }),
            ),
        ).toBe('Lines: 2\nLine 1: bibleItem\nLine 2: line');
    });

    test('a long sheet is cut where the attachment stops', () => {
        const items = Array.from({ length: 300 }, (_value, index) => {
            return { type: 'appDocument', title: `Song number ${index + 1}` };
        });
        const text = toFlowFileText(JSON.stringify({ items })) ?? '';
        expect(text.endsWith('\n[…]')).toBe(true);
        expect(text.length).toBe(6000 + '\n[…]'.length);
        expect(text.startsWith('Lines: 300\nLine 1: Song number 1')).toBe(true);
    });
});
