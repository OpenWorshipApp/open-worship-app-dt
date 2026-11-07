// `tools/owa-devtools-mcp/bibleBookNamesUrl.test.mjs`, every case of it Khmer: kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { describe, expect, test, vi } from 'vitest';
import { readPackageWorldParts } from '../../../../../../../../extra-work/language-packages.mjs';
import { BIBLE_BOOK_KEYS } from '../../../../../../../../tools/owa-devtools-mcp/bibleBookNames.mjs';
import { configureWorldLanguageParts } from '../../../../../../../../tools/owa-devtools-mcp/worldLanguages.mjs';
import {
  findBibleBookNamesFromUrl,
  toBibleBookIndexUrl,
} from '../../../../../../../../tools/owa-devtools-mcp/bibleBookNamesUrl.mjs';

// Which script a language is written in is ITS data, there when it is
// installed (`worldLanguages.mjs`): every package of the checkout is here.
configureWorldLanguageParts(readPackageWorldParts);

const link =
  'https://www.bible.com/bible/4783/JHN.1.%E1%9E%96%E1%9E%82%E1%9E%94';
const books = BIBLE_BOOK_KEYS.map((key) => ({ key, name: `គម្ពីរ ${key}` }));
const page = { title: 'Khmer 1954', bibleCatalog: { books, language: 'khm' } };

describe('book names from the source the person supplied', () => {
  test.each([
    [link, 'https://www.bible.com/versions/4783'],
    [
      'https://bible.com/km/bible/4783/JHN.1',
      'https://www.bible.com/versions/4783',
    ],
    [
      'https://www.bible.com/versions/4783-khmer',
      'https://www.bible.com/versions/4783',
    ],
    [
      'https://www.wordproject.org/bibles/km/43/1.htm#0',
      'https://www.wordproject.org/bibles/km/index.htm',
    ],
    ['https://example.org/books/index#old', 'https://example.org/books/index'],
    [
      'https://bible.com.evil.example/bible/4783/JHN.1',
      'https://bible.com.evil.example/bible/4783/JHN.1',
    ],
  ])('resolves only a recognized index: %s', (url, expected) => {
    expect(toBibleBookIndexUrl(url)).toBe(expected);
  });
  test.each([
    'https://127.1/books',
    'file:///tmp/book',
    'https://localtest.local/',
    'https://user:pass@www.bible.com/versions/4783',
    'https://example.org/' + 'x'.repeat(600),
    'not a url',
  ])('refuses %s before a read', async (url) => {
    const readPage = vi.fn();
    await expect(
      findBibleBookNamesFromUrl(url, 'km', { readPage }),
    ).rejects.toThrow();
    expect(readPage).not.toHaveBeenCalled();
  });
  test('the reported Khmer chapter reads its edition once and preserves both links', async () => {
    const readPage = vi.fn().mockResolvedValue(page);
    const result = await findBibleBookNamesFromUrl(link, 'km-KH', { readPage });
    expect(readPage).toHaveBeenCalledExactlyOnceWith(
      'https://www.bible.com/versions/4783',
    );
    expect(result.bookNames[0]).toEqual(books.map((book) => book.name));
    expect(result.locale).toBe('km-KH');
    expect(result.sources[0]).toMatchObject({
      requestedUrl: link,
      url: 'https://www.bible.com/versions/4783',
    });
    expect(result.problem).toBeUndefined();
  });
  test('never fills missing names or merges fragments from different editions', async () => {
    const readPage = vi
      .fn()
      .mockResolvedValueOnce({
        bibleCatalog: {
          books: books.slice(0, 39),
          versions: [
            { url: 'https://www.bible.com/versions/85' },
            { url: 'https://127.0.0.1/private' },
            { url: 'https://elsewhere.example/versions/1' },
          ],
        },
      })
      .mockResolvedValueOnce({ bibleCatalog: { books: books.slice(39) } });
    const result = await findBibleBookNamesFromUrl(link, 'km', { readPage });
    expect(result).toMatchObject({
      problem: 'names-incomplete',
      bookNames: [],
      foundBooks: 39,
    });
    expect(result.missingBooks).toHaveLength(27);
    expect(readPage).toHaveBeenCalledTimes(2);
  });
  test.each([
    { books: books.map((book) => ({ ...book, name: `Spanish ${book.key}` })) },
    { books, language: 'spa' },
  ])('does not label a different language as Khmer', async (bibleCatalog) => {
    const result = await findBibleBookNamesFromUrl(link, 'km', {
      readPage: async () => ({ bibleCatalog }),
    });
    expect(result).toMatchObject({
      problem: 'names-language',
      locale: 'km',
      bookNames: [],
    });
  });
  test.each([
    [[...books, { key: 'GEN', name: 'Different Genesis' }]],
    [books.map((book) => ({ ...book, name: 'គម្ពីរ Next' }))],
  ])(
    'refuses ambiguous names and repeated navigation labels',
    async (found) => {
      const result = await findBibleBookNamesFromUrl(link, 'km', {
        readPage: async () => ({ bibleCatalog: { books: found } }),
      });
      expect(result).toMatchObject({
        problem: 'names-incomplete',
        bookNames: [],
      });
    },
  );
  test('is bounded, deduplicates editions and reads sequentially', async () => {
    let active = 0;
    const readPage = vi.fn(async () => {
      expect(++active).toBe(1);
      await Promise.resolve();
      active--;
      return {
        bibleCatalog: {
          versions: Array.from({ length: 20 }, (_, i) => ({
            url: `https://www.bible.com/versions/${i}`,
          })),
        },
      };
    });
    const result = await findBibleBookNamesFromUrl(link, 'km', { readPage });
    expect(readPage).toHaveBeenCalledTimes(4);
    expect(result.bookNames).toEqual([]);
  });
  test('offline is an honest empty result, never a different source', async () => {
    const readPage = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await findBibleBookNamesFromUrl(link, 'km', { readPage });
    expect(result).toMatchObject({
      problem: 'names-incomplete',
      bookNames: [],
    });
    expect(result.warnings).toHaveLength(1);
    expect(readPage).toHaveBeenCalledTimes(1);
  });
});
