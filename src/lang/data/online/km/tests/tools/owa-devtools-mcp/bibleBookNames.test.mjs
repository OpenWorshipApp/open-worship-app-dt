// @vitest-environment jsdom
// The Khmer cases of `tools/owa-devtools-mcp/bibleBookNames.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { describe, expect, test, vi } from 'vitest';
import {
  BIBLE_BOOK_KEYS,
  extractBibleCatalog,
  findBibleBookNames,
  getBibleNumberChoices,
  guessBibleLocale,
  normalizeBibleLocale,
  toCompleteBibleBookList,
} from '../../../../../../../../tools/owa-devtools-mcp/bibleBookNames.mjs';

describe('Bible import mapping choices', () => {
  test('offers Khmer digits first, ASCII second, with zero in its correct slot', () => {
    expect(getBibleNumberChoices('km-KH')).toEqual([
      ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'],
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    ]);
    expect(getBibleNumberChoices('fr-FR')).toHaveLength(1);
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
  test('reports the edition language from its language link, not the interface language', () => {
    const saved = globalThis.location;
    vi.stubGlobal('location', new URL('https://www.bible.com/versions/4783'));
    try {
      document.body.innerHTML =
        '<a href="https://www.bible.com/languages/khm">ភាសាខ្មែរ Bibles</a>';
      expect(extractBibleCatalog().language).toBe('khm');
    } finally {
      vi.stubGlobal('location', saved);
    }
  });
});
