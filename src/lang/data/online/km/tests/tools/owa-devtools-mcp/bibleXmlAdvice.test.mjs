// The Khmer cases of `tools/owa-devtools-mcp/bibleXmlAdvice.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { describe, expect, test } from 'vitest';
import {
  readLanguageAliases,
  checkIsBibleLanguageWord,
  checkIsLikelyHtml,
  checkIsLikelyXml,
  extractBibleXmlLinks,
  genBibleKeyChoices,
  guessBibleLocalesFromText,
  rankBibleXmlLinks,
  scoreNameLists,
  suggestBibleLanguages,
  toBibleSearchWords,
  toCatalogLanguageWord,
  toBibleNameListId,
  toBibleXmlDownloadUrl,
  toGithubListingUrl,
} from '../../../../../../../../tools/owa-devtools-mcp/bibleXmlAdvice.mjs';
import { readPackageWorldParts } from '../../../../../../../../extra-work/language-packages.mjs';
import { configureWorldLanguageParts } from '../../../../../../../../tools/owa-devtools-mcp/worldLanguages.mjs';

// What a language's own words are is ITS data, there when it is installed
// (`worldLanguages.mjs`): these cases are about languages, so every package
// of the checkout is installed for them.
configureWorldLanguageParts(readPackageWorldParts);

const REPO = 'https://github.com/Beblia/Holy-Bible-XML-Format';

describe('a language typed by name', () => {
  test('in its own words, with or without "language" in front', () => {
    // Electron's ICU has no Khmer display names: the table must answer.
    expect(toCatalogLanguageWord('ខ្មែរ')).toBe('khmer');
    expect(toCatalogLanguageWord('ភាសាខ្មែរ')).toBe('khmer');
    expect(toCatalogLanguageWord('Deutsch')).toBe('german');
    expect(toBibleSearchWords('install a ไทย bible')).toEqual(['thai']);
  });
  // Another language named in Khmer: what a Khmer reader types to install
  // it, or to ask for its Bible (2026-11-05; Electron's ICU has none).
  test('another language by its Khmer name', () => {
    expect(toCatalogLanguageWord('ភាសាអេស្ប៉ាញ')).toBe('spanish');
    expect(toCatalogLanguageWord('ចិន')).toBe('chinese');
    expect(toCatalogLanguageWord('ភាសាកូរ៉េ')).toBe('korean');
    expect(toCatalogLanguageWord('អង់គ្លេស')).toBe('english');
  });
  test('which words of a request name a language with Bibles', () => {
    expect(checkIsBibleLanguageWord('Khmer')).toBe(true);
    expect(checkIsBibleLanguageWord('ខ្មែរ')).toBe(true);
    expect(checkIsBibleLanguageWord('cambodia')).toBe(true);
    expect(checkIsBibleLanguageWord('verse')).toBe(false);
    expect(checkIsBibleLanguageWord('commentary')).toBe(false);
  });
});

describe('which language the verses are in', () => {
  test('a script that belongs to one language decides it', () => {
    expect(
      guessBibleLocalesFromText(
        'កាល​ពី​ដើម​ដំបូង​បង្អស់ ព្រះជាម្ចាស់​បាន​បង្កើត​ផ្ទៃ​មេឃ និង​ផែនដី​។',
      ),
    ).toEqual({ script: 'Khmer', locales: ['km-KH'] });
  });
});

describe('which list of book names this Bible uses', () => {
  test('counts the names the text uses, ignoring shared ones and numbers', () => {
    const text = 'ហោរា​អេសាយ ... ១ សាំយូអែល ... យ៉ូហាន';
    expect(
      scoreNameLists(text, [
        { names: ['អេសាយ', 'សាំយូអែល ទី ១', 'យ៉ូហាន'] },
        { names: ['អេសាយ', 'សាំយូអែល ទី ១', 'យ៉ូហានថ្មី'] },
      ]),
    ).toEqual([1, 0]);
  });
});
