import { afterEach, describe, expect, test } from 'vitest';

import englishWorld from '../../src/lang/data/en/world.json' with { type: 'json' };
import {
  configureWorldLanguageParts,
  readWorldLanguages,
} from './worldLanguages.mjs';

// A language's own words are ITS data (`online/<code>/world.json`), read from
// the installed language; the app's own is English
// (`src/lang/data/en/world.json`). Made-up parts here: a test of the merge
// names no language.
const PART_XX = {
  nativeLanguageNames: { xxnative: 'xxenglish' },
  languageAliases: { xxalias: 'xxenglish' },
  latinStopWords: { 'xx-XX': 'xa xb xc' },
  ownScriptLanguages: { xxenglish: 'Xxscript' },
  localeNameAliases: { xx: ['xxother'] },
  languageWordPrefixes: ['xxlang'],
  bookNumberWords: ['xxnumber'],
  scriptLocales: [
    { script: 'Xxscript', locales: ['xx-XX'], order: 20 },
    { script: 'Latin', locales: ['xx-LA'], order: 2600 },
  ],
  cyrillicLetterLocales: [
    { letters: 'b', locales: ['yy-YY'], order: 3 },
    { letters: 'a', locales: ['xx-XX'], order: 1 },
  ],
  cyrillicDefaultLocales: [{ locale: 'xx-XX', order: 2 }],
  colonMarks: '|',
};
const PART_YY = {
  languageAliases: { yyalias: 'yyenglish' },
  scriptLocales: [{ script: 'Latin', locales: ['yy-LA'], order: 100 }],
  cyrillicLetterLocales: [{ letters: 'c', locales: ['zz-ZZ'], order: 2 }],
  cyrillicDefaultLocales: [{ locale: 'yy-YY', order: 1 }, { order: 0 }],
  colonMarks: '~',
};

afterEach(() => {
  configureWorldLanguageParts(null);
});

describe('the world languages', () => {
  test('are English alone with nothing installed', () => {
    configureWorldLanguageParts(null);
    const world = readWorldLanguages();
    expect(world.languageAliases).toEqual(englishWorld.languageAliases);
    expect(world.latinStopWords).toEqual(englishWorld.latinStopWords);
    expect(world.nativeLanguageNames).toEqual({});
    expect(world.ownScriptLanguages).toEqual({});
    expect(world.localeNameAliases).toEqual({});
    expect(world.languageWordPrefixes).toEqual([]);
    expect(world.bookNumberWords).toEqual([]);
    expect(world.cyrillicLetterLocales).toEqual([]);
    expect(world.cyrillicDefaultLocales).toEqual([]);
    expect(world.colonMarks).toBe('');
    // English's own script holds no other language's locale.
    expect(world.scriptLocales).toEqual({ Latin: [] });
    // What the app keeps is English: no letter past ASCII.
    expect(JSON.stringify(englishWorld)).toMatch(/^[\x20-\x7E]*$/);
  });

  test('take in what each installed language says in its own words', () => {
    configureWorldLanguageParts(() => {
      return [PART_XX, null, 'not a part', PART_YY];
    });
    const world = readWorldLanguages();
    expect(world.nativeLanguageNames.xxnative).toBe('xxenglish');
    expect(world.languageAliases).toMatchObject({
      ...englishWorld.languageAliases,
      xxalias: 'xxenglish',
      yyalias: 'yyenglish',
    });
    expect(world.latinStopWords['xx-XX']).toBe('xa xb xc');
    expect(world.ownScriptLanguages.xxenglish).toBe('Xxscript');
    expect(world.localeNameAliases.xx).toEqual(['xxother']);
    expect(world.languageWordPrefixes).toEqual(['xxlang']);
    expect(world.bookNumberWords).toEqual(['xxnumber']);
    expect(world.colonMarks).toBe('|~');
    // A script's locales in the order they were written, whichever language
    // holds them: the first one found decides.
    expect(world.scriptLocales).toEqual({
      Xxscript: ['xx-XX'],
      Latin: ['yy-LA', 'xx-LA'],
    });
    expect(world.cyrillicLetterLocales).toEqual([
      ['a', ['xx-XX']],
      ['c', ['zz-ZZ']],
      ['b', ['yy-YY']],
    ]);
    // A row without a locale is no fallback.
    expect(world.cyrillicDefaultLocales).toEqual(['yy-YY', 'xx-XX']);
    // The app's own table is left as it was.
    expect(englishWorld.languageAliases.xxalias).toBeUndefined();
  });

  test('are kept a few seconds, then read again', () => {
    let readCount = 0;
    configureWorldLanguageParts(() => {
      readCount += 1;
      return readCount === 1 ? [PART_XX] : [];
    });
    expect(readWorldLanguages(1000).bookNumberWords).toEqual(['xxnumber']);
    expect(readWorldLanguages(5999).bookNumberWords).toEqual(['xxnumber']);
    expect(readCount).toBe(1);
    // A language deleted is gone once the few seconds are up.
    expect(readWorldLanguages(6000).bookNumberWords).toEqual([]);
    expect(readCount).toBe(2);
  });

  test('a reader that fails leaves English', () => {
    configureWorldLanguageParts(() => {
      throw new Error('no plugins here');
    });
    expect(readWorldLanguages().languageAliases).toEqual(
      englishWorld.languageAliases,
    );
  });
});
