import { describe, expect, test } from 'vitest';

import {
    readBibleInputSuggestAskList,
    toBibleInputSuggestRows,
} from '../../../../../../chatbot/bibleInputSuggestHelpers';

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

    // 2026-11-13, EC-587: "pause it" typed in a Presenter tab loaded the
    // names dataset into the Presenter. A bare word off the Reader is a
    // command; a name asked about is still a name anywhere.
    test('a bare word off the Reader asks for no name', () => {
        for (const focus of ['presenter', 'editor', 'setting']) {
            for (const line of ['ផ្អាកវា', 'ម៉ូសេ', 'Moses']) {
                expect(
                    readBibleInputSuggestAskList(line, focus, false),
                ).toEqual([]);
            }
            expect(
                readBibleInputSuggestAskList('តើម៉ូសេជានរណា?', focus, false),
            ).toEqual([
                {
                    kind: 'name',
                    prefix: 'ម៉ូសេ',
                    allowLoad: true,
                    fillPrefix: '',
                },
            ]);
        }
    });

    // 2026-10-23: Khmer writes a sentence with no space, so a whole question
    // read as ONE bare name and loaded the names dataset to complete it.
    test('a Khmer question typed as one run is no name', () => {
        for (const question of [
            'តើមានខគម្ពីរណាផ្សេងទៀតដែលទាក់ទងនឹងបទគម្ពីរនេះ?',
            'តើបទគម្ពីរនេះបង្រៀនយើងអ្វីខ្លះអំពីព្រះ',
            'ព្រាបមានន័យអ្វី?',
            'តើណូអេនៅ',
        ]) {
            expect(
                readBibleInputSuggestAskList(question, 'reader', false).filter(
                    (ask) => ask.kind === 'name',
                ),
            ).toEqual([]);
        }
        // The names that start like a question are still names.
        for (const name of ['តើស៊ីស', 'សូមើរ', 'ម៉ាថូសាឡា']) {
            expect(
                readBibleInputSuggestAskList(name, 'reader', false),
            ).toContainEqual(
                expect.objectContaining({ kind: 'name', prefix: name }),
            );
        }
    });
});

describe('the rows under the box', () => {
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
