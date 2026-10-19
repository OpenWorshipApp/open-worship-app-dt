import { describe, expect, test } from 'vitest';

import {
    readBibleInputSuggestAskList,
    toBibleInputSuggestRows,
} from './bibleInputSuggestHelpers';

describe('what the input aid asks for', () => {
    test('a passage being typed in the Reader', () => {
        expect(readBibleInputSuggestAskList('John 3', 'reader', false)).toEqual(
            [{ kind: 'reference', prefix: 'John 3' }],
        );
        expect(
            readBibleInputSuggestAskList('យ៉ូហាន ៣:', 'reader', false),
        ).toEqual([{ kind: 'reference', prefix: 'យ៉ូហាន ៣:' }]);
    });

    test('a passage under an answer that asked for another one -- digits too', () => {
        expect(readBibleInputSuggestAskList('១', 'reader', true)).toEqual([
            { kind: 'reference', prefix: '១' },
        ]);
        // The tab may be a Presenter one; the awaited passage is still one.
        expect(readBibleInputSuggestAskList('១', 'presenter', true)).toEqual([
            { kind: 'reference', prefix: '១' },
        ]);
    });

    test('a person or place, in English and in Khmer', () => {
        expect(
            readBibleInputSuggestAskList('Who was Moses', 'reader', false),
        ).toEqual([
            { kind: 'reference', prefix: 'Who was Moses' },
            {
                kind: 'name',
                prefix: 'Moses',
                allowLoad: true,
                fillPrefix: 'Who was ',
                useLatinFill: true,
            },
        ]);
        expect(
            readBibleInputSuggestAskList('តើម៉ូសេជានរណា?', 'reader', false),
        ).toEqual([
            {
                kind: 'name',
                prefix: 'ម៉ូសេ',
                allowLoad: true,
                fillPrefix: '',
            },
        ]);
    });

    test('a bare non-Latin name may load; a bare Latin word may not', () => {
        const khmer = readBibleInputSuggestAskList('ម៉ូសេ', 'reader', false);
        expect(khmer).toContainEqual({
            kind: 'name',
            prefix: 'ម៉ូសេ',
            allowLoad: true,
            useLatinFill: false,
        });
        const latin = readBibleInputSuggestAskList('Moses', 'reader', false);
        expect(latin).toContainEqual({
            kind: 'name',
            prefix: 'Moses',
            allowLoad: false,
            useLatinFill: true,
        });
    });

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

    test('an English question fills the KJV name, not the lookup script', () => {
        expect(
            toBibleInputSuggestRows(
                {
                    suggestions: [
                        {
                            label: 'ម៉ូសេ',
                            fill: 'ម៉ូសេ',
                            detail: 'Moses',
                        },
                    ],
                },
                'Who was ',
                true,
            )[0].fill,
        ).toBe('Who was Moses');
    });
});
