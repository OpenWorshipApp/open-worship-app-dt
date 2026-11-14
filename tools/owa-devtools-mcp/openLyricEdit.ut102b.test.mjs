// `openLyricEdit.mjs` where the runtime has no `Intl.Segmenter`: words are
// then runs of letters, marks and digits (`listWords`' fallback). The module
// reads the breaker once, when it loads, so it is loaded here with the
// breaker taken away, and the breaker put back before any test runs.
//
// Node only: the module is pure.

import { afterAll, describe, expect, test } from 'vitest';

import { validateOpenLyric } from './openLyric.mjs';

const savedSegmenter = Intl.Segmenter;
Intl.Segmenter = undefined;
let applyLyricEdit;
try {
  ({ applyLyricEdit } = await import('./openLyricEdit.mjs'));
} finally {
  Intl.Segmenter = savedSegmenter;
}

afterAll(() => {
  Intl.Segmenter = savedSegmenter;
});

const SONG = [
  '```ol:Config',
  '- Title: Grace',
  '- Key: G',
  '- Structure: V1C',
  '```',
  '',
  '```ol:Verse 1',
  '[G]Amazing grace how [C]sweet the sound',
  'That saved a [D]wretch like me',
  '```',
  '',
  '```ol:Chorus',
  'No more disgrace, I am [G]free',
  '```',
  '',
].join('\n');

function edit(request) {
  const result = applyLyricEdit(SONG, request);
  if (result.isError) {
    throw new Error(result.reason);
  }
  expect(validateOpenLyric(result.content).problems).toEqual([]);
  return result;
}

function linesOf(content, partName) {
  const lines = content.split('\n');
  const start = lines.indexOf(`\`\`\`ol:${partName}`);
  return lines.slice(start + 1, lines.indexOf('```', start + 1));
}

describe('with no word breaker in the runtime', () => {
  test('the module loaded without one, and the runtime has it back', () => {
    expect(typeof Intl.Segmenter).toBe('function');
    expect(typeof applyLyricEdit).toBe('function');
  });

  test('replace still changes whole words only', () => {
    const result = edit({
      action: 'replace',
      replacements: [{ find: 'grace', with: 'mercy' }],
    });
    expect(linesOf(result.content, 'Verse 1')[0]).toBe(
      '[G]Amazing mercy how [C]sweet the sound',
    );
    // "grace" inside "disgrace" is no word of its own.
    expect(linesOf(result.content, 'Chorus')).toEqual([
      'No more disgrace, I am [G]free',
    ]);
    expect(result.changes).toEqual(['"grace" -> "mercy" 1 time (Verse 1)']);
  });

  test('a find only inside a longer word is refused, naming that word', () => {
    const result = applyLyricEdit(SONG, {
      action: 'replace',
      replacements: [{ find: 'race', with: 'run' }],
    });
    expect(result.isError).toBe(true);
    expect(result.reason).toContain('"race" is not a word sung in the song');
    expect(result.reason).toContain('(only inside "grace", "disgrace"');
  });

  // The one place the two ways of finding words part: a footnote mark
  // after a word is a digit, so here it is inside that word's run of
  // letters, and a find inside the word is refused. (With the breaker the
  // mark is drawn apart and the find is taken -- reported as a bug.)
  test('a word with a footnote mark after it is still one word', () => {
    const mark = String.fromCharCode(0xb9);
    const song = SONG.replace(
      'That saved a [D]wretch like me',
      `That saved a [D]wretch like grace${mark}`,
    );
    expect(validateOpenLyric(song).problems).toEqual([]);
    const result = applyLyricEdit(song, {
      action: 'replace',
      part: 'Verse 1',
      replacements: [{ find: 'race', with: 'run' }],
    });
    expect(result.isError).toBe(true);
    expect(result.reason).toContain(`(only inside "grace", "grace${mark}"`);
  });

  test('set-lines carries a line kept by half its words with its chords', () => {
    const result = edit({
      action: 'set-lines',
      part: 'Verse 1',
      lines: ['Amazing grace how kind the sound', 'That saved a soul like me'],
    });
    expect(linesOf(result.content, 'Verse 1')).toEqual([
      '[G]Amazing grace how [C]kind the sound',
      'That saved a [D]soul like me',
    ]);
  });
});
