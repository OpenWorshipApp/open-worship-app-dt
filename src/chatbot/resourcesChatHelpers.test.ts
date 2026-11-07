import { describe, expect, test } from 'vitest';

import {
    RESOURCE_ASK_TOOL_NAME,
    RESOURCES_CROSS_REFERENCE_HINT,
    RESOURCES_SYSTEM_PROMPT,
    RESOURCES_TOOL_NAME,
    genResourceAskActions,
    genResourceChapterVerseSequence,
    genResourceOpeningAnswer,
    genResourceReadMenuReplies,
    genResourceRangeReplies,
    genResourcesRangeHint,
    sanitizeResourceReadingAnswer,
    toResourceChapterRef,
    toResourceChapterVerseCount,
    toResourceFileKind,
    toResourcePassageRef,
    toResourcesAsk,
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

    test('a list of links is not read verse by verse either', () => {
        const opening = genResourceOpeningAnswer('MAT.0.json', null);
        expect(opening.replies).not.toContain('Read');
        expect(opening.replies).not.toContain('1');
    });
});
