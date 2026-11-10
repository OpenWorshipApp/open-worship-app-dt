// Whether a language is written with spaces between its words is read off
// its locale's SCRIPT (`checkIsSpacedLocale`), so a Bible in a language that
// is not installed is searched right too. Every package that says so in its
// own `script.json` (`isUnspaced`) is held to that rule, every language
// alike (2026-11-09, the user: _all languages development, except english,
// should be treated the same way_) -- Tibetan said it and was searched as a
// spaced language until then. Loops over the packages on disk, so it holds
// with none of them.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { checkIsSpacedLocale } from '../../../helper/bibleVerseFindHelpers';
import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../../../test-setup/langPackageDirs';

function readJson(filePath: string) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

describe('a package that writes no spaces is searched as one', () => {
    const codeList = listLangPackageCodes({
        isEnglishIncluded: false,
        fileName: 'script.json',
    });

    test.each(codeList)('%s', (langCode) => {
        const dir = toLangPackageDir(langCode);
        const { isUnspaced } = readJson(path.join(dir, 'script.json'));
        const { locale } = readJson(path.join(dir, 'meta.json'));
        expect(checkIsSpacedLocale(locale)).toBe(isUnspaced !== true);
    });

    test('English is spaced', () => {
        expect(checkIsSpacedLocale('en-US')).toBe(true);
    });
});
