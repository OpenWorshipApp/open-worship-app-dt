import { describe, expect, test } from 'vitest';

import {
    findLessonLegends,
    findLessonLegendsLeft,
    findLessonLegendsNew,
    genLessonLegendNote,
} from './lessonLegendHelpers';

// BN-142 (2026-11-11, the blind reads ab26..ab28): the errors that outlived
// every instruction were sermons' details no verse gives.

describe("a sermon's detail no verse gives, found in a lesson", () => {
    // BN-229 (the held-out reads ab69..ab73): five batches set a crowd at
    // the Olivet discourse, which Matthew 24:3 gives the disciples alone.
    test('a crowd at the Olivet discourse', () => {
        const found = findLessonLegends(
            '[^Matthew 25:14-30]\n## Background\nJesus is speaking to his ' +
                'disciples and a crowd about the end of the age.',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain(
            '"the disciples came unto him privately"',
        );
        expect(
            findLessonLegends(
                '[^Matthew 25:14-30]\n## Background\nJesus is speaking to ' +
                    'his disciples privately on the Mount of Olives.',
            ),
        ).toEqual([]);
    });

    // BN-233 (ab75, ab76): four sermon tellings no verse gives.
    test('the Red Sea, Carmel, Lazarus and Acts 2:33 as the verses tell them', () => {
        const cases: [string, string][] = [
            [
                '[^Exodus 14:15-22]\n**What it means:** "Go forward" is the ' +
                    'step of faith taken before the water has actually moved.',
                'Exodus 14:21-22',
            ],
            // BN-239 (ab79): the same telling in other words.
            [
                '[^Exodus 14:15-22]\n**What it means:** It means acting on ' +
                    "God's word even while the sea is still a wall of water.",
                'Exodus 14:21-22',
            ],
            [
                '[^Exodus 14:15-22]\nAs they obey and move, the LORD causes ' +
                    'the sea to go back by a strong east wind.',
                'Exodus 14:21-22',
            ],
            [
                '[^1 Kings 18:20-46]\n**A hearer asks:** Why did Elijah have ' +
                    'to pray seven times before the rain came?',
                '1 Kings 18:42-44',
            ],
            [
                '[^John 11:1-44]\n- Why do you think Jesus waited four days ' +
                    'before going to Lazarus?',
                'John 11:6',
            ],
            [
                '[^Acts 2:1-13]\nJesus is the one who "poured out" the ' +
                    'Spirit upon us [^(KJV) Acts 2:33].',
                'Acts 2:33',
            ],
        ];
        for (const [text, ref] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain(ref);
        }
        // Told as the verses tell them: let be.
        for (const text of [
            '[^Exodus 14:15-22]\nThe sea was divided, and they went in on ' +
                'dry ground.',
            '[^Exodus 14:15-22]\nThe waters were a wall unto them on their ' +
                'right hand and on their left.',
            '[^1 Kings 18:20-46]\nHis servant went up seven times to look ' +
                'toward the sea.',
            '[^John 11:1-44]\nLazarus had lain in the grave four days.',
            '[^Acts 2:1-21]\n"I will pour out of my Spirit" [^Acts 2:17].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-234 (ab77): John's lad set in Matthew 14's feeding.
    test("John's lad in a lesson on Matthew 14", () => {
        const found = findLessonLegends(
            '[^Matthew 14:13-21]\n- How do you think the boy felt when ' +
                'Jesus used his small lunch to feed everyone?',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('John 6:9');
        for (const text of [
            // John's own telling, or the lad named with his verse.
            '[^John 6:1-14]\nA lad had five barley loaves and two fishes.',
            '[^Matthew 14:13-21]\nJohn adds that a lad brought the loaves ' +
                '[^John 6:9].',
            // No boy at all.
            '[^Matthew 14:13-21]\nThey had but five loaves and two fishes.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-235 (ab75..ab77): the woman at the well shunned, and 1
    // Corinthians 13:5's two phrases mixed.
    test('the well and "is not easily provoked" as the verses tell them', () => {
        const cases: [string, string][] = [
            [
                '[^John 4:1-42]\nA woman walks to a well in the heat of the ' +
                    'day, carrying a heavy jar and avoiding the eyes of her ' +
                    'neighbors.',
                'John 4:6-7',
            ],
            [
                '[^John 4:1-42]\n- Why do you think the woman was drawing ' +
                    'water at the sixth hour (noon) instead of the usual time?',
                'John 4:6-7',
            ],
            [
                '[^John 4:1-42]\nShe carried a life that has left her ' +
                    'avoided by her own people.',
                'John 4:6-7',
            ],
            [
                '[^1 Corinthians 13:4-7]\n"is not easily provoked" and ' +
                    '"rejoiceth... in the truth" means love doesn\'t keep a ' +
                    'score of wrongs.',
                '1 Corinthians 13:5',
            ],
        ];
        for (const [text, ref] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain(ref);
        }
        for (const text of [
            // The Jews' own distance is the verse's (4:9).
            '[^John 4:1-42]\nWhy would Jesus ask a Samaritan woman for a ' +
                'drink when his own people avoid her?',
            '[^John 4:1-42]\nShe came at the sixth hour; perhaps she came ' +
                'then to avoid the other women.',
            '[^John 4:1-42]\nIt was about the sixth hour when she came.',
            '[^1 Corinthians 13:4-7]\nIt is not easily provoked; it ' +
                'thinketh no evil, keeping no record of wrongs.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-248 (ab81..ab84): Gideon's order, the thief's words, Luke's veil.
    test('the fleece, "nothing amiss" and the veil as their verses tell them', () => {
        const cases: [string, string][] = [
            [
                '[^Judges 7:1-25]\nAfter Gideon destroyed the altar of Baal ' +
                    'and tested God with a fleece of wool [^Judges 6:36-40], ' +
                    'he gathered an army from several tribes to fight.',
                'Judges 6:34-36',
            ],
            [
                // BN-249 (batch MG): "before gathering", the same order.
                '[^Judges 7:1-25]\nGideon had just tested God with a fleece ' +
                    'of wool to confirm his calling [^(KJV) Judges 6:36-40] ' +
                    'before gathering an army to face the Midianites.',
                'Judges 6:34-36',
            ],
            [
                '[^Judges 7:1-25]\nHe summoned the tribes of Manasseh and ' +
                    'Asher only after the fleece was wet [^Judges 6:38].',
                'Judges 6:34-36',
            ],
            [
                '[^Luke 23:32-49]\nThe passage says of the thief, "this man ' +
                    'hath done nothing amiss" [^Luke 23:41].',
                'Luke 23:41',
            ],
            [
                '[^Luke 23:32-49]\nIn his final hours, he realizes he has ' +
                    '"done nothing amiss" in comparison to the holiness of Christ.',
                'Luke 23:41',
            ],
            [
                '[^Luke 23:32-49]\nThe "veil of the temple was rent in the ' +
                    'midst," the heavy curtain torn from top to bottom.',
                'Luke 23:45',
            ],
        ];
        for (const [text, ref] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain(ref);
        }
        for (const text of [
            "[^Judges 7:1-25]\nGideon had recently tested God's promise " +
                'with a fleece of wool [^Judges 6:36-40].',
            '[^Judges 7:1-25]\nGideon tested God with a fleece ' +
                '[^Judges 6:36-40] after the tribes had gathered to him ' +
                '[^Judges 6:35], and before the battle was joined.',
            '[^Luke 23:32-49]\nThe passage says of Jesus, "this man hath ' +
                'done nothing amiss" [^Luke 23:41].',
            '[^Luke 23:32-49]\nThe passage says of the criminal, "this man ' +
                'hath done nothing amiss", referring to Jesus.',
            '[^Luke 23:32-49]\nThe veil was rent in the midst [^Luke 23:45].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-252 (batch MH): a legend told in three sentences is named in all
    // three, each legend's first sentence before any second.
    test('every sentence a legend fits is named, within the cap', () => {
        const text =
            '[^1 John 4:7-21]\n' +
            'We love one another as the only true evidence that we know ' +
            'Him.\n' +
            'God is love, and the only way to prove we know Him is to love.\n' +
            'Why does John say that loving others is the only way to ' +
            'truly know God?';
        const found = findLessonLegends(text);
        expect(found.map((one) => one.sentence)).toEqual([
            'We love one another as the only true evidence that we know Him.',
            'God is love, and the only way to prove we know Him is to love.',
            'Why does John say that loving others is the only way to truly ' +
                'know God?',
        ]);
        // Never past four: a second sentence waits behind another
        // legend's first.
        const crowded =
            '[^1 John 4:7-21] [^1 Samuel 3:1-21]\n' +
            'We love one another as the only true evidence that we know ' +
            'Him.\n' +
            'Love is the only true proof of faith.\n' +
            'Love is the only true evidence of life.\n' +
            'Love is the only real evidence there is.\n' +
            'Each time, Samuel ran to Eli, and each time Eli said, "I ' +
            'called not."';
        const crowdedFound = findLessonLegends(crowded);
        expect(crowdedFound).toHaveLength(4);
        expect(crowdedFound[1].text).toContain('1 Samuel 3:5-9');
    });

    // BN-254 (ab85, ab86): Gideon's plan, the men sent home, Jeremiah 29:14.
    test("Gideon's plan, the men sent home and Jeremiah 29:14", () => {
        const cases: [string, string][] = [
            [
                '[^Judges 7:1-25]\nBy breaking the pitchers and blowing the ' +
                    "trumpets, the three hundred men followed the Lord's " +
                    'command [^(KJV) Judges 7:19-20].',
                'Judges 7:16-18',
            ],
            [
                "[^Judges 7:1-25]\nThe victory came by following God's " +
                    'specific, unusual instructions: trumpets and pitchers.',
                'Judges 7:16-18',
            ],
            [
                // Batch MI: the same claim in softer words.
                '[^Judges 7:1-25]\nThe "trumpets" and "pitchers" were not ' +
                    'weapons of war, but tools of a divine strategy.',
                'Judges 7:16-18',
            ],
            [
                '[^Judges 7:1-25]\n## 1. God removes the fearful and the ' +
                    'overconfident',
                'Judges 7:3, 7:5-7',
            ],
            [
                '[^Judges 7:1-25]\n## 1. God removes the proud and the fearful',
                'Judges 7:3, 7:5-7',
            ],
            [
                // Batch MK.
                '[^Judges 7:1-25]\n## 1. God removes those who are fearful ' +
                    'and those who would boast',
                'Judges 7:3, 7:5-7',
            ],
            [
                '[^Jeremiah 29:11-14]\nHe promises that He "will be found" ' +
                    'by those who seek Him [^(KJV) Jeremiah 29:12-13].',
                'Jeremiah 29:14',
            ],
        ];
        for (const [text, ref] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain(ref);
        }
        for (const text of [
            "[^Judges 7:1-25]\nGideon obeyed the LORD's command to go down " +
                'to the host [^Judges 7:9].',
            "[^Judges 7:1-25]\nGideon put a trumpet in every man's hand " +
                '[^Judges 7:16].',
            '[^Judges 7:1-25]\nGod removed the men so that Israel would not ' +
                'be proud [^Judges 7:2].',
            '[^Jeremiah 29:11-14]\nHe "will be found" of them ' +
                '[^(KJV) Jeremiah 29:14].',
            '[^Jeremiah 29:11-14]\nThey shall seek and find [^Jeremiah ' +
                '29:13], for He will be found [^Jeremiah 29:14].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-258 (ab90): Christ called the bond Colossians 3:14 says love is.
    test("Colossians 3:14's bond is charity's, not Christ's", () => {
        const found = findLessonLegends(
            '[^Colossians 3:12-17]\nHe is the "bond of perfectness" because ' +
                'He reconciled us to God and to one another.',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('Colossians 3:14');
        for (const text of [
            '[^Colossians 3:12-17]\nPaul calls charity the "bond of ' +
                'perfectness" [^Colossians 3:14].',
            '[^Colossians 3:12-17]\nPut on charity, which is the bond of ' +
                'perfectness.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-260 (ab90..ab92): five tellings of the fourth held-out set, each
    // as a lesson wrote it, and the passages' own tellings left alone.
    test('the fourth held-out set: told as no verse tells it', () => {
        for (const [text, verse] of [
            [
                '[^Mark 5:21-34]\nJesus calls her "Daughter," the only time ' +
                    'in the Gospels he addresses a woman this way.',
                'Mark 5:34',
            ],
            [
                '[^Mark 5:21-34]\nWhen Jesus calls her "Daughter," he uses a ' +
                    'term he does not use for anyone else in the Gospels.',
                'Mark 5:34',
            ],
            [
                '[^Daniel 3:16-28]\nThe three friends saw that "the form of ' +
                    'the fourth is like the Son of God" [^(KJV) Daniel 3:25].',
                'Daniel 3:24-25',
            ],
            [
                '[^Genesis 22:1-19]\nHe obeyed the command fully, trusting ' +
                    'that even if Isaac died, God could raise him.',
                'Hebrews 11:19',
            ],
            [
                '[^Acts 10:34-48]\nPeter had a vision of unclean animals and ' +
                    'a voice telling him not to call any man common or ' +
                    'unclean [^(KJV) Acts 10:15].',
                'Acts 10:15',
            ],
            [
                '[^John 13:1-17]\nIn the preceding verses, Jesus spoke of the ' +
                    'tragedy of those who loved the praise of men more than ' +
                    'the praise of God [^(KJV) John 12:43].',
                'John 12:42-43',
            ],
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain(verse);
        }
        for (const text of [
            '[^Mark 5:21-43]\nJairus had no one else to turn to for his ' +
                'little daughter.',
            '[^Mark 5:21-34]\nJesus calls her "Daughter" and sends her home ' +
                'in peace [^Mark 5:34].',
            '[^Daniel 3:16-28]\nThe king saw four men loose, and the form of ' +
                'the fourth was like the Son of God [^Daniel 3:25].',
            '[^Daniel 3:16-28]\nNebuchadnezzar said, "Lo, I see four men ' +
                'loose," and the three friends came out unhurt.',
            '[^Genesis 22:1-19]\nHebrews tells us he reckoned God could raise ' +
                'him up [^Hebrews 11:19].',
            '[^Genesis 22:1-19]\nGod would raise him from the dead: Jesus, ' +
                'the Lamb God provided.',
            '[^Acts 10:34-48]\nGod had shewed Peter that he should not call ' +
                'any man common or unclean [^Acts 10:28].',
            '[^Acts 10:34-48]\nPeter, after a vision from God showing him not ' +
                'to call any man common or unclean, went to Caesarea.',
            '[^John 13:1-17]\nJohn says the chief rulers loved the praise of ' +
                'men more than the praise of God [^John 12:43].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-269 (ab97, Opus): Habakkuk 3:3-15 told as the Chaldeans' coming.
    test("Habakkuk 3's vision is God's coming, not the Chaldeans'", () => {
        const found = findLessonLegends(
            '[^Habakkuk 3:17-19]\nHe looked upon the coming invasion of the ' +
                'Chaldeans, and saw the tents of Cushan and Midian tremble in ' +
                'affliction [^(KJV) Habakkuk 3:7].',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('"for the salvation of thy people"');
        for (const text of [
            '[^Habakkuk 3:17-19]\nAs Habakkuk hears of the coming invasion, ' +
                'he trembles in himself [^(KJV) Habakkuk 3:16].',
            '[^Habakkuk 3:17-19]\nGod had told him the Chaldeans would come ' +
                '[^Habakkuk 1:6].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-267 (ab80, ab96, batch NI): Jehovahjireh given 22:14's saying as
    // its meaning.
    test("Jehovahjireh's meaning is not the saying after it", () => {
        for (const text of [
            '[^Genesis 22:1-19]\n"Jehovahjireh" is the name Abraham gave ' +
                'the place, meaning "In the mount of the LORD it shall be ' +
                'seen" [^(KJV) Genesis 22:14].',
            '[^Genesis 22:1-19]\nAbraham called the place Jehovahjireh, ' +
                'which is translated as "In the mount of the LORD it shall be ' +
                'seen".',
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain('"the LORD will provide"');
        }
        for (const text of [
            '[^Genesis 22:1-19]\n"Jehovahjireh" means the LORD will provide.',
            '[^Genesis 22:1-19]\nHe named it Jehovahjireh; and it is said, ' +
                '"In the mount of the LORD it shall be seen" [^Genesis 22:14].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-271 (ab93, ab98): the entry into Jerusalem put "during the
    // Passover feast".
    test('Jesus came into Jerusalem before the Passover, not during it', () => {
        const found = findLessonLegends(
            '[^Matthew 21:1-17]\nHe enters the city during the Passover ' +
                'feast, when the city was crowded with pilgrims.',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('"six days before the passover"');
        for (const text of [
            '[^Matthew 21:1-17]\nHe enters the city during the Passover ' +
                'season, when the city was crowded with pilgrims.',
            '[^Matthew 21:1-17]\nHe came to Jerusalem as the Passover drew ' +
                'near.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-267 (ab92..ab96): Matthew 21's crowd waving palm branches.
    test("Matthew's crowd cut branches; the palms are John's", () => {
        const found = findLessonLegends(
            '[^Matthew 21:1-17]\nImagine a city street filled with people ' +
                'shouting, waving palm branches, and laying their own clothes ' +
                'on the dusty ground.',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('branches from the trees');
        for (const text of [
            '[^Matthew 21:1-17]\nOn this Palm Sunday, the crowd spread ' +
                'branches from the trees in the way.',
            '[^Matthew 21:1-17]\nJohn tells us they took branches of palm ' +
                'trees [^John 12:13].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-276 (ab101, both readers): the man let down through the roof given
    // years of illness Mark 2 does not give.
    // BN-290 (ab109, ab110, Opus): Luke 12:15's reason made covetousness's.
    test("Luke 12:15's reason is not covetousness's belief", () => {
        const found = findLessonLegends(
            '[^Luke 12:13-21]\n**What it means:** "Covetousness" is an ' +
                'intense longing for more, often leading to a belief that "a ' +
                'man\'s life consisteth not in the abundance of the things".',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('the reason Jesus gives against');
        expect(
            findLessonLegends(
                '[^Luke 12:13-21]\nJesus warns against covetousness, "for a ' +
                    'man\'s life consisteth not in the abundance".',
            ),
        ).toEqual([]);
    });

    // BN-287 (ab108, ab109, both readers): Esther given a theology.
    test("Esther's fast is told without what she knew of God", () => {
        for (const text of [
            '[^Esther 4:10-17]\nShe called the fast because she knew her ' +
                "life was in the king's hands, but the king's heart was in " +
                "God's hands.",
            '[^Esther 4:10-17]\n**The passage answers:** She recognized ' +
                'that the battle was spiritual.',
            '[^Esther 4:10-17]\nShe needed the prayers of the Jews and ' +
                "God's intervention to move the king's heart.",
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain('the book never names God');
        }
        for (const text of [
            '[^Esther 4:10-17]\nShe asked the Jews to fast for her before ' +
                'she went in to the king.',
            "[^Proverbs 21:1-3]\nThe king's heart is in the hand of the LORD.",
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-286 (ab106..ab108, Sonnet): God said to change the princess's heart.
    test("the princess's compassion is told, not said to be put by God", () => {
        for (const text of [
            '[^Exodus 2:1-10]\n**The passage answers:** God put compassion ' +
                'in her heart.',
            '[^Exodus 2:1-10]\nGod changed the heart of the princess to make ' +
                'sure Moses grew up safely.',
            "[^Exodus 2:1-10]\nGod put this feeling in the heart of Pharaoh's " +
                'daughter so she would save him.',
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain('"she had compassion on him"');
        }
        for (const text of [
            '[^Exodus 2:1-10]\nShe "had compassion on him" and saved him.',
            '[^Exodus 2:1-10]\nThe children ask about the God who changed ' +
                "their father's heart.",
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-285 (ab107, both readers): the praise said to cause the earthquake.
    test("Acts 16's earthquake is not said to be caused by the praise", () => {
        for (const text of [
            '[^Acts 16:16-34]\nThis act of worship triggered a "great ' +
                'earthquake" that shook the foundations.',
            '[^Acts 16:16-34]\nGod sent the earthquake in response to their ' +
                'praise.',
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain('never say the praise caused it');
        }
        for (const text of [
            '[^Acts 16:16-34]\nAs they sang, suddenly there was a great ' +
                'earthquake.',
            '[^Acts 16:16-34]\nThe earthquake shook the foundations and ' +
                'opened all the doors.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-283 (ab103..ab105, Opus): three slips of the fifth held-out set.
    test("a brother's share, a double negative and Moses' sister", () => {
        for (const [text, said] of [
            [
                "[^Luke 12:13-21]\nHere, it is the root of the man's desire " +
                    "to have his brother's share of the inheritance.",
                'that he divide the inheritance with me',
            ],
            [
                "[^Luke 12:13-21]\nJesus warns that a man's life does not " +
                    '"consisteth not in the abundance of the things".',
                'two "not"s turn the verse round',
            ],
            [
                '[^Exodus 2:1-10]\nThe princess said yes! The helper went and ' +
                    "found the baby's own mother [^(KJV) Exodus 2:8].",
                'the maid of verse 8 is his sister',
            ],
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain(said);
        }
        for (const text of [
            '[^Luke 12:13-21]\nHe asked Jesus to make his brother divide the ' +
                'inheritance.',
            '[^Luke 12:13-21]\nA man\'s life "consisteth not in the abundance ' +
                'of the things which he possesseth".',
            '[^Exodus 2:1-10]\nThe princess said yes, and the maid went and ' +
                "called the child's mother [^(KJV) Exodus 2:8].",
            '[^Exodus 2:1-10]\nHis sister, the helper, went and called their ' +
                'mother.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-281 (ab104, Opus): Matthew 6:12 quoted turned round.
    test("the Lord's Prayer forgives as we forgive", () => {
        const found = findLessonLegends(
            '[^Matthew 6:9-13]\n- What makes it difficult to forgive others ' +
                '"as we are forgiven"?',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('as we forgive our debtors');
        for (const text of [
            '[^Matthew 6:9-13]\nHelp us to forgive as we have been forgiven.',
            '[^Matthew 6:9-13]\nWe pray "forgive us our debts, as we forgive ' +
                'our debtors".',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-277 (ab101, ab102, Opus): John 3:13 turned round, in two batches.
    test('John 3:13 says no man ascended, not that no one came down', () => {
        for (const text of [
            '[^John 3:1-21]\n**The passage answers:** Because no one has ' +
                'come down from heaven except the Son of man [^(KJV) John ' +
                '3:13].',
            '[^John 3:1-21]\n**The passage answers:** Because Jesus is the ' +
                'only one who "came down from heaven" [^(KJV) John 3:13].',
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain('"no man hath ascended up');
        }
        for (const text of [
            '[^John 3:1-21]\nNo man hath ascended up to heaven but he that ' +
                'came down from heaven [^John 3:13].',
            '[^John 3:1-21]\nOnly the Son of man, who came down from ' +
                'heaven, has gone up there.',
            '[^John 6:35-40]\nNo one but Jesus came down from heaven to do ' +
                "the Father's will.",
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-278 (ab101, ab102, Opus): Moses said to go back to the princess.
    test('baby Moses was brought to the princess by his mother', () => {
        const found = findLessonLegends(
            '[^Exodus 2:1-10]\nWhen the boy grew up, he went back to the ' +
                'princess, and she named him Moses.',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('"the child grew, and she brought him');
        expect(
            findLessonLegends(
                '[^Exodus 2:1-10]\nWhen the child grew, his mother brought him ' +
                    "back to Pharaoh's daughter.",
            ),
        ).toEqual([]);
    });

    test('the paralysed man of Mark 2 is given no length of illness', () => {
        const found = findLessonLegends(
            '[^Mark 2:1-12]\n**What it means:** "Take up thy bed" means the ' +
                'man was to lift the very mat he had been confined to for ' +
                'years, proving his complete restoration.',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('"one sick of the palsy');
        expect(found[0].text).toContain('(John 5:5), another man');
        for (const text of [
            '[^Mark 2:1-12]\nFor years he had lain paralysed on that mat.',
            '[^Luke 5:17-26]\nThe man was paralysed from birth.',
        ]) {
            expect(findLessonLegends(text), text).toHaveLength(1);
        }
        for (const text of [
            '[^Mark 2:1-12]\n**For example:** A person holds a grudge for ' +
                'years, remembering every word of a betrayal.',
            '[^Mark 2:1-12]\nThe man at Bethesda had lain there thirty and ' +
                'eight years [^John 5:5]; this man was carried by four.',
            '[^Mark 2:1-12]\nHe was sick of the palsy and could not walk.',
            '[^John 5:1-9]\nHe had been lying there for years.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-273 (ab96, ab100, Opus): every builder said to work by his home.
    test("Nehemiah 3's builders: some by their homes, others from away", () => {
        const found = findLessonLegends(
            '[^Nehemiah 4:1-23]\nIn chapter 3, the people worked together by ' +
                'sections, each repairing the part of the wall near their own ' +
                'home.',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('"the men of Jericho" (3:2)');
        for (const text of [
            '[^Nehemiah 4:1-23]\nThe priests repaired, every one over ' +
                'against his house [^Nehemiah 3:28].',
            '[^Nehemiah 4:1-23]\nSome repaired the wall near their own homes, ' +
                'and others came from Jericho and Tekoa.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-266 (ab95, Opus): Nehemiah's builders said to have fought.
    test("Nehemiah's builders built and watched; no fight came", () => {
        const found = findLessonLegends(
            "[^Nehemiah 4:1-23]\nWhile Nehemiah's people fought with " +
                'swords to rebuild a physical wall, Jesus fought a spiritual ' +
                'battle against sin and death.',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('our God shall fight for us');
        for (const text of [
            '[^Nehemiah 4:1-23]\nThey were fighting for their brethren, ' +
                'their sons and their daughters [^Nehemiah 4:14].',
            '[^Nehemiah 4:1-23]\nThe people held their swords, ready to ' +
                'fight, while they built.',
            '[^Nehemiah 4:1-23]\nOur God fought for the builders.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-253 (ab81..ab86): Job's ten children cited to 1:3.
    test("Job's children cited to the verse that names them", () => {
        const found = findLessonLegends(
            '[^Job 1:13-22]\nJob was a man in the land of Uz, blessed with ' +
                'ten children and great wealth [^(KJV) Job 1:3].',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('Job 1:2');
        for (const text of [
            '[^Job 1:13-22]\nJob had seven sons and three daughters ' +
                '[^(KJV) Job 1:2].',
            '[^Job 1:13-22]\nJob had ten children and great wealth ' +
                '[^(KJV) Job 1:2-3].',
            '[^Job 1:13-22]\nHis substance was seven thousand sheep ' +
                '[^(KJV) Job 1:3].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-251 (ab84, ab85): love "the only true evidence"; Eli "each time".
    test('1 John 4 and 1 Samuel 3 as their verses tell them', () => {
        const cases: [string, string][] = [
            [
                '[^1 John 4:7-21]\nGod is the source and essence of love, ' +
                    'and because He first loved us in Christ, we are called ' +
                    'to love one another as the only true evidence that we ' +
                    'know Him.',
                '1 John 4:13, 15',
            ],
            [
                // Batch MH: the same in other words, after the big idea
                // was put right.
                '[^1 John 4:7-21]\nGod is the source of all love, and the ' +
                    'only way to prove we know Him is to let that love flow ' +
                    'through us.',
                '1 John 4:13, 15',
            ],
            [
                '[^1 John 4:7-21]\nTherefore, the only way to truly know ' +
                    'God is to let His love flow through us.',
                '1 John 4:13, 15',
            ],
            [
                // Batch MK: the word in quotes.
                '[^1 John 4:7-21]\n- Why does John say that loving others ' +
                    'is the only way to "know" God?',
                '1 John 4:13, 15',
            ],
            [
                '[^1 Samuel 3:1-21]\nEach time, Samuel ran to Eli, and each ' +
                    'time Eli said, "I called not" [^(KJV) 1 Samuel 3:6].',
                '1 Samuel 3:5-9',
            ],
            [
                '[^1 Samuel 3:1-21]\nEach time, Samuel ran to Eli, and each ' +
                    'time Eli said he had not called [^(KJV) 1 Samuel 3:6].',
                '1 Samuel 3:5-9',
            ],
        ];
        for (const [text, ref] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain(ref);
        }
        for (const text of [
            '[^1 John 4:7-21]\nLove for one another is the evidence that ' +
                'God dwells in us [^1 John 4:12].',
            // 4:20's own argument, and Christ the way to the Father.
            '[^1 John 4:7-21]\nThe only way to prove love for the unseen ' +
                'God is to love the seen brother [^(KJV) 1 John 4:20].',
            '[^1 John 4:7-21]\nTo confess that Jesus is the Son of God is ' +
                'to own Him as the only way to the Father.',
            '[^1 Samuel 3:1-21]\nThis happened three times; the third time ' +
                'Eli perceived that the LORD had called the child.',
            '[^1 Samuel 3:1-21]\nTwice Eli said, "I called not; lie down ' +
                'again" [^1 Samuel 3:5-6].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-246 (ab81..ab83): "Will we recognize our loved ones? Yes".
    test('a reunion told as the passage promises it, not more', () => {
        const found = findLessonLegends(
            '[^1 Thessalonians 4:13-18]\n**A hearer asks:** Will we ' +
                'recognize our loved ones and be with them forever?\n**The ' +
                'passage answers:** Yes, we shall be "caught up together ' +
                'with them" [^1 Thessalonians 4:17].',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('does not say whether we shall know');
        expect(
            findLessonLegends(
                '[^1 Thessalonians 4:13-18]\n**A hearer asks:** Will we be ' +
                    'with our loved ones again?\n**The passage answers:** ' +
                    'Yes, we shall be "caught up together with them".',
            ),
        ).toEqual([]);
    });

    // BN-245 (ab81, ab82): Samuel answering "exactly as Eli told him".
    test("Samuel's answer as 1 Samuel 3:10 gives it", () => {
        for (const text of [
            '[^1 Samuel 3:1-10]\nThis time, Samuel answered exactly as Eli ' +
                'told him: "Speak; for thy servant heareth" [^1 Samuel 3:10].',
            '[^1 Samuel 3:1-10]\nThe LORD called a fourth time. Samuel ' +
                'answered, "Speak, LORD; for thy servant heareth."',
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain('1 Samuel 3:9-10');
        }
        for (const text of [
            '[^1 Samuel 3:1-10]\nEli told him to say, "Speak, LORD; for thy ' +
                'servant heareth" [^1 Samuel 3:9].',
            '[^1 Samuel 3:1-10]\nThen Samuel answered, "Speak; for thy ' +
                'servant heareth" [^1 Samuel 3:10].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-242 (ab81): Gideon's lappers given a reason the verses do not give.
    test("Gideon's water test told as the verses tell it", () => {
        for (const text of [
            '[^Judges 7:1-25]\nHe removes those who lack vigilance while ' +
                'drinking, leaving only three hundred men [^Judges 7:6].',
            '[^Judges 7:1-25]\nHe sends home those who are careless in ' +
                'their drinking [^Judges 7:5-6].',
            // BN-249 (batch MG): a point's heading, no water named in it.
            '[^Judges 7:1-25]\n## 1. God removes the fearful and the careless',
            '[^Judges 7:1-25]\n## 1. God removes the fearful and the complacent',
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain('Judges 7:5-7');
        }
        for (const text of [
            '[^Judges 7:1-25]\nThe LORD chose the three hundred that lapped ' +
                'the water [^Judges 7:7].',
            '[^Judges 7:1-25]\nSome think the lappers were alert, but the ' +
                'text does not say why they were chosen.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-236 (ab75..ab77): James 1:7 quoted without its "let not".
    test('James 1:7 quoted from "shall receive" is named', () => {
        for (const text of [
            '[^James 1:2-8]\nThe one who is double-minded "shall receive ' +
                'any thing of the Lord" not [^(KJV) James 1:6-7].',
            '[^James 1:2-8]\nThe one who wavers is like a wave of the sea ' +
                'and should "not that man think that he shall receive any ' +
                'thing of the Lord" [^(KJV) James 1:6-7].',
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text).toContain('James 1:7');
        }
        expect(
            findLessonLegends(
                '[^James 1:2-8]\nThe one who wavers is like a wave of the sea ' +
                    'and "let not that man think that he shall receive any ' +
                    'thing of the Lord" [^(KJV) James 1:7].',
            ),
        ).toEqual([]);
    });

    // BN-230 (ab73, ab74): John's task (Luke 1:77) given to the dayspring.
    test("John's task given to the dayspring", () => {
        const found = findLessonLegends(
            '[^Luke 2:1-20]\n## Background\nZechariah prophesied that the ' +
                '"dayspring from on high" would visit his people to give ' +
                'knowledge of salvation through the remission of sins ' +
                '[^Luke 1:78-79].',
        );
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('Luke 1:76-77');
        expect(
            findLessonLegends(
                '[^Luke 2:1-20]\n## Background\nZechariah prophesied that ' +
                    'the "dayspring from on high" would give light to them ' +
                    'that sit in darkness [^Luke 1:78-79].',
            ),
        ).toEqual([]);
    });

    test('each one the readers caught', () => {
        const cases: [string, RegExp][] = [
            [
                'David and Goliath (1 Samuel 17). The victory belonged to ' +
                    "God, and the stone found the only gap in the giant's " +
                    'armour.',
                /sunk into his forehead/,
            ],
            [
                'The Good Samaritan. Before this, Jesus had just spoken to ' +
                    'the people of Capernaum about the power of His name.',
                /the seventy he is sending out/,
            ],
            [
                'Psalm 51. David tried to hide his sin for a year before ' +
                    'Nathan came.',
                /gives no length of time/,
            ],
            [
                'Luke 15:11-32. Why was the father upset with the son who ' +
                    'had always obeyed? The elder son would not go in.',
                /intreated him/,
            ],
            [
                'Jonah for children. Jesus told his friends that just as ' +
                    "Jonah was in the whale's belly, He would be in the earth.",
                /scribes and of the Pharisees/,
            ],
            // BN-145 (ab29): two children's lessons.
            [
                'Noah and the ark. Noah sent out a dove, and when it ' +
                    'returned with an olive leaf, Noah knew the land was dry.',
                /the waters were abated/,
            ],
            [
                'Jonah for children. God told Jonah again to go to Nineveh. ' +
                    'This time, Jonah went. He told the people they must ' +
                    'stop doing bad things.',
                /Yet forty days, and Nineveh shall be overthrown/,
            ],
        ];
        for (const [text, truth] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toMatch(truth);
        }
    });

    test('a true telling, another story and a picture are left alone', () => {
        for (const text of [
            // Mark 1:21: he did teach in Capernaum.
            'Mark 1. Jesus spoke to the people of Capernaum in their synagogue.',
            // A picture, in a lesson on Ephesians 6.
            'Satan looks for a gap in our armour, so put on the whole armour.',
            // What the verses say.
            'Goliath fell: the stone sunk into his forehead.',
            'Psalm 51. After Nathan came, David wrote this psalm.',
            'Luke 15. The elder son was angry, and his father came out.',
            // What the verses say, in the two BN-145 stories.
            'Noah. The dove came back with an olive leaf. Later the ground ' +
                'was dry, and God said, Go forth of the ark.',
            'Jonah. The king of Nineveh said that every one must turn from ' +
                'his evil way.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-156 (ab31, Opus): David's reason for going without armour given
    // as verse 47's words in two runs, and Jonah "sent to save" Nineveh.
    // BN-161 (ab31..ab35, both readers): Psalm 46:8's desolations borne by
    // Christ in three runs, and Goliath's "only vulnerable spot".
    // BN-177 (ab44, Opus): where Jesus died, who says Psalm 51:17, how
    // often the servant asked, and what the eagles' wings are.
    test("the cross, David's prayer, one plea each, and strength", () => {
        const cases: [string, string][] = [
            [
                'Jonah for children. Just as Jonah was in the fish, the grave ' +
                    'was the place where Jesus died and then rose again.',
                'he died on the cross',
            ],
            [
                'Psalm 51. He tells David that the sacrifices of God are a ' +
                    'broken spirit.',
                "David's own prayer to God",
            ],
            [
                'Matthew 18 (seventy times seven). In the story, the servant ' +
                    "asked for 'patience' twice.",
                'the servant asked once',
            ],
            [
                'Isaiah 40. We mount up with wings as eagles to see things ' +
                    'from his perspective.',
                'never a view from above',
            ],
        ];
        for (const [text, truth] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain(truth);
        }
        for (const text of [
            'Jonah. Jesus died on the cross and lay three days in the tomb.',
            'Psalm 51. David tells God that the sacrifices of God are a ' +
                'broken spirit.',
            'Matthew 18. Both the servant and his fellowservant asked for ' +
                'patience.',
            'Isaiah 40. They shall mount up with wings as eagles: strength ' +
                'renewed.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-178 (ab45, Sonnet): the crowd kept Zacchaeus out for who he was.
    test('the press kept Zacchaeus back by his height, not by who he was', () => {
        for (const text of [
            'Zacchaeus (Luke 19). He "could not for the press" of the ' +
                'crowd, and ' +
                'because of who he was, the people would not have made ' +
                'room for him.',
            'Zacchaeus. The crowd would not let him through.',
            'Zacchaeus. Nobody in the crowd made way for a hated tax ' +
                'collector.',
        ]) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain('little of stature');
        }
        for (const text of [
            'Zacchaeus. He could not for the press, because he was little ' +
                'of stature.',
            'Zacchaeus. The people murmured that he was gone to be guest ' +
                'with a man that is a sinner.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-181 (ab46, Sonnet): Philippians 2 called the Gospels, and the
    // parable's tormentors put on Christ.
    test("Paul's letter is no Gospel, and the tormentors are the servant's", () => {
        const [gospel] = findLessonLegends(
            'Philippians 4. In the Gospels, Jesus showed the ultimate ' +
                '"abasing" when He emptied Himself, taking the form of a ' +
                'servant [^(KJV) Philippians 2:5-8].',
        );
        expect(gospel?.text).toContain("Paul's letters, not a Gospel");
        const [tormentors] = findLessonLegends(
            'Matthew 18. As the New Testament shows, we are forgiven ' +
                'because Christ was delivered to the tormentors of the ' +
                'cross for us.',
        );
        expect(tormentors?.text).toContain('1 Peter 2:24');
        for (const text of [
            'Philippians 4. Paul writes that Christ made himself of no ' +
                'reputation. In the Gospels, Jesus washed the feet of his ' +
                'disciples (John 13:5).',
            'Matthew 18. His lord was wroth, and delivered him to the ' +
                'tormentors, till he should pay all that was due.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-221 (shape70): the princes and the stars each with its own verse
    // are let be; the princes cited to 40:26 are still named.
    test('the princes at 40:23 and the stars at 40:26 are let be', () => {
        expect(
            findLessonLegends(
                'Isaiah 40. He is the Holy One who brings princes to nothing ' +
                    '[^(KJV) Isaiah 40:23] and calls the stars by name [^(KJV) ' +
                    'Isaiah 40:26].',
            ),
        ).toEqual([]);
        const [princes] = findLessonLegends(
            'Isaiah 40. He created the stars and brings princes to nothing ' +
                '[^(KJV) Isaiah 40:25-26].',
        );
        expect(princes?.text).toContain('give each its own verse');
    });

    // BN-219 (ab66, Sonnet): Nineveh made cruel to Israel, and the rout
    // cited at 17:54.
    test("Nineveh cruel to God's people, and the rout at 17:54", () => {
        const [cruel] = findLessonLegends(
            'Jonah. The people in Nineveh were from Assyria, and they were ' +
                "very mean to God's people.",
        );
        expect(cruel?.text).toContain('names no deed to Israel');
        const [rout] = findLessonLegends(
            'Goliath. The result is the defeat of the Philistines [^(KJV) 1 ' +
                'Samuel 17:54].',
        );
        expect(rout?.text).toContain('17:54 is David bringing the head');
        for (const text of [
            'Jonah. The people of Nineveh were from Assyria, and they were ' +
                "enemies of God's people.",
            'Goliath. David brought the head to Jerusalem [^(KJV) 1 Samuel ' +
                '17:54].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-218 (ab65, Opus): peace David's victory never gave, and God
    // everywhere read into Jonah 1:3.
    test('the peace to all Israel and the presence as everywhere', () => {
        const [peace] = findLessonLegends(
            'Goliath. David trusted God, winning a victory that brought ' +
                'peace to all Israel.',
        );
        expect(peace?.text).toContain('names no peace');
        const [presence] = findLessonLegends(
            'Jonah. "The presence of the LORD" means that God is ' +
                'everywhere.',
        );
        expect(presence?.text).toContain('Psalm 139:7-10');
        for (const text of [
            'Goliath. Israel pursued the Philistines and spoiled their ' +
                'tents.',
            'Jonah. Jonah rose up to flee from the presence of the LORD.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-217 (ab65, Sonnet): Isaiah 46:10 carried as Proverbs 3:5-6.
    test('the end from the beginning in a Proverbs 3 lesson is named', () => {
        const [end] = findLessonLegends(
            'Proverbs 3. God is the only one who sees the end from the ' +
                'beginning, and He asks us to trust Him.',
        );
        expect(end?.text).toContain('Isaiah 46:10');
        expect(
            findLessonLegends(
                'Proverbs 3. He declares the end from the beginning ' +
                    '[^(KJV) Isaiah 46:10].',
            ),
        ).toEqual([]);
    });

    // BN-216 (ab64, Opus): Christ said to defeat the second death that
    // 20:14 only names.
    test('the second death defeated is named', () => {
        const [death] = findLessonLegends(
            'Revelation 21. Jesus himself died and rose again, defeating ' +
                'the "second death" [^(KJV) Revelation 20:14].',
        );
        expect(death?.text).toContain('This is the second death');
        expect(
            findLessonLegends(
                'Revelation 21. He that overcometh shall not be hurt of the ' +
                    'second death.',
            ),
        ).toEqual([]);
    });

    // BN-215 (ab64, Sonnet): Christ made the good ground, or the Seed.
    test('Christ as the good ground or the Seed is named', () => {
        for (const text of [
            'Matthew 13. Jesus is the only truly good ground, who perfectly ' +
                'heard and obeyed.',
            'Matthew 13. Jesus is the only truly perfect Seed.',
            'Matthew 13. While we struggle, Jesus is the only truly "good ' +
                'ground."',
            'Matthew 13. He is the only one who ever had a perfectly good ' +
                'ground heart.',
        ]) {
            const textList = findLessonLegends(text).map((one) => {
                return one.text;
            });
            expect(textList.join(), text).toContain('the Son of man');
        }
        for (const text of [
            'Matthew 13. Jesus is the Sower who scatters the word on every ' +
                'ground.',
            'Matthew 13. The good ground is the one who hears and ' +
                'understands.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-214 (shape66): the Levites given to serve the tabernacle as
    // Numbers 3 gives them are let be; the priest and Levite of Jesus' day
    // in the tabernacle are still named.
    test('the Levites as Numbers 3 gives them are let be', () => {
        expect(
            findLessonLegends(
                'Luke 10. A priest was one of the sons of Aaron who offered ' +
                    'sacrifices [^(KJV) Leviticus 1:5], and a Levite was from ' +
                    'the tribe of Levi, given to the priests to serve the ' +
                    'tabernacle [^(KJV) Numbers 3:6-10].',
            ),
        ).toEqual([]);
        const [tabernacle] = findLessonLegends(
            'Luke 10. The priest and the Levite were men who served in the ' +
                'tabernacle.',
        );
        expect(tabernacle?.text).toContain('the temple in Jerusalem');
    });

    // BN-212 (ab62, Opus): everyone brought home, Jonah's mercy message,
    // and the king's pity denied.
    test('everyone home, the mercy Jonah told, the pity denied', () => {
        const textOf = (text: string) => {
            return findLessonLegends(text)
                .map((one) => {
                    return one.text;
                })
                .join();
        };
        expect(
            textOf(
                'Revelation 21. In the new world, that distance is gone, and ' +
                    'the "holy city" brings everyone home to God.',
            ),
        ).toContain('the promise is to his people');
        expect(
            textOf(
                'Jonah. Jonah was in the fish for three days, and then he ' +
                    "came out to tell people about God's mercy.",
            ),
        ).toContain('Yet forty days');
        expect(
            textOf(
                'Matthew 18. The king\'s "compassion" is not a feeling of ' +
                    'pity, but a decision to loose the servant.',
            ),
        ).toContain("pity is the verse's own word");
        for (const text of [
            'Revelation 21. God brings his people home, and he shall wipe ' +
                'away all tears.',
            'Jonah. Jonah came out of the fish and went to Nineveh.',
            'Matthew 18. The king was moved with compassion and forgave ' +
                'him.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-211 (ab62): the exile named and come back reworded, and Psalm
    // 23:6's goodness and mercy given guards.
    test('the exile reworded, and the guards', () => {
        for (const text of [
            'Isaiah 40. Isaiah wrote these words to the people of Israel, ' +
                'who had been carried away to Babylon.',
            'Isaiah 40. The prophet spoke to a people already in Babylon.',
        ]) {
            const [exile] = findLessonLegends(text);
            expect(exile?.text, text).toContain('warned of exile');
        }
        const [guards] = findLessonLegends(
            'Psalm 23. Goodness and mercy are like guards following us home ' +
                'to the house of the Lord.',
        );
        expect(guards?.text).toContain('no picture it does not give');
        for (const text of [
            'Isaiah 40. The king was told his house would be carried away to ' +
                'Babylon [^(KJV) Isaiah 39:6].',
            'Psalm 23. Goodness and mercy shall follow me all the days of my ' +
                'life.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-210 (ab61, Opus): "plenty" in Philippians 4:12's quote, and the
    // lawyer's answer put in Jesus' mouth.
    test('plenty quoted, and the lawyer answer given to Jesus', () => {
        const [plenty] = findLessonLegends(
            'Philippians 4. Contentment is being satisfied in Christ ' +
                'regardless of whether one has "plenty" or "suffer need" ' +
                '[^(KJV) Philippians 4:12].',
        );
        expect(plenty?.text).toContain('"plenty" is not a word of it');
        const [lawyer] = findLessonLegends(
            'Luke 10. He tells the lawyer that the one who "shewed mercy" is ' +
                'the true neighbor.',
        );
        expect(lawyer?.text).toContain("the answer is the lawyer's own");
        for (const text of [
            'Philippians 4. Paul knew how to abound and how to suffer need; ' +
                'whether in plenty or in want, he was content.',
            'Luke 10. The lawyer answers, "He that shewed mercy on him," ' +
                'and Jesus says, "Go, and do thou likewise."',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-209 (ab60, both readers): Christ given the hundredfold, a lawyer of
    // rank, a father's anger, Revelation's former things as sin, and
    // Philippians 4:9's "seen in me" moved.
    test('the hundredfold, the rank, the anger, the former things, seen in me', () => {
        const textOf = (text: string) => {
            return findLessonLegends(text)
                .map((one) => {
                    return one.text;
                })
                .join();
        };
        expect(
            textOf(
                'Matthew 13. He is the only one who perfectly fulfilled the ' +
                    '"hundredfold" fruit of obedience to the Father.',
            ),
        ).toContain('never said of Christ');
        expect(
            textOf(
                'Luke 10. A lawyer stood up to tempt Jesus. He was a man of ' +
                    'high status and religious knowledge.',
            ),
        ).toContain('never his rank');
        expect(
            textOf(
                'Luke 15. His love was greater than his anger, and he ran to ' +
                    'embrace his son.',
            ),
        ).toContain('gives the father no anger');
        expect(
            textOf(
                'Revelation 21. Jesus Christ died to remove the "former ' +
                    'things" of our sin.',
            ),
        ).toContain('those are the former things');
        expect(
            textOf(
                'Philippians 4. Do the things we have "learned, and received, ' +
                    'and heard, and seen" in the faith.',
            ),
        ).toContain('seen in Paul');
        for (const text of [
            'Matthew 13. The good ground brought forth an hundredfold.',
            'Luke 10. A certain lawyer stood up, and tempted him.',
            'Luke 15. The elder son was angry, and would not go in [^(KJV) ' +
                'Luke 15:28].',
            'Revelation 21. The former things are passed away.',
            'Philippians 4. Do what ye have "learned, and received, and ' +
                'heard, and seen in me".',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-207 (shape62): the sinners given their own verse beside John's
    // word to the publicans is let be.
    test('publicans with sinners, each with its verse, are let be', () => {
        expect(
            findLessonLegends(
                'Zacchaeus. **What it means:** A "publican" was a gatherer of ' +
                    'taxes, a role that meant he was counted with sinners ' +
                    '[^(KJV) Luke 5:30], [^(KJV) Luke 15:1-2] and told to ' +
                    'exact no more than what was appointed [^(KJV) Luke ' +
                    '3:12-13].',
            ),
        ).toEqual([]);
        const [publican] = findLessonLegends(
            'Zacchaeus. A publican was a gatherer of taxes who was often ' +
                'counted with sinners [^(KJV) Luke 3:12-13].',
        );
        expect(publican?.text).toContain('name those for it');
    });

    // BN-206 (ab59, Opus): the shore, Psalm 51:19 given 51:17's meaning,
    // the compassion made the cross's work, and Jonah's "bad ways".
    test('the shore, the sacrifices, the compassion and the bad ways', () => {
        const textOf = (text: string) => {
            return findLessonLegends(text).map((one) => {
                return one.text;
            });
        };
        expect(
            textOf(
                'Matthew 13. He spoke to great multitudes gathered by the ' +
                    'sea, some standing on the shore while He sat in a ship.',
            ).join(),
        ).toContain('the whole multitude stood on the shore');
        expect(
            textOf(
                'Psalm 51. David explains that "sacrifices of ' +
                    'righteousness" are not just animal offerings, but a ' +
                    'heart that is truly broken before God.',
            ).join(),
        ).toContain('the broken spirit is 51:17');
        expect(
            textOf(
                'Matthew 18. On the cross, Jesus took the debt of our ' +
                    'trespasses upon himself so that the Father could be ' +
                    '"moved with compassion" toward us.',
            ).join(),
        ).toContain('the compassion comes first');
        expect(
            textOf(
                'Jonah. God told Jonah to go to Nineveh and tell the people ' +
                    'to stop their bad ways.',
            ).join(),
        ).toContain('Yet forty days');
        for (const text of [
            'Matthew 13. The whole multitude stood on the shore.',
            'Psalm 51. "Sacrifices of righteousness" are offerings brought ' +
                'to the LORD rightly, which follow a heart that has been ' +
                'humbled.',
            'Matthew 18. The king was moved with compassion and forgave ' +
                'him the debt.',
            'Jonah. Jonah told them to throw him into the sea to stop the ' +
                'storm.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-205 (ab59, Sonnet): 40:31 as stages, the yields given a reason,
    // and Zacchaeus said not to be short.
    test('stages, a reason for the yields, and a tall Zacchaeus', () => {
        const [stages] = findLessonLegends(
            'Isaiah 40. The result is a gradual restoration: first mounting ' +
                'up with wings, then running, and finally walking.',
        );
        expect(stages?.text).toContain('nor stages one after another');
        const [yields] = findLessonLegends(
            'Matthew 13. **What it means:** The harvest of an hundredfold, ' +
                'sixty and thirty varies according to the grace and ' +
                'circumstances of the person.',
        );
        expect(yields?.text).toContain('no reason for the difference');
        const [height] = findLessonLegends(
            'Zacchaeus. He is not too small in height to be noticed.',
        );
        expect(height?.text).toContain('little of stature');
        for (const text of [
            'Isaiah 40. They shall mount up, they shall run, and they shall ' +
                'walk.',
            'Matthew 13. The good ground brought forth fruit, some an ' +
                'hundredfold, some sixty, some thirty.',
            'Zacchaeus. No one is too small for Jesus to notice.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-204 (ab58, Opus): the fourfold set against the law for stolen
    // goods, and Philippians 4:1 told after the two women.
    test('the law for stolen goods, and stand fast told after', () => {
        const [fourfold] = findLessonLegends(
            'Zacchaeus. **What it means:** "restore him fourfold" means he ' +
                'promised to pay back four times the amount, which was far ' +
                'more than the law required for stolen goods [^(KJV) ' +
                'Leviticus 6:5].',
        );
        expect(fourfold?.text).toContain('never "for stolen goods"');
        const [standFast] = findLessonLegends(
            'Philippians 4. Paul pleads with Euodias and Syntyche. He now ' +
                'turns to the whole church to encourage them to stand fast ' +
                'in the Lord.',
        );
        expect(standFast?.text).toContain('comes BEFORE');
        for (const text of [
            'Zacchaeus. Fourfold was more than the law asked of one who ' +
                'took by deceit, the principal and a fifth [^(KJV) ' +
                'Leviticus 6:5].',
            'Philippians 4. Paul first tells them to "stand fast in the ' +
                'Lord", then pleads with Euodias and Syntyche.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-203 (shape60): a book named in the line's own verse token is its
    // citation, and a Gospel story told "in the Gospels" is let be.
    test('a Gospel story beside a Revelation token is let be', () => {
        expect(
            findLessonLegends(
                'Gospels. In the Gospels, Jesus showed he had power over the ' +
                    '"former things" [^(KJV) Revelation 21:4] by raising ' +
                    'Lazarus from the dead [^(KJV) John 11:25].',
            ),
        ).toEqual([]);
        const [epistle] = findLessonLegends(
            'Gospels. In the Gospels, Jesus humbled himself (Philippians 2:8).',
        );
        expect(epistle?.text).toContain("Paul's letters");
    });

    // BN-202 (ab57, Opus): Isaiah's hearers put in Babylon, the lost sheep
    // sought because it was special, and Jonah's message of salvation.
    test('the exile come, the special sheep and the message of salvation', () => {
        const [exile] = findLessonLegends(
            'Isaiah 40. Isaiah wrote these words to the people of Israel who ' +
                "were in exile in Babylon, having been told that the king's " +
                'house would be carried away.',
        );
        expect(exile?.text).toContain('warned of exile');
        const [special] = findLessonLegends(
            'Ninety and nine. **A hearer asks:** Why did the shepherd leave ' +
                'the other sheep?\n\n**The passage answers:** Because the ' +
                'one that was lost was special and needed to be found.',
        );
        expect(special?.text).toContain('it is lost');
        const [message] = findLessonLegends(
            'Jonah. Just as Jonah came out of the fish to bring a message ' +
                'of salvation to Nineveh, Jesus rose from the dead.',
        );
        expect(message?.text).toContain('Yet forty days');
        for (const text of [
            'Isaiah 40. Isaiah wrote to the people of Israel who were facing ' +
                'exile in Babylon.',
            'Isaiah 40. These words would comfort the exiles in Babylon ' +
                'many years later.',
            'Ninety and nine. Because it was lost, he went after it.',
            'Jonah. God sent Jonah to Nineveh, and the city heard his ' +
                'message and believed God.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-201 (ab56, Opus): the kiss while still far off, and the three
    // given to three kinds of people.
    test('the kiss far off, and some who walk, are named', () => {
        const [kiss] = findLessonLegends(
            'The prodigal. **The passage answers:** No, the father "ran, and ' +
                'fell on his neck, and kissed him" [^(KJV) Luke 15:20] while ' +
                'the son was still "a great way off," restoring him.',
        );
        expect(kiss?.text).toContain('seen a great way off');
        const [some] = findLessonLegends(
            'Isaiah 40. **The passage answers:** The passage describes ' +
                'different ways of moving: some "mount up," some "run," and ' +
                'some "walk."',
        );
        expect(some?.text).toContain('all three to the same people');
        for (const text of [
            'Luke 15. When he saw the son "yet a great way off," he "had ' +
                'compassion, and ran, and fell on his neck, and kissed him."',
            'Luke 15. But when he was yet a great way off, his father saw ' +
                'him, and had compassion, and ran, and fell on his neck, and ' +
                'kissed him.',
            'Isaiah 40. Some days we mount up; on others we can only walk, ' +
                'and the promise holds.',
            'Isaiah 40. They shall run, and not be weary; they shall walk, ' +
                'and not faint.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-200 (ab56, Sonnet): only the verse's last words quoted, and not
    // the verse's.
    test('the battle quoted as "of the LORD" is named', () => {
        const [battle] = findLessonLegends(
            'Goliath. He chooses five smooth stones and his sling, ' +
                'declaring that the battle is "of the LORD" [^(KJV) 1 ' +
                'Samuel 17:47].',
        );
        expect(battle?.text).toContain('"for the battle is the LORD\'s"');
        for (const text of [
            'Goliath. David said, "the battle is the LORD\'s" (17:47).',
            "Goliath. The battle is the LORD's, so David ran toward the " +
                'army.',
            'Jonah. "Salvation is of the LORD" (Jonah 2:9).',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-199 (ab56): two true lines the window had named -- verse 39's
    // reason in other words, and the fear 4:2 gives.
    test("David's untried armour, and Jonah's fear, are let be", () => {
        for (const text of [
            "Goliath. **What it means:** David refuses Saul's armor because " +
                'he had not tried it out [^(KJV) 1 Samuel 17:39].',
            'Jonah. **The passage answers:** Jonah knew God was "gracious ' +
                'God, and merciful." He was afraid that if he told the ' +
                'people to be sorry, God would actually forgive them.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-198 (ab55, Sonnet): a request never made, and what the sailors did.
    test('what the son said, and what the sailors did', () => {
        const [servant] = findLessonLegends(
            'The prodigal son. **The passage answers:** No, the father ' +
                'ignored the request to be a "hired servant" and ordered a ' +
                'feast.',
        );
        expect(servant?.text).toContain('no request about servants');
        const [obeyed] = findLessonLegends(
            'Jonah for children. The Bible says the men feared the LORD ' +
                'exceedingly and obeyed [^(KJV) Jonah 1:16].',
        );
        expect(obeyed?.text).toContain('offered a sacrifice');
        for (const text of [
            'Luke 15. He meant to ask to be one of the hired servants.',
            'Jonah. The second time, Jonah obeyed and went to Nineveh.',
            'Jonah. The men feared the LORD exceedingly and made vows.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-196 (ab54, Opus): judged by their works, the book of life apart.
    test('judged by their works, the book of life apart', () => {
        const [judged] = findLessonLegends(
            'Revelation 21:1-7. It follows the final judgment where the dead ' +
                'were judged according to the book of life [^(KJV) ' +
                'Revelation 20:11-14].',
        );
        expect(judged?.text).toContain('according to their works');
        expect(
            findLessonLegends(
                'Revelation 21. The dead were judged according to their works, ' +
                    'and whoever was not found in the book of life was cast out.',
            ),
        ).toEqual([]);
    });

    // BN-195 (ab54, Sonnet): a reason the lost sheep is not given, and
    // Paul's want made a feeling.
    test('lost is the reason, and want is need', () => {
        const [danger] = findLessonLegends(
            'He left the ninety and nine.\n**The passage answers:** He did ' +
                'it because the one lost sheep was in danger and needed to ' +
                'be found.',
        );
        expect(danger?.text).toContain('that it is lost');
        const [want] = findLessonLegends(
            'Philippians 4:10-13. **What it means:** Paul speaks of "want" ' +
                'not as a lack of money, but as a state of dependency.',
        );
        expect(want?.text).toContain('suffer need');
        for (const text of [
            'The ninety and nine. He went because the sheep was lost.',
            'The ninety and nine. **For example:** A child breaks a vase and ' +
                'hides in their room because they are scared.',
            'Philippians 4. Want means lack: Paul knew hunger and need.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-194 (ab53, Opus): the one who gives of the fountain, and the just
    // persons as the verse names them.
    test('he gives of the fountain, and the verse as it reads', () => {
        const [fountain] = findLessonLegends(
            'Revelation 21. He is the "fountain of the water of life" ' +
                '[^(KJV) Revelation 21:6] who said, "I am the resurrection".',
        );
        expect(fountain?.text).toContain('he GIVES of the');
        const [think] = findLessonLegends(
            'Luke 15:1-7. There is more joy in heaven over one sinner who ' +
                'repents than over ninety and nine who think they need no ' +
                'repentance [^(KJV) Luke 15:7].',
        );
        expect(think?.text).toContain('just persons, which');
        for (const text of [
            'Revelation 21. He is the one who gives "of the fountain of the ' +
                'water of life freely".',
            'Luke 15. Ninety and nine just persons, which need no repentance.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-193 (ab53, Sonnet): Jesus put up the ladder Zacchaeus climbed.
    test('Zacchaeus climbed, and Jesus called him down', () => {
        const [ladder] = findLessonLegends(
            'Zacchaeus. Just as Jesus climbed the social ladder to find a ' +
                'lonely tax collector, he descended from heaven to find us.',
        );
        expect(ladder?.text).toContain('it is Zacchaeus who climbed');
        for (const text of [
            'Zacchaeus climbed up into a sycomore tree, and Jesus called ' +
                'him down.',
            'Zacchaeus. A person spends every hour climbing a social ladder.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-192 (ab52, Opus): Exodus 22:1's own fourfold, and the sailors who
    // "helped" Jonah overboard.
    test("the law's own fourfold, and men who rowed hard", () => {
        const [fourfold] = findLessonLegends(
            'Zacchaeus. To restore "fourfold" means to pay back far more ' +
                'than the law required for stolen goods [^(KJV) Exodus ' +
                '22:1]; [^(KJV) Leviticus 6:5].',
        );
        expect(fourfold?.text).toContain('Numbers 5:7');
        const [sailors] = findLessonLegends(
            'Jonah for children. The sailors saw that the storm was because ' +
                'of Jonah, and they helped him by throwing him into the sea.',
        );
        expect(sailors?.text).toContain('rowed hard');
        for (const text of [
            'Zacchaeus. Fourfold is what Exodus 22:1 asks for a sheep, more ' +
                'than the fifth part of Numbers 5:7.',
            'Jonah. The sailors rowed hard, then cast him into the sea.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-191 (ab52, Sonnet): "these same words", 17:45's javelin, and a
    // named line the edit after its note left.
    test('the same words, the shield, and a line left after its note', () => {
        const [same] = findLessonLegends(
            'Isaiah 40. Jesus uses these same words to invite us: "Come ' +
                'unto me" [^(KJV) Matthew 11:28].',
        );
        expect(same?.text).toContain('Jesus makes the same promise');
        const [javelin] = findLessonLegends(
            'Goliath. He tells Goliath that while the giant comes with a ' +
                'sword, and a spear, and a javelin, David comes in the name ' +
                'of the LORD [^(KJV) 1 Samuel 17:45].',
        );
        expect(javelin?.text).toContain('with a shield');
        const stature =
            'Zacchaeus was "little of stature," which here describes both ' +
            'his physical height and his low standing in the eyes of his ' +
            'community.';
        const note = `Zacchaeus (Luke 19).\n**What it means:** ${stature}`;
        const left = findLessonLegendsLeft(note, [
            `**What it means:** ${stature}`,
        ]);
        expect(left).toHaveLength(1);
        expect(genLessonLegendNote(left, [14], true)).toContain(
            '(The change is made, but it left a line the window named',
        );
        // A line it never named, or one now fixed, is not said again.
        expect(findLessonLegendsLeft(note, ['Another line entirely.'])).toEqual(
            [],
        );
        expect(
            findLessonLegendsLeft(
                'Zacchaeus. He was little of stature, so he climbed a tree.',
                [stature],
            ),
        ).toEqual([]);
    });

    // BN-288 (batch PJ, Opus): the edit that put a named line right wrote
    // another in its place, and only the named lines were read again.
    test('a line the next edit wrote in a named one is named too', () => {
        const named = 'God changed her heart so she would save the baby.';
        const note =
            "[^Exodus 2:1-10]\nThe princess said yes! The princess's maid " +
            "went and called the child's mother.";
        const found = findLessonLegendsNew(note, [named]);
        expect(found).toHaveLength(1);
        expect(found[0].text).toContain('the maid of verse 8 is his sister');
        // A line named before is the left check's, not this one's.
        expect(
            findLessonLegendsNew(`[^Exodus 2:1-10]\n${named}`, [named]),
        ).toEqual([]);
    });

    // BN-190 (ab51, Opus): "these very words" for a verse that says the
    // same in other words.
    test('the same promise is not the very words', () => {
        const [words] = findLessonLegends(
            'Isaiah 40:28-31. Jesus uses these very words to invite us: ' +
                '"Come unto me, all ye that labour and are heavy laden, and ' +
                'I will give you rest" [^(KJV) Matthew 11:28].',
        );
        expect(words?.text).toContain('Jesus makes the same promise');
        for (const text of [
            'Isaiah 40. Jesus makes the same promise: "Come unto me" ' +
                '[^Matthew 11:28].',
            'Psalm 23. He leadeth me beside the still waters.',
            // A setting, and Revelation's own words.
            'Luke 15. Jesus spoke these words to the Pharisees and scribes.',
            'Revelation 21. He says, "Write: for these words are true and ' +
                'faithful."',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-189 (ab51, Sonnet): 2 Corinthians 8:9 called the Gospels, the
    // princes cited to the stars, Numbers 3:10 for the Levites, and 18:35's
    // warning quoted as a command.
    test('each saying to its own verse and its own book', () => {
        const cases: [string, string][] = [
            [
                'Philippians 4. In the Gospels, Jesus showed this ultimate ' +
                    'contentment when He, though being rich, "for him poor ' +
                    'became" to give us the riches of grace.',
                '2 Corinthians 8:9',
            ],
            [
                'Isaiah 40:28-31. God reminds them that he is the Holy One ' +
                    'who created the stars and brings princes to nothing ' +
                    '[^(KJV) Isaiah 40:25-26].',
                'Isaiah 40:23',
            ],
            [
                'The Good Samaritan. A Levite was from the tribe of Levi, ' +
                    'appointed to serve the temple [^(KJV) Numbers 3:10].',
                '1 Chronicles 23:28',
            ],
            [
                'Matthew 18. The Father requires that we "from your hearts ' +
                    'forgive not every one" who wrongs us.',
                'what he will do if we do not forgive',
            ],
        ];
        for (const [text, truth] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain(truth);
        }
        for (const text of [
            'Isaiah 40. He bringeth the princes to nothing [^Isaiah 40:23].',
            'The Good Samaritan. The Levites served the house of the LORD ' +
                '[^1 Chronicles 23:28].',
            'Matthew 18. (35): So likewise shall my heavenly Father do also ' +
                'unto you, if ye from your hearts forgive not every one.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-187 (ab50, Sonnet): all things made of dust, and Jonah running
    // from a mean people.
    test("man formed of dust, and Jonah's own reason for running", () => {
        const [dust] = findLessonLegends(
            'Isaiah 40. He is the "Creator of the ends of the earth", ' +
                'meaning he made everything from the dust of the ground ' +
                '[^(KJV) Genesis 2:7].',
        );
        expect(dust?.text).toContain('formed man of the dust');
        const [jonah] = findLessonLegends(
            'Jonah for children. God told Jonah to go to Nineveh. But Jonah ' +
                'did not want to go because the people there were mean.',
        );
        expect(jonah?.text).toContain('a gracious God, and merciful');
        for (const text of [
            'Isaiah 40. All flesh is grass; man was formed of the dust.',
            'Jonah. Jonah ran away because he knew God was gracious and ' +
                'merciful (4:2).',
            'Jonah. God sent Jonah because their wickedness came up before ' +
                'him.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-186 (ab49, both readers): a reason, a rage, a blame and a care
    // the verses do not give.
    test('the text as it reads: the lawyer, the rage, the son, the care', () => {
        const cases: [string, string][] = [
            [
                'Matthew 18. On the cross, he was delivered to the ' +
                    'tormentors and paid the price for our trespasses.',
                '1 Peter 2:24',
            ],
            [
                'The Good Samaritan. The lawyer cannot even bring himself to ' +
                    'say the word "Samaritan," so he says, "He that shewed ' +
                    'mercy on him."',
                'no verse says why',
            ],
            [
                'Psalm 46. Jesus became our ultimate refuge, taking the ' +
                    '"rage" of judgment upon Himself.',
                "the nations'",
            ],
            [
                'Luke 15:11-32. "came to himself" describes the moment when ' +
                    'he stopped blaming his circumstances.',
                'no blaming',
            ],
            [
                'Philippians 4. Paul says his "care of me hath flourished ' +
                    'again" because they sent a gift.',
                "the Philippians' care",
            ],
        ];
        for (const [text, truth] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain(truth);
        }
        for (const text of [
            'The Good Samaritan. He said, He that shewed mercy on him.',
            'Psalm 46. The heathen raged, the kingdoms were moved.',
            'Luke 15. When he came to himself, he said, I will arise.',
            'Philippians 4. Their care of me hath flourished again, Paul ' +
                'writes of their gift.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-185 (ab48, Opus): a stature that "hints at" how he was viewed, and
    // a lost sheep's God who is not angry.
    test('a height, and joy at the finding with no anger in it', () => {
        const [stature] = findLessonLegends(
            'Zacchaeus. "little of stature" means Zacchaeus was physically ' +
                'short, but it also hints at how he was viewed by the community.',
        );
        expect(stature?.text).toContain('is his height');
        const [angry] = findLessonLegends(
            'He left the ninety and nine.\n**A hearer asks:** Does God get ' +
                'angry when we are lost?\n**The passage answers:** No, ' +
                'there is "joy... in heaven".',
        );
        expect(angry?.text).toContain('says nothing of anger');
        expect(
            findLessonLegends(
                'He left the ninety and nine. The shepherd did not get ' +
                    'angry; he looked and looked until he found it.',
            )[0]?.text,
        ).toContain('says nothing of anger');
        for (const text of [
            'Zacchaeus. He was little of stature, so he climbed a tree.',
            'The ninety and nine. He layeth it on his shoulders, rejoicing.',
            // The prodigal's father, beside "a lost sheep" in its
            // background: another question, left alone.
            'Luke 15: a lost sheep, a lost coin, a lost son.\n**A hearer ' +
                'asks:** Was the father angry?\n**The passage answers:** ' +
                'No, the father "came out, and intreated him".',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-183 (ab46, Sonnet): Revelation 21 names no one waiting.
    test('the holy city is God with his people, no one waiting', () => {
        const [waiting] = findLessonLegends(
            'Revelation 21. Imagine a home where the door is always open, ' +
                'the light never fades, and the one person you miss most is ' +
                'waiting there with a smile.',
        );
        expect(waiting?.text).toContain('1 Thessalonians 4:17');
        for (const text of [
            'Revelation 21. We miss them, and God shall wipe away all tears.',
            'Isaiah 40. A friend sits waiting on the Lord for strength.',
            'Revelation 21. A grandfather tells his grandchildren of a home ' +
                'they have never seen but know is waiting for them.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-179 (ab45, Opus): a saying of Jesus made of two.
    test('abiding is fruit, and rest is for those who come', () => {
        const [saying] = findLessonLegends(
            'Psalm 46. In the Gospels, Jesus tells his followers that ' +
                'whoever abides in him will find rest.',
        );
        expect(saying?.text).toContain('Matthew 11:28');
        for (const text of [
            'Psalm 46. Jesus said, "Come unto me, all ye that labour and ' +
                'are heavy laden, and I will give you rest."',
            'John 15. Abide in me: he that abideth in me bringeth forth ' +
                'much fruit. The rest of the chapter speaks of love.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-176 (ab43, Opus): the Levite served at the temple in Jesus' day.
    test("the Levite's temple, not Moses' tabernacle", () => {
        const [levite] = findLessonLegends(
            'The Good Samaritan. A Levite was a man from the tribe of Levi ' +
                'who served in the tabernacle.',
        );
        expect(levite?.text).toContain('served at the temple in Jerusalem');
        expect(
            findLessonLegends(
                'The Good Samaritan. The Levites first served in the ' +
                    "tabernacle of Moses' day, and later in the temple.",
            ),
        ).toEqual([]);
    });

    // BN-173 (ab41, Opus): an "if" on Jonah's message, an apology in the
    // fish, and a reason for Zacchaeus's salvation the verse does not give.
    test('no if, no apology, and the reason Jesus gives', () => {
        const cases: [string, string][] = [
            [
                'Jonah. He said God would destroy Nineveh in forty days if ' +
                    'they did not stop.',
                'with no "if"',
            ],
            [
                'Jonah. Inside the fish Jonah prayed and said he was sorry.',
                'no word of sorrow for running',
            ],
            [
                'Zacchaeus. Jesus declared salvation because the change in ' +
                    'his heart led to a change in his actions.',
                'forsomuch as he also is a son of Abraham',
            ],
        ];
        for (const [text, truth] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain(truth);
        }
        for (const text of [
            'Jonah. Jonah cried, "Yet forty days, and Nineveh shall be ' +
                'overthrown."',
            'Jonah. In the fish Jonah cried to the LORD, and gave thanks.',
            'Zacchaeus. Jesus said salvation had come, for he also is a son ' +
                'of Abraham.',
            'Zacchaeus. Jesus brought salvation to his house.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-170 (ab40, Opus): David at the battle as armourbearer, a condition
    // Matthew 18 does not set, and a stature that "mirrors" a standing.
    test('David at home, no condition, and a stature that is a height', () => {
        const cases: [string, string][] = [
            [
                '1 Samuel 17. David served as Saul’s armourbearer while the ' +
                    'Philistines gathered for war.',
                'feed his father',
            ],
            [
                'Matthew 18 (seventy times seven). **The passage answers:** ' +
                    'when a brother repents, the count is gone.',
                'Luke 17:3',
            ],
            // BN-174 (ab42, Opus): "whenever", and asking for forgiveness.
            [
                'Matthew 18 (seventy times seven). Jesus says that when a ' +
                    'brother sins and asks for forgiveness, we forgive.',
                'Luke 17:3',
            ],
            [
                'Matthew 18 (seventy times seven). Whenever a brother ' +
                    'repents, the count starts over.',
                'Luke 17:3',
            ],
            [
                'Zacchaeus. "little of stature" mirrors his social standing.',
                'never a picture of his standing',
            ],
        ];
        for (const [text, truth] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain(truth);
        }
        for (const text of [
            '1 Samuel 17. David had been armourbearer, but when the ' +
                'Philistines gathered he was home with the sheep.',
            'Matthew 18 (seventy times seven). God forgives us when we repent.',
            'Matthew 18 (seventy times seven). If he repent, forgive him ' +
                '(Luke 17:3), but Peter asked about counting.',
            'Matthew 18. If he repent, forgive him (Luke 17:3).',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-165 (ab35 Opus, ab37 Sonnet: an error): Luke 3:12-13 named for
    // publicans counted with sinners.
    test('the publicans with sinners are Luke 5 and 15, not Luke 3', () => {
        const [legend] = findLessonLegends(
            'Zacchaeus. He was a "publican," a gatherer of taxes who was often ' +
                'counted with sinners [^(KJV) Luke 3:12-13].',
        );
        expect(legend?.text).toContain('Exact no more');
        expect(legend?.text).toContain('Luke 5:30');
        // The verses named for what they say, or the right verse: left.
        for (const text of [
            'Zacchaeus. John told the publicans to exact no more ' +
                '[^Luke 3:12-13].',
            'Zacchaeus. Publicans were counted with sinners [^Luke 5:30].',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-166 (ab36, ab37, Opus): a range one verse early, and 40:23's two
    // halves made one.
    test('Luke 18:35 and Isaiah 40:23 as they read', () => {
        const [jericho] = findLessonLegends(
            'Zacchaeus. Just before, a blind man received his sight through ' +
                'faith [^(KJV) Luke 18:34-43].',
        );
        expect(jericho?.text).toContain('Luke 18:35-43');
        const [princes] = findLessonLegends(
            'Isaiah 40. He is the Holy One who makes the princes of the ' +
                'earth as vanity.',
        );
        expect(princes?.text).toContain('the JUDGES made as vanity');
        for (const text of [
            'Zacchaeus. A blind man received his sight [^Luke 18:35-43].',
            'Isaiah 40. He bringeth the princes to nothing; he maketh the ' +
                'judges of the earth as vanity.',
            'Isaiah 40. He brings princes to nothing.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-167 (ab38, Opus): a saying told at the wrong time, to the wrong
    // hearers, and Proverbs 3:3's two halves made one.
    test('who heard it, and when, as the chapter says', () => {
        const cases: [string, string][] = [
            [
                'Revelation 21. Jesus wept at the grave of Lazarus and made ' +
                    'him live again, saying, "I am the resurrection, and the ' +
                    'life" [^John 11:25].',
                'said to Martha on the way',
            ],
            [
                'Psalm 51. Jesus showed this by eating with sinners and ' +
                    'telling them that "They that be whole need not a ' +
                    'physician" [^Matthew 9:12].',
                'said to the Pharisees',
            ],
            [
                'Proverbs 3. This follows the call to bind mercy and truth ' +
                    'upon the heart.',
                'bound about the neck',
            ],
        ];
        for (const [text, truth] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain(truth);
        }
        for (const text of [
            'Revelation 21. Jesus told Martha, "I am the resurrection, and ' +
                'the life," and then raised Lazarus [^John 11:25].',
            'Psalm 51. When the Pharisees complained, Jesus answered, ' +
                'telling them, "They that be whole need not a physician."',
            'Proverbs 3. Bind them about thy neck; write them upon the ' +
                'table of thine heart.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    test("the LORD's desolations, and a stone's vulnerable spot", () => {
        for (const text of [
            'Psalm 46. He became our ultimate refuge by taking the ' +
                '"desolations" of the cross upon Himself.',
            'Psalm 46. On the cross, Jesus took the "desolations" of the ' +
                'earth upon Himself.',
        ]) {
            const [legend] = findLessonLegends(text);
            expect(legend?.text, text).toContain(
                'what desolations he hath made',
            );
        }
        // The verse said as it reads: left.
        expect(
            findLessonLegends(
                'Psalm 46. Verse 8 calls us to behold the desolations the ' +
                    'LORD hath made in the earth.',
            ),
        ).toEqual([]);
        const [stone] = findLessonLegends(
            'Goliath fell. God directed it to the only vulnerable spot on ' +
                "Goliath's head.",
        );
        expect(stone.text).toContain('sunk into his forehead');
    });

    // BN-162 (ab35, both readers): five lines of shape36's lessons.
    test('the God of Jacob, 3:10, the crowd, a stature, the scorched seed', () => {
        const cases: [string, string][] = [
            [
                'Psalm 46. The psalm celebrates the Lord of hosts as the ' +
                    'protector of the God of Jacob.',
                'IS the God of Jacob',
            ],
            [
                'Jonah preached. In Jonah 3:10, we see that God is ' +
                    '"merciful" and saves people who turn to Him.',
                'name 4:2 for it',
            ],
            [
                'Zacchaeus. This miracle drew a multitude that followed Jesus ' +
                    'into the city of Jericho.',
                'hearing the multitude pass by',
            ],
            [
                'Zacchaeus. **What it means:** "little of stature" means ' +
                    'Zacchaeus was short, but it also pictures his low ' +
                    'standing among the people.',
                'never a picture of his standing',
            ],
            [
                'The parable of the sower (Matthew 13). Jesus perfectly ' +
                    'obeyed, yet he allowed himself to be "scorched" by the ' +
                    'tribulations of the cross.',
                'never Christ or his cross',
            ],
        ];
        for (const [text, truth] of cases) {
            const found = findLessonLegends(text);
            expect(found, text).toHaveLength(1);
            expect(found[0].text, text).toContain(truth);
        }
        // What the verses say: left.
        for (const text of [
            'Psalm 46. The LORD of hosts is with us; the God of Jacob is ' +
                'our refuge.',
            'Jonah. God saw their works (3:10), and Jonah knew he was ' +
                '"merciful" (4:2).',
            'Jonah. When God saw their works, He chose to be merciful.',
            'Zacchaeus. The blind man heard the multitude pass by, and ' +
                'after he was healed he followed Jesus.',
            'Zacchaeus was little of stature, so he climbed a sycomore tree.',
            'The sower (Matthew 13). Jesus says the seed on stony places ' +
                'was scorched, for it had no root in himself.',
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
    });

    // BN-159 (ab34, Sonnet: an error; Opus twice before): the lawyer given
    // a crowd and peers Luke never names.
    test("the lawyer's question has no crowd in Luke", () => {
        for (const text of [
            'The Good Samaritan. The lawyer was an expert in the law of ' +
                'Moses, and he was speaking to Jesus in front of a crowd.',
            'The Samaritan. This lawyer was an expert in the law of Moses, ' +
                'speaking to a crowd that included both his peers and the ' +
                'disciples.',
        ]) {
            const [legend] = findLessonLegends(text);
            expect(legend?.text, text).toContain('Luke names no crowd');
        }
        // BN-172 (ab41): the lawyer named the sentence before, "a legal
        // expert" in this one.
        const [expert] = findLessonLegends(
            'The Samaritan. In this setting, a lawyer stands up to tempt ' +
                'Jesus. He is a legal expert of the Jewish law, speaking to ' +
                'Jesus in front of a crowd.',
        );
        expect(expert?.text).toContain('Luke names no crowd');
        // A crowd in an example after a line on the lawyer: left.
        expect(
            findLessonLegends(
                'The Samaritan. The lawyer wanted to justify himself. **For ' +
                    'example:** A crowd gathers at the market.',
            ),
        ).toEqual([]);
        // A crowd in an example, with no lawyer: left.
        expect(
            findLessonLegends(
                'The Samaritan stopped. **For example:** A person walks ' +
                    'through a crowded shopping centre.',
            ),
        ).toEqual([]);
    });

    // BN-158 (ab33, both readers: an error): the Beatitudes said to the
    // Pharisees in a Psalm 51 sermon's Christ section.
    test('the Beatitudes are taught to his disciples', () => {
        const [legend] = findLessonLegends(
            'In the Gospels, Jesus tells the Pharisees that "blessed are the ' +
                'poor in spirit" (Matthew 5:3), which is the broken heart David ' +
                'sought.',
        );
        expect(legend.text).toContain('his disciples came unto him');
        // Told to his disciples, or the Pharisees in another sentence: left.
        expect(
            findLessonLegends(
                'Jesus taught his disciples, "Blessed are the poor in spirit." ' +
                    'Later the Pharisees murmured.',
            ),
        ).toEqual([]);
    });

    test("David's own reason for the armour, and Jonah's errand", () => {
        for (const text of [
            '**A hearer asks:** Why did David insist on fighting without ' +
                'armor and with only a sling?\n**The passage answers:** ' +
                'David wanted the victory to be clear so that the ' +
                'Philistines would know that the Lord saves not with sword ' +
                'and spear (verse 47). Goliath fell.',
            '**A hearer asks:** Why did David refuse the sword and spear?\n' +
                '**The passage answers:** He wanted the world to know that ' +
                "the battle is the LORD's. Goliath fell.",
        ]) {
            const [legend] = findLessonLegends(text);
            expect(legend?.text, text).toContain('I have not proved them');
        }
        // BN-163 (ab36, Opus): a "because" of the lesson's own.
        const [because] = findLessonLegends(
            "Goliath came. David had not proved Saul's armor. He rejects " +
                'the brass helmet and coat of mail because they are not the ' +
                'tools God used to give him victory in the past.',
        );
        expect(because?.text).toContain('I have not proved them');
        expect(
            findLessonLegends(
                "Goliath came. David tried on Saul's armour. He put it off " +
                    'because he had not proved it.',
            ),
        ).toEqual([]);
        // The verse's own reason, and 17:47 said as David says it, are left.
        for (const text of [
            "Goliath came near. David put off Saul's armour, for he had " +
                'not proved it, so that he could fight his own way.',
            'Goliath mocked him. David told Goliath that all this assembly ' +
                'shall know that the LORD saveth not with sword and spear.',
            // A hearer's application.
            'Goliath stood tall. This week, take off your own armour so ' +
                "that others can see God's strength.",
        ]) {
            expect(findLessonLegends(text), text).toEqual([]);
        }
        const [jonah] = findLessonLegends(
            'Jonah ran away. Then Jonah came out of the fish and went to ' +
                'save Nineveh, the great city.',
        );
        expect(jonah.text).toContain('"cry against" Nineveh');
        expect(
            findLessonLegends(
                'Jonah preached and God chose to save Nineveh when it turned.',
            ),
        ).toEqual([]);
    });

    test('the note quotes the line and asks for one more edit', () => {
        const note = genLessonLegendNote(
            findLessonLegends(
                "Goliath fell, for the stone found the only gap in the giant's " +
                    'armour.',
            ),
        );
        expect(note).toContain('The change is made');
        expect(note).toContain(
            '"Goliath fell, for the stone found the only gap in the giant\'s armour."',
        );
        expect(note).toContain('Change ONLY that line with ONE more edit');
    });

    // BN-152 (shape31's L-11): told only the words, a model counted its own
    // lines and changed the block above; the window names the block it read.
    test('the note names the block the line is in, when read', () => {
        const legends = findLessonLegends(
            "Goliath fell, for the stone found the only gap in the giant's " +
                'armour.',
        );
        const note = genLessonLegendNote(legends, [12]);
        expect(note).toContain('block 12: "Goliath fell');
        // The change spelt out as `text`: told "its words", a model sent
        // the new line as `words` and was refused (BN-152's first run).
        expect(note).toContain(
            'Change ONLY that line with ONE more edit -- {block: 12, text: ' +
                '<its words, that line saying what the verses say>} --',
        );
        // Not found in the note as read: the words alone.
        expect(genLessonLegendNote(legends, [null])).toContain(
            'Change ONLY that line with ONE more edit',
        );
    });
});
