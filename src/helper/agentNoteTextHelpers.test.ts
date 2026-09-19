import { describe, expect, it } from 'vitest';

import {
    readLexicalMentions,
    readLexicalText,
    toFirstWords,
    toLexicalContent,
} from './agentNoteTextHelpers';

// Nodes copied from a real note file the Bible Notes window wrote, trimmed to
// the fields that matter: this is the shape `parseEditorState` restores.
const REAL_NOTE_CONTENT = JSON.stringify({
    root: {
        children: [
            {
                children: [
                    {
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: 'Khmer BibleNote Study: Genesis 1',
                        type: 'text',
                        version: 1,
                    },
                ],
                direction: null,
                format: '',
                indent: 0,
                type: 'heading',
                version: 1,
                tag: 'h1',
            },
            {
                children: [
                    {
                        detail: 1,
                        format: 0,
                        mode: 'segmented',
                        style: '',
                        text: '(KJV) Genesis 1:1-3',
                        type: 'mention',
                        version: 1,
                        mentionData: '(1): In the beginning…',
                        mentionId: 'kjv-genesis-1-1-3',
                        mentionKind: 'bible-verse',
                        mentionName: '(KJV) Genesis 1:1-3',
                    },
                    { type: 'linebreak', version: 1 },
                    {
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text: 'In the beginning God created',
                        type: 'text',
                        version: 1,
                    },
                    {
                        children: [
                            {
                                detail: 0,
                                format: 0,
                                mode: 'normal',
                                style: '',
                                text: ' the heaven',
                                type: 'text',
                                version: 1,
                            },
                        ],
                        type: 'link',
                        url: 'https://example.com',
                        version: 1,
                    },
                ],
                direction: null,
                format: '',
                indent: 0,
                type: 'paragraph',
                version: 1,
                textFormat: 0,
                textStyle: '',
            },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
    },
});

describe('toLexicalContent', () => {
    it("writes a note in the editor's own shape, a paragraph a line", () => {
        const state = JSON.parse(toLexicalContent('Welcome\nto church'));
        expect(state.root.type).toBe('root');
        expect(state.root.children).toHaveLength(2);
        expect(state.root.children[0]).toMatchObject({
            type: 'paragraph',
            version: 1,
            textFormat: 0,
            textStyle: '',
            children: [{ type: 'text', text: 'Welcome', mode: 'normal' }],
        });
    });

    // A new note in the panel holds "" until somebody types, and the editor
    // restores "" as an empty note.
    it('writes no text as no content', () => {
        expect(toLexicalContent('')).toBe('');
        expect(toLexicalContent('  \n ')).toBe('');
    });

    it('keeps a blank line as an empty paragraph', () => {
        const state = JSON.parse(toLexicalContent('one\n\nthree'));
        expect(state.root.children[1].children).toEqual([]);
    });
});

describe('readLexicalText', () => {
    it('round-trips what it writes, blank lines and Windows line ends', () => {
        for (const text of [
            'Welcome',
            'line one\nline two',
            'line one\n\nline three',
            'ក្រោកឡើង ហើយភ្លឺឡើង',
        ]) {
            expect(readLexicalText(toLexicalContent(text))).toBe(text);
        }
        expect(readLexicalText(toLexicalContent('a\r\nb'))).toBe('a\nb');
    });

    it("reads a real note's words, a mention by its name", () => {
        expect(readLexicalText(REAL_NOTE_CONTENT)).toBe(
            [
                'Khmer BibleNote Study: Genesis 1',
                '(KJV) Genesis 1:1-3',
                'In the beginning God created the heaven',
            ].join('\n'),
        );
    });

    // Unreadable content is no words, never an error: a list of notes must
    // not fail because one of them is damaged.
    it('reads anything else as no words', () => {
        for (const content of [
            '',
            'plain words',
            '{not json',
            '{}',
            null,
            42,
        ]) {
            expect(readLexicalText(content)).toBe('');
        }
    });
});

describe('readLexicalMentions', () => {
    it('names each passage a note mentions, once', () => {
        const twice = JSON.stringify({
            root: {
                type: 'root',
                children: [
                    JSON.parse(REAL_NOTE_CONTENT).root.children[1],
                    JSON.parse(REAL_NOTE_CONTENT).root.children[1],
                ],
            },
        });
        expect(readLexicalMentions(twice)).toEqual(['(KJV) Genesis 1:1-3']);
        expect(readLexicalMentions('')).toEqual([]);
    });
});

describe('toFirstWords', () => {
    it('shows the start of a note on one line', () => {
        expect(toFirstWords('one\n two   three')).toBe('one two three');
        expect(toFirstWords('x'.repeat(100), 10)).toBe(`${'x'.repeat(10)}…`);
    });
});
