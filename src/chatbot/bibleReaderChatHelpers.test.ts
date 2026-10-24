// @vitest-environment jsdom
import { beforeAll, describe, expect, test } from 'vitest';

import {
    keepBibleReaderAskUnlessKnown,
    readBibleReaderAsk,
    readBibleReaderBookCandidate,
    readBibleReaderThread,
} from './bibleReaderChatHelpers';

// The corpus is read in the language the window is SHOWN in, and the row the
// regression came from is translated. Load it as a Khmer window does, before
// anything reads the corpus (it is cached on first use).
beforeAll(() => {
    document.documentElement.lang = 'km';
});

describe('a typed Bible-Reader question', () => {
    test.each([
        // The three the user put to the assistant, in English...
        ['show resource files of john chapter 3', { intent: 'resources' }],
        ['what names in Genesis chapter 4', { intent: 'names' }],
        ['open genesis 3:203', { intent: 'reference' }],
        // ...and as an elderly Khmer reader says them.
        ['បង្ហាញឯកសារធនធានរបស់យ៉ូហាន ជំពូក 3', { intent: 'resources' }],
        ['តើមានឈ្មោះអ្វីខ្លះក្នុងលោកុប្បត្តិ ជំពូក 4', { intent: 'names' }],
        ['បើកលោកុប្បត្តិ 3:203', { intent: 'reference' }],
        // ...and in French, because every language is data.
        [
            'montre les fichiers de ressources de Jean chapitre 3',
            { intent: 'resources' },
        ],
        ['quels noms dans Genèse chapitre 4', { intent: 'names' }],
        ['ouvre Genèse 3:203', { intent: 'reference' }],
        // A verse quoted by its reference is a Bible question too.
        ['what does John 3:16 say', { intent: 'reference' }],
        // Its zero-width spaces are Khmer keyboards' word breaks.
        ['បើក​លោកុប្បត្តិ 3:203', { intent: 'reference' }],
    ])('%s', (asked, expected) => {
        expect(readBibleReaderAsk(asked)).toEqual(expected);
    });

    test.each([
        // A Resources file NAMED in the question is a Resources ask, with
        // no chapter word and no reference (2026-10-19: the model answered
        // "I cannot read PDFs").
        ['what does MAT.18.pdf say?', { intent: 'resources' }],
        ['តើឯកសារធនធាន MAT.18.pdf និយាយអំពីអ្វី?', { intent: 'resources' }],
        ['read family-tree.jpeg', { intent: 'resources' }],
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

    test.each([
        // The words handed to the window's book check, shortest first.
        ['សូមសង្ខេប ម៉ាថាយ ១៨', 'ម៉ាថាយ'],
        ['show me 1 Samuel 2', '1 Samuel'],
    ])('%s offers %s as a book candidate', (asked, bookText) => {
        expect(readBibleReaderBookCandidate(asked)?.bookTextList).toContain(
            bookText,
        );
    });

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
        'របៀបបើកលោកុប្បត្តិ 3:203',
        'ដាក់យ៉ូហាន 3:16 លើអេក្រង់',
        'comment ouvrir Jean 3:16 dans le lecteur',
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

// The Reader's own how-to row, W-11. Round 23's Khmer pass found the
// Bible-Reader ask taking it: the verse was opened and the answer never said
// where to type it. The row wins, in both languages.
describe('a supported question is not a Bible-Reader ask', () => {
    test.each(['Where do I type John 3:16?', 'តើខ្ញុំវាយ យ៉ូហាន ៣:១៦ នៅឯណា?'])(
        '%s',
        async (asked) => {
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
        },
    );
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
