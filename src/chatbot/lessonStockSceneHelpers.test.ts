import { describe, expect, test } from 'vitest';

import {
    checkIsFuneralAsk,
    checkKeepsBlockWords,
    findBlockNumbers,
    findHospitalExamples,
    genHospitalExampleNote,
    genLineFixRefusal,
    genWholeBlockNote,
    toLineFixBlock,
} from './lessonStockSceneHelpers';

// BN-157 (2026-11-12, ab32, Opus: a children's Jonah 23 -> 18): told to fix
// one sentence of the story block, the model sent the block back as that
// sentence alone.
describe('a line fixed keeps the rest of its block', () => {
    const story =
        'God told Jonah to go to Nineveh and tell them to stop doing bad ' +
        'things. Jonah did not want to go. He tried to run away on a ship ' +
        'to Tarshish. But God sent a great storm, and a huge fish swallowed ' +
        'Jonah for three days.';
    const blocks = [
        { n: 8, text: 'The Story of Jonah' },
        { n: 9, text: story },
        { n: 10, text: '**For example:** A child hides a broken vase.' },
    ];
    const line =
        'God told Jonah to go to Nineveh and tell them to stop doing bad ' +
        'things.';

    test('a block holding more than the line is kept whole', () => {
        const fix = toLineFixBlock(blocks, 9, line);
        expect(fix?.n).toBe(9);
        expect(fix?.other).toContain('tarshish');
        // The block is the line, or not known: nothing to keep.
        expect(toLineFixBlock(blocks, 10, blocks[2].text)).toBe(null);
        expect(toLineFixBlock(blocks, null, line)).toBe(null);
        expect(toLineFixBlock(blocks, 99, line)).toBe(null);
    });

    test('a fix keeps the block, never the line alone', () => {
        const fix = toLineFixBlock(blocks, 9, line);
        if (fix === null) {
            throw new Error('no fix');
        }
        expect(
            checkKeepsBlockWords(
                'God told Jonah to say that the city would be overthrown.',
                fix,
            ),
        ).toBe(false);
        expect(
            checkKeepsBlockWords(
                story.replace(
                    'tell them to stop doing bad things',
                    'say "Yet forty days, and Nineveh shall be overthrown"',
                ),
                fix,
            ),
        ).toBe(true);
        expect(genWholeBlockNote(fix)).toContain(
            `Block 9 holds more than that line; it reads now: "${story}"`,
        );
        expect(genWholeBlockNote(fix)).toContain(
            '{block: 9, text: <every word of block 9 as it reads now, only ' +
                'that one sentence changed>}',
        );
        expect(genLineFixRefusal([fix])).toContain(
            'Nothing was changed: block 9 holds more than the line to fix',
        );
        expect(genLineFixRefusal([fix])).toContain(`"${story}"`);
        // A block too long to quote is named, not quoted.
        const long = { ...fix, text: 'word '.repeat(600) };
        expect(genWholeBlockNote(long)).not.toContain('it reads now:');
        expect(genLineFixRefusal([long])).toMatch(/sentence changed\.$/);
    });
});

// BN-150 (2026-11-11, the ab30 read): the hospital waiting room stood in six
// lessons of 32 -- both devotions' among them -- and both blind readers
// scored it as stock.
describe('a lesson example set in a hospital', () => {
    test('finds the For example lines set in a hospital', () => {
        const lesson =
            '## 1. Our refuge\n**What it means:** God is near.\n' +
            '**For example:** A woman sits in a hospital waiting room, her ' +
            'hands shaking. She hears the monitors.\n' +
            '## 2. Be still\n**For example:** A father stands at the bus ' +
            'stop in the rain. He stops and prays.\n' +
            '## 3. With us\n**For example:** A person sits in a quiet ' +
            'hospital room, the only sound the steady beep of a monitor ' +
            'that will not stop beeping through the long night. Then...';
        expect(findHospitalExamples(lesson)).toEqual([
            'A woman sits in a hospital waiting room, her hands shaking.',
            'A person sits in a quiet hospital room, the only sound the ' +
                'steady beep of a moni…',
        ]);
        // The bus stop is no hospital; a hospital named outside an
        // example is the lesson's own business.
        expect(
            findHospitalExamples(
                '## Background\nLuke was a physician, not a hospital.\n' +
                    '**For example:** A boy waits at the school gate.',
            ),
        ).toEqual([]);
        expect(findHospitalExamples('')).toEqual([]);
    });

    test('names three at most', () => {
        const line = '**For example:** A man waits in the ICU. He prays.\n';
        expect(findHospitalExamples(line.repeat(5))).toHaveLength(3);
    });

    test('asks one more edit, every other block as it is', () => {
        expect(genHospitalExampleNote([])).toBe(null);
        const one = genHospitalExampleNote(['A woman sits in a hospital.']);
        expect(one).toContain('an example is set in a hospital');
        expect(one).toContain('"A woman sits in a hospital."');
        expect(one).toContain('change that **For example:** line to a scene');
        expect(one).toContain("what THAT point's verses tell happens again");
        expect(one).toContain('every other block as it is now');
        const two = genHospitalExampleNote(['A.', 'B.']);
        expect(two).toContain('examples are set in a hospital -- "A."; "B."');
        expect(two).toContain('change those **For example:** lines');
    });

    // BN-152 (shape31's L-11): told only the example's words, the model
    // counted its own lines and wrote its new scene over the line above.
    test('names the block each example is in, when the window read it', () => {
        const one = genHospitalExampleNote(['A woman waits.'], [15]);
        expect(one).toContain('block 15: "A woman waits."');
        // The change spelt out as `text`: told "its words alone", the model
        // sent the scene as `words` and was refused (BN-152's first run).
        expect(one).toContain(
            'change ONLY block 15 -- {block: 15, text: "**For example:** <a ' +
                "scene of the hearers' own week",
        );
        const two = genHospitalExampleNote(['A.', 'B.'], [9, 15]);
        expect(two).toContain('block 9: "A."; block 15: "B."');
        expect(two).toContain(
            'change ONLY blocks 9 and 15 -- {block: <each>, text:',
        );
        expect(two).toContain('"} for each --');
        // One not found: the words alone, as before.
        expect(genHospitalExampleNote(['A.', 'B.'], [9, null])).toContain(
            'change those **For example:** lines',
        );
    });

    test('finds a line in the note as read', () => {
        const blocks = [
            { n: 13, kind: 'paragraph', text: '**A hearer asks:** Why?' },
            {
                n: 14,
                kind: 'paragraph',
                text:
                    '**The passage answers:** [^(KJV) Psalm 46:1] God is a ' +
                    'very present help in trouble.',
            },
            {
                n: 15,
                kind: 'paragraph',
                text:
                    '**For example:** A woman sits in a hospital waiting ' +
                    'room, her hands shaking. She prays.',
            },
        ];
        expect(
            findBlockNumbers(blocks, [
                'A woman sits in a hospital waiting room, her hands shaking.',
                // A line's verse token is the read's with its Bible.
                '**The passage answers:** [^Psalm 46:1] God is a very ' +
                    'present help in trouble.',
                'A line the note does not hold at all.',
                'Too short',
            ]),
        ).toEqual([15, 14, null, null]);
        expect(
            findBlockNumbers(blocks, [
                'The passage answers: the verse says so plainly, always.',
            ]),
        ).toEqual([null]);
        expect(findBlockNumbers([], ['A woman sits in a hospital.'])).toEqual([
            null,
        ]);
    });

    test('a funeral message is asked for by its words', () => {
        expect(checkIsFuneralAsk('a message of hope for a funeral')).toBe(true);
        expect(checkIsFuneralAsk('words for a memorial service')).toBe(true);
        expect(checkIsFuneralAsk('a sermon on Psalm 46')).toBe(false);
        expect(checkIsFuneralAsk('')).toBe(false);
    });
});
