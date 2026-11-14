import { describe, expect, it } from 'vitest';

import { PRESENTER_DEMO_LIST } from '../../tools/owa-devtools-mcp/presenterDemos.mjs';
import { READER_DEMO_LIST } from '../../tools/owa-devtools-mcp/readerDemos.mjs';
import { PAGE_DEMO_LIST } from '../../tools/owa-devtools-mcp/pageDemos.mjs';
import {
    listAssistantLangPackages,
    listLangPackageCodes,
    readLangPackageDictionary,
} from '../test-setup/langPackageDirs';

const CATALOG_TEXT = [
    'Search tips',
    'No tips found',
    'Getting started',
    'Reading and layout',
    'Notes and marks',
    'Reader shortcuts',
    'File menu',
    'Edit menu',
    'View menu',
    'Tools menu',
    'Window menu',
    'Help menu',
    'Study tools',
    ...PRESENTER_DEMO_LIST.flatMap(({ label, detail }) => [label, detail]),
    ...READER_DEMO_LIST.flatMap(({ label, detail }) => [label, detail]),
    ...PAGE_DEMO_LIST.flatMap(({ label, detail }) => [label, detail]),
];

// Every language package but English, read from its `dictionary.json` the
// way `tran()` looks a label up. It used to look for each package's
// `index.ts`, which no package has had since languages became plugins, so
// it found none and checked nothing: on 2026-11-12 a Reader tip's detail was
// reworded with no string in any language, and every translated Reader
// threw on load in dev (`getReaderTips` translates every tip as it mounts).
const LANG_CODE_LIST = listLangPackageCodes({ isEnglishIncluded: false });

// The packages written by hand, the ones the assistant is written for (an
// `assistant.json`). Only there is a string equal to its English a tip left
// untranslated: a machine-translated one may rightly keep a loanword --
// Filipino's "Slide Editor".
const HAND_MADE_SET = new Set(
    listAssistantLangPackages().map(({ langCode }) => {
        return langCode;
    }),
);

function toLookupKey(text: string) {
    return text.trim().toLowerCase();
}

describe('tip translations in every language package', () => {
    // None when only English is in the checkout, and the suite still runs.
    it('reads the packages there are, so a green run means something', () => {
        for (const langCode of LANG_CODE_LIST) {
            expect(
                Object.keys(readLangPackageDictionary(langCode)).length,
                langCode,
            ).toBeGreaterThan(1000);
        }
    });
});

describe.each(LANG_CODE_LIST)('%s tip translations', (langCode) => {
    it('translates every title, description, category and search label', () => {
        const dictionary = readLangPackageDictionary(langCode);
        const missingList = CATALOG_TEXT.filter((text) => {
            const value = dictionary[toLookupKey(text)];
            return typeof value !== 'string' || value.trim().length === 0;
        });
        expect(missingList).toEqual([]);
        if (!HAND_MADE_SET.has(langCode)) {
            return;
        }
        const englishList = CATALOG_TEXT.filter((text) => {
            return dictionary[toLookupKey(text)] === text;
        });
        expect(englishList).toEqual([]);
    });
});
