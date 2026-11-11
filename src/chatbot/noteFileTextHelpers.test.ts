import { describe, expect, test } from 'vitest';

import {
    toBlankNoteReadFromFileText,
    toNoteContentText,
    toNoteFileText,
    toNoteItemFromFileText,
} from './noteFileTextHelpers';

// The editor's own tree, as a note file stores it: a JSON string inside JSON.
function toContent(children: any[]) {
    return JSON.stringify({ root: { type: 'root', children } });
}

function genText(text: string) {
    return { type: 'text', text };
}

describe('a Bible note file as words', () => {
    test('reads the editor tree as lines, not as JSON', () => {
        const content = toContent([
            { type: 'heading', tag: 'h1', children: [genText('Luke 6')] },
            {
                type: 'paragraph',
                children: [
                    {
                        type: 'mention',
                        text: '(KJV) Luke 6:27',
                        mentionData: 'Love your enemies',
                    },
                    { type: 'linebreak' },
                    genText('Love even those who hurt you.'),
                ],
            },
            {
                type: 'list',
                children: [
                    { type: 'listitem', children: [genText('pray')] },
                    { type: 'listitem', children: [genText('give')] },
                ],
            },
            // A pasted picture is its bytes: only that one is there.
            {
                type: 'paragraph',
                children: [{ type: 'image', src: 'data:image/png;base64,AA' }],
            },
        ]);
        expect(toNoteContentText(content)).toBe(
            '## Luke 6\n' +
                '(KJV) Luke 6:27\n' +
                'Love even those who hurt you.\n' +
                '- pray\n' +
                '- give\n' +
                '[picture]',
        );
    });

    test('takes an older note body as words, without its markup', () => {
        expect(toNoteContentText('<p>Hello <b>there</b></p>')).toBe(
            'Hello  there',
        );
    });

    test('lists each note, then each marked verse with its marks', () => {
        const file = JSON.stringify({
            metadata: { fileVersion: 1 },
            items: [
                {
                    title: 'Sermon',
                    content: toContent([
                        { type: 'paragraph', children: [genText('Grace')] },
                    ]),
                    metadata: { id: 1 },
                },
                // Nothing in it: not a note worth a line.
                { title: '', content: '', metadata: { id: 2 } },
                {
                    title: '(KJV) Luke 6:27',
                    content: '',
                    verseKey: '(KJV) LUK 6:27',
                    highlights: [{ text: 'Love your enemies' }],
                    comments: [{ text: 'enemies', comment: 'even them' }],
                    metadata: { id: 3 },
                },
            ],
        });
        expect(toNoteFileText(file)).toBe(
            'Note: Sermon\nGrace\n\n' +
                'Marked verse: (KJV) Luke 6:27\n' +
                '- highlighted: "Love your enemies"\n' +
                '- comment on "enemies": even them',
        );
    });

    test('is null for a file that is not a note file at all', () => {
        expect(toNoteFileText('not json')).toBeNull();
        expect(toNoteFileText('{"links": []}')).toBeNull();
        expect(toNoteFileText('{"items": []}')).toBe(
            '(this note file has no notes in it)',
        );
    });
});

// 2026-11-07: Open in Chatbot on a note row attaches THAT note.
describe('one note of a file, by its id', () => {
    const file = JSON.stringify({
        items: [
            {
                title: 'Sunday',
                content: JSON.stringify({
                    root: {
                        type: 'root',
                        children: [
                            {
                                type: 'heading',
                                children: [{ type: 'text', text: 'Grace' }],
                            },
                        ],
                    },
                }),
                metadata: { id: 0 },
            },
            { title: '  ', content: '', metadata: { id: 2 } },
            {
                title: 'John 3:16',
                verseKey: 'JHN 3:16',
                content: 'JHN 3:16',
                metadata: { id: 5 },
            },
        ],
    });

    test('is its title and its words', () => {
        expect(toNoteItemFromFileText(file, 0)).toEqual({
            title: 'Sunday',
            text: '## Grace',
        });
    });

    test('a note with no title or words is Unnamed and empty', () => {
        expect(toNoteItemFromFileText(file, 2)).toEqual({
            title: 'Unnamed',
            text: '(empty)',
        });
    });

    test('a marked verse, a missing id and a broken file are no note', () => {
        expect(toNoteItemFromFileText(file, 5)).toBeNull();
        expect(toNoteItemFromFileText(file, 9)).toBeNull();
        expect(toNoteItemFromFileText('not json', 0)).toBeNull();
        expect(toNoteItemFromFileText('{"x":1}', 0)).toBeNull();
    });
});

// BN-87 (2026-11-11): on a busy computer the note's window took over twenty
// seconds to open, the window's read of the note failed, and a lesson asked
// for went into a NEW note beside the empty one.
describe("an empty note's read, off its file", () => {
    const emptyParagraph = { type: 'paragraph', children: [] };
    const file = JSON.stringify({
        items: [
            { title: 'New', content: '', metadata: { id: 1 } },
            {
                title: 'Two lines',
                content: toContent([emptyParagraph, emptyParagraph]),
                metadata: { id: 2 },
            },
            {
                title: 'Words',
                content: toContent([
                    { type: 'paragraph', children: [genText('Grace')] },
                ]),
                metadata: { id: 3 },
            },
            {
                title: 'A picture',
                content: toContent([{ type: 'image', src: 'x' }]),
                metadata: { id: 4 },
            },
            {
                title: 'John 3:16',
                verseKey: 'JHN 3:16',
                content: '',
                metadata: { id: 5 },
            },
        ],
    });

    test('is the read the editor gives: its empty blocks', () => {
        expect(toBlankNoteReadFromFileText(file, 1, 'Default')).toEqual({
            file: 'Default',
            blockCount: 1,
            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
        });
        expect(
            toBlankNoteReadFromFileText(file, 2, 'Default')?.blockCount,
        ).toBe(2);
    });

    test('a note with words or a picture, a marked verse, none: no read', () => {
        for (const noteId of [3, 4, 5, 9]) {
            expect(toBlankNoteReadFromFileText(file, noteId, 'Default')).toBe(
                null,
            );
        }
        expect(toBlankNoteReadFromFileText('not json', 1, 'Default')).toBe(
            null,
        );
    });
});
