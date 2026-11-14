/**
 * A Bible note conversation's pure rules (`noteChatHelpers.ts`) at the edges
 * the other suites leave: the caps on misquotes and cited quotes, a token's
 * sentence too long to quote whole, the gaps of a lesson that is whole or
 * has no passage, block lines whose words are not JSON, and the edits a
 * rewrite or a repeated passage leaves as they are.
 */
import { describe, expect, test } from 'vitest';

import {
    dropRepeatedLessonPassages,
    findCitedMisquotes,
    findCitedQuotes,
    findLostNoteLines,
    findNoteMisquotes,
    findNoteTranslateLeft,
    findTokenAsWords,
    genLessonGapsText,
    listShortReadVerses,
    pickTranslateBibleKey,
    readNoteRewrite,
    toNoteDocumentText,
    toNoteVerseReadText,
    withRewrittenLinesRemoved,
} from './noteChatHelpers';

describe('quotes held to the passage', () => {
    const JOHN =
        'For God so loved the world that he gave his only begotten Son';

    test('five misquotes at most are named, in the order written', () => {
        const quotes = [
            'God so loved the world he gave',
            'he gave his begotten Son',
            'For God loved the world',
            'God so loved world',
            'the world that gave his only Son',
            'his only Son he gave',
        ];
        const text = quotes.map((quote) => `"${quote}"`).join(' and ');
        expect(findNoteMisquotes(text, [JOHN])).toEqual(quotes.slice(0, 5));
        // A quote word for word is no misquote at all.
        expect(findNoteMisquotes(`"${JOHN}"`, [JOHN])).toEqual([]);
    });

    test('a lesson of more than forty cited quotes is read up to forty', () => {
        const text = Array.from({ length: 45 }, (_, index) => {
            return `"Saying number ${index} here" (John 3:${index + 1}).`;
        }).join(' ');
        const cited = findCitedQuotes(text);
        expect(cited).toHaveLength(40);
        expect(cited[0]).toEqual({
            quote: 'Saying number 0 here',
            ref: 'John 3:1',
        });
        expect(cited[39].ref).toBe('John 3:40');
    });

    test('one quote cited twice is named once', () => {
        const verse =
            '(28): Come unto me, all ye that labour and are heavy laden';
        const misquotes = findCitedMisquotes(
            [
                { quote: 'weary and heavy laden ones', ref: 'Matthew 11:28' },
                { quote: 'weary and heavy laden ones', ref: 'Matthew 11:29' },
            ],
            new Map([
                ['Matthew 11:28', verse],
                ['Matthew 11:29', verse],
            ]),
        );
        expect(misquotes).toEqual([
            {
                quote: 'weary and heavy laden ones',
                ref: 'Matthew 11:28',
                verse,
            },
        ]);
    });
});

describe("a child's memory verse offered from what was read (BN-143)", () => {
    test('the verses sharing most with the big idea come first; a read of no verses is passed over', () => {
        const reads = [
            JSON.stringify({ bible: 'KJV', note: 'nothing found' }),
            JSON.stringify({
                bible: 'KJV',
                verses: [
                    {
                        ref: 'Luke 19:10',
                        text:
                            'For the Son of man is come to seek and to save ' +
                            'that which was lost.',
                    },
                ],
            }),
            JSON.stringify({
                bible: 'KJV',
                verses: [
                    {
                        ref: 'Luke 15:5',
                        text:
                            'And when he hath found it, he layeth it on his ' +
                            'shoulders, rejoicing.',
                    },
                ],
            }),
        ];
        expect(
            listShortReadVerses(
                reads,
                'The lost sheep is found with rejoicing.',
            ),
        ).toEqual([
            { ref: 'Luke 15:5', wordCount: 13 },
            { ref: 'Luke 19:10', wordCount: 16 },
        ]);
    });
});

describe('a token standing for a verse', () => {
    test('a sentence past 160 letters is quoted by its end, marked cut', () => {
        const opening = 'word '.repeat(40);
        const line = `${opening}and so Jesus says, [^John 3:16].`;
        const [found] = findTokenAsWords(line);
        expect(found.token).toBe('[^John 3:16]');
        expect(found.sentence.startsWith('…')).toBe(true);
        expect(found.sentence).toHaveLength(161);
        expect(found.sentence.endsWith('Jesus says, [^John 3:16].')).toBe(true);
    });
});

describe('what a lesson still lacks (BN-67)', () => {
    const POINT_WORDS =
        'verse token if it has none, what it means, an example from life ' +
        'and how to live it this week';

    test('no note, or a note of no blocks, lacks nothing it can name', () => {
        expect(genLessonGapsText(null)).toBeNull();
        expect(genLessonGapsText('Nothing but words.\nNo block lines.')).toBe(
            null,
        );
    });

    test('a lesson with every part, the passage and full points is whole', () => {
        const parts = [
            'Big idea',
            'Background',
            'Introduction',
            'Pointing to Jesus',
            'Response',
            'Closing prayer',
            'Questions for discussion',
            'Memory verse',
        ];
        const blocks: { n: number; kind: string; text: string }[] = [
            { n: 1, kind: 'passage', text: '(KJV) Mark 10:46-52 — (46): And' },
        ];
        const add = (kind: string, text: string) => {
            blocks.push({ n: blocks.length + 1, kind, text });
        };
        for (const part of parts.slice(0, 3)) {
            add('h2', part);
            add('paragraph', `The ${part} in words.`);
        }
        for (const point of ['1. He cries out', '2. Jesus stops']) {
            add('h2', point);
            add('paragraph', 'What it means.');
            add('paragraph', 'How to live it.');
        }
        for (const part of parts.slice(3)) {
            add('h2', part);
            add('paragraph', `The ${part} in words.`);
        }
        expect(genLessonGapsText(toNoteDocumentText({ blocks }))).toBeNull();
    });

    test('points with no passage printed: the passage goes at the top', () => {
        const gaps = genLessonGapsText(
            toNoteDocumentText({
                blocks: [
                    { n: 1, kind: 'h2', text: '1. Grace' },
                    { n: 2, kind: 'paragraph', text: 'It is given.' },
                    { n: 3, kind: 'paragraph', text: 'It is received.' },
                ],
            }),
        );
        expect(gaps).toContain(
            'after block 0 (the top): the main passage, its token alone on ' +
                'its line',
        );
        // The point has two lines: it is not asked for more.
        expect(gaps).not.toContain(`point 1's ${POINT_WORDS}`);
    });

    test("a block's words that are not JSON are counted as written", () => {
        const text = toNoteDocumentText({
            blocks: [
                { n: 1, kind: 'passage', text: '(KJV) Mark 10:46-52 — (46)' },
                { n: 2, kind: 'h2', text: 'Big idea' },
                { n: 3, kind: 'paragraph', text: 'Jesus stops.' },
                { n: 4, kind: 'h2', text: '1. He cries out' },
                { n: 5, kind: 'paragraph', text: 'SHORT' },
            ],
        })!;
        // Point 1 holds one short line: it is asked for its words.
        expect(genLessonGapsText(text)).toContain(`point 1's ${POINT_WORDS}`);
        // The same line, forty words and a backslash no JSON reads: its
        // words still count, so the point is not asked for more.
        const longLine = `${'word '.repeat(40)}\\q end`;
        const broken = text.replace('"SHORT"', `"${longLine}"`);
        expect(broken).toContain('\\q end"');
        const gaps = genLessonGapsText(broken)!;
        expect(gaps).not.toContain(`point 1's`);
        expect(gaps).toContain('Background');
    });
});

describe('a note put into another language (BN-133, BN-134)', () => {
    test('a list read for no language names no Bible', () => {
        const listed = {
            bible: 'KJV',
            bibles: [{ key: 'KJV', locale: 'en' }],
        };
        expect(pickTranslateBibleKey(listed, '')).toBeNull();
        expect(pickTranslateBibleKey(listed, 'en')).toBe('KJV');
    });

    test('a change naming no block leaves that block as it was read', () => {
        // Any script the language is written in: a block of English words
        // in the note is left untranslated.
        const pattern = /\p{Script=Braille}/u;
        const blocks = [{ n: 1, kind: 'paragraph', text: 'Grace abounds' }];
        expect(
            findNoteTranslateLeft(
                { action: 'edit', changes: [{ text: 'stray words' }, null] },
                blocks,
                pattern,
            ),
        ).toEqual({
            english: [{ n: 1, text: 'Grace abounds' }],
            stray: [],
        });
        // Taken out, it is no longer left.
        expect(
            findNoteTranslateLeft(
                { action: 'edit', changes: [{ block: 1, remove: true }] },
                blocks,
                pattern,
            ),
        ).toBeNull();
    });
});

describe("a new lesson's passage printed once (BN-130)", () => {
    test('a passage change printed again after the memory verse is taken out whole', () => {
        const top = { after: 0, kind: 'passage', ref: 'Luke 10:25-37' };
        const heading = { after: 1, kind: 'h2', text: 'Memory verse' };
        const memory = { after: 2, kind: 'passage', ref: 'Luke 10:37' };
        const repeat = { after: 3, kind: 'passage', ref: 'Luke 10:25-37' };
        const result = dropRepeatedLessonPassages({
            action: 'edit',
            changes: [top, heading, memory, repeat],
        });
        expect(result.changes).toEqual([top, heading, memory]);
    });
});

describe('loose lines made a lesson (BN-67)', () => {
    const rewrite = {
        lines: ['mark 4 storm', 'peace be still'],
        lineBlocks: [1, 2],
        blockCount: 3,
    };

    test('a note not read, or read empty, is no note of loose lines', () => {
        expect(
            readNoteRewrite('finish my sermon', [
                { name: 'Notes', text: null },
            ]),
        ).toBeNull();
        expect(
            readNoteRewrite('finish my sermon', [
                {
                    name: 'Notes',
                    text: toNoteDocumentText({ blocks: [] })!,
                },
            ]),
        ).toBeNull();
    });

    test('anything but an edit of changes is left as it is', () => {
        const args = { action: 'read' };
        expect(withRewrittenLinesRemoved(args, rewrite)).toBe(args);
        const noChanges = { action: 'edit' };
        expect(withRewrittenLinesRemoved(noChanges, rewrite)).toBe(noChanges);
    });

    test('an edit that writes no words takes no line of theirs out', () => {
        const args = {
            action: 'edit',
            changes: [
                { block: 3, remove: true },
                { block: 2, text: '   ' },
            ],
        };
        expect(withRewrittenLinesRemoved(args, rewrite)).toBe(args);
    });

    test('a line with no words in it is never lost', () => {
        expect(
            findLostNoteLines(['---', 'mark 4 storm', '!!'], 'The storm.'),
        ).toEqual(['mark 4 storm']);
    });
});

describe("the note's own line beside each verse it cites", () => {
    test('a block line whose words are not JSON says nothing of its verse', () => {
        const results = [
            {
                bible: 'KJV',
                verses: [
                    { ref: 'John 3:16', text: 'For God so loved' },
                    { ref: 'John 3:17', text: 'For God sent not' },
                ],
            },
        ];
        const noteText =
            'Blocks: 2\n' +
            '1. paragraph: "Love given [^John 3:16]."\n' +
            '2. paragraph: "Sent \\q to save [^John 3:17]."';
        const read = toNoteVerseReadText(results, [noteText])!;
        expect(read).toContain(
            '- (KJV) John 3:16\n  the note says: "Love given John 3:16."\n' +
                '  the Bible says: "For God so loved"',
        );
        expect(read).toContain(
            '- (KJV) John 3:17\n  the Bible says: "For God sent not"',
        );
    });
});
