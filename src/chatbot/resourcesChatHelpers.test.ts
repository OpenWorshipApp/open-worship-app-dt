import { describe, expect, test } from 'vitest';

import {
    RESOURCE_ASK_TOOL_NAME,
    RESOURCES_CROSS_REFERENCE_HINT,
    RESOURCES_READ_MENU_HINT,
    RESOURCES_RANGE_HINT,
    RESOURCES_SYSTEM_PROMPT,
    RESOURCES_TOOL_NAME,
    checkIsDegenerateResourceReading,
    genResourceAskActions,
    genResourceChapterVerseSequence,
    genResourceRangeReplies,
    genResourceReadingReplies,
    genResourcesRangeHint,
    sanitizeResourceReadingAnswer,
    toResourceChapterRef,
    toResourceChapterVerseCount,
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
            'Every answer card has exactly one main verse',
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
            'selected verse as the only main verse',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain(
            'at most two related resource',
        );
        expect(RESOURCES_SYSTEM_PROMPT).toContain('OPTIONS:');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('other PDFs');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('button to continue');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('returns the complete file');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('never discuss page batches');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('join both parts');
        expect(RESOURCES_SYSTEM_PROMPT).toContain('detail "high"');
    });

    test('the chosen verse keeps the rendered reading bounded', () => {
        expect(RESOURCES_RANGE_HINT).toContain('one verse chosen');
        expect(RESOURCES_RANGE_HINT).toContain('full Bible text');
        expect(RESOURCES_RANGE_HINT).toContain('cross-reference labels');
        expect(RESOURCES_RANGE_HINT).toContain('matching PDF explanation');
        expect(RESOURCES_RANGE_HINT).toContain('already called');
        expect(RESOURCES_RANGE_HINT).toContain(
            'never complete a verse from memory',
        );
        expect(RESOURCES_RANGE_HINT).toContain('owa_resource_file');
        expect(RESOURCES_RANGE_HINT).toContain('detail "high"');
        expect(RESOURCES_RANGE_HINT).toContain(
            'complete attached Resources PDF',
        );
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

    test('the Read menu starts with a brief content description', () => {
        expect(RESOURCES_READ_MENU_HINT).toContain(
            'no more than two short sentences',
        );
        expect(RESOURCES_READ_MENU_HINT).toContain(
            'what the attached PDF actually covers',
        );
        expect(RESOURCES_READ_MENU_HINT).toContain(
            'the app adds the verse question and buttons',
        );
    });

    test('offers individual next verses and stops at the chapter end', () => {
        expect(genResourceRangeReplies('1–3')).toEqual(['2', '3', '4']);
        expect(genResourceRangeReplies('4-6')).toEqual(['5', '6', '7']);
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
        ).toEqual(['John 3:16', 'យ៉ូហាន ៣:៣៦', '2', '3', '4']);
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
        expect(toResourcePassageRef(['pdf/JHN.3.pdf'], '1–3')).toBe('JHN 3:1');
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
        expect(prepared).toContain('only this one verse');
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
