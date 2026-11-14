import { describe, expect, it } from 'vitest';

import kjvBibleConfig from './bible-helpers/kjvBibleConfig.json';
import { resolveBookFilter, resolveBookKey } from './bibleVerseFindHelpers';

// EC-151: a book written the usual short way -- the SBL Handbook's forms
// and the two-letter ones -- is read once a Bible's own names leave it
// unread. The names are the app's own KJV names, the ones the loose
// reference reader (`parseLooseReference`) and the verse finder hand in
// after a Bible's own.
const KJV_NAMES: Record<string, string> = kjvBibleConfig.keyBookMap;
const NAME_MAP_LIST = [KJV_NAMES];

function readBook(name: string) {
    return resolveBookKey(name, NAME_MAP_LIST);
}

function listMisread(formList: [string, string | null][]) {
    return formList
        .filter(([form, key]) => {
            return readBook(form) !== key;
        })
        .map(([form, key]) => {
            return `${form} -> ${readBook(form)} (want ${key})`;
        });
}

describe('a book written the usual short way (EC-151)', () => {
    it('reads every short form to its one book', () => {
        expect(
            listMisread([
                ['Gn', 'GEN'],
                ['Ex', 'EXO'],
                ['Lv', 'LEV'],
                ['Nm', 'NUM'],
                ['Dt', 'DEU'],
                ['Jg', 'JDG'],
                ['Jgs', 'JDG'],
                ['Ru', 'RUT'],
                ['Rt', 'RUT'],
                ['1 Sm', '1SA'],
                ['2 Sm', '2SA'],
                ['1 Kgs', '1KI'],
                ['2 Kgs', '2KI'],
                ['Ne', 'NEH'],
                ['Jb', 'JOB'],
                ['Ps', 'PSA'],
                ['Pss', 'PSA'],
                ['Pr', 'PRO'],
                ['Prv', 'PRO'],
                ['Qoh', 'ECC'],
                ['Song of Songs', 'SNG'],
                ['Canticles', 'SNG'],
                ['Cant', 'SNG'],
                ['Sg', 'SNG'],
                ['Is', 'ISA'],
                ['Jr', 'JER'],
                ['Lm', 'LAM'],
                ['Da', 'DAN'],
                ['Dn', 'DAN'],
                ['Ho', 'HOS'],
                ['Jl', 'JOL'],
                ['Am', 'AMO'],
                ['Ob', 'OBA'],
                ['Mi', 'MIC'],
                ['Na', 'NAM'],
                ['Hg', 'HAG'],
                ['Zp', 'ZEP'],
                ['Zc', 'ZEC'],
                ['Ml', 'MAL'],
                ['Mt', 'MAT'],
                ['Mk', 'MRK'],
                ['Mr', 'MRK'],
                ['Lk', 'LUK'],
                ['Lu', 'LUK'],
                ['Jn', 'JHN'],
                ['Ac', 'ACT'],
                ['Ro', 'ROM'],
                ['Rm', 'ROM'],
                ['Ga', 'GAL'],
                ['Ep', 'EPH'],
                ['Phil', 'PHP'],
                ['Phlp', 'PHP'],
                ['Cl', 'COL'],
                ['1 Tm', '1TI'],
                ['2 Tm', '2TI'],
                ['Ti', 'TIT'],
                ['Phlm', 'PHM'],
                ['Jas', 'JAS'],
                ['Jm', 'JAS'],
                ['1 Pt', '1PE'],
                ['2 Pt', '2PE'],
                ['1 Jn', '1JN'],
                ['2 Jn', '2JN'],
                ['3 Jn', '3JN'],
                ['Jd', 'JUD'],
                ['Rv', 'REV'],
                ['Re', 'REV'],
            ]),
        ).toEqual([]);
    });

    it('reads one with a stop, with no space after its number, in small letters', () => {
        expect(
            listMisread([
                ['Ps.', 'PSA'],
                ['Jn.', 'JHN'],
                ['Phil.', 'PHP'],
                ['1 Jn.', '1JN'],
                ['1Jn', '1JN'],
                ['1Kgs', '1KI'],
                ['jn', 'JHN'],
                ['ps', 'PSA'],
            ]),
        ).toEqual([]);
    });

    it('reads a book’s number in Roman numerals as its digit', () => {
        expect(
            listMisread([
                ['I Cor', '1CO'],
                ['II Tim', '2TI'],
                ['III Jn', '3JN'],
                ['I Sm', '1SA'],
                ['ii kings', '2KI'],
                ['I John', '1JN'],
                // No numbered book of that name, and no fourth of any.
                ['I Mark', null],
                ['IV Kings', null],
            ]),
        ).toEqual([]);
    });

    it('reads the names it read before as it read them', () => {
        expect(
            listMisread([
                ['Gen', 'GEN'],
                ['Exod', 'EXO'],
                ['1 Sam', '1SA'],
                ['1 Kings', '1KI'],
                ['Eccl', 'ECC'],
                ['Ezek', 'EZK'],
                ['Zeph', 'ZEP'],
                ['Matt.', 'MAT'],
                ['Philem', 'PHM'],
                ['Philemon', 'PHM'],
                ['Philippians', 'PHP'],
                ['Psalms', 'PSA'],
                ['Heb', 'HEB'],
                ['Rev', 'REV'],
                ['JHN', 'JHN'],
            ]),
        ).toEqual([]);
    });

    it('guesses no book a short form two books share', () => {
        expect(
            listMisread([
                ['Hb', null],
                ['Jo', null],
                ['Ju', null],
                ['Ph', null],
                ['Ez', null],
                ['Phi', null],
            ]),
        ).toEqual([]);
    });

    it('reads a short form that is an everyday word only with its capital', () => {
        // The "is" of "the service is 10:30" in an answer stays a word.
        expect(
            listMisread([
                ['is', null],
                ['am', null],
                ['ex', null],
                ['re', null],
                ['Is', 'ISA'],
                ['Am', 'AMO'],
                ['Ex', 'EXO'],
                ['Re', 'REV'],
            ]),
        ).toEqual([]);
    });

    it('leaves a Bible’s own names first, and reads only a book they have', () => {
        // A Bible whose own name for a book is a short form keeps it, and so
        // does one whose own name only one book starts with.
        expect(resolveBookKey('Pr', [{ ECC: 'Pr' }, KJV_NAMES])).toBe('ECC');
        expect(resolveBookKey('Prv', [{ JOB: 'Prvquel' }, KJV_NAMES])).toBe(
            'JOB',
        );
        // A book named otherwise by the Bible is read by its short form; a
        // book the names do not have is no book.
        expect(resolveBookKey('Jn', [{ JHN: 'Quellon' }])).toBe('JHN');
        expect(resolveBookKey('Ps', [{ JHN: 'Quellon' }])).toBeNull();
    });

    it('narrows a search to books written short', () => {
        expect(
            resolveBookFilter('Mt, Mk, Lk and Jn; Hb', NAME_MAP_LIST),
        ).toEqual({
            bookKeys: ['MAT', 'MRK', 'LUK', 'JHN'],
            unknown: ['Hb'],
        });
    });
});
