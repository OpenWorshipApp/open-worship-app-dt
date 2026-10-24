import { describe, expect, it } from 'vitest';

import {
    collectPassageMarks,
    collectPassageNoteRefs,
    toPassageNoteRow,
    toPassageNotesFacts,
} from './agentPassageNoteHelpers';
import { toLexicalContent } from './agentNoteTextHelpers';

const GEN_8 = Array.from({ length: 22 }, (_, index) => {
    return `GEN 8:${index + 1}`;
});

function genHighlight(text: string) {
    return {
        filePath: '/notes/Default.own',
        noteItemId: 9,
        highlight: {
            id: `h-${text}`,
            start: 0,
            end: text.length,
            text,
            createdAt: '',
            updatedAt: '',
            color: 'yellow' as const,
        },
    };
}

describe('the notes that name a passage', () => {
    it('keeps each note once, with the passage verses it names', () => {
        const refMap = collectPassageNoteRefs(
            {
                'GEN 8:20': ['/notes/Study.own@3', '/notes/Default.own@9'],
                'GEN 8:21': ['/notes/Study.own@3'],
                'GEN 9:1': ['/notes/Study.own@4'],
            },
            GEN_8,
        );
        expect([...refMap]).toEqual([
            ['/notes/Study.own@3', ['GEN 8:20', 'GEN 8:21']],
            ['/notes/Default.own@9', ['GEN 8:20']],
        ]);
    });

    it('reads a note by its title and first words, never a verse item', () => {
        const row = toPassageNoteRow(
            'Study',
            {
                title: "Noah's altar",
                content: toLexicalContent(
                    'The first altar after the flood. Genesis 8:20',
                ),
                metadata: { id: 3 },
            },
            ['GEN 8:20'],
        );
        expect(row).toEqual({
            file: 'Study',
            title: "Noah's altar",
            verses: ['GEN 8:20'],
            text: 'The first altar after the flood. Genesis 8:20',
        });
        // A verse's marks are an item of their own: not a note.
        expect(
            toPassageNoteRow(
                'Default',
                { title: '', verseKey: '(KJV) GEN 8:11', metadata: { id: 9 } },
                ['GEN 8:11'],
            ),
        ).toBeNull();
        expect(toPassageNoteRow('Default', undefined, ['GEN 8:1'])).toBeNull();
    });
});

describe('the marks on a passage', () => {
    it('takes every Bible a verse was marked in, in the passage order', () => {
        const marks = collectPassageMarks(
            {
                '(ពគប) GEN 8:11': {
                    highlights: [genHighlight('ស្លឹកអូលីវ')],
                    comments: [],
                },
                '(KJV) GEN 8:1': {
                    highlights: [],
                    comments: [
                        {
                            filePath: '/notes/Default.own',
                            noteItemId: 8,
                            comment: {
                                id: 'c1',
                                start: 0,
                                end: 15,
                                text: 'God remembered',
                                comment: 'He never forgets us',
                                createdAt: '',
                                updatedAt: '',
                            },
                        },
                    ],
                },
                '(KJV) GEN 9:1': {
                    highlights: [genHighlight('be fruitful')],
                    comments: [],
                },
            },
            GEN_8,
        );
        expect(marks).toEqual([
            {
                verse: 'GEN 8:1',
                bible: 'KJV',
                highlighted: [],
                comments: [
                    { words: 'God remembered', comment: 'He never forgets us' },
                ],
            },
            {
                verse: 'GEN 8:11',
                bible: 'ពគប',
                highlighted: ['ស្លឹកអូលីវ'],
                comments: [],
            },
        ]);
    });
});

describe('what the record carries', () => {
    it('counts the verses carrying something, or is nothing', () => {
        expect(toPassageNotesFacts([], [])).toBeNull();
        const facts = toPassageNotesFacts(
            [
                {
                    file: 'Study',
                    title: 'Altar',
                    verses: ['GEN 8:20', 'GEN 8:21'],
                    text: '',
                },
            ],
            [
                {
                    verse: 'GEN 8:20',
                    bible: 'KJV',
                    highlighted: ['an altar'],
                    comments: [],
                },
                {
                    verse: 'GEN 8:11',
                    bible: 'KJV',
                    highlighted: ['an olive leaf'],
                    comments: [],
                },
            ],
        );
        expect(facts).toMatchObject({
            verseCount: 3,
            noteCount: 1,
            markCount: 2,
        });
    });
});
