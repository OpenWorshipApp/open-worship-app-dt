import { describe, expect, test } from 'vitest';

import { checkIsBibleKeyTaken, normalizeBibleKey } from './bibleKeyHelpers';

describe('bibleKeyHelpers', () => {
    test('normalizes whitespace and case', () => {
        expect(normalizeBibleKey('  KJV ')).toBe('kjv');
    });

    test('finds installed keys case-insensitively', () => {
        const takenBibleKeys = new Set(['KJV', 'ពគប']);
        expect(checkIsBibleKeyTaken('kjv', takenBibleKeys)).toBe(true);
        expect(checkIsBibleKeyTaken(' KJV ', takenBibleKeys)).toBe(true);
        expect(checkIsBibleKeyTaken('ពគប', takenBibleKeys)).toBe(true);
        expect(checkIsBibleKeyTaken('ZZ1234', takenBibleKeys)).toBe(false);
    });

    test('does not treat an empty key as a collision', () => {
        expect(checkIsBibleKeyTaken('  ', ['KJV'])).toBe(false);
    });
});
