import { describe, expect, test } from 'vitest';

import {
    readTypedVerseContentAsk,
    readTypedVerseFindAsk,
} from './verseAskLanguageHelpers';

// The questions are the elder-persona run's own (2026-10-17), read with the
// Khmer package's real `assistant.json`: a test of the data as much as of
// the code.

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
