// @vitest-environment jsdom
//
// `openLyric.mjs` writes out a grammar that lives in another package. This is
// what stops it drifting: every document in the corpus goes through open-lyric's
// OWN validator and through ours, and a disagreement fails the suite.
//
// It is the only test here that needs jsdom -- open-lyric pulls monaco in and
// touches `document` at module scope -- which is why it is a file of its own:
// `openLyric.test.mjs` stays a plain, fast node test.
//
// `api.document.checkMarkdown` answers a boolean, so only the VERDICT can be
// compared. The messages are ours, and `openLyric.test.mjs` covers those.

import { describe, expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';
import { draftOpenLyric } from './openLyricDraft.mjs';

// monaco-editor's clipboard contrib probes these at module-eval time and jsdom
// implements neither, so open-lyric must be imported AFTER the patch.
document.queryCommandSupported ??= () => {
    return false;
};
document.execCommand ??= () => {
    return false;
};
const { EditorOpenLyricPlugin } = await import('open-lyric');
const openLyricApi = new EditorOpenLyricPlugin().getOpenLyricApi();

const REQUIRED_CONFIG_LINES = [
    '- Title: T',
    '- Artist: A',
    '- Copyright: C',
    '- Key: C',
    '- Tempo: 68bpm',
    '- Time: 4/4',
];

function genDoc(configExtraList, sectionList) {
    return [
        '```ol:Config',
        ...REQUIRED_CONFIG_LINES,
        ...configExtraList,
        '```',
        ...sectionList,
    ].join('\n');
}

function genLyricDoc(line) {
    return genDoc(['- Structure: V1'], ['```ol:Verse 1', line, '```']);
}

function genProgressionDoc(line) {
    return genDoc(
        ['- Structure: IS1'],
        ['```ol:Instrumental 1', line, '```'],
    );
}

function genMixedDoc(line) {
    return genDoc(['- Structure: I'], ['```ol:Intro', line, '```']);
}

/**
 * Every case is `[name, document, expected]`, and `expected` is asserted
 * against BOTH validators -- so a case whose expectation is wrong fails on
 * open-lyric before it can be enshrined here.
 */
const CASE_LIST = [
    // -- document shape ---------------------------------------------------
    ['minimal valid', genLyricDoc('hi'), true],
    ['empty text', '', false],
    ['plain markdown only', '# Just a heading\n\nsome text', false],
    ['no Config fence', '```ol:Verse 1\nhi\n```', false],
    ['lowercase ol:config', '```ol:config\n- Title: T\n```', false],
    ['Config numbered', '```ol:Config 1\n- Title: T\n```', false],
    ['unclosed fence', genDoc(['- Structure: V1'], ['```ol:Verse 1', 'hi']), false],
    [
        'duplicate part',
        genDoc(
            ['- Structure: V1'],
            ['```ol:Verse 1', 'a', '```', '```ol:Verse 1', 'b', '```'],
        ),
        false,
    ],
    [
        'unknown header',
        genDoc(
            ['- Structure: V1'],
            ['```ol:Verse 1', 'hi', '```', '```ol:Wibble', 'x', '```'],
        ),
        false,
    ],
    [
        'unnumbered header given an index',
        genDoc(['- Structure: O'], ['```ol:Outro 1', 'hi', '```']),
        false,
    ],
    [
        'zero-padded section index',
        genDoc(['- Structure: V1'], ['```ol:Verse 01', 'hi', '```']),
        false,
    ],
    [
        'declared but never played',
        genDoc(
            ['- Structure: V1'],
            ['```ol:Verse 1', 'a', '```', '```ol:Chorus', 'b', '```'],
        ),
        true,
    ],
    [
        'text outside the fences',
        `# Title\n\nsome prose\n\n${genLyricDoc('hi')}`,
        true,
    ],
    ['CRLF line endings', genLyricDoc('hi').replace(/\n/g, '\r\n'), true],
    [
        'indented fence',
        genDoc(['- Structure: V1'], ['  ```ol:Verse 1', 'hi', '  ```']),
        true,
    ],
    [
        'backticks mid-line do not close a fence',
        genDoc(['- Structure: V1'], ['```ol:Verse 1', 'a```b', '```']),
        true,
    ],
    ['trailing space after the header', genLyricDoc('hi').replace('ol:Verse 1', 'ol:Verse 1 '), true],
    [
        'blank lines everywhere',
        genDoc(['- Structure: V1', ''], ['```ol:Verse 1', 'a', '', 'b', '```']),
        true,
    ],
    [
        'every lyric fence header',
        genDoc(
            ['- Structure: V1P1CX1FB1R1T1N1'],
            [
                '```ol:Verse 1',
                'a',
                '```',
                '```ol:Pre-Chorus 1',
                'b',
                '```',
                '```ol:Chorus',
                'c',
                '```',
                '```ol:Post-Chorus 1',
                'd',
                '```',
                '```ol:Final-Chorus',
                'e',
                '```',
                '```ol:Bridge 1',
                'f',
                '```',
                '```ol:Refrain 1',
                'g',
                '```',
                '```ol:Tag 1',
                'h',
                '```',
                '```ol:Note 1',
                'i',
                '```',
            ],
        ),
        true,
    ],

    // -- Config -----------------------------------------------------------
    ['missing Artist', genLyricDoc('hi').replace('- Artist: A\n', ''), false],
    ['missing Structure', genDoc([], ['```ol:Verse 1', 'hi', '```']), false],
    ['empty Title', genLyricDoc('hi').replace('- Title: T', '- Title:'), false],
    [
        'empty optional single-line field',
        genDoc(['- Structure: V1', '- Subtitle:'], ['```ol:Verse 1', 'hi', '```']),
        false,
    ],
    [
        'empty multiline field',
        genDoc(
            ['- Structure: V1', '- Description:'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        true,
    ],
    ['bad Tempo', genLyricDoc('hi').replace('68bpm', '68 bpm'), false],
    ['bad Key', genLyricDoc('hi').replace('- Key: C', '- Key: H'), false],
    ['bad Time', genLyricDoc('hi').replace('- Time: 4/4', '- Time: 5/4'), false],
    [
        'unknown Config field',
        genDoc(['- Structure: V1', '- Wibble: x'], ['```ol:Verse 1', 'hi', '```']),
        false,
    ],
    [
        'duplicate Config field',
        genDoc(['- Structure: V1', '- Title: X'], ['```ol:Verse 1', 'hi', '```']),
        false,
    ],
    [
        'stray continuation line',
        genDoc(['- Structure: V1', '\tstray'], ['```ol:Verse 1', 'hi', '```']),
        false,
    ],
    ['every Config line indented', '```ol:Config\n\t- Title: T\n```', false],
    [
        'Description continuation lines',
        genDoc(
            ['- Structure: V1', '- Description:', '\tline one', '\tline two'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        true,
    ],
    [
        'a Title holding a colon',
        genLyricDoc('hi').replace('- Title: T', '- Title: A: B'),
        true,
    ],
    [
        'all the optional fields',
        genDoc(
            [
                '- Structure: V1',
                '- Subtitle: S',
                '- Theme: T',
                '- Genre: G',
                '- Style: St',
            ],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        true,
    ],
    [
        'a comment line in Config',
        genDoc(['- Structure: V1', '// a comment'], ['```ol:Verse 1', 'hi', '```']),
        true,
    ],

    // -- Locales ----------------------------------------------------------
    [
        'good locales',
        genDoc(
            ['- Structure: V1', '- Locales: en-US, km-KH'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        true,
    ],
    [
        'locale outside the closed set',
        genDoc(
            ['- Structure: V1', '- Locales: zz-ZZ'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        false,
    ],
    [
        'duplicate locale, different case',
        genDoc(
            ['- Structure: V1', '- Locales: en-US, en-us'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        false,
    ],
    [
        'empty Locales',
        genDoc(['- Structure: V1', '- Locales:'], ['```ol:Verse 1', 'hi', '```']),
        false,
    ],

    // -- Attachments and strumming ----------------------------------------
    [
        'bare URL attachment',
        genDoc(
            ['- Structure: V1', '- Attachments: https://e.com/a.mp3'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        true,
    ],
    [
        'markdown-link attachment',
        genDoc(
            ['- Structure: V1', '- Attachments: [Chart](file:///C:/x.pdf)'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        true,
    ],
    [
        'attachment with no scheme',
        genDoc(
            ['- Structure: V1', '- Attachments: notaurl'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        false,
    ],
    [
        'strumming pattern with a label',
        genDoc(
            [
                '- Structure: V1',
                '- Strumming Patterns:',
                '\t// label',
                '\td--u-- | d-u---',
            ],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        true,
    ],
    [
        'the singular Strumming Pattern alias',
        genDoc(
            ['- Structure: V1', '- Strumming Pattern:', '\td--u--'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        true,
    ],
    [
        'strumming pattern with a letter that is not a step',
        genDoc(
            ['- Structure: V1', '- Strumming Patterns:', '\tzzz'],
            ['```ol:Verse 1', 'hi', '```'],
        ),
        false,
    ],

    // -- Structure --------------------------------------------------------
    [
        'undeclared part',
        genDoc(['- Structure: C'], ['```ol:Verse 1', 'hi', '```']),
        false,
    ],
    [
        'the same part twice in a row',
        genDoc(['- Structure: V1V1'], ['```ol:Verse 1', 'hi', '```']),
        false,
    ],
    ['a repeat count', genDoc(['- Structure: V1x2'], ['```ol:Verse 1', 'hi', '```']), true],
    ['x with no count', genDoc(['- Structure: V1x'], ['```ol:Verse 1', 'hi', '```']), false],
    ['x0', genDoc(['- Structure: V1x0'], ['```ol:Verse 1', 'hi', '```']), false],
    ['index 0', genDoc(['- Structure: V0'], ['```ol:Verse 1', 'hi', '```']), false],
    [
        'a numbered code for an unnumbered section',
        genDoc(['- Structure: O1'], ['```ol:Outro', 'hi', '```']),
        false,
    ],
    [
        'whitespace inside Structure',
        genDoc(
            ['- Structure: V1 C'],
            ['```ol:Verse 1', 'hi', '```', '```ol:Chorus', 'b', '```'],
        ),
        false,
    ],
    ['unknown code', genDoc(['- Structure: Z'], ['```ol:Verse 1', 'hi', '```']), false],
    [
        'lower-case code',
        genDoc(['- Structure: v1'], ['```ol:Verse 1', 'hi', '```']),
        false,
    ],
    [
        'IS beats I + S',
        genDoc(['- Structure: IS1'], ['```ol:Instrumental 1', '| C |', '```']),
        true,
    ],
    [
        'TU beats T + U',
        genDoc(['- Structure: TU1'], ['```ol:Turnaround 1', '| C | G |', '```']),
        true,
    ],
    [
        'a bare and a numbered Verse are different parts',
        genDoc(
            ['- Structure: VV1'],
            ['```ol:Verse', 'a', '```', '```ol:Verse 1', 'b', '```'],
        ),
        true,
    ],
    [
        'a two-digit index',
        genDoc(['- Structure: V10'], ['```ol:Verse 10', 'hi', '```']),
        true,
    ],
    [
        'the same part not in a row',
        genDoc(
            ['- Structure: V1CV1'],
            ['```ol:Verse 1', 'hi', '```', '```ol:Chorus', 'b', '```'],
        ),
        true,
    ],

    // -- Chord symbols ----------------------------------------------------
    ['[Cadd9]', genLyricDoc('[Cadd9]hi'), true],
    ['[Cmaj7]', genLyricDoc('[Cmaj7]hi'), true],
    ['[D/F#]', genLyricDoc('[D/F#]hi'), true],
    ['[Bb]', genLyricDoc('[Bb]hi'), true],
    ['[Csus]', genLyricDoc('[Csus]hi'), true],
    ['[Cdim7]', genLyricDoc('[Cdim7]hi'), true],
    ['[Caug]', genLyricDoc('[Caug]hi'), true],
    ['[Cmin]', genLyricDoc('[Cmin]hi'), true],
    ['[C13]', genLyricDoc('[C13]hi'), true],
    ['[Comit5]', genLyricDoc('[Comit5]hi'), true],
    ['[C7sus4] is two decorations', genLyricDoc('[C7sus4]hi'), false],
    ['[Cm7b5] has no altered fifth', genLyricDoc('[Cm7b5]hi'), false],
    ['[Gadd] has no extension', genLyricDoc('[Gadd]hi'), false],
    ['[Cno3] has no such extension', genLyricDoc('[Cno3]hi'), false],
    ['[C3] has no such extension', genLyricDoc('[C3]hi'), false],
    ['[H] is not a root', genLyricDoc('[H]hi'), false],
    ['[c] is not a root', genLyricDoc('[c]hi'), false],
    ['[] is empty', genLyricDoc('[]hi'), false],
    ['[C ] has a space', genLyricDoc('[C ]hi'), false],
    ['[C hi] is not a chord', genLyricDoc('[C hi]there'), false],
    ['a chord mid-word', genLyricDoc('hel[C]lo there'), true],
    ['an unclosed [', genLyricDoc('[C hi'), false],
    ['a bare ]', genLyricDoc('hi]'), false],
    ['a ] after a good chord', genLyricDoc('[C]hi]'), false],
    ['a [ inside a comment line', genDoc(['- Structure: V1'], ['```ol:Verse 1', '// [ unclosed', 'hi', '```']), true],

    // -- Lyric bodies -----------------------------------------------------
    ['bars in a lyric line', genLyricDoc('|[G]Carry me |[D/F#]gently'), true],
    ['bars with no words', genLyricDoc('| | |'), true],
    [
        'a translation line',
        genDoc(['- Structure: V1'], ['```ol:Verse 1', '[G]Hello', '\tសួស្តី', '```']),
        true,
    ],
    ['inline markdown', genLyricDoc('**bold** and *ital* words'), true],
    ['a font tag', genLyricDoc('<font color="#0f766e">colored</font>'), true],
    ['an empty lyric body', genDoc(['- Structure: V1'], ['```ol:Verse 1', '```']), true],
    [
        'a body of nothing but comments',
        genDoc(['- Structure: V1'], ['```ol:Verse 1', '// note', '```']),
        true,
    ],

    // -- Progression bodies -----------------------------------------------
    ['bars, chords and a repeat', genProgressionDoc('| C | G | (2x)'), true],
    ['chords with no bars', genProgressionDoc('C G Am F'), true],
    ['repeat bars', genProgressionDoc('||: C | G :||'), true],
    ['a repeat mid-progression', genProgressionDoc('| C | (2x) | G |'), true],
    ['a cue in front', genProgressionDoc('{c: Piano + Pads } | C | G |'), true],
    ['a cue on its own', genProgressionDoc('{c: Pads}'), true],
    ['a cue with a character outside its set', genProgressionDoc('{c: Piano @ Pads } | C |'), false],
    ['two cues', genProgressionDoc('{c: Pads} {c: Piano} | C |'), false],
    ['{p:} is not for Instrumental', genProgressionDoc('{p: #1} | C | G |'), false],
    ['sung words in a progression', genProgressionDoc('| C | hello |'), false],
    ['a lower-case chord', genProgressionDoc('| c | G |'), false],
    ['(2X)', genProgressionDoc('| C | G | (2X)'), false],
    ['(2 x)', genProgressionDoc('| C | G | (2 x)'), false],
    ['an unclosed repeat', genProgressionDoc('| C | G | (2x'), false],
    ['an empty progression body', genDoc(['- Structure: IS1'], ['```ol:Instrumental 1', '```']), true],
    [
        'a cue on the second line is mid-progression',
        genDoc(['- Structure: IS1'], ['```ol:Instrumental 1', '| C |', '{c: Pads}', '```']),
        false,
    ],
    [
        'a multi-line progression',
        genDoc(
            ['- Structure: IS1'],
            ['```ol:Instrumental 1', '| C | G |', '| Am | F |', '```'],
        ),
        true,
    ],
    [
        'Interlude takes a progression too',
        genDoc(['- Structure: L1'], ['```ol:Interlude 1', '| C | G |', '```']),
        true,
    ],

    // -- Mixed bodies -----------------------------------------------------
    ['a sung Intro line', genMixedDoc('hello there'), true],
    ['a strumming directive on its own', genMixedDoc('{p: #1}'), true],
    ['a sung line with bars and a chord-looking word', genMixedDoc('| Hello | D |'), false],
    ['an empty mixed body', genMixedDoc(''), true],
    [
        'a progression line above a sung one',
        genDoc(
            ['- Structure: IV1'],
            [
                '```ol:Intro',
                '{p: #1} | G | D | (2x)',
                'sung words here',
                '```',
                '```ol:Verse 1',
                'hi',
                '```',
            ],
        ),
        true,
    ],
    ['a sung Outro', genDoc(['- Structure: O'], ['```ol:Outro', 'Still You are near', '```']), true],
    [
        'a sung Turnaround',
        genDoc(['- Structure: TU1'], ['```ol:Turnaround 1', 'sung words', '```']),
        true,
    ],

    // -- Free-text bodies -------------------------------------------------
    [
        'Breakdown takes anything',
        genDoc(['- Structure: D1'], ['```ol:Breakdown 1', 'anything [ ] goes here', '```']),
        true,
    ],
    [
        'Vamp takes anything',
        genDoc(['- Structure: A'], ['```ol:Vamp', 'a ] b [ c', '```']),
        true,
    ],
    [
        'Solo takes anything',
        genDoc(['- Structure: S1'], ['```ol:Solo 1', 'x ] y', '```']),
        true,
    ],

    // -- The schema's own complete example ---------------------------------
    [
        "schema.md §7's complete example",
        [
            '```ol:Config',
            '- Title: Quiet River at Dawn',
            '- Subtitle: A Soft 4/4 Prayer',
            '- Description:',
            '\tA gentle worship draft for acoustic teams.',
            '- Artist: Open Lyric Team',
            '- Copyright: 2026 Open Lyric',
            '- Locales: en-US',
            '- Key: G',
            '- Tempo: 68bpm',
            '- Time: 4/4',
            '- Theme: Quiet trust',
            '- Structure: IV1PCXV2CO',
            '- Genre: Worship',
            '- Style: Acoustic',
            '- Attachments: https://example.com/audio/quiet-river-demo.mp3',
            '- Strumming Patterns:',
            '\t// Slow rolling pulse',
            '\td--u-- | d-u---',
            '```',
            '',
            '```ol:Intro',
            '// Count the band in on bar 2',
            '{p: #1} | G | D/F# | Em7 | Cadd9 | (2x)',
            '```',
            '',
            '```ol:Verse 1',
            'Morning breaks with mercy on the water',
            'Every breath reminds me You are near',
            '```',
            '',
            '```ol:Pre-Chorus',
            '[Em7]When the waters rise, [D]You remain',
            '[Cadd9]Steady as the promise [D]of Your name',
            '```',
            '',
            '```ol:Chorus',
            '|[G]Carry me gently, carry me kindly',
            '|[D/F#]Hold me in peace when the night feels long',
            '```',
            '',
            '```ol:Post-Chorus',
            '|[Em7]River of peace, keep carrying me',
            '```',
            '',
            '```ol:Verse 2',
            'Every hidden worry meets Your silence',
            '```',
            '',
            '```ol:Outro',
            'Still You are near, still You are near',
            '```',
        ].join('\n'),
        true,
    ],
];

// ---------------------------------------------------------------------------
// The emitter, against the same oracle
// ---------------------------------------------------------------------------
//
// `openLyricDraft.test.mjs` proves the emitter agrees with `openLyric.mjs`,
// which is circular: both are ours. THIS is what proves the Lyric Editor will
// actually take a drafted song -- and it is the only thing that would notice
// if an `npm i` quietly stopped `Breakdown` being the fence nothing can fail
// in, which is the assumption tier 2 rests on.
//
// Made-up songs, deliberately. A fixture ships in every clone of this repo.
const DRAFT_INPUT_LIST = [
    [
        'labelled sections',
        [
            'River of Slate',
            '',
            '[Verse 1]',
            'Morning walks the water low',
            'Slate and silver, soft and slow',
            '',
            '[Chorus]',
            'Carry the light, carry it far',
            '',
            'Verse 2:',
            'Evening folds the hills away',
            '',
            'BRIDGE',
            'And the stones remember rain',
        ].join('\n'),
    ],
    [
        'unlabelled stanzas',
        [
            'One for the roads that we walked before',
            'Two for the door that we left ajar',
            '',
            'Three for the sky when the swallows turn',
            'Four for the lamp in the window far',
        ].join('\n'),
    ],
    [
        'a block that comes round again',
        [
            'Verse one about the morning air',
            'And a second line to go with it',
            '',
            'Hold the lantern, hold it high',
            'Over the water',
            '',
            'Verse two about the evening rain',
            'And a second line to go with that',
            '',
            'Hold the lantern, hold it high',
            'Over the water',
        ].join('\n'),
    ],
    [
        'a chord sheet with a section that takes no words',
        [
            '[Verse 1]',
            'G        D        Em       C',
            'Walking out along the harbour wall',
            '',
            '[Instrumental]',
            'guitar solo over the verse chords',
            '',
            '[Ending]',
            '| G | D | Em | C |',
        ].join('\n'),
    ],
    [
        'every silent trap at once',
        [
            '// Down by the (harbour) wall',
            '    An indented line under it',
            'Sing it [twice] and mean it',
            '```not a fence at all',
            '',
            'Chorus 1',
            'One line here',
            '',
            'Chorus 1',
            'A different line here',
        ].join('\n'),
    ],
];

describe('open-lyric accepts what the drafter writes', () => {
    test.each(DRAFT_INPUT_LIST)('%s', (_name, rawText) => {
        const draft = draftOpenLyric(rawText);
        expect(draft.markdown).not.toBeNull();
        // Ours says it is fine...
        expect(validateOpenLyric(draft.markdown).ok).toBe(true);
        // ...and so does the package the Lyric Editor actually runs.
        expect(openLyricApi.document.checkMarkdown(draft.markdown)).toBe(true);
    });

    test('a song read off a page is accepted too', () => {
        // The path that produces the most unusual documents this emitter can
        // write: a flattened chord sheet, whose lines are rejoined from
        // fragments, whose play order comes out of `(2x)` markers, and whose
        // second language becomes an INDENTED translation line -- the one
        // piece of open-lyric grammar nothing else here emits. Invented song,
        // invented band, invented site; the Khmer is ordinary vocabulary.
        const draft = draftOpenLyric(
            [
                '--- BEGIN WEBSITE TEXT ---',
                'Blue Lantern',
                'The Made Up Singers',
                'playlist_add',
                'swap_vert',
                'Key: D  ·  Time: 4/4  ·  Tempo: 96bpm',
                'Verse 1:(2x)',
                '|',
                'D',
                '    a lan',
                '|',
                'A',
                'tern on the water  ',
                'ខ្ញុំច្រៀង',
                'I am singing',
                'Chorus:',
                '|',
                'G',
                'carry the light along the wall',
                'Repeat Verse 1',
                ' Guitar chords',
                '--- END WEBSITE TEXT ---',
            ].join('\n'),
        );
        expect(draft.markdown).not.toBeNull();
        expect(draft.markdown).toContain('\n\tI am singing');
        expect(validateOpenLyric(draft.markdown).ok).toBe(true);
        expect(openLyricApi.document.checkMarkdown(draft.markdown)).toBe(true);
    });

    test('a song whose chords are glued to its words is accepted too', () => {
        // The shape a chord site actually serves: the bar, the chord and the
        // syllable it lands on all in ONE text run. Every chord here has to
        // survive into the document as an annotation and still be accepted.
        const draft = draftOpenLyric(
            [
                'Read https://example.com/lyric/blue-lantern',
                'Title: Blue Lantern',
                '',
                '--- BEGIN WEBSITE TEXT ---',
                'Blue Lantern',
                'The Made Up Singers',
                'playlist_add',
                'swap_vert',
                'Key: D  ·  Time: 4/4  ·  Tempo: 96bpm',
                '© 2026 A Made Up Publisher | Terms of Service',
                'Verse 1:',
                '|D ផ្កាថ្មី',
                '|D រីក នៅ',
                '|A ចាស់',
                'សូមស្តាប់',
                '|Bm ថ្មី',
                'A7 មេឃ',
                'Chorus:',
                '|G ថ្ងៃនេះ',
                '|D យើងច្រៀង',
                'We sing today',
                '--- END WEBSITE TEXT ---',
            ].join('\n'),
        );
        expect(draft.markdown).not.toBeNull();
        expect(draft.markdown).toContain('|[D]ផ្កាថ្មី|[D]រីក នៅ|[A]ចាស់');
        // The page's own address and its notice ride with the song, and
        // open-lyric has to accept both fields as written.
        expect(draft.markdown).toContain(
            '- Attachments: https://example.com/lyric/blue-lantern',
        );
        expect(draft.markdown).toContain(
            '- Copyright: © 2026 A Made Up Publisher',
        );
        expect(validateOpenLyric(draft.markdown).ok).toBe(true);
        expect(openLyricApi.document.checkMarkdown(draft.markdown)).toBe(true);
    });

    test('the bar goes outside the brackets, never inside', () => {
        // Why `|[D]` and not `[|D]`, which is what the page prints and what a
        // reader would reach for first: the brackets hold a chord symbol and
        // nothing else, and a root is A-G. This is the probe, kept.
        const genDoc = (line) => {
            return [
                '```ol:Config',
                ...REQUIRED_CONFIG_LINES,
                '- Structure: V1',
                '```',
                '```ol:Verse 1',
                line,
                '```',
            ].join('\n');
        };
        expect(openLyricApi.document.checkMarkdown(genDoc('[|D]morning'))).toBe(
            false,
        );
        expect(openLyricApi.document.checkMarkdown(genDoc('|[D]morning'))).toBe(
            true,
        );
        expect(validateOpenLyric(genDoc('[|D]morning')).ok).toBe(false);
        expect(validateOpenLyric(genDoc('|[D]morning')).ok).toBe(true);
        // And the same form in the MIDDLE of a row, which is where a page
        // that hands its rows over whole puts every chord but the first.
        const midRow = 'ព្រះហស្ត |[D]ហើយ [A7]សារ |[D]ផង ។';
        expect(openLyricApi.document.checkMarkdown(genDoc(midRow))).toBe(true);
        expect(validateOpenLyric(genDoc(midRow)).ok).toBe(true);
    });

    test('the fallback tier is accepted too', () => {
        // Forced down to tier 2 by asking for a document out of something with
        // no shape at all; `Breakdown` is the fence that cannot be failed, and
        // this is the only test that checks open-lyric still agrees.
        const draft = draftOpenLyric(
            ['{p: #9}', '| G | D |', 'Interlude', '| Em | C |'].join('\n'),
        );
        if (draft.markdown === null) {
            return;
        }
        expect(openLyricApi.document.checkMarkdown(draft.markdown)).toBe(
            validateOpenLyric(draft.markdown).ok,
        );
    });
});

describe('validateOpenLyric agrees with open-lyric itself', () => {
    test.each(CASE_LIST)('%s', (_name, markdown, expected) => {
        expect(openLyricApi.document.checkMarkdown(markdown)).toBe(expected);
        expect(validateOpenLyric(markdown).ok).toBe(expected);
    });

    test('every invalid case says at least one thing about itself', () => {
        for (const [name, markdown, expected] of CASE_LIST) {
            if (expected) {
                continue;
            }
            const { problems } = validateOpenLyric(markdown);
            expect(problems.length, name).toBeGreaterThan(0);
            for (const problem of problems) {
                expect(problem.message, name).toMatch(/\S/);
                expect(problem.line, name).toBeGreaterThan(0);
            }
        }
    });
});
