// @vitest-environment jsdom
import { beforeAll, describe, expect, test } from 'vitest';

import {
    keepBibleReaderAskUnlessKnown,
    readBibleReaderAsk,
    readBibleReaderBookCandidate,
    readBibleReaderThread,
} from './bibleReaderChatHelpers';
import { listLangPackageCodes } from '../test-setup/langPackageDirs';

// The corpus is read in the language the window is SHOWN in, and the row the
// regression came from is translated. Load it as a window shown in a
// language with its own corpus does -- the first package on disk that has
// one, English when none is there -- before anything reads the corpus (it
// is cached on first use).
beforeAll(() => {
    document.documentElement.lang =
        listLangPackageCodes({
            isEnglishIncluded: false,
            fileName: 'questions.json',
        })[0] ?? 'en';
});

describe('a typed Bible-Reader question', () => {
    test.each([
        // The three the user put to the assistant, in English...
        ['show resource files of john chapter 3', { intent: 'resources' }],
        ['what names in Genesis chapter 4', { intent: 'names' }],
        ['open genesis 3:203', { intent: 'reference' }],
        // A verse quoted by its reference is a Bible question too.
        ['what does John 3:16 say', { intent: 'reference' }],
    ])('%s', (asked, expected) => {
        expect(readBibleReaderAsk(asked)).toEqual(expected);
    });

    test.each([
        // A Resources file NAMED in the question is a Resources ask, with
        // no chapter word and no reference (2026-10-19: the model answered
        // "I cannot read PDFs").
        ['what does MAT.18.pdf say?', { intent: 'resources' }],
        ['read family-tree.jpeg', { intent: 'resources' }],
    ])('a named Resources file: %s', (asked, expected) => {
        expect(readBibleReaderAsk(asked)).toEqual(expected);
    });

    test.each([
        ['summarize Matthew 18', 'Matthew', { intent: 'reference' }],
        // A numbered book: the last word alone is not its name.
        ['show me 1 Samuel 2', '1 Samuel', { intent: 'reference' }],
    ])('a bare book and number: %s', (asked, bookText, expected) => {
        const checkIsBook = (value: string) => value === bookText;
        expect(readBibleReaderAsk(asked, checkIsBook)).toEqual(expected);
    });

    test.each([
        // Not a book: the words before the number are ordinary words, so
        // the window's book check -- which accepts only `Matthew` here --
        // leaves the question to the ordinary assistant.
        ['I read 3 books today', 'Matthew'],
        ['Show 3 resources', 'Matthew'],
    ])('%s is not a book and number', (asked, bookText) => {
        expect(
            readBibleReaderAsk(asked, (value) => value === bookText),
        ).toBeNull();
    });

    test.each([['show me 1 Samuel 2', '1 Samuel']])(
        '%s offers %s as a book candidate',
        (asked, bookText) => {
            expect(readBibleReaderBookCandidate(asked)?.bookTextList).toContain(
                bookText,
            );
        },
    );

    test('a how-to is no book candidate', () => {
        expect(
            readBibleReaderBookCandidate('How do I read about 3 Bibles?'),
        ).toBeNull();
    });

    test.each([
        // The app's own work, whatever it names.
        'How do I open John 3:16 in the reader?',
        'put John 3:16 on the screen',
        'add bible verse John 3:16 to my bible list',
        // No book before the number: nothing a tool could read.
        'chapter 3',
        '3:16',
        // A web address ending in `.pdf` is a page to read, not a Resources
        // file.
        'summarize https://example.com/notes.pdf',
        // No reference at all: the verse finder's own asks keep it.
        'what bible verse talk about lover your enemy?',
        'Help me find a Bible verse: love your enemies',
        // A line starting with a slash is a command.
        '/verse John 3:16',
    ])('%s is not one', (asked) => {
        expect(readBibleReaderAsk(asked)).toBeNull();
    });
});

// The Reader's own how-to row, W-11. Round 23's pass in a non-English window
// found the Bible-Reader ask taking it: the verse was opened and the answer
// never said where to type it. The row wins, in English here and in each
// language's own words in its package's tests.
describe('a supported question is not a Bible-Reader ask', () => {
    test.each(['Where do I type John 3:16?'])('%s', async (asked) => {
        // The words LOOK like the ask kind...
        expect(readBibleReaderAsk(asked)).not.toBeNull();
        expect(readBibleReaderAsk(asked)).not.toBeNull();
        // ...and they are one of the app's own questions, with W-11.
        const { findKnownQuestion } = await import('./questionHelpers');
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

describe('a plain line under a Bible-Reader answer', () => {
    const messages = [
        { author: 'you' as const, text: 'what names in Genesis 4' },
        {
            author: 'bot' as const,
            text: 'The people are ...',
            isBibleReaderAnswer: true as const,
        },
    ];

    test('stays in the conversation, even with no reference of its own', () => {
        expect(readBibleReaderThread(messages, 'and chapter 5?')).toEqual({
            intent: 'reference',
            isThread: true,
        });
    });

    test('and is aimed by what the follow-up asks', () => {
        expect(readBibleReaderThread(messages, 'who is in it?')).toEqual({
            intent: 'names',
            isThread: true,
        });
    });

    test('a command ends it', () => {
        expect(readBibleReaderThread(messages, '/screen')).toBeNull();
    });

    test('the app’s own work ends it', () => {
        expect(
            readBibleReaderThread(messages, 'how do I put it on the screen?'),
        ).toBeNull();
    });

    test('another answer ends it', () => {
        expect(
            readBibleReaderThread(
                [
                    { author: 'bot', text: 'A manual answer.' },
                    { author: 'you', text: 'and chapter 5?' },
                ],
                'and chapter 5?',
            ),
        ).toBeNull();
    });
});
