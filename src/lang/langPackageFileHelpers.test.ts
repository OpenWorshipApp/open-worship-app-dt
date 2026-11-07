import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../test-setup/langPackageDirs';

import {
    listBibleBooksLangCodes,
    listLangBibleBookNames,
    loadLangBibleBooks,
} from './langPackageFileHelpers';

// Every package with a `bibleBooks.json`, by its folder: the helpers name no
// language, and neither does this.
const PACKAGE_CODE_LIST = listLangPackageCodes({
    fileName: 'bibleBooks.json',
});

describe('a language package file read by its code', () => {
    // Every installed language is asked (one over the shared factory has
    // English's names and no file of its own, and answers none), so the list
    // holds every package that ships book names and nothing that is no
    // package at all.
    test('lists every package that ships book names', () => {
        const codeList = listBibleBooksLangCodes();
        for (const code of PACKAGE_CODE_LIST) {
            expect(codeList).toContain(code);
        }
        const packageCodeList = listLangPackageCodes();
        for (const code of codeList) {
            expect(packageCodeList).toContain(code);
        }
        expect(PACKAGE_CODE_LIST).toContain('en');
    });

    test('reads one package by code or locale, and nothing for none', async () => {
        const english = await loadLangBibleBooks('en-US');
        expect(english[0].books[0]).toBe('Genesis');
        expect(await loadLangBibleBooks('xx')).toEqual([]);
    });

    test('names every book of every package once', async () => {
        const nameList = await listLangBibleBookNames();
        expect(new Set(nameList).size).toBe(nameList.length);
        for (const code of PACKAGE_CODE_LIST) {
            const sets = JSON.parse(
                readFileSync(
                    path.join(toLangPackageDir(code), 'bibleBooks.json'),
                    'utf8',
                ),
            ) as { books: string[] }[];
            for (const name of sets.flatMap((set) => set.books)) {
                expect(nameList, `${code} ${name}`).toContain(name);
            }
        }
    });
});
