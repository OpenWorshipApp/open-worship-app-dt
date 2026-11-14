import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

    // BN-151 (ab30, Opus: an error): "Goliath's armor was measured in
    // 'shekels' of brass and 'cubits' of length" -- the cubit measures his
    // height, the shekel weighs his armour.
    test('a cubit measures length and height, never a weight', () => {
        const [gloss] = findLessonWordGlosses(
            'whose height was six cubits and a span',
        );
        expect(gloss).toMatch(/^cubit: a measure of length and height/);
        expect(gloss).toContain('never of weight');
        expect(gloss).toContain('HEIGHT "was six cubits and a span"');
    });

    // BN-242 (ab81, both readers): "the pricks" as spikes of a yoke.
    test('the pricks are the goad', () => {
        const [gloss] = findLessonWordGlosses(
            'it is hard for thee to kick against the pricks',
        );
        expect(gloss).toMatch(/^pricks: the goad/);
        expect(gloss).toContain('never part of the yoke');
        // BN-244 (ab82): no second verse for the model to cite for what it
        // does not say.
        expect(gloss).not.toContain('Judges');
    });

    // BN-241 (ab78..ab80): KJV words a reader found given another sense.
    test('charity, under the heaven, evidence and humbled, as Scripture uses them', () => {
        const glossOf = (text: string) => {
            return findLessonWordGlosses(text)[0] ?? '';
        };
        expect(glossOf('Charity suffereth long, and is kind')).toMatch(
            /^charity: love/,
        );
        expect(glossOf('a time to every purpose under the heaven')).toContain(
            'in this world',
        );
        expect(glossOf('the evidence of things not seen')).toContain(
            'faith itself is the evidence',
        );
        expect(
            glossOf(
                'My soul hath them still in remembrance, and is humbled in me',
            ),
        ).toContain('bowed down in grief');
    });

    // BN-239 (ab79, both readers): "A furlong is a distance of about 1,200
    // feet" in a lesson on John 11.
    test('a furlong is measured, beside the verse that uses it', () => {
        const [gloss] = findLessonWordGlosses(
            'Now Bethany was nigh unto Jerusalem, about fifteen furlongs off',
        );
        expect(gloss).toMatch(/^furlong: a measure of distance/);
        expect(gloss).toContain('about 600 feet');
        expect(gloss).toContain('(John 11:18)');
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
            // BN-123: and David's words, their wrong reading named.
            expect.stringContaining('(1 Samuel 17:39)'),
        ]);
        expect(
            findLessonWordGlosses('thou anointest my head with oil'),
        ).toEqual([expect.stringContaining('(Luke 7:46)')]);
        // Every sense the Bible gives the word: a blot is a stain too, and
        // a contrite spirit may be crushed by trouble, not by sin.
        expect(findLessonWordGlosses('if any blot hath cleaved')).toEqual([
            expect.stringContaining(
                'the noun "blot" is a spot on the hands, "if any blot hath ' +
                    'cleaved to mine hands" (Job 31:7)',
            ),
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

    // BN-121 (2026-11-11, the BN-116/117 read): the robe, ring and shoes
    // left unexplained, and Psalm 51 never saying why David fears being
    // cast away.
    test("the father's gifts and the Spirit taken, by Scripture", () => {
        expect(
            findLessonWordGlosses(
                'Bring forth the best robe, and put it on him; and put a ring ' +
                    'on his hand, and shoes on his feet:',
            ),
        ).toEqual([
            expect.stringMatching(
                /^the best robe, a ring, shoes \(Luke 15:22\): .*\(Genesis 41:41-42\).*of the shoes Luke says nothing more$/,
            ),
        ]);
        expect(
            findLessonWordGlosses(
                'Cast me not away from thy presence; and take not thy holy ' +
                    'spirit from me.',
            ),
        ).toEqual([
            // BN-161 (ab33, ab35, both readers): the Saul half read as the
            // psalm's own reason.
            expect.stringContaining(
                '"came upon David" when Samuel anointed him (1 Samuel 16:13); ' +
                    'David asks God not to take it -- the psalm gives no ' +
                    'other reason',
            ),
        ]);
        expect(
            findLessonWordGlosses('take not thy holy spirit from me')[0],
        ).not.toContain('Saul');
    });

    // BN-123 (2026-11-11, the BN-116/117 read, Opus): four meanings the
    // text does not give, each read with an entry beside it -- named now.
    test('the wrong reading is named where it was made', () => {
        expect(
            findLessonWordGlosses(
                'And David said unto Saul, I cannot go with these; for I have ' +
                    'not proved them.',
            ),
        ).toEqual([
            expect.stringMatching(/^prove, proved: /),
            expect.stringContaining('never that it did not fit'),
        ]);
        // The general entry carries no David into Romans 12:2.
        expect(
            findLessonWordGlosses('that ye may prove what is that good'),
        ).toEqual([expect.not.stringContaining('David')]);
        expect(
            findLessonWordGlosses(
                'He restoreth my soul: he leadeth me in the paths',
            ),
        ).toEqual([
            expect.stringMatching(
                /\(Ruth 4:15\) -- never a sheep cast on its back/,
            ),
        ]);
        expect(
            findLessonWordGlosses('and delivered him to the tormentors'),
        ).toEqual([
            // BN-158 (ab33, Opus): "lose the joy and peace of the mercy".
            expect.stringMatching(
                /never only the torment of a bitter heart, never softened into a loss of joy or peace; .*never a picture of Christ or his cross$/,
            ),
        ]);
        expect(
            findLessonWordGlosses(
                'doth not leave the ninety and nine in the wilderness, and go',
            ),
        ).toEqual([expect.stringContaining('never "because they were safe"')]);
    });

    // BN-126 (2026-11-11, the BN-118..124 read): the father "ran while the
    // son was still speaking"; a children's Jonah with his reason guessed
    // and Nineveh "a city" with no setting.
    test('the order Luke tells, and Jonah as his book tells him', () => {
        expect(
            findLessonWordGlosses(
                'And am no more worthy to be called thy son: make me as one ' +
                    'of thy hired servants.',
            ),
        ).toEqual([
            expect.stringContaining(
                '"ran, and fell on his neck, and kissed him" (15:20) before ' +
                    'the son said a word',
            ),
        ]);
        expect(
            findLessonWordGlosses(
                'Arise, go to Nineveh, that great city, and cry against it. ' +
                    'But Jonah rose up to flee unto Tarshish',
            ),
        ).toEqual([
            expect.stringMatching(/\(Jonah 4:2\); never that he was afraid$/),
            expect.stringMatching(/^Nineveh: .*\(2 Kings 19:36\)/),
        ]);
        // Matthew 12:41, read before the sower, gets no Assyria.
        expect(
            findLessonWordGlosses(
                'The men of Nineveh shall rise in judgment with this ' +
                    'generation',
            ),
        ).toEqual([]);
    });

    // BN-126 (2026-11-11, the BN-118..124 read, both readers): the one
    // fact of Scripture a background left out, beside its passage.
    test('the setting Scripture itself gives, by the passage own words', () => {
        expect(
            findLessonWordGlosses(
                'that he should defy the armies of the living God?',
            ),
        ).toEqual([
            expect.stringMatching(/already anointed .*\(16:13\).*\(17:11\)$/),
        ]);
        expect(
            findLessonWordGlosses('My son, forget not my law; but let'),
        ).toEqual([expect.stringContaining("never call it the LORD's law")]);
        expect(
            findLessonWordGlosses(
                'and speakest, O Israel, My way is hid from the LORD',
            ),
        ).toEqual([
            expect.stringContaining('"shall be carried to Babylon" (39:6)'),
        ]);
        expect(
            findLessonWordGlosses(
                'that now at the last your care of me hath flourished again',
            ),
        ).toEqual([expect.stringContaining('(4:18)')]);
    });

    // BN-128 (2026-11-11): John 3:16 answered with reasons it never gives.
    test('John 3:16 gives its own reason, and no other', () => {
        expect(
            findLessonWordGlosses(
                'For God so loved the world, that he gave his only begotten ' +
                    'Son, that whosoever believeth in him should not perish',
            ),
        ).toEqual([
            expect.stringMatching(
                // BN-131: and the reasons given in its place, named.
                /"For God so loved the world".*\(3:14\) -- never a reason these verses do not give: why it had to be the Son, an "only way", justice satisfied or a payment of equal value are not in them/,
            ),
        ]);
    });

    // BN-130 (2026-11-11): the Good Samaritan told as an allegory of Christ,
    // the lawyer's own questions never read.
    test("the lawyer's questions the parable answers", () => {
        expect(
            findLessonWordGlosses(
                'But he, willing to justify himself, said unto Jesus, And who ' +
                    'is my neighbour?',
            ),
        ).toEqual([
            expect.stringMatching(
                /\(10:25\).*\(10:28\).*\(10:37\) -- told as the answer to him, never an allegory of Christ$/,
            ),
        ]);
        // BN-158 (ab33, Opus: 24 -> 18): "Jesus does not say eternal life
        // is earned by feelings, but by doing what the law commands".
        expect(
            findLessonWordGlosses('willing to justify himself')[0],
        ).toContain('never told as eternal life earned by our doing');
    });

    // BN-138 (2026-11-11, the BN-130..132 read): the Good Samaritan's verses
    // before told as "Jesus had just spoken to the people of Capernaum".
    test('the woe on the towns is said of them, to those with Jesus', () => {
        expect(
            findLessonWordGlosses(
                'Woe unto thee, Chorazin! woe unto thee, Bethsaida! ... And ' +
                    'thou, Capernaum, which art exalted to heaven',
            ),
        ).toEqual([
            expect.stringMatching(
                /^Chorazin, Bethsaida, Capernaum: .*the seventy as he sends them out in Luke 10:1-16 -- never to the towns' people$/,
            ),
        ]);
        expect(
            findLessonWordGlosses('he taught in Capernaum by the sea'),
        ).toEqual([]);
    });

    test('a long story carries eight at most', () => {
        const words =
            'pence talents mites shekels publicans Levites priests ' +
            'Samaritans Pharisees scribes hyssop tabernacle sling';
        expect(findLessonWordGlosses(words)).toHaveLength(8);
    });

    // BN-141 (2026-11-11, the BN-137..139 read, Sonnet: an error): 1 Samuel
    // 17 holds eight of the words, and the entry for verse 49 -- no gap in
    // Goliath's armour -- was cut; "the stone found the only gap" followed.
    test("a verse's own entry is carried before the words", () => {
        const found = findLessonWordGlosses(
            'shekels of brass ... a span ... after the cubit ... a sling ... ' +
                'this uncircumcised Philistine ... I have not proved them ' +
                '... a coat of mail ... the armies of the living God ... ' +
                'the stone sunk into his forehead',
        );
        expect(found).toHaveLength(8);
        expect(found).toContainEqual(
            expect.stringContaining('gives no gap in his armour'),
        );
        expect(found).toContainEqual(
            expect.stringMatching(/^I have not proved them/),
        );
        // The words' entries fill what is left, in list order.
        expect(
            found.filter((gloss) => {
                return /^(?:shekel|sling|cubit|uncircumcised|span|prove)/.test(
                    gloss,
                );
            }),
        ).toHaveLength(4);
    });

    // BN-264 (ab90..ab94, Opus in three batches): Habakkuk's "mine high
    // places" read as the trials themselves.
    test('high places are both senses, each quoted as the KJV reads', () => {
        const [gloss] = findLessonWordGlosses(
            '(19): The LORD God is my strength, and he will make my feet ' +
                "like hinds' feet, and he will make me to walk upon mine high " +
                'places.',
        );
        expect(gloss).toMatch(/^high places: two senses/);
        expect(gloss).toContain('altars of idols');
        expect(gloss).toContain('never the trial itself');
        const kjv = JSON.parse(
            readFileSync(
                join(
                    __dirname,
                    '..',
                    'helper',
                    'bible-helpers',
                    'bible-data',
                    'kjvBibleBooks.json',
                ),
                'utf8',
            ),
        );
        for (const [quote, book, chapter, verse] of [
            ['removed', '2KI', 18, 4],
            ['he will make me to walk upon mine high places', 'HAB', 3, 19],
            ['setteth me upon my high places', 'PSA', 18, 33],
            ['thou shalt tread upon their high places', 'DEU', 33, 29],
        ] as const) {
            expect(gloss).toContain(`"${quote}"`);
            expect(kjv[book][chapter][verse], quote).toContain(quote);
        }
    });

    // BN-267 (ab94, ab96, Opus): Jehovahjireh given 22:14's saying as its
    // meaning -- and again in batch NI with the saying beside the name in
    // this entry, so the entry gives the meaning alone.
    test("Jehovahjireh is the LORD's providing, the saying left out", () => {
        const [gloss] = findLessonWordGlosses(
            '(14): And Abraham called the name of that place Jehovahjireh: ' +
                'as it is said to this day, In the mount of the LORD it shall ' +
                'be seen.',
        );
        expect(gloss).toMatch(/^Jehovahjireh means "the LORD will provide"/);
        expect(gloss).toContain('"God will provide himself a lamb"');
        expect(gloss).not.toContain('In the mount');
        const kjv = JSON.parse(
            readFileSync(
                join(
                    __dirname,
                    '..',
                    'helper',
                    'bible-helpers',
                    'bible-data',
                    'kjvBibleBooks.json',
                ),
                'utf8',
            ),
        );
        expect(kjv.GEN[22][8]).toContain('God will provide himself a lamb');
        expect(kjv.GEN[22][14]).toContain(
            'In the mount of the LORD it shall be seen',
        );
    });

    // BN-270 (ab97, ab98, Opus): "restoreth my soul" glossed with the clause
    // after it.
    test('"restoreth my soul" is explained on its own, by Scripture', () => {
        const [gloss] = findLessonWordGlosses(
            '(3): He restoreth my soul: he leadeth me in the paths of ' +
                "righteousness for his name's sake.",
        );
        expect(gloss).toMatch(/^restoreth my soul \(Psalm 23:3\): brings my/);
        expect(gloss).toContain('a clause of its own');
        const kjv = JSON.parse(
            readFileSync(
                join(
                    __dirname,
                    '..',
                    'helper',
                    'bible-helpers',
                    'bible-data',
                    'kjvBibleBooks.json',
                ),
                'utf8',
            ),
        );
        for (const [quote, book, chapter, verse] of [
            ['a restorer of thy life', 'RUT', 4, 15],
            ['he leadeth me in the paths of righteousness', 'PSA', 23, 3],
        ] as const) {
            expect(gloss).toContain(`"${quote}"`);
            expect(kjv[book][chapter][verse], quote).toContain(quote);
        }
    });

    // BN-272 (ab99, both readers): Isaiah 44:22's cloud made "a stain
    // removed from a garment" -- the noun's stain had stood beside it.
    test('blot out is wiped away like a cloud; the noun blot apart', () => {
        const [gloss] = findLessonWordGlosses(
            '(5): And cover not their iniquity, and let not their sin be ' +
                'blotted out from before thee.',
        );
        expect(gloss).toMatch(/^blot out \(the verb\): to wipe away/);
        expect(gloss).toContain(
            "never Isaiah 44:22's picture, which is a cloud",
        );
        const kjv = JSON.parse(
            readFileSync(
                join(
                    __dirname,
                    '..',
                    'helper',
                    'bible-helpers',
                    'bible-data',
                    'kjvBibleBooks.json',
                ),
                'utf8',
            ),
        );
        for (const [quote, book, chapter, verse] of [
            ['as a thick cloud', 'ISA', 44, 22],
            ['out of my book', 'EXO', 32, 33],
            ['if any blot hath cleaved to mine hands', 'JOB', 31, 7],
        ] as const) {
            expect(gloss).toContain(`"${quote}"`);
            expect(kjv[book][chapter][verse], quote).toContain(quote);
        }
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
