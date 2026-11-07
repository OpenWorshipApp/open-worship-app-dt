// The Khmer cases of `tools/owa-devtools-mcp/lyricPageText.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
// Reading a song off a page, without the page.
//
// EVERY FIXTURE HERE IS MADE UP -- the songs, the artists, the sites. Not one
// line is from a real hymn, a real lyrics page or a real chord sheet: a test
// fixture is copied into every clone of this repo and into the knowledge
// bundle that ships to operators, and a song belongs to whoever wrote it. What
// is under test is the SHAPE of a page, and nonsense has the same shape.
//
// The two Khmer words used below are ordinary vocabulary chosen to exercise a
// script that writes no spaces between words. They are not a lyric.
//
// Plain node, no jsdom, no network -- same as the rest of this package.

import { describe, expect, test } from 'vitest';

import {
    checkIsGluedPage,
    checkIsPageText,
    checkIsPlayOrderLine,
    checkIsSubstantial,
    classifyLine,
    markTranslations,
    pickLyricRegion,
    pickNumberedStanzas,
    readLyricPage,
    readChordToken,
    readMetadataStrip,
    readPageCopyright,
    readPageFields,
    readPageHeading,
    rejoinChordSheet,
    splitLeadingChords,
    toAsciiDigits,
    toProseRegions,
    toRegions,
    writeInlineChords,
} from '../../../../../../../../tools/owa-devtools-mcp/lyricPageText.mjs';
import { readPackageWorldParts } from '../../../../../../../../extra-work/language-packages.mjs';
import { configureWorldLanguageParts } from '../../../../../../../../tools/owa-devtools-mcp/worldLanguages.mjs';

// What a language's own words are is ITS data, there when it is installed
// (`worldLanguages.mjs`): these cases are about languages, so every package
// of the checkout is installed for them.
configureWorldLanguageParts(readPackageWorldParts);

/** A number label, near enough for the tests that do not need the real one. */
const checkIsLabel = (line) => {
    return /^(?:\d{1,2}\.?|Verse \d|Chorus|Refrain:?|Bridge|Intro|Outro)$/i.test(
        toAsciiDigits(line).trim(),
    );
};

describe('what a line is', () => {
    test('keeps a short syllable in a script that has no spaces', () => {
        // The rule here used to be "shorter than four characters", which is a
        // rule about English. Every second fragment of a Khmer song is two or
        // three characters, and throwing them away lost half the words AND cut
        // the song's own region in two.
        expect(classifyLine('ខ្ញុំ')).toBe('word');
        expect(classifyLine('ច្រៀង')).toBe('word');
    });
});

describe('a chord glued to the words', () => {
    test('writes the bar OUTSIDE the brackets', () => {
        // `[|D]` is what the page looks like and it is refused by open-lyric
        // and by our own validator alike: the brackets hold a chord symbol and
        // a root is A-G. `|[D]` is the schema's own form. Both were probed
        // against `checkMarkdown` before this was written.
        expect(splitLeadingChords('|D ខ្ញុំ').marks).toBe('|[D]');
    });

    test('refuses to eat a leading word that happens to be a chord', () => {
        // "A brand new day" starts with a chord and with a word, and only one
        // of them is right. Nothing here says the page glues its chords, so
        // the words are left whole.
        expect(splitLeadingChords('A brand new day')).toEqual({
            marks: '',
            text: 'A brand new day',
            chords: 0,
        });
        // A bar is not a word in any language, so this one is safe.
        expect(splitLeadingChords('|A brand new day').marks).toBe('|[A]');
        // And so is a chord in front of words written in another script.
        expect(splitLeadingChords('A7 មេឃ').marks).toBe('[A7]');
    });

    test('joins a whole glued row into one line', () => {
        // The bug the user reported: eleven fragments, eleven lines, and the
        // chord left sitting in the words as literal text.
        const rows = rejoinChordSheet([
            '|D ផ្កាថ្មី',
            '|D រីក នៅ',
            '|A ចាស់',
            'សូមស្តាប់',
            '|Bm ថ្មី',
        ]);
        expect(rows.map((one) => one.text)).toEqual([
            '|[D]ផ្កាថ្មី|[D]រីក នៅ|[A]ចាស់',
            'សូមស្តាប់|[Bm]ថ្មី',
        ]);
    });

    test('writes the chords glued INSIDE a row where they land', () => {
        // A page that hands over the whole row at once: only the first chord
        // was bracketed, and every later `|D` rode into the song as a word.
        expect(
            writeInlineChords('|D ខ្ញុំសូម |D ឡើង គាំង |D ឡើង ជាអ |A អស់'),
        ).toBe('|[D]ខ្ញុំសូម |[D]ឡើង គាំង |[D]ឡើង ជាអ |[A]អស់');
        // A bare chord mid-row is safe in another script -- and the `|D`
        // three words on must not make the rest of the row read as Latin.
        expect(writeInlineChords('ព្រះហស្ត |D ហើយ A7 សារ |D ផង ។')).toBe(
            'ព្រះហស្ត |[D]ហើយ [A7]សារ |[D]ផង ។',
        );
        // A word that is also a chord stays a word; a bar on its own stays.
        expect(writeInlineChords('sing A loud |D now | more')).toBe(
            'sing A loud |[D]now | more',
        );
        expect(writeInlineChords('a lantern on the water')).toBe(
            'a lantern on the water',
        );
        // A run of several before one word says which chords, not where.
        expect(writeInlineChords('|D |A |Bm word')).toBe('word');
        expect(
            rejoinChordSheet([
                '|D ខ្ញុំសូម |D ឡើង គាំង |A អស់',
                'ព្រះហស្ត |D ហើយ A7 សារ |D ផង ។',
            ]).map((one) => one.text),
        ).toEqual([
            '|[D]ខ្ញុំសូម |[D]ឡើង គាំង |[A]អស់',
            'ព្រះហស្ត |[D]ហើយ [A7]សារ |[D]ផង ។',
        ]);
    });
});

describe('what the page says about the song', () => {
    test('counts in any script the app might be printed in', () => {
        expect(toAsciiDigits('១២៣')).toBe('123');
        expect(toAsciiDigits('๔.')).toBe('4.');
        expect(toAsciiDigits('12')).toBe('12');
    });
});

describe('a song in two languages', () => {
    test('pairs a Latin line under a line that is not Latin', () => {
        const rows = markTranslations([
            { text: 'ខ្ញុំច្រៀង', hadChord: true },
            { text: 'I am singing', hadChord: false },
            { text: 'ដោយអំណរ', hadChord: true },
        ]);
        expect(
            rows.map((one) => {
                return one.isTranslation;
            }),
        ).toEqual([false, true, false]);
    });

    test('does not read a licence line as a translation', () => {
        // It is Latin, it is under a line that is not, and it is the reason
        // the tail sweep stopped at the first piece of furniture it met.
        const rows = markTranslations([
            { text: 'ខ្ញុំច្រៀង', hadChord: true },
            { text: '© 2019 Nobody At All', hadChord: false },
        ]);
        expect(rows[1].isTranslation).toBe(false);
    });

    test('does not pair a chart heading with the credit above it', () => {
        // `Guitar chords` under the songwriter's name is not a translation of
        // it, and the tail sweep stops at translations -- so the pair of them
        // rode into the last verse as its closing couplet.
        const rows = markTranslations([
            { text: 'ទំនុកច្រៀងៈ អ្នកណាម្នាក់' },
            { text: 'Guitar chords' },
        ]);
        expect(rows.map((one) => one.isTranslation)).toEqual([false, false]);
    });

    test('indents the translation and only the translation', () => {
        const page = [
            'Blue Lantern',
            'The Made Up Singers',
            'playlist_add',
            'Key: D  ·  Time: 4/4  ·  Tempo: 73bpm',
            '|',
            'D',
            'ខ្ញុំច្រៀង',
            'I am singing',
        ];
        const read = readLyricPage(page, { isFromPage: true });
        expect(read.lines).toEqual(['|[D]ខ្ញុំច្រៀង', '\tI am singing']);
        expect(read.notes.translations).toBe(1);
    });
});

// From `tools/owa-devtools-mcp/lyricPageText.coverage.test.mjs`.
describe('chords glued to the words, under a line in Khmer', () => {
    test('a translation row is closed before the next row’s chord, not run into it', () => {
        expect(
            rejoinChordSheet(['ខ្ញុំច្រៀង', 'I am singing', '|D ដោយអំណរ']),
        ).toEqual([
            { text: 'ខ្ញុំច្រៀង', hadChord: false },
            { text: 'I am singing', hadChord: false },
            { text: '|[D]ដោយអំណរ', hadChord: true },
        ]);
    });
});
