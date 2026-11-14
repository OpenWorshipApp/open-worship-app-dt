import { describe, expect, test } from 'vitest';

import {
    findStretchedChristWords,
    findUnquotedChristVerses,
    genChristVerseNote,
    readLessonPassageRef,
    toRefBook,
} from './lessonChristVerseHelpers';

// BN-154 (2026-11-11, the ab31 read): Sonnet's three errors were verses of
// another book told in the model's own words in Pointing to Jesus.
const toLesson = (christ: string) => {
    return (
        '[^Psalm 46:1-11]\n## Big idea\nGod is our refuge [^Psalm 46:1].\n' +
        `## Pointing to Jesus\n${christ}\n## Response\nTrust him, for God ` +
        'so loved the world [^John 3:16].'
    );
};

describe('a verse of another book told in Pointing to Jesus', () => {
    test('finds a line naming another book with none of its words', () => {
        // The shape32 lesson's own words: the quotation before it ends the
        // sentence it is in.
        expect(
            findUnquotedChristVerses(
                toLesson(
                    'The psalm declares, "God is our refuge and strength." In ' +
                        'the Gospels, Jesus tells His followers that whoever ' +
                        'abides in Him will find rest [^(KJV) Matthew 11:28]. ' +
                        'This refuge became complete at the cross.',
                ),
                'Psalm 46:1-11',
            ),
        ).toEqual([
            {
                sentence:
                    'In the Gospels, Jesus tells His followers that whoever ' +
                    'abides in Him will find rest [^(KJV) Matthew 11:28].',
                ref: 'Matthew 11:28',
            },
        ]);
        // A word in quotation marks is no quotation of the verse.
        expect(
            findUnquotedChristVerses(
                toLesson(
                    'Jesus tells the Pharisees that they are "unclean" inside ' +
                        '[^Matthew 23:25].',
                ),
                'Psalm 51:1-19',
            ),
        ).toHaveLength(1);
    });

    test('lets a quoted verse, the passage book and other parts be', () => {
        for (const christ of [
            // Quoted: BN-110 holds it to its verse.
            'Jesus says, "Come unto me, all ye that labour" [^Matthew 11:28].',
            // The passage's own book.
            'At its end the psalm says God is with us [^Psalm 46:11].',
            // No reference at all.
            'Jesus is our refuge in his death and rising.',
        ]) {
            expect(
                findUnquotedChristVerses(toLesson(christ), 'Psalm 46:1-11'),
                christ,
            ).toEqual([]);
        }
        // John 3:16 under the Response is no part of Pointing to Jesus.
        expect(
            findUnquotedChristVerses(toLesson('He is with us.'), 'Psalm 46'),
        ).toEqual([]);
        // No passage known, or no Christ section: nothing is read.
        expect(
            findUnquotedChristVerses(
                toLesson('He wins [^Revelation 7:9].'),
                null,
            ),
        ).toEqual([]);
        expect(
            findUnquotedChristVerses('## Big idea\nGrace.', 'Psalm 46:1'),
        ).toEqual([]);
    });

    test('reads a reference in brackets too, two lines at most', () => {
        const found = findUnquotedChristVerses(
            toLesson(
                'Christ is the power of God (1 Corinthians 1:24). He brought ' +
                    'a great multitude out of fear [^Revelation 7:9]. We are ' +
                    'ambassadors whom God beseeches [^2 Corinthians 5:20].',
            ),
            '1 Samuel 17:1-58',
        );
        expect(
            found.map((item) => {
                return item.ref;
            }),
        ).toEqual(['1 Corinthians 1:24', 'Revelation 7:9']);
    });

    test('the passage a new lesson is written on', () => {
        expect(
            readLessonPassageRef([
                { block: 1, remove: true },
                { after: 0, kind: 'passage', ref: 'Philippians 4:4-13' },
            ]),
        ).toBe('Philippians 4:4-13');
        expect(
            readLessonPassageRef([
                { block: 1, remove: true },
                {
                    after: 0,
                    kind: 'section',
                    text: '[^(KJV) Psalm 46:1-11]\n## Big idea\nRefuge.',
                },
            ]),
        ).toBe('Psalm 46:1-11');
        expect(readLessonPassageRef([])).toBe(null);
        expect(readLessonPassageRef(null as any)).toBe(null);
    });

    test('a book by its name', () => {
        expect(toRefBook('Matthew 11:28')).toBe('MAT');
        expect(toRefBook('1 Corinthians 1:24')).toBe('1CO');
        expect(toRefBook('Psalms 46:1-11')).toBe('PSA');
        expect(toRefBook('Song of Solomon 2:4')).toBe('SNG');
        expect(toRefBook('Hezekiah 1:1')).toBe(null);
    });

    test("the note gives the verse's own words and its block", () => {
        expect(genChristVerseNote([])).toBe(null);
        const item = {
            sentence: 'Jesus tells that whoever abides in Him finds rest.',
            ref: 'Matthew 11:28',
            verse:
                '(28): Come unto me, all ye that labour and are heavy laden, ' +
                'and I will give you rest.',
        };
        const note = genChristVerseNote([item], [19]);
        expect(note).toContain(
            'block 19: "Jesus tells that whoever abides in Him finds rest." ' +
                '-- Matthew 11:28 reads: "Come unto me, all ye that labour',
        );
        expect(note).toContain(
            'Change ONLY that line with ONE more edit -- {block: 19, text: ' +
                '<its words, the verse quoted word for word as it reads, then ' +
                'its token>} --',
        );
        expect(note).toContain('every other block as it is now');
        // Not found in the note as read: the words alone.
        expect(genChristVerseNote([item], [null])).toContain(
            'the verse quoted word for word as it reads, then its token,',
        );
    });
});

// BN-163 (ab35, ab36, both readers: Pointing to Jesus 1 of 2 in 13 lessons
// of 32): a word of the passage, quoted, put on Christ.
describe('a word of the passage put on Christ', () => {
    const psalm46 =
        '(1): God is our refuge and strength, a very present help in ' +
        'trouble. (4): There is a river, the streams whereof shall make glad ' +
        'the city of God. (8): Come, behold the works of the LORD, what ' +
        'desolations he hath made in the earth.';

    test('finds the passage word his work is made of', () => {
        for (const [christ, word] of [
            [
                'He is the ultimate "river" of living water who provides ' +
                    'the peace of God.',
                'river',
            ],
            [
                'He became our ultimate refuge by taking the "desolations" ' +
                    'of the cross upon Himself.',
                'desolations',
            ],
        ]) {
            const [found] = findStretchedChristWords(toLesson(christ), psalm46);
            expect(found?.sentence, christ).toBe(christ);
            expect(found.text).toContain(`"${word}" is the passage's own word`);
            expect(found.text).toContain('never its word put on him');
        }
    });

    test('leaves another verse, what he bore, and an unread passage', () => {
        for (const christ of [
            // Not the passage's word: John's, held by BN-154.
            'Jesus is the "good shepherd" who giveth his life for the sheep.',
            // A passage word said, not made his.
            'The psalm says "God is our refuge", and Jesus is that refuge.',
            // What the Scriptures say he bore.
            'On the cross he took the "iniquity" of us all upon himself.',
        ]) {
            expect(
                findStretchedChristWords(
                    toLesson(christ),
                    psalm46 + ' (9): iniquity of us all; good shepherd',
                ),
                christ,
            ).toEqual([]);
        }
        expect(
            findStretchedChristWords(
                toLesson('He is the ultimate "river" of living water.'),
                '',
            ),
        ).toEqual([]);
        // No Pointing to Jesus section.
        expect(
            findStretchedChristWords(
                'He took the "desolations" upon himself.',
                psalm46,
            ),
        ).toEqual([]);
    });

    // BN-262 (ab93, Sonnet: two errors in one batch): "whose" and a mocking
    // verb put the passage's word on him too.
    test('finds it after "whose" and a mocking verb', () => {
        const psalm32 =
            '(1): Blessed is he whose transgression is forgiven, whose sin ' +
            'is covered. (3): When I kept silence, my bones waxed old ' +
            'through my roaring all the day long.';
        const nehemiah4 =
            '(2): And he spake before his brethren and the army of Samaria, ' +
            'and said, What do these feeble Jews?';
        for (const [christ, passage, word] of [
            [
                'He was the one whose "bones" were crushed on the cross so ' +
                    'that we could be forgiven.',
                psalm32,
                'bones',
            ],
            [
                'He was mocked as "feeble" by the rulers of His day.',
                nehemiah4,
                'feeble',
            ],
        ]) {
            const [found] = findStretchedChristWords(toLesson(christ), passage);
            expect(found?.sentence, christ).toBe(christ);
            expect(found.text).toContain(`"${word}" is the passage's own word`);
        }
        for (const christ of [
            // The phrase quoted, "whose" inside it: the big idea named.
            'The big idea is found in the phrase "whose sin is covered."',
            // Mocked, and no word of the passage quoted.
            'He was mocked by the soldiers and bore it in silence.',
        ]) {
            expect(
                findStretchedChristWords(toLesson(christ), psalm32),
                christ,
            ).toEqual([]);
        }
    });
});
