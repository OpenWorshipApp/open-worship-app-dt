import { describe, expect, test } from 'vitest';

import { resolveResourceBookKeyFromMaps } from '../../../../../../helper/agentResourceNameHelpers';

describe('a book named in the Bible’s own language', () => {
    const KEY_BOOK_MAP_LIST = [{ GEN: 'លោកុប្បត្តិ', JHN: 'យ៉ូហាន' }];

    test('is its key, after the code and the English name', () => {
        expect(
            resolveResourceBookKeyFromMaps('យ៉ូហាន', KEY_BOOK_MAP_LIST),
        ).toBe('JHN');
        expect(resolveResourceBookKeyFromMaps('John', KEY_BOOK_MAP_LIST)).toBe(
            'JHN',
        );
        expect(resolveResourceBookKeyFromMaps('JHN', KEY_BOOK_MAP_LIST)).toBe(
            'JHN',
        );
        expect(
            resolveResourceBookKeyFromMaps('unknown', KEY_BOOK_MAP_LIST),
        ).toBeNull();
    });
});
