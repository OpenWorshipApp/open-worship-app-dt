import { describe, expect, test } from 'vitest';

import { findScreenShowRefusal } from './screenShowGraphHelpers';

function toEdges(entries: [number, number[]][]) {
    return new Map<number, number[]>(entries);
}

describe('findScreenShowRefusal', () => {
    test('a screen never shows itself', () => {
        expect(findScreenShowRefusal(1, [1], toEdges([]))).toBe('self');
        // Also when it is one of a group about to receive it.
        expect(findScreenShowRefusal(1, [0, 1], toEdges([]))).toBe('self');
    });

    test('allows a picture nothing loops back from', () => {
        expect(findScreenShowRefusal(0, [1], toEdges([]))).toBeNull();
        expect(findScreenShowRefusal(0, [2], toEdges([[1, [0]]]))).toBeNull();
    });

    test('refuses the direct loop', () => {
        // 1 shows 0; 0 showing 1 would close it.
        expect(findScreenShowRefusal(1, [0], toEdges([[1, [0]]]))).toBe('loop');
    });

    test('refuses a loop through screens in between', () => {
        // 2 shows 1, 1 shows 0: 0 showing 2 would put 0 inside itself.
        const edges = toEdges([
            [2, [1]],
            [1, [0]],
        ]);
        expect(findScreenShowRefusal(2, [0], edges)).toBe('loop');
        expect(findScreenShowRefusal(2, [3], edges)).toBeNull();
    });

    test('counts every screen about to receive it', () => {
        // 2 shows 1: putting 2 on a group of {0, 1} loops through 1.
        expect(findScreenShowRefusal(2, [0, 1], toEdges([[2, [1]]]))).toBe(
            'loop',
        );
    });

    test('ends on a cycle already in the data', () => {
        const edges = toEdges([
            [0, [1]],
            [1, [0]],
        ]);
        expect(findScreenShowRefusal(0, [5], edges)).toBeNull();
    });
});
