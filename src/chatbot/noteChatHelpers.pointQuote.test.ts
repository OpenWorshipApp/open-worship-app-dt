import { describe, expect, it } from 'vitest';

import { findPointQuoteMisplacements } from './noteChatHelpers';

// BN-230 (the held-out reads ab69 and ab74): a children's Noah set Genesis
// 7:5's words under a point that prints Genesis 6:22.
const GENESIS_READ = JSON.stringify({
    bible: 'KJV',
    verses: [
        {
            key: 'GEN 6:9-22',
            ref: 'Genesis 6:9-22',
            text:
                '(9): These are the generations of Noah: Noah was a just man ' +
                '(22): Thus did Noah; according to all that God commanded ' +
                'him, so did he.',
        },
        {
            key: 'GEN 7:1-24',
            ref: 'Genesis 7:1-24',
            text:
                '(1): And the LORD said unto Noah, Come thou and all thy ' +
                'house into the ark (5): And Noah did according unto all ' +
                'that the LORD commanded him.',
        },
    ],
});

describe('a point quoting a verse that is not its own (BN-230)', () => {
    it('names the verse the words are, and the point they sit under', () => {
        const lesson =
            '## 1. Obeying God\n[^(KJV) Genesis 6:22]\n**What it means:** ' +
            '"Noah did according unto all that the LORD commanded him" ' +
            'means Noah did not argue.';
        const found = findPointQuoteMisplacements(lesson, [GENESIS_READ]);
        expect(found).toHaveLength(1);
        expect(found[0].sentence).toContain('**What it means:**');
        expect(found[0].text).toContain(
            "is Genesis 7:5's words, not the point's own Genesis 6:22",
        );
    });

    it('lets its own verse, a cited quote and a line outside the points be', () => {
        const own =
            '## 1. Obeying God\n[^Genesis 6:22]\n**What it means:** "Thus ' +
            'did Noah; according to all that God commanded him" is his ' +
            'obedience.';
        expect(findPointQuoteMisplacements(own, [GENESIS_READ])).toEqual([]);
        const cited =
            '## 1. Obeying God\n[^Genesis 6:22]\nLater, "Noah did according ' +
            'unto all that the LORD commanded him" [^Genesis 7:5].';
        expect(findPointQuoteMisplacements(cited, [GENESIS_READ])).toEqual([]);
        const background =
            '## Background\n[^Genesis 6:22]\n"Noah did according unto all ' +
            'that the LORD commanded him"';
        expect(findPointQuoteMisplacements(background, [GENESIS_READ])).toEqual(
            [],
        );
        // The lesson's own top passage holds it: its to quote anywhere.
        expect(
            findPointQuoteMisplacements(
                '[^Genesis 6:9-7:5]\n[^Genesis 7:1-5]\n## Big idea\nObey.\n' +
                    '## 1. Obeying God\n[^Genesis 6:22]\n"Noah did according ' +
                    'unto all that the LORD commanded him"',
                [GENESIS_READ],
            ),
        ).toEqual([]);
        // Words in two verses, one of them the point's: its own.
        const twice = JSON.stringify({
            verses: [
                {
                    key: 'JHN 3:14-16',
                    ref: 'John 3:14-16',
                    text:
                        '(15): That whosoever believeth in him should not ' +
                        'perish, but have eternal life. (16): For God so ' +
                        'loved the world, that he gave his only begotten ' +
                        'Son, that whosoever believeth in him should not ' +
                        'perish, but have everlasting life.',
                },
            ],
        });
        expect(
            findPointQuoteMisplacements(
                '## 1. God gave\n[^John 3:16]\n"whosoever believeth in him ' +
                    'should not perish" is the promise.',
                [twice],
            ),
        ).toEqual([]);
        // With nothing read, nothing to hold it to.
        expect(
            findPointQuoteMisplacements(
                '## 1. Obeying God\n[^Genesis 6:22]\n"Noah did according ' +
                    'unto all that the LORD commanded him"',
            ),
        ).toEqual([]);
    });
});
