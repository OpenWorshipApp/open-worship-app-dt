// The cases of `tools/owa-devtools-mcp/bibleXmlAdvice.coverage.test.mjs` about
// languages that have no package of their own (Czech, Turkish, Bulgarian,
// Russian, Japanese, Chinese). They run against the same module, which names
// no language.
import { describe, expect, test } from 'vitest';

import {
    checkHasLangPackage,
    readLangPackageWorldParts,
} from '../../../../../test-setup/langPackageDirs';
import {
    guessBibleLocalesFromText,
    toCatalogLanguageWord,
} from '../../../../../../tools/owa-devtools-mcp/bibleXmlAdvice.mjs';
import { configureWorldLanguageParts } from '../../../../../../tools/owa-devtools-mcp/worldLanguages.mjs';

// A language's script and locales are ITS data, there when it is installed
// (`worldLanguages.mjs`): every package of the checkout is installed here.
configureWorldLanguageParts(readLangPackageWorldParts);

describe('a language typed in its own words', () => {
    test('one no table spells out is found through the runtime, in English', () => {
        expect(toCatalogLanguageWord('čeština')).toBe('czech');
        expect(toCatalogLanguageWord('Türkçe')).toBe('turkish');
    });
});

// A script reads as a language only while one written in it is installed, so
// each case runs while the packages it names are in the checkout.
describe('which language the verses are in', () => {
    test.runIf(['bg', 'ru'].every(checkHasLangPackage))(
        'Cyrillic with none of the letters that name a language reads as Bulgarian first',
        () => {
            // An ordinary sentence, not a verse: no ы, э, і, ђ, ѓ or ў in it.
            expect(
                guessBibleLocalesFromText(
                    'Той каза на хората да дойдат при него утре сутрин',
                ),
            ).toEqual({ script: 'Cyrillic', locales: ['bg-BG', 'ru-RU'] });
        },
    );

    test.runIf(['ja', 'zh'].every(checkHasLangPackage))(
        'Han letters with a kana among them are Japanese, not Chinese',
        () => {
            const text = '東京大学図書館本日休館東京大学図書館本日休館東京の';
            expect(guessBibleLocalesFromText(text)).toEqual({
                script: 'Japanese',
                locales: ['ja-JP'],
            });
            // Without the kana the same letters are offered as Chinese first.
            expect(
                guessBibleLocalesFromText(text.replace('の', '')).locales[0],
            ).toBe('zh-CN');
        },
    );
});
