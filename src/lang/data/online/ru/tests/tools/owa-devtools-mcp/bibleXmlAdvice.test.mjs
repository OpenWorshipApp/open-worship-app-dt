// The Russian cases of `tools/owa-devtools-mcp/bibleXmlAdvice.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { describe, expect, test } from 'vitest';
import { guessBibleLocalesFromText } from '../../../../../../../../tools/owa-devtools-mcp/bibleXmlAdvice.mjs';
import { readPackageWorldParts } from '../../../../../../../../extra-work/language-packages.mjs';
import { configureWorldLanguageParts } from '../../../../../../../../tools/owa-devtools-mcp/worldLanguages.mjs';

// What a language's own words are is ITS data, there when it is installed
// (`worldLanguages.mjs`): every package of the checkout is installed here.
configureWorldLanguageParts(readPackageWorldParts);

describe('which language the verses are in', () => {
  test('Cyrillic is read by its own letters', () => {
    expect(
      guessBibleLocalesFromText(
        'В начале сотворил Бог небо и землю. Земля же была безвидна и пуста.',
      ).locales[0],
    ).toBe('ru-RU');
  });
});
