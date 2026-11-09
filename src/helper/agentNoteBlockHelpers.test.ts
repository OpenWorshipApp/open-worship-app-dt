import { describe, expect, test } from 'vitest';

import {
    applyNoteEdit,
    collectNewNoteVerseRefs,
    genNoteContentHash,
    readNoteBlocks,
    splitNoteVerseRef,
    toRealLineBreaks,
    type NoteVerseType,
} from './agentNoteBlockHelpers';

// Every node below has the shape a real note file holds (read off a note
// written in the editor, 2026-11-07), with English words in it.
const STYLE = 'font-size: 20px;';

function text(words: string, format = 0, style = STYLE) {
    return {
        detail: 0,
        format,
        mode: 'normal',
        style,
        text: words,
        type: 'text',
        version: 1,
    };
}

function paragraph(children: any[], extra: Record<string, any> = {}) {
    return {
        children,
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        textFormat: 0,
        textStyle: STYLE,
        ...extra,
    };
}

const VERSE_MENTION = {
    detail: 1,
    format: 0,
    mode: 'segmented',
    style: '',
    text: 'Isaiah 53:5',
    type: 'mention',
    version: 1,
    mentionData: '(5): But he was wounded for our transgressions',
    mentionId: null,
    mentionKind: 'bible-verse',
    mentionName: '(KJV) Isaiah 53:5',
};
const PERSON_MENTION = {
    detail: 1,
    format: 0,
    mode: 'segmented',
    style: '',
    text: 'Mary',
    type: 'mention',
    version: 1,
    mentionData: null,
    mentionId: '9fb34696-f2e0-4225-8b10-66ceaf2f44ed',
    mentionKind: 'mention',
    mentionName: 'Mary',
};
const PICTURE = {
    type: 'image',
    version: 1,
    src: `data:image/png;base64,${'iVBORw0KGgo'.repeat(40)}`,
    altText: '',
    width: 200,
    height: 100,
    maxWidth: 500,
};

function list(listType: string, items: any[]) {
    return {
        children: items.map((children, index) => {
            return {
                children,
                direction: null,
                format: '',
                indent: 0,
                type: 'listitem',
                version: 1,
                value: index + 1,
                ...(listType === 'check' ? { checked: index === 0 } : {}),
            };
        }),
        direction: null,
        format: '',
        indent: 0,
        type: 'list',
        version: 1,
        textFormat: 0,
        textStyle: STYLE,
        listType,
        start: 1,
        tag: listType === 'number' ? 'ol' : 'ul',
    };
}

function genNote() {
    return {
        root: {
            children: [
                {
                    children: [text('Grace Alone')],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'heading',
                    version: 1,
                    tag: 'h1',
                },
                paragraph([
                    text('Text: ', 1),
                    VERSE_MENTION,
                    text(' and '),
                    PERSON_MENTION,
                ]),
                list('bullet', [[text('first point')], [text('second point')]]),
                {
                    children: [paragraph([text('Love is patient')])],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'quote',
                    version: 1,
                    textFormat: 0,
                    textStyle: STYLE,
                },
                paragraph([PICTURE]),
                { type: 'horizontalrule', version: 1 },
                {
                    children: [
                        {
                            children: [paragraph([text('(KJV) John 1:1')])],
                            direction: null,
                            format: '',
                            indent: 0,
                            type: 'collapsible-title',
                            version: 1,
                        },
                        {
                            children: [
                                paragraph([text('(1): In the beginning')]),
                            ],
                            direction: null,
                            format: '',
                            indent: 0,
                            type: 'collapsible-content',
                            version: 1,
                        },
                    ],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'collapsible-container',
                    version: 1,
                    open: false,
                },
                list('check', [[text('call Tom')], [text('print notes')]]),
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
        },
    };
}

const CONTENT = JSON.stringify(genNote());

const ROMANS: NoteVerseType = {
    mentionName: '(KJV) Romans 8:28',
    shownText: 'Romans 8:28',
    verseText: '(28): And we know that all things work together for good',
    style: '',
};

function rootOf(content: string) {
    return JSON.parse(content).root;
}

function edit(changes: any[], extra: Record<string, any> = {}) {
    const result = applyNoteEdit({ content: CONTENT, changes, ...extra });
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result;
}

function reasonOf(changes: any[], extra: Record<string, any> = {}) {
    const result = applyNoteEdit({ content: CONTENT, changes, ...extra });
    if (!('reason' in result)) {
        throw new Error('expected a refusal');
    }
    return result.reason;
}

describe('a note read as blocks', () => {
    test('a line a block: its kind, its words in the mark-up, what is fixed', () => {
        const read = readNoteBlocks(CONTENT)!;
        expect(read.hash).toBe(genNoteContentHash(CONTENT));
        expect(read.blockCount).toBe(10);
        expect(
            read.blocks.map((block) => {
                return [block.n, block.kind, block.text];
            }),
        ).toEqual([
            [1, 'h1', 'Grace Alone'],
            [2, 'paragraph', '**Text:** [^(KJV) Isaiah 53:5] and [@Mary]'],
            [3, 'bullet', 'first point'],
            [4, 'bullet', 'second point'],
            [5, 'quote', 'Love is patient'],
            // A picture kept inside the note is not quoted.
            [6, 'picture', '(kept inside the note)'],
            [7, 'rule', ''],
            [8, 'passage', '(KJV) John 1:1 — (1): In the beginning'],
            [9, 'check', 'call Tom'],
            [10, 'check', 'print notes'],
        ]);
        expect(read.blocks[5].isFixed).toBe(true);
        expect(read.blocks[8].checked).toBe(true);
        expect(read.blocks[9].checked).toBe(false);
    });

    test('an empty note is no blocks, and an older note is no read', () => {
        expect(readNoteBlocks('')?.blockCount).toBe(0);
        expect(readNoteBlocks('<p>old</p>')).toBeNull();
    });

    test('mark-up characters in the words are escaped', () => {
        const content = JSON.stringify({
            root: {
                ...genNote().root,
                children: [paragraph([text('2 * 3 = [six]')])],
            },
        });
        expect(readNoteBlocks(content)!.blocks[0].text).toBe(
            '2 \\* 3 = \\[six\\]',
        );
    });

    test('a long note is read in parts', () => {
        const content = JSON.stringify({
            root: {
                ...genNote().root,
                children: Array.from({ length: 60 }, (_, index) => {
                    return paragraph([text(`${index} ${'word '.repeat(80)}`)]);
                }),
            },
        });
        const first = readNoteBlocks(content)!;
        expect(first.blocks.length).toBeLessThan(60);
        expect(first.nextFrom).toBe(first.blocks.length + 1);
        const rest = readNoteBlocks(content, first.nextFrom)!;
        expect(rest.blocks[0].n).toBe(first.nextFrom);
    });
});

describe('a change to a note', () => {
    test('a block given its own words back changes nothing at all', () => {
        const result = edit([
            { block: 2, text: '**Text:** [^Isaiah 53:5] and [@Mary]' },
        ]);
        expect(result.content).toBe(CONTENT);
        expect(result.isChanged).toBe(false);
    });

    test('only the block changed is rebuilt; every other node is as it was', () => {
        const result = edit([{ block: 1, text: 'Grace and Truth' }]);
        const before = rootOf(CONTENT).children;
        const after = rootOf(result.content).children;
        expect(after[0].children).toEqual([
            text('Grace Alone'.replace('Alone', 'and Truth')),
        ]);
        for (let index = 1; index < before.length; index++) {
            expect(JSON.stringify(after[index])).toBe(
                JSON.stringify(before[index]),
            );
        }
        // The picture's bytes came through untouched.
        expect(after[4].children[0].src).toBe(PICTURE.src);
    });

    test('a kept mention is the original node; new words take the block style', () => {
        const result = edit([
            {
                block: 2,
                text: '*Read* [^Isaiah 53:5] with [@Mary] today',
            },
        ]);
        const children = rootOf(result.content).children[1].children;
        expect(children).toEqual([
            text('Read', 2),
            text(' ', 0),
            VERSE_MENTION,
            text(' with '),
            PERSON_MENTION,
            text(' today'),
        ]);
    });

    test('a new verse is the one the app resolved, never words of the model', () => {
        expect(
            collectNewNoteVerseRefs(CONTENT, [
                { block: 2, text: '[^Isaiah 53:5] [^Romans 8:28]' },
                { after: 0, kind: 'passage', ref: 'John 3:16' },
            ]),
        ).toEqual(['Romans 8:28', 'John 3:16']);
        const result = edit([{ block: 2, text: 'See [^Romans 8:28]' }], {
            verseMap: new Map([['Romans 8:28', ROMANS]]),
        });
        const mention = rootOf(result.content).children[1].children[1];
        expect(mention).toMatchObject({
            type: 'mention',
            mentionKind: 'bible-verse',
            mentionName: '(KJV) Romans 8:28',
            text: 'Romans 8:28',
            mentionData: ROMANS.verseText,
        });
        expect(reasonOf([{ block: 2, text: 'See [^Hezekiah 9:9]' }])).toContain(
            '"Hezekiah 9:9"',
        );
    });

    // 2026-11-08: asked to make the English lines' verses KJV, the model
    // could not see which Bible a chip was in, and every verse it wrote
    // came back as the old chip's Bible.
    test('a verse token names its Bible: as read it is the chip, another Bible is a new verse', () => {
        // Given back as read, Bible and all: the note does not move.
        expect(
            edit([
                {
                    block: 2,
                    text: '**Text:** [^(KJV) Isaiah 53:5] and [@Mary]',
                },
            ]).isChanged,
        ).toBe(false);
        // The Bible named in any case is the same chip.
        expect(
            collectNewNoteVerseRefs(CONTENT, [
                { block: 2, text: '[^(kjv) Isaiah 53:5]' },
            ]),
        ).toEqual([]);
        // Another Bible is a NEW verse, read from that Bible.
        expect(
            collectNewNoteVerseRefs(CONTENT, [
                {
                    block: 2,
                    text: '**Text:** [^(NIV) Isaiah 53:5] and [@Mary]',
                },
            ]),
        ).toEqual(['(NIV) Isaiah 53:5']);
        const niv: NoteVerseType = {
            mentionName: '(NIV) Isaiah 53:5',
            shownText: 'Isaiah 53:5',
            verseText: '(5): But he was pierced for our transgressions',
            style: '',
        };
        const result = edit(
            [{ block: 2, text: '**Text:** [^(NIV) Isaiah 53:5] and [@Mary]' }],
            { verseMap: new Map([['(NIV) Isaiah 53:5', niv]]) },
        );
        const mention = rootOf(result.content).children[1].children[1];
        expect(mention).toMatchObject({
            type: 'mention',
            mentionKind: 'bible-verse',
            mentionName: '(NIV) Isaiah 53:5',
            mentionData: niv.verseText,
        });
        expect(readNoteBlocks(result.content)!.blocks[1].text).toBe(
            '**Text:** [^(NIV) Isaiah 53:5] and [@Mary]',
        );
    });

    test("a verse token's Bible is read off its front, and only there", () => {
        expect(splitNoteVerseRef('(KJV) Hebrews 11:1')).toEqual({
            bibleKey: 'KJV',
            ref: 'Hebrews 11:1',
        });
        expect(splitNoteVerseRef(' Hebrews 11:1 ')).toEqual({
            bibleKey: null,
            ref: 'Hebrews 11:1',
        });
        // Brackets with a space in them are no Bible's short name.
        expect(splitNoteVerseRef('(see this) John 3:16').bibleKey).toBeNull();
    });

    test('a new person or place is written as words', () => {
        const result = edit([{ block: 1, text: 'With [@Peter] in [#Rome]' }]);
        expect(
            rootOf(result.content).children[0].children.map((one: any) => {
                return [one.type, one.text];
            }),
        ).toEqual([
            ['text', 'With '],
            ['text', 'Peter'],
            ['text', ' in '],
            ['text', 'Rome'],
        ]);
    });

    test('a passage is added from the resolved verse, after the block named', () => {
        const result = edit(
            [{ after: 1, kind: 'passage', ref: 'Romans 8:28' }],
            { verseMap: new Map([['Romans 8:28', ROMANS]]) },
        );
        const passage = rootOf(result.content).children[1];
        expect(passage.type).toBe('collapsible-container');
        expect(passage.children[0].children[0].children[0].text).toBe(
            '(KJV) Romans 8:28',
        );
        expect(passage.children[1].children[0].children[0].text).toBe(
            ROMANS.verseText,
        );
        expect(readNoteBlocks(result.content)!.blocks[1].kind).toBe('passage');
    });

    test('a bullet after a bullet joins its list; a paragraph cuts the list there', () => {
        const joined = edit([
            { after: 3, kind: 'bullet', text: 'a new point' },
        ]);
        const joinedList = rootOf(joined.content).children[2];
        expect(
            joinedList.children.map((item: any) => item.children[0].text),
        ).toEqual(['first point', 'a new point', 'second point']);
        const cut = edit([{ after: 3, text: 'between them' }]);
        expect(
            readNoteBlocks(cut.content)!
                .blocks.slice(2, 5)
                .map((block) => {
                    return [block.kind, block.text];
                }),
        ).toEqual([
            ['bullet', 'first point'],
            ['paragraph', 'between them'],
            ['bullet', 'second point'],
        ]);
        const types = rootOf(cut.content).children.map((one: any) => one.type);
        expect(types.slice(2, 5)).toEqual(['list', 'paragraph', 'list']);
    });

    test('several new blocks after one block keep their order', () => {
        const result = edit([
            { after: 1, kind: 'h2', text: 'Outline' },
            { after: 1, kind: 'number', text: 'One' },
            { after: 1, kind: 'number', text: 'Two' },
        ]);
        expect(
            readNoteBlocks(result.content)!
                .blocks.slice(1, 4)
                .map((block) => {
                    return [block.kind, block.text];
                }),
        ).toEqual([
            ['h2', 'Outline'],
            ['number', 'One'],
            ['number', 'Two'],
        ]);
    });

    test('kinds change: a heading, a list item out of its list, a paragraph into one', () => {
        const result = edit([
            { block: 1, kind: 'h2' },
            { block: 4, kind: 'paragraph' },
            { block: 5, kind: 'bullet' },
            { block: 10, checked: true },
        ]);
        const blocks = readNoteBlocks(result.content)!.blocks;
        expect(
            blocks.map((block) => {
                return [block.kind, block.text];
            }),
        ).toEqual([
            ['h2', 'Grace Alone'],
            ['paragraph', '**Text:** [^(KJV) Isaiah 53:5] and [@Mary]'],
            ['bullet', 'first point'],
            ['paragraph', 'second point'],
            ['bullet', 'Love is patient'],
            ['picture', '(kept inside the note)'],
            ['rule', ''],
            ['passage', '(KJV) John 1:1 — (1): In the beginning'],
            ['check', 'call Tom'],
            ['check', 'print notes'],
        ]);
        expect(blocks[9].checked).toBe(true);
    });

    test('a quote of paragraphs keeps a paragraph a line', () => {
        const result = edit([
            { block: 5, text: 'Love is patient\nlove is kind' },
        ]);
        const quote = rootOf(result.content).children[3];
        expect(
            quote.children.map((one: any) => {
                return [one.type, one.children[0].text];
            }),
        ).toEqual([
            ['paragraph', 'Love is patient'],
            ['paragraph', 'love is kind'],
        ]);
    });

    test('remove and move, by the numbers as read', () => {
        const result = edit([
            { block: 7, remove: true },
            { block: 1, after: 2 },
            { block: 9, after: 0 },
        ]);
        expect(
            readNoteBlocks(result.content)!.blocks.map((block) => block.text),
        ).toEqual([
            'call Tom',
            '**Text:** [^(KJV) Isaiah 53:5] and [@Mary]',
            'Grace Alone',
            'first point',
            'second point',
            'Love is patient',
            '(kept inside the note)',
            '(KJV) John 1:1 — (1): In the beginning',
            'print notes',
        ]);
        expect(result.summary).toBe('blocks: 1 removed, 2 moved');
    });

    test('the last item of a list removed takes its list with it', () => {
        const result = edit([
            { block: 9, remove: true },
            { block: 10, remove: true },
        ]);
        const types = rootOf(result.content).children.map(
            (one: any) => one.type,
        );
        // Only the bullet list is left.
        expect(types.filter((type: string) => type === 'list')).toHaveLength(1);
    });

    test('a line break written out as \\n is the line break it meant', () => {
        expect(toRealLineBreaks('a\\nb')).toBe('a\nb');
        const result = edit([{ block: 1, text: 'Grace\\nAlone' }]);
        expect(
            rootOf(result.content).children[0].children.map((one: any) => {
                return one.type;
            }),
        ).toEqual(['text', 'linebreak', 'text']);
    });

    test('a mark opened and never closed is a plain character', () => {
        const result = edit([{ block: 1, text: '5 * 4 is **twenty**' }]);
        expect(rootOf(result.content).children[0].children).toEqual([
            text('5 * 4 is '),
            text('twenty', 1),
        ]);
    });

    test('a link keeps its address', () => {
        const result = edit([
            { block: 1, text: 'See [the site](https://example.com) now' },
        ]);
        const link = rootOf(result.content).children[0].children[1];
        expect(link).toMatchObject({
            type: 'link',
            url: 'https://example.com',
            children: [text('the site')],
        });
        expect(readNoteBlocks(result.content)!.blocks[0].text).toBe(
            'See [the site](https://example.com) now',
        );
    });

    test('the title changes alone', () => {
        const result = edit([], { title: '  Sunday   sermon ' });
        expect(result.title).toBe('Sunday sermon');
        expect(result.content).toBe(CONTENT);
        expect(result.isChanged).toBe(true);
    });

    test('an empty note takes new blocks from the top', () => {
        const result = applyNoteEdit({
            content: '',
            changes: [
                { after: 0, kind: 'h1', text: 'Notes' },
                { after: 0, text: 'first line' },
            ],
        });
        expect(
            'content' in result &&
                readNoteBlocks(result.content)!.blocks.map(
                    (block) => block.text,
                ),
        ).toEqual(['Notes', 'first line']);
    });
});

describe('what a change is refused for', () => {
    test('words for a fixed block, or a new kind for it', () => {
        expect(reasonOf([{ block: 6, text: 'a picture' }])).toContain(
            'is a picture',
        );
        expect(reasonOf([{ block: 8, kind: 'paragraph' }])).toContain(
            'is a passage',
        );
    });

    test('a "new" block that is a block already there', () => {
        expect(reasonOf([{ after: 2, text: 'first point' }])).toContain(
            "block 3's words",
        );
        // Unless that block is changed in the same call.
        expect(
            edit([
                { block: 3, remove: true },
                { after: 1, kind: 'h2', text: 'first point' },
            ]).isChanged,
        ).toBe(true);
    });

    // BN-44: a line the note has already, added on purpose -- the refusal
    // says how, and `again` adds it with the twin left as it was.
    test('the same words again, on purpose', () => {
        expect(reasonOf([{ after: 2, text: 'first point' }])).toContain(
            '`again: true`',
        );
        const result = edit([
            { after: 10, kind: 'paragraph', text: 'first point', again: true },
        ]);
        expect(result.isChanged).toBe(true);
        const blocks = readNoteBlocks(result.content)!.blocks;
        expect(
            blocks.filter((block) => {
                return block.text === 'first point';
            }).length,
        ).toBe(2);
        expect(blocks.at(-1)?.text).toBe('first point');
    });

    test('a block named twice, out of range, or with nothing to change', () => {
        expect(
            reasonOf([
                { block: 1, text: 'a' },
                { block: 1, remove: true },
            ]),
        ).toContain('named twice');
        expect(reasonOf([{ block: 99, text: 'a' }])).toContain('1 to 10');
        expect(reasonOf([{ block: 1 }])).toContain('says nothing');
        expect(reasonOf([{ after: 3 }])).toContain('needs its words');
        expect(reasonOf([{ after: 3, kind: 'bogus', text: 'x' }])).toContain(
            'kind is one of',
        );
        expect(
            reasonOf([{ after: 3, kind: 'video', text: 'not a link' }]),
        ).toContain('YouTube link');
        expect(reasonOf([{ after: 3, kind: 'passage' }])).toContain('`ref`');
        expect(reasonOf([{ text: 'x' }])).toContain('`block`');
    });

    test('an older note, and a title that is no title', () => {
        expect(
            'reason' in applyNoteEdit({ content: '<p>old</p>', changes: [] }),
        ).toBe(true);
        expect(reasonOf([], { title: '   ' })).toContain('title');
    });
});

// Seen live 2026-11-08: "tidy it into headings" turned a paragraph into a
// heading of other words, and the paragraph was gone.
describe('a change that would lose a block of words', () => {
    const wordy = JSON.stringify({
        root: {
            ...genNote().root,
            children: [
                paragraph([
                    text('God loves us before we do anything for him today'),
                ]),
            ],
        },
    });

    test('a block made a heading with other words is refused', () => {
        const result = applyNoteEdit({
            content: wordy,
            changes: [{ block: 1, kind: 'h2', text: 'The nature of grace' }],
        });
        expect('reason' in result && result.reason).toContain(
            'would lose its own words',
        );
    });

    test('its kind alone, or its words kept, is a change like any other', () => {
        for (const change of [
            { block: 1, kind: 'h2' },
            {
                block: 1,
                kind: 'bullet',
                text: 'God loves us before we do **anything** for him today',
            },
        ]) {
            expect(
                'content' in
                    applyNoteEdit({ content: wordy, changes: [change] }),
            ).toBe(true);
        }
    });
});

// 2026-11-08, the user: "check why chatbot can't help increase text size" --
// a note's text size, the way the editor's own size box writes it.
describe('a block at another text size', () => {
    function sizesOf(content: string, index: number) {
        const block = rootOf(content).children[index];
        const sizes: string[] = [];
        const visit = (node: any) => {
            if (typeof node.text === 'string') {
                sizes.push(node.style);
                return;
            }
            (node.children ?? []).forEach(visit);
        };
        visit(block);
        return sizes;
    }

    test('larger scales each run from its own size, the block from its kind', () => {
        const result = edit([
            { block: 1, size: 'larger' },
            { block: 2, size: 'larger' },
        ]);
        // The h1 had no size of its own: 24px, the editor's, made larger.
        // The fixture's runs carry 20px; the mentions carry none (15px).
        expect(sizesOf(result.content, 0)).toEqual(['font-size: 25px;']);
        expect(sizesOf(result.content, 1)).toEqual([
            'font-size: 25px;',
            'font-size: 19px;',
            'font-size: 25px;',
            'font-size: 19px;',
        ]);
        expect(rootOf(result.content).children[1].textStyle).toBe(
            'font-size: 25px;',
        );
        // Every other block untouched.
        expect(JSON.stringify(rootOf(result.content).children[2])).toBe(
            JSON.stringify(rootOf(CONTENT).children[2]),
        );
    });

    test('a size in px sets every run, kept within the editor’s 8 to 72', () => {
        const result = edit([{ block: 3, size: 30 }]);
        const list = rootOf(result.content).children[2];
        expect(list.children[0].children[0].style).toBe('font-size: 30px;');
        // The other item of the list is another block.
        expect(list.children[1].children[0].style).toBe(STYLE);
        expect(reasonOf([{ block: 3, size: 100 }])).toContain('8 to 72');
        expect(reasonOf([{ block: 3, size: 'huge' }])).toContain('"larger"');
        // A passage is never given words, but its words take a size.
        const passage = rootOf(edit([{ block: 8, size: 20 }]).content)
            .children[6];
        expect(passage.children[1].children[0].children[0].style).toContain(
            'font-size: 20px;',
        );
        expect(reasonOf([{ block: 8, size: 20, text: 'x' }])).toContain(
            'is a passage',
        );
        // Repeated, it stops at the largest the editor allows.
        let content = CONTENT;
        for (let index = 0; index < 12; index++) {
            const step = applyNoteEdit({
                content,
                changes: [{ block: 1, size: 'larger' }],
            });
            content = 'content' in step ? step.content : content;
        }
        expect(sizesOf(content, 0)).toEqual(['font-size: 72px;']);
    });

    test('a new block can come at a size too', () => {
        const result = edit([{ after: 0, kind: 'h2', text: 'Big', size: 40 }]);
        // Its words took the note's own style (20px), then the size asked.
        expect(sizesOf(result.content, 0)).toEqual(['font-size: 40px;']);
    });
});

// BN-35 (2026-11-08): three blocks of a note in the dev data folder came out
// changed when given their own words back -- a space inside a bold run moved
// out of it, a comment's mark was dropped, a code block's colouring was
// flattened. The mark-up says none of them; the block keeps its nodes.
describe('a block given its own words back', () => {
    const MARK = {
        children: [text('Let there be light')],
        direction: null,
        format: '',
        indent: 0,
        type: 'mark',
        version: 1,
        ids: ['comment-1'],
    };
    const highlight = (words: string, highlightType?: string) => {
        return {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: words,
            type: 'code-highlight',
            version: 1,
            ...(highlightType === undefined ? {} : { highlightType }),
        };
    };
    const OWN_CONTENT = JSON.stringify({
        root: {
            children: [
                paragraph([
                    text('Theme: ', 1),
                    text('God '),
                    text('creates', 1),
                    text(', orders and speaks.'),
                ]),
                paragraph([
                    text('Comment anchor: '),
                    MARK,
                    text(' is the phrase to revisit.'),
                ]),
                {
                    children: [
                        highlight('#', 'punctuation'),
                        highlight(' Genesis 1 Study', 'title'),
                        { type: 'linebreak', version: 1 },
                        highlight('- creation, light'),
                    ],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'code',
                    version: 1,
                    language: 'markdown',
                },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
        },
    });
    const ownBlocks = readNoteBlocks(OWN_CONTENT)!.blocks;

    test.each(ownBlocks.map((block) => [block.n, block.kind, block.text]))(
        'block %s (%s) is left byte for byte',
        (n, _kind, words) => {
            const result = applyNoteEdit({
                content: OWN_CONTENT,
                changes: [{ block: n, text: words }],
            });
            if ('reason' in result) {
                throw new Error(result.reason);
            }
            expect(result.content).toBe(OWN_CONTENT);
            expect(result.isChanged).toBe(false);
            expect(result.summary).not.toContain('new words');
        },
    );

    test('with a colour, the comment keeps its mark and the words go red', () => {
        const result = applyNoteEdit({
            content: OWN_CONTENT,
            changes: [{ block: 2, text: ownBlocks[1].text, color: 'red' }],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const block = rootOf(result.content).children[1];
        const mark = block.children.find((child: any) => {
            return child.type === 'mark';
        });
        expect(mark?.ids).toEqual(['comment-1']);
        expect(JSON.stringify(block)).toContain('color: red');
        expect(result.summary).not.toContain('new words');
    });

    test('words that differ are still new words', () => {
        const result = applyNoteEdit({
            content: OWN_CONTENT,
            changes: [{ block: 1, text: '**Theme:** God makes light.' }],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(result.summary).toContain('new words');
        expect(result.content).not.toBe(OWN_CONTENT);
    });
});
