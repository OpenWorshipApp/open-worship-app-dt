import { describe, expect, it } from 'vitest';

import {
    STUDY_PASSAGE_MAX_VERSES,
    checkIsSameStudyPassage,
    describeStudyRequotedPassages,
    listStudyNewPassages,
    mergeStudyQuoteLines,
    replaceStudyLineRanges,
    restoreStudyPassages,
    toStudyQuoteMaxVerses,
} from './agentStudyFileRules';

// A passage under a Bible's name is that Bible's words (EC-565): words put
// in bold or italics inside it are the same words, and a passage new words
// quote by themselves is quoted again from the Bible it names.

const VERSE_16 =
    '> **16** For God so loved the world, that he gave his only begotten Son.';
const VERSE_17 =
    '> **17** For God sent not his Son into the world to condemn the world.';
const QUOTED = ['> **John 3:16-17** (KJV)', '>', VERSE_16, '>', VERSE_17];

function withLine(lines: string[], index: number, line: string) {
    return lines.map((one, at) => {
        return at === index ? line : one;
    });
}

describe('mergeStudyQuoteLines (EC-565)', () => {
    it('keeps words put in bold or italics, and taken out of them again', () => {
        const bold = withLine(
            QUOTED,
            2,
            VERSE_16.replace(
                'that he gave his only begotten Son',
                '**that he gave his only begotten Son**',
            ),
        );
        expect(mergeStudyQuoteLines(QUOTED, bold)).toEqual({
            lines: bold,
            changedCount: 0,
        });
        const italic = withLine(
            QUOTED,
            4,
            VERSE_17.replace('For God sent', '_For God_ *sent*'),
        );
        expect(mergeStudyQuoteLines(QUOTED, italic)).toEqual({
            lines: italic,
            changedCount: 0,
        });
        expect(mergeStudyQuoteLines(bold, QUOTED)).toEqual({
            lines: QUOTED,
            changedCount: 0,
        });
    });

    it('takes a line whose words changed from the quote, every other line as sent', () => {
        const sent = withLine(
            withLine(
                QUOTED,
                2,
                VERSE_16.replace(
                    'that he gave his only begotten Son',
                    '**that he gave his only Son**',
                ),
            ),
            4,
            VERSE_17.replace('to condemn', 'to *condemn*'),
        );
        expect(mergeStudyQuoteLines(QUOTED, sent)).toEqual({
            lines: withLine(sent, 2, VERSE_16),
            changedCount: 1,
        });
    });

    it('never takes a verse number written otherwise, nor a quote with lines added or taken out', () => {
        const unnumbered = withLine(
            QUOTED,
            2,
            VERSE_16.replace('**16**', '16'),
        );
        expect(mergeStudyQuoteLines(QUOTED, unnumbered)).toEqual({
            lines: QUOTED,
            changedCount: 1,
        });
        const wholeBold = withLine(
            QUOTED,
            2,
            '> **16 For God so loved the world, that he gave his only ' +
                'begotten Son.**',
        );
        expect(mergeStudyQuoteLines(QUOTED, wholeBold).changedCount).toBe(1);
        const unspaced = withLine(QUOTED, 2, VERSE_16.replace('> ', '>'));
        expect(mergeStudyQuoteLines(QUOTED, unspaced).changedCount).toBe(1);
        expect(mergeStudyQuoteLines(QUOTED, QUOTED.slice(0, 3))).toEqual({
            lines: QUOTED,
            changedCount: 2,
        });
        const spaced = withLine(QUOTED, 4, `${VERSE_17}  `);
        expect(mergeStudyQuoteLines(QUOTED, spaced)).toEqual({
            lines: spaced,
            changedCount: 0,
        });
    });
});

describe('a passage the file quotes, with words put in bold (EC-549 left it open)', () => {
    const OLD = ['# The Night Visit', '', ...QUOTED, '', '## Setting', ''].join(
        '\n',
    );
    const BOLD = OLD.replace(
        'that he gave his only begotten Son',
        '**that he gave his only begotten Son**',
    );

    it('keeps the bold, the words being the Bible’s', () => {
        expect(BOLD).not.toBe(OLD);
        expect(restoreStudyPassages(OLD, BOLD)).toEqual({
            text: BOLD,
            restored: [],
        });
    });

    it('puts back only the line whose words changed', () => {
        const changed = BOLD.replace('to condemn the world', 'to judge it');
        const result = restoreStudyPassages(OLD, changed);
        expect(result.text).toBe(BOLD);
        expect(result.restored).toEqual([
            { title: 'John 3:16-17', bibleKey: 'KJV', lineCount: 1 },
        ]);
    });
});

describe('listStudyNewPassages (EC-565)', () => {
    const ROMANS = [
        '> **Romans 5:8** (KJV)',
        '>',
        '> **8** But God commendeth his love toward us.',
    ];

    it('lists the passages new words quote that the old text does not, never one in a fenced block', () => {
        const oldText = ['# The Night Visit', '', ...QUOTED].join('\r\n');
        const newText = [
            '# The Night Visit',
            '',
            ...QUOTED,
            '',
            '## More',
            '',
            ...ROMANS,
            '',
            '```md',
            '> **John 1:1** (KJV)',
            '```',
            '',
            ...QUOTED.map((line) => {
                return line.replace('(KJV)', '(ASV)');
            }),
        ].join('\n');
        expect(listStudyNewPassages(oldText, newText)).toEqual([
            {
                start: 10,
                end: 13,
                title: 'Romans 5:8',
                bibleKey: 'KJV',
                lines: ROMANS,
            },
            {
                start: 18,
                end: 23,
                title: 'John 3:16-17',
                bibleKey: 'ASV',
                lines: QUOTED.map((line) => {
                    return line.replace('(KJV)', '(ASV)');
                }),
            },
        ]);
        expect(listStudyNewPassages(newText, newText)).toEqual([]);
    });

    it('takes the Bible’s quote as the passage meant when the reference reads the same or holds every verse numbered', () => {
        const toPassage = (lines: string[]) => {
            return listStudyNewPassages('', lines.join('\n'))[0];
        };
        expect(
            checkIsSameStudyPassage(
                toPassage(['> **John 3:16-17**  (KJV)', '> words']),
                'John  3:16-17',
                QUOTED,
            ),
        ).toBe(true);
        const shortName = ['> **Jn 3:16** (KJV)', '>', '> **16** words'];
        expect(
            checkIsSameStudyPassage(
                toPassage(shortName),
                'John 3:16-17',
                QUOTED,
            ),
        ).toBe(true);
        const otherVerse = ['> **Jn 3:18** (KJV)', '>', '> **18** words'];
        expect(
            checkIsSameStudyPassage(toPassage(otherVerse), 'John 3:18', QUOTED),
        ).toBe(false);
        const unnumbered = ['> **Jn 3:16** (KJV)', '> words'];
        expect(
            checkIsSameStudyPassage(toPassage(unnumbered), 'John 3:16', QUOTED),
        ).toBe(false);
    });

    it('quotes a passage cut where the app cuts one to the verses it holds', () => {
        expect(toStudyQuoteMaxVerses(QUOTED)).toBe(STUDY_PASSAGE_MAX_VERSES);
        expect(toStudyQuoteMaxVerses([...QUOTED, '>', '> …'])).toBe(2);
        expect(toStudyQuoteMaxVerses(['> **Psalms 119** (KJV)', '> …'])).toBe(
            STUDY_PASSAGE_MAX_VERSES,
        );
    });

    it('writes line ranges anew and keeps every other line', () => {
        expect(
            replaceStudyLineRanges('a\nb\nc\nd', [
                { start: 2, end: 3, lines: ['C1', 'C2'] },
                { start: 0, end: 1, lines: [] },
            ]),
        ).toBe('b\nC1\nC2\nd');
        expect(replaceStudyLineRanges('a\nb', [])).toBe('a\nb');
    });

    it('says which passages were quoted again, and how to quote one', () => {
        expect(describeStudyRequotedPassages([])).toBe('');
        expect(
            describeStudyRequotedPassages([
                { title: 'Romans 5:8', bibleKey: 'KJV', lineCount: 1 },
            ]),
        ).toBe(
            'The passage “Romans 5:8” (KJV) was quoted from that Bible as it ' +
                'reads there: the words sent had 1 of its line(s) otherwise, ' +
                "and a passage under a Bible's name is that Bible's own " +
                'words. To quote a passage, put its reference alone on a ' +
                'line, as [^John 3:16].',
        );
        expect(
            describeStudyRequotedPassages([
                { title: 'Romans 5:8', bibleKey: 'KJV', lineCount: 1 },
                { title: 'John 3:16', bibleKey: 'ASV', lineCount: 2 },
            ]),
        ).toContain(
            'The passages “Romans 5:8” (KJV), “John 3:16” (ASV) were quoted ' +
                'from their Bibles as they read there: the words sent had 3 ' +
                'of their line(s) otherwise',
        );
    });
});
