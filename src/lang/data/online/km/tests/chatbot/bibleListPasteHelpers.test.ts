import { describe, expect, test } from 'vitest';

import kjvBibleConfig from '../../../../../../helper/bible-helpers/kjvBibleConfig.json';
import { readBibleListPaste } from '../../../../../../chatbot/bibleListPasteHelpers';
import {
    genStudyBookNames,
    type StudyBookNamesType,
} from '../../../../../../chatbot/studyVerseCheckHelpers';
import khmerBibleBooks from '../../bibleBooks.json';

// What `owa_bible_suggest books` answers with the KJV and the Khmer Bibles
// this package names installed.
const bookKeys = kjvBibleConfig.bookKeysOrder;
const english = bookKeys.map((key) => {
    return (kjvBibleConfig.keyBookMap as Record<string, string>)[key];
});
const NAMES = genStudyBookNames({
    kind: 'books',
    bookKeys,
    english,
    bibles: [
        { keys: ['KJV'], locale: 'en', books: english },
        ...khmerBibleBooks.map((one) => {
            return { keys: one.keys, locale: 'km', books: one.books };
        }),
    ],
}) as StudyBookNamesType;

function read(text: string) {
    return readBibleListPaste(text, NAMES, { installedKeys: ['KJV', 'ពគប'] });
}

describe('a messy list pasted in Khmer and English (EC-626)', () => {
    test("the user's own list", () => {
        expect(
            read(
                [
                    'Add these to my Bibles list:',
                    'John 3:15 (kjv)',
                    '    (ពគប) ម៉ាថាយ ៥:៣-៥',
                    '    GEN 1:2-',
                    'យ៉ូហាន 3 (niv)',
                ].join('\n'),
            ),
        ).toEqual({
            listName: null,
            isNewList: false,
            isListNamed: true,
            passages: [
                { written: 'John 3:15', reference: 'JHN 3:15', version: 'kjv' },
                {
                    written: 'ម៉ាថាយ ៥:៣-៥',
                    reference: 'MAT 5:3-5',
                    version: 'ពគប',
                },
                { written: 'យ៉ូហាន 3', reference: 'JHN 3', version: 'niv' },
            ],
            picks: [
                {
                    kind: 'range',
                    written: 'GEN 1:2-',
                    choices: [
                        {
                            label: 'GEN 1:2-',
                            reference: 'GEN 1:2-',
                            version: null,
                        },
                        {
                            label: 'GEN 1:2',
                            reference: 'GEN 1:2',
                            version: null,
                        },
                    ],
                },
            ],
            unreadable: [],
            overflow: [],
        });
    });

    test('a book in Khmer with no version is read in a Bible that names it so', () => {
        const read1 = read('Add ម៉ាថាយ ៥:៣ and ទំនុកដំកើង ២៣');
        expect(read1?.passages.map((one) => one.reference)).toEqual([
            'MAT 5:3',
            'PSA 23',
        ]);
        expect(
            read1?.passages.every((one) => {
                return khmerBibleBooks.some((bible) => {
                    return bible.keys.includes(one.version ?? '');
                });
            }),
        ).toBe(true);
    });

    test('a paragraph in Khmer, its request in English', () => {
        expect(
            read(
                'ថ្ងៃអាទិត្យមុន យើងបានអាន យ៉ូហាន ៣:១៦ និង រ៉ូម ៨:២៨។ ' +
                    'Save these to the Easter list.',
            ),
        ).toMatchObject({
            listName: 'Easter',
            passages: [{ reference: 'JHN 3:16' }, { reference: 'ROM 8:28' }],
        });
    });
});
