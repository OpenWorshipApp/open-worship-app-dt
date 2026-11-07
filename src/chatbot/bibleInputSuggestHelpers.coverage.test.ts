import { describe, expect, test } from 'vitest';

import { toBibleInputSuggestRows } from './bibleInputSuggestHelpers';

// The input aid's answer with rows it cannot draw: no words to show, or no
// words to fill the box with.

describe('a suggestion with no label or no fill', () => {
    test('is left out, and the rows that can be drawn are kept with their place', () => {
        const rows = toBibleInputSuggestRows({
            suggestions: [
                { fill: 'Genesis ' },
                null,
                // A symbol stands in for the book's name in another Bible.
                { label: 'John', fill: 'John ', detail: '✝ ☩' },
                { label: 'Jude' },
            ],
        });
        expect(rows).toEqual([
            {
                id: 'input.2.John ',
                text: 'John',
                where: '✝ ☩',
                fill: 'John ',
                isImmediate: false,
                isData: true,
            },
        ]);
    });
});
