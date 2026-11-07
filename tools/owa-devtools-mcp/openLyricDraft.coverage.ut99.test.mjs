// What `openLyricDraft.test.mjs` leaves out: a chord line that carries a
// repeat, a markdown heading as the title, an Ending whose words carry a bar,
// a page's toolbar named in the guesses, the free-text tier that cannot fail,
// and a header address that cannot be parsed.
//
// EVERY SONG HERE IS MADE UP: nonsense verses test the grammar as well as a
// real one, and a fixture ships with every clone of this repo.

import { describe, expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';
import { checkIsChordLine, draftOpenLyric } from './openLyricDraft.mjs';

/** The promise the drafter makes: what comes out, the editor accepts. */
function expectValid(draft) {
  expect(draft.markdown).not.toBeNull();
  const report = validateOpenLyric(draft.markdown);
  expect(
    report.problems.map((one) => {
      return `line ${one.line}: ${one.message}`;
    }),
  ).toEqual([]);
}

describe('a chord line', () => {
  test('a repeat count rides along with the chords and the bars', () => {
    expect(checkIsChordLine('| G | D | (2x)')).toBe(true);
    expect(checkIsChordLine('| (2x) |')).toBe(true);
    // A repeat with no chord or bar is no chord line, and one bare
    // letter before it may be a word.
    expect(checkIsChordLine('(2x)')).toBe(false);
    expect(checkIsChordLine('G (2x)')).toBe(false);
  });
});

describe('drafting a song', () => {
  test('a markdown heading is the title and not a line of the song', () => {
    const draft = draftOpenLyric(
      [
        '# Lantern Song',
        '',
        'a lantern on the water',
        'shining in the night',
      ].join('\n'),
    );
    expectValid(draft);
    expect(draft.tier).toBe(1);
    expect(draft.markdown).toContain('- Title: Lantern Song');
    expect(draft.markdown).toContain(
      '```ol:Verse\na lantern on the water\nshining in the night\n```',
    );
    expect(draft.guessed).not.toContain(
      'there was no title in the text, so it is "Untitled"',
    );
  });

  // A chord sheet's intro row above a blank line read as a line "standing
  // alone", and the song was called `G C D Em` -- or `[G]` (2026-11-03).
  test('a row of chords above the song is never its title', () => {
    const verse = [
      'a lantern on the water',
      'shining in the night',
      'a candle in the window',
      'burning warm and bright',
    ];
    for (const intro of ['G C D Em', '| E | C#m |', '[G]', '[G] [C] [D]']) {
      const draft = draftOpenLyric([intro, '', ...verse].join('\n'));
      expectValid(draft);
      expect(draft.markdown, intro).toContain('- Title: Untitled');
      expect(draft.markdown, intro).not.toContain(`- Title: ${intro}`);
    }
    // A title under the chords is still found.
    const titled = draftOpenLyric(
      ['G C D Em', '', 'Lantern Song', '', ...verse].join('\n'),
    );
    expectValid(titled);
    expect(titled.markdown).toContain('- Title: Lantern Song');
  });

  test('an Ending whose words carry a bar and a chord is kept as free text under its label', () => {
    const draft = draftOpenLyric(
      [
        '[Verse 1]',
        'a lantern on the water',
        '',
        'Ending',
        'sing | G | along',
        'la la la',
      ].join('\n'),
    );
    expectValid(draft);
    expect(draft.tier).toBe(1);
    expect(draft.markdown).not.toContain('ol:Outro');
    expect(draft.markdown).toContain(
      '```ol:Breakdown 1\n// Ending\nsing | G | along\nla la la\n```',
    );
  });
});

describe('a song read off a page', () => {
  test('the toolbar above the first chorded row is named in what was guessed', () => {
    const draft = draftOpenLyric(
      [
        '--- BEGIN WEBSITE TEXT ---',
        'Transpose',
        'Print',
        'Share',
        '',
        'G',
        'a lantern on the water',
        'and nobody to row it home',
        '',
        'D',
        'carried by the river',
        'and home before the light',
        '',
        'Em',
        'singing in the morning',
        'and singing in the night',
        '--- END WEBSITE TEXT ---',
      ].join('\n'),
    );
    expectValid(draft);
    expect(draft.guessed).toContain(
      "left out above the song, as the page's own buttons rather than " +
        'words to sing: "Transpose", "Print", "Share"',
    );
    expect(draft.markdown).not.toContain('Transpose');
    expect(draft.markdown).toContain('[G]a lantern on the water');
  });

  test('a header address that cannot be parsed does not take the draft down', () => {
    const draft = draftOpenLyric(
      [
        'Read https://exa%mple.com/song',
        '--- BEGIN WEBSITE TEXT ---',
        'a lantern on the water',
        'shining in the night',
        '--- END WEBSITE TEXT ---',
      ].join('\n'),
    );
    expectValid(draft);
    expect(draft.outcome).toBe('drafted');
    expect(draft.markdown).toContain(
      '- Attachments: https://exa%mple.com/song',
    );
  });
});

describe('the free-text tier', () => {
  test('a paste of chords alone is kept whole as free text, and says so', () => {
    const draft = draftOpenLyric(['G D Em C', 'Am F C G'].join('\n'));
    expectValid(draft);
    expect(draft).toMatchObject({ ok: true, outcome: 'drafted', tier: 2 });
    expect(draft.markdown).toBe(
      [
        '# Untitled',
        '',
        '```ol:Config',
        '- Title: Untitled',
        '- Structure: D1',
        '```',
        '',
        '```ol:Breakdown 1',
        'G D Em C',
        'Am F C G',
        '```',
        '',
      ].join('\n'),
    );
    expect(draft.guessed.at(-1)).toBe(
      'the sections could not be worked out, so every block was kept as ' +
        'free text with its own label above it -- the words are all ' +
        'there, and the section names may want setting by hand',
    );
    expect(draft.report.ok).toBe(true);
  });

  test('a block with nothing left once its comment marks are gone is skipped', () => {
    const draft = draftOpenLyric(
      ['//', '//', '', 'G D Em C', 'Am F C G'].join('\n'),
    );
    expect(draft.tier).toBe(2);
    expect(draft.markdown).toContain(
      '- Structure: D1\n```\n\n```ol:Breakdown 1\nG D Em C\nAm F C G\n```\n',
    );
    expect(draft.markdown).not.toContain('Breakdown 2');
  });

  test('with nothing left at all it is refused, not drafted empty', () => {
    expect(draftOpenLyric(['//', '//'].join('\n'))).toEqual({
      ok: false,
      markdown: null,
      outcome: 'not-a-song',
      tier: null,
      guessed: [],
      report: null,
    });
  });
});
