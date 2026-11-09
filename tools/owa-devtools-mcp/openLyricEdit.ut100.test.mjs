// `openLyricEdit.mjs`, the branches its sibling suite leaves dark: every
// refusal a caller's words can earn (with the sentence a model reads back),
// Config edits on a song shaped otherwise than `Still` (a comment in Config,
// no Structure line, a Locales line, a field with continuation lines), the
// mixed parts a transpose reads token by token, and the notes `read` adds.
//
// Node only: the module is pure, and every output that is written is checked
// against this package's own validator (the open-lyric oracle is the sibling
// suite's job).

import { describe, expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';
import {
  applyLyricEdit,
  describeLyricDocument,
  parseLyricDocument,
  serializeLyricDocument,
  toCanonicalPart,
  transposeChord,
} from './openLyricEdit.mjs';

// A valid song with the shapes `Still` lacks: a comment inside Config, a
// Locales line, a mixed Intro (a cue, a bar line of chords, a sung line), a
// verse that opens with a comment and has a blank line and a translation in
// it, an Instrumental with a comment, and a Breakdown the play order skips.
const GRACE = [
  '```ol:Config',
  '- Title: Grace',
  '// kept for the band',
  '- Artist: Someone',
  '- Key: G',
  '- Locales: en-US',
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
  'Amazing [G]grace',
  '',
  'How [C]sweet the sound',
  '\tTranslation one',
  '```',
  '',
  '```ol:Chorus',
  'Sing it',
  '```',
  '',
  '```ol:Instrumental',
  '// four bars',
  '| G | C |',
  '```',
  '',
  '```ol:Breakdown',
  'Clap along',
  '```',
  '',
].join('\n');

// No Structure line (a problem the validator already names: every song
// needs one) and a blank line closing Config; no chords anywhere but in its
// Instrumental.
const PLAIN = [
  '```ol:Config',
  '- Title: Plain',
  '',
  '```',
  '',
  '```ol:Verse 1',
  'Only words here',
  '```',
  '',
  '```ol:Instrumental',
  '| G | D |',
  '```',
  '',
].join('\n');

function toMessages(content) {
  return validateOpenLyric(content).problems.map((one) => one.message);
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

function configOf(content) {
  return bodyOf(content, 'Config');
}

describe('the fixtures', () => {
  test('GRACE is a song the validator accepts; PLAIN lacks only its Structure', () => {
    expect(toMessages(GRACE)).toEqual([]);
    expect(toMessages(PLAIN)).toEqual([
      'Missing required config fields: Structure.',
    ]);
  });
});

describe('reading', () => {
  test('a fence left open at the end is kept, and written back as it was', () => {
    const text = '```ol:Config\n- Title: A\n```\n\n```ol:Verse 1\nHello';
    const doc = parseLyricDocument(text);
    const last = doc.segments.at(-1);
    expect(last).toMatchObject({
      kind: 'fence',
      partName: 'Verse 1',
      body: ['Hello'],
      closeLine: null,
    });
    expect(serializeLyricDocument(doc)).toBe(text);
  });

  test('a part name with no words, or a lone number, names nothing', () => {
    expect(toCanonicalPart('')).toBeNull();
    expect(toCanonicalPart('2')).toBeNull();
    expect(toCanonicalPart('Verse 0')).toBeNull();
  });

  test('read names what each kind of part holds, and lists a progression line by line', () => {
    const described = describeLyricDocument(GRACE);
    const byPart = Object.fromEntries(
      described.parts.map((one) => [one.part, one]),
    );
    expect(byPart.Instrumental).toEqual({
      part: 'Instrumental',
      // The comment is not a line of the progression.
      lines: ['| G | C |'],
      holds: 'chords and bars only',
    });
    expect(byPart.Breakdown).toEqual({
      part: 'Breakdown',
      lines: ['Clap along'],
      holds: 'free text',
    });
    expect(byPart.Intro.holds).toBe('words');
    expect(byPart['Verse 1']).toEqual({
      part: 'Verse 1',
      lines: ['Amazing [G]grace', 'How [C]sweet the sound'],
      translations: [null, 'Translation one'],
    });
    expect(described.locales).toBe('en-US');
    expect(described.playOrderNote).toBeUndefined();
    expect(described.note).toBeUndefined();
  });

  test('a song with no Structure line plays nothing yet, and says nothing is broken', () => {
    const described = describeLyricDocument(PLAIN);
    expect(described.structure).toBeNull();
    expect(described.playOrder).toEqual([]);
    expect(described.playOrderNote).toBeUndefined();
  });

  test('a Structure naming a part the song lacks reads as a partial order', () => {
    const broken = GRACE.replace('IV1CIS', 'IV1CV9');
    const described = describeLyricDocument(broken);
    expect(described.playOrder).toEqual(['Intro', 'Verse 1', 'Chorus']);
    expect(described.playOrderNote).toBe(
      'The Structure line could not be read whole; set-order rewrites it.',
    );
  });

  test('a song with no Config is described with the way to fix it', () => {
    const described = describeLyricDocument('```ol:Verse 1\nHello\n```\n');
    expect(described.title).toBeNull();
    expect(described.parts.map((one) => one.part)).toEqual(['Verse 1']);
    expect(described.note).toBe(
      'This song has no ol:Config block; it can only be fixed in the ' +
        'Lyric Editor.',
    );
  });
});

describe('naming a part', () => {
  test('"Chorus 1" finds the only chorus, written without a number', () => {
    const result = edit(GRACE, {
      action: 'set-lines',
      part: 'Chorus 1',
      lines: ['Sing it loud'],
    });
    expect(bodyOf(result.content, 'Chorus')).toEqual(['Sing it loud']);
    expect(result.changes).toEqual(['new words for Chorus']);
  });

  test('"Verse" finds the only verse when it is numbered 1', () => {
    const result = edit(GRACE, {
      action: 'add-translation',
      part: 'Verse',
      lines: ['Uno', ''],
    });
    expect(result.changes).toEqual([
      'a translation under each line of Verse 1',
    ]);
  });

  test('a word that is no part at all is refused with the parts the song has', () => {
    for (const action of [
      'set-lines',
      'add-translation',
      'set-chords',
      'remove-section',
    ]) {
      expect(refusal(GRACE, { action, part: 'Wibble', lines: ['x'] })).toBe(
        'There is no part called "Wibble". The song has: Intro, Verse 1, ' +
          'Chorus, Instrumental, Breakdown.',
      );
    }
  });
});

describe('the lines a caller gives', () => {
  test('set-lines refuses lines that are not a list of text', () => {
    expect(
      refusal(GRACE, { action: 'set-lines', part: 'Chorus', lines: 'Sing' }),
    ).toBe('Give the lines of Chorus as a list of text lines.');
    expect(
      refusal(GRACE, { action: 'set-lines', part: 'Chorus', lines: [3] }),
    ).toBe('Every line of Chorus must be text.');
  });

  test('set-lines refuses a line or a part longer than one may hold', () => {
    expect(
      refusal(GRACE, {
        action: 'set-lines',
        part: 'Chorus',
        lines: ['a'.repeat(401)],
      }),
    ).toBe(
      'A line of Chorus is 401 characters; 400 is the most one line may hold.',
    );
    expect(
      refusal(GRACE, {
        action: 'set-lines',
        part: 'Chorus',
        lines: Array.from({ length: 121 }, (_, index) => `line ${index}`),
      }),
    ).toBe('Chorus would have 121 lines; 120 is the most one part may hold.');
  });

  test('set-lines drops the blank lines at either end and keeps a leading comment', () => {
    const result = edit(GRACE, {
      action: 'set-lines',
      part: 'Verse 1',
      lines: ['', 'Grace that [G]taught', '', 'my heart to fear', ''],
    });
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      '// soft',
      'Grace that [G]taught',
      '',
      'my heart to fear',
    ]);
    // The translation under the old words is said to be gone.
    expect(result.warnings).toEqual([
      'Verse 1: its translation lines went with the old words.',
    ]);
  });

  test('set-lines with no words left is refused, pointing at remove-section', () => {
    expect(
      refusal(GRACE, { action: 'set-lines', part: 'Chorus', lines: ['', ''] }),
    ).toBe(
      'Give the new lines of Chorus. To take a part out of the song, use ' +
        'remove-section.',
    );
  });

  test('add-translation refuses lines that are not one text line each', () => {
    const ask = (lines) => {
      return refusal(GRACE, {
        action: 'add-translation',
        part: 'Chorus',
        lines,
      });
    };
    expect(ask('Uno')).toBe(
      'Give the lines of Chorus as a list of text lines.',
    );
    expect(ask([null])).toBe('Every line of Chorus must be text.');
    expect(ask(['```'])).toBe(
      'A line may not be a fence (```) or an ol: header -- give the words ' +
        'only; the song notation is written by the app.',
    );
    expect(ask(['b'.repeat(401)])).toBe(
      'A line of Chorus is 401 characters; 400 is the most one line may hold.',
    );
  });

  test('a call naming no part, too many parts, or a part that is not an object is refused', () => {
    for (const action of ['set-lines', 'add-translation', 'set-chords']) {
      expect(refusal(GRACE, { action })).toBe(
        'Name the parts to change: `sections` as [{part, lines}], or `part` ' +
          'with `lines`.',
      );
      expect(refusal(GRACE, { action, sections: [] })).toMatch(
        /^Name the parts to change/,
      );
      expect(
        refusal(GRACE, {
          action,
          sections: Array.from({ length: 41 }, () => ({
            part: 'Chorus',
            lines: ['x'],
          })),
        }),
      ).toBe('40 parts at most in one change.');
      expect(refusal(GRACE, { action, sections: [null] })).toBe(
        'Each section is {part, lines}.',
      );
      expect(refusal(GRACE, { action, sections: ['Chorus'] })).toBe(
        'Each section is {part, lines}.',
      );
    }
  });
});

describe('translations and locales', () => {
  test('add-translation keeps the comment and the blank line between sung lines', () => {
    const result = edit(GRACE, {
      action: 'add-translation',
      part: 'Verse 1',
      lines: ['Uno', 'Dos'],
    });
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      '// soft',
      'Amazing [G]grace',
      '\tUno',
      '',
      'How [C]sweet the sound',
      // The old translation is replaced, not stacked.
      '\tDos',
    ]);
  });

  test('add-translation refuses a config that is not an object, and writes nothing', () => {
    expect(
      refusal(GRACE, {
        action: 'add-translation',
        part: 'Chorus',
        lines: ['Canta'],
        config: 'Gracia',
      }),
    ).toBe('Give `config` as an object, e.g. {"Title": "…"}.');
    expect(
      refusal(GRACE, {
        action: 'set-lines',
        part: 'Chorus',
        lines: ['Canta'],
        config: ['Title', 'Gracia'],
      }),
    ).toBe('Give `config` as an object, e.g. {"Title": "…"}.');
  });

  test('an empty locales list takes the Locales line out', () => {
    for (const locales of [[], '', ' , ']) {
      const result = edit(GRACE, {
        action: 'set-lines',
        part: 'Chorus',
        lines: ['Sing it'],
        locales,
      });
      expect(result.changes).toEqual([
        'new words for Chorus',
        'took out Locales',
      ]);
      expect(configOf(result.content)).not.toContain('- Locales: en-US');
      expect(describeLyricDocument(result.content).locales).toBeNull();
    }
    // A song with no Locales line has nothing to take out.
    const none = edit(PLAIN, {
      action: 'set-lines',
      part: 'Verse 1',
      lines: ['Only words here'],
      locales: [],
    });
    expect(none.isChanged).toBe(false);
    expect(none.changes).toEqual(['new words for Verse 1']);
  });

  test('set-config sets Locales by its tags, and refuses one Open Lyric does not know', () => {
    const result = edit(GRACE, {
      action: 'set-config',
      config: { locales: 'en_US, es-es, en-US' },
    });
    expect(result.changes).toEqual(['Locales: en-US, es-ES']);
    expect(describeLyricDocument(result.content).locales).toBe('en-US, es-ES');
    expect(
      refusal(GRACE, { action: 'set-config', config: { Locales: 'klingon' } }),
    ).toBe(
      '"klingon" is not a locale tag Open Lyric knows. Write a language and ' +
        'region, e.g. en-US or es-ES.',
    );
    // `Locales: null` is no locales.
    expect(
      edit(GRACE, { action: 'set-config', config: { Locales: null } }).changes,
    ).toEqual(['took out Locales']);
  });
});

describe('chords', () => {
  test('set-chords refuses a part named wrong, a part of free text, and lines that do not fit', () => {
    expect(
      refusal(GRACE, {
        action: 'set-chords',
        part: 'Instrumental',
        lines: '| G | C |',
      }),
    ).toBe('Give the lines of Instrumental as a list of text lines.');
    expect(
      refusal(GRACE, {
        action: 'set-chords',
        part: 'Breakdown',
        lines: ['[G]Clap along'],
      }),
    ).toBe(
      'Breakdown holds free text; chords go into sung parts and ' +
        'Instrumental or Interlude parts.',
    );
    expect(
      refusal(GRACE, { action: 'set-chords', part: 'Chorus', lines: 'x' }),
    ).toBe('Give the lines of Chorus as a list of text lines.');
    expect(
      refusal(GRACE, {
        action: 'set-chords',
        part: 'Verse 1',
        lines: ['[G]Amazing grace'],
      }),
    ).toBe(
      'Verse 1 has 2 sung lines and 1 were given. Give every sung line, in ' +
        'order, with [chords] in it.',
    );
  });

  test('add-translation refuses a part of free text', () => {
    expect(
      refusal(GRACE, {
        action: 'add-translation',
        part: 'Breakdown',
        lines: ['Aplaude'],
      }),
    ).toBe(
      'Breakdown holds free text, which takes no translation line. ' +
        'Translate the sung parts only.',
    );
  });

  test('a chord that is no chord is left as it was', () => {
    expect(transposeChord('x', 2, 'D')).toBe('x');
    expect(transposeChord('', 2, 'D')).toBe('');
  });

  test('transpose reads a mixed part line by line and leaves comments and cues alone', () => {
    const result = edit(GRACE, { action: 'transpose', key: 'A' });
    expect(bodyOf(result.content, 'Intro')).toEqual([
      '{c: soft start}',
      'A | D | E |',
      'Welcome [A]all',
    ]);
    expect(bodyOf(result.content, 'Verse 1')).toEqual([
      '// soft',
      'Amazing [A]grace',
      '',
      'How [D]sweet the sound',
      '\tTranslation one',
    ]);
    expect(bodyOf(result.content, 'Instrumental')).toEqual([
      '// four bars',
      '| A | D |',
    ]);
    // Intro 4, Verse 1 2, Instrumental 2.
    expect(result.changes).toEqual(['moved 8 chords from G to A']);
    expect(describeLyricDocument(result.content).key).toBe('A');
  });

  test('transpose leaves a bracket that holds no chord, and says the song had a problem before', () => {
    const marked = GRACE.replace('Sing it', 'Sing [G]it [softly]');
    expect(validateOpenLyric(marked).problems).toHaveLength(1);
    const result = applyLyricEdit(marked, { action: 'transpose', key: 'A' });
    expect(result.isError).toBeUndefined();
    expect(bodyOf(result.content, 'Chorus')).toEqual(['Sing [A]it [softly]']);
    expect(result.changes).toEqual(['moved 9 chords from G to A']);
    expect(result.warnings).toEqual([
      'The song already had 1 problem before this change; they are as ' +
        'they were.',
    ]);
  });

  test('transpose refuses a key Open Lyric has no name for', () => {
    expect(refusal(GRACE, { action: 'transpose', key: 'H' })).toMatch(
      /^Give the new key as one of: C /,
    );
    expect(refusal(GRACE, { action: 'transpose' })).toMatch(
      /^Give the new key as one of:/,
    );
  });
});

describe('adding and removing parts', () => {
  test('add-section refuses a number on a part there is only one of', () => {
    expect(
      refusal(GRACE, { action: 'add-section', part: 'Intro 2', lines: ['x'] }),
    ).toBe('Intro cannot be numbered; there is only ever one.');
  });

  test('add-section refuses lines that are not a list, or no lines for a sung part', () => {
    expect(
      refusal(GRACE, { action: 'add-section', part: 'Verse', lines: 'Two' }),
    ).toBe('Give the lines of Verse 2 as a list of text lines.');
    expect(refusal(GRACE, { action: 'add-section', part: 'Verse' })).toBe(
      'Give the lines of the new Verse 2.',
    );
  });

  test('add-section after a part the song lacks, or one it never plays, is refused', () => {
    expect(
      refusal(GRACE, {
        action: 'add-section',
        part: 'Bridge',
        lines: ['Over'],
        after: 'Wibble',
      }),
    ).toMatch(/^There is no part called "Wibble"\./);
    expect(
      refusal(GRACE, {
        action: 'add-section',
        part: 'Bridge',
        lines: ['Over'],
        after: 'Breakdown',
      }),
    ).toBe(
      'Breakdown is not in the play order, so nothing can be placed after ' +
        'it. Leave `after` out to add it at the end, then set-order to place it.',
    );
  });

  test('a broken Structure stops a part being added to or taken out of the play order', () => {
    const broken = GRACE.replace('IV1CIS', 'IV1CV9');
    const reason =
      "The song's Structure line could not be read, so the play order was " +
      'not changed. Write the whole play order with set-order first.';
    expect(
      refusal(broken, { action: 'add-section', part: 'Bridge', lines: ['x'] }),
    ).toBe(reason);
    expect(refusal(broken, { action: 'remove-section', part: 'Chorus' })).toBe(
      reason,
    );
  });

  test('a song with no Structure gets one when a part is added', () => {
    const result = edit(PLAIN, {
      action: 'add-section',
      part: 'Chorus',
      lines: ['Sing'],
    });
    expect(result.changes).toEqual(['added Chorus, played at the end']);
    expect(describeLyricDocument(result.content).structure).toBe('C');
    expect(toMessages(result.content)).toEqual([]);
    // Before the blank line that closed Config.
    expect(configOf(result.content)).toEqual([
      '- Title: Plain',
      '- Structure: C',
      '',
    ]);
  });
});

describe('the play order', () => {
  test('set-order refuses an empty or overlong order, an unknown part and a repeat out of range', () => {
    expect(refusal(GRACE, { action: 'set-order', order: [] })).toBe(
      'Give the play order as a list of part names, e.g. ["Verse 1", ' +
        '"Chorus", "Verse 2", "Chorus x2"].',
    );
    expect(refusal(GRACE, { action: 'set-order' })).toMatch(
      /^Give the play order/,
    );
    expect(
      refusal(GRACE, {
        action: 'set-order',
        order: Array.from({ length: 61 }, () => 'Chorus'),
      }),
    ).toBe('60 entries at most in a play order.');
    expect(
      refusal(GRACE, { action: 'set-order', order: ['Verse 1', 'Coda'] }),
    ).toMatch(/^There is no part called "Coda"\./);
    expect(refusal(GRACE, { action: 'set-order', order: ['Chorus x21'] })).toBe(
      'A part plays 1 to 20 times in a row.',
    );
    expect(refusal(GRACE, { action: 'set-order', order: ['Chorus x0'] })).toBe(
      'A part plays 1 to 20 times in a row.',
    );
    // Twenty is still a song.
    expect(
      edit(GRACE, { action: 'set-order', order: ['Verse 1', 'Chorus x20'] })
        .changes,
    ).toEqual(['play order: Verse 1 → Chorus x20']);
  });
});

describe('Config', () => {
  test('set-config refuses a config that is not an object, or that sets nothing', () => {
    const reason =
      'Give `config` as an object of the fields to set, e.g. {"Key": "G", ' +
      '"Tempo": "72bpm"}.';
    expect(refusal(GRACE, { action: 'set-config' })).toBe(reason);
    expect(refusal(GRACE, { action: 'set-config', config: null })).toBe(reason);
    expect(refusal(GRACE, { action: 'set-config', config: 'Key G' })).toBe(
      reason,
    );
    expect(refusal(GRACE, { action: 'set-config', config: ['G'] })).toBe(
      reason,
    );
    expect(refusal(GRACE, { action: 'set-config', config: {} })).toBe(
      'Give at least one field to set.',
    );
  });

  test('a new field goes before Structure, past the comment Config holds', () => {
    const result = edit(GRACE, {
      action: 'set-config',
      config: { Tempo: '72', Time: '3/4', Copyright: 'Public `domain`' },
    });
    expect(result.changes).toEqual([
      'Tempo: 72bpm',
      'Time: 3/4',
      "Copyright: Public 'domain'",
    ]);
    expect(configOf(result.content)).toEqual([
      '- Title: Grace',
      '// kept for the band',
      '- Artist: Someone',
      '- Key: G',
      '- Locales: en-US',
      '- Tempo: 72bpm',
      '- Time: 3/4',
      "- Copyright: Public 'domain'",
      '- Structure: IV1CIS',
    ]);
  });

  test('a commented-out field in Config is not the field', () => {
    const commented = GRACE.replace(
      '// kept for the band',
      '// - Subtitle: Old',
    );
    const result = edit(commented, {
      action: 'set-config',
      config: { Subtitle: 'New' },
    });
    expect(result.changes).toEqual(['Subtitle: New']);
    expect(configOf(result.content)).toContain('// - Subtitle: Old');
    expect(describeLyricDocument(result.content).subtitle).toBe('New');
  });

  test('a new field in a Config with no Structure goes above its closing blank line', () => {
    const result = edit(PLAIN, {
      action: 'set-config',
      config: { Artist: 'Anon' },
    });
    expect(configOf(result.content)).toEqual([
      '- Title: Plain',
      '- Artist: Anon',
      '',
    ]);
  });

  test('an empty value takes the field out; a Title is never taken out', () => {
    const result = edit(GRACE, {
      action: 'set-config',
      config: { Artist: '' },
    });
    expect(result.changes).toEqual(['took out Artist']);
    expect(describeLyricDocument(result.content).artist).toBeNull();
    // A field the song does not have is nothing to take out.
    const same = edit(GRACE, {
      action: 'set-config',
      config: { Subtitle: '  ' },
    });
    expect(same.isChanged).toBe(false);
    expect(same.changes).toEqual([]);
    expect(
      refusal(GRACE, { action: 'set-config', config: { title: '' } }),
    ).toBe('A song needs a Title; give the new one.');
  });

  test('a field taken out takes the lines continuing it, and a problem it had goes with it', () => {
    const continued = GRACE.replace(
      '- Artist: Someone',
      '- Artist: Someone\n  and friends',
    );
    expect(validateOpenLyric(continued).problems).toHaveLength(1);
    const result = applyLyricEdit(continued, {
      action: 'set-config',
      config: { Artist: '' },
    });
    expect(result.isError).toBeUndefined();
    expect(configOf(result.content)).toEqual([
      '- Title: Grace',
      '// kept for the band',
      '- Key: G',
      '- Locales: en-US',
      '- Structure: IV1CIS',
    ]);
    expect(validateOpenLyric(result.content).problems).toEqual([]);
    expect(result.warnings).toEqual([
      'The song already had 1 problem before this change; they are as ' +
        'they were.',
    ]);
  });

  test('a value too long, a Time or Tempo Open Lyric cannot read, is refused', () => {
    expect(
      refusal(GRACE, {
        action: 'set-config',
        config: { Subtitle: 's'.repeat(201) },
      }),
    ).toBe('Subtitle is too long; 200 characters at most.');
    expect(
      refusal(GRACE, { action: 'set-config', config: { Time: '5/9' } }),
    ).toMatch(/^Time must be one of: .*4\/4/);
    expect(
      refusal(GRACE, { action: 'set-config', config: { Tempo: 'fast' } }),
    ).toBe('Tempo is beats a minute, written like 72bpm.');
    expect(
      refusal(GRACE, { action: 'set-config', config: { Tempo: '0' } }),
    ).toBe('Tempo is beats a minute, written like 72bpm.');
    expect(
      refusal(GRACE, { action: 'set-config', config: { Key: 'H' } }),
    ).toMatch(/^Key must be one of: C /);
  });

  test('a new Key on a song with chords says the chords stayed where they were', () => {
    const warning =
      'Only the Key line changed; every chord is where it was. To move the ' +
      'chords to the new key too, use transpose.';
    const result = edit(GRACE, { action: 'set-config', config: { Key: 'd' } });
    expect(result.changes).toEqual(['Key: D']);
    expect(result.warnings).toEqual([warning]);
    // A song whose only chords are an Instrumental's bars has chords too.
    const played = PLAIN.replace(
      '- Title: Plain',
      ['- Title: Plain', '- Structure: V1IS'].join('\n'),
    );
    expect(toMessages(played)).toEqual([]);
    const plain = edit(played, { action: 'set-config', config: { Key: 'G' } });
    expect(plain.changes).toEqual(['Key: G']);
    expect(plain.warnings).toEqual([warning]);
    // An Instrumental holding only a comment holds no chords.
    const bare = played.replace('| G | D |', '// tbd');
    expect(
      edit(bare, { action: 'set-config', config: { Key: 'G' } }).warnings,
    ).toEqual([]);
  });
});
