import { describe, expect, it } from 'vitest';

import { readPressedCreateKind } from './createKindHelpers';

// EC-581, the user: _but if user click and choose step by step explicitely
// it should skip the confirmation_ -- and a kind read where none was chosen
// would make the wrong thing with nothing asked.
describe('readPressedCreateKind', () => {
    it('reads a Bible note chosen by a press', () => {
        for (const press of [
            'Make a Bible note',
            'Bible note',
            'Save it as a Bible Note',
            'New Bible Note',
            'Note',
            'A note',
            'Make it a note',
            'Save as a new note',
            '  MAKE   A   BIBLE-NOTE ',
        ]) {
            expect(readPressedCreateKind([press]), press).toBe('note');
        }
    });

    it('reads a Markdown file chosen by a press', () => {
        for (const press of [
            'Make a Markdown file',
            'Create a .md file',
            'An md file',
            'Study file',
            'Save it in Resources',
            // Where it is kept is no note.
            'Create a Markdown file in Bible Notes',
        ]) {
            expect(readPressedCreateKind([press]), press).toBe('markdown');
        }
    });

    it('reads no kind where none was chosen', () => {
        for (const press of [
            // A note IN the study, a list, a place, an answer.
            'Add notes on verse 3',
            'Add a note about Herod',
            'Show the resources for John 3',
            'Resources',
            'Bible Notes',
            'In Bible Notes',
            'Yes',
            '',
            // Both named: the question, not an answer.
            'Bible note or Markdown file',
            // A question about a kind.
            'How do I make a Bible note?',
            'Can you save it as a Markdown file?',
            // A sentence, not an option.
            `Make a Bible note ${'about the voice in the wilderness '.repeat(5)}`,
        ]) {
            expect(readPressedCreateKind([press]), press).toBe(null);
        }
    });

    it('reads the labels the window draws in its own language', () => {
        const words = { note: ['Prvquel Quellon'], markdown: ['Zarvenno'] };
        expect(readPressedCreateKind(['Tavu prvquel quellon'], words)).toBe(
            'note',
        );
        expect(readPressedCreateKind(['Tavu Zarvenno'], words)).toBe(
            'markdown',
        );
        expect(readPressedCreateKind(['Zarvenno Prvquel Quellon'], words)).toBe(
            null,
        );
        // A label of one letter is no label.
        expect(
            readPressedCreateKind(['x marks'], { note: ['x'], markdown: [] }),
        ).toBe(null);
    });

    it('takes the press and its English together: one kind, or none', () => {
        const words = { note: ['Prvquel Quellon'], markdown: ['Zarvenno'] };
        expect(
            readPressedCreateKind(
                ['Make a Bible note', 'Tavu Prvquel Quellon'],
                words,
            ),
        ).toBe('note');
        expect(
            readPressedCreateKind(['Make a Bible note', 'Tavu'], words),
        ).toBe('note');
        expect(
            readPressedCreateKind(
                ['Make a Bible note', 'Tavu Zarvenno'],
                words,
            ),
        ).toBe(null);
        expect(readPressedCreateKind([])).toBe(null);
    });
});
