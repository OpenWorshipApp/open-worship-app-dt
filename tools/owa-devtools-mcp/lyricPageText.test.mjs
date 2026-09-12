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
} from './lyricPageText.mjs';

/** A number label, near enough for the tests that do not need the real one. */
const checkIsLabel = (line) => {
    return /^(?:\d{1,2}\.?|Verse \d|Chorus|Refrain:?|Bridge|Intro|Outro)$/i.test(
        toAsciiDigits(line).trim(),
    );
};

describe('what a line is', () => {
    test('knows a chord, a bar and a progression from words', () => {
        expect(classifyLine('D')).toBe('chord');
        expect(classifyLine('C#m7')).toBe('chord');
        expect(classifyLine('|')).toBe('bar');
        expect(classifyLine('||: A | E :||')).toBe('chord');
        expect(classifyLine('| E | C#m | A | B | (2x)')).toBe('chord');
        expect(classifyLine('a lantern on the water')).toBe('word');
    });

    test('reads the typographic sharp as a sharp', () => {
        // A fretboard chart writes `C♯m`. Read as a word it resets the run of
        // wordless lines that marks the end of the song, and the draft runs on
        // into the footer.
        expect(classifyLine('C♯m')).toBe('chord');
        expect(classifyLine('B/D♯')).toBe('chord');
        expect(classifyLine('B♭')).toBe('chord');
    });

    test('drops an icon name, a fingering and a fret marker', () => {
        expect(classifyLine('playlist_add')).toBe('icon');
        expect(classifyLine('radio_button_unchecked')).toBe('icon');
        expect(classifyLine('4fr')).toBe('junk');
        expect(classifyLine('X')).toBe('junk');
        expect(classifyLine('p')).toBe('junk');
        expect(classifyLine('&')).toBe('junk');
        expect(classifyLine('7')).toBe('junk');
    });

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
    test('pulls the bar off the front of the chord', () => {
        expect(readChordToken('|D')).toEqual({ bar: '|', chord: 'D' });
        expect(readChordToken('||:Bm7')).toEqual({ bar: '||:', chord: 'Bm7' });
        expect(readChordToken('A7')).toEqual({ bar: '', chord: 'A7' });
        expect(readChordToken('C♯m')).toEqual({ bar: '', chord: 'C#m' });
        // A bar on its own is a bar; a word with a bar on it is still a word.
        expect(readChordToken('|')).toEqual({ bar: '|', chord: '' });
        expect(readChordToken('|Hello')).toBe(null);
        expect(readChordToken('Hello')).toBe(null);
    });

    test('reads a row of glued chords as chords, not as words', () => {
        // Every one of these used to be a WORD line, because `|D` matches
        // neither the bar pattern nor the chord pattern.
        expect(classifyLine('|D |A |Bm')).toBe('chord');
    });

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

    test('takes a bare chord once the page has shown it glues them', () => {
        const page = ['|D one', '|A two', 'Bm7 three'];
        expect(checkIsGluedPage(page)).toBe(true);
        expect(splitLeadingChords('Bm7 three', true).marks).toBe('[Bm7]');
        // Still not a lone letter, which is exactly what tells `Bm7` from `A`.
        expect(splitLeadingChords('A three', true).marks).toBe('');
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

    test('writes no chord over words it cannot place one on', () => {
        // A fretboard chart is four chord lines in a row. Taking the last of
        // them wrote `[G]` onto the licence line printed under the chart.
        const rows = rejoinChordSheet(['D', 'A', 'Bm', 'G', 'a lantern']);
        expect(rows.map((one) => one.text)).toEqual(['a lantern']);
    });
});

describe('is this a page at all', () => {
    test('leaves plain pasted words alone', () => {
        const pasted = [
            'Blue Lantern',
            '',
            'a lantern on the water',
            'and nobody to row',
        ];
        expect(checkIsPageText(pasted)).toBe(false);
        expect(readLyricPage(pasted).lines).toEqual(pasted);
        expect(readLyricPage(pasted).notes.isPage).toBe(false);
    });

    test('knows a page by its icons, its bars or its metadata strip', () => {
        expect(checkIsPageText(['playlist_add', 'swap_vert'])).toBe(true);
        expect(checkIsPageText(['|', 'D', '|', 'A', '|'])).toBe(true);
        expect(checkIsPageText(['Key: D  ·  Time: 4/4'])).toBe(true);
    });

    test('is told outright when the text came out of a wrapper', () => {
        // A hymn-text site has no chords and no icons, so nothing above finds
        // it. The wrapper is proof, and without it the site's menu was drafted
        // as verse one.
        const page = ['Home', 'Log in', 'Search', 'Browse', 'Texts'];
        expect(checkIsPageText(page)).toBe(false);
        expect(readLyricPage(page, { isFromPage: true }).notes.isPage).toBe(
            true,
        );
    });
});

describe('what the page says about the song', () => {
    test('reads the key, tempo and time out of one separated strip', () => {
        expect(
            readMetadataStrip([
                'Key: D  ·  Time: 4/4  ·  Tempo: 73bpm  ·  check_boxSimplify',
            ]),
        ).toEqual({ Key: 'D', Time: '4/4', Tempo: '73bpm' });
    });

    test('takes the title and the artist off the top', () => {
        expect(
            readPageHeading([
                'Blue Lantern',
                'The Made Up Singers',
                'playlist_add',
                'Add to',
            ]),
        ).toEqual({ Title: 'Blue Lantern', Artist: 'The Made Up Singers' });
    });

    test('counts in any script the app might be printed in', () => {
        expect(toAsciiDigits('១២៣')).toBe('123');
        expect(toAsciiDigits('๔.')).toBe('4.');
        expect(toAsciiDigits('12')).toBe('12');
    });
});

describe('finding the song on the page', () => {
    const CHART = ['4fr', '1', '3', '4', '2', 'X', 'e'];

    test('cuts the page at a wall of wordless lines', () => {
        const page = [
            'Add to',
            'Print',
            ...CHART,
            '|',
            'D',
            'a lantern on the water',
            '|',
            'A',
            'and nobody to row it',
            '|',
            'G',
            'the harbour keeps its quiet',
            ...CHART,
            'Related songs',
            'Sign in to comment',
        ];
        const regions = toRegions(page);
        expect(regions.length).toBeGreaterThan(1);
        expect(pickLyricRegion(regions).lines).toContain(
            'a lantern on the water',
        );
    });

    test('keeps the chords that open a song, without counting them', () => {
        // A wall is only broken by a line of WORDS, so the `|` and the chord
        // over the first syllable sat inside it and the song's very first
        // chord was the only one missing from the document. Carrying them in
        // is not the same as counting them: three chords is what
        // `pickLyricRegion` takes as proof a region is a song, and three
        // carried ones handed that proof to the view-count line under a
        // fretboard chart, which then won on word count.
        const page = [
            ...Array.from({ length: 8 }, () => {
                return 'playlist_add';
            }),
            '|',
            'D',
            'a lantern on the water',
        ];
        const regions = toRegions(page);
        const last = regions[regions.length - 1];
        expect(last.lines).toEqual(['|', 'D', 'a lantern on the water']);
        expect(last.chords).toBe(0);
        expect(rejoinChordSheet(last.lines).map((one) => one.text)).toEqual([
            '|[D]a lantern on the water',
        ]);
    });

    test('prefers the region with chords over the one with more words', () => {
        // The footer of a song page has as many words as a verse and not one
        // chord. Scoring on words alone picked the footer.
        const chords = { words: 4, chords: 9, lines: ['song'] };
        const footer = { words: 40, chords: 0, lines: ['footer'] };
        expect(pickLyricRegion([footer, chords])).toBe(chords);
    });

    test('measures a page with no chords by how long its lines are', () => {
        expect(checkIsSubstantial('Log in')).toBe(false);
        expect(checkIsSubstantial('a lantern on the water')).toBe(true);
        const page = [
            'Home',
            'Log in',
            'Register',
            'Search',
            'Browse',
            '1 a lantern on the water',
            'and nobody to row it home',
            '',
            '2 the harbour keeps its quiet',
            'until the morning comes',
            'Popular',
            'Topics',
            'Store',
            'Blog',
            'Forums',
        ];
        const picked = pickLyricRegion(toProseRegions(page));
        expect(picked.lines).toContain('and nobody to row it home');
        expect(picked.lines).not.toContain('Forums');
    });
});

describe('putting the lines back together', () => {
    test('joins the fragments of one row with nothing between them', () => {
        // A chord lands mid-word more often than between words, and where it
        // lands between them the page's own spacing is still on the fragment.
        const rows = rejoinChordSheet([
            '|',
            'D',
            '    a lan',
            '|',
            'A',
            'tern on the water  ',
            '|',
            'G',
            'and nobody',
        ]);
        // And the chords come WITH them, written where they land.
        expect(rows.map((one) => one.text)).toEqual([
            '|[D]a lan|[A]tern on the water |[G]and nobody',
        ]);
    });

    test('starts a new line where two rows of words meet', () => {
        const rows = rejoinChordSheet([
            '|',
            'D',
            'a lantern',
            'and nobody to row',
        ]);
        expect(rows.map((one) => one.text)).toEqual([
            '|[D]a lantern',
            'and nobody to row',
        ]);
    });

    test('never joins a section name to the words under it', () => {
        // "Intro:Verse 1:the words" was one line, no labels were found, and a
        // whole hymn drafted as a single verse.
        const rows = rejoinChordSheet(
            ['Intro', '|', 'D', 'Verse 1', '|', 'A', 'a lantern on the water'],
            checkIsLabel,
        );
        expect(rows.map((one) => one.text)).toEqual([
            'Intro',
            'Verse 1',
            'a lantern on the water',
        ]);
    });

    test('credits a chord to the row it sits over, not the one above', () => {
        const rows = rejoinChordSheet(['|', 'D', 'a lantern', 'Guitar chords']);
        expect(rows.map((one) => one.hadChord)).toEqual([true, false]);
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

describe('what is not the song', () => {
    test('knows a play-order summary from a line to sing', () => {
        expect(checkIsPlayOrderLine('Bridge 1 (6x) Instr 1 (2x) Chorus (4x)'))
            .toBe(true);
        expect(checkIsPlayOrderLine('a lantern on the water (2x)')).toBe(false);
    });

    test('takes the credits and the chart heading off the end', () => {
        const page = [
            'Blue Lantern',
            'The Made Up Singers',
            'playlist_add',
            'Key: D  ·  Time: 4/4  ·  Tempo: 73bpm',
            '|',
            'D',
            '|',
            'A',
            'a lantern on the water',
            'and nobody to row it',
            'A Made Up Fellowship',
            'Words and Music by: Nobody At All',
            'Made Up Records 2019',
            ' Guitar chords',
        ];
        const read = readLyricPage(page, { isFromPage: true });
        expect(read.lines).toEqual([
            'a lantern on the water',
            'and nobody to row it',
        ]);
        // Two ways off the page and both are wanted: the chart heading is
        // past the last chord and never enters the region at all, while the
        // credits sit inside it and are swept off the end by name.
        expect(read.lines.join('\n')).not.toContain('Guitar chords');
        expect(read.notes.credits).toContain('A Made Up Fellowship');
        // The page's own heading wins: it names the band or the hymnal, which
        // is what the song will be filed under. "Words and music by" names the
        // songwriters, and only stands in when the heading named nobody.
        expect(read.found.Artist).toBe('The Made Up Singers');
    });

    test('keeps the copyright notice instead of dropping it', () => {
        // The one part of a credit that says whose song it is. Open Lyric has
        // a field for it and it was being filled in with "Unknown".
        const read = readLyricPage(
            [
                'swap_vert',
                'playlist_add',
                '|',
                'D',
                '|',
                'A',
                'a lantern on the water',
                '© 2019 A Made Up Publisher',
            ],
            { isFromPage: true },
        );
        expect(read.found.Copyright).toBe('© 2019 A Made Up Publisher');
        expect(read.lines.join('\n')).not.toContain('2019');
    });

    test('reads the notice out of the page footer, menu and all', () => {
        // Most pages put the notice at the very BOTTOM, nowhere near the song
        // and outside the region this file works to isolate -- so the song
        // came out saying `Unknown` on a page that says whose it is in plain
        // sight. Read from the bottom up, and only a real notice.
        expect(
            readPageCopyright([
                'Copyright Policy',
                'a lantern on the water',
                '© 2026 A Made Up Publisher | Terms of Service | Privacy',
            ]),
        ).toBe('© 2026 A Made Up Publisher');
        // The word on its own is a menu item, not a notice.
        expect(readPageCopyright(['Copyright Policy', 'Contact Us'])).toBe(
            null,
        );
    });

    test('never takes the site’s own notice for the song’s', () => {
        // A chord site's footer says whose the SITE is, and that went into a
        // decades-old hymn's Copyright field as though the site owned it.
        const page = [
            'a lantern on the water',
            '© 2026 MadeUpChords.com | Terms of Service | Privacy',
        ];
        expect(readPageCopyright(page, 'www.madeupchords.com')).toBe(null);
        // A notice naming somebody else stands, whatever site it is on.
        expect(
            readPageCopyright(
                ['a lantern on the water', '© 2019 A Made Up Publisher'],
                'www.madeupchords.com',
            ),
        ).toBe('© 2019 A Made Up Publisher');
        // With no address to compare against, the old reading holds.
        expect(readPageCopyright(page)).toBe('© 2026 MadeUpChords.com');
    });

    test('falls back to the credit line when the page named no artist', () => {
        const read = readLyricPage(
            [
                'swap_vert',
                'playlist_add',
                '|',
                'D',
                '|',
                'A',
                'a lantern on the water',
                'Words and Music by: Nobody At All',
            ],
            { isFromPage: true },
        );
        expect(read.found.Artist).toBe('Nobody At All');
    });

    test('says which part of the page it used', () => {
        const page = [
            'Blue Lantern',
            'The Made Up Singers',
            'playlist_add',
            'swap_vert',
            '|',
            'D',
            'a lantern on the water',
            'and nobody to row it',
        ];
        const read = readLyricPage(page, { isFromPage: true });
        expect(read.notes.firstLine).toBe('a lantern on the water');
        expect(read.notes.lastLine).toBe('and nobody to row it');
        expect(read.notes.droppedLines).toBeGreaterThan(0);
        expect(read.notes.isMarked).toBe(false);
    });

    test('starts the song under the page’s own Key/Time strip', () => {
        // A toolbar is a line of words per button, and a page that draws no
        // strumming diagram between it and the first chord has no wall to
        // end it on: nine buttons were drafted as Verse 1 (2026-09-09, a
        // Khmer hymnal's chord page) and the real verses became 2 and 3.
        // The strip the page prints over its chord sheet is the boundary.
        const page = [
            'Blue Lantern',
            'The Made Up Singers',
            'playlist_add',
            'Add to',
            'edit',
            'Edit',
            'print',
            'Print',
            'swap_vert',
            'Transpose',
            'Key: D  ·  Time: 4/4  ·  check_box_outline_blankSimplify',
            '1.',
            'a lantern',
            '|',
            'D',
            'on the water',
            'and nobody',
            '|',
            'A',
            'to row it',
        ];
        const read = readLyricPage(page, { isFromPage: true, checkIsLabel });
        expect(read.lines).toEqual([
            '1.',
            'a lantern|[D]on the water',
            'and nobody|[A]to row it',
        ]);
        expect(read.notes.firstLine).toBe('a lantern|[D]on the water');
        expect(read.lines.join('\n')).not.toContain('Transpose');
        expect(read.found.Key).toBe('D');
    });

    test('sweeps a chordless toolbar off the front, with no strip', () => {
        // The mirror of the credit sweep: on a chord sheet a sung line has a
        // chord over it, so short chordless rows above the first chorded row
        // are buttons -- and every one is named, never silently eaten.
        const page = [
            'playlist_add',
            'Add to',
            'edit',
            'Edit',
            'swap_vert',
            'Transpose',
            'a lantern',
            '|',
            'D',
            'on the water',
            'and nobody',
            '|',
            'A',
            'to row it',
        ];
        const read = readLyricPage(page, { isFromPage: true, checkIsLabel });
        expect(read.lines).toEqual([
            'a lantern|[D]on the water',
            'and nobody|[A]to row it',
        ]);
        // "Edit" and "Transpose" ride the icon between them into one row,
        // exactly as the site's "Scroll" and "Transpose" do -- an icon
        // separates without flushing. Named, so a reader can see it went.
        expect(read.notes.furniture).toEqual([
            'Add to',
            'edit',
            'EditTranspose',
        ]);
        expect(read.notes.firstLine).toBe('a lantern|[D]on the water');
    });

    test('a label stops the sweep; a strip under the song cuts nothing', () => {
        // A song may open with an unchorded line under "Verse 1" -- the label
        // is the proof the song has begun. And a facts strip printed BELOW
        // the words is not the one over the chord sheet.
        const page = [
            'swap_vert',
            'playlist_add',
            'Verse 1',
            'a lantern',
            '|',
            'D',
            'on the water',
            'and nobody',
            '|',
            'A',
            'to row it',
            'Key: D  ·  Time: 4/4',
        ];
        const read = readLyricPage(page, { isFromPage: true, checkIsLabel });
        expect(read.lines).toEqual([
            'Verse 1',
            'a lantern|[D]on the water',
            'and nobody|[A]to row it',
        ]);
        expect(read.notes.furniture).toEqual([]);
        expect(read.found.Key).toBe('D');
    });

    test('takes the caller’s word for where the song starts and ends', () => {
        const page = [
            'playlist_add',
            'swap_vert',
            'a menu item nobody sings',
            '|',
            'D',
            'a lantern on the water',
            'and nobody to row it',
            'a footer nobody sings either',
        ];
        const read = readLyricPage(page, {
            isFromPage: true,
            from: 'a lantern',
            to: 'row it',
        });
        expect(read.lines).toEqual([
            'a lantern on the water',
            'and nobody to row it',
        ]);
        expect(read.notes.isMarked).toBe(true);
    });
});

// A hymnal site's TEXT page, made up. The shape under test, measured
// 2026-09-08 on a real one handed over whole: numbered stanzas in the middle
// of ninety lines of menus, and the song's own facts in a table far below
// them -- which the length rule read as sixteen verses and the field reader
// never saw at all.
describe('a hymnal page with numbered stanzas', () => {
    const page = [
        'Home',
        'Log in',
        'Register',
        'Browse',
        'Blue Lantern (a song about a lantern)',
        'Author: Somebody Madeup (1801)',
        'Tune: HARBOUR',
        'Printable scores: PDF, MusicXML',
        'Playable presentation: Lyrics only, lyrics plus music',
        'Song available on the hymnal site',
        'Representative Text',
        '',
        '1 a lantern on the water',
        'and nobody to row it home',
        'the harbour keeps its quiet',
        'until the morning comes',
        '',
        '2 the morning finds the lantern',
        'still burning on the tide',
        'and every boat that passes',
        'is glad of it inside',
        '',
        'Refrain:',
        'row it home, row it home',
        'row the lantern home',
        '',
        '3 the evening takes the lantern',
        'and hangs it on a hook',
        'and nobody remembers',
        'the water that it took',
        '',
        'Old Hymnal, 1901',
        '',
        'All texts • Compare texts • Text size: Regular | Large',
        'Text Information',
        'First Line: a lantern on the water and nobody to row it home',
        'Title: Blue Lantern',
        'Author: Somebody Madeup (1801)',
        'Meter: 8.6.8.6',
        'Copyright: Public Domain',
        'Copyright Policy',
        'Forums',
        'Store',
    ];

    test('takes the run of numbered stanzas, and the refrain among them', () => {
        const picked = pickNumberedStanzas(page, checkIsLabel);
        expect(picked.lines[0]).toBe('1 a lantern on the water');
        expect(picked.lines[picked.lines.length - 1]).toBe(
            'the water that it took',
        );
        expect(picked.lines).toContain('row the lantern home');
        expect(picked.lines).not.toContain('Printable scores: PDF, MusicXML');
        expect(picked.lines).not.toContain('Old Hymnal, 1901');
    });

    test('one numeral is a coincidence, not a hymn', () => {
        expect(
            pickNumberedStanzas(['1 a lantern on the water', 'and nobody'], checkIsLabel),
        ).toBeNull();
        // Numbers that do not run from 1 are not stanzas either.
        expect(
            pickNumberedStanzas(
                ['2 a lantern', 'x', '', '3 the morning', 'y'],
                checkIsLabel,
            ),
        ).toBeNull();
    });

    test('reads the song’s facts off the table, not off the menu', () => {
        const found = readPageFields(page);
        expect(found.Title).toBe('Blue Lantern');
        expect(found.Artist).toBe('Somebody Madeup (1801)');
        expect(found.Copyright).toBe('Public Domain');
        // `Copyright Policy` has no colon; `First Line:` is not a field.
        expect(found.FirstLine).toBeUndefined();
        expect(Object.keys(found)).not.toContain('Meter');
    });

    test('the whole page comes out as the hymn with its facts', () => {
        const read = readLyricPage(page, { isFromPage: true, checkIsLabel });
        expect(read.found.Title).toBe('Blue Lantern');
        expect(read.found.Artist).toBe('Somebody Madeup (1801)');
        expect(read.found.Copyright).toBe('Public Domain');
        expect(read.lines[0]).toBe('1 a lantern on the water');
        expect(read.notes.firstLine).toBe('1 a lantern on the water');
        expect(read.lines).not.toContain('Text Information');
        expect(read.lines).not.toContain('Home');
    });

    test('a chord sheet keeps its own readers', () => {
        // The table reader is for the page shape that prints one; a chord
        // page's heading reader is proven on its own pages and left alone.
        const chordPage = [
            'Blue Lantern',
            'The Made Up Singers',
            'playlist_add',
            '|',
            'D',
            'a lantern on the water',
            '|',
            'A',
            'and nobody to row it',
            'Title: something a comment said',
        ];
        const read = readLyricPage(chordPage, { isFromPage: true });
        expect(read.found.Title).toBe('Blue Lantern');
    });
});
