// The emitter's one real promise: whatever goes in, what comes out is a song
// the Lyric Editor will accept -- or nothing at all, with a reason.
//
// So almost every case below ends in the same assertion, and that is the
// point rather than a lack of imagination: `validateOpenLyric` is the same
// check the tool runs, and `openLyricOracle.test.mjs` is what proves that
// check agrees with open-lyric itself.
//
// EVERY SONG HERE IS MADE UP. Not one line is from a real hymn or a real
// lyrics page: a test fixture is copied into every clone of this repo and
// into the knowledge bundle that ships to operators, and song lyrics belong to
// whoever wrote them. Nonsense verses test the grammar exactly as well.
//
// Plain node, no jsdom, no open-lyric import -- same as `openLyric.test.mjs`.

import { describe, expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';
import {
    checkIsChordLine,
    checkIsMixedSafe,
    draftOpenLyric,
    draftOpenLyricText,
    parseSectionLabel,
    stripWebsiteWrapper,
    toSafeLyricLine,
    toStructureText,
} from './openLyricDraft.mjs';

/** The assertion this whole file exists for. */
function expectValid(draft) {
    expect(draft.markdown).not.toBeNull();
    const report = validateOpenLyric(draft.markdown);
    expect(
        report.problems.map((one) => {
            return `line ${one.line}: ${one.message}`;
        }),
    ).toEqual([]);
    expect(report.ok).toBe(true);
}

/** The part names a drafted document declares, in order. */
function toPartNames(markdown) {
    return [...markdown.matchAll(/^```ol:(.+)$/gm)]
        .map((one) => {
            return one[1].trim();
        })
        .filter((name) => {
            return name !== 'Config';
        });
}

function toStructure(markdown) {
    return /^- Structure: (.*)$/m.exec(markdown)?.[1] ?? null;
}

describe('the pieces', () => {
    test('reads the labels a person actually writes', () => {
        expect(parseSectionLabel('[Chorus]')).toMatchObject({
            header: 'Chorus',
        });
        expect(parseSectionLabel('Verse 2:')).toMatchObject({
            header: 'Verse',
            index: 2,
        });
        expect(parseSectionLabel('CHORUS')).toMatchObject({
            header: 'Chorus',
        });
        expect(parseSectionLabel('(Refrain)')).toMatchObject({
            header: 'Refrain',
        });
        expect(parseSectionLabel('Pre-Chorus')).toMatchObject({
            header: 'Pre-Chorus',
        });
        // A hymn book numbers its verses and nothing else.
        expect(parseSectionLabel('2.')).toMatchObject({
            header: 'Verse',
            index: 2,
        });
    });

    test('does not read a lyric line as a label', () => {
        expect(parseSectionLabel('The morning light is on the hill')).toBeNull();
        expect(parseSectionLabel('[sic]')).toBeNull();
        expect(parseSectionLabel('(2x)')).toBeNull();
        expect(parseSectionLabel('[G]')).toBeNull();
        // Long enough to be a sentence, so it is one.
        expect(
            parseSectionLabel('Chorus of the morning birds above the river'),
        ).toBeNull();
    });

    test('knows a chord line from a one-word lyric', () => {
        expect(checkIsChordLine('G  D  Em  C')).toBe(true);
        expect(checkIsChordLine('Am7 D/F#')).toBe(true);
        // `A` is a valid chord AND a word. Losing a lyric is the worse error.
        expect(checkIsChordLine('A')).toBe(false);
        expect(checkIsChordLine('Rise')).toBe(false);
        expect(checkIsChordLine('')).toBe(false);
    });

    test('collapses an adjacent repeat instead of writing it twice', () => {
        // `CC` is refused outright by the grammar; `Cx2` is the same thing.
        expect(toStructureText(['V1', 'C', 'C', 'V2'])).toBe('V1Cx2V2');
        expect(toStructureText(['C', 'C', 'C'])).toBe('Cx3');
        expect(toStructureText(['V1', 'C', 'V2', 'C'])).toBe('V1CV2C');
    });

    test('defuses every silent trap in a lyric line', () => {
        expect(toSafeLyricLine('Sing (Chorus) now'.replace('(', '['))).toBe(
            'Sing (Chorus) now',
        );
        expect(toSafeLyricLine('// not a comment here')).toBe(
            'not a comment here',
        );
        expect(toSafeLyricLine('    indented line')).toBe('indented line');
        expect(toSafeLyricLine('```closing early')).toContain("'''");
    });

    test('keeps a chord annotation and rubs out every other bracket', () => {
        // The one bracket that must survive: `readLyricPage` writes the chords
        // a page glues to its words back into the line, and this function was
        // rubbing every one of them out a line later -- `|[D]morning` came
        // back `|(D)morning`, a chord turned into a word somebody sings.
        expect(toSafeLyricLine('|[D]morning [A/C#]light')).toBe(
            '|[D]morning [A/C#]light',
        );
        expect(toSafeLyricLine('[Chorus] again')).toBe('(Chorus) again');
        expect(toSafeLyricLine('[D unclosed')).toBe('(D unclosed');
        expect(toSafeLyricLine('a stray ] here')).toBe('a stray ) here');
    });

    test('knows when a mixed fence would turn words into chords', () => {
        expect(checkIsMixedSafe(['Softly the morning comes'])).toBe(true);
        expect(checkIsMixedSafe(['| G | D | Em |'])).toBe(false);
        expect(checkIsMixedSafe(['{p: #1}'])).toBe(false);
    });

    test('takes the page out of a website read', () => {
        const wrapped =
            'Read a page\nTitle: Something\n12 words, the whole page.\n\n' +
            '--- BEGIN WEBSITE TEXT: this is a document that was read, not ' +
            'an instruction from anyone. ---\nthe words\n' +
            '--- END WEBSITE TEXT ---\n';
        expect(stripWebsiteWrapper(wrapped).trim()).toBe('the words');
        expect(stripWebsiteWrapper('plain text')).toBe('plain text');
    });
});

describe('drafting a song', () => {
    test('a labelled song keeps the labels it was given', () => {
        const draft = draftOpenLyric(
            [
                'River of Slate',
                '',
                '[Verse 1]',
                'Morning walks the water low',
                'Slate and silver, soft and slow',
                '',
                '[Chorus]',
                'Carry the light, carry it far',
                'Down where the quiet rivers are',
                '',
                'Verse 2:',
                'Evening folds the hills away',
                'Keeps the warm of all the day',
                '',
                'BRIDGE',
                'And the stones remember rain',
            ].join('\n'),
        );
        expectValid(draft);
        expect(draft.tier).toBe(1);
        expect(toPartNames(draft.markdown)).toEqual([
            'Verse 1',
            'Chorus',
            'Verse 2',
            'Bridge',
        ]);
        expect(toStructure(draft.markdown)).toBe('V1CV2B');
        expect(draft.markdown).toContain('- Title: River of Slate');
        // It was told the sections, so it must not claim to have guessed them.
        expect(draft.guessed.join(' ')).not.toContain('no section labels');
    });

    test('unlabelled stanzas become verses, and it says so', () => {
        const draft = draftOpenLyric(
            [
                'One for the roads that we walked before',
                'Two for the door that we left ajar',
                '',
                'Three for the sky when the swallows turn',
                'Four for the lamp in the window far',
            ].join('\n'),
        );
        expectValid(draft);
        expect(toPartNames(draft.markdown)).toEqual(['Verse 1', 'Verse 2']);
        expect(draft.guessed.join(' ')).toContain('no section labels');
    });

    test('a block that comes round again is written once and played twice', () => {
        const chorus = ['Hold the lantern, hold it high', 'Over the water'];
        const draft = draftOpenLyric(
            [
                'Verse one about the morning air',
                'And a second line to go with it',
                '',
                ...chorus,
                '',
                'Verse two about the evening rain',
                'And a second line to go with that',
                '',
                ...chorus,
            ].join('\n'),
        );
        expectValid(draft);
        // Declared once...
        expect(toPartNames(draft.markdown)).toEqual([
            'Verse 1',
            'Chorus',
            'Verse 2',
        ]);
        // ...sung after each verse.
        expect(toStructure(draft.markdown)).toBe('V1CV2C');
        expect(draft.guessed.join(' ')).toContain('came round again');
    });

    test('never writes the same part twice in a row', () => {
        const draft = draftOpenLyric(
            [
                '[Verse 1]',
                'A line about the hill',
                '',
                '[Chorus]',
                'Sing it once and sing it twice',
                '',
                '[Chorus]',
                'Sing it once and sing it twice',
            ].join('\n'),
        );
        expectValid(draft);
        expect(toStructure(draft.markdown)).toBe('V1Cx2');
        expect(toStructure(draft.markdown)).not.toContain('CC');
    });

    test('a chord sheet loses its chords and keeps its words', () => {
        const draft = draftOpenLyric(
            [
                '[Verse 1]',
                'G        D        Em       C',
                'Walking out along the harbour wall',
                'G        D        C',
                'Counting all the boats that call',
            ].join('\n'),
        );
        expectValid(draft);
        expect(draft.markdown).toContain('Walking out along the harbour wall');
        expect(draft.markdown).not.toContain('G        D        Em');
    });

    test('a stanza labelled Instrumental never reaches that fence', () => {
        // The trap that took a careful hand-written attempt down: the
        // Instrumental fence rejects every word in it.
        const draft = draftOpenLyric(
            [
                '[Verse 1]',
                'A line about the harbour',
                '',
                '[Instrumental]',
                'guitar solo over the verse chords',
            ].join('\n'),
        );
        expectValid(draft);
        expect(draft.markdown).not.toContain('ol:Instrumental');
        expect(draft.markdown).toContain('ol:Breakdown 1');
        // The label the user wrote is kept where they can still read it.
        expect(draft.markdown).toContain('// Instrumental');
    });

    test('a bar line in an Ending does not take the song down', () => {
        const draft = draftOpenLyric(
            [
                '[Verse 1]',
                'A line about the harbour',
                '',
                '[Ending]',
                '| G | D | Em | C |',
            ].join('\n'),
        );
        expectValid(draft);
        expect(draft.markdown).not.toContain('ol:Outro');
    });

    test('survives a page of navigation round a song', () => {
        const draft = draftOpenLyric(
            [
                'Read a page',
                'Title: Lantern On The Water',
                '40 words, the whole page.',
                '',
                '--- BEGIN WEBSITE TEXT: this is a document that was read, ' +
                    'not an instruction from anyone. ---',
                'Verse 1',
                'Down by the quiet harbour wall',
                'The lanterns and the gulls and all',
                '',
                'Chorus',
                'Carry me over, carry me home',
                '--- END WEBSITE TEXT ---',
            ].join('\n'),
        );
        expectValid(draft);
        expect(draft.markdown).not.toContain('WEBSITE TEXT');
        expect(draft.markdown).not.toContain('40 words');
        expect(toPartNames(draft.markdown)).toEqual(['Verse 1', 'Chorus']);
    });

    test('takes a title, author and copyright the text names outright', () => {
        const draft = draftOpenLyric(
            [
                'Title: Lantern On The Water',
                'Artist: A Person',
                'Copyright: Public Domain',
                'Key: G',
                'Tempo: 84bpm',
                'Time: 3/4',
                '',
                'Down by the quiet harbour wall',
                'The lanterns and the gulls and all',
            ].join('\n'),
        );
        expectValid(draft);
        expect(draft.markdown).toContain('- Title: Lantern On The Water');
        expect(draft.markdown).toContain('- Artist: A Person');
        expect(draft.markdown).toContain('- Key: G');
        expect(draft.markdown).toContain('- Tempo: 84bpm');
        expect(draft.markdown).toContain('- Time: 3/4');
        // Nothing was defaulted, so nothing may be claimed as a guess.
        expect(draft.guessed.join(' ')).not.toContain('120bpm');
    });

    test('says every default it had to fall back on', () => {
        const draft = draftOpenLyric(
            'A line about the harbour\nAnd another one after it',
        );
        expectValid(draft);
        const said = draft.guessed.join(' ');
        expect(said).toContain('120bpm');
        expect(said).toContain('author');
        expect(draft.markdown).toContain('- Key: C');
        expect(draft.markdown).toContain('- Time: 4/4');
    });

    test('a caller who knows the title beats anything guessed', () => {
        const draft = draftOpenLyric(
            'A line about the harbour\nAnd another one after it',
            { title: 'Named By The Caller', artist: 'A Person' },
        );
        expectValid(draft);
        expect(draft.markdown).toContain('- Title: Named By The Caller');
        expect(draft.markdown).toContain('- Artist: A Person');
    });
});

describe('the traps, one at a time', () => {
    test('brackets in the words never become a chord annotation', () => {
        const draft = draftOpenLyric(
            'Sing it [twice] and mean it\nThen sing it once again',
        );
        expectValid(draft);
        expect(draft.markdown).toContain('Sing it (twice) and mean it');
    });

    test('a fence marker in the words does not end the section', () => {
        const draft = draftOpenLyric(
            '```not a fence at all\nAnd a second line after it',
        );
        expectValid(draft);
        expect(toPartNames(draft.markdown).length).toBeGreaterThan(0);
    });

    test('an indented line does not become a translation', () => {
        // Valid either way, so no validator would ever catch this -- it is
        // simply the wrong thing on a projector.
        const draft = draftOpenLyric(
            '    Down by the harbour wall\n    The lanterns and the gulls',
        );
        expectValid(draft);
        expect(draft.markdown).toContain('Down by the harbour wall\n');
        expect(draft.markdown).not.toContain('    Down by');
    });

    test('a leading comment marker keeps its words', () => {
        const draft = draftOpenLyric(
            '// Down by the harbour wall\nThe lanterns and the gulls',
        );
        expectValid(draft);
        expect(draft.markdown).toContain('Down by the harbour wall');
    });

    test('two blocks with the same label do not collide', () => {
        const draft = draftOpenLyric(
            [
                'Chorus 1',
                'One line here',
                '',
                'Chorus 1',
                'A different line here',
            ].join('\n'),
        );
        expectValid(draft);
        const names = toPartNames(draft.markdown);
        expect(new Set(names).size).toBe(names.length);
    });

    test('a second Intro has nowhere to go and becomes free text', () => {
        // Intro cannot be numbered, so there is exactly one per document.
        const draft = draftOpenLyric(
            [
                'Intro',
                'Something spoken here',
                '',
                'Intro',
                'Something else spoken',
            ].join('\n'),
        );
        expectValid(draft);
        expect(toPartNames(draft.markdown)).toContain('Intro');
        expect(toPartNames(draft.markdown)).toContain('Breakdown 1');
    });
});

describe('when there is no song', () => {
    test('prose is refused rather than dressed up as a song', () => {
        const draft = draftOpenLyric(
            'A Bible translation is a rendering of the scriptures into ' +
                'another language. Translators weigh accuracy against ' +
                'readability, and different committees reach different ' +
                'conclusions about that balance.',
        );
        expect(draft.markdown).toBeNull();
        expect(draft.outcome).toBe('not-a-song');
        expect(draftOpenLyricText(draft)).not.toContain('ol:Config');
    });

    test('nothing at all is refused', () => {
        expect(draftOpenLyric('').markdown).toBeNull();
        expect(draftOpenLyric('   \n  \n ').markdown).toBeNull();
        expect(draftOpenLyric(null).outcome).toBe('not-a-song');
    });

    test('a song already in this notation is left alone', () => {
        const already = [
            '```ol:Config',
            '- Title: Already Written',
            '- Artist: A Person',
            '- Copyright: Public Domain',
            '- Key: C',
            '- Tempo: 120bpm',
            '- Time: 4/4',
            '- Structure: V1',
            '```',
            '',
            '```ol:Verse 1',
            'A line about the harbour',
            '```',
        ].join('\n');
        const draft = draftOpenLyric(already);
        expect(draft.outcome).toBe('already-open-lyric');
        expect(draft.markdown).toBeNull();
        // And it says what to do instead rather than silently doing nothing.
        expect(formatFor(draft)).toContain('no `mode`');
    });

    test('something far too long is refused before it is parsed', () => {
        const draft = draftOpenLyric('a line of words\n'.repeat(20000));
        expect(draft.outcome).toBe('too-long');
        expect(draft.markdown).toBeNull();
    });
});

describe('the report', () => {
    test('carries the song, the validation and the guesses', () => {
        const text = draftOpenLyricText(
            'Down by the quiet harbour wall\nThe lanterns and the gulls and all',
        );
        expect(text).toContain('Drafted a song');
        expect(text).toContain('Valid Open Lyric. No problems found.');
        expect(text).toContain('Guessed, and worth telling them:');
        expect(text).toContain('```ol:Config');
        // The model must not repeat the notation at the user.
        expect(text).toContain('Do NOT paste it into your answer');
    });

    test('a long song is cut before it is charged for ten rounds', () => {
        const long = Array.from({ length: 400 }, (_ignored, index) => {
            return `A line of words numbered ${index} in this song\n` +
                `And a second line numbered ${index} after it\n`;
        }).join('\n');
        const text = draftOpenLyricText(long);
        expect(text).toContain('cut here');
        // Not tighter: `formatOpenLyricReport` lists every section by name,
        // and 400 of them is most of what is left. Real songs have under 20.
        expect(text.length).toBeLessThan(30000);
    });
});

describe('a song read off a page', () => {
    // The shape a chord site serves: a heading, a toolbar, a metadata strip, a
    // strumming diagram, then the song itself laid out in columns that text
    // extraction flattens into one fragment per line -- and a fretboard chart
    // and a footer after it. Invented song, invented band, invented site.
    const CHART = ['4fr', '1', '3', '4', '2', 'X', 'e'];
    const PAGE = [
        '--- BEGIN WEBSITE TEXT: a document that was read. ---',
        'Blue Lantern',
        'The Made Up Singers',
        'playlist_add',
        'Add to',
        'swap_vert',
        'Key: D  ·  Time: 4/4  ·  Tempo: 96bpm  ·  check_boxSimplify',
        'play_arrow Pat1',
        ...CHART,
        'Verse 1:(2x)',
        '|',
        'D',
        '    a lan',
        '|',
        'A',
        'tern on the water  ',
        'and nobody to row it home',
        'Chorus:',
        '|',
        'G',
        'carry the light along the wall',
        'Repeat Verse 1',
        ' Guitar chords',
        ...CHART,
        'Related songs',
        '© 2019 Nobody At All',
        '--- END WEBSITE TEXT ---',
    ].join('\n');

    test('finds the song among the furniture and writes it out', () => {
        const draft = draftOpenLyric(PAGE);
        expectValid(draft);
        expect(toPartNames(draft.markdown)).toEqual(['Verse 1', 'Chorus']);
        expect(draft.markdown).toContain('- Title: Blue Lantern');
        expect(draft.markdown).toContain('- Artist: The Made Up Singers');
        expect(draft.markdown).toContain('- Key: D');
        expect(draft.markdown).toContain('- Tempo: 96bpm');
        // None of the page may be sung.
        expect(draft.markdown).not.toContain('playlist_add');
        expect(draft.markdown).not.toContain('Guitar chords');
        expect(draft.markdown).not.toContain('Related songs');
    });

    test('rejoins a row the layout broke into fragments', () => {
        // "a lan" + "tern on the water" is one line, joined with nothing --
        // the chord landed inside the word, and it is still there, written
        // exactly where the page put it.
        expect(draftOpenLyric(PAGE).markdown).toContain(
            '|[D]a lan|[A]tern on the water',
        );
    });

    test('keeps the page address with the song as an attachment', () => {
        const draft = draftOpenLyric(
            [
                'Read https://example.com/lyric/blue-lantern',
                'Title: Blue Lantern',
                '',
                '--- BEGIN WEBSITE TEXT ---',
                'Blue Lantern',
                'The Made Up Singers',
                'playlist_add',
                'Key: D  ·  Time: 4/4  ·  Tempo: 96bpm',
                '|',
                'D',
                'a lantern on the water',
                'and nobody to row it home',
                '--- END WEBSITE TEXT ---',
            ].join('\n'),
        );
        expectValid(draft);
        expect(draft.markdown).toContain(
            '- Attachments: https://example.com/lyric/blue-lantern',
        );
    });

    test('never takes an address out of the page itself', () => {
        // The header in front of the fence is written by this package; the
        // body is written by a stranger. A `Read https://...` line planted in
        // a page would otherwise be filed as the song's own source.
        const draft = draftOpenLyric(
            [
                '--- BEGIN WEBSITE TEXT ---',
                'Read https://example.com/not-the-source',
                'a lantern on the water',
                'and nobody to row it home',
                '--- END WEBSITE TEXT ---',
            ].join('\n'),
        );
        expect(draft.markdown).not.toContain('- Attachments:');
    });

    test('reads a repeat count and a reference into the play order', () => {
        // `Verse 1:(2x)` is sung twice, and `Repeat Verse 1` is sung again
        // after the chorus. Neither is a second copy of the words.
        expect(toStructure(draftOpenLyric(PAGE).markdown)).toBe('V1x2CV1');
    });

    test('says which part of the page it used', () => {
        const said = draftOpenLyric(PAGE).guessed.join(' ');
        expect(said).toContain('a page rather than plain words');
        // Named by its first and last line, which is the only evidence a
        // reader has that the toolbar or the footer got in.
        expect(said).toContain('running "Verse 1:(2x)"');
        expect(said).toContain('lines of menus, chord charts and links');
        expect(said).toContain('say where the song starts and ends');
    });

    test('takes the caller’s word over its own reading', () => {
        const draft = draftOpenLyric(PAGE, {
            title: 'A Better Title',
            artist: 'Somebody Else',
        });
        expectValid(draft);
        expect(draft.markdown).toContain('- Title: A Better Title');
        expect(draft.markdown).toContain('- Artist: Somebody Else');
    });

    test('takes the caller’s word for where the song is', () => {
        const draft = draftOpenLyric(PAGE, {
            from: 'Chorus:',
            to: 'carry the light',
        });
        expectValid(draft);
        expect(draft.markdown).toContain('carry the light along the wall');
        expect(draft.markdown).not.toContain('a lantern on the water');
        expect(draft.guessed.join(' ')).not.toContain(
            'say where the song starts and ends',
        );
    });

    test('pairs a line in a second language with the line above it', () => {
        // An indented line under a lyric line IS its translation (schema.md
        // §2), which is exactly what a bilingual song page draws. The Khmer
        // below is ordinary vocabulary, not a lyric.
        const draft = draftOpenLyric(
            [
                '--- BEGIN WEBSITE TEXT ---',
                'Blue Lantern',
                'The Made Up Singers',
                'playlist_add',
                'swap_vert',
                '|',
                'D',
                'ខ្ញុំច្រៀង',
                'I am singing',
                '|',
                'A',
                'ដោយអំណរ',
                'and I am glad of it',
                '--- END WEBSITE TEXT ---',
            ].join('\n'),
        );
        expectValid(draft);
        expect(draft.markdown).toContain('\n\tI am singing');
        expect(draft.guessed.join(' ')).toContain('second language');
    });

    test('numbers a hymn whose stanzas are numbered in line', () => {
        const draft = draftOpenLyric(
            [
                '--- BEGIN WEBSITE TEXT ---',
                'Home',
                'Log in',
                'Register',
                'Search',
                'Browse',
                '1 a lantern on the water',
                'and nobody to row it home',
                '',
                '2 the harbour keeps its quiet',
                'until the morning comes again',
                '',
                '3 a bell across the shingle',
                'and everybody sleeping still',
                'Popular',
                'Topics',
                'Store',
                'Blog',
                '--- END WEBSITE TEXT ---',
            ].join('\n'),
        );
        expectValid(draft);
        expect(toPartNames(draft.markdown)).toEqual([
            'Verse 1',
            'Verse 2',
            'Verse 3',
        ]);
        // The number is the label, not the first word of the song.
        expect(draft.markdown).not.toContain('1 a lantern');
        expect(draft.markdown).toContain('a lantern on the water');
        expect(draft.markdown).not.toContain('Log in');
    });

    test('reads a verse number written in another script', () => {
        expect(parseSectionLabel('១.')).toMatchObject({
            header: 'Verse',
            index: 1,
        });
        expect(parseSectionLabel('៤.')).toMatchObject({
            header: 'Verse',
            index: 4,
        });
    });

    test('refuses a key the notation has no name for, and says so', () => {
        const draft = draftOpenLyric(
            [
                'Title: Blue Lantern',
                'Key: H sharp minor with a capo',
                'Tempo: 96 bpm',
                '',
                'a lantern on the water',
                'and nobody to row it home',
            ].join('\n'),
        );
        expectValid(draft);
        // The song survives the bad field rather than falling to tier 2.
        expect(draft.tier).toBe(1);
        expect(draft.markdown).toContain('- Key: C');
        // And a tempo written the long way is corrected rather than refused.
        expect(draft.markdown).toContain('- Tempo: 96bpm');
        expect(draft.guessed.join(' ')).toContain(
            'not one open-lyric has a name for',
        );
    });

    test('says nothing about a page when the words were simply pasted', () => {
        const draft = draftOpenLyric(
            ['a lantern on the water', 'and nobody to row it home'].join('\n'),
        );
        expectValid(draft);
        expect(draft.guessed.join(' ')).not.toContain('a page rather than');
    });
});

function formatFor(draft) {
    return draftOpenLyricText(draft.markdown ?? '```ol:Config\n```');
}

// What a model ACTUALLY hands over after reading a hymnal page, measured
// 2026-09-08 on two providers: not the page whole, but its own copy of the
// words with the page's title line and a "Tune:" line on top, sometimes with
// `from`/`to` around the stanzas. Invented hymn, invented site.
describe('a hymn handed over with its heading still on', () => {
    const STANZAS = [
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
        '3 the evening takes the lantern',
        'and hangs it on a hook',
        'and nobody remembers',
        'the water that it took',
    ];
    const TEXT = [
        'Blue Lantern (a song about a lantern) | Made Up Hymnal',
        'Blue Lantern (a song about a lantern)',
        'Author: Somebody Madeup (1801)',
        'Tune: HARBOUR',
        '',
        ...STANZAS,
        '',
        'Copyright: Public Domain',
    ].join('\n');

    test('the markers are believed on plain words too', () => {
        const draft = draftOpenLyric(TEXT, {
            title: 'Blue Lantern',
            from: 'a lantern on the water',
            to: 'the water that it took',
        });
        expectValid(draft);
        expect(toPartNames(draft.markdown)).toEqual([
            'Verse 1',
            'Verse 2',
            'Verse 3',
        ]);
        expect(draft.markdown).not.toContain('Tune: HARBOUR');
        expect(draft.markdown).toContain('- Title: Blue Lantern');
    });

    test('a short block above stanza 1 is the heading, and names the hymn', () => {
        const draft = draftOpenLyric(TEXT, {});
        expectValid(draft);
        expect(toPartNames(draft.markdown)).toEqual([
            'Verse 1',
            'Verse 2',
            'Verse 3',
        ]);
        expect(draft.markdown).not.toContain('Made Up Hymnal');
        expect(draft.markdown).not.toContain('Tune: HARBOUR');
        // The page's own title line, cut at the site name.
        expect(draft.markdown).toContain(
            '- Title: Blue Lantern (a song about a lantern)',
        );
        expect(draft.markdown).toContain('- Artist: Somebody Madeup (1801)');
        expect(draft.markdown).toContain('- Copyright: Public Domain');
        expect(draft.guessed.join('\n')).toContain('above the first numbered verse');
    });

    test('a long opening block is a verse, numbered stanzas or not', () => {
        const draft = draftOpenLyric(
            [
                'before the lantern there was dark',
                'and nobody to light it',
                'the harbour kept its counsel',
                'until the lantern came',
                '',
                ...STANZAS,
            ].join('\n'),
            {},
        );
        expectValid(draft);
        expect(toPartNames(draft.markdown)).toHaveLength(4);
    });

    test('with no numbers a three-line opening block stays a verse', () => {
        const draft = draftOpenLyric(
            [
                'a lantern on the water',
                'and nobody to row it home',
                'until the morning comes',
                '',
                'the morning finds the lantern',
                'still burning on the tide',
                'is glad of it inside',
            ].join('\n'),
            {},
        );
        expectValid(draft);
        expect(toPartNames(draft.markdown)).toHaveLength(2);
    });
});

describe('what the caller was told outright', () => {
    test('a copyright handed in is written, and the page line still wins over nothing', () => {
        const words = [
            'a lantern on the water',
            'and nobody to row it home',
            'the harbour keeps its quiet',
            'until the morning comes',
        ].join('\n');
        const told = draftOpenLyric(words, { copyright: 'Public Domain' });
        expectValid(told);
        expect(told.markdown).toContain('- Copyright: Public Domain');
        const untold = draftOpenLyric(words, {});
        expect(untold.markdown).toContain('- Copyright: Unknown');
    });
});
