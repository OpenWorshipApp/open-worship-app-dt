import { describe, expect, test } from 'vitest';

import {
    checkIsBibleInOtherLanguage,
    pickBibleInLanguage,
    readTypedVerseContentAsk,
    readTypedVerseFindAsk,
    toBibleReaderAnswerLanguage,
} from './verseAskLanguageHelpers';

// The questions are the elder-persona run's own (2026-10-17), in English
// here; each language's own, read with its package's real `assistant.json`,
// are in that package's tests -- a test of the data as much as of the code.

describe('readTypedVerseFindAsk', () => {
    test('English is read as before', () => {
        expect(
            readTypedVerseFindAsk(
                'Help me find a Bible verse in "KJV": love your enemies',
            ),
        ).toEqual({ bibleKey: 'KJV', remembered: 'love your enemies' });
    });
});

describe('readTypedVerseContentAsk', () => {
    // The run's own how-do-I, panic and nonsense questions: none is a verse.
    test.each(['which verse says do not worry'])('%s is not', (asked) => {
        expect(readTypedVerseContentAsk(asked)).toBeNull();
    });
});

describe('pickBibleInLanguage', () => {
    const listed = {
        bible: 'XX1',
        bibles: [
            { key: 'XX1', locale: 'xx' },
            { key: 'KJV', locale: 'en' },
        ],
    };

    test('keeps the Lookup for English, unless English is asked for', () => {
        expect(pickBibleInLanguage(listed, 'XX1', 'en')).toBeNull();
        // A study file written in English (EC-464).
        expect(pickBibleInLanguage(listed, 'XX1', 'en', true)).toBe('KJV');
        expect(pickBibleInLanguage(listed, 'KJV', 'en', true)).toBeNull();
        expect(pickBibleInLanguage(listed, 'XX1', 'other', true)).toBeNull();
    });
});

// EC-495: an English question with the Lookup on a Bible of another
// language was explained in that language.
describe('a Bible in another language than the answer', () => {
    const listed = {
        bible: 'XX1',
        bibles: [
            { key: 'XX1', locale: 'xx-YY' },
            { key: 'KJV', locale: 'en-US' },
            { key: 'NONE' },
        ],
    };

    test('is told by its locale against the language, region aside', () => {
        expect(checkIsBibleInOtherLanguage(listed, 'XX1', 'en')).toBe(true);
        expect(checkIsBibleInOtherLanguage(listed, 'KJV', 'en')).toBe(false);
        expect(checkIsBibleInOtherLanguage(listed, 'XX1', 'xx')).toBe(false);
    });

    test('is never guessed: no Bible, no locale, no language', () => {
        expect(checkIsBibleInOtherLanguage(listed, null, 'en')).toBe(false);
        expect(checkIsBibleInOtherLanguage(listed, 'GONE', 'en')).toBe(false);
        expect(checkIsBibleInOtherLanguage(listed, 'NONE', 'en')).toBe(false);
        expect(checkIsBibleInOtherLanguage(listed, 'XX1', 'other')).toBe(false);
        expect(checkIsBibleInOtherLanguage(null, 'XX1', 'en')).toBe(false);
    });

    test('names the answer language for the Reader ask, only then', () => {
        expect(toBibleReaderAnswerLanguage(listed, 'XX1', 'en')).toBe(
            'English',
        );
        expect(toBibleReaderAnswerLanguage(listed, 'KJV', 'en')).toBeNull();
    });
});
