// A new lesson read against the verses its ask read, by a second look
// (BN-226, 2026-11-13). The held-out asks -- sixteen passages the window's
// checks were never tuned on -- were read Best by both blind readers in
// about four lessons in five, every one below for a fact: "a crowd" at the
// Olivet discourse given privately, "Jehovahjireh refers to the ram" where
// Genesis 22:14 names the place, the merciful "to those who deserve it".
// Each check written for one slip cleared that lesson and the next run
// slipped elsewhere, so the window asks once, in a fresh ask with no tools
// and no conversation behind it, which sentences say of the passage what
// the verses read do not -- and names what comes back under the change, as
// it names a legend, for one more edit. A finding whose sentence is not in
// the lesson is dropped: the second look may name only what is there.

import { toLetterKey } from './noteChatHelpers';

// Measured on the held-out asks (BN-226): asked for anything the verses
// "do not say", the look named "Paul wrote this letter … from a prison"
// (Ephesians 3:1 says so, outside the verses read) -- true background a
// fix would have cost the lesson. It names a contradiction, or an event of
// the passage told with what its verses do not tell: both blind readers
// count that as an error (ab71: a stable in Luke 2, a crowd at the Olivet
// discourse), and an error keeps a lesson out of Best where a detail taken
// out costs a point at most. Asked for "the faults", it skimmed (BN-229,
// ab73: Jesus "quickened" us where Ephesians 2:5 has God, Jesus "dismissed
// the crowd" where Mark 4:36 has the disciples, John's task given to the
// dayspring -- every error of the batch a WHO, none named): it goes through
// every such sentence now, one by one, and says of each whether the verses
// say the same; what they do not is what is named. And a question is gone
// through too (BN-232, ab75: "how did the boy feel when he gave his lunch?"
// in a Matthew 14 lesson, "why did Elijah pray seven times?", "why did
// Jesus wait four days?" -- each a fact the passage does not give, each
// left out of the look as "a question").
export const FACT_CHECK_SYSTEM_PROMPT =
    'You check a preaching lesson against the Bible verses it was written ' +
    "from. Go through, one by one, every sentence that says of the passage's " +
    'OWN events who did, said or heard something, what happened first, ' +
    'who was there, to whom, ' +
    'what a name, word or verse says or refers to, which verse says it, ' +
    'a number, the reason, cause or motive given for what someone did, ' +
    'felt or knew or for what happened ("because she knew …", "this ' +
    'triggered …", "God put it in her heart"), or what a place or thing ' +
    'in it was like, and every quotation given to a person -- who says those ' +
    'words in the verses, and of whom -- and set each beside the verses -- ' +
    'a question too, when it ' +
    'takes such a thing as given ("why did he pray seven times?"). Leave ' +
    'out: background from elsewhere in the Bible or history (who wrote, to ' +
    'whom, where, when); an example from life today; an application or a ' +
    'prayer; a verse quoted as it reads with no one said to say it. Answer ' +
    'ONLY a JSON array, one item for each ' +
    'such sentence, at most sixteen, each {"sentence": the sentence copied ' +
    'exactly from the lesson, "verses": what the verses say of it, in their ' +
    'words, with the reference, "verdict": "same" when the verses say it, ' +
    '"other" when they give another person, name, place, thing or order ' +
    'of events, "not ' +
    'given" when they give none}. Answer [] when there is no such sentence.';

// A verdict that names the sentence: the verses say otherwise, or nothing.
const FACT_FINDING_VERDICT_PATTERN = /^\s*(?:other|not\s*given)\s*$/i;

// What the ask may carry: the verses within about 9 000 letters, the
// lesson within about 9 000 -- a free model's round is still bounded.
const MAX_FACT_VERSE_CHARS = 9000;
const MAX_FACT_LESSON_CHARS = 9000;
const MAX_FACT_FINDINGS = 3;
// A finding is a sentence of the lesson, not a phrase of it.
const MIN_FACT_SENTENCE_LETTERS = 20;

export type FactCheckBlockType = { n: number; kind: string; text: string };
export type FactCheckFindingType = { sentence: string; text: string };

// Each verse an ask read, by its reference, once -- a passage read twice
// (the ask, then the note) is said once.
function toReadVerseLines(readTexts: readonly string[]) {
    const lineMap = new Map<string, string>();
    for (const text of readTexts) {
        let verses: any;
        try {
            verses = JSON.parse(text)?.verses;
        } catch {
            continue;
        }
        if (!Array.isArray(verses)) {
            continue;
        }
        for (const verse of verses) {
            const ref = String(verse?.ref ?? verse?.key ?? '').trim();
            const words = String(verse?.text ?? '').trim();
            if (ref !== '' && words !== '' && !lineMap.has(ref)) {
                lineMap.set(ref, `${ref}: ${words}`);
            }
        }
    }
    return [...lineMap.values()];
}

// "Luke 15:4-7" -> "luke 15": a book and chapter, for telling a read of the
// passage from a read of some other verse.
function toBookChapter(ref: string) {
    const match = /^\s*(?:\([^)]*\)\s*)?(.*?\S)\s+(\d{1,3})(?::|\s*$)/.exec(
        String(ref ?? ''),
    );
    return match === null
        ? null
        : `${match[1].toLowerCase().replace(/^psalms\b/, 'psalm')} ${Number(match[2])}`;
}

/**
 * Whether the ask READ the lesson's own passage -- a second look has
 * nothing to hold a lesson to when only some other verse was read (a
 * memory verse's length, a Christ section's verse).
 */
export function checkHasPassageRead(
    readTexts: readonly string[],
    passageRef: string | null,
) {
    const passage = passageRef === null ? null : toBookChapter(passageRef);
    if (passage === null) {
        return false;
    }
    return toReadVerseLines(readTexts).some((line) => {
        return toBookChapter(line.split(':')[0] + ':') === passage;
    });
}

function toBoundedText(lines: readonly string[], maxChars: number) {
    const kept: string[] = [];
    let total = 0;
    for (const line of lines) {
        if (total + line.length > maxChars) {
            break;
        }
        kept.push(line);
        total += line.length + 1;
    }
    return kept.join('\n');
}

/**
 * The ask that reads a lesson against its verses, or null when there is
 * nothing to read it against: the verses the ask read and the passage the
 * note prints, then the lesson's own lines (a printed passage is the
 * Bible's, not the lesson's).
 */
export function genLessonFactCheckAsk(
    blocks: readonly FactCheckBlockType[],
    readTexts: readonly string[],
) {
    const verseLines = [
        ...toReadVerseLines(readTexts),
        ...blocks
            .filter((block) => block.kind === 'passage')
            .map((block) => block.text.trim()),
    ];
    const lessonLines = blocks
        .filter((block) => {
            return block.kind !== 'passage' && block.text.trim() !== '';
        })
        .map((block) => block.text.trim());
    if (verseLines.length === 0 || lessonLines.length === 0) {
        return null;
    }
    return (
        'THE VERSES (King James Version):\n' +
        `${toBoundedText([...new Set(verseLines)], MAX_FACT_VERSE_CHARS)}\n\n` +
        'THE LESSON:\n' +
        toBoundedText(lessonLines, MAX_FACT_LESSON_CHARS)
    );
}

// The JSON array in an answer, wherever the model put it.
function readJsonArray(answer: string): any[] {
    const text = String(answer ?? '');
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start < 0 || end <= start) {
        return [];
    }
    try {
        const list = JSON.parse(text.slice(start, end + 1));
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

/**
 * What the second look found, each a sentence of the lesson as it stands
 * with what the verses say -- a finding whose sentence the lesson does not
 * hold, or too short to be a sentence, dropped; three at most.
 */
export function readLessonFactFindings(
    answer: string,
    blocks: readonly FactCheckBlockType[],
): FactCheckFindingType[] {
    const lessonKeyList = blocks
        .filter((block) => block.kind !== 'passage')
        .map((block) => toLetterKey(block.text));
    const found: FactCheckFindingType[] = [];
    // The verses giving ANOTHER person or thing first: the plainer wrong.
    const itemList = readJsonArray(answer).sort((a, b) => {
        return (
            Number(/other/i.test(String(b?.verdict ?? ''))) -
            Number(/other/i.test(String(a?.verdict ?? '')))
        );
    });
    for (const item of itemList) {
        const sentence = String(item?.sentence ?? '').trim();
        const verses = String(item?.verses ?? '').trim();
        const key = toLetterKey(sentence);
        if (
            // An item with no verdict is a finding as written; "same" is
            // none.
            (item?.verdict !== undefined &&
                !FACT_FINDING_VERDICT_PATTERN.test(String(item.verdict))) ||
            key.length < MIN_FACT_SENTENCE_LETTERS ||
            verses === '' ||
            !lessonKeyList.some((lessonKey) => lessonKey.includes(key)) ||
            found.some((one) => toLetterKey(one.sentence) === key)
        ) {
            continue;
        }
        found.push({
            sentence,
            text: `the verses read say: ${verses.slice(0, 240)}`,
        });
        if (found.length >= MAX_FACT_FINDINGS) {
            break;
        }
    }
    return found;
}
