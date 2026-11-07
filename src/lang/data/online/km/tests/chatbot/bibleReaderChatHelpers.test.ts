// @vitest-environment jsdom
import { beforeAll, describe, expect, test } from 'vitest';

import {
    keepBibleReaderAskUnlessKnown,
    readBibleReaderAsk,
    readBibleReaderBookCandidate,
} from '../../../../../../chatbot/bibleReaderChatHelpers';

// The corpus is read in the language the window is SHOWN in, and the row the
// regression came from is translated. Load it as a Khmer window does, before
// anything reads the corpus (it is cached on first use).
beforeAll(() => {
    document.documentElement.lang = 'km';
});

describe('a typed Bible-Reader question', () => {
    test.each([
        // ...and as an elderly Khmer reader says them.
        ['បង្ហាញឯកសារធនធានរបស់យ៉ូហាន ជំពូក 3', { intent: 'resources' }],
        ['តើមានឈ្មោះអ្វីខ្លះក្នុងលោកុប្បត្តិ ជំពូក 4', { intent: 'names' }],
        ['បើកលោកុប្បត្តិ 3:203', { intent: 'reference' }],
        // Its zero-width spaces are Khmer keyboards' word breaks.
        ['បើក​លោកុប្បត្តិ 3:203', { intent: 'reference' }],
    ])('%s', (asked, expected) => {
        expect(readBibleReaderAsk(asked)).toEqual(expected);
    });

    test.each([
        ['តើឯកសារធនធាន MAT.18.pdf និយាយអំពីអ្វី?', { intent: 'resources' }],
    ])('a named Resources file: %s', (asked, expected) => {
        expect(readBibleReaderAsk(asked)).toEqual(expected);
    });

    test.each([
        // A chapter written WITHOUT the chapter word -- how a reader
        // actually says it. The window confirms the book name, so the
        // matcher stands in for the reader's own Bible here.
        ['សូមសង្ខេប ម៉ាថាយ ១៨', 'ម៉ាថាយ', { intent: 'reference' }],
        [
            'តើឈ្មោះអ្នកណាខ្លះនៅក្នុង លោកុប្បត្តិ ៤',
            'លោកុប្បត្តិ',
            { intent: 'names' },
        ],
        [
            'សូមបង្ហាញឯកសារធនធានសម្រាប់ យ៉ូហាន ៣',
            'យ៉ូហាន',
            { intent: 'resources' },
        ],
    ])('a bare book and number: %s', (asked, bookText, expected) => {
        const checkIsBook = (value: string) => value === bookText;
        expect(readBibleReaderAsk(asked, checkIsBook)).toEqual(expected);
    });

    test.each([
        // The words handed to the window's book check, shortest first.
        ['សូមសង្ខេប ម៉ាថាយ ១៨', 'ម៉ាថាយ'],
    ])('%s offers %s as a book candidate', (asked, bookText) => {
        expect(readBibleReaderBookCandidate(asked)?.bookTextList).toContain(
            bookText,
        );
    });

    test.each(['របៀបបើកលោកុប្បត្តិ 3:203', 'ដាក់យ៉ូហាន 3:16 លើអេក្រង់'])(
        '%s is not one',
        (asked) => {
            expect(readBibleReaderAsk(asked)).toBeNull();
        },
    );
});

// The Reader's own how-to row, W-11. Round 23's Khmer pass found the
// Bible-Reader ask taking it: the verse was opened and the answer never said
// where to type it. The row wins, in both languages.
describe('a supported question is not a Bible-Reader ask', () => {
    test.each(['តើខ្ញុំវាយ យ៉ូហាន ៣:១៦ នៅឯណា?'])('%s', async (asked) => {
        // The words LOOK like the ask kind...
        expect(readBibleReaderAsk(asked)).not.toBeNull();
        expect(readBibleReaderAsk(asked)).not.toBeNull();
        // ...and they are one of the app's own questions, with W-11.
        const { findKnownQuestion } =
            await import('../../../../../../chatbot/questionHelpers');
        const known = await findKnownQuestion(asked, 'reader');
        expect(known?.resources?.recipe).toBe('W-11');
        // The window's rule: the row decides.
        expect(
            keepBibleReaderAskUnlessKnown(readBibleReaderAsk(asked), known),
        ).toBeNull();
        // A free-typed question with no row keeps the ask kind.
        expect(
            keepBibleReaderAskUnlessKnown(
                readBibleReaderAsk('what names in Genesis chapter 4'),
                null,
            ),
        ).toEqual({ intent: 'names' });
    });
});
