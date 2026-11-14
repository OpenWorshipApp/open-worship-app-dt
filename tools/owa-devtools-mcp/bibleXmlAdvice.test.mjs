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
} from './bibleXmlAdvice.mjs';
import { readPackageWorldParts } from '../../extra-work/language-packages.mjs';
import { configureWorldLanguageParts } from './worldLanguages.mjs';

// What a language's own words are is ITS data, there when it is installed
// (`worldLanguages.mjs`): every package of the checkout is installed for
// these cases, and each holds whichever packages are there -- English's
// alone included. A case about one language is in that package's tests.
// `Xxlang` is a made-up language: a file name is matched by its words.
configureWorldLanguageParts(readPackageWorldParts);

const REPO = 'https://github.com/Beblia/Holy-Bible-XML-Format';

describe('the address a volunteer pasted', () => {
  test('a GitHub file PAGE becomes its download address, and says so', () => {
    expect(
      toBibleXmlDownloadUrl(`${REPO}/blob/master/XxlangBible.xml`),
    ).toEqual({
      url: 'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/XxlangBible.xml',
      note: 'I used the download address of the file instead of its GitHub page.',
    });
  });
  test('an address that already downloads is left alone', () => {
    const raw = `${REPO}/raw/refs/heads/master/XxlangBible.xml`;
    expect(toBibleXmlDownloadUrl(raw)).toEqual({ url: raw, note: null });
    expect(toBibleXmlDownloadUrl(`<${raw}>.`).url).toBe(raw);
  });
  test('Dropbox, Google Drive and GitLab share pages are turned into files', () => {
    expect(
      toBibleXmlDownloadUrl('https://www.dropbox.com/s/abc/KJV.xml?dl=0').url,
    ).toBe('https://www.dropbox.com/s/abc/KJV.xml?dl=1');
    expect(
      toBibleXmlDownloadUrl(
        'https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing',
      ).url,
    ).toBe('https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMn');
    expect(
      toBibleXmlDownloadUrl('https://gitlab.com/a/b/-/blob/main/kjv.xml').url,
    ).toBe('https://gitlab.com/a/b/-/raw/main/kjv.xml');
  });
  test('a repository or folder page is listed through the API, once encoded', () => {
    expect(toGithubListingUrl(REPO)).toBe(
      'https://api.github.com/repos/Beblia/Holy-Bible-XML-Format/contents/',
    );
    expect(toGithubListingUrl(`${REPO}/tree/master/sub dir`)).toBe(
      'https://api.github.com/repos/Beblia/Holy-Bible-XML-Format/contents/sub%20dir?ref=master',
    );
    expect(
      toGithubListingUrl(`${REPO}/blob/master/XxlangBible.xml`),
    ).toBeNull();
    expect(toGithubListingUrl('https://example.com/a/b')).toBeNull();
  });
});

describe('picking the Bible off a page of files', () => {
  const listing = JSON.stringify([
    {
      download_url:
        'https://raw.githubusercontent.com/Beblia/x/master/XxlangBible.xml',
    },
    {
      download_url:
        'https://raw.githubusercontent.com/Beblia/x/master/Xxlang2005Bible.xml',
    },
    {
      download_url:
        'https://raw.githubusercontent.com/Beblia/x/master/EnglishKJBible.xml',
    },
    {
      download_url:
        'https://raw.githubusercontent.com/Beblia/x/master/README.md',
    },
  ]);
  test('reads xml files off an API listing, an href and an embedded path', () => {
    const links = extractBibleXmlLinks(
      listing,
      'https://api.github.com/repos/Beblia/x/contents/',
    );
    expect(links.map((one) => one.name)).toEqual([
      'XxlangBible.xml',
      'Xxlang2005Bible.xml',
      'EnglishKJBible.xml',
    ]);
    expect(
      extractBibleXmlLinks(
        '<a href="/files/kjv.xml">KJV</a><a href="http://plain.example/a.xml">x</a>',
        'https://bibles.example/page',
      ),
    ).toEqual([
      { name: 'kjv.xml', url: 'https://bibles.example/files/kjv.xml' },
    ]);
    expect(extractBibleXmlLinks('{"path":"ThaiBible.xml"}', REPO)[0].url).toBe(
      'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/HEAD/ThaiBible.xml',
    );
  });
  test('the words of the request pick the file; request words do not count', () => {
    const links = extractBibleXmlLinks(listing, 'https://api.github.com/x');
    const ranked = rankBibleXmlLinks(
      links,
      'please import the Xxlang bible from github',
    );
    expect(ranked.words).toEqual(['xxlang']);
    expect(ranked.matched).toBe(2);
    expect(ranked.links[0].name).toBe('XxlangBible.xml');
    expect(rankBibleXmlLinks(links, 'Swahili').matched).toBe(0);
    // Every word, when a file has them all: one Bible, not two lists.
    expect(rankBibleXmlLinks(links, 'Xxlang 2005').links).toEqual([links[1]]);
    expect(rankBibleXmlLinks(links, 'Xxlang 1611').matched).toBe(2);
    expect(rankBibleXmlLinks(links, '').matched).toBe(3);
  });
  test('a year no file of that language has only narrows, it never widens', () => {
    const links = [
      'XxlangBible.xml',
      'Xxlang2016Bible.xml',
      'Polish2016Bible.xml',
      'Chewa2016Bible.xml',
    ].map((name) => ({ name, url: `https://x.example/${name}` }));
    // No Xxlang Bible of 1999: the Xxlang ones, said as what they matched on.
    const ranked = rankBibleXmlLinks(links, 'Xxlang 1999');
    expect(ranked.links.map((one) => one.name)).toEqual([
      'XxlangBible.xml',
      'Xxlang2016Bible.xml',
    ]);
    expect(ranked.words).toEqual(['xxlang']);
    // A number out of a verse reference is not a Bible from that year.
    expect(rankBibleXmlLinks(links, 'verse john 2016 list').matched).toBe(0);
    // A year alone is still a search.
    expect(rankBibleXmlLinks(links, '2016').matched).toBe(3);
  });
  test('a word nothing matched is answered with the languages it is close to', () => {
    const links = [
      'XxlangBible.xml',
      'Xxlang2005Bible.xml',
      'KoreanBible.xml',
      'PortugueseBible.xml',
      'TurkishBible.xml',
      'TurkmenBible.xml',
      'Turkish2001Bible.xml',
      'LaoBible.xml',
    ].map((name) => ({ name, url: `https://x.example/${name}` }));
    expect(rankBibleXmlLinks(links, 'xxlng').suggestions).toEqual(['Xxlang']);
    expect(rankBibleXmlLinks(links, 'portugese').suggestions).toEqual([
      'Portuguese',
    ]);
    expect(rankBibleXmlLinks(links, 'korian').suggestions).toEqual(['Korean']);
    // The start of a name, the one with the most Bibles first...
    expect(suggestBibleLanguages(links, ['turkiye'])).toEqual([
      'Turkish',
      'Turkmen',
    ]);
    // ...and the whole of a short one.
    expect(suggestBibleLanguages(links, ['laotians'])).toEqual(['Lao']);
    // Nothing near is nothing offered, and a match offers nothing either.
    expect(rankBibleXmlLinks(links, 'vietnamese').suggestions).toBeUndefined();
    expect(rankBibleXmlLinks(links, 'xxlang').suggestions).toBeUndefined();
  });
  test('tells a page from an XML file by its first bytes', () => {
    expect(checkIsLikelyHtml('<!DOCTYPE html><html>')).toBe(true);
    expect(checkIsLikelyXml('﻿<?xml version="1.0"?><bible>')).toBe(true);
    expect(checkIsLikelyXml('{"not":"xml"}')).toBe(false);
  });
});

// A language in its own words is in that language's package's tests.
describe('a language typed by name', () => {
  test('a code only when it is the whole answer', () => {
    expect(toBibleSearchWords('en')).toEqual(['english']);
    expect(toBibleSearchWords('en 2019')).toEqual(['en', '2019']);
    expect(toBibleSearchWords('English 2019')).toEqual(['english', '2019']);
    expect(toCatalogLanguageWord('english')).toBeNull();
  });
  test('by its country or its people, as readily as by its name', () => {
    // Already the start of the catalog's own word: left as typed.
    expect(toBibleSearchWords('Import a Bible in "korea"')).toEqual(['korea']);
    // English's own, there with no language installed.
    expect(toBibleSearchWords('import bible in America')).toEqual(['english']);
    // Every one of them -- English's and each installed language's own --
    // is read as its language and leads to one the catalog has files for.
    const aliasList = Object.entries(readLanguageAliases());
    expect(aliasList.length).toBeGreaterThan(0);
    for (const [alias, language] of aliasList) {
      expect([
        alias,
        toBibleSearchWords(`Import a Bible in ${alias}`),
        checkIsBibleLanguageWord(alias),
        checkIsBibleLanguageWord(language),
      ]).toEqual([alias, [language], true, true]);
    }
  });
  test('the English Bibles named by their letters are filed under others', () => {
    expect(toBibleSearchWords('import KJV bible')).toEqual(['english', 'kj']);
    expect(toBibleSearchWords('nkjv')).toEqual(['english', 'nkj']);
    // Beside a language it is that language's own.
    expect(toBibleSearchWords('Thai KJV')).toEqual(['thai', 'kjv']);
    const links = [
      'EnglishKJBible.xml',
      'EnglishNKJBible.xml',
      'ThaiKJVBible.xml',
    ].map((name) => ({ name, url: `https://x.example/${name}` }));
    expect(
      rankBibleXmlLinks(links, 'import KJV bible').links.map((one) => one.name),
    ).toEqual(['EnglishKJBible.xml', 'EnglishNKJBible.xml']);
  });
  test('which words of a request name a language with Bibles', () => {
    expect(checkIsBibleLanguageWord('English')).toBe(true);
    expect(checkIsBibleLanguageWord('Swahili')).toBe(true);
    // A country, through English's own names for it.
    expect(checkIsBibleLanguageWord('england')).toBe(true);
    expect(checkIsBibleLanguageWord('Xxlang')).toBe(false);
    expect(checkIsBibleLanguageWord('verse')).toBe(false);
    expect(checkIsBibleLanguageWord('commentary')).toBe(false);
  });
});

describe('which language the verses are in', () => {
  test('too little to go on is no guess at all', () => {
    expect(guessBibleLocalesFromText('1 2 3')).toEqual({
      script: null,
      locales: [],
    });
  });
  test("English is told by English's own little words", () => {
    expect(
      guessBibleLocalesFromText(
        'In the beginning God created the heaven and the earth. And the ' +
          'earth was without form, and void; and darkness was upon the deep.',
      ).locales[0],
    ).toBe('en-US');
  });
});

describe('the short names offered', () => {
  test('initials, language and year, file name -- never a taken one', () => {
    expect(
      genBibleKeyChoices({
        title: 'Xxlang Standard Version 1954 = Hammond Version',
        sourceName: `${REPO}/raw/refs/heads/master/XxlangBible.xml`,
        locale: 'xx-XX',
      }),
    ).toEqual(['XSV', 'XX1954', 'XXLANG', 'XX-BIBLE']);
    expect(
      genBibleKeyChoices({
        title: 'Xxlang Standard Version 1954',
        locale: 'xx-XX',
        isTaken: (key) => key === 'XSV',
      })[0],
    ).toBe('XSV2');
  });
  test("the file's own key comes first, and invalid names never appear", () => {
    expect(
      genBibleKeyChoices({
        keyAttribute: 'KJV',
        title: 'King James Version',
        locale: 'en-US',
        isValid: (key) => key !== 'EN-BIBLE',
      }),
    ).toEqual(['KJV', 'KING']);
  });
});

describe('which list of book names this Bible uses', () => {
  test('the same list always gets the same id', () => {
    expect(toBibleNameListId(['a', 'b'])).toBe(toBibleNameListId(['a', 'b']));
    expect(toBibleNameListId(['a', 'b'])).not.toBe(
      toBibleNameListId(['a', 'c']),
    );
    expect(toBibleNameListId(['a'])).toMatch(/^n[0-9a-f]{8}$/);
  });
});
