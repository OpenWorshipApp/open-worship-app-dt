import { describe, expect, it } from 'vitest';

import {
    checkIsOneEditApart,
    cutNamedBooks,
    findNamedBooks,
    resolveBookFilter,
} from './bibleVerseFindHelpers';

const ENGLISH_NAMES = {
    GEN: 'Genesis',
    EXO: 'Exodus',
    JHN: 'John',
    MAT: 'Matthew',
};

describe('resolveBookFilter', () => {
    it('ignores empty parts and a book named twice', () => {
        expect(
            resolveBookFilter('Matthew,, John and John; ', [ENGLISH_NAMES]),
        ).toEqual({ bookKeys: ['MAT', 'JHN'], unknown: [] });
    });
});

describe('checkIsOneEditApart', () => {
    it('counts the same word as no edit apart', () => {
        expect(checkIsOneEditApart('genesis', 'genesis')).toBe(true);
    });
});

describe('findNamedBooks', () => {
    it('finds a second book beside the first and cuts both out', () => {
        const text = 'in genesis and exodus the flood';
        const found = findNamedBooks(text, [ENGLISH_NAMES], ['in'], true);
        expect(found).toEqual([
            {
                bookKey: 'GEN',
                typed: 'genesis',
                name: 'Genesis',
                start: 0,
                end: 10,
                isAfterMarker: true,
                isNear: false,
            },
            {
                bookKey: 'EXO',
                typed: 'exodus',
                name: 'Exodus',
                start: 15,
                end: 21,
                isAfterMarker: false,
                isNear: false,
            },
        ]);
        expect(cutNamedBooks(text, found)).toBe('and the flood');
        // The order the list comes in does not matter.
        expect(cutNamedBooks(text, [...found].reverse())).toBe('and the flood');
    });
});
