// The French cases of `tools/owa-devtools-mcp/passageMatch.coverage.test.mjs`,
// kept with the language's package so the language and its tests come and
// go together. They run against the same modules, which name no language.
//
// Quoting a page's TRANSLATION at the passage the English page answered
// with. The pages are made up: what is under test is where a cut lands.

import { describe, expect, test } from 'vitest';

import { genTranslatedExcerpt } from '../../../../../../../../tools/owa-devtools-mcp/passageMatch.mjs';

const ENGLISH_PAGE = [
  'Open the Settings window from the gear.',
  '',
  'Click Language and choose Khmer.',
  '',
  'The menu bar follows the same language after a restart.',
].join('\n');

// Written with CRLF, and with the manual's screenshot mark on one step.
const FRENCH_PAGE = [
  'Ouvrez la fenêtre Paramètres depuis l’engrenage.',
  '',
  'Cliquez sur Langue et choisissez le khmer. 📸',
  '',
  'La barre de menus suit la même langue après un redémarrage.',
].join('\r\n');

describe('an excerpt quoted out of the translation', () => {
  test('the passage the English words chose, in the translation, topped up the same way', () => {
    expect(
      genTranslatedExcerpt(ENGLISH_PAGE, FRENCH_PAGE, [['language']]),
    ).toBe(
      [
        'Cliquez sur Langue et choisissez le khmer.',
        'La barre de menus suit la même langue après un redémarrage.',
      ].join('\n'),
    );
  });

  test('with no word to go by, the page opens the quote', () => {
    expect(genTranslatedExcerpt(ENGLISH_PAGE, FRENCH_PAGE)).toBe(
      [
        'Ouvrez la fenêtre Paramètres depuis l’engrenage.',
        'Cliquez sur Langue et choisissez le khmer.',
        'La barre de menus suit la même langue après un redémarrage.',
      ].join('\n'),
    );
  });

  test('it is topped up by the ENGLISH length, so both quote the same passages', () => {
    // Past the 160 characters a passage is topped up below; its French is
    // nowhere near that.
    const longEnglish = [
      'Short opening line.',
      '',
      'Click Language and choose Khmer. ' +
        'The window changes its words at once and keeps them after a restart of the app. '.repeat(
          2,
        ),
      '',
      'The menu bar follows.',
    ].join('\n');
    expect(longEnglish.split('\n\n')[1].trim().length).toBeGreaterThan(160);
    const shortFrench = [
      'Ouverture.',
      '',
      'Cliquez sur Langue.',
      '',
      'La barre suit.',
    ].join('\n');
    expect(genTranslatedExcerpt(longEnglish, shortFrench, [['language']])).toBe(
      'Cliquez sur Langue.',
    );
  });

  test('a translation cut into other passages is no match, and says so', () => {
    expect(
      genTranslatedExcerpt(ENGLISH_PAGE, 'Un seul paragraphe.', [['language']]),
    ).toBeNull();
    expect(genTranslatedExcerpt('', '', [['language']])).toBeNull();
    expect(genTranslatedExcerpt(undefined, undefined)).toBeNull();
  });
});
