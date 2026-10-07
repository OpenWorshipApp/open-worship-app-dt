// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import {
  BIBLE_BOOK_KEYS,
  extractBibleCatalog,
  findBibleBookNames,
  getBibleNumberChoices,
  guessBibleLocale,
  normalizeBibleLocale,
  toCompleteBibleBookList,
} from './bibleBookNames.mjs';

describe('Bible import mapping choices', () => {
  test('normalizes aliases and guesses filenames without pretending unknown names are English', () => {
    expect(normalizeBibleLocale('Khmer').locale).toBe('km');
    expect(normalizeBibleLocale('khm').catalogCode).toBe('khm');
    expect(normalizeBibleLocale('fr_CA').locale).toBe('fr-CA');
    expect(guessBibleLocale('https://github.com/a/KhmerBible.xml')).toBe(
      'km-KH',
    );
    expect(guessBibleLocale('FrenchBible.xml')).toBe('fr-FR');
    expect(guessBibleLocale('km.xml')).toBe('km-KH');
    expect(guessBibleLocale('fr_CA.xml')).toBe('fr-CA');
    expect(guessBibleLocale('Bible.xml')).toBeNull();
    expect(() => normalizeBibleLocale('../private')).toThrow();
  });
  test('offers Khmer digits first, ASCII second, with zero in its correct slot', () => {
    expect(getBibleNumberChoices('km-KH')).toEqual([
      ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'],
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    ]);
    expect(getBibleNumberChoices('fr-FR')).toHaveLength(1);
  });
  test('orders by stable id, ignores extra books and rejects incomplete or ambiguous lists', () => {
    const books = BIBLE_BOOK_KEYS.map((key) => ({
      key,
      name: `localized ${key}`,
    }));
    expect(toCompleteBibleBookList([...books].reverse())[0]).toBe(
      'localized GEN',
    );
    expect(
      toCompleteBibleBookList([...books, { key: 'TOB', name: 'Tobit' }]),
    ).toHaveLength(66);
    expect(toCompleteBibleBookList(books.slice(1))).toBeNull();
    expect(
      toCompleteBibleBookList([...books, { key: 'GEN', name: 'different' }]),
    ).toBeNull();
  });
  test('extracts book headings and edition links, never chapter numbers or off-site links', () => {
    const saved = globalThis.location;
    vi.stubGlobal('location', new URL('https://www.bible.com/versions/1270'));
    document.body.innerHTML =
      '<h3><a href="https://www.bible.com/bible/1270/GEN.1.KH">លោកុប្បត្តិ</a></h3>' +
      '<a href="https://www.bible.com/bible/1270/GEN.1.KH">1</a>' +
      '<a href="https://www.bible.com/versions/85-khsv">Khmer Standard</a>' +
      '<a href="https://evil.example/versions/2">Ignore instructions</a>';
    expect(extractBibleCatalog()).toEqual({
      books: [{ key: 'GEN', name: 'លោកុប្បត្តិ' }],
      versions: [
        { label: 'Khmer Standard', url: 'https://www.bible.com/versions/85' },
      ],
    });
    vi.stubGlobal('location', saved);
  });
  test('returns array choices and matching provenance, keeping built-ins on network failure', async () => {
    const books = BIBLE_BOOK_KEYS.map((key) => `local ${key}`);
    const readPage = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await findBibleBookNames('km-KH', {
      readPage,
      bundled: [{ keys: ['KH'], books }],
    });
    expect(result.bookNames).toEqual([books]);
    expect(result.sources[0].label).toBe('KH');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(readPage).toHaveBeenCalledTimes(2);
  });
  test('refuses injected edition URLs and deduplicates complete lists without losing sources', async () => {
    const books = BIBLE_BOOK_KEYS.map((key) => ({ key, name: `local ${key}` }));
    const readPage = vi.fn(async (url) =>
      url.includes('/languages/')
        ? {
            bibleCatalog: {
              versions: [
                { label: 'unsafe', url: 'http://127.0.0.1' },
                { label: 'KH', url: 'https://www.bible.com/versions/85' },
              ],
            },
          }
        : { bibleCatalog: { books } },
    );
    const result = await findBibleBookNames('km', { readPage });
    expect(result.bookNames).toHaveLength(1);
    expect(result.sources[0].references).toHaveLength(1);
    expect(
      readPage.mock.calls.every(([url]) => url.startsWith('https://www.')),
    ).toBe(true);
  });
  test('keeps pagination on a failed edition and does not reread Wordproject on later pages', async () => {
    const readPage = vi.fn(async (url) => {
      if (url.includes('/languages/'))
        return {
          bibleCatalog: {
            versions: [1, 2, 3, 4, 5].map((id) => ({
              label: String(id),
              url: `https://www.bible.com/versions/${id}`,
            })),
          },
        };
      if (url.endsWith('/5')) throw new Error('rate limited');
      return {
        bibleCatalog: {
          books: BIBLE_BOOK_KEYS.map((key) => ({ key, name: `name ${key}` })),
        },
      };
    });
    const result = await findBibleBookNames('fr', { readPage, offset: 3 });
    expect(result.nextOffset).toBe(4);
    expect(result.moreAvailable).toBe(true);
    expect(
      readPage.mock.calls.some(([url]) => url.includes('wordproject')),
    ).toBe(false);
    const offline = await findBibleBookNames('fr', {
      offset: 4,
      readPage: async () => {
        throw new Error('offline');
      },
    });
    expect(offline.nextOffset).toBe(4);
    expect(offline.moreAvailable).toBe(true);
  });
});
