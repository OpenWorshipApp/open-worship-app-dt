import { beforeEach, describe, expect, test, vi } from 'vitest';

// EC-622: a passage typed in a language other than English, read with no
// model by what the line holds. What a line is typed in, and whether it is
// a how-to or another subject, is the screen asks' reading
// (`readTypedLineSubject`), stubbed here so the gate's own rules are what
// is under test.
const readTypedLineSubject = vi.fn(
    (
        ..._args: any[]
    ): {
        typedCode: string | null;
        isHowTo: boolean;
        isOtherSubject: boolean;
    } => {
        return { typedCode: 'xx', isHowTo: false, isOtherSubject: false };
    },
);
vi.mock('./typedScreenAskHelpers', () => {
    return {
        readTypedLineSubject: (...args: any[]) => {
            return readTypedLineSubject(...args);
        },
    };
});

import {
    genStudyBookNames,
    type StudyBookNamesType,
} from './studyVerseCheckHelpers';
import {
    checkHasBibleInLanguage,
    checkIsVerseRowFree,
    readTypedVerseLine,
    readTypedVerseRef,
} from './typedVerseAskHelpers';

// What `owa_bible_suggest books` answers, cut to five books: English, a
// made-up language written with spaces, and one in a script written
// without them, whose names may end a run of letters.
const BOOKS_ANSWER = {
    kind: 'books',
    bookKeys: ['GEN', 'PSA', 'JHN', 'ROM', '1JN'],
    english: ['Genesis', 'Psalms', 'John', 'Romans', '1 John'],
    bibles: [
        {
            keys: ['KJV'],
            locale: 'en',
            books: ['Genesis', 'Psalm', 'John', 'Romans', '1 John'],
        },
        {
            keys: ['XXB'],
            locale: 'xx',
            books: ['Xgen', 'Xpsa', 'Xjohn', 'Xrom', '1 Xjohn'],
        },
        {
            keys: ['YTB'],
            locale: 'yy-Thai',
            books: ['Qgen', 'Qpsa', 'Qjohn', 'Qrom', 'Qfirst'],
        },
    ],
};

const names = genStudyBookNames(BOOKS_ANSWER) as StudyBookNamesType;

beforeEach(() => {
    readTypedLineSubject.mockClear();
});

describe('a line that may ask for a passage', () => {
    test('is read in the language it is typed in', () => {
        expect(readTypedVerseLine('zorp Xjohn 3:16', 'xx')).toEqual({
            typedCode: 'xx',
        });
        expect(readTypedLineSubject).toHaveBeenCalledWith(
            'zorp Xjohn 3:16',
            'xx',
        );
    });

    test('is read with its joiners out and its spaces as one', () => {
        readTypedVerseLine('  zorp​  Xjohn\t3:16 ', 'xx');
        expect(readTypedLineSubject).toHaveBeenCalledWith(
            'zorp Xjohn 3:16',
            'xx',
        );
    });

    test('says when its words cannot tell the language', () => {
        readTypedLineSubject.mockReturnValueOnce({
            typedCode: null,
            isHowTo: false,
            isOtherSubject: false,
        });
        expect(readTypedVerseLine('Xjohn 3:16', 'xx')).toEqual({
            typedCode: null,
        });
    });

    test.each([
        ['nothing', ''],
        ['no number in it', 'zorp Xjohn blip'],
        ['a command', '/verse Xjohn 3:16'],
        ['too long to be one', `${'zorp '.repeat(61)}Xjohn 3:16`],
    ])('is not %s', (_what, line) => {
        expect(readTypedVerseLine(line, 'xx')).toBeNull();
        expect(readTypedLineSubject).not.toHaveBeenCalled();
    });

    test.each([
        ['typed in English', { typedCode: 'en' }],
        ['a how-to', { isHowTo: true }],
        ['another subject', { isOtherSubject: true }],
    ])('is not one %s', (_what, read) => {
        readTypedLineSubject.mockReturnValueOnce({
            typedCode: 'xx',
            isHowTo: false,
            isOtherSubject: false,
            ...read,
        });
        expect(readTypedVerseLine('zorp Xjohn 3:16', 'xx')).toBeNull();
    });
});

describe('the passage a typed line names', () => {
    test.each([
        ['zorp Xjohn 3:16 blip', 'Xjohn 3:16'],
        // A whole name in any case beside a verse.
        ['zorp xjohn 3:16', 'xjohn 3:16'],
        // A verse after a comma or a dot, as much of the world writes one.
        ['zorp Xjohn 3,16 blip', 'Xjohn 3:16'],
        ['zorp Xjohn 3.16', 'Xjohn 3:16'],
        ['zorp Xjohn 3 : 16', 'Xjohn 3:16'],
        // A space alone, as the app's own parser reads it.
        ['zorp Xjohn 3 16 blip', 'Xjohn 3:16'],
        ['zorp Xjohn 3:16-18 blip', 'Xjohn 3:16-18'],
        ['zorp Xjohn 3:16 - 18', 'Xjohn 3:16-18'],
        // A range on into the next chapter is not taken.
        ['zorp Xjohn 3:16-4:2', 'Xjohn 3:16'],
        // The book's number is its name's, never a chapter of its own.
        ['zorp 1 Xjohn 1:9', '1 Xjohn 1:9'],
        // A chapter alone, beside a name written with its capital.
        ['zorp Xpsa 23 blip', 'Xpsa 23'],
        // In a script without spaces, the name that ends the run.
        ['zorpQjohn 3:16', 'Qjohn 3:16'],
        // English names, as every app has them.
        ['zorp John 3:16', 'John 3:16'],
        // A prefix glued to a name's capital is no part of it.
        ['zorp uXjohn 3:16', 'Xjohn 3:16'],
    ])('%s', (line, reference) => {
        expect(readTypedVerseRef(line, names)).toEqual({
            reference,
            isBookNamed: true,
        });
    });

    test.each([
        ['zorp Blarg 3:16 blip', 'Blarg 3:16'],
        ['zorp uBlarg 3:16', 'Blarg 3:16'],
        ['zorp Bla-rg 8:28', 'Bla-rg 8:28'],
    ])('%s names a book no Bible gives', (line, reference) => {
        expect(readTypedVerseRef(line, names)).toEqual({
            reference,
            isBookNamed: false,
        });
    });

    test('a name a Bible gives comes before one no Bible gives', () => {
        expect(readTypedVerseRef('Blarg 3:16 blip Xjohn 3:16', names)).toEqual({
            reference: 'Xjohn 3:16',
            isBookNamed: true,
        });
    });

    test.each([
        // A word no Bible gives, in lower case or beside a verse also
        // written as a number.
        'zorp blarg 3:16',
        'zorp Blarg 3,16',
        'zorp Blarg 3.16',
        'zorp Blarg 3 16',
        'zorp Blarg 3 : 16',
        // A chapter alone needs a name, written with its capital.
        'zorp Blarg 23',
        'zorp xpsa 23',
        // A time, and numbers no chapter or verse reaches.
        'zorp Blarg 10:30 am',
        'zorp Blarg 6:45 pm',
        'zorp Blarg 200:1',
        'zorp Xjohn 3:200',
        // No name before it, or a sign between.
        'zorp 3:16',
        'Xjohn; zorp 3:16',
        'nothing here',
    ])('%s names none', (line) => {
        expect(readTypedVerseRef(line, names)).toBeNull();
    });
});

describe('the Bibles a line is checked against', () => {
    test('say whether one is in the language it is typed in', () => {
        expect(checkHasBibleInLanguage(names, 'xx')).toBe(true);
        expect(checkHasBibleInLanguage(names, 'yy')).toBe(true);
        expect(checkHasBibleInLanguage(names, 'zz')).toBe(false);
        expect(checkHasBibleInLanguage(names, null)).toBe(false);
    });
});

describe('a supported question the line is', () => {
    test('leaves it to the verse reader only when it asks for a passage', () => {
        expect(checkIsVerseRowFree(null)).toBe(true);
        expect(
            checkIsVerseRowFree({
                resources: { tools: ['owa_present_bible', 'owa_list_screens'] },
            }),
        ).toBe(true);
        expect(
            checkIsVerseRowFree({ resources: { tools: ['owa_bible_item'] } }),
        ).toBe(false);
        expect(checkIsVerseRowFree({})).toBe(false);
    });
});
