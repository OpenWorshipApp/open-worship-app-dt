import { afterEach, describe, expect, it } from 'vitest';

import languageNameMap from '../lang/data/en/language-names.json';
import type { ChatAttachmentType } from './attachmentHelpers';
import { setChatTranslator } from './chatTranHelpers';
import {
    SLIDE_EDIT_TOOL_NAME,
    SLIDE_PLACEMENT_HINT_MAP,
    SLIDE_SYSTEM_PROMPT,
    SLIDE_WORDLESS_HINT,
    checkIsDocumentOptionsAsk,
    checkIsSlideFileName,
    findOpenSlideAttachments,
    findSlideAskFiles,
    findWindowDoneCardAsk,
    genSlideOpeningAnswer,
    genSlideSizeChanges,
    genSlideSizeDoneText,
    readSlidePlacement,
    readSlideSizeAsk,
    readTranslateLanguageName,
    resolveSlideEditFile,
    toSlideAsk,
    toSlideDocName,
    toSlideDocumentText,
    toSlideFileText,
} from './slideChatHelpers';

const SLIDE_PATH = 'C:\\data\\documents\\Preaching.ows';

const ENGLISH = {
    code: 'en',
    name: 'English',
    nativeName: 'English',
} as any;
const SECOND = {
    code: 'xx',
    name: 'Testish',
    nativeName: 'Testish',
} as any;

function fileAttachment(
    filePath: string,
    extra: Partial<ChatAttachmentType> = {},
): ChatAttachmentType {
    return {
        id: filePath,
        kind: 'text',
        name: filePath.split(/[\\/]/).pop() ?? filePath,
        filePath,
        ...extra,
    } as ChatAttachmentType;
}

describe('a slide document by its name', () => {
    it('is a .ows file, named as the Documents list shows it', () => {
        expect(checkIsSlideFileName(SLIDE_PATH)).toBe(true);
        expect(checkIsSlideFileName('song.owl')).toBe(false);
        expect(toSlideDocName(SLIDE_PATH)).toBe('Preaching');
        expect(toSlideDocName('/home/a/Easter.OWS')).toBe('Easter');
    });
});

describe('the attachment keeps the words, never the JSON', () => {
    it('lists each slide with its text boxes, pictures left out', () => {
        const text = toSlideFileText(
            JSON.stringify({
                items: [
                    {
                        canvasItems: [
                            { type: 'text', text: 'Welcome\nto church' },
                            {
                                type: 'image',
                                srcData: 'data:image/png;base64,AAAA',
                            },
                        ],
                    },
                    { canvasItems: [] },
                ],
            }),
        );
        expect(text).toBe(
            'Slides: 2\nSlide 1: Welcome / to church\nSlide 2: (no words)',
        );
        expect(text).not.toContain('base64');
    });

    it('is null for what is not a slide document', () => {
        expect(toSlideFileText('not json')).toBe(null);
        expect(toSlideFileText('{"content": "x"}')).toBe(null);
    });
});

describe('which slide documents a question is about', () => {
    it('takes each attached .ows once, songs and pictures aside', () => {
        expect(
            findSlideAskFiles([
                fileAttachment(SLIDE_PATH),
                fileAttachment(SLIDE_PATH),
                fileAttachment('C:\\x\\Song.owl'),
                fileAttachment('C:\\x\\look.png', { kind: 'image' }),
            ]),
        ).toEqual([{ name: 'Preaching', filePath: SLIDE_PATH }]);
    });

    it('stays open past a picture attached from a folder after it', () => {
        const messages = [
            { id: 1, author: 'you', attachments: [fileAttachment(SLIDE_PATH)] },
            { id: 2, author: 'bot' },
            {
                id: 3,
                author: 'you',
                attachments: [
                    fileAttachment('C:\\Pictures\\want.png', { kind: 'image' }),
                ],
            },
        ];
        expect(findOpenSlideAttachments(messages)).toEqual([
            fileAttachment(SLIDE_PATH),
        ]);
        // Closed with the × above the box: no longer open.
        expect(findOpenSlideAttachments(messages, 2)).toEqual([]);
        expect(findOpenSlideAttachments(messages, 0)).toHaveLength(1);
    });

    it('never counts a picture of the app or a control pointed at', () => {
        expect(
            findOpenSlideAttachments([
                {
                    id: 1,
                    author: 'you',
                    attachments: [
                        fileAttachment(SLIDE_PATH, {
                            window: { id: 'w' } as any,
                        }),
                    ],
                },
            ]),
        ).toEqual([]);
    });
});

describe('the name a model gives', () => {
    const files = [{ name: 'Preaching', filePath: SLIDE_PATH }];

    it('becomes the attached path, never a path it wrote', () => {
        expect(resolveSlideEditFile('Preaching', files)).toEqual({
            filePath: SLIDE_PATH,
        });
        expect(resolveSlideEditFile('preaching.ows', files)).toEqual({
            filePath: SLIDE_PATH,
        });
        expect(resolveSlideEditFile('', files)).toEqual({
            filePath: SLIDE_PATH,
        });
        expect(resolveSlideEditFile('C:\\Windows\\x.ows', files)).toEqual({
            reason:
                'Name the slide document as it is attached, by its name -- ' +
                'never a path.',
        });
        expect(resolveSlideEditFile('Other', files)).toEqual({ name: 'Other' });
        expect(
            resolveSlideEditFile('', [
                ...files,
                { name: 'Easter', filePath: 'C:\\d\\Easter.ows' },
            ]),
        ).toEqual({
            reason: 'Say which slide document (`file`): "Preaching", "Easter".',
        });
    });
});

describe('the document as the model reads it', () => {
    const described = {
        name: 'Preaching',
        slideCount: 2,
        width: 1920,
        height: 1080,
        slides: [
            {
                number: 1,
                name: 'Title',
                items: [
                    {
                        id: 1,
                        type: 'text',
                        text: 'Line one\nLine two',
                        left: 192,
                        top: 108,
                        width: 1536,
                        height: 864,
                        fontSize: 90,
                        fontWeight: 'bold',
                        color: '#FFFFFF',
                        backgroundColor: '#00000080',
                        align: 'center',
                        valign: 'center',
                        rotate: 0,
                        round: 24,
                    },
                    {
                        id: 2,
                        type: 'image',
                        file: 'bg.jpg',
                        left: 0,
                        top: 0,
                        width: 1920,
                        height: 1080,
                        locked: true,
                    },
                ],
            },
            { number: 2, isDisabled: true, items: [] },
        ],
    };

    it('is a line a box: its words as JSON, its style and place', () => {
        expect(toSlideDocumentText(described)).toBe(
            [
                'Slides: 2 · each 1920 x 1080 pixels',
                '',
                'Slide 1 ("Title")',
                '  box 1 · text "Line one\\nLine two" · 90px bold color ' +
                    '#FFFFFF on #00000080 center/center round 24 · at 192,108 size ' +
                    '1536x864',
                '  box 2 · image bg.jpg · at 0,0 size 1920x1080 · locked',
                '',
                'Slide 2 (disabled)',
                '  (no boxes)',
            ].join('\n'),
        );
        expect(toSlideDocumentText(null)).toBe(null);
    });

    it('names each background and what the Background panel holds', () => {
        const withBackgrounds = {
            ...described,
            slides: [
                { number: 1, background: 'picture sunrise.jpg', items: [] },
                { number: 2, items: [] },
            ],
            documentBackground: 'colour #000000',
            backgroundChoices: {
                pictures: ['sunrise.jpg', 'hills.png'],
                videos: ['waves.mp4'],
                isTruncated: true,
            },
        };
        const text = toSlideDocumentText(withBackgrounds) ?? '';
        expect(text).toContain('Slide 1 (background: picture sunrise.jpg)');
        expect(text).toContain(
            'Document background (behind slides with none of their own): ' +
                'colour #000000',
        );
        expect(text).toContain(
            'Backgrounds you can use: pictures sunrise.jpg, hills.png; ' +
                'videos waves.mp4 (and more: a word of a name, like ' +
                'sunrise, finds one)',
        );
        expect(
            toSlideDocumentText({
                ...described,
                backgroundChoices: { pictures: [], videos: [] },
            }),
        ).toContain(
            'Backgrounds you can use: none yet (the Background panel is empty)',
        );
        // A read with no choices (owa_slide_file's) says nothing of them.
        expect(toSlideDocumentText(described)).not.toContain('Backgrounds');
    });

    it('says what a send with no words means', () => {
        const docs = [{ name: 'Talk', text: 'Slides: 0' }];
        const asked = toSlideAsk('(Attached: a picture)', docs, null, true);
        // The hint comes first, then what was sent, then the document.
        expect(asked.split('\n\n').slice(0, 2)).toEqual([
            SLIDE_WORDLESS_HINT,
            '(Attached: a picture)',
        ]);
        expect(SLIDE_WORDLESS_HINT).toMatch(/make slides that look like it/);
        expect(asked).toContain('The slide document "Talk" is attached');
        expect(toSlideAsk('Make it blue', docs)).not.toContain(
            SLIDE_WORDLESS_HINT,
        );
    });

    it('tells the model a photo behind words is a background it can set', () => {
        expect(SLIDE_SYSTEM_PROMPT).toContain('set-background');
        expect(SLIDE_SYSTEM_PROMPT).toMatch(
            /try ONE word for what the photo shows/,
        );
        expect(SLIDE_SYSTEM_PROMPT).toMatch(/background is kept at once/);
    });

    it('rides under the question, named as `file` takes it', () => {
        const asked = toSlideAsk('make it bigger', [
            { name: 'Preaching', text: 'Slides: 1' },
            { name: 'Easter', text: null },
        ]);
        expect(asked).toContain('make it bigger');
        expect(asked).toContain(
            `Change it with ${SLIDE_EDIT_TOOL_NAME}, file "Preaching". It ` +
                'reads now:\nSlides: 1',
        );
        expect(asked).toContain('call owa_slide_edit with action "slides"');
        expect(toSlideAsk('x', [], 'under')).toContain(
            'add the translation under them',
        );
        expect(toSlideAsk('x', [], 'replace')).toContain('REPLACE the words');
    });

    it('says the language a translate button names, so it is not asked', () => {
        expect(readTranslateLanguageName('Add English under each line')).toBe(
            'English',
        );
        expect(
            readTranslateLanguageName('Replace the words with Testish'),
        ).toBe('Testish');
        expect(
            readTranslateLanguageName('Add another language under each line'),
        ).toBe(null);
        expect(readTranslateLanguageName('make it bigger')).toBe(null);
        expect(
            toSlideAsk('Add English under each line', [], 'under'),
        ).toContain('(The language is English: translate into it now');
        expect(
            toSlideAsk('Add another language under each line', [], 'under'),
        ).not.toContain('The language is');
    });
});

describe('the prompt', () => {
    it('asks for one call for many slides, and pictures made into slides', () => {
        expect(SLIDE_SYSTEM_PROMPT).toContain('ONE update-slides call');
        expect(SLIDE_SYSTEM_PROMPT).toContain('ONE add-slides call');
        expect(SLIDE_SYSTEM_PROMPT).toContain('A PICTURE of slides');
        // A translation is words taken from the slides: done, not asked for
        // (2026-11-07, an ask to add English above the other language's text
        // was answered with a question).
        expect(SLIDE_SYSTEM_PROMPT).toContain('never ask them for the words');
        expect(SLIDE_SYSTEM_PROMPT).toContain('NEEDS: file');
    });
});

describe('the card a slide document opens its tab with', () => {
    it('says what can be done and offers the most asked as buttons', () => {
        const opening = genSlideOpeningAnswer(SLIDE_PATH, ENGLISH, [
            ENGLISH,
            SECOND,
        ]);
        expect(opening.text).toContain('“Preaching” is attached below.');
        expect(opening.text).toContain('Send me a picture of slides');
        expect(opening.replies).toEqual([
            'Replace the words with another language',
            'Add another language under each line',
            'Check the spelling',
            'Make the words larger',
            'Make slides like a picture',
        ]);
        expect(opening.translateLanguage).toBe(null);
    });

    it('offers the language the app is shown in', () => {
        const opening = genSlideOpeningAnswer(SLIDE_PATH, SECOND, [
            ENGLISH,
            SECOND,
        ]);
        expect(opening.replies.slice(0, 2)).toEqual([
            'Replace the words with Testish',
            'Add Testish under each line',
        ]);
    });
});

describe('asking for the buttons again', () => {
    it('is a few words asking for options, and nothing more', () => {
        for (const asked of [
            'list me more options',
            'show the options again',
            'Options?',
            'more options',
            'what can you do?',
            'What else can I do with this',
            'help',
            'show me the menu',
        ]) {
            expect(checkIsDocumentOptionsAsk(asked), asked).toBe(true);
        }
        for (const asked of [
            'more options for the colors',
            'add above the other text',
            'make the words larger',
            'help me translate slide 2',
            '',
        ]) {
            expect(checkIsDocumentOptionsAsk(asked), asked).toBe(false);
        }
    });
});

describe('where a typed translation puts its lines', () => {
    it('reads under or above, only beside a translation', () => {
        expect(
            readSlidePlacement('Add the English under each line on slide 3'),
        ).toBe('under');
        expect(readSlidePlacement('Put English above each line')).toBe('above');
        expect(
            readSlidePlacement('translate it and put it below the words'),
        ).toBe('under');
        // Not a translation, or both ways at once: nothing said.
        expect(readSlidePlacement('Put a box under the title')).toBe(null);
        expect(
            readSlidePlacement('English above and the rest under, swap them'),
        ).toBe(null);
    });

    // 2026-11-07: "add above the <language> text", the language the slides
    // are in named alone, was read as no translation. Any language English's
    // table names is one, every one found the same way.
    it('takes any language named by its English name as a translation', () => {
        const nameList = Object.values(
            languageNameMap as Record<string, string>,
        ).map((name) => {
            return name.split(/[,;(]/)[0].trim();
        });
        expect(nameList.length).toBeGreaterThan(100);
        for (const name of nameList) {
            expect([
                name,
                readSlidePlacement(`add above the ${name} text`),
                readSlidePlacement(`Put it under each ${name} line`),
                readSlidePlacement(`${name} above and the rest under`),
            ]).toEqual([name, 'above', 'under', null]);
        }
    });

    it('rides beside a typed ask, and never beside a pressed button', () => {
        const docs = [{ name: 'Talk', text: 'Slides: 1' }];
        expect(
            toSlideAsk('Add the English under each line on slide 3', docs),
        ).toContain(SLIDE_PLACEMENT_HINT_MAP.under);
        expect(
            toSlideAsk('Add Spanish under each line', docs, 'under'),
        ).not.toContain(SLIDE_PLACEMENT_HINT_MAP.under);
    });
});

describe('sizes the window changes by itself', () => {
    it('reads a short English size request and nothing more', () => {
        for (const asked of [
            'Make the words larger',
            'make all the words on every slide bigger please',
            'Make the text larger.',
            'Make the font size larger',
        ]) {
            expect(readSlideSizeAsk(asked), asked).toEqual({
                kind: 'scale',
                factor: 1.25,
            });
        }
        expect(readSlideSizeAsk('Make the words smaller')).toEqual({
            kind: 'scale',
            factor: 0.8,
        });
        for (const asked of [
            'Make all the words on every slide 110 px',
            'set the font size to 110px',
            'make every box 110 pixels',
            'Make the words 110',
        ]) {
            expect(readSlideSizeAsk(asked), asked).toEqual({
                kind: 'set',
                size: 110,
            });
        }
        // Boxes chosen, a slide named, a look asked for, a size out of range:
        // the assistant's.
        for (const asked of [
            'Make the title larger',
            'Make the words larger on slide 2',
            'make it look nicer',
            'Make the words 2 px',
            'Make the words larger and blue',
            '',
        ]) {
            expect(readSlideSizeAsk(asked), asked).toBe(null);
        }
    });

    const described = {
        slideCount: 2,
        slides: [
            {
                number: 1,
                items: [
                    { id: 1, type: 'text', fontSize: 90 },
                    { id: 2, type: 'text', fontSize: 70 },
                    { id: 3, type: 'image', file: 'a.jpg' },
                ],
            },
            {
                number: 2,
                items: [
                    { id: 1, type: 'text', fontSize: 70, locked: true },
                    { id: 2, type: 'text', fontSize: 70 },
                ],
            },
        ],
    };

    it('scales every unlocked text box, keeping their sizes apart', () => {
        expect(
            genSlideSizeChanges(described, { kind: 'scale', factor: 1.25 }),
        ).toEqual({
            changes: [
                {
                    slide: 1,
                    items: [
                        { id: 1, fontSize: 113 },
                        { id: 2, fontSize: 88 },
                    ],
                },
                { slide: 2, items: [{ id: 2, fontSize: 88 }] },
            ],
            boxCount: 3,
            sizes: '70 → 88, 90 → 113',
        });
        expect(
            genSlideSizeChanges(described, { kind: 'set', size: 70 }),
        ).toEqual({
            changes: [{ slide: 1, items: [{ id: 1, fontSize: 70 }] }],
            boxCount: 1,
            sizes: '70 px',
        });
    });

    it('leaves to the assistant what it cannot do whole', () => {
        expect(
            genSlideSizeChanges(
                { ...described, isTruncated: true },
                { kind: 'set', size: 100 },
            ),
        ).toBe(null);
        expect(
            genSlideSizeChanges(
                { slides: [{ number: 1, items: [] }] },
                { kind: 'set', size: 100 },
            ),
        ).toBe(null);
        expect(genSlideSizeChanges(null, { kind: 'set', size: 100 })).toBe(
            null,
        );
    });

    it('says what changed, that it is unsaved, and how to put it back', () => {
        const change = genSlideSizeChanges(described, {
            kind: 'scale',
            factor: 1.25,
        });
        expect(change).not.toBe(null);
        const text = genSlideSizeDoneText('Talk', change!);
        expect(text).toContain('3 boxes of “Talk”');
        expect(text).toContain('(70 → 88, 90 → 113)');
        expect(text).toMatch(/not saved yet.*Undo this change/);
    });
});

// BN-16 (2026-11-08): a card keeps its buttons as the window shows them, so
// Make the words larger pressed in another language had reached the
// assistant; the window asks it in its English, which its reader reads.
describe('a card button the window does by itself, pressed in any language', () => {
    afterEach(() => {
        setChatTranslator(
            (text) => text,
            (text) => text,
        );
    });

    it('is asked in its English', () => {
        const shown: Record<string, string> = {
            'Make the words larger': 'Xx larger',
            'Make the words smaller': 'Xx smaller',
        };
        setChatTranslator(
            (text) => shown[text] ?? text,
            (text) => shown[text] ?? text,
        );
        expect(findWindowDoneCardAsk('Xx larger')).toBe(
            'Make the words larger',
        );
        expect(findWindowDoneCardAsk(' Xx smaller ')).toBe(
            'Make the words smaller',
        );
        expect(readSlideSizeAsk(findWindowDoneCardAsk('Xx larger')!)).toEqual({
            kind: 'scale',
            factor: 1.25,
        });
        // Already English, or another button: asked as it is.
        expect(findWindowDoneCardAsk('Make the words larger')).toBeNull();
        expect(findWindowDoneCardAsk('Check the spelling')).toBeNull();
    });
});
