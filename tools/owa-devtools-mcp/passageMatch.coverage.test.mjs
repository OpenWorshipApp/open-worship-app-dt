// What `passageMatch.test.mjs` leaves out: a cut that would land inside a
// button's name, and the two ways a long page is clipped around a match that
// does not fit. Quoting a page's TRANSLATION at the passage the English page
// answered with is in each package's tests.
//
// Every page here is made of nonsense words: what is under test is where a
// cut lands, so the words only have to be countable.

import { describe, expect, test } from 'vitest';

import { clipPageToPassages, genPassageExcerpt } from './passageMatch.mjs';

describe('a cut never lands inside a button name', () => {
  test('the quote stops before a template it would break, bold and all', () => {
    // 460 characters of words, then a bold button name that runs past the
    // 480-character limit.
    const words = 'word '.repeat(92);
    const excerpt = genPassageExcerpt(
      `${words}**[en:tran:Clear Long Text]** and more words after it.`,
    );
    expect(excerpt).toBe(`${words.trimEnd()} …`);
    expect(excerpt).not.toContain('[en:tran:');
    expect(excerpt).not.toContain('*');
  });
});

/** A one-line passage: `head`, then the word `filler` `count` times. */
function genPassage(head, filler, count) {
  return `${head} ${`${filler} `.repeat(count)}`.trim();
}

describe('a long page clipped to its matching passages', () => {
  test('a match already in the opening is not taken twice, and the last match is cut to the room left', () => {
    const opening = genPassage('Opening alpha', 'intro', 14);
    const filler = genPassage('filler', 'filler', 127);
    const best = genPassage('Alpha beta', 'core', 118);
    const last = genPassage('Alpha', 'word', 79);
    expect([opening, filler, best, last].map((one) => one.length)).toEqual([
      97, 895, 600, 400,
    ]);
    const clipped = clipPageToPassages(
      [opening, filler, best, last].join('\n\n'),
      [['alpha'], ['beta']],
      [],
      1000,
      200,
    );
    // The room left for the last match is 1000 - (98 + 603) - 3 = 296
    // characters, and it holds no sentence end to stop at.
    expect(clipped).toEqual({
      text: [opening, '…', `${best}\n${last.slice(0, 296).trimEnd()} …`].join(
        '\n',
      ),
      isHead: false,
      isEndCut: true,
    });
  });

  test('a match too long for all the room waits, and has what the shorter ones leave', () => {
    const opening = genPassage('Opening', 'intro', 15);
    const huge = genPassage('alpha beta', 'long', 298);
    const middle = genPassage('alpha beta', 'mid', 122);
    const small = genPassage('alpha beta', 'small', 48);
    const tiny = genPassage('alpha beta', 'tiny', 18);
    expect(
      [opening, huge, middle, small, tiny].map((one) => one.length),
    ).toEqual([97, 1500, 498, 298, 100]);
    const clipped = clipPageToPassages(
      [opening, huge, middle, small, tiny].join('\n\n'),
      [['alpha'], ['beta']],
      [],
      1000,
      200,
    );
    // Half the 899 characters of match room (449) is held for the huge
    // passage. The middle one is longer than what is left, so it is passed
    // over rather than cut; the small one fits; after it fewer than 200
    // characters are free, so the tiny one is never reached; and the huge
    // one gets 1000 - (98 + 301) - 3 = 598 characters of its own.
    expect(clipped).toEqual({
      text: [opening, `${huge.slice(0, 598).trimEnd()} …`, '…', small].join(
        '\n',
      ),
      isHead: false,
      isEndCut: true,
    });
    expect(clipped.text).not.toContain(' mid ');
    expect(clipped.text).not.toContain(' tiny ');
  });
});
