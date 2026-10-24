import { describe, expect, test } from 'vitest';
import {
  LANGUAGE_ALIAS_MAP,
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

const REPO = 'https://github.com/Beblia/Holy-Bible-XML-Format';

describe('the address a volunteer pasted', () => {
  test('a GitHub file PAGE becomes its download address, and says so', () => {
    expect(toBibleXmlDownloadUrl(`${REPO}/blob/master/KhmerBible.xml`)).toEqual(
      {
        url: 'https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/KhmerBible.xml',
        note: 'I used the download address of the file instead of its GitHub page.',
      },
    );
  });
  test('an address that already downloads is left alone', () => {
    const raw = `${REPO}/raw/refs/heads/master/KhmerBible.xml`;
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
    expect(toGithubListingUrl(`${REPO}/blob/master/KhmerBible.xml`)).toBeNull();
    expect(toGithubListingUrl('https://example.com/a/b')).toBeNull();
  });
});

describe('picking the Bible off a page of files', () => {
  const listing = JSON.stringify([
    {
      download_url:
        'https://raw.githubusercontent.com/Beblia/x/master/KhmerBible.xml',
    },
    {
      download_url:
        'https://raw.githubusercontent.com/Beblia/x/master/Khmer2005Bible.xml',
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
      'KhmerBible.xml',
      'Khmer2005Bible.xml',
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
      'please import the Khmer bible from github',
    );
    expect(ranked.words).toEqual(['khmer']);
    expect(ranked.matched).toBe(2);
    expect(ranked.links[0].name).toBe('KhmerBible.xml');
    expect(rankBibleXmlLinks(links, 'Swahili').matched).toBe(0);
    // Every word, when a file has them all: one Bible, not two lists.
    expect(rankBibleXmlLinks(links, 'Khmer 2005').links).toEqual([links[1]]);
    expect(rankBibleXmlLinks(links, 'Khmer 1611').matched).toBe(2);
    expect(rankBibleXmlLinks(links, '').matched).toBe(3);
  });
  test('a year no file of that language has only narrows, it never widens', () => {
    const links = [
      'KhmerBible.xml',
      'Khmer2016Bible.xml',
      'Polish2016Bible.xml',
      'Chewa2016Bible.xml',
    ].map((name) => ({ name, url: `https://x.example/${name}` }));
    // No Khmer Bible of 1999: the Khmer ones, said as what they matched on.
    const ranked = rankBibleXmlLinks(links, 'Khmer 1999');
    expect(ranked.links.map((one) => one.name)).toEqual([
      'KhmerBible.xml',
      'Khmer2016Bible.xml',
    ]);
    expect(ranked.words).toEqual(['khmer']);
    // A number out of a verse reference is not a Bible from that year.
    expect(rankBibleXmlLinks(links, 'verse john 2016 list').matched).toBe(0);
    // A year alone is still a search.
    expect(rankBibleXmlLinks(links, '2016').matched).toBe(3);
  });
  test('a word nothing matched is answered with the languages it is close to', () => {
    const links = [
      'KhmerBible.xml',
      'Khmer2005Bible.xml',
      'KoreanBible.xml',
      'PortugueseBible.xml',
      'TurkishBible.xml',
      'TurkmenBible.xml',
      'Turkish2001Bible.xml',
      'LaoBible.xml',
    ].map((name) => ({ name, url: `https://x.example/${name}` }));
    expect(rankBibleXmlLinks(links, 'kmer').suggestions).toEqual(['Khmer']);
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
    expect(rankBibleXmlLinks(links, 'khmer').suggestions).toBeUndefined();
  });
  test('tells a page from an XML file by its first bytes', () => {
    expect(checkIsLikelyHtml('<!DOCTYPE html><html>')).toBe(true);
    expect(checkIsLikelyXml('﻿<?xml version="1.0"?><bible>')).toBe(true);
    expect(checkIsLikelyXml('{"not":"xml"}')).toBe(false);
  });
});

describe('a language typed by name', () => {
  test('in its own words, with or without "language" in front', () => {
    // Electron's ICU has no Khmer display names: the table must answer.
    expect(toCatalogLanguageWord('ខ្មែរ')).toBe('khmer');
    expect(toCatalogLanguageWord('ភាសាខ្មែរ')).toBe('khmer');
    expect(toCatalogLanguageWord('Deutsch')).toBe('german');
    expect(toBibleSearchWords('install a ไทย bible')).toEqual(['thai']);
  });
  test('a code only when it is the whole answer', () => {
    expect(toBibleSearchWords('km')).toEqual(['khmer']);
    expect(toBibleSearchWords('Khmer 2019')).toEqual(['khmer', '2019']);
    expect(toCatalogLanguageWord('khmer')).toBeNull();
  });
  test('by its country or its people, as readily as by its name', () => {
    expect(toBibleSearchWords('Import a Bible in Cambodia')).toEqual(['khmer']);
    expect(toBibleSearchWords('import bible in China')).toEqual(['chinese']);
    expect(toBibleSearchWords('a bible for Thailand please')).toEqual(['thai']);
    expect(toBibleSearchWords('import bible espanol')).toEqual(['spanish']);
    // Already the start of the catalog's own word: left as typed.
    expect(toBibleSearchWords('Import a Bible in "korea"')).toEqual(['korea']);
    // Every one of them leads to a language the catalog has files for.
    for (const [alias, language] of Object.entries(LANGUAGE_ALIAS_MAP)) {
      expect([alias, checkIsBibleLanguageWord(language)]).toEqual([
        alias,
        true,
      ]);
    }
  });
  test('the English Bibles named by their letters are filed under others', () => {
    expect(toBibleSearchWords('import KJV bible')).toEqual(['english', 'kj']);
    expect(toBibleSearchWords('nkjv')).toEqual(['english', 'nkj']);
    // Beside a language it is that language's own.
    expect(toBibleSearchWords('Thai KJV')).toEqual(['thai', 'kjv']);
    const links = ['EnglishKJBible.xml', 'EnglishNKJBible.xml', 'ThaiKJVBible.xml']
      .map((name) => ({ name, url: `https://x.example/${name}` }));
    expect(
      rankBibleXmlLinks(links, 'import KJV bible').links.map((one) => one.name),
    ).toEqual(['EnglishKJBible.xml', 'EnglishNKJBible.xml']);
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
  test('Latin letters are told apart by their little words', () => {
    expect(
      guessBibleLocalesFromText(
        'In the beginning God created the heaven and the earth. And the ' +
          'earth was without form, and void; and darkness was upon the deep.',
      ).locales[0],
    ).toBe('en-US');
    expect(
      guessBibleLocalesFromText(
        'Au commencement, Dieu créa les cieux et la terre. La terre était ' +
          'informe et vide: il y avait des ténèbres à la surface de l abîme.',
      ).locales[0],
    ).toBe('fr-FR');
  });
  test('Cyrillic and Japanese are read by their own letters', () => {
    expect(
      guessBibleLocalesFromText(
        'В начале сотворил Бог небо и землю. Земля же была безвидна и пуста.',
      ).locales[0],
    ).toBe('ru-RU');
    expect(
      guessBibleLocalesFromText(
        'はじめに神は天と地とを創造された。地は形なく、むなしく、やみが淵のおもてにあった。',
      ).locales,
    ).toEqual(['ja-JP']);
  });
  test('too little to go on is no guess at all', () => {
    expect(guessBibleLocalesFromText('1 2 3')).toEqual({
      script: null,
      locales: [],
    });
  });
});

describe('the short names offered', () => {
  test('initials, language and year, file name -- never a taken one', () => {
    expect(
      genBibleKeyChoices({
        title: 'Khmer Standard Version 1954 = Hammond Version',
        sourceName: `${REPO}/raw/refs/heads/master/KhmerBible.xml`,
        locale: 'km-KH',
      }),
    ).toEqual(['KSV', 'KM1954', 'KHMER', 'KM-BIBLE']);
    expect(
      genBibleKeyChoices({
        title: 'Khmer Standard Version 1954',
        locale: 'km-KH',
        isTaken: (key) => key === 'KSV',
      })[0],
    ).toBe('KSV2');
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
  test('counts the names the text uses, ignoring shared ones and numbers', () => {
    const text = 'ហោរា​អេសាយ ... ១ សាំយូអែល ... យ៉ូហាន';
    expect(
      scoreNameLists(text, [
        { names: ['អេសាយ', 'សាំយូអែល ទី ១', 'យ៉ូហាន'] },
        { names: ['អេសាយ', 'សាំយូអែល ទី ១', 'យ៉ូហានថ្មី'] },
      ]),
    ).toEqual([1, 0]);
  });
  test('the same list always gets the same id', () => {
    expect(toBibleNameListId(['a', 'b'])).toBe(toBibleNameListId(['a', 'b']));
    expect(toBibleNameListId(['a', 'b'])).not.toBe(
      toBibleNameListId(['a', 'c']),
    );
    expect(toBibleNameListId(['a'])).toMatch(/^n[0-9a-f]{8}$/);
  });
});
