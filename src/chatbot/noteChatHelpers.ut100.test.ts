/**
 * A Bible note conversation's pure rules (`noteChatHelpers.ts`) at their
 * edges: two attached notes of one name, the font box under a read, a
 * look-alike pair of unequal lengths, and whole-note style asks that are
 * too long or not a style.
 */
import { describe, expect, test } from 'vitest';

import {
    readNoteStyleAsk,
    resolveNoteEditTarget,
    restoreTypedWords,
    toNoteDocumentText,
} from './noteChatHelpers';

describe('which attached note a call names', () => {
    test('two attached notes of the same name are never guessed between', () => {
        const files = [
            { name: 'Sunday', filePath: 'C:\\a\\Default.own', noteId: 1 },
            { name: 'sunday ', filePath: 'C:\\b\\Default.own', noteId: 2 },
        ];
        expect(resolveNoteEditTarget({ note: 'SUNDAY' }, files)).toEqual({
            reason:
                'More than one attached note is called "SUNDAY": "Sunday", ' +
                '"sunday ". Name one of them exactly.',
        });
    });
});

describe('the note as the model reads it', () => {
    test("the font box's fonts end the read, for a font change", () => {
        const text = toNoteDocumentText({
            blockCount: 1,
            blocks: [{ n: 1, kind: 'paragraph', text: 'Grace' }],
            fonts: ['Arial', 'Georgia'],
        })!;
        expect(text.split('\n')).toEqual([
            'Blocks: 1',
            '1. paragraph: "Grace"',
            'Fonts: Arial, Georgia',
        ]);
        // No fonts, no line.
        expect(
            toNoteDocumentText({ blocks: [], fonts: [] })!.includes('Fonts'),
        ).toBe(false);
    });
});

describe('words put back to what was typed', () => {
    test('a pair of unequal lengths cannot keep places: the words are left as written', () => {
        expect(restoreTypedWords('xa', 'xbb', [['a', 'bb']])).toBe('xa');
    });
});

describe('a whole-note style asked in a short line', () => {
    test('a line longer than a style ask is the assistant’s', () => {
        const long = `Make all the text bold ${'and also please '.repeat(8)}`;
        expect(long.length).toBeGreaterThan(120);
        expect(readNoteStyleAsk(long)).toBeNull();
    });

    test('"make it" something that is neither a style nor a colour name', () => {
        expect(readNoteStyleAsk('Make all the text 20px')).toBeNull();
        expect(readNoteStyleAsk('Make everything look much nicer')).toBeNull();
        // A one- or two-word colour is still read.
        expect(readNoteStyleAsk('make everything sky blue')).toEqual({
            color: 'sky blue',
        });
    });
});
