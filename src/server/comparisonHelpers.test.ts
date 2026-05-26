import { describe, expect, test } from 'vitest';

import {
    checkAreArraysEqual,
    checkAreDatesEqual,
    checkAreObjectsEqual,
    checkIsItemInArray,
} from './comparisonHelpers';

describe('comparisonHelpers', () => {
    test('checkIsItemInArray handles primitives, objects, and invalid arrays', () => {
        expect(checkIsItemInArray('a', null)).toBe(false);
        expect(checkIsItemInArray('b', ['a', 'b'])).toBe(true);
        expect(
            checkIsItemInArray({ name: 'alpha', data: [1, 2] }, [
                { name: 'alpha', data: [2, 1] },
            ]),
        ).toBe(true);
        expect(checkIsItemInArray({ id: 2 }, [{ id: 1 }])).toBe(false);
    });

    test('checkAreArraysEqual compares unordered arrays and nested objects', () => {
        const first = [{ id: 1, tags: ['b', 'a'] }, 3, 'x'];
        const second = ['x', { id: 1, tags: ['a', 'b'] }, 3];

        expect(checkAreArraysEqual(first, first)).toBe(true);
        expect(checkAreArraysEqual(first, second)).toBe(true);
        expect(checkAreArraysEqual(first, [{ id: 1 }, 3, 'x'])).toBe(false);
        expect(checkAreArraysEqual([1, 1], [1])).toBe(false);
        expect(checkAreArraysEqual('nope', [])).toBe(false);
    });

    test('checkAreDatesEqual only matches valid dates with same timestamp', () => {
        expect(
            checkAreDatesEqual(
                new Date('2024-01-01T00:00:00.000Z'),
                new Date('2024-01-01T00:00:00.000Z'),
            ),
        ).toBe(true);
        expect(
            checkAreDatesEqual(
                new Date('2024-01-01T00:00:00.000Z'),
                new Date('2024-01-01T00:00:01.000Z'),
            ),
        ).toBe(false);
        expect(checkAreDatesEqual(new Date(), '2024-01-01')).toBe(false);
    });

    test('checkAreObjectsEqual compares nested arrays, dates, nulls, and mismatches', () => {
        const left = {
            title: 'Song',
            tags: ['c', 'b', 'a'],
            meta: {
                createdAt: new Date('2024-02-03T10:11:12.000Z'),
                owner: null,
            },
        };
        const right = {
            title: 'Song',
            tags: ['a', 'b', 'c'],
            meta: {
                createdAt: new Date('2024-02-03T10:11:12.000Z'),
                owner: null,
            },
        };

        expect(checkAreObjectsEqual(left, right)).toBe(true);
        expect(checkAreObjectsEqual(null, null)).toBe(true);
        expect(checkAreObjectsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        expect(
            checkAreObjectsEqual(
                { nested: { value: 1 } },
                { nested: { value: 2 } },
            ),
        ).toBe(false);
        expect(checkAreObjectsEqual('x', { value: 'x' })).toBe(false);
    });
});
