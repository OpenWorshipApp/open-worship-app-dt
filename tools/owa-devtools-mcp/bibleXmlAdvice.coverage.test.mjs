// The corners of reading a Bible link that `bibleXmlAdvice.test.mjs` leaves
// out: an address that is not one, a share link that already downloads, a
// file name with a broken escape in it, and a word that names no language.
//
// Plain node, no network -- the module has no I/O at all.

import { describe, expect, test } from 'vitest';

import {
  extractBibleXmlLinks,
  genBibleKeyChoices,
  readBibleXmlTitle,
  toBibleXmlDownloadUrl,
  toCatalogLanguageWord,
  toGithubListingUrl,
} from './bibleXmlAdvice.mjs';

describe('an address that cannot be fixed is handed back as it came', () => {
  test('words that are no address keep their text and get no note', () => {
    expect(toBibleXmlDownloadUrl('  my bible file please. ')).toEqual({
      url: 'my bible file please',
      note: null,
    });
  });

  test('a Dropbox link that already downloads is left alone, unremarked', () => {
    expect(
      toBibleXmlDownloadUrl('https://www.dropbox.com/s/abc/KJV.xml?dl=1'),
    ).toEqual({
      url: 'https://www.dropbox.com/s/abc/KJV.xml?dl=1',
      note: null,
    });
  });

  test('only a real owner/repository on GitHub is listed through the API', () => {
    // An owner and nothing else, a name GitHub would never mint, and a
    // `tree` with no branch after it.
    expect(toGithubListingUrl('https://github.com/onlyowner')).toBeNull();
    expect(toGithubListingUrl('https://github.com/a%20b/repo')).toBeNull();
    expect(toGithubListingUrl('https://github.com/a/b/tree')).toBeNull();
    expect(toGithubListingUrl('not an address')).toBeNull();
  });
});

describe('links read off a page', () => {
  test('a file name with a broken escape keeps its link, with no name', () => {
    // `%E0` alone is half a character: decoding it throws, and one bad
    // link must not take every other link on the page with it.
    expect(
      extractBibleXmlLinks(
        '<a href="https://a.example/Xxlang%E0Bible.xml">x</a>' +
          '<a href="https://a.example/ThaiBible.xml">y</a>',
        'https://a.example/',
      ),
    ).toEqual([
      { name: '', url: 'https://a.example/Xxlang%E0Bible.xml' },
      { name: 'ThaiBible.xml', url: 'https://a.example/ThaiBible.xml' },
    ]);
  });

  test('a relative link with no page address to resolve it against is skipped', () => {
    expect(
      extractBibleXmlLinks('<a href="/x/XxlangBible.xml">x</a>', 'not a url'),
    ).toEqual([]);
  });

  test('a short-name stem is not built from a name that cannot be decoded', () => {
    expect(genBibleKeyChoices({ sourceName: 'Xxlang%E0Bible.xml' })).toEqual(
      [],
    );
    // The same name without the broken escape does give one.
    expect(genBibleKeyChoices({ sourceName: 'XxlangBible.xml' })).toEqual([
      'XXLANG',
    ]);
  });
});

// A language typed in its own words (a language with no package of its own)
// is in `src/lang/data/tests/tools/owa-devtools-mcp/bibleXmlAdvice.test.ts`.
describe('a language typed in words that are not plain letters', () => {
  test('a word with a sign in it that names no language is no guess', () => {
    expect(toCatalogLanguageWord('✝xyz')).toBeNull();
  });
});

describe("a Bible's own title off its first bytes", () => {
  test('a root tag with no usable title is null, not an empty title', () => {
    expect(readBibleXmlTitle('<bible>')).toBeNull();
    expect(readBibleXmlTitle('<bible translation="   ">')).toBeNull();
    expect(readBibleXmlTitle('<?xml version="1.0"?><root/>')).toBeNull();
    expect(readBibleXmlTitle(undefined)).toBeNull();
  });

  test('an empty translation falls through to the title, entities read', () => {
    expect(
      readBibleXmlTitle('<bible translation="" title="Old &amp; New">'),
    ).toBe('Old & New');
  });
});

// Which language the verses are in, told by their script, is in
// `src/lang/data/tests/tools/owa-devtools-mcp/bibleXmlAdvice.test.ts`.
