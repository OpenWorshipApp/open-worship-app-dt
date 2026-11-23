import { describe, expect, test } from 'vitest';

import {
    findSlidesSaying,
    readSlideValue,
    toSlideWordsKey,
} from './officeSlideNameHelpers';

const SLIDES = [
    { number: 1, text: 'Welcome\nSunday Service' },
    { number: 2, text: 'Prayers of the People' },
    { number: 3, text: 'Offering\nThank you' },
    { number: 4, text: 'Announcements\nPrayer meeting Wednesday' },
];

describe('a slide named by its words (EC-774)', () => {
    test('a number, digits and words are told apart', () => {
        expect(readSlideValue(undefined)).toEqual({ kind: 'none' });
        expect(readSlideValue(3)).toEqual({ kind: 'number', number: 3 });
        expect(readSlideValue(' 12 ')).toEqual({ kind: 'number', number: 12 });
        expect(readSlideValue('offering')).toEqual({
            kind: 'words',
            words: 'offering',
        });
        expect(readSlideValue('!!!')).toEqual({ kind: 'bad' });
        expect(readSlideValue('x'.repeat(121))).toEqual({ kind: 'bad' });
        expect(readSlideValue({ slide: 1 })).toEqual({ kind: 'bad' });
    });

    test('words match in any case, marks and spacing aside', () => {
        expect(toSlideWordsKey('  Thank-you!  ')).toBe('thank you');
        expect(findSlidesSaying(SLIDES, 'OFFERING')).toEqual([3]);
        expect(findSlidesSaying(SLIDES, 'thank you')).toEqual([3]);
        expect(findSlidesSaying(SLIDES, 'sunday   service')).toEqual([1]);
    });

    test('none and several are said, never one guessed', () => {
        expect(findSlidesSaying(SLIDES, 'benediction')).toEqual([]);
        expect(findSlidesSaying(SLIDES, 'prayer')).toEqual([2, 4]);
        expect(findSlidesSaying(SLIDES, '')).toEqual([]);
    });
});
