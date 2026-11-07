import { describe, expect, test } from 'vitest';

import { toNoteContentText, toNoteFileText } from './noteFileTextHelpers';

// A note file a hand, an older editor or a broken save left odd: a node
// that is no node, and an entry of the list that is no note.

describe('a note body with something in it that is no node', () => {
    test('reads the words around it and nothing for it', () => {
        const content = JSON.stringify({
            root: {
                type: 'root',
                children: [
                    {
                        type: 'paragraph',
                        children: [{ text: 'Love one another' }, null, 42],
                    },
                ],
            },
        });
        expect(toNoteContentText(content)).toBe('Love one another');
    });
});

describe('a note file with entries that are no notes', () => {
    test('skips them and reads the notes', () => {
        const text = JSON.stringify({
            items: [
                null,
                'a stray line',
                {
                    title: 'Sunday',
                    content: JSON.stringify({
                        root: {
                            type: 'root',
                            children: [
                                {
                                    type: 'paragraph',
                                    children: [{ text: 'John 13:34' }],
                                },
                            ],
                        },
                    }),
                },
            ],
        });
        expect(toNoteFileText(text)).toBe('Note: Sunday\nJohn 13:34');
    });

    test('with nothing but such entries, says it has no notes', () => {
        expect(toNoteFileText(JSON.stringify({ items: [null, 7] }))).toBe(
            '(this note file has no notes in it)',
        );
    });
});
