import { describe, expect, test } from 'vitest';

import {
    checkHasNoteMarkup,
    expandSectionAdds,
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
