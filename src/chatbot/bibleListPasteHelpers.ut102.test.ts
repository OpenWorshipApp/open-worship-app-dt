import { describe, expect, test } from 'vitest';

import kjvBibleConfig from '../helper/bible-helpers/kjvBibleConfig.json';
import { readBibleListPaste } from './bibleListPasteHelpers';
import {
    genStudyBookNames,
    type StudyBookNamesType,
} from './studyVerseCheckHelpers';

// What `owa_bible_suggest books` answers on a machine with the KJV and a
// Bible of a made-up language, whose numbered books are named by their
// number and the English name with "Zz" in front ("1 ZzKings").
const bookKeys = kjvBibleConfig.bookKeysOrder;
const english = bookKeys.map((key) => {
    return (kjvBibleConfig.keyBookMap as Record<string, string>)[key];
});

function toMadeUpName(name: string, mark: string) {
    return name.replace(/^(\d) (.+)$/, `$1 ${mark}$2`);
}

function genNames(extraBibles: unknown[] = []) {
    return genStudyBookNames({
        kind: 'books',
        bookKeys,
        english,
        bibles: [
            { keys: ['KJV'], locale: 'en', books: english },
            {
                keys: ['XXB'],
                locale: 'xx',
                books: english.map((name) => {
                    return toMadeUpName(name, 'Zz');
                }),
            },
            ...extraBibles,
        ],
    }) as StudyBookNamesType;
}

const NAMES = genNames();

function read(text: string, names = NAMES) {
    return readBibleListPaste(text, names, { installedKeys: ['KJV', 'XXB'] });
}

describe('readBibleListPaste: versions', () => {
    test('a word in capitals in brackets is a version, installed or not', () => {
        expect(read('Add John 3:16 (NEWV) to my list')?.passages).toEqual([
            { written: 'John 3:16', reference: 'JHN 3:16', version: 'NEWV' },
        ]);
    });

    test('two versions on one line, each its own passage’s', () => {
        expect(
            read('Add John 3:16 KJV and Romans 5:8 NIV to my list')?.passages,
        ).toEqual([
            { written: 'John 3:16', reference: 'JHN 3:16', version: 'KJV' },
            { written: 'Romans 5:8', reference: 'ROM 5:8', version: 'NIV' },
        ]);
    });
});

describe('readBibleListPaste: passages no Bible holds', () => {
    test('a chapter range ending at a verse is said as unread, beside what is saved', () => {
        const pasted = read(
            [
                'Add these to my list:',
                '- John 3:16',
                '- Psalm 151',
                '- John 0:1',
                '- John 3:0',
                '- Psalm 119:177',
                '- see 2:4',
                '- Psalm 1-3:4',
            ].join('\n'),
        );
        // A chapter past the Psalms' 150, a chapter or verse 0 and a verse
        // past 176 are no passage to save; nor is a lower-case word.
        expect(pasted?.passages).toEqual([
            { written: 'John 3:16', reference: 'JHN 3:16', version: null },
        ]);
        expect(pasted?.picks).toEqual([]);
        expect(pasted?.unreadable).toContain('Psalm 1-3:4');
        expect(pasted?.unreadable).not.toContain('see 2:4');
    });
});

describe('readBibleListPaste: a book several could be', () => {
    test('offers each book as the Bible that names it so writes it', () => {
        expect(read('Add Zzkings 3:5 to my list')?.picks).toEqual([
            {
                kind: 'book',
                written: 'Zzkings 3:5',
                choices: [
                    {
                        label: '1 ZzKings 3:5',
                        reference: '1KI 3:5',
                        version: null,
                    },
                    {
                        label: '2 ZzKings 3:5',
                        reference: '2KI 3:5',
                        version: null,
                    },
                ],
            },
        ]);
    });

    test('offers the English name when no Bible of the table still writes it so', () => {
        // A Bible listed again under a key another took over: its names
        // are in the table, its books no longer.
        const names = genNames([
            {
                keys: ['YYB'],
                locale: 'yy',
                books: english.map((name) => {
                    return toMadeUpName(name, 'Qq');
                }),
            },
            { keys: ['YYB'], locale: 'yy', books: english },
        ]);
        expect(
            read('Add Qqkings 3:5 to my list', names)?.picks[0]?.choices,
        ).toEqual([
            { label: '1 Kings 3:5', reference: '1KI 3:5', version: null },
            { label: '2 Kings 3:5', reference: '2KI 3:5', version: null },
        ]);
    });
});
