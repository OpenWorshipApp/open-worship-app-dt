import { describe, expect, test } from 'vitest';

import { readBibleReaderBookCandidate } from './bibleReaderChatHelpers';

// A number after a book's name that no chapter can be: 0, or past the
// longest book.

describe('a book name before a number that is no chapter', () => {
    test('is no candidate to look up', () => {
        expect(readBibleReaderBookCandidate('Genesis 0')).toBeNull();
        expect(readBibleReaderBookCandidate('Psalm 151')).toBeNull();
        // A number a chapter can be is one.
        expect(readBibleReaderBookCandidate('Psalm 150')?.bookTextList).toEqual(
            ['Psalm'],
        );
    });
});
