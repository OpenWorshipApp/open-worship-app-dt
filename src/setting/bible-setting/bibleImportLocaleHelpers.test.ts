import { describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', async () => {
    const localesFile = (await import('../../lang/data/en/locales.json'))
        .default;
    return { allLocalesMap: localesFile.locales };
});

import { toImportLocale } from './bibleImportLocaleHelpers';

describe('toImportLocale', () => {
    test('reads the bare code the format example writes as its region (F-22)', () => {
        expect(toImportLocale('en')).toBe('en-US');
    });

    test('keeps a locale the table has, and hands back what it cannot read', () => {
        expect(toImportLocale('en-GB')).toBe('en-GB');
        expect(toImportLocale('kjv')).toBe('kjv');
        expect(toImportLocale('')).toBe('');
        expect(toImportLocale('not a locale')).toBe('not a locale');
    });
});
