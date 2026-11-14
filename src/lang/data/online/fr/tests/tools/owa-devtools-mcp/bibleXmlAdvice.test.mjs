// The French cases of `tools/owa-devtools-mcp/bibleXmlAdvice.test.mjs`, kept with the
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

describe('which language the verses are in', () => {
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
});
