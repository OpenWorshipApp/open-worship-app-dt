// The Khmer cases of `tools/owa-devtools-mcp/openLyricDraft.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
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

import { validateOpenLyric } from '../../../../../../../../tools/owa-devtools-mcp/openLyric.mjs';
import {
    BROWSER_CHECK_TEXT,
    checkIsBrowserCheckPage,
    checkIsChordLine,
    checkIsMixedSafe,
    checkIsPlaceholderPage,
    draftOpenLyric,
    draftOpenLyricText,
    parseSectionLabel,
    stripWebsiteWrapper,
    toHeadingTitle,
    toSafeLyricLine,
    toStructureText,
} from '../../../../../../../../tools/owa-devtools-mcp/openLyricDraft.mjs';

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
});

describe("a hymnal deck's title slide", () => {
    // What the deck reader gives for a hymnal deck (EC-590): a title slide
    // of three lines -- the hymn's number as a lead-in, its name, its
    // English name -- over numbered stanzas, each a slide. Made-up words on
    // the user's deck's pattern (`documentTextHelpers.test.ts`).
    const TITLE_SLIDE = ['លេខ ១ ថ្មី​ :', 'ចង្កៀង​ពណ៌​ខៀវ?', 'The Blue Lantern?'];
    const STANZAS = [
        '១- ចង្កៀង​មួយ​នៅ​លើ​ទឹក',
        'គ្មាន​អ្នក​ណា​ចែវ​ទូក​ទៅ​ផ្ទះ',
        'វា​ភ្លឺ​ពេញ​មួយ​យប់',
        'រហូត​ដល់​ពេល​ព្រឹក',
        '',
        '២- ពេល​ព្រឹក​ឃើញ​ចង្កៀង',
        'នៅ​តែ​ភ្លឺ​លើ​រលក',
        'ទូក​ទាំង​អស់​ដែល​ឆ្លង​កាត់',
        'ក៏​អរ​សប្បាយ​ដែរ',
    ];

    test('the number, the name and the English name are the title', () => {
        expect(toHeadingTitle(TITLE_SLIDE)).toBe(
            'លេខ ១ ថ្មី​ : ចង្កៀង​ពណ៌​ខៀវ? The Blue Lantern?',
        );
    });

    test('a second line in the same script is not the title translated', () => {
        expect(
            toHeadingTitle(['លេខ ១ ថ្មី :', 'ចង្កៀង​ពណ៌​ខៀវ', 'ពី​សៀវភៅ​ចម្រៀង']),
        ).toBe('លេខ ១ ថ្មី : ចង្កៀង​ពណ៌​ខៀវ');
    });

    test('the deck is drafted under it, its stanzas whole', () => {
        const draft = draftOpenLyric([...TITLE_SLIDE, '', ...STANZAS].join('\n'));
        expectValid(draft);
        expect(draft.markdown).toContain(
            '- Title: លេខ ១ ថ្មី​ : ចង្កៀង​ពណ៌​ខៀវ? The Blue Lantern?',
        );
        expect(toPartNames(draft.markdown)).toEqual(['Verse 1', 'Verse 2']);
        expect(draft.markdown).toContain('ចង្កៀង​មួយ​នៅ​លើ​ទឹក');
    });
});

function formatFor(draft) {
    return draftOpenLyricText(draft.markdown ?? '```ol:Config\n```');
}
