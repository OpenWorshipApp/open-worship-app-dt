import { describe, expect, test } from 'vitest';

import {
    FLOW_EDIT_TOOL_NAME,
    FLOW_WORDLESS_HINT,
    checkIsFlowFileName,
    findFlowAskFiles,
    findOpenFlowAttachments,
    genFlowOpeningAnswer,
    pickOpenDocumentKind,
    readFlowButtonHint,
    resolveFlowEditFile,
    toFlowAsk,
    toFlowFileText,
    toFlowName,
    toFlowSheetText,
} from './flowChatHelpers';

const FLOW = 'C:\\data\\presenting-flows\\Sunday.owpf';

function genFile(filePath: string, id = 1) {
    return {
        id,
        kind: 'text',
        name: filePath.split(/[\\/]/).pop(),
        filePath,
    } as any;
}

describe('a presenting flow by its name', () => {
    test('is a `.owpf`, named without it', () => {
        expect(checkIsFlowFileName('Sunday.owpf')).toBe(true);
        expect(checkIsFlowFileName('Sunday.ows')).toBe(false);
        expect(toFlowName(FLOW)).toBe('Sunday');
    });

    test('its attachment is a line a line, never the JSON', () => {
        const text = toFlowFileText(
            JSON.stringify({
                items: [
                    { type: 'appDocument', title: 'Amazing Grace' },
                    { type: 'action', data: 'clear-all' },
                ],
                metadata: {},
            }),
        );
        expect(text).toBe(
            'Lines: 2\nLine 1: Amazing Grace [appDocument]\nLine 2: action: clear-all',
        );
        expect(toFlowFileText('not json')).toBeNull();
        expect(toFlowFileText('{"slides": []}')).toBeNull();
    });
});

describe('which flow a question is about', () => {
    test('the flows among the files, once each', () => {
        expect(
            findFlowAskFiles([
                genFile(FLOW),
                genFile(FLOW, 2),
                genFile('C:\\pics\\bulletin.png', 3),
            ]),
        ).toEqual([{ name: 'Sunday', filePath: FLOW }]);
    });

    test('stays open past a picture of the bulletin attached after it', () => {
        const messages = [
            { id: 1, author: 'you', attachments: [genFile(FLOW)] },
            { id: 2, author: 'bot' },
            {
                id: 3,
                author: 'you',
                attachments: [genFile('C:\\pics\\bulletin.png', 4)],
            },
        ];
        expect(findOpenFlowAttachments(messages)).toHaveLength(1);
        expect(findOpenFlowAttachments(messages, 1)).toEqual([]);
    });

    test('the newer of a flow and slides is the one open', () => {
        const slides = genFile('C:\\docs\\Sermon.ows', 5);
        expect(
            pickOpenDocumentKind([
                { id: 1, author: 'you', attachments: [slides] },
                { id: 2, author: 'you', attachments: [genFile(FLOW)] },
            ]),
        ).toBe('flow');
        expect(
            pickOpenDocumentKind([
                { id: 1, author: 'you', attachments: [genFile(FLOW)] },
                { id: 2, author: 'you', attachments: [slides] },
            ]),
        ).toBe('slide');
        expect(pickOpenDocumentKind([{ id: 1, author: 'you' }])).toBeNull();
    });

    test('a name the model gives becomes the path; a path it writes is refused', () => {
        const files = [{ name: 'Sunday', filePath: FLOW }];
        expect(resolveFlowEditFile('Sunday', files)).toEqual({
            filePath: FLOW,
        });
        expect(resolveFlowEditFile('', files)).toEqual({ filePath: FLOW });
        expect(resolveFlowEditFile('C:\\x\\Other.owpf', files)).toHaveProperty(
            'reason',
        );
    });
});

describe('the sheet as the model reads it', () => {
    test('lines, CCs, slides, problems and the choices', () => {
        const text = toFlowSheetText({
            name: 'Sunday',
            count: 2,
            screens: [0, 1],
            lines: [
                {
                    n: 1,
                    title: 'Amazing Grace',
                    kind: 'document',
                    document: 'Amazing Grace',
                    color: 'blue',
                    cc: [
                        {
                            n: 1,
                            follows: 2,
                            title: 'Next: Timeout (8)',
                            seconds: 4,
                        },
                    ],
                    slides: { count: 5, parked: [3] },
                },
                {
                    n: 2,
                    title: 'Next: Timeout (8)',
                    kind: 'action:next-timeout',
                    seconds: 8,
                    ccOf: [1],
                    problems: ['it goes nowhere yet'],
                },
            ],
            documentChoices: ['Amazing Grace', 'Sermon'],
            isDocumentChoicesTruncated: true,
            actions: ['clear-all: Clear All'],
            foregroundWidgets: ['countdown: seconds'],
        });
        expect(text).toContain('Lines: 2 · screens: 0, 1');
        expect(text).toContain(
            'Line 1: "Amazing Grace" (document; document "Amazing Grace"; color blue)',
        );
        expect(text).toContain(
            '  CC (shown with this line): 1. "Next: Timeout (8)" (its element is line 2, 4 seconds)',
        );
        expect(text).toContain('  Slides: 5 slides; parked slides 3');
        expect(text).toContain('  PROBLEM: it goes nowhere yet');
        expect(text).toContain(
            'the element of the CC on line 1 -- needed, keep it',
        );
        expect(text).toContain(
            'Documents: "Amazing Grace", "Sermon", and more',
        );
        expect(text).toContain('Actions: clear-all: Clear All');
        expect(toFlowSheetText(null)).toBeNull();
    });
});

describe('the ask and the card', () => {
    test('a pressed button carries its job; the flow reads under it', () => {
        const ask = toFlowAsk('Clear the screen between items', [
            { name: 'Sunday', text: 'Lines: 0' },
        ]);
        expect(ask).toContain('clear-all action after every document');
        expect(ask).toContain(
            `Change it with ${FLOW_EDIT_TOOL_NAME}, file "Sunday".`,
        );
        expect(readFlowButtonHint('What is on line 2?')).toBeNull();
        // The button's words leading a pasted order still carry its job.
        expect(
            readFlowButtonHint(
                'Build it from my order of service:\n1. Welcome\n2. Sermon',
            ),
        ).toContain('LEFT OUT of the call');
        expect(readFlowButtonHint('Move on by itselfish words')).toBeNull();
        expect(readFlowButtonHint('Move on by itself')).toContain(
            'Next: Timeout',
        );
    });

    test('a send with no words builds from what was attached', () => {
        expect(toFlowAsk('', [{ name: 'Sunday', text: null }], true)).toContain(
            FLOW_WORDLESS_HINT,
        );
    });

    test('the card names the flow and offers the four jobs', () => {
        const opening = genFlowOpeningAnswer('Sunday.owpf');
        expect(opening.text).toContain('“Sunday” is attached below.');
        expect(opening.replies).toEqual([
            'Check the running order',
            'Build it from my order of service',
            'Clear the screen between items',
            'Move on by itself',
        ]);
    });
});
