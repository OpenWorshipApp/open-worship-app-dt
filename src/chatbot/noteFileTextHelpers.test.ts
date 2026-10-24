import { describe, expect, test } from 'vitest';

import { toNoteContentText, toNoteFileText } from './noteFileTextHelpers';

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
