import { describe, expect, test } from 'vitest';

import {
    readBibleInputSuggestAskList,
    toBibleInputSuggestRows,
} from './bibleInputSuggestHelpers';

describe('what the input aid asks for', () => {
    test('nothing for a command or a question the aid cannot help', () => {
        expect(
            readBibleInputSuggestAskList('/screen', 'reader', false),
        ).toEqual([]);
        expect(
            readBibleInputSuggestAskList(
                'How do I change the font?',
                'reader',
                false,
            ),
        ).toEqual([]);
        expect(readBibleInputSuggestAskList('', 'reader', false)).toEqual([]);
    });
});

describe('the rows under the box', () => {
    test('are data, not labels, and keep the words in front of a name', () => {
        expect(
            toBibleInputSuggestRows(
                {
                    suggestions: [
                        {
                            label: 'Moses',
                            fill: 'Moses',
                            detail: 'Mosheh',
                        },
                    ],
                },
                'Who was ',
            ),
        ).toEqual([
            {
                id: 'input.0.Who was Moses',
                text: 'Moses',
                where: 'Mosheh',
                fill: 'Who was Moses',
                isImmediate: false,
                isData: true,
            },
        ]);
        expect(toBibleInputSuggestRows(null)).toEqual([]);
    });
});
