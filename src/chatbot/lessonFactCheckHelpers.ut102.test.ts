import { describe, expect, it } from 'vitest';

import {
    genLessonFactCheckAsk,
    readLessonFactFindings,
} from './lessonFactCheckHelpers';

const BLOCKS = [
    {
        n: 1,
        kind: 'passage',
        text: '(KJV) Mark 4:35-41 - (35): And the same day',
    },
    {
        n: 2,
        kind: 'paragraph',
        text: 'Jesus dismissed the crowd before they crossed the lake.',
    },
    {
        n: 3,
        kind: 'paragraph',
        text: 'Peter woke the Lord who was sleeping on a pillow.',
    },
    {
        n: 4,
        kind: 'paragraph',
        text: 'The storm came up when they were halfway across the sea.',
    },
    {
        n: 5,
        kind: 'paragraph',
        text: 'The wind ceased and there was a great calm at his word.',
    },
];

describe('the fact check ask and its findings (UT-102)', () => {
    it('skips a read whose verses are not a list, and keeps the rest', () => {
        const ask = genLessonFactCheckAsk(BLOCKS, [
            JSON.stringify({ verses: 'not a list' }),
            JSON.stringify({ bible: 'KJV' }),
            JSON.stringify({
                verses: [{ ref: 'Mark 4:39', text: 'Peace, be still.' }],
            }),
        ])!;
        expect(ask).toContain('Mark 4:39: Peace, be still.');
        expect(ask).not.toContain('not a list');
    });

    it('stops each part at its bound, keeping the lines before it', () => {
        const longVerse = 'and '.repeat(2400).trim();
        const ask = genLessonFactCheckAsk(BLOCKS, [
            JSON.stringify({
                verses: [
                    { ref: 'Mark 4:38', text: 'Master, carest thou not' },
                    { ref: 'Mark 4:40', text: longVerse },
                ],
            }),
        ])!;
        const [verses, lesson] = ask.split('THE LESSON:\n');
        expect(verses).toContain('Mark 4:38: Master, carest thou not');
        // The line past 9 000 letters is left out, and with it every line
        // after it (the printed passage).
        expect(verses).not.toContain('Mark 4:40');
        expect(verses).not.toContain('(KJV) Mark 4:35-41');
        expect(lesson.split('\n')).toHaveLength(4);
    });

    it('reads a broken array as no finding', () => {
        expect(
            readLessonFactFindings(
                '[{"sentence": "Jesus dismissed the crowd", verses]',
                BLOCKS,
            ),
        ).toEqual([]);
    });

    it('names three findings at most, in their order', () => {
        const answer = JSON.stringify(
            BLOCKS.slice(1).map((block) => ({
                sentence: block.text,
                verses: 'Mark 4:36: they took him even as he was',
                verdict: 'not given',
            })),
        );
        const found = readLessonFactFindings(answer, BLOCKS);
        expect(found.map((one) => one.sentence)).toEqual(
            BLOCKS.slice(1, 4).map((block) => block.text),
        );
        expect(found[0].text).toBe(
            'the verses read say: Mark 4:36: they took him even as he was',
        );
    });
});
