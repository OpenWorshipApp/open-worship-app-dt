import { describe, expect, it } from 'vitest';

import {
    checkHasStudyRefNumbers,
    listStudyBookNamePairs,
    listStudyBookNameSlips,
    repairStudyBookNames,
    toStudyBookNameTable,
    toStudyBookNamesText,
    type StudyBookNameTableType,
} from './studyBookNameHelpers';
import {
    genStudyBookNames,
    type StudyBookNamesType,
} from './studyVerseCheckHelpers';

// EC-534: a translated study's references named as the language's Bible
// names them. What `owa_bible_suggest books` answers, cut to six books: two
// Bibles of a made-up language naming Numbers each its own way; a second
// language, as the French Bibles named Titus in the user's Khmer study; one
// written without spaces; and one naming its books in English though its
// language is not.
const BOOKS_ANSWER = {
    kind: 'books',
    bookKeys: ['GEN', 'NUM', 'EZK', 'JHN', 'TIT', '1PE'],
    english: ['Genesis', 'Numbers', 'Ezekiel', 'John', 'Titus', '1 Peter'],
    bibles: [
        {
            keys: ['KJV'],
            locale: 'en',
            books: [
                'Genesis',
                'Numbers',
                'Ezekiel',
                'John',
                'Titus',
                '1 Peter',
            ],
        },
        {
            keys: ['XXB'],
            locale: 'xx',
            books: ['Xgen', 'Xnum', 'Xezk', 'Xjohn', 'Xtit', ''],
        },
        {
            keys: ['XXC'],
            locale: 'xx',
            books: ['Xgen', 'Xcount', 'Xezk', 'Xjohn', 'Xtit', '1 Xpet'],
        },
        {
            keys: ['ZZB'],
            locale: 'zz-ZZ',
            books: ['Zgen', 'Znum', 'Zezk', 'Zjohn', 'Ztit', '1 Zpet'],
        },
        {
            keys: ['YTB'],
            locale: 'yy-Thai',
            books: ['Qgen', 'Qnum', 'Qezk', 'Qjohn', 'Qtit', 'Qpet'],
        },
        {
            keys: ['QQB'],
            locale: 'qq',
            books: ['Genesis', 'Numbers', 'Ezekiel', 'John', 'Titus', 'Qqpet'],
        },
    ],
};

function genNames() {
    return genStudyBookNames(BOOKS_ANSWER) as StudyBookNamesType;
}

function genTable(key = 'XXB') {
    return toStudyBookNameTable(genNames(), key) as StudyBookNameTableType;
}

const CROSS_REFERENCES =
    '* **On rebirth**: Ezekiel 36:25-27, Titus 3:4-5, 1 Peter 1:23\n' +
    '* **On the serpent**: Numbers 21:8-9';

describe('toStudyBookNameTable', () => {
    it('is null with no names, no Bible, or a Bible no table has', () => {
        expect(toStudyBookNameTable(null, 'XXB')).toBeNull();
        expect(toStudyBookNameTable(genNames(), null)).toBeNull();
        expect(toStudyBookNameTable(genNames(), 'NONE')).toBeNull();
    });

    it('is the Bible its passages are quoted from, found in any case', () => {
        expect(genTable('xxb').bible).toEqual({
            key: 'XXB',
            lang: 'xx',
            books: BOOKS_ANSWER.bibles[1].books,
        });
        // An English Bible's names are English's own.
        expect(genTable('KJV').bible.lang).toBe('en');
    });

    it('is null for a Bible naming its books mostly in English in a language that is not', () => {
        expect(toStudyBookNameTable(genNames(), 'QQB')).toBeNull();
    });
});

describe('checkHasStudyRefNumbers', () => {
    it('reads a chapter and a verse in the words, never in what is kept', () => {
        expect(checkHasStudyRefNumbers('See Numbers 21:8.')).toBe(true);
        expect(checkHasStudyRefNumbers('Read John 3.16 aloud.')).toBe(true);
        expect(checkHasStudyRefNumbers('Part 2 of 4.')).toBe(false);
        // The draft names a token from the Bible; code is kept as it is.
        expect(checkHasStudyRefNumbers('Lifted up [^Numbers 21:9].')).toBe(
            false,
        );
        expect(checkHasStudyRefNumbers('Type `John 3:16` there.')).toBe(false);
        expect(checkHasStudyRefNumbers('[the verse](https://x.y/3:16)')).toBe(
            false,
        );
    });
});

describe('listStudyBookNamePairs and toStudyBookNamesText', () => {
    it("names each book the words cite as they write it, beside the Bible's name, once", () => {
        expect(
            listStudyBookNamePairs(
                `${CROSS_REFERENCES}\nAgain Titus 3:5; 3:7, and Num. 21:9.`,
                genTable(),
            ),
        ).toEqual([
            ['Ezekiel', 'Xezk'],
            ['Titus', 'Xtit'],
            // XXB has no name for 1 Peter: nothing to tell.
            ['Numbers', 'Xnum'],
        ]);
        // Written short, as written.
        expect(listStudyBookNamePairs('See Num. 21:9.', genTable())).toEqual([
            ['Num.', 'Xnum'],
        ]);
    });

    it('names nothing written as the Bible writes it, nor with no table', () => {
        expect(listStudyBookNamePairs('See Xnum 21:9.', genTable())).toEqual(
            [],
        );
        expect(listStudyBookNamePairs(CROSS_REFERENCES, null)).toEqual([]);
        expect(toStudyBookNamesText('No verse.', genTable(), 'Xish')).toBe('');
    });

    it('tells the translator the names, and asked again the references its answer named another way', () => {
        expect(
            toStudyBookNamesText(
                'Lifted up: Numbers 21:8-9.',
                genTable(),
                'Xish',
            ),
        ).toBe(
            ' Write each book of the Bible as the Xish Bible names it: ' +
                'Numbers = Xnum.',
        );
        expect(
            toStudyBookNamesText(
                'Lifted up: Numbers 21:8-9.',
                genTable(),
                'Xish',
                [{ written: 'Numbo 21:8-9', english: 'Numbers', name: 'Xnum' }],
            ),
        ).toBe(
            ' Write each book of the Bible as the Xish Bible names it: ' +
                'Numbers = Xnum. Your last translation named these books ' +
                'another way: "Numbo 21:8-9" (Numbers = Xnum); write each ' +
                'as the Xish Bible names it.',
        );
    });
});

describe('repairStudyBookNames', () => {
    it("writes a book named as another language, or the English names, name it with the Bible's name", () => {
        const translated =
            '* **Ono rebirtho**: Zezk 36:25-27, Titus 3:4-5, 1 Zpet 1:23\n' +
            '* **Ono the serpento**: Znum 21:8-9';
        const repaired = repairStudyBookNames(
            CROSS_REFERENCES,
            translated,
            genTable(),
        );
        expect(repaired.text).toBe(
            '* **Ono rebirtho**: Xezk 36:25-27, Xtit 3:4-5, 1 Zpet 1:23\n' +
                '* **Ono the serpento**: Xnum 21:8-9',
        );
        // 1 Peter has no name in XXB to write: it stays.
        expect(repaired.count).toBe(3);
    });

    it('writes a name written short as the Bible never writes it, and keeps a short form of its own', () => {
        expect(
            repairStudyBookNames(
                'See Titus 3:5 and Numbers 21:9.',
                'Seeo Tit. 3:5 ando Xnu 21:9.',
                genTable(),
            ).text,
        ).toBe('Seeo Xtit 3:5 ando Xnu 21:9.');
    });

    it("writes a book the words cite short or by its key with the Bible's name", () => {
        // EC-576: `Jn` and `Ezk` were read on neither side.
        const source = 'Born again: Jn 3:3 and Ezk 36:26.';
        expect(listStudyBookNamePairs(source, genTable())).toEqual([
            ['Jn', 'Xjohn'],
            ['Ezk', 'Xezk'],
        ]);
        expect(
            repairStudyBookNames(
                source,
                'Borno againo: Jn 3:3 ando Ezekiel 36:26.',
                genTable(),
            ),
        ).toEqual({
            text: 'Borno againo: Xjohn 3:3 ando Xezk 36:26.',
            count: 2,
        });
    });

    it("keeps the Bible's name, another Bible's of the same language, and what the words never cite", () => {
        const kept = 'Xezk 36:25-27, Xtit 3:4-5, Xcount 21:8-9, Ztit 2:11';
        expect(
            repairStudyBookNames(
                `${CROSS_REFERENCES}, Genesis 1:1`,
                kept,
                genTable(),
            ),
        ).toEqual({ text: kept, count: 0 });
        expect(repairStudyBookNames(CROSS_REFERENCES, kept, null).count).toBe(
            0,
        );
    });

    it('never names a book inside code, a link address or a token', () => {
        const kept =
            'Typeo `Titus 3:4-5`, [^Titus 3:4-5], [verse](https://x.y/Titus 3:4-5)';
        expect(repairStudyBookNames('Titus 3:4-5', kept, genTable()).text).toBe(
            kept,
        );
    });

    it('writes the name of a reference that goes on after it once', () => {
        expect(
            repairStudyBookNames('Titus 3:4; 3:7', 'Ztit 3:4; 3:7', genTable())
                .text,
        ).toBe('Xtit 3:4; 3:7');
    });

    it('writes into a language written without spaces, where a name may end a run of letters', () => {
        expect(
            repairStudyBookNames(
                'Titus 3:4-5 and John 3:16',
                'Ztit 3:4-5 andoQjohn 3:16',
                genTable('YTB'),
            ).text,
        ).toBe('Qtit 3:4-5 andoQjohn 3:16');
    });
});

describe('listStudyBookNameSlips', () => {
    it('names a reference named as no Bible names a book, once, with the book the words cite', () => {
        const slips = listStudyBookNameSlips(
            CROSS_REFERENCES,
            'Xezk 36:25-27, Xtit 3:4-5\nNumbo 21:8-9, and again Numbo 21:8-9',
            genTable(),
        );
        expect(slips).toEqual([
            { written: 'Numbo 21:8-9', english: 'Numbers', name: 'Xnum' },
        ]);
    });

    it("names one given another book's name", () => {
        expect(
            listStudyBookNameSlips(
                'Numbers 21:8-9',
                'Xjohn 21:8-9',
                genTable(),
            ),
        ).toEqual([
            { written: 'Xjohn 21:8-9', english: 'Numbers', name: 'Xnum' },
        ]);
    });

    it('names nothing written right, nothing the words never cite, nothing with no table', () => {
        expect(
            listStudyBookNameSlips(
                CROSS_REFERENCES,
                'Xezk 36:25-27, Xtit 3:4-5, Xcount 21:8-9; Timo 4:30',
                genTable(),
            ),
        ).toEqual([]);
        expect(
            listStudyBookNameSlips('Numbers 21:8', 'Numbo 21:8', null),
        ).toEqual([]);
        expect(
            listStudyBookNameSlips('No verse here.', 'Numbo 21:8', genTable()),
        ).toEqual([]);
    });

    it('names eight at most', () => {
        const source = Array.from({ length: 10 }, (_one, index) => {
            return `Numbers ${index + 1}:1`;
        }).join('\n');
        const translated = source.replace(/Numbers/g, 'Numbo');
        expect(
            listStudyBookNameSlips(source, translated, genTable()),
        ).toHaveLength(8);
    });
});
