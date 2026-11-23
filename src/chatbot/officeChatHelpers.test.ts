import { describe, expect, test } from 'vitest';

import type { ChatAttachmentType } from './attachmentHelpers';
import { DEFAULT_CHAT_LANG_CODE } from './chatLangHelpers';
import {
    MAX_OFFICE_ASK_FILES,
    OFFICE_EDIT_TOOL_NAME,
    OFFICE_SYSTEM_PROMPT,
    OFFICE_WORDLESS_HINT,
    checkHasOpenDeck,
    checkIsOfficeEditFileName,
    checkIsOfficeOpenedLast,
    findOfficeAskFiles,
    findOfficeAskPictures,
    genOfficeOpeningAnswer,
    resolveOfficeEditFile,
    resolveOfficePictures,
    toOfficeAsk,
    toOfficeDocumentText,
    findOfficeMisplacedBox,
    findOfficeUnwrittenEverywhere,
    genOfficeMisplacedBoxReason,
    genOfficeUnwrittenEverywhereReason,
    liftOfficeNestedReplaces,
} from './officeChatHelpers';

const DECK = '/Users/a/documents/Sunday Service.pptx';
const LETTER = 'C:\\data\\documents\\Letter.docx';
const ENGLISH = {
    code: DEFAULT_CHAT_LANG_CODE,
    name: 'English',
    nativeName: 'English',
} as any;

function genFile(filePath: string) {
    return {
        id: filePath,
        kind: 'file',
        name: filePath.split(/[\\/]/).pop(),
        filePath,
    } as unknown as ChatAttachmentType;
}

describe('which files', () => {
    test('a .pptx or a .docx, never an older .ppt or a slide document', () => {
        expect(checkIsOfficeEditFileName(DECK)).toBe(true);
        expect(checkIsOfficeEditFileName(LETTER)).toBe(true);
        expect(checkIsOfficeEditFileName('Old.PPTX ')).toBe(true);
        expect(checkIsOfficeEditFileName('Old.ppt')).toBe(false);
        expect(checkIsOfficeEditFileName('Old.doc')).toBe(false);
        expect(checkIsOfficeEditFileName('Sermon.ows')).toBe(false);
    });

    test('the tab’s files, once each, named with their extension', () => {
        expect(
            findOfficeAskFiles([
                genFile(DECK),
                genFile('/x/Song.owl'),
                genFile(DECK),
                genFile(LETTER),
                genFile('/x/third.docx'),
            ]),
        ).toEqual([
            { name: 'Sunday Service.pptx', filePath: DECK },
            { name: 'Letter.docx', filePath: LETTER },
        ]);
        expect(MAX_OFFICE_ASK_FILES).toBe(2);
    });

    test('opened last: the latest question carrying a file decides', () => {
        const messages = [
            { id: 1, author: 'you', attachments: [genFile('/x/Song.owl')] },
            { id: 2, author: 'bot' },
            { id: 3, author: 'you', attachments: [genFile(DECK)] },
            { id: 4, author: 'you' },
        ];
        expect(checkIsOfficeOpenedLast(messages)).toBe(true);
        expect(checkIsOfficeOpenedLast(messages, 3)).toBe(false);
        expect(
            checkIsOfficeOpenedLast([
                ...messages,
                { id: 5, author: 'you', attachments: [genFile('/x/a.owpf')] },
            ]),
        ).toBe(false);
    });
});

describe('what a model’s `file` turns into', () => {
    const files = [
        { name: 'Sunday Service.pptx', filePath: DECK },
        { name: 'Letter.docx', filePath: LETTER },
    ];

    test('the attached file, with its extension or without', () => {
        expect(resolveOfficeEditFile('Sunday Service.pptx', files)).toEqual({
            filePath: DECK,
        });
        expect(resolveOfficeEditFile('sunday  service', files)).toEqual({
            filePath: DECK,
        });
        expect(resolveOfficeEditFile('', [files[1]])).toEqual({
            filePath: LETTER,
        });
    });

    test('never a path; another of the Documents by its name', () => {
        expect(resolveOfficeEditFile(DECK, files)).toHaveProperty('reason');
        expect(resolveOfficeEditFile('', files)).toHaveProperty('reason');
        expect(resolveOfficeEditFile('Other.pptx', files)).toEqual({
            name: 'Other.pptx',
        });
    });
});

describe('the file as the model reads it', () => {
    test('a deck: slides, ids, boxes, notes, and where to read on', () => {
        const text = toOfficeDocumentText({
            kind: 'PowerPoint',
            slideCount: 3,
            slides: [
                {
                    slide: 1,
                    lines: [
                        { id: '1.1', box: 'title', text: 'Welcome' },
                        { id: '1.2', box: 'body', text: 'line one\nline two' },
                        { id: '1.3', text: '' },
                    ],
                    note: 'Smile',
                    boxes: [
                        {
                            name: 'Picture 2',
                            kind: 'picture',
                            at: [0, 0, 100, 100],
                            fills: true,
                        },
                        { name: 'Title 1', at: [5, 2.5, 90, 15], lines: '1.1' },
                    ],
                    transition: { kind: 'fade', advance: 5 },
                },
                { slide: 2, hidden: true, lines: [] },
            ],
            nextStart: 3,
        });
        expect(text).toBe(
            [
                "PowerPoint · 3 slides (a box's place: at [x, y, width, " +
                    'height] in % of the slide)',
                '',
                'Slide 1',
                '  1.1 [title] "Welcome"',
                '  1.2 [body] "line one\\nline two"',
                '  1.3 ""',
                '  box "Picture 2" (picture; fills the slide, in front of its ' +
                    'background) at [0, 0, 100, 100]',
                '  box "Title 1" at [5, 2.5, 90, 15] holds 1.1',
                '  transition fade, goes on by itself after 5 s',
                '  speaker notes: "Smile"',
                '',
                'Slide 2 (hidden in the show)',
                '  (no words)',
                `[... the rest was not included; ${OFFICE_EDIT_TOOL_NAME} "read" with start 3 reads on]`,
            ].join('\n'),
        );
    });

    test("a deck's layouts, a table's size, a chart's data, an animation", () => {
        // EC-771: what the model needs to name a layout, a row, a series
        expect(
            toOfficeDocumentText({
                kind: 'PowerPoint',
                slideCount: 1,
                layouts: ['Title Slide', 'Blank'],
                slides: [
                    {
                        slide: 1,
                        lines: [{ id: '1.1', box: 'Title 1', text: 'Plan' }],
                        boxes: [
                            {
                                name: 'Title 1',
                                at: [5, 2, 90, 15],
                                lines: '1.1',
                                animation: 'fly, line by line',
                            },
                            {
                                name: 'Table 2',
                                kind: 'table',
                                at: [10, 20, 80, 40],
                                rows: 4,
                                columns: 2,
                            },
                            {
                                name: 'Chart 3',
                                kind: 'chart',
                                at: [10, 60, 80, 30],
                                chart: {
                                    kind: 'bar',
                                    title: 'Giving',
                                    categories: ['Jan', 'Feb'],
                                    series: [
                                        { name: '2026', values: [1, null] },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }),
        ).toBe(
            [
                "PowerPoint · 1 slides (a box's place: at [x, y, width, " +
                    'height] in % of the slide)',
                'layouts: "Title Slide", "Blank"',
                '',
                'Slide 1',
                '  1.1 [Title 1] "Plan"',
                '  box "Title 1" at [5, 2, 90, 15] holds 1.1, comes in: fly, ' +
                    'line by line',
                '  box "Table 2" (table) at [10, 20, 80, 40], 4 rows x 2 columns',
                '  box "Chart 3" (chart) at [10, 60, 80, 30]',
                '    chart bar, title "Giving", categories ["Jan","Feb"]; ' +
                    'series 0 "2026" [1,null]',
            ].join('\n'),
        );
    });

    test('a Word file: lines with their style and tables', () => {
        expect(
            toOfficeDocumentText({
                kind: 'Word',
                lineCount: 2,
                lines: [
                    { id: '1', style: 'Title', text: 'News' },
                    { id: '2', table: true, text: 'cell' },
                ],
            }),
        ).toBe('Word · 2 lines\n1 [Title] "News"\n2 [table] "cell"');
    });

    test('anything else is no read', () => {
        expect(toOfficeDocumentText(null)).toBe(null);
        expect(toOfficeDocumentText({ kind: 'Excel' })).toBe(null);
    });
});

describe('the ask', () => {
    test('their words, then each file as it reads now', () => {
        const ask = toOfficeAsk('Change Lord to God', [
            { name: 'Sunday Service.pptx', text: 'PowerPoint · 1 slides' },
            { name: 'Letter.docx', text: null },
        ]);
        expect(ask.startsWith('Change Lord to God\n\n')).toBe(true);
        expect(ask).toContain(
            `Change it with ${OFFICE_EDIT_TOOL_NAME}, file "Sunday Service.pptx". It reads now:\nPowerPoint · 1 slides`,
        );
        expect(ask).toContain(
            `(it could not be read just now; call ${OFFICE_EDIT_TOOL_NAME} with action "read")`,
        );
    });

    test('a pressed translate button says the way and the language', () => {
        const ask = toOfficeAsk(
            'Add French under each line',
            [{ name: 'a.pptx', text: 'x' }],
            'under',
        );
        expect(ask).toContain('KEEP the words and add the translation');
        expect(ask).toContain('The language is French');
        expect(toOfficeAsk('', [], null, true)).toContain(OFFICE_WORDLESS_HINT);
    });

    test("a deck handed over with the question is the one changed, not the chat's earlier one", () => {
        const ask = toOfficeAsk(
            'Add a box Serve after Pray',
            [{ name: 'Mission Process.pptx', text: 'x' }],
            null,
            false,
            [],
            ['Mission Steps.pptx'],
        );
        expect(ask).toContain(
            '(This message came with "Mission Process.pptx": change it ' +
                'alone. "Mission Steps.pptx", from earlier in the chat, only ' +
                'when they name it.)',
        );
        expect(
            toOfficeAsk('Add a box', [{ name: 'a.pptx', text: 'x' }]),
        ).not.toContain('This message came with');
    });

    test('a SmartArt box placed by a key their words do not say goes back', () => {
        const misplaced = findOfficeMisplacedBox(
            [{ slide: 3, box: 'Steps', smartArtMove: 'Go', underBox: 'Plan' }],
            'In the SmartArt on slide 3, move Go before Plan.',
        );
        expect(misplaced).toEqual({
            sent: 'underBox',
            said: 'beforeBox',
            target: 'Plan',
        });
        expect(genOfficeMisplacedBoxReason(misplaced!)).toBe(
            'their question puts it before "Plan", not under it: send ' +
                '`beforeBox`: "Plan" in place of `underBox` (underBox puts ' +
                'it a level down, under that box). Say then what the ' +
                "tool's answer says was done.",
        );
        // the words say it, none says another, or two do: as sent
        expect(
            findOfficeMisplacedBox(
                [{ smartArtMove: 'Go', underBox: 'Plan' }],
                'put Go under Plan',
            ),
        ).toBeNull();
        expect(
            findOfficeMisplacedBox(
                [{ smartArtAdd: 'Go', afterBox: 'Plan' }],
                'add a box Go',
            ),
        ).toBeNull();
        expect(
            findOfficeMisplacedBox(
                [{ smartArtMove: 'Go', underBox: 'Plan' }],
                'move Go before Pray and after Plan',
            ),
        ).toBeNull();
    });

    test('the prompt names the tool and keeps the undo said', () => {
        expect(OFFICE_SYSTEM_PROMPT).toContain(OFFICE_EDIT_TOOL_NAME);
        expect(OFFICE_SYSTEM_PROMPT).toContain('Undo this change');
        expect(OFFICE_SYSTEM_PROMPT).toContain('ONE call');
        // a colour is done here, never sent to PowerPoint (2026-11-20:
        // "change color to green" had been answered "that must be done
        // directly in PowerPoint or Word")
        expect(OFFICE_SYSTEM_PROMPT).toContain('{color: "green"}');
        expect(OFFICE_SYSTEM_PROMPT).toContain('{slide, background}');
        expect(OFFICE_SYSTEM_PROMPT).not.toContain('a font, a colour');
    });
});

describe('the opening card', () => {
    test('a deck’s card and a Word file’s card, with the buttons', () => {
        const deck = genOfficeOpeningAnswer(DECK, ENGLISH, [ENGLISH]);
        expect(deck.text).toContain('“Sunday Service.pptx” is attached below');
        // everything a deck can have changed now (EC-771), said up front
        expect(deck.text).toContain('animations and the slide size');
        expect(deck.text).toContain('change tables and charts');
        expect(deck.replies).toContain('Check the spelling');
        expect(deck.replies).toContain('Make a song from it');
        const letter = genOfficeOpeningAnswer(LETTER, ENGLISH, [ENGLISH]);
        expect(letter.text).toContain('this Word file');
        expect(letter.text).toContain('change their color, size and font');
        expect(letter.text).not.toContain('slides');
    });
});

describe('a picture put into the file (2026-11-20, EC-770)', () => {
    const PHOTO = '/Users/a/Pictures/Choir Photo.JPG';
    const BACK = 'C:\\pics\\back.png';

    test('the pictures from disk in the box, then the tab, each once', () => {
        const pasted = {
            id: 'p',
            kind: 'image',
            name: 'pasted.png',
        } as unknown as ChatAttachmentType;
        const screen = {
            ...genFile('/tmp/screen.png'),
            kind: 'image',
            window: { id: 'w' },
        } as unknown as ChatAttachmentType;
        const messages = [
            { id: 1, author: 'you', attachments: [genFile(BACK)] },
            { id: 2, author: 'you', attachments: [genFile(DECK)] },
            { id: 3, author: 'bot', attachments: [genFile('/x/answer.png')] },
            { id: 4, author: 'you', attachments: [genFile(PHOTO)] },
        ];
        expect(
            findOfficeAskPictures(
                [genFile(PHOTO), pasted, screen, genFile(DECK)],
                messages,
            ),
        ).toEqual([
            { name: 'Choir Photo.JPG', filePath: PHOTO },
            { name: 'back.png', filePath: BACK },
        ]);
        // what the tab closed is not offered
        expect(findOfficeAskPictures([], messages, 1)).toEqual([
            { name: 'Choir Photo.JPG', filePath: PHOTO },
        ]);
    });

    test('a picture attached after the deck keeps the tab about the deck', () => {
        expect(
            checkIsOfficeOpenedLast([
                { id: 1, author: 'you', attachments: [genFile(DECK)] },
                { id: 2, author: 'you', attachments: [genFile(PHOTO)] },
            ]),
        ).toBe(true);
        // a song attached after it is a new subject still
        expect(
            checkIsOfficeOpenedLast([
                { id: 1, author: 'you', attachments: [genFile(DECK)] },
                { id: 2, author: 'you', attachments: [genFile('/s/Song.owl')] },
            ]),
        ).toBe(false);
    });

    test('a name -- with its extension or without -- is its path; a path is refused', () => {
        const pictures = [
            { name: 'Choir Photo.JPG', filePath: PHOTO },
            { name: 'back.png', filePath: BACK },
        ];
        expect(
            resolveOfficePictures(
                [
                    { slide: 1, picture: 'choir photo.jpg' },
                    { box: 'Curtain', picture: 'back' },
                    { id: '1.1', text: 'x' },
                ],
                pictures,
            ),
        ).toEqual({
            changes: [
                { slide: 1, picture: PHOTO },
                { box: 'Curtain', picture: BACK },
                { id: '1.1', text: 'x' },
            ],
        });
        expect(
            resolveOfficePictures([{ picture: '/etc/passwd.png' }], pictures),
        ).toEqual({
            reason:
                '`picture` names a picture attached to this chat by its ' +
                'name, never a path: "Choir Photo.JPG", "back.png".',
        });
        expect(resolveOfficePictures([{ picture: 'logo.png' }], [])).toEqual({
            reason: expect.stringContaining('No picture is attached'),
        });
        expect(resolveOfficePictures(undefined, pictures)).toEqual({
            changes: undefined,
        });
    });

    test('the ask names them, and the prompt says how', () => {
        expect(
            toOfficeAsk('Put my photo on slide 2', [], null, false, [
                'Choir Photo.JPG',
            ]),
        ).toContain(
            '(Pictures attached to this chat, to put on a slide with {slide, ' +
                "picture: name, at} or in a picture box's place with {box, " +
                'picture: name}: "Choir Photo.JPG".)',
        );
        expect(toOfficeAsk('Hi', [])).not.toContain('Pictures attached');
        expect(OFFICE_SYSTEM_PROMPT).toContain(
            '{slide, picture: its name, at}',
        );
        expect(OFFICE_SYSTEM_PROMPT).not.toContain(
            'a picture added or changed',
        );
    });
});

describe('a video or a sound put on a slide (2026-11-21)', () => {
    const CLIP = '/Users/a/Movies/Welcome Loop.mp4';
    const BELL = 'C:\\sounds\\bell.wav';
    const genMedia = (filePath: string) => {
        return {
            ...genFile(filePath),
            kind: 'media',
        } as unknown as ChatAttachmentType;
    };

    test('a clip in the box or the tab is offered with the pictures', () => {
        expect(
            findOfficeAskPictures(
                [genMedia(CLIP)],
                [{ id: 1, author: 'you', attachments: [genMedia(BELL)] }],
            ),
        ).toEqual([
            { name: 'Welcome Loop.mp4', filePath: CLIP },
            { name: 'bell.wav', filePath: BELL },
        ]);
        // attached after the deck, the tab is still about the deck
        expect(
            checkIsOfficeOpenedLast([
                { id: 1, author: 'you', attachments: [genFile(DECK)] },
                { id: 2, author: 'you', attachments: [genMedia(CLIP)] },
            ]),
        ).toBe(true);
    });

    test('`media` names a clip by its name; a picture name is no clip', () => {
        const attached = [
            { name: 'Welcome Loop.mp4', filePath: CLIP },
            { name: 'bell.wav', filePath: BELL },
            { name: 'back.png', filePath: '/p/back.png' },
        ];
        expect(
            resolveOfficePictures(
                [
                    { slide: 1, media: 'welcome loop', play: 'auto' },
                    { slide: 3, media: 'bell.wav' },
                ],
                attached,
            ),
        ).toEqual({
            changes: [
                { slide: 1, media: CLIP, play: 'auto' },
                { slide: 3, media: BELL },
            ],
        });
        expect(
            resolveOfficePictures([{ slide: 1, media: 'back.png' }], attached),
        ).toEqual({ reason: expect.stringContaining('`media` names') });
        expect(
            resolveOfficePictures(
                [{ slide: 1, media: 'clip.mp4' }],
                [{ name: 'back.png', filePath: '/p/back.png' }],
            ),
        ).toEqual({
            reason: expect.stringContaining('No video or sound is attached'),
        });
    });

    test('the ask names them apart from pictures, and the prompt says how', () => {
        const asked = toOfficeAsk('Play my intro on slide 1', [], null, false, [
            'Welcome Loop.mp4',
            'back.png',
        ]);
        expect(asked).toContain('"back.png"');
        expect(asked).toContain(
            '(Videos and sounds attached to this chat, to play on a slide ' +
                'with {slide, media: name, at, play: "click" | "auto"}: ' +
                '"Welcome Loop.mp4".)',
        );
        expect(OFFICE_SYSTEM_PROMPT).toContain('{slide, media: its name, at');
        expect(OFFICE_SYSTEM_PROMPT).not.toContain('a video or sound, a Word');
    });
});

describe('a PowerPoint open in the tab is the slides asked for (2026-11-21)', () => {
    test('in the box, or in a question since the files were closed', () => {
        expect(checkHasOpenDeck([genFile(DECK)], [])).toBe(true);
        const messages = [
            { id: 1, author: 'you', attachments: [genFile(DECK)] },
            { id: 2, author: 'bot' },
            { id: 3, author: 'you' },
        ];
        expect(checkHasOpenDeck([], messages)).toBe(true);
        // closed since: a slide asked for may be a new document again
        expect(checkHasOpenDeck([], messages, 2)).toBe(false);
    });

    test('a Word file or a picture is no deck', () => {
        expect(checkHasOpenDeck([genFile(LETTER)], [])).toBe(false);
        expect(
            checkHasOpenDeck(
                [],
                [{ id: 1, author: 'you', attachments: [genFile(LETTER)] }],
            ),
        ).toBe(false);
        expect(checkHasOpenDeck([genFile('/x/photo.png')], [])).toBe(false);
    });
});

// EC-776: gemma4:cloud sent `changes: [{replace: [{from, to}]}]` three
// times for a SmartArt word, and each was refused as a change naming
// nothing -- the schema drops a key it does not know inside a change.
describe('liftOfficeNestedReplaces', () => {
    test('a change holding only replace gives it to the call', () => {
        expect(
            liftOfficeNestedReplaces(
                [{ replace: [{ from: 'Pray', to: 'Worship' }] }],
                undefined,
            ),
        ).toEqual({
            changes: [],
            replace: [{ from: 'Pray', to: 'Worship' }],
            isLifted: true,
        });
    });

    test('one pair alone, beside a replace given and other changes', () => {
        expect(
            liftOfficeNestedReplaces(
                [
                    { id: '1.1', text: 'Hello' },
                    { replace: { from: 'Go', to: 'Send' }, note: 'x' },
                ],
                [{ from: 'Plan', to: 'Prepare' }],
            ),
        ).toEqual({
            changes: [{ id: '1.1', text: 'Hello' }, { note: 'x' }],
            replace: [
                { from: 'Plan', to: 'Prepare' },
                { from: 'Go', to: 'Send' },
            ],
            isLifted: true,
        });
    });

    test('nothing nested: left as it was', () => {
        const changes = [{ id: '1.1', text: 'Hello' }];
        const replace = [{ from: 'a', to: 'b' }];
        expect(liftOfficeNestedReplaces(changes, replace)).toEqual({
            changes,
            replace,
            isLifted: false,
        });
        expect(liftOfficeNestedReplaces(undefined, replace)).toEqual({
            changes: undefined,
            replace,
            isLifted: false,
        });
    });

    test('beside a slide: refused, saying where replace goes', () => {
        const result = liftOfficeNestedReplaces(
            [{ slide: 3, replace: [{ from: 'Pray', to: 'Worship' }] }],
            undefined,
        );
        expect('reason' in result && result.reason).toMatch(
            /beside `changes`, never inside a change/,
        );
    });
});

describe('findOfficeUnwrittenEverywhere', () => {
    const green = { color: 'green' };

    test('words their line never wrote are the ones sent back', () => {
        const changes = [{ words: 'Grace Church', everywhere: true, ...green }];
        expect(
            findOfficeUnwrittenEverywhere(
                changes,
                'Make the church name at the bottom of every slide green',
            ),
        ).toBe('Grace Church');
        expect(genOfficeUnwrittenEverywhereReason('Grace Church')).toMatch(
            /^their question does not write "Grace Church": .*box on every slide alone/,
        );
    });

    test('words they wrote, in any case, spacing or quotes, are let be', () => {
        for (const asked of [
            'Make every Grace Church green',
            'turn  grace\nchurch green everywhere',
            'make “Grace Church” green',
        ]) {
            expect(
                findOfficeUnwrittenEverywhere(
                    [{ words: 'Grace Church', everywhere: true, ...green }],
                    asked,
                ),
            ).toBeNull();
        }
    });

    test('a change not sent everywhere, no words typed, or no list, is let be', () => {
        const asked = 'Make the church name green';
        expect(
            findOfficeUnwrittenEverywhere(
                [{ words: 'Grace Church', ...green }],
                asked,
            ),
        ).toBeNull();
        expect(
            findOfficeUnwrittenEverywhere(
                [{ words: 'Grace Church', everywhere: true }],
                '  ',
            ),
        ).toBeNull();
        expect(findOfficeUnwrittenEverywhere(undefined, asked)).toBeNull();
        // the first such change of several is the one named
        expect(
            findOfficeUnwrittenEverywhere(
                [
                    { words: 'church name', everywhere: true },
                    { words: 'Grace Church', everywhere: true },
                ],
                asked,
            ),
        ).toBe('Grace Church');
    });
});
