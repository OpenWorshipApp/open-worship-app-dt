// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import french from '../lang/data/fr';
import khmer from '../lang/data/km';
import { PRESENTER_DEMO_LIST } from '../../tools/owa-devtools-mcp/presenterDemos.mjs';
import { READER_DEMO_LIST } from '../../tools/owa-devtools-mcp/readerDemos.mjs';

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
];

describe.each([
    ['Khmer', khmer],
    ['French', french],
])('%s tip translations', (_name, language) => {
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
