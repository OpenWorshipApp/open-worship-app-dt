// The corners of reading a song off a page that `lyricPageText.test.mjs`
// leaves out.
//
// EVERY FIXTURE HERE IS MADE UP -- the lines, the names, the pages. What is
// under test is the SHAPE of a page, and nonsense has the same shape. A
// translation row under a line in another script is in each package's tests.

import { describe, expect, test } from 'vitest';

import {
  checkIsCreditLine,
  pickLyricRegion,
  pickNumberedStanzas,
  readLyricPage,
  rejoinChordSheet,
  writeInlineChords,
} from './lyricPageText.mjs';

describe('chords glued to the words', () => {
  test('a row that ends on its chord keeps the page’s trailing space after it', () => {
    expect(writeInlineChords('word |D ')).toBe('word |[D] ');
    expect(writeInlineChords('word |D')).toBe('word |[D]');
  });

  test('a chord behind an icon ligature is still a chord over the next words', () => {
    // `music_note` is an icon font's ligature drawn in front of the chord;
    // with it taken off, the line is a chord and nothing else.
    expect(rejoinChordSheet(['music_noteD', 'a lantern on the water'])).toEqual(
      [{ text: '[D]a lantern on the water', hadChord: true }],
    );
  });
});

describe('stanzas a page prints numbered', () => {
  test('with no label test given, an unnumbered block ends the run', () => {
    expect(
      pickNumberedStanzas([
        '1 a lantern on the water',
        '',
        '2 shining in the night',
        '',
        'Some footer text here',
        '',
        '3 not part of the hymn',
      ]),
    ).toEqual({
      from: 0,
      to: 2,
      lines: ['1 a lantern on the water', '', '2 shining in the night'],
      words: 2,
      chords: 0,
    });
  });

  test('a number out of order ends the run', () => {
    expect(
      pickNumberedStanzas([
        '1 a lantern on the water',
        '',
        '2 shining in the night',
        '',
        '4 carried by the river',
      ])?.to,
    ).toBe(2);
  });

  test('a labelled block straight after the last stanza belongs to it', () => {
    expect(
      pickNumberedStanzas(
        [
          '1 a lantern on the water',
          '',
          '2 shining in the night',
          '',
          'Refrain',
          'carry the light along',
          '',
          'Contact us today',
        ],
        (text) => text === 'Refrain',
      ),
    ).toEqual({
      from: 0,
      to: 5,
      lines: [
        '1 a lantern on the water',
        '',
        '2 shining in the night',
        '',
        'Refrain',
        'carry the light along',
      ],
      words: 3,
      chords: 0,
    });
  });
});

describe('which region is the song', () => {
  test('no regions is no song', () => {
    expect(pickLyricRegion([])).toBeNull();
  });
});

describe('a credit line', () => {
  test('nothing, or a whole paragraph, is never a credit', () => {
    expect(checkIsCreditLine('')).toBe(false);
    expect(checkIsCreditLine('words: '.repeat(20))).toBe(false);
  });

  test('a label that names the words or the music, past the first word, is one', () => {
    expect(checkIsCreditLine('Original words and music: Sok Dara')).toBe(true);
    expect(checkIsCreditLine('a lantern on the water')).toBe(false);
  });
});

describe('reading a whole page', () => {
  test('a start marker with an end marker that is not there runs to the end', () => {
    expect(
      readLyricPage(
        [
          'Tune: NOTHING AT ALL',
          'a lantern on the water',
          'shining in the night',
        ],
        { from: 'a lantern', to: 'not on the page' },
      ),
    ).toEqual({
      lines: ['a lantern on the water', 'shining in the night'],
      found: {},
      notes: { isPage: false, isMarked: true },
    });
  });

  test('an empty page has no region to give, and says so', () => {
    // Any line at all opens a region, so only an empty page reaches this.
    expect(readLyricPage([], { isFromPage: true })).toEqual({
      lines: [],
      found: {},
      notes: { isPage: true, isRegionFound: false },
    });
  });

  test('a credit under a blank line comes off, and the blank with it', () => {
    const read = readLyricPage(
      [
        'a lantern on the water',
        'shining all along the night',
        'carried by the river home',
        '',
        'Words: Sok Dara',
      ],
      { isFromPage: true },
    );
    expect(read.lines).toEqual([
      'a lantern on the water',
      'shining all along the night',
      'carried by the river home',
    ]);
    expect(read.notes.credits).toEqual(['Words: Sok Dara']);
    expect(read.found.Artist).toBe('Sok Dara');
    expect(read.notes.lastLine).toBe('carried by the river home');
  });
});
