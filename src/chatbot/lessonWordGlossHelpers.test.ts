import { describe, expect, test } from 'vitest';

import {
    findLessonWordGlosses,
    genLessonWordGlossNote,
} from './lessonWordGlossHelpers';

// BN-91 (2026-11-11): the hundred pence of Matthew 18:28 was "a small amount
// a day's wage might cover" in three runs of four; a penny WAS the day's wage.
describe('the KJV words a passage holds, explained by Scripture', () => {
    test('a passage gets the explanation of each word it holds', () => {
        const glosses = findLessonWordGlosses(
            '(28): But the same servant went out, and found one of his ' +
                'fellowservants, which owed him an hundred pence (24): ' +
                'which owed him ten thousand talents.',
        );
        expect(glosses).toHaveLength(2);
        expect(glosses[0]).toContain('a penny a day" (Matthew 20:2)');
        expect(glosses[1]).toMatch(/^talent: .*Exodus 25:39/);
    });

    // The first wording, "a labourer's pay for one day", was copied as "a
    // hundred pence was roughly a labourer's pay for one day".
    test('pence are counted: each penny is one day', () => {
        const [gloss] = findLessonWordGlosses('he took out two pence');
        expect(gloss).toMatch(/^penny, pence: ONE penny was/);
        expect(gloss).toContain("two pence, two days' pay");
        expect(gloss).toContain("a hundred pence, a hundred days' pay");
    });

    // Each entry says where its sense holds, or names every sense the
    // Bible gives the word: "a weight of silver paid as money" had been
    // said of Goliath's coat of brass.
    test('a word is matched only in the sense its entry gives', () => {
        expect(findLessonWordGlosses('five thousand shekels of brass')).toEqual(
            [expect.stringContaining("Goliath's coat and spear were weighed")],
        );
        expect(findLessonWordGlosses('let us make three tabernacles')).toEqual(
            [],
        );
        expect(findLessonWordGlosses('and all his bowels gushed out')).toEqual(
            [],
        );
        expect(
            findLessonWordGlosses('Put on therefore ... bowels of mercies'),
        ).toEqual([expect.stringMatching(/^bowels \(of mercies\)/)]);
    });

    test('whole words only, any case, and nothing for words it lacks', () => {
        expect(findLessonWordGlosses('A certain PRIEST and a Levite')).toEqual([
            expect.stringMatching(/^Levite: .*not a priest himself/),
            expect.stringMatching(/^priest: /),
        ]);
        // "pencil" is no penny, "slingshot" no sling; a verse holding none
        // of the words gets nothing.
        expect(findLessonWordGlosses('a pencil and a slingshot')).toEqual([]);
        expect(findLessonWordGlosses('The LORD is my shepherd')).toEqual([]);
        expect(findLessonWordGlosses('')).toEqual([]);
    });

    // BN-92 (2026-11-11): what blind readers found again after BN-91 --
    // Psalm 51:10's "create" as making "out of nothing", Saul's armour "too
    // heavy" (17:39: "I have not proved them"), Psalm 23:5's oil as a
    // shepherd's salve.
    test('the words read wrong most often get Scripture beside them', () => {
        expect(
            findLessonWordGlosses('Create in me a clean heart, O God'),
        ).toEqual([
            expect.stringMatching(
                /^create: God's own work, and not only out of nothing -- .*"of the dust of the ground" \(Genesis 2:7\)/,
            ),
        ]);
        expect(findLessonWordGlosses('for I have not proved them')).toEqual([
            expect.stringMatching(/^prove, proved: to test, to try out/),
        ]);
        expect(
            findLessonWordGlosses('thou anointest my head with oil'),
        ).toEqual([expect.stringContaining('(Luke 7:46)')]);
        // Every sense the Bible gives the word: a blot is a stain too, and
        // a contrite spirit may be crushed by trouble, not by sin.
        expect(findLessonWordGlosses('if any blot hath cleaved')).toEqual([
            expect.stringContaining('a blot, a stain (Job 31:7)'),
        ]);
        expect(findLessonWordGlosses('of a contrite spirit')).toEqual([
            expect.stringContaining('or crushed by trouble'),
        ]);
    });

    test('a long story carries eight at most', () => {
        const words =
            'pence talents mites shekels publicans Levites priests ' +
            'Samaritans Pharisees scribes hyssop tabernacle sling';
        expect(findLessonWordGlosses(words)).toHaveLength(8);
    });

    test('the note says to use them, never memory', () => {
        expect(genLessonWordGlossNote([])).toBe(null);
        const note = genLessonWordGlossNote(['sling: a weapon of war']);
        expect(note).toContain('as Scripture itself explains them');
        expect(note).toContain('never what it remembers');
        expect(note).toContain('- sling: a weapon of war');
        // BN-92: told only "a What it means line says of them only this",
        // a point whose verses held none of them explained nothing.
        expect(note).toContain(
            'every point still explains the words and pictures of its own',
        );
    });
});
