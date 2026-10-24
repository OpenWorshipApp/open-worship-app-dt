import { describe, expect, test } from 'vitest';

import {
    RESOURCE_ASK_TOOL_NAME,
    RESOURCES_CROSS_REFERENCE_HINT,
    RESOURCES_RANGE_HINT,
    RESOURCES_SYSTEM_PROMPT,
    RESOURCES_TOOL_NAME,
    checkIsDegenerateResourceReading,
    findResourceReading,
    genResourceAskActions,
    genResourceChapterVerseSequence,
    genResourceOpeningAnswer,
    genResourceReadMenuReplies,
    genResourceRangeReplies,
    genResourceReadingReplies,
    genResourcesRangeHint,
    sanitizeResourceReadingAnswer,
    toResourceChapterRef,
    toResourceChapterVerseCount,
    toResourceFileKind,
    toResourceReadingAsk,
    toResourceReadingRange,
    toResourcePassageRef,
    toResourcesAsk,
    toResourceVerseFallback,
    toWholeResourceChapterRef,
} from './resourcesChatHelpers';

describe('a question about the Resources files', () => {
    test('names the open file and the way to the rest, after the words', () => {
        const asked = toResourcesAsk('and chapter 7?', ['pdf/LUK.6.pdf']);
        expect(asked.startsWith('and chapter 7?\n\n')).toBe(true);
        expect(asked).toContain(
            '"pdf/LUK.6.pdf" in the user\'s Resources folders',
        );
        expect(asked).toContain(RESOURCES_TOOL_NAME);
        expect(
            toResourcesAsk('compare them', ['pdf/LUK.6.pdf', 'notes/LUK.own']),
        ).toContain('The attached files are "pdf/LUK.6.pdf", "notes/LUK.own"');
    });

    // The file changes per tab; the prompt is a cached prefix, so nothing
    // that changes may be in it.
    test('keeps the prompt the same whatever is open', () => {
        expect(RESOURCES_SYSTEM_PROMPT).not.toContain('pdf/');
        expect(RESOURCES_SYSTEM_PROMPT).toContain(RESOURCES_TOOL_NAME);
        expect(RESOURCES_SYSTEM_PROMPT).toContain('LUK.6.pdf');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('owa_lookup_record');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('paragraph breaks');
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'has exactly one main passage',
        );
        // A question with no verse in it is answered, not met with "which
        // verses?" (2026-10-22, _Explain it in simple words_ under
        // `MAT.18.pdf`).
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'never with a question back about which verse',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain('matching explanation');
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'narrow reference column beside the Bible text is cross-references',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain('below a horizontal rule');
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'Do not merely repeat the Bible verse',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'When their message is just "Read" or its translated equivalent',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'Full chapter starts at verse 1',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'chosen passage as the only main passage',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'at most two related resource',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain('OPTIONS:');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('other PDFs');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('button to continue');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('up to eight pages');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('read on from `nextPage`');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('never discuss page batches');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('join both parts');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('detail "high"');
    });

    test('the chosen verse or range keeps the rendered reading bounded', () => {
        expect(RESOURCES_RANGE_HINT).toContain('verse or range chosen');
        expect(RESOURCES_RANGE_HINT).toContain('full Bible text');
        expect(RESOURCES_RANGE_HINT).toContain('cross-reference labels');
        expect(RESOURCES_RANGE_HINT).toContain('matching PDF explanation');
        expect(RESOURCES_RANGE_HINT).toContain('already called');
        expect(RESOURCES_RANGE_HINT).toContain('never complete it from memory');
        expect(RESOURCES_RANGE_HINT).toContain('owa_resource_file');
        expect(RESOURCES_RANGE_HINT).toContain('detail "high"');
        expect(RESOURCES_RANGE_HINT).toContain(
            'attached Resources PDF is read before answering',
        );
        expect(RESOURCES_RANGE_HINT).toContain('nextPage');
        expect(RESOURCES_RANGE_HINT).toContain(
            'do not talk to the user about pages',
        );
        expect(RESOURCES_RANGE_HINT).toContain(
            'continues across a page boundary',
        );
        expect(RESOURCES_RANGE_HINT).toContain(
            'call owa_lookup_record before showing it',
        );
        expect(RESOURCES_RANGE_HINT).toContain('raw abbreviation');
    });

    test('a cross-reference press opens one exact verse card', () => {
        expect(RESOURCES_CROSS_REFERENCE_HINT).toContain(
            'owa_lookup_record for this exact reference',
        );
        expect(RESOURCES_CROSS_REFERENCE_HINT).toContain('one main verse');
        expect(RESOURCES_CROSS_REFERENCE_HINT).toContain(
            'matching Resources PDF',
        );
    });

    test('the Read menu puts the verses being read first', () => {
        expect(genResourceReadMenuReplies(null)).toEqual([
            '1',
            '2',
            '3',
            '1-3',
            'Full chapter',
        ]);
        expect(genResourceReadMenuReplies('15-17')).toEqual([
            '15-17',
            '1',
            '2',
            '3',
            '1-3',
            'Full chapter',
        ]);
        // Never the same button twice.
        expect(genResourceReadMenuReplies('1-3')).toEqual([
            '1-3',
            '1',
            '2',
            '3',
            'Full chapter',
        ]);
    });

    test('offers the verses after the chosen range and stops at the end', () => {
        // A chosen RANGE moves past its END, not its start (2026-10-19):
        // `1-3` answered with verse 1 only, and its next buttons were 2/3/4.
        expect(genResourceRangeReplies('1–3')).toEqual(['4', '5', '6']);
        expect(genResourceRangeReplies('4-6')).toEqual(['7', '8', '9']);
        expect(genResourceRangeReplies('1-5')).toEqual(['6', '7', '8']);
        expect(genResourceRangeReplies('Full chapter')).toEqual([
            '2',
            '3',
            '4',
        ]);
        expect(genResourceRangeReplies('35', 36)).toEqual(['36']);
        expect(genResourceRangeReplies('36', 36)).toEqual([]);
    });

    test('queues Full chapter as one isolated ask per real verse', () => {
        const john3 = genResourceChapterVerseSequence(36);
        expect(john3).toHaveLength(36);
        expect(john3[0]).toBe(1);
        expect(john3.at(-1)).toBe(36);
        expect(genResourceChapterVerseSequence(999)).toHaveLength(200);
    });

    test('keeps quoted cross-references as clickable reading choices', () => {
        expect(
            genResourceReadingReplies('1–3', [
                'John 3:16',
                'យ៉ូហាន ៣:៣៦',
                '4–6',
                'John 3:16',
                'This is prose, not a reference',
            ]),
        ).toEqual(['John 3:16', 'យ៉ូហាន ៣:៣៦', '4', '5', '6']);
        expect(
            genResourceReadingReplies(
                '36',
                ['John 3:16', 'This is not a reference'],
                36,
            ),
        ).toEqual(['John 3:16']);
        expect(
            genResourceReadingReplies('1', ['ម៉ាថាយ ៣:៧, ម៉ាកុស ២:១៦']),
        ).toEqual(['ម៉ាថាយ ៣:៧', 'ម៉ាកុស ២:១៦', '2', '3', '4']);
        expect(
            genResourceReadingReplies('1', ['mf 3:7', 'mk 2:16', 'Luke 5:17']),
        ).toEqual(['Luke 5:17', '2', '3', '4']);
    });

    test('turns every cross-reference on the answer line into a button', () => {
        // The page's narrow column lists six; only two fitted in OPTIONS.
        // The user asked for all of them to be pressable (2026-10-19).
        const answer = [
            'គម្ពីរ៖ (១) … (២) … (៣) …',
            'យោង៖ ម៉ាថាយ ៩:៣២, ម៉ាថាយ ៩:៣៥,',
            'ម៉ាថាយ ២០:២០-២៨, លូកា ៩:៤៦, លូកា ១២:១៣, យ៉ូហាន ១៣:១៣-១៧',
            'ការពន្យល់ពី PDF៖ …',
        ].join('\n');
        expect(genResourceReadingReplies('1–3', [], 35, answer)).toEqual([
            'ម៉ាថាយ ៩:៣២',
            'ម៉ាថាយ ៩:៣៥',
            'ម៉ាថាយ ២០:២០-២៨',
            'លូកា ៩:៤៦',
            'លូកា ១២:១៣',
            'យ៉ូហាន ១៣:១៣-១៧',
            '4',
            '5',
            '6',
        ]);
        // The English word, and a bold label, read the same.
        expect(
            genResourceReadingReplies(
                '1',
                [],
                35,
                '**References:** Matthew 9:32, Luke 9:46',
            ),
        ).toEqual(['Matthew 9:32', 'Luke 9:46', '2', '3', '4']);
        // Every printed reference is a button -- across books too -- and a
        // range or an abbreviation still is not a reference.
        expect(
            genResourceReadingReplies(
                '1',
                [],
                35,
                'References: Matthew 9:32, Matthew 9:35, Matthew 20:20-28, Luke 9:46, Luke 12:13, John 13:13-17, Mark 2:16, 4-6, mf 3:7',
            ),
        ).toEqual([
            'Matthew 9:32',
            'Matthew 9:35',
            'Matthew 20:20-28',
            'Luke 9:46',
            'Luke 12:13',
            'John 13:13-17',
            'Mark 2:16',
            '2',
            '3',
            '4',
        ]);
    });

    test('rejects a looping PDF reading and keeps ordinary prose', () => {
        expect(
            checkIsDegenerateResourceReading(
                'Explanation: word word word word word word word',
            ),
        ).toBe(true);
        expect(
            checkIsDegenerateResourceReading(
                'Explanation: grace and truth grace and truth grace and truth grace and truth',
            ),
        ).toBe(true);
        expect(
            checkIsDegenerateResourceReading(
                'Jesus explains the new birth and then answers Nicodemus.',
            ),
        ).toBe(false);
    });

    test('removes guessed xref abbreviations and keeps verified full names', () => {
        expect(
            sanitizeResourceReadingAnswer(
                'Verse\nxref: mf 3:7, mk 2:16\nExplanation',
            ),
        ).toBe('Verse\nExplanation');
        expect(
            sanitizeResourceReadingAnswer(
                'Verse\nCross-references: Matthew 3:7; Luke 5:17',
            ),
        ).toContain('Matthew 3:7');
    });

    test('prepares a deterministic installed-Bible fallback', () => {
        expect(
            toResourceVerseFallback({
                kind: 'verse',
                bible: 'KHSV',
                passages: [
                    {
                        key: 'JHN 3:1',
                        title: 'យ៉ូហាន ៣:១',
                        text: 'មាន​បុរស​ម្នាក់​ឈ្មោះ​នីកូដេម។',
                    },
                ],
            }),
        ).toBe('**យ៉ូហាន ៣:១ · KHSV**\n\nមាន​បុរស​ម្នាក់​ឈ្មោះ​នីកូដេម។');
        expect(toResourceVerseFallback({ passages: [] })).toBeNull();
    });

    test('turns a chapter PDF and chosen range into an installed-Bible read', () => {
        expect(toResourceChapterRef(['pdf/JHN.3.pdf'])).toBe('JHN 3');
        expect(
            toWholeResourceChapterRef(
                { passages: [{ key: 'JHN 3:1-36', text: 'preview…' }] },
                'JHN 3',
            ),
        ).toBe('JHN 3:1-36');
        expect(
            toResourceChapterVerseCount(
                { passages: [{ key: 'JHN 3:1-36' }] },
                'JHN 3',
            ),
        ).toBe(36);
        expect(toWholeResourceChapterRef({}, 'JHN 3')).toBe('JHN 3');
        expect(
            toWholeResourceChapterRef(
                { passages: [{ key: 'GEN 3:1-24' }] },
                'JHN 3',
            ),
        ).toBe('JHN 3');
        expect(toResourcePassageRef(['pdf/JHN.3.pdf'], '1–3')).toBe(
            'JHN 3:1-3',
        );
        expect(toResourcePassageRef(['pdf/JHN.3.pdf'], '4-6')).toBe(
            'JHN 3:4-6',
        );
        // A longer range is cut to what one card may carry; the next buttons
        // move past what was read, never past what was asked.
        expect(toResourcePassageRef(['pdf/JHN.3.pdf'], '1-100')).toBe(
            'JHN 3:1-5',
        );
        expect(toResourcePassageRef(['pdf/JHN.3.pdf'], 'Full chapter')).toBe(
            'JHN 3:1',
        );
        expect(toResourcePassageRef(['notes.txt'], '1–3')).toBeNull();
        const prepared = genResourcesRangeHint(
            'John 3:1 full text',
            'JHN 3:1',
            'JHN 3:1-36',
        );
        expect(prepared).toContain('prepared the chapter index (JHN 3:1-36)');
        expect(prepared).toContain('only this passage');
        expect(prepared).toContain('JHN 3:1');
        expect(prepared).toContain('John 3:1 full text');
        expect(prepared).not.toContain('John 3:36 full text');
    });
});

// 2026-10-17, the user: _let user to interact with other chapter file_.
describe('a button for another file the assistant read', () => {
    test('is offered for each file read that is not already open', () => {
        expect(
            genResourceAskActions(
                ['pdf/LUK.7.pdf', 'pdf/LUK.6.pdf', 'pdf/LUK.7.pdf'],
                ['PDF/luk.6.pdf'],
            ),
        ).toEqual([
            {
                label: 'Ask about LUK.7.pdf',
                toolName: RESOURCE_ASK_TOOL_NAME,
                // The Resources NAME, never a path on the disk -- and one
                // button a file, however often it was read.
                args: { file: 'pdf/LUK.7.pdf' },
            },
        ]);
    });

    test('is three at most', () => {
        expect(
            genResourceAskActions(
                ['a/1.pdf', 'a/2.pdf', 'a/3.pdf', 'a/4.pdf'],
                [],
            ),
        ).toHaveLength(3);
        expect(genResourceAskActions([], ['a/1.pdf'])).toEqual([]);
    });
});

// 2026-10-22, the user's goal with `MAT.18.pdf`'s 🤖 circled under a Reader
// open on Matthew 18:15-17: _make the chatbot smarter to interact with user
// for the selected resource file_.
describe('the card a Resources file opens its tab with', () => {
    const reading = {
        bookKey: 'MAT',
        chapter: 18,
        verseStart: 15,
        verseEnd: 17,
        title: 'ម៉ាថាយ ១៨:១៥-១៧',
        bibleKey: 'ពគប',
    };

    test('knows a chapter PDF from a whole-book file and from anything else', () => {
        expect(toResourceFileKind('MAT.18.pdf')).toBe('chapter-pdf');
        expect(toResourceFileKind('pdf/MAT.18.pdf')).toBe('chapter-pdf');
        expect(toResourceFileKind('MAT.0.pdf')).toBe('introduction');
        expect(toResourceFileKind('YouTube/MAT.0.json')).toBe('introduction');
        expect(toResourceFileKind('PSA.-1.notes.txt')).toBe('introduction');
        expect(toResourceFileKind('MAT.18.own')).toBe('other');
        expect(toResourceFileKind('family-tree.jpeg')).toBe('other');
        expect(toResourceFileKind('MAT.01.pdf')).toBe('other');
    });

    test('an introduction is not a chapter to read verse by verse', () => {
        expect(toResourceChapterRef(['pdf/MAT.0.pdf'])).toBeNull();
        expect(toResourcePassageRef(['pdf/MAT.0.pdf'], '1')).toBeNull();
        expect(toResourceChapterRef(['pdf/MAT.0.pdf', 'pdf/MAT.18.pdf'])).toBe(
            'MAT 18',
        );
    });

    test('offers the verses being read, cut to one card', () => {
        expect(toResourceReadingRange('pdf/MAT.18.pdf', reading)).toBe('15-17');
        expect(
            toResourceReadingRange('MAT.18.pdf', {
                ...reading,
                verseStart: 6,
                verseEnd: 6,
            }),
        ).toBe('6');
        expect(
            toResourceReadingRange('MAT.18.pdf', {
                ...reading,
                verseStart: 10,
                verseEnd: 30,
            }),
        ).toBe('10-14');
        // The whole chapter is no particular passage.
        expect(
            toResourceReadingRange('MAT.18.pdf', {
                ...reading,
                verseStart: 1,
                verseEnd: 35,
            }),
        ).toBeNull();
        // Another chapter, another book, no verses, or not a chapter file.
        expect(toResourceReadingRange('MAT.17.pdf', reading)).toBeNull();
        expect(toResourceReadingRange('MRK.18.pdf', reading)).toBeNull();
        expect(
            toResourceReadingRange('MAT.18.pdf', {
                bookKey: 'MAT',
                chapter: 18,
                title: 'Matthew 18',
            }),
        ).toBeNull();
        expect(toResourceReadingRange('MAT.0.pdf', reading)).toBeNull();
        expect(toResourceReadingRange('MAT.18.pdf', null)).toBeNull();
    });

    test('a chapter PDF opens on the verses being read, then Read', () => {
        const opening = genResourceOpeningAnswer('MAT.18.pdf', reading);
        expect(opening.text).toContain('MAT.18.pdf is attached below.');
        expect(opening.text).toContain('Bible chapter study material');
        expect(opening.text).toContain(
            'You are reading ម៉ាថាយ ១៨:១៥-១៧ in the Bible Reader. ' +
                'Press 15-17 to read what this file says about it.',
        );
        expect(opening.replies).toEqual([
            '15-17',
            'Read',
            'What is this file about?',
            'Sum up the main points',
            'Explain it in simple words',
        ]);
        expect(opening.reading).toEqual(reading);
    });

    test('with nothing being read, it opens as it always did', () => {
        const opening = genResourceOpeningAnswer('MAT.18.pdf', null);
        expect(opening.text).not.toContain('You are reading');
        expect(opening.replies).toEqual([
            'Read',
            'What is this file about?',
            'Sum up the main points',
            'Explain it in simple words',
        ]);
        expect(opening.reading).toBeNull();
    });

    test('an introduction asks about the passage and has no verse Read', () => {
        const opening = genResourceOpeningAnswer('MAT.0.pdf', reading);
        expect(opening.text).not.toContain('arranged by verse');
        expect(opening.text).toContain('belongs to the whole book');
        expect(opening.text).toContain(
            'You are reading ម៉ាថាយ ១៨:១៥-១៧ in the Bible Reader.',
        );
        expect(opening.text).not.toContain('Press');
        expect(opening.replies).toEqual([
            'What does it say about ម៉ាថាយ ១៨:១៥-១៧?',
            'What is this file about?',
            'Sum up the main points',
            'Explain it in simple words',
        ]);
    });

    test('a list of links is not read verse by verse either', () => {
        const opening = genResourceOpeningAnswer('MAT.0.json', null);
        expect(opening.replies).not.toContain('Read');
        expect(opening.replies).not.toContain('1');
    });

    test('a reading of another book is not said', () => {
        const opening = genResourceOpeningAnswer('LUK.6.pdf', reading);
        expect(opening.text).not.toContain('You are reading');
        expect(opening.replies[0]).toBe('Read');
        expect(opening.reading).toBeNull();
    });

    test('the newest card that carries a reading is the one the menu uses', () => {
        expect(findResourceReading([])).toBeNull();
        expect(
            findResourceReading([
                { resourceReading: { ...reading, verseStart: 2 } },
                {},
                { resourceReading: reading },
                {},
            ]),
        ).toBe(reading);
    });
});

describe('what the person is reading rides a question that names no verse', () => {
    const reading = {
        bookKey: 'MAT',
        chapter: 18,
        verseStart: 15,
        verseEnd: 17,
        title: 'ម៉ាថាយ ១៨:១៥-១៧',
        bibleKey: 'ពគប',
    };

    test('names the passage, its reference and its Bible for the chapter file', () => {
        const said = toResourceReadingAsk(['pdf/MAT.18.pdf'], reading);
        expect(said.startsWith('\n\n(They are reading ម៉ាថាយ ១៨:១៥-១៧')).toBe(
            true,
        );
        expect(said).toContain('MAT 18:15-17');
        expect(said).toContain('do not ask which verse they mean');
        expect(said).toContain('ref "MAT 18:15-17", bible "ពគប"');
    });

    test('says only the chapter when the file is not that chapter', () => {
        const said = toResourceReadingAsk(['pdf/MAT.0.pdf'], reading);
        expect(said).toContain('(MAT 18)');
        expect(said).toContain('is about the file');
        expect(said).not.toContain('owa_lookup_record');
    });

    test('says nothing for another book or no reading at all', () => {
        expect(toResourceReadingAsk(['pdf/MRK.18.pdf'], reading)).toBe('');
        expect(toResourceReadingAsk(['pdf/MAT.18.pdf'], null)).toBe('');
        expect(toResourceReadingAsk(['pdf/MAT.18.pdf'], undefined)).toBe('');
    });

    test('leaves the Bible out when the reading named none', () => {
        const { bibleKey: _bibleKey, ...withoutBible } = reading;
        const said = toResourceReadingAsk(['MAT.18.pdf'], withoutBible);
        expect(said).toContain('(ref "MAT 18:15-17")');
        expect(said).not.toContain('in the Bible "');
    });
});
