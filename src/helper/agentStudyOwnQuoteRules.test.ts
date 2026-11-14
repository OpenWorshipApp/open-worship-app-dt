import { describe, expect, it } from 'vitest';

import {
    STUDY_MAX_OWN_QUOTES,
    checkIsStudyPassageLike,
    describeStudyOwnQuotes,
    judgeStudyOwnQuote,
    listStudyOwnQuotes,
    replaceStudyOwnQuotes,
    toStudyPassageWords,
} from './agentStudyOwnQuoteRules';

// EC-575: a verse a model quoted in a form of its own -- not the app's
// `> **John 3:16** (KJV)` -- read off the words, judged against the verse
// as a Bible reads it, and put in the app's form. Verse words are the
// public domain KJV, ASV and World English Bible.
const KJV_JOHN_3_16 =
    'For God so loved the world, that he gave his only begotten Son, that ' +
    'whosoever believeth in him should not perish, but have everlasting life.';
const WEB_JOHN_3_16 =
    'For God so loved the world, that he gave his one and only Son, that ' +
    'whoever believes in him should not perish, but have eternal life.';
const KJV_GENESIS_1_1 =
    'In the beginning God created the heaven and the earth.';

function readOne(text: string, oldText = '') {
    const quotes = listStudyOwnQuotes(oldText, text);
    expect(quotes).toHaveLength(1);
    return quotes[0];
}

describe('a verse quoted in a form of the model’s own (EC-575)', () => {
    describe('listStudyOwnQuotes', () => {
        it('reads a quote under a reference at its end, in brackets or after a dash', () => {
            expect(readOne(`> "${WEB_JOHN_3_16}" (John 3:16)`)).toEqual({
                start: 0,
                end: 1,
                ref: 'John 3:16',
                bibleName: null,
                words: WEB_JOHN_3_16,
                label: '',
                isQuoteForm: true,
            });
            expect(
                readOne('> *For God so loved the world.* — *John 3:16 (KJV)*'),
            ).toMatchObject({
                ref: 'John 3:16',
                bibleName: 'KJV',
                words: 'For God so loved the world.',
                isQuoteForm: true,
            });
            expect(
                readOne('> “For God so loved the world” (John 3:16-17, KJV).'),
            ).toMatchObject({ ref: 'John 3:16-17', bibleName: 'KJV' });
        });

        it('reads a reference on a line of its own, under the words or over them', () => {
            expect(
                readOne(
                    'Intro.\n\n> "For God so loved the world."\n> — John 3:16',
                ),
            ).toMatchObject({
                start: 2,
                end: 4,
                ref: 'John 3:16',
                words: 'For God so loved the world.',
                isQuoteForm: true,
            });
            expect(
                readOne('> **John 3:16 (KJV)**\n> For God so loved the world.'),
            ).toMatchObject({
                ref: 'John 3:16',
                bibleName: 'KJV',
                words: 'For God so loved the world.',
                isQuoteForm: true,
            });
        });

        it('reads a reference leading the words, in bold or before a colon', () => {
            for (const text of [
                '> **John 3:16** — For God so loved the world.',
                '> **John 3:16:** "For God so loved the world."',
                '> John 3:16: For God so loved the world.',
            ]) {
                expect(readOne(text)).toMatchObject({
                    ref: 'John 3:16',
                    words: 'For God so loved the world.',
                    isQuoteForm: true,
                });
            }
        });

        it('keeps a lead written before the words as the quote’s label', () => {
            expect(
                readOne(
                    '> **Key Verse:** "For God so loved the world." (John 3:16)',
                ),
            ).toMatchObject({
                label: '**Key Verse:**',
                words: 'For God so loved the world.',
            });
        });

        it('tells words set out as a quote from words that may be a sentence about the verse', () => {
            expect(
                readOne('> For God so loved the world (John 3:16).'),
            ).toMatchObject({ isQuoteForm: false });
            expect(
                readOne('> For God so loved the world.\n> (John 3:16)'),
            ).toMatchObject({ isQuoteForm: false });
        });

        it('reads a plain paragraph only when its words are all in quote marks or emphasis', () => {
            expect(
                readOne('"For God so loved the world." (John 3:16)'),
            ).toMatchObject({ isQuoteForm: true });
            expect(
                listStudyOwnQuotes(
                    '',
                    'God loved the world so much that he gave his Son (John 3:16).',
                ),
            ).toEqual([]);
        });

        it('leaves lists, two references, the app’s passages, tokens, code and words of the file as they were', () => {
            const held = '> "For God so loved the world." (John 3:16)';
            const text = [
                '- "For God so loved the world." (John 3:16)',
                '',
                '> "For God so loved" (John 3:16) and "God is love" (1 John 4:8)',
                '',
                '> **John 3:16** (KJV)',
                '>',
                '> **3:16** For God so loved the world.',
                '',
                '> [^John 3:16]',
                '',
                '```',
                '> "For God so loved the world." (John 3:16)',
                '```',
                '',
                '> **Note:** Nicodemus comes back in John 7:50, at a feast.',
                '',
                '> "Meet at 10:30 to pray." (John 3:16)',
                '',
                '> "Love." (John 3:16)',
                '',
                held,
            ].join('\n');
            expect(listStudyOwnQuotes(held, text)).toEqual([]);
        });

        it('reads no more than a draft may quote', () => {
            const text = Array.from(
                { length: STUDY_MAX_OWN_QUOTES + 3 },
                (_, index) => {
                    return `> "For God so loved the world." (John 3:${index + 1})`;
                },
            ).join('\n\n');
            expect(listStudyOwnQuotes('', text)).toHaveLength(
                STUDY_MAX_OWN_QUOTES,
            );
        });
    });

    describe('judgeStudyOwnQuote', () => {
        it('takes the verse’s own words, or pieces of them in order, as exact', () => {
            for (const words of [
                KJV_JOHN_3_16,
                'For God so loved the world',
                'For God so loved the world … whosoever believeth in him',
            ]) {
                expect(
                    judgeStudyOwnQuote(
                        { words, isQuoteForm: true },
                        KJV_JOHN_3_16,
                    ),
                ).toBe('exact');
            }
            expect(
                judgeStudyOwnQuote(
                    {
                        words: 'whosoever believeth in him … For God so loved',
                        isQuoteForm: true,
                    },
                    KJV_JOHN_3_16,
                ),
            ).not.toBe('exact');
        });

        it('takes another Bible’s words for the verse as like it, and another verse’s as other', () => {
            expect(
                judgeStudyOwnQuote(
                    { words: WEB_JOHN_3_16, isQuoteForm: true },
                    KJV_JOHN_3_16,
                ),
            ).toBe('like');
            expect(
                judgeStudyOwnQuote(
                    { words: KJV_GENESIS_1_1, isQuoteForm: true },
                    KJV_JOHN_3_16,
                ),
            ).toBe('other');
        });

        it('asks words not set out as a quote to be nearly the verse’s own', () => {
            // In quote marks a paraphrase claims to be the verse and is put
            // right; as a sentence of its own it is about the verse, and stays.
            const sentence = "God's love is shown in the gift of His Son";
            expect(
                judgeStudyOwnQuote(
                    { words: sentence, isQuoteForm: true },
                    KJV_JOHN_3_16,
                ),
            ).toBe('like');
            expect(
                judgeStudyOwnQuote(
                    { words: sentence, isQuoteForm: false },
                    KJV_JOHN_3_16,
                ),
            ).toBe('other');
            expect(
                judgeStudyOwnQuote(
                    { words: WEB_JOHN_3_16, isQuoteForm: false },
                    KJV_JOHN_3_16,
                ),
            ).toBe('like');
            expect(
                judgeStudyOwnQuote(
                    {
                        words: 'For God loved all the people of the world',
                        isQuoteForm: false,
                    },
                    KJV_JOHN_3_16,
                ),
            ).toBe('other');
        });

        it('reads letters, so a script written without spaces is judged alike', () => {
            expect(
                judgeStudyOwnQuote(
                    { words: 'zorveluntabbitmunkarrosel', isQuoteForm: true },
                    'zor velun tabbit mun karro sel',
                ),
            ).toBe('exact');
            expect(
                judgeStudyOwnQuote(
                    { words: 'zorveluntabbitmunkarrovel', isQuoteForm: true },
                    'zor velun tabbit mun karro sel',
                ),
            ).toBe('like');
        });
    });

    describe('checkIsStudyPassageLike', () => {
        const QUOTED = [
            '> **John 3:16** (KJV)',
            '>',
            `> **16** ${KJV_JOHN_3_16}`,
        ];

        it('reads a passage in the app’s form with a short name and no number by its words', () => {
            expect(toStudyPassageWords(QUOTED)).toBe(KJV_JOHN_3_16);
            expect(
                checkIsStudyPassageLike(
                    ['> **Joh 3:16** (KJV)', `> ${WEB_JOHN_3_16}`],
                    QUOTED,
                ),
            ).toBe(true);
            expect(
                checkIsStudyPassageLike(
                    ['> **Joh 3:16** (KJV)', `> ${KJV_GENESIS_1_1}`],
                    QUOTED,
                ),
            ).toBe(false);
            expect(
                checkIsStudyPassageLike(
                    ['> **Joh 3:16** (KJV)', '> God'],
                    QUOTED,
                ),
            ).toBe(false);
        });
    });

    describe('replaceStudyOwnQuotes', () => {
        const QUOTE = ['> **John 3:16** (KJV)', '>', '> **16** For God.'];

        it('ends a longer blockquote around the quote, and parts it from plain words', () => {
            const text = [
                '> Before.',
                '>',
                '> "For God." (John 3:16)',
                '>',
                '> After.',
                'Words.',
                '> "For God." (John 3:16)',
                'More words.',
            ].join('\n');
            expect(
                replaceStudyOwnQuotes(text, [
                    { start: 6, end: 7, lines: QUOTE },
                    {
                        start: 2,
                        end: 3,
                        lines: ['**Key Verse:**', '', ...QUOTE],
                    },
                ]),
            ).toBe(
                [
                    '> Before.',
                    '',
                    '**Key Verse:**',
                    '',
                    ...QUOTE,
                    '',
                    '> After.',
                    'Words.',
                    '',
                    ...QUOTE,
                    '',
                    'More words.',
                ].join('\n'),
            );
        });

        it('adds no blank line at the text’s edges or beside one already there', () => {
            expect(
                replaceStudyOwnQuotes('> "For God." (John 3:16)\n\nAfter.', [
                    { start: 0, end: 1, lines: QUOTE },
                ]),
            ).toBe([...QUOTE, '', 'After.'].join('\n'));
        });
    });

    describe('describeStudyOwnQuotes', () => {
        it('says what was written anew and what was left, and nothing for none', () => {
            expect(describeStudyOwnQuotes([], [])).toBe('');
            expect(
                describeStudyOwnQuotes(
                    [{ title: 'John 3:16', bibleKey: 'KJV' }],
                    [],
                ),
            ).toBe(
                'The quote “John 3:16” (KJV) was written as that Bible reads ' +
                    "it, in the app's form: the words sent were not the " +
                    "Bible's, and a verse quoted in a study is the Bible's own " +
                    'words. To quote a verse, put its reference alone on a ' +
                    'line, as [^John 3:16].',
            );
            const both = describeStudyOwnQuotes(
                [
                    { title: 'John 3:16', bibleKey: 'KJV' },
                    { title: 'Ruma 5:8', bibleKey: 'TRB' },
                ],
                [{ ref: 'John 3:21', bibleKey: 'KJV' }],
            );
            expect(both).toContain(
                'The quotes “John 3:16” (KJV), “Ruma 5:8” (TRB) were written ' +
                    'as their Bibles read them',
            );
            expect(both).toContain(
                'The words quoted as “John 3:21” (KJV) do not read as that ' +
                    'verse in that Bible, so they were left as sent',
            );
        });

        it('names five and counts the rest', () => {
            const many = Array.from({ length: 7 }, (_, index) => {
                return { title: `John 3:${index + 1}`, bibleKey: 'KJV' };
            });
            expect(describeStudyOwnQuotes(many, [])).toContain(
                '“John 3:5” (KJV) and 2 more were written',
            );
        });
    });
});
