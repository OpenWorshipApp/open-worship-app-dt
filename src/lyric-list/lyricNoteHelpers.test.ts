import { describe, expect, test } from 'vitest';

import { checkIsSameLyricNoteList, getLyricNoteList } from './lyricNoteHelpers';

function toSong(...lines: string[]) {
    return lines.join('\n');
}

describe('getLyricNoteList', () => {
    test('reads every Note fence, in the order the song writes them', () => {
        const song = toSong(
            '# Grace',
            '```ol:Config',
            '- Structure: V1 V2',
            '```',
            '```ol:Note 3',
            'third',
            '```',
            '```ol:Verse 1',
            'sung words',
            '```',
            '```ol:Note',
            'first',
            '```',
        );
        expect(getLyricNoteList(song)).toEqual([
            { partName: 'Note 3', text: 'third' },
            { partName: 'Note', text: 'first' },
        ]);
    });

    test('only an exact Note header counts', () => {
        const song = toSong(
            '```ol:note',
            'lower case',
            '```',
            '```ol:Notes',
            'plural',
            '```',
            '```ol:Note 0',
            'index zero',
            '```',
            '```ol:Chorus',
            'chorus',
            '```',
            '```ol:Note 12',
            'kept',
            '```',
        );
        expect(getLyricNoteList(song)).toEqual([
            { partName: 'Note 12', text: 'kept' },
        ]);
    });

    test('keeps the body as written, less its outer blank lines', () => {
        const song = [
            '  ```ol:Note',
            '',
            '[C] line one',
            '',
            '  // line three',
            '   ',
            '  ```',
        ].join('\r\n');
        expect(getLyricNoteList(song)).toEqual([
            { partName: 'Note', text: '[C] line one\n\n  // line three' },
        ]);
    });

    test('an empty note and a fence never closed are left out', () => {
        const song = toSong(
            '```ol:Note',
            '   ',
            '```',
            '```ol:Note 2',
            'never closed',
        );
        expect(getLyricNoteList(song)).toEqual([]);
    });

    test('a plain code fence and text outside the fences are not notes', () => {
        const song = toSong(
            'Note',
            '```js',
            'const note = 1;',
            '```',
            '```ol:Verse 1',
            '```ol:Note',
            '```',
            '```ol:Note 2',
            'real',
            '```',
        );
        expect(getLyricNoteList(song)).toEqual([
            { partName: 'Note 2', text: 'real' },
        ]);
    });

    test('a song with no notes has none', () => {
        expect(getLyricNoteList('')).toEqual([]);
    });
});

describe('checkIsSameLyricNoteList', () => {
    test('compares every note by part name and text', () => {
        const noteList = [
            { partName: 'Note', text: 'a' },
            { partName: 'Note 2', text: 'b' },
        ];
        expect(
            checkIsSameLyricNoteList(noteList, [
                { partName: 'Note', text: 'a' },
                { partName: 'Note 2', text: 'b' },
            ]),
        ).toBe(true);
        expect(checkIsSameLyricNoteList(noteList, noteList.slice(0, 1))).toBe(
            false,
        );
        expect(
            checkIsSameLyricNoteList(noteList, [
                { partName: 'Note', text: 'a' },
                { partName: 'Note 3', text: 'b' },
            ]),
        ).toBe(false);
        expect(
            checkIsSameLyricNoteList(noteList, [
                { partName: 'Note', text: 'a' },
                { partName: 'Note 2', text: 'c' },
            ]),
        ).toBe(false);
        expect(checkIsSameLyricNoteList([], [])).toBe(true);
    });
});
