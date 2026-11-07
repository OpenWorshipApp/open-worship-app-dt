// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import type { LanguageDataType } from '../lang/langHelpers';
import { PRESENTER_DEMO_LIST } from '../../tools/owa-devtools-mcp/presenterDemos.mjs';
import { READER_DEMO_LIST } from '../../tools/owa-devtools-mcp/readerDemos.mjs';
import { PAGE_DEMO_LIST } from '../../tools/owa-devtools-mcp/pageDemos.mjs';

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

// Every hand-made language package but English (the key language, whose
// package brings the app's hooks along), found by its folder: one the
// assistant is written for (an `assistant.json`). A machine-translated one
// may rightly keep a loanword -- Filipino's "Slide Editor" -- that this test
// reads as a tip left in English.
const ASSISTANT_FILE_MAP = import.meta.glob(
    '../lang/data/online/*/assistant.json',
);
const LANGUAGE_MAP = import.meta.glob<LanguageDataType>(
    '../lang/data/online/*/index.ts',
    { eager: true, import: 'default' },
);
const LANGUAGE_LIST = Object.entries(LANGUAGE_MAP)
    .filter(([filePath]) => {
        return (
            filePath.replace(/index\.ts$/, 'assistant.json') in
            ASSISTANT_FILE_MAP
        );
    })
    .map(([, language]) => {
        return [language.name, language] as const;
    });

describe('tip translations in every language package', () => {
    // An English-only tree has none, and holds nothing to translate.
    it('finds the packages there are', () => {
        expect(Array.isArray(LANGUAGE_LIST)).toBe(true);
    });
});

describe.each(LANGUAGE_LIST)('%s tip translations', (_name, language) => {
    it('translates every title, description, category and search label', () => {
        for (const text of CATALOG_TEXT) {
            const key = language.sanitizeTranKey(text);
            expect(language.dictionary[key], text).toBeTypeOf('string');
            expect(
                language.dictionary[key].trim().length,
                text,
            ).toBeGreaterThan(0);
            expect(language.dictionary[key], text).not.toBe(text);
        }
    });
});
