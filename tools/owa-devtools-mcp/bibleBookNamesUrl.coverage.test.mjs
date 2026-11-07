// The corners of reading book names off an address the person gave that
// `bibleBookNamesUrl.test.mjs` leaves out: a bible.com page that is not an
// edition, and the same list found on two of the editions a page names.

import { describe, expect, test } from 'vitest';

import { BIBLE_BOOK_KEYS } from './bibleBookNames.mjs';
import {
  findBibleBookNamesFromUrl,
  toBibleBookIndexUrl,
} from './bibleBookNamesUrl.mjs';

describe('the index address a link is read through', () => {
  test('a bible.com page with no edition in it is read on www, without its fragment', () => {
    expect(toBibleBookIndexUrl('https://bible.com/languages/khm#top')).toBe(
      'https://www.bible.com/languages/khm',
    );
  });
});

describe('book names off the editions a page names', () => {
  test('the same list on two editions is one choice, not two', async () => {
    const names = BIBLE_BOOK_KEYS.map((key) => `Book ${key}`);
    const edition = (title) => ({
      title,
      bibleCatalog: {
        books: BIBLE_BOOK_KEYS.map((key) => ({ key, name: `Book ${key}` })),
      },
    });
    const pages = {
      'https://www.bible.com/languages/eng': {
        title: 'English Bibles',
        bibleCatalog: {
          versions: [
            { url: 'https://www.bible.com/versions/1' },
            { url: 'https://www.bible.com/versions/2' },
          ],
        },
      },
      'https://www.bible.com/versions/1': edition('First edition'),
      'https://www.bible.com/versions/2': edition('Second edition'),
    };
    const readList = [];
    const result = await findBibleBookNamesFromUrl(
      'https://bible.com/languages/eng',
      'en-US',
      {
        readPage: async (url) => {
          readList.push(url);
          return pages[url];
        },
      },
    );
    // Both editions were read; only the first one's list is offered.
    expect(readList).toEqual([
      'https://www.bible.com/languages/eng',
      'https://www.bible.com/versions/1',
      'https://www.bible.com/versions/2',
    ]);
    expect(result.bookNames).toEqual([names]);
    expect(result.sources).toEqual([
      {
        label: 'First edition',
        url: 'https://www.bible.com/versions/1',
        requestedUrl: 'https://bible.com/languages/eng',
        references: [],
      },
    ]);
    expect(result.problem).toBeUndefined();
  });
});
