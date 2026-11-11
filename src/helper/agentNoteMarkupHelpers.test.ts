import { describe, expect, test } from 'vitest';

import {
    chainSectionAdds,
    checkHasNoteMarkup,
    expandPassageChanges,
    expandSectionAdds,
    readHeadingMarks,
    stripHeadingKindLabel,
    toNoteAddChanges,
    toUnfoundVersesAsWords,
} from './agentNoteMarkupHelpers';
import { applyNoteEdit, readNoteBlocks } from './agentNoteBlockHelpers';

// What gemma4:cloud wrote under "make a bible note for me" in a Reader tab
// on Genesis 2 (2026-11-08), as an `add` would be handed it.
const MODEL_NOTE = [
    '**Title: The Creation of Man and the Institution of Marriage**',
    '',
    '## Key Verses',
    '- **Genesis 2:7:** The origin of man, formed from the dust.',
    '- **Genesis 2:24:** The divine foundation of marriage.',
    '',
    '> Therefore shall a man leave his father and his mother',
    '1. Read the chapter',
    '2. Pray',
    '- [x] Done',
    '- [ ] Share it',
    '---',
    'Read [^Genesis 2:7] again.',
].join('\n');

describe('checkHasNoteMarkup', () => {
    test('plain words are written as before', () => {
        expect(checkHasNoteMarkup('Line one\nTwo')).toBe(false);
        expect(checkHasNoteMarkup('5 * 3 is 15, not -2')).toBe(false);
        expect(checkHasNoteMarkup('')).toBe(false);
    });

    test('a block mark at a line start, an inline mark or a rule is mark-up', () => {
        for (const text of [
            '# Sunday',
            'Intro\n## Points',
            '- grace',
            '* faith',
            '1. first',
            '> a quote',
            'Some **bold** words',
            'Read [^John 3:16]',
            'Ask [@Moses]',
            'See [the site](https://example.com)',
            'a\n---\nb',
            'a\r\n- b',
        ]) {
            expect(checkHasNoteMarkup(text), text).toBe(true);
        }
    });
});

describe('toNoteAddChanges', () => {
    test('a block a line, its kind off the line start, the title line left out', () => {
        expect(
            toNoteAddChanges(
                MODEL_NOTE,
                'The Creation of Man and the Institution of Marriage',
            ),
        ).toEqual([
            { after: 0, kind: 'h2', text: 'Key Verses' },
            {
                after: 0,
                kind: 'bullet',
                text: '**Genesis 2:7:** The origin of man, formed from the dust.',
            },
            {
                after: 0,
                kind: 'bullet',
                text: '**Genesis 2:24:** The divine foundation of marriage.',
            },
            {
                after: 0,
                kind: 'quote',
                text: 'Therefore shall a man leave his father and his mother',
            },
            { after: 0, kind: 'number', text: 'Read the chapter' },
            { after: 0, kind: 'number', text: 'Pray' },
            { after: 0, kind: 'check', text: 'Done', checked: true },
            { after: 0, kind: 'check', text: 'Share it', checked: false },
            { after: 0, kind: 'rule' },
            { after: 0, kind: 'paragraph', text: 'Read [^Genesis 2:7] again.' },
        ]);
    });

    test('a first heading that is the title is left out, another one kept', () => {
        expect(toNoteAddChanges('# Sunday\nGrace', 'sunday')).toEqual([
            { after: 0, kind: 'paragraph', text: 'Grace' },
        ]);
        expect(toNoteAddChanges('# Monday\nGrace', 'Sunday')).toEqual([
            { after: 0, kind: 'h1', text: 'Monday' },
            { after: 0, kind: 'paragraph', text: 'Grace' },
        ]);
        // No title to compare with: the line stays.
        expect(toNoteAddChanges('# Sunday')).toEqual([
            { after: 0, kind: 'h1', text: 'Sunday' },
        ]);
        expect(toNoteAddChanges('\n\n', 'Sunday')).toEqual([]);
    });

    test('the changes build a note of the editor’s own blocks', () => {
        const changes = toNoteAddChanges(
            MODEL_NOTE.replace('Read [^Genesis 2:7] again.', 'Amen'),
            'The Creation of Man and the Institution of Marriage',
        );
        const result = applyNoteEdit({ content: '', changes });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const read = readNoteBlocks(result.content);
        expect(
            read?.blocks.map((block) => {
                return [block.kind, block.text];
            }),
        ).toEqual([
            ['h2', 'Key Verses'],
            [
                'bullet',
                '**Genesis 2:7:** The origin of man, formed from the dust.',
            ],
            ['bullet', '**Genesis 2:24:** The divine foundation of marriage.'],
            ['quote', 'Therefore shall a man leave his father and his mother'],
            ['number', 'Read the chapter'],
            ['number', 'Pray'],
            ['check', 'Done'],
            ['check', 'Share it'],
            ['rule', ''],
            ['paragraph', 'Amen'],
        ]);
        // Bold is a FORMAT on the text node, never the asterisks.
        const root = JSON.parse(result.content).root;
        const firstItem = root.children[1].children[0];
        expect(firstItem.children[0]).toMatchObject({
            text: 'Genesis 2:7:',
            format: 1,
        });
        expect(read?.blocks[6].checked).toBe(true);
        expect(read?.blocks[7].checked).toBe(false);
    });
});

// 2026-11-08, the user, with a note chat that answered _new page_ under a
// lesson by asking which way to translate: _chatbot should understand and
// can append the lesson content to new section_.
describe('a lesson appended to a note as a section', () => {
    const NOTE = applyNoteEdit({
        content: '',
        changes: [{ after: 0, kind: 'paragraph', text: 'Opening prayer' }],
    }) as { content: string };

    test('a page break, then a section: the editor’s blocks, in order, at the end', () => {
        const result = applyNoteEdit({
            content: NOTE.content,
            changes: [
                { after: 1, kind: 'page-break' },
                {
                    after: 1,
                    kind: 'section',
                    text: '## Key words\n- **Formed**: shaped like clay\n- **Living soul**: body and breath\n> And man became a living soul',
                },
            ],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(
            readNoteBlocks(result.content)?.blocks.map((block) => {
                return [block.kind, block.text];
            }),
        ).toEqual([
            ['paragraph', 'Opening prayer'],
            ['page-break', ''],
            ['h2', 'Key words'],
            ['bullet', '**Formed**: shaped like clay'],
            ['bullet', '**Living soul**: body and breath'],
            ['quote', 'And man became a living soul'],
        ]);
    });

    test('a paragraph add written as mark-up lines is read the same; plain lines stay one paragraph', () => {
        const lined = applyNoteEdit({
            content: NOTE.content,
            changes: [{ after: 1, text: '### Points\n1. one\n2. two' }],
        });
        if ('reason' in lined) {
            throw new Error(lined.reason);
        }
        expect(
            readNoteBlocks(lined.content)?.blocks.map((block) => block.kind),
        ).toEqual(['paragraph', 'h3', 'number', 'number']);
        // Two plain lines are one paragraph with a line break, as before.
        const plain = applyNoteEdit({
            content: NOTE.content,
            changes: [{ after: 1, text: 'Line one\nLine two' }],
        });
        if ('reason' in plain) {
            throw new Error(plain.reason);
        }
        expect(readNoteBlocks(plain.content)?.blocks).toHaveLength(2);
    });

    test('a section takes the look asked for; an empty one is refused', () => {
        const sized = expandSectionAdds([
            {
                after: 3,
                kind: 'section',
                text: '# A\n- b',
                color: 'red',
                checked: true,
            },
        ]);
        expect(sized).toEqual([
            { color: 'red', after: 3, kind: 'h1', text: 'A' },
            { color: 'red', after: 3, kind: 'bullet', text: 'b' },
        ]);
        const empty = applyNoteEdit({
            content: NOTE.content,
            changes: [{ after: 1, kind: 'section', text: '\n\n' }],
        });
        expect('reason' in empty && empty.reason).toMatch(/needs its words/);
    });
});

describe('toUnfoundVersesAsWords', () => {
    test('a verse no Bible gave is left as its words, a found one kept', () => {
        const changes = [
            {
                after: 0,
                kind: 'paragraph',
                text: 'See [^John 3:16] and [^Hezekiah 9:9]',
            },
            { after: 0, kind: 'rule' },
        ];
        const out = toUnfoundVersesAsWords(changes, new Set(['John 3:16']));
        expect(out[0].text).toBe('See [^John 3:16] and Hezekiah 9:9');
        // Untouched changes are the same objects.
        expect(out[1]).toBe(changes[1]);
        expect(
            toUnfoundVersesAsWords(
                changes,
                new Set(['John 3:16', 'Hezekiah 9:9']),
            )[0],
        ).toBe(changes[0]);
    });
});

// Seen live 2026-11-08: the model wrote a section's line breaks as the two
// characters it had been shown.
test('a section written with escaped line breaks is still its lines', () => {
    expect(
        expandSectionAdds([
            { after: 2, kind: 'section', text: String.raw`## A\n- b\n- c` },
        ]).map((change) => change.kind),
    ).toEqual(['h2', 'bullet', 'bullet']);
});

// 2026-11-10, the goal _chatbot completely smart enough to help prepare a
// best preaching lesson_: a lesson opens on its passage READ, so a verse
// token alone on its line is the passage printed whole.
describe('a verse token alone on its line', () => {
    test('is the passage itself; among words or in a list, a mention', () => {
        expect(
            toNoteAddChanges(
                [
                    '[^John 10:11-18]',
                    '> [^(KJV) Psalm 23]',
                    '**[^Luke 15:4-7]**',
                    '## Big idea',
                    'Read [^John 10:11] again.',
                    '- [^John 10:14] he knows us',
                ].join('\n'),
            ),
        ).toEqual([
            { after: 0, kind: 'passage', ref: 'John 10:11-18' },
            { after: 0, kind: 'passage', ref: '(KJV) Psalm 23' },
            { after: 0, kind: 'passage', ref: 'Luke 15:4-7' },
            { after: 0, kind: 'h2', text: 'Big idea' },
            {
                after: 0,
                kind: 'paragraph',
                text: 'Read [^John 10:11] again.',
            },
            { after: 0, kind: 'bullet', text: '[^John 10:14] he knows us' },
        ]);
    });

    test('a section put into a note reads it the same way', () => {
        expect(
            expandSectionAdds([
                {
                    after: 3,
                    kind: 'section',
                    text: '## Text\n[^John 10:11-18]\n## Big idea\nHe gives.',
                },
            ]),
        ).toEqual([
            { after: 3, kind: 'h2', text: 'Text' },
            { after: 3, kind: 'passage', ref: 'John 10:11-18' },
            { after: 3, kind: 'h2', text: 'Big idea' },
            { after: 3, kind: 'paragraph', text: 'He gives.' },
        ]);
    });

    test('a passage no Bible could give is a line of its reference', () => {
        expect(
            toUnfoundVersesAsWords(
                [
                    { after: 0, kind: 'passage', ref: 'Hezekiah 9:9' },
                    { after: 0, kind: 'passage', ref: 'John 10:11-18' },
                ],
                new Set(['John 10:11-18']),
            ),
        ).toEqual([
            { after: 0, kind: 'paragraph', text: 'Hezekiah 9:9' },
            { after: 0, kind: 'passage', ref: 'John 10:11-18' },
        ]);
    });
});

describe('a paragraph that is one passage token', () => {
    test('a range or a chapter is the passage; one verse stays a chip', () => {
        expect(
            expandSectionAdds([
                { after: 0, kind: 'paragraph', text: '[^John 10:11-18]' },
                { after: 0, text: '[^(KJV) Psalm 23]', color: 'navy' },
                { after: 0, kind: 'paragraph', text: '[^John 10:11]' },
                { after: 0, kind: 'paragraph', text: 'Read [^John 10:1-5]' },
            ]),
        ).toEqual([
            { after: 0, kind: 'passage', ref: 'John 10:11-18' },
            { after: 0, kind: 'passage', ref: '(KJV) Psalm 23', color: 'navy' },
            { after: 0, kind: 'paragraph', text: '[^John 10:11]' },
            { after: 0, kind: 'paragraph', text: 'Read [^John 10:1-5]' },
        ]);
    });
});

// BN-67 (2026-11-10): what a model writes when it finishes a sermon.
describe("a heading's marks in its words", () => {
    test('come off, and say the level where no heading kind is given', () => {
        expect(
            readHeadingMarks({ block: 3, text: '## 1. Seek' }, 'paragraph'),
        ).toEqual({ block: 3, kind: 'h2', text: '1. Seek' });
        expect(
            readHeadingMarks({ block: 3, kind: 'h3', text: '## Seek' }, 'h2'),
        ).toEqual({ block: 3, kind: 'h3', text: 'Seek' });
        expect(
            readHeadingMarks(
                { after: 1, kind: 'h2', text: '## Big idea' },
                null,
            ),
        ).toEqual({ after: 1, kind: 'h2', text: 'Big idea' });
    });
    test('stay where they are words: code, a quote, a list, a paragraph add', () => {
        for (const [change, kind] of [
            [{ block: 2, text: '# install it' }, 'code'],
            [{ block: 2, text: '# a line' }, 'quote'],
            [{ block: 2, kind: 'bullet', text: '# a line' }, 'bullet'],
            [{ after: 2, kind: 'paragraph', text: '## Next' }, null],
            [{ block: 2, text: '## two\nlines' }, 'paragraph'],
        ] as const) {
            expect(readHeadingMarks(change as any, kind)).toBe(change);
        }
    });

    // BN-80 (2026-11-10): two headings of a reviewed sermon read "h2: …",
    // the kind label the note is read with copied into the words.
    test('lose the kind label the note was read with', () => {
        expect(stripHeadingKindLabel('h2: "1. The Plea for Mercy"')).toBe(
            '1. The Plea for Mercy',
        );
        expect(stripHeadingKindLabel('H2O and the flood')).toBe(
            'H2O and the flood',
        );
        expect(
            readHeadingMarks({ block: 4, text: 'h2: 1. Lost' }, 'h2'),
        ).toEqual({ block: 4, text: '1. Lost' });
        expect(
            readHeadingMarks(
                { after: 3, kind: 'h2', text: '## h2: "Grace"' },
                null,
            ),
        ).toEqual({ after: 3, kind: 'h2', text: 'Grace' });
        // A paragraph's words are its own.
        const words = { block: 5, text: 'h2: a note to self' };
        expect(readHeadingMarks(words, 'paragraph')).toBe(words);
        expect(
            toNoteAddChanges('## h2: Big idea\nIt is grace.', '')[0],
        ).toEqual(expect.objectContaining({ kind: 'h2', text: 'Big idea' }));
    });
});

describe('new blocks numbered as they will stand, a heading with its words', () => {
    test('are one section: each group after the one before', () => {
        const changes = chainSectionAdds([
            { after: 3, kind: 'h2', text: 'Background' },
            { after: 4, kind: 'paragraph', text: 'Who and when.' },
            { after: 5, kind: 'h2', text: 'Introduction' },
            { after: 6, kind: 'paragraph', text: 'A question.' },
            { block: 4, text: '1. Seek' },
            { after: 4, kind: 'paragraph', text: 'What it means.' },
        ]);
        expect(changes.map((change) => change.chain === true)).toEqual([
            false,
            true,
            true,
            true,
            false,
            false,
        ]);
    });
    test('a heading over each block, or a line under each, stay as numbered', () => {
        const headings = [
            { after: 1, kind: 'h3', text: 'One' },
            { after: 2, kind: 'h3', text: 'Two' },
        ];
        expect(chainSectionAdds(headings)).toEqual(headings);
        const lines = [
            { after: 1, kind: 'paragraph', text: 'Under one.' },
            { after: 2, kind: 'paragraph', text: 'Under two.' },
        ];
        expect(chainSectionAdds(lines)).toEqual(lines);
    });

    // Seen live the same day: told one section a place, the model put each
    // point's words after its own heading -- as read, and right.
    test('sections, one a place, stay as numbered', () => {
        const sections = expandSectionAdds([
            {
                after: 3,
                kind: 'section',
                text: '## Background\nWho and when.',
            },
            { after: 4, kind: 'section', text: 'What it means.\nAn example.' },
            { after: 5, kind: 'section', text: 'What it means.\nHow to live.' },
        ]);
        expect(chainSectionAdds(sections)).toEqual(sections);
    });
});

describe('a block changed into one passage token', () => {
    const ownText = (block: number) => {
        return block === 1
            ? 'Sermon on Matthew 6:25-34'
            : '[^(KJV) John 3:1-8]';
    };
    test('gives way to the passage, in its place', () => {
        expect(
            expandPassageChanges(
                [{ block: 1, kind: 'paragraph', text: '[^Matthew 6:25-34]' }],
                ownText,
            ),
        ).toEqual([
            { after: 0, kind: 'passage', ref: 'Matthew 6:25-34' },
            { block: 1, remove: true },
        ]);
    });
    test("one verse, a token among words, or its own words stay the block's", () => {
        for (const change of [
            { block: 2, text: '[^John 3:16]' },
            { block: 2, text: 'Read [^John 3:1-8]' },
            { block: 2, kind: 'h2', text: '[^John 3:1-8]' },
            // Its own range chip given back (`note-roundtrip.mjs`, a note
            // of the dev data folder): byte for byte, no passage.
            { block: 2, text: '[^(KJV) John 3:1-8]' },
        ]) {
            expect(expandPassageChanges([change], ownText)).toEqual([change]);
        }
    });
});
