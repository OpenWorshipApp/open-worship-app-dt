import { describe, expect, it } from 'vitest';

import {
    countLetterRuns,
    countLetters,
    listOftenUnwrittenLetters,
    measureLetterRunContainment,
    measureLetterRunLikeness,
} from './textLikenessHelpers';

// A letter with its accent typed as one, and as a base and a mark.
const MARKED = String.fromCodePoint(0xe9);
const BASE_AND_MARK = String.fromCodePoint(0x65, 0x301);

describe('how alike two texts are written (EC-547)', () => {
    it('counts the runs of three characters, a word edge a space', () => {
        expect(Object.fromEntries(countLetterRuns('Ab, ab!'))).toEqual({
            ' ab': 2,
            'ab ': 2,
            'b a': 1,
        });
        // Digits and signs are no letters: the words run on as one space.
        expect(countLetterRuns('ab 12 -- ab')).toEqual(
            countLetterRuns('ab ab'),
        );
        expect(countLetterRuns(`${BASE_AND_MARK}ab`)).toEqual(
            countLetterRuns(`${MARKED}ab`),
        );
        expect(countLetterRuns('').size).toBe(0);
        expect(countLetterRuns('-- 12 --').size).toBe(0);
    });

    it('measures how much of a phrase a longer text writes too (EC-575)', () => {
        const phrase = countLetterRuns('the night talk');
        const text = countLetterRuns(
            'a teacher came for the night talk at last',
        );
        expect(measureLetterRunContainment(phrase, text)).toBeCloseTo(1, 10);
        // The other way round, most of the longer text is not the phrase's.
        expect(measureLetterRunContainment(text, phrase)).toBeLessThan(0.5);
        expect(
            measureLetterRunContainment(phrase, countLetterRuns('zzz qqq')),
        ).toBe(0);
        // A run written once is counted once, however often the phrase has
        // it: of the five runs of `ab ab`, `ab` writes ` ab` and `ab ` once.
        expect(
            measureLetterRunContainment(
                countLetterRuns('ab ab'),
                countLetterRuns('ab'),
            ),
        ).toBeCloseTo(0.4, 10);
        expect(measureLetterRunContainment(new Map(), text)).toBe(0);
    });

    it('is 1 for two written alike and 0 for two with nothing in common', () => {
        const one = countLetterRuns('the night talk with a teacher');
        expect(measureLetterRunLikeness(one, one)).toBeCloseTo(1, 10);
        expect(
            measureLetterRunLikeness(
                one,
                countLetterRuns('a teacher with the night talk'),
            ),
        ).toBeGreaterThan(0.6);
        expect(measureLetterRunLikeness(one, countLetterRuns('zzz qqq'))).toBe(
            0,
        );
        expect(measureLetterRunLikeness(one, new Map())).toBe(0);
        expect(measureLetterRunLikeness(new Map(), one)).toBe(0);
        // Either way round.
        const other = countLetterRuns('a night with the teacher');
        expect(measureLetterRunLikeness(one, other)).toBeCloseTo(
            measureLetterRunLikeness(other, one),
            10,
        );
    });

    it('counts the letters in lower case, a mark and its base one letter', () => {
        expect(Object.fromEntries(countLetters('Aab 1!'))).toEqual({
            a: 2,
            b: 1,
        });
        expect(Object.fromEntries(countLetters(`${BASE_AND_MARK}e`))).toEqual({
            [MARKED]: 1,
            e: 1,
        });
    });

    it('names a letter written often that the other text never writes', () => {
        const written = countLetters('the night talk with a teacher');
        expect(
            listOftenUnwrittenLetters(countLetters('the bright quiz'), written),
        ).toEqual([]);
        // Written twice: one of its own.
        expect(
            listOftenUnwrittenLetters(countLetters('the buzz quiz'), written),
        ).toEqual(['u', 'z']);
        // Once is a name's.
        expect(
            listOftenUnwrittenLetters(
                countLetters('the night of Zeb'),
                written,
            ),
        ).toEqual([]);
        // Once in two hundred letters at least: one in a long text is not.
        const long = `${'the night talk '.repeat(40)}zz`;
        expect(listOftenUnwrittenLetters(countLetters(long), written)).toEqual(
            [],
        );
        expect(
            listOftenUnwrittenLetters(
                countLetters(`${'the night talk '.repeat(40)}${'z'.repeat(3)}`),
                written,
            ),
        ).toEqual(['z']);
        expect(listOftenUnwrittenLetters(new Map(), written)).toEqual([]);
    });
});
