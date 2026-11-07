// The corners of finding a Bible's book names that `bibleBookNames.test.mjs`
// leaves out: a file name that cannot be decoded, a locale nothing can read,
// a bundled list that is not a whole Bible, and an edition page with only
// part of one. No network: `readPage` is a table.

import { describe, expect, test } from 'vitest';

import {
  BIBLE_BOOK_KEYS,
  findBibleBookNames,
  getBibleNumberChoices,
  guessBibleLocale,
} from './bibleBookNames.mjs';

const ASCII_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

describe('the language a file name says', () => {
  test('a name with a broken escape is no guess rather than an error', () => {
    expect(guessBibleLocale('Khmer%E0Bible.xml')).toBeNull();
  });

  test('a code with its region in the name is read as it is written', () => {
    expect(guessBibleLocale('https://x.example/files/en_US.xml?raw=1')).toBe(
      'en-US',
    );
  });

  // `kjv.xml` read as the language "kjv", which no region is known for, and
  // answered `kjv-undefined` -- a string, so it won over the Settings
  // import's `?? DEFAULT_LOCALE` and was stored as the Bible's locale
  // (2026-11-03).
  test('a code no region is known for is no guess, never "undefined"', () => {
    expect(guessBibleLocale('kjv.xml')).toBeNull();
    expect(guessBibleLocale('esv.xml')).toBeNull();
    expect(guessBibleLocale('web.xml')).toBeNull();
    // Codes with a known region still read as before.
    expect(guessBibleLocale('km.xml')).toBe('km-KH');
    expect(guessBibleLocale('khm.xml')).toBe('km-KH');
  });
});

describe('the digits a language writes', () => {
  test('a locale nothing can read still gets the ASCII digits', () => {
    expect(getBibleNumberChoices('!!')).toEqual([ASCII_DIGITS]);
  });
});

describe('book names found for a language', () => {
  test('a bundled list that is not 66 names is left out, and a part-list edition is named', async () => {
    const pages = {
      'https://www.bible.com/languages/khm': {
        bibleCatalog: {
          versions: [
            { label: 'Short one', url: 'https://www.bible.com/versions/7' },
          ],
        },
      },
      // Two books of sixty-six: not a list anybody can import.
      'https://www.bible.com/versions/7': {
        bibleCatalog: {
          books: [
            { key: 'GEN', name: 'First' },
            { key: 'EXO', name: 'Second' },
          ],
        },
      },
    };
    const readList = [];
    const result = await findBibleBookNames('km-KH', {
      bundled: [
        { keys: ['short'], books: ['only one'] },
        { keys: ['blank'], books: BIBLE_BOOK_KEYS.map(() => ' ') },
      ],
      readPage: async (url) => {
        readList.push(url);
        if (!(url in pages)) {
          throw new Error('not served');
        }
        return pages[url];
      },
    });
    expect(result.bookNames).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(result.warnings).toEqual([
      'No complete 66-book list at https://www.bible.com/versions/7',
      'Could not read https://www.wordproject.org/bibles/km/index.htm',
      'No complete 66-book list at https://www.wordproject.org/bibles/km/index.htm',
    ]);
    // Read one after the other, the catalog first: one hidden browser.
    expect(readList).toEqual([
      'https://www.bible.com/languages/khm',
      'https://www.bible.com/versions/7',
      'https://www.wordproject.org/bibles/km/index.htm',
    ]);
    expect(result.moreAvailable).toBe(false);
    expect(result.nextOffset).toBe(1);
  });
});
