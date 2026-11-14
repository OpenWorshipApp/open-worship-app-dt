// A Bible may be in any installed language: every package's own locale
// passes the Bible info schema the same way (2026-11-09, the user: _all
// languages development, except english, should be treated the same way_).
// Until then the schema held the song format's 229 tags and a Bible in
// fourteen installed languages failed it. Loops over the packages on disk,
// so it holds with none of them.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { infoEditorSchemaHandler } from '../../../setting/bible-setting/schemas/bibleSchemaHelpers';
import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../../../test-setup/langPackageDirs';

function checkLocale(locale: string) {
    return infoEditorSchemaHandler
        .validate({
            title: 'Sample',
            key: 'SMP',
            version: 1,
            locale,
            legalNote: '',
            publisher: '',
            copyRights: '',
            numbersMap: Object.fromEntries(
                [...'0123456789'].map((digit) => [digit, digit]),
            ),
            keyBookMap: { GEN: 'Genesis' },
            booksAvailable: ['GEN'],
        })
        .errors.filter((error) => {
            return error.data.pointer === '#/locale';
        });
}

describe('every package locale is a Bible locale', () => {
    const codeList = listLangPackageCodes({ isEnglishIncluded: false });

    test.each(codeList)('%s', (langCode) => {
        const { locale } = JSON.parse(
            readFileSync(
                path.join(toLangPackageDir(langCode), 'meta.json'),
                'utf8',
            ),
        );
        expect(checkLocale(locale)).toEqual([]);
    });

    test('English is one, a made-up tag is not', () => {
        expect(checkLocale('en-US')).toEqual([]);
        expect(checkLocale('xx-XX').length).toBeGreaterThan(0);
    });
});
