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
        expect(glosses).toHaveLength(3);
        expect(glosses[0]).toContain('a penny a day" (Matthew 20:2)');
        expect(glosses[1]).toMatch(/^talent: .*Exodus 25:39/);
        // BN-111: the fellowservant's debt said as Matthew says it.
        expect(glosses[2]).toMatch(
            /^owed him an hundred pence \(Matthew 18:28\)/,
        );
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
                // BN-115: "formed" kept apart from "created", which a lesson
                // had merged into "created man from the dust (Genesis 2:7)".
                /^create: God's own work, and not only out of nothing -- .*he "formed man" \(Genesis 2:7\), a word of its own/,
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
        // Zacchaeus' fourfold was "the biblical standard for restitution";
        // the law asked it for a stolen sheep, a fifth more for fraud.
        expect(findLessonWordGlosses('I restore him fourfold')).toEqual([
            expect.stringContaining('"the fifth part more" (Leviticus 6:5)'),
        ]);
    });

    // BN-103 (2026-11-11): Jonah 3:10's "God repented of the evil" read as
    // the people's change, and Jonah "said he was sorry" in the fish.
    test("Jonah's prayer and God's turning, as Scripture says them", () => {
        expect(
            findLessonWordGlosses(
                'and God repented of the evil, that he had said that he would do',
            ),
        ).toEqual([
            expect.stringMatching(/^repented of the evil \(said of God\)/),
        ]);
        expect(
            findLessonWordGlosses(
                'I will repent me of the evil that I thought',
            ),
        ).toHaveLength(1);
        expect(
            findLessonWordGlosses(
                "Then Jonah prayed unto the LORD his God out of the fish's belly",
            ),
        ).toEqual([
            expect.stringContaining('says no word of sorrow'),
            // BN-111: and the sign Jesus made of it, to whom he made it.
            expect.stringContaining('as Jesus told it'),
        ]);
        // A people turning from their evil is no such phrase.
        expect(
            findLessonWordGlosses('they turned from their evil way'),
        ).toEqual([]);
    });

    // BN-106 (2026-11-11): what blind reads found again and again -- the
    // prodigal's father "ignores the request" the son never made, the
    // shepherd "goes into the wilderness" where Luke leaves the ninety and
    // nine, the priest "the highest religious leader".
    test('Luke 15 and the priest, as Scripture says them', () => {
        expect(
            findLessonWordGlosses(
                'And am no more worthy to be called thy son: make me as one ' +
                    'of thy hired servants.',
            ),
        ).toEqual([expect.stringContaining('at home he never said it')]);
        expect(
            findLessonWordGlosses(
                'doth not leave the ninety and nine in the wilderness, and go',
            ),
        ).toEqual([expect.stringContaining('ninety and nine are LEFT')]);
        // Matthew's shepherd goes into the mountains: nothing to correct.
        expect(
            findLessonWordGlosses(
                'doth he not leave the ninety and nine, and goeth into the ' +
                    'mountains',
            ),
        ).toEqual([]);
        expect(
            findLessonWordGlosses('there came down a certain priest'),
        ).toEqual([
            expect.stringMatching(/^priest: in Israel, ONE of the many/),
        ]);
        // Why they passed by is a reason Luke never gives.
        expect(
            findLessonWordGlosses(
                'and when he saw him, he passed by on the other side.',
            ),
        ).toEqual([expect.stringContaining('Luke gives no reason why')]);
        // The chief priests and the high priest are no one-of-many.
        expect(
            findLessonWordGlosses('the chief priests and the scribes'),
        ).toEqual([expect.stringMatching(/^scribe: /)]);
        expect(findLessonWordGlosses('a great high priest')).toEqual([]);
    });

    // BN-108 (2026-11-11, the BN-106/107 read): "not a limit of 497", and a
    // choked hearer "still a believer? Yes".
    test('a count given, and a question the parable leaves open', () => {
        expect(
            findLessonWordGlosses(
                'I say not unto thee, Until seven times: but, Until seventy ' +
                    'times seven.',
            ),
        ).toEqual([expect.stringContaining('four hundred and ninety')]);
        expect(
            findLessonWordGlosses(
                'and the deceitfulness of riches, choke the word, and he ' +
                    'becometh unfruitful.',
            ),
        ).toEqual([expect.stringContaining('neither asks nor answers that')]);
    });

    // BN-109 (2026-11-11): Isaiah 40's Christ section had Jesus "faint"
    // on the cross, in three reads.
    test('the LORD fainteth not, and Jesus is never said to faint', () => {
        expect(
            findLessonWordGlosses(
                'the Creator of the ends of the earth, fainteth not, neither ' +
                    'is weary?',
            ),
        ).toEqual([expect.stringContaining('but is never said to faint')]);
    });

    // BN-111 (2026-11-11, the BN-106/107 read): Jesus told Jonah's sign to
    // "His friends", and the fellowservant owed "a few pence".
    test("Jonah's sign as Jesus gave it, and an hundred pence", () => {
        expect(
            findLessonWordGlosses(
                'And Jonah was in the belly of the fish three days and three ' +
                    'nights.',
            ),
        ).toEqual([
            expect.stringContaining(
                '"certain of the scribes and of the Pharisees"',
            ),
        ]);
        expect(
            findLessonWordGlosses(
                'which owed him an hundred pence: and he laid hands on him',
            ),
        ).toEqual([
            expect.stringMatching(/^penny, pence: /),
            expect.stringContaining('never "a few pence"'),
        ]);
    });

    // BN-115 (2026-11-11, the BN-108..112 read): Goliath's armour given a
    // gap, Nineveh "healed by Jonas", Nicodemus "asking about" miracles.
    test('a detail the text never gives, and settings as they are told', () => {
        expect(
            findLessonWordGlosses(
                'and smote the Philistine in his forehead, that the stone ' +
                    'sunk into his forehead',
            ),
        ).toEqual([expect.stringContaining('gives no gap in his armour')]);
        expect(
            findLessonWordGlosses(
                'because they repented at the preaching of Jonas; and, ' +
                    'behold, a greater than Jonas is here.',
            ),
        ).toEqual([expect.stringContaining('no one was healed')]);
        expect(
            findLessonWordGlosses('The same came to Jesus by night, and said'),
        ).toEqual([expect.stringContaining('owning the miracles')]);
    });

    // BN-116 (2026-11-11, the BN-113..115 read): Paul's words about the
    // Pharisees were given to John 3:1's Nicodemus as the text's own.
    test("a Pharisee's party in plain words, Paul's words as his", () => {
        expect(findLessonWordGlosses('a man of the Pharisees')).toEqual([
            expect.stringMatching(
                /^Pharisee: of the strictest party .*Paul, once one, called it "the most straitest sect of our religion" \(Acts 26:5\)/,
            ),
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
