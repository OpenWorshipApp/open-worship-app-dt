// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import languageNameMap from '../../src/lang/data/en/language-names.json' with { type: 'json' };
import { readPackageWorldParts } from '../../extra-work/language-packages.mjs';
import {
  BIBLE_BOOK_KEYS,
  extractBibleCatalog,
  findBibleBookNames,
  getBibleNumberChoices,
  guessBibleLocale,
  normalizeBibleLocale,
  toCompleteBibleBookList,
} from './bibleBookNames.mjs';
import { configureWorldLanguageParts } from './worldLanguages.mjs';

describe('Bible import mapping choices', () => {
  test('normalizes aliases and guesses filenames without pretending unknown names are English', () => {
    expect(normalizeBibleLocale('English').locale).toBe('en');
    // The catalog's code for English is English's own data (`en/world.json`).
    expect(normalizeBibleLocale('eng')).toEqual({
      locale: 'en',
      language: 'en',
      catalogCode: 'eng',
    });
    // A language that gives the catalog no code is asked for by its own.
    expect(normalizeBibleLocale('xx').catalogCode).toBe('xx');
    expect(normalizeBibleLocale('xx_YY').locale).toBe('xx-YY');
    expect(guessBibleLocale('https://github.com/a/EnglishKJBible.xml')).toBe(
      'en-US',
    );
    // English's longest name first: Malayalam is not Malay.
    expect(guessBibleLocale('MalayalamBible.xml')).toBe('ml-IN');
    expect(guessBibleLocale('MalayBible.xml')).toBe('ms-MY');
    expect(guessBibleLocale('en.xml')).toBe('en-US');
    expect(guessBibleLocale('eng.xml')).toBe('en-US');
    expect(guessBibleLocale('xx_YY.xml')).toBe('xx-YY');
    expect(guessBibleLocale('Bible.xml')).toBeNull();
    expect(() => normalizeBibleLocale('../private')).toThrow();
  });
  // Every language alike, through English's own table of names: each name
  // the table gives a language (`Spanish, Castilian` is two) reads as it.
  test('every language by every English name English gives it', () => {
    const wrongList = [];
    for (const [code, names] of Object.entries(languageNameMap)) {
      for (const part of String(names).split(/[,;]/)) {
        const name = part.split('(')[0].trim();
        if (name === '') {
          continue;
        }
        const { language } = normalizeBibleLocale(name);
        if (language !== new Intl.Locale(code).language) {
          wrongList.push([name, code, language]);
        }
      }
    }
    expect(wrongList).toEqual([]);
    expect(Object.keys(languageNameMap).length).toBeGreaterThan(100);
  });
  // A catalog code is the language's own data: each package that gives one
  // is read by it, and asks the catalog by it, once installed -- and with
  // none installed the code is no language at all.
  test("each installed language's catalog code reads as it and asks the catalog by it", () => {
    const partList = readPackageWorldParts();
    try {
      configureWorldLanguageParts(() => partList);
      for (const part of partList) {
        for (const [code, catalogCode] of Object.entries(
          part?.catalogLanguageCodes ?? {},
        )) {
          expect([catalogCode, normalizeBibleLocale(catalogCode)]).toEqual([
            catalogCode,
            { locale: code, language: code, catalogCode },
          ]);
          expect(normalizeBibleLocale(code).catalogCode).toBe(catalogCode);
        }
      }
      // A made-up language installed with a code of its own.
      configureWorldLanguageParts(() => [
        { catalogLanguageCodes: { xx: 'xxx' } },
      ]);
      expect(normalizeBibleLocale('xxx')).toEqual({
        locale: 'xx',
        language: 'xx',
        catalogCode: 'xxx',
      });
      expect(normalizeBibleLocale('xx-YY').catalogCode).toBe('xxx');
    } finally {
      configureWorldLanguageParts(null);
    }
    expect(normalizeBibleLocale('xx-YY').catalogCode).toBe('xx');
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
  test('returns array choices and matching provenance, keeping built-ins on network failure', async () => {
    const books = BIBLE_BOOK_KEYS.map((key) => `local ${key}`);
    const readPage = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await findBibleBookNames('xx-XX', {
      readPage,
      bundled: [{ keys: ['XX'], books }],
    });
    expect(result.bookNames).toEqual([books]);
    expect(result.sources[0].label).toBe('XX');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(readPage).toHaveBeenCalledTimes(2);
  });
  test('reads stable book identifiers on other public sites without treating chapter numbers as names', () => {
    const saved = globalThis.location;
    vi.stubGlobal('location', new URL('https://example.org/books'));
    try {
      document.body.innerHTML =
        BIBLE_BOOK_KEYS.map(
          (key) =>
            `<a href="https://example.org/bible/${key}.1.html">Name ${key}</a>`,
        ).join('') +
        '<a href="https://example.org/bible/GEN.2.html">2</a>' +
        '<a href="https://elsewhere.example/GEN.1.html">Wrong source</a>';
      expect(toCompleteBibleBookList(extractBibleCatalog().books)).toEqual(
        BIBLE_BOOK_KEYS.map((key) => `Name ${key}`),
      );
    } finally {
      vi.stubGlobal('location', saved);
    }
  });
  test('refuses injected edition URLs and deduplicates complete lists without losing sources', async () => {
    const books = BIBLE_BOOK_KEYS.map((key) => ({ key, name: `local ${key}` }));
    const readPage = vi.fn(async (url) =>
      url.includes('/languages/')
        ? {
            bibleCatalog: {
              versions: [
                { label: 'unsafe', url: 'http://127.0.0.1' },
                { label: 'XX', url: 'https://www.bible.com/versions/85' },
              ],
            },
          }
        : { bibleCatalog: { books } },
    );
    const result = await findBibleBookNames('xx', { readPage });
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
    const result = await findBibleBookNames('xx', { readPage, offset: 3 });
    expect(result.nextOffset).toBe(4);
    expect(result.moreAvailable).toBe(true);
    expect(
      readPage.mock.calls.some(([url]) => url.includes('wordproject')),
    ).toBe(false);
    const offline = await findBibleBookNames('xx', {
      offset: 4,
      readPage: async () => {
        throw new Error('offline');
      },
    });
    expect(offline.nextOffset).toBe(4);
    expect(offline.moreAvailable).toBe(true);
  });
});
