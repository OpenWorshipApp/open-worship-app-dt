// `openLyricEdit.mjs`, the branches its sibling suites leave dark: chords
// carried onto a changed word at a line's start or end and two chords that
// would land on one letter (`set-lines`), a line of chords alone (`set-lines`
// and `set-chords`), words taken out and punctuation inside a find
// (`replace`), every refusal a replacement list can earn, a chord changed
// across parts that hold no words, and the refusals of `remove-translations`,
// `remove-chords` and `rename-section`.
//
// Node only: the module is pure, and every output written is checked against
// this package's own validator (the open-lyric oracle is the sibling suites').

import { describe, expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';
import { applyLyricEdit, parseLyricDocument } from './openLyricEdit.mjs';

function toMessages(content) {
  return validateOpenLyric(content).problems.map((one) => {
    return one.message;
  });
}

// The change is made, and adds no problem to the ones the song had.
function edit(content, request) {
  const result = applyLyricEdit(content, request);
  if (result.isError) {
    throw new Error(result.reason);
  }
  const before = toMessages(content);
  for (const message of toMessages(result.content)) {
    expect(before).toContain(message);
  }
  return result;
}

function refusal(content, request) {
  const result = applyLyricEdit(content, request);
  expect(result.isError).toBe(true);
  return result.reason;
}

function bodyOf(content, partName) {
  const fence = parseLyricDocument(content).segments.find((one) => {
    return one.kind === 'fence' && one.partName === partName;
  });
  return fence?.body;
}

function genSong(verseLines, structure = 'V1C') {
  return [
    '```ol:Config',
    '- Title: Grace',
    '- Key: G',
    `- Structure: ${structure}`,
    '```',
    '',
    '```ol:Verse 1',
    ...verseLines,
    '```',
    '',
    '```ol:Chorus',
    'Sing it [D]now',
    '```',
    '',
  ].join('\n');
}

// A song with every kind of part a replacement walks past: a mixed Intro (a
// cue, a bar line of chords, a sung line), a verse with a comment, a blank
// line, a translation and a line of chords alone, an Instrumental and a
// free-text Breakdown the play order leaves out.
const WIDE = [
  '```ol:Config',
  '- Title: Grace',
  '- Key: G',
  '- Structure: IV1CIS',
  '```',
  '',
  '```ol:Intro',
  '{c: soft start}',
  'G | C | D |',
  'Welcome [G]all',
  '```',
  '',
  '```ol:Verse 1',
  '// soft',
  '[G]Amazing grace how sweet the [C]sound',
  '\tWonderful kindness',
  'How swe[C]et the sound',
  '',
  'How sweet[C], the sound',
  'Was blind but now I [G]see',
  '[G] [C]',
  '```',
  '',
  '```ol:Chorus',
  'Sing it [D]now to all',
  '```',
  '',
  '```ol:Instrumental',
  '// four bars',
  '| G | C |',
  '```',
  '',
  '```ol:Breakdown',
  'Clap along [G] all',
  '',
  '```',
  '',
].join('\n');

describe('the fixtures', () => {
  test('both songs are songs the validator accepts', () => {
    expect(toMessages(WIDE)).toEqual([]);
    expect(toMessages(genSong(['Amazing [G]grace', '[G] [C]']))).toEqual([]);
  });
});

describe('set-lines carries the chords of a changed word', () => {
  const SONG = genSong([
    '[G]Amazing grace how sweet the sound',
    'Amazing grace how sweet the [C]sound',
    'Amazing grace how sweet the s[G]ou[C]nd',
  ]);

  test('onto the word now at the start, the end, and past two chords on one letter', () => {
    const result = edit(SONG, {
      action: 'set-lines',
      part: 'Verse 1',
      lines: [
        // The first two words changed: the chord on the first stays first.
        'Awesome mercy how sweet the sound',
        // The last word changed: its chord on the word now in its place.
        'Amazing grace how sweet the noise',
        // Two chords inside one word that became one letter: never two on
        // one letter, so the second goes on to the end of the line.
        'Amazing grace how sweet the x',
      ],
    });
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      '[G]Awesome mercy how sweet the sound',
      'Amazing grace how sweet the [C]noise',
      'Amazing grace how sweet the [G]x[C]',
    ]);
    expect(result.changes).toEqual([
      'new words for Verse 1 (kept the chords of 3 lines)',
    ]);
    expect(result.warnings).toEqual([]);
  });
});

describe('a line of chords alone', () => {
  const SONG = genSong(['Amazing [G]grace how sweet the sound', '[G] [C]']);

  test('given back by set-lines beside a changed line stays as given', () => {
    // Only the words written are asserted here: the warning this call
    // carries is reported as a bug (it says the chords of the chord line
    // were lost, while the line is written back with them).
    const result = edit(SONG, {
      action: 'set-lines',
      part: 'Verse 1',
      lines: ['Amazing grace how sweet the noise', '[G] [C]'],
    });
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      'Amazing [G]grace how sweet the noise',
      '[G] [C]',
    ]);
  });

  test('given new chords by set-chords takes them in their places', () => {
    const result = edit(SONG, {
      action: 'set-chords',
      part: 'Verse 1',
      lines: ['Amazing [G]grace how sweet the sound', '[D] [C]'],
    });
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      'Amazing [G]grace how sweet the sound',
      '[D] [C]',
    ]);
    expect(result.changes).toEqual(['the chords of Verse 1']);
  });

  test('stays through remove-chords, and the warning says so', () => {
    const result = edit(SONG, { action: 'remove-chords', part: 'Verse 1' });
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      'Amazing grace how sweet the sound',
      '[G] [C]',
    ]);
    expect(result.changes).toEqual(['took out 1 chord (Verse 1)']);
    expect(result.warnings).toEqual([
      '1 line of chords alone stayed -- give the part again with ' +
        'set-lines if they should go.',
    ]);
  });
});

describe('replace', () => {
  test('a word taken out takes one space with it, its chord kept where it stood', () => {
    const result = edit(WIDE, {
      action: 'replace',
      replacements: [
        { find: 'sweet', with: '' },
        { find: 'see', with: '' },
      ],
    });
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      '// soft',
      '[G]Amazing grace how the [C]sound',
      '\tWonderful kindness',
      // The chord inside the word taken out: where the word was.
      'How [C]the sound',
      '',
      'How[C], the sound',
      // The last word taken out: the space before it goes, the chord stays.
      'Was blind but now I[G]',
      '[G] [C]',
    ]);
    expect(result.changes).toEqual([
      '"sweet" -> "" 3 times (Verse 1)',
      '"see" -> "" 1 time (Verse 1)',
    ]);
  });

  test('a find with its punctuation: a chord before the mark goes after the words put there', () => {
    const result = edit(WIDE, {
      action: 'replace',
      replacements: [{ find: 'sweet,', with: 'kind,' }],
    });
    expect(bodyOf(result.content, 'Verse 1')).toContain(
      'How kind,[C] the sound',
    );
    expect(result.changes).toEqual(['"sweet," -> "kind," 1 time (Verse 1)']);
  });

  test("passes over a bar line of chords, an Instrumental's chords and free text", () => {
    const result = edit(WIDE, {
      action: 'replace',
      replacements: [{ find: 'all', with: 'everyone' }],
    });
    expect(bodyOf(result.content, 'Intro')).toEqual([
      '{c: soft start}',
      'G | C | D |',
      'Welcome [G]everyone',
    ]);
    expect(bodyOf(result.content, 'Chorus')).toEqual([
      'Sing it [D]now to everyone',
    ]);
    // A Breakdown holds free text: no replacement reaches it.
    expect(bodyOf(result.content, 'Breakdown')).toEqual([
      'Clap along [G] all',
      '',
    ]);
    expect(result.changes).toEqual([
      '"all" -> "everyone" 2 times (Intro, Chorus)',
    ]);
  });

  test('a chord changed everywhere it is played, never in free text or a comment', () => {
    const result = edit(WIDE, {
      action: 'replace',
      replacements: [{ find: '[G]', with: '[Gmaj7]' }],
    });
    expect(bodyOf(result.content, 'Intro')).toEqual([
      '{c: soft start}',
      'Gmaj7 | C | D |',
      'Welcome [Gmaj7]all',
    ]);
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      '// soft',
      '[Gmaj7]Amazing grace how sweet the [C]sound',
      '\tWonderful kindness',
      'How swe[C]et the sound',
      '',
      'How sweet[C], the sound',
      'Was blind but now I [Gmaj7]see',
      '[Gmaj7] [C]',
    ]);
    expect(bodyOf(result.content, 'Instrumental')).toEqual([
      '// four bars',
      '| Gmaj7 | C |',
    ]);
    expect(bodyOf(result.content, 'Breakdown')).toEqual([
      'Clap along [G] all',
      '',
    ]);
    expect(result.changes).toEqual([
      'chord G -> Gmaj7 6 times (Intro, Verse 1, Instrumental)',
    ]);
  });

  test('every refusal a replacement list can earn', () => {
    expect(refusal(WIDE, { action: 'replace', replacements: [null] })).toBe(
      'Replacement 1 must be {find, with}.',
    );
    expect(
      refusal(WIDE, {
        action: 'replace',
        replacements: [{ find: 'grace', with: 'mercy' }, 'grace'],
      }),
    ).toBe('Replacement 2 must be {find, with}.');
    expect(
      refusal(WIDE, {
        action: 'replace',
        replacements: [{ find: 'g'.repeat(201), with: 'mercy' }],
      }),
    ).toBe(
      'Replacement 1 is longer than 200 characters; change a whole line ' +
        'with set-lines.',
    );
    expect(
      refusal(WIDE, {
        action: 'replace',
        replacements: [{ find: 'grace', with: 'm'.repeat(201) }],
      }),
    ).toContain('longer than 200 characters');
    // A bracket that is no chord stays in the words, and is refused as one.
    expect(
      refusal(WIDE, {
        action: 'replace',
        replacements: [{ find: 'swe[note]et', with: 'kind' }],
      }),
    ).toBe(
      'Replacement 1 holds a chord bracket. replace changes words and ' +
        'keeps every chord where it stood; chords are set-chords and ' +
        "transpose's.",
    );
    const many = Array.from({ length: 41 }, () => {
      return { find: 'grace', with: 'mercy' };
    });
    expect(refusal(WIDE, { action: 'replace', replacements: many })).toBe(
      'At most 40 replacements go in one call.',
    );
    // Forty is still one call.
    const forty = edit(WIDE, {
      action: 'replace',
      replacements: many.slice(0, 40).map((one, index) => {
        return index === 0 ? one : { find: 'mercy', with: 'mercy' };
      }),
    });
    expect(bodyOf(forty.content, 'Verse 1')[1]).toBe(
      '[G]Amazing mercy how sweet the [C]sound',
    );
  });
});

describe('remove-translations refuses', () => {
  test('a part the song does not have', () => {
    expect(
      refusal(WIDE, { action: 'remove-translations', part: 'Verse 9' }),
    ).toBe(
      'There is no part called "Verse 9". The song has: Intro, Verse 1, ' +
        'Chorus, Instrumental, Breakdown.',
    );
  });

  test('a part that holds no words has none to take out', () => {
    expect(
      refusal(WIDE, { action: 'remove-translations', part: 'Instrumental' }),
    ).toBe('Instrumental has no translation lines to take out.');
  });

  test('a config that is not an object, after the lines were found', () => {
    expect(
      refusal(WIDE, { action: 'remove-translations', config: 'Title' }),
    ).toMatch(/^Give `config` as an object/);
  });
});

describe('remove-chords refuses', () => {
  test('a part the song does not have', () => {
    expect(refusal(WIDE, { action: 'remove-chords', part: 'Bridge' })).toBe(
      'There is no part called "Bridge". The song has: Intro, Verse 1, ' +
        'Chorus, Instrumental, Breakdown.',
    );
  });
});

describe('rename-section refuses', () => {
  test('a part the song does not have', () => {
    expect(
      refusal(WIDE, { action: 'rename-section', part: 'Verse 9', to: 'Tag' }),
    ).toMatch(/^There is no part called "Verse 9"\./);
  });

  test('a kind the song already has its one of', () => {
    expect(
      refusal(WIDE, { action: 'rename-section', part: 'Verse 1', to: 'Intro' }),
    ).toBe('The song already has its Intro, and there is only ever one.');
  });

  test('a number on a kind there is only ever one of', () => {
    expect(
      refusal(WIDE, {
        action: 'rename-section',
        part: 'Verse 1',
        to: 'Outro 2',
      }),
    ).toBe('Outro cannot be numbered; there is only ever one.');
  });

  test('a song whose Structure line cannot be read', () => {
    const broken = genSong(['Amazing [G]grace'], 'V1CQ9');
    // The song already had this problem; a rename would only hide it.
    expect(toMessages(broken)).toHaveLength(1);
    expect(
      refusal(broken, {
        action: 'rename-section',
        part: 'Chorus',
        to: 'Refrain',
      }),
    ).toBe(
      "The song's Structure line could not be read, so the play order was " +
        'not changed. Write the whole play order with set-order first.',
    );
  });
});
