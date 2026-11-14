import { describe, expect, it } from 'vitest';

import {
    FACT_CHECK_SYSTEM_PROMPT,
    checkHasPassageRead,
    genLessonFactCheckAsk,
    readLessonFactFindings,
} from './lessonFactCheckHelpers';

// BN-226 (2026-11-13, the held-out read): Genesis 22:14 names the PLACE
// Jehovahjireh, and a lesson said the name was the ram's.
const GENESIS_22_READ = JSON.stringify({
    bible: 'KJV',
    verses: [
        {
            key: 'GEN 22:13-14',
            ref: 'Genesis 22:13-14',
            text:
                '(13): And Abraham lifted up his eyes, and looked, and behold ' +
                'behind him a ram caught in a thicket by his horns (14): And ' +
                'Abraham called the name of that place Jehovahjireh',
        },
    ],
});
const BLOCKS = [
    {
        n: 1,
        kind: 'passage',
        text: '(KJV) Genesis 22:1-19 — (1): And it came to pass after these things',
    },
    { n: 2, kind: 'h2', text: 'Big idea' },
    { n: 3, kind: 'paragraph', text: 'God provides what he asks.' },
    {
        n: 4,
        kind: 'paragraph',
        text:
            '**What it means:** The name Jehovahjireh refers to the ram God ' +
            'gave in the place of Isaac.',
    },
];

describe('a new lesson read against the verses it read (BN-226)', () => {
    it('asks with the verses read and the passage, then the lesson alone', () => {
        const ask = genLessonFactCheckAsk(BLOCKS, [
            'help me prepare a sermon',
            GENESIS_22_READ,
            GENESIS_22_READ,
        ])!;
        expect(ask).toContain(
            'Genesis 22:13-14: (13): And Abraham lifted up his eyes',
        );
        // A passage read twice is said once.
        expect(ask.split('Genesis 22:13-14:')).toHaveLength(2);
        expect(ask).toContain('(KJV) Genesis 22:1-19');
        const lesson = ask.split('THE LESSON:\n')[1];
        expect(lesson).toContain('refers to the ram');
        expect(lesson).not.toContain('(KJV) Genesis 22:1-19');
        // Nothing to hold it to, or nothing to hold: no ask.
        expect(genLessonFactCheckAsk(BLOCKS.slice(1), [])).toBeNull();
        expect(genLessonFactCheckAsk(BLOCKS.slice(0, 1), [])).toBeNull();
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain(
            'Answer [] when there is no such sentence',
        );
    });

    it("keeps only findings that are the lesson's own sentences", () => {
        const answer =
            'Here is what I found:\n[{"sentence": "The name Jehovahjireh ' +
            'refers to the ram God gave in the place of Isaac.", "verses": ' +
            '"Genesis 22:14: Abraham called the name of that place ' +
            'Jehovahjireh"}, {"sentence": "Abraham was ninety years old.", ' +
            '"verses": "not said"}, {"sentence": "the ram", "verses": "x"}]';
        expect(readLessonFactFindings(answer, BLOCKS)).toEqual([
            {
                sentence:
                    'The name Jehovahjireh refers to the ram God gave in the ' +
                    'place of Isaac.',
                text:
                    'the verses read say: Genesis 22:14: Abraham called the ' +
                    'name of that place Jehovahjireh',
            },
        ]);
        // None, or no JSON at all: nothing named.
        expect(readLessonFactFindings('[]', BLOCKS)).toEqual([]);
        expect(readLessonFactFindings('All correct.', BLOCKS)).toEqual([]);
        // The passage printed is the Bible's words, never a finding.
        expect(
            readLessonFactFindings(
                '[{"sentence": "And it came to pass after these things", "verses": "x"}]',
                BLOCKS,
            ),
        ).toEqual([]);
        // That the verses read do not GIVE it is a finding too: both blind
        // readers count a detail the passage does not give as an error
        // (ab71: Luke 2's stable, the Olivet discourse's crowd).
        expect(
            readLessonFactFindings(
                JSON.stringify([
                    {
                        sentence: 'God provides what he asks.',
                        verses:
                            'The verses do not state that God provides; they ' +
                            'only say Abraham went (Genesis 22:3).',
                    },
                ]),
                BLOCKS,
            ),
        ).toHaveLength(1);
        // BN-229 (ab73): every who-sentence gone through, a verdict each --
        // "same" is no finding, "other" goes before "not given".
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain('Go through, one by one');
        // BN-232 (ab75): a question that takes a fact as given is gone
        // through too.
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain(
            'a question too, when it takes such a thing as given',
        );
        expect(FACT_CHECK_SYSTEM_PROMPT).not.toContain('or a question;');
        // BN-239 (ab79): the sea told as parting only once Israel moved --
        // the order of events is gone through too.
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain('what happened first');
        // BN-243 (ab81): Eli's "Speak, LORD" given to Samuel, the thief's
        // words of Jesus given to the thief -- a quotation is held to who
        // says it and of whom, and the look reaches further down a lesson.
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain(
            'who says those words in the verses, and of whom',
        );
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain('at most sixteen');
        expect(FACT_CHECK_SYSTEM_PROMPT).not.toContain(
            'a verse quoted as it reads. ',
        );
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain('order of events');
        // BN-289 (ab106..ab110, both readers): the long tail of marks was a
        // reason, cause, motive or state the passage does not give -- the
        // praise "triggered" the earthquake, "God put it in her heart",
        // what Esther "knew", the inner prison where "the most dangerous"
        // were kept -- none of which the look went through.
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain(
            'the reason, cause or motive given for what someone did',
        );
        expect(FACT_CHECK_SYSTEM_PROMPT).toContain(
            'what a place or thing in it was like',
        );
        const godSentence =
            '**What it means:** The name Jehovahjireh refers to the ram God ' +
            'gave in the place of Isaac.';
        const verdicts = readLessonFactFindings(
            JSON.stringify([
                {
                    sentence: 'God provides what he asks.',
                    verses: 'Genesis 22:8: God will provide himself a lamb',
                    verdict: 'same',
                },
                {
                    sentence: 'God provides what he asks.',
                    verses: 'none',
                    verdict: 'not given',
                },
                {
                    sentence: godSentence.slice(19),
                    verses: 'Genesis 22:14: the name of that place',
                    verdict: 'other',
                },
            ]),
            BLOCKS,
        );
        expect(verdicts.map((item) => item.sentence)).toEqual([
            godSentence.slice(19),
            'God provides what he asks.',
        ]);
    });

    it("looks only when the ask read the lesson's own passage", () => {
        expect(checkHasPassageRead([GENESIS_22_READ], 'Genesis 22:1-19')).toBe(
            true,
        );
        expect(
            checkHasPassageRead([GENESIS_22_READ], '(KJV) Genesis 22:1-19'),
        ).toBe(true);
        // A memory verse's read is no read of the passage.
        expect(checkHasPassageRead([GENESIS_22_READ], 'Luke 15:4-7')).toBe(
            false,
        );
        expect(checkHasPassageRead([], 'Genesis 22:1-19')).toBe(false);
        expect(checkHasPassageRead([GENESIS_22_READ], null)).toBe(false);
    });
});
