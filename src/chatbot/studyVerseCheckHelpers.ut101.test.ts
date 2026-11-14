import { describe, expect, it } from 'vitest';

import {
    collectStudyVerseRefs,
    genStudyBookNames,
    toStudyVerseReadText,
    type StudyBookNamesType,
} from './studyVerseCheckHelpers';

// EC-497, the corners the first suite leaves: a Bible that lacks a book, a
// passage quoted under a heading with no chapter, and a name run so long it
// is cut before it is listed. Every language here is made up (`xl`).
const ENGLISH = [
    'Genesis',
    'Numbers',
    'Psalms',
    'John',
    'Romans',
    '1 Thessalonians',
];

function genNames(books: string[]) {
    return genStudyBookNames({
        kind: 'books',
        bookKeys: ['GEN', 'NUM', 'PSA', 'JHN', 'ROM', '1TH'],
        english: ENGLISH,
        bibles: [
            { keys: ['KJV'], locale: 'en', books: ENGLISH },
            { keys: ['XLB'], locale: 'xl', books },
        ],
    }) as StudyBookNamesType;
}

// The Bible of the made-up language has no book of Numbers.
const XL_BOOKS = ['Lgen', '', 'Lpsa', 'Ljohn', 'Lrom', '1 Lthess'];

describe('genStudyBookNames', () => {
    it('leaves a book a Bible does not have out of the table, and keeps the Bible', () => {
        const names = genNames(XL_BOOKS);
        expect(names.nameMap.get('lgen')?.index).toBe(0);
        expect(names.nameMap.has('')).toBe(false);
        // Numbers is still found by its English name, written by English
        // and the KJV alone.
        expect(names.nameMap.get('numbers')).toEqual({
            index: 1,
            langs: ['en'],
            sources: [{ key: 'KJV', locale: 'en' }],
            isSpaced: true,
        });
        expect(names.bibleMap.get('XLB')?.books).toEqual(XL_BOOKS);
    });
});

describe('toStudyVerseReadText', () => {
    it('lists a part’s Bible’s names beside the English, skipping a book it lacks', () => {
        const names = genNames(XL_BOOKS);
        const check = collectStudyVerseRefs(
            [
                '> **Ljohn 3:16** (XLB)',
                '> 16 Words of the verse.',
                '',
                'As Romans 5:8 says.',
            ].join('\n'),
            names,
        );
        // Named the English way in a part quoting XLB: said so.
        expect(check.lines[0].items).toEqual([
            {
                kind: 'ref',
                written: 'Romans 5:8',
                refIndex: 0,
                nameNote: {
                    name: 'Romans',
                    isEnglish: true,
                    sources: [{ key: 'KJV', locale: 'en' }],
                    ownName: 'Lrom',
                },
            },
        ]);
        const text = toStudyVerseReadText(check, [
            {
                call: { bible: 'XLB', isInstalled: true, refs: ['Romans 5:8'] },
                result: {
                    bible: 'XLB',
                    verses: [{ key: 'ROM 5:8', text: 'Lrom words.' }],
                },
            },
        ]) as string;
        expect(text).toContain(
            '- "Romans 5:8": "Romans" is the English name of the book; XLB ' +
                'names it "Lrom". XLB reads: "Lrom words."',
        );
        expect(text).toContain(
            'XLB names the books: Genesis = Lgen; Psalms = Lpsa; John = ' +
                'Ljohn; Romans = Lrom; 1 Thessalonians = 1 Lthess.',
        );
        expect(text).not.toContain('Numbers =');
    });
});

describe('collectStudyVerseRefs', () => {
    it('reads every reference after a passage whose heading names no chapter', () => {
        const names = genNames(XL_BOOKS);
        const check = collectStudyVerseRefs(
            [
                '> **Psalms** (KJV)',
                '> 1 Blessed is the man.',
                '',
                'Psalms 1:1 and Psalms 23:1.',
            ].join('\n'),
            names,
        );
        // With no span to hold them to, neither is taken for a verse the
        // study already quotes.
        expect(
            check.refs.map((one) => {
                return one.ref;
            }),
        ).toEqual(['Psalms 1:1', 'Psalms 23:1']);
        expect(check.passages).toEqual([
            { bible: 'KJV', title: 'Psalms', count: 0 },
        ]);
    });

    it('lists a name no Bible gives by its last thirty letters when it runs longer', () => {
        // The longest name (1 Thessalonians) lets the words looked at before
        // a reference run past thirty letters.
        const names = genNames(XL_BOOKS);
        expect(names.maxLength).toBe('1thessalonians'.length);
        const tail = 'Xqvirbookofthelongnamesxqvirzz';
        expect(tail).toHaveLength(30);
        const check = collectStudyVerseRefs(
            `See abcdefghij${tail} 3:16 for it.`,
            names,
        );
        expect(check.refs).toEqual([]);
        expect(check.lines).toEqual([
            {
                text: `See abcdefghij${tail} 3:16 for it.`,
                heading: '',
                bible: null,
                items: [
                    {
                        kind: 'unknown',
                        written: `${tail} 3:16`,
                        word: tail,
                    },
                ],
            },
        ]);
        // A cut that starts inside a word in lower case reads as no name.
        const lower = collectStudyVerseRefs(
            `See abcdefghij${tail.toLowerCase()} 3:16 for it.`,
            names,
        );
        expect(lower.lines).toEqual([]);
    });
});
