/**
 * The example every lesson reaches for, named under the lesson for one more
 * edit (BN-150, 2026-11-11, the ab30 read; the goal _chatbot completely
 * smart enough to help prepare a best preaching lesson_).
 *
 * Both blind readers' commonest mark on an example was the hospital: "A
 * woman sits in a hospital waiting room" stood in six of 32 lessons, the two
 * devotions' among them, and the readers scored those examples as stock.
 * Naming it in the lesson shape had made no difference (BN-125, BN-129: it
 * is the model's own default scene), so the window reads the new lesson's
 * **For example:** lines and, where one is set in a hospital, says so under
 * the change: ONE more edit gives that line a scene of the hearers' own
 * week. A funeral message keeps its scene -- a hospital can be where its
 * grief is -- and a lesson the person changes is never second-guessed: only
 * a lesson written into an empty note is read. Pure.
 */

// A **For example:** line's words, to the end of its line.
const EXAMPLE_LINE_PATTERN = /\*\*For example:\*\*[ \t]*([^\n]+)/gi;
// A hospital, its ward or its waiting room.
const HOSPITAL_PATTERN =
    /\b(?:hospitals?|waiting rooms?|intensive care|ICU|hospital wards?)\b/i;
// The words a funeral message is asked for by.
const FUNERAL_ASK_PATTERN = /\b(?:funerals?|memorials?|burials?)\b/i;
// The most examples one note names.
const MAX_STOCK_SCENES = 3;
// How much of an example the note quotes.
const EXAMPLE_QUOTE_CHARS = 80;

/** Whether the lesson asked for is a funeral message. */
export function checkIsFuneralAsk(askedText: string) {
    return FUNERAL_ASK_PATTERN.test(String(askedText ?? ''));
}

/** The examples of a lesson set in a hospital, each by its opening words. */
export function findHospitalExamples(text: string): string[] {
    const found: string[] = [];
    for (const match of String(text ?? '').matchAll(EXAMPLE_LINE_PATTERN)) {
        const example = match[1].trim();
        if (!HOSPITAL_PATTERN.test(example)) {
            continue;
        }
        const opening = /^(.*?[.!?])(?:\s|$)/.exec(example)?.[1] ?? example;
        found.push(
            opening.length > EXAMPLE_QUOTE_CHARS
                ? `${opening.slice(0, EXAMPLE_QUOTE_CHARS)}…`
                : opening,
        );
        if (found.length >= MAX_STOCK_SCENES) {
            break;
        }
    }
    return found;
}

// A line's words as compared: no label, no verse token (a read writes the
// token with its Bible, `[^(KJV) Psalm 46:1]`), no cut mark, one case.
function toLineKey(text: string) {
    return String(text ?? '')
        .replace(/\*\*[^*\n]{1,40}:\*\*/g, ' ')
        .replace(/\[\^[^\]\n]*\]/g, ' ')
        .replace(/…\s*$/u, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
// How much of a line's opening finds its block.
const LINE_KEY_CHARS = 48;

/**
 * The block each line is in now, by its opening words, or null (BN-152,
 * shape31's L-11: told only an example's words, the model counted its own
 * lines and wrote its new scene over the line above it).
 */
export function findBlockNumbers(
    blocks: readonly { n: number; text: string }[],
    lineList: readonly string[],
): (number | null)[] {
    return lineList.map((line) => {
        const key = toLineKey(line).slice(0, LINE_KEY_CHARS);
        if (key.length < 12) {
            return null;
        }
        const block = blocks.find((item) => {
            return toLineKey(item.text).includes(key);
        });
        return block?.n ?? null;
    });
}

// --- a line fixed keeps the rest of its block (BN-157) ---------------------
//
// 2026-11-12, the ab32 read (Opus): a children's Jonah's story block, a
// dozen sentences, held the legend "tell them to stop doing bad things";
// the one more edit the note asked for, aimed at the block by its number
// (BN-152), sent the block back as that one sentence corrected, and the
// lesson lost its story (23 -> 18). A Christ section became a bare quote
// the same way (I 0).

// A line's words as compared: three letters or more.
function toWordList(text: string) {
    return toLineKey(text).match(/\p{L}{3,}/gu) ?? [];
}
// Fewer other words than this: the block is the line.
const MIN_OTHER_BLOCK_WORDS = 8;
// The longest block a note quotes whole.
const MAX_QUOTED_BLOCK_CHARS = 2000;

export type LineFixBlockType = { n: number; text: string; other: string[] };

/**
 * A block that holds more than the line a note names, with the words a
 * fix of that line must keep; null when the block is the line, or unknown.
 */
export function toLineFixBlock(
    blocks: readonly { n: number; text: string }[],
    blockNumber: number | null,
    line: string,
): LineFixBlockType | null {
    const block = blocks.find((item) => {
        return item.n === blockNumber;
    });
    if (blockNumber === null || block === undefined) {
        return null;
    }
    const lineSet = new Set(toWordList(line));
    const other = [...new Set(toWordList(block.text))].filter((word) => {
        return !lineSet.has(word);
    });
    return other.length >= MIN_OTHER_BLOCK_WORDS
        ? { n: blockNumber, text: String(block.text), other }
        : null;
}

/** Whether a block's new words keep at least half of what it held beyond its line. */
export function checkKeepsBlockWords(newText: string, fix: LineFixBlockType) {
    const newSet = new Set(toWordList(newText));
    const keptCount = fix.other.filter((word) => {
        return newSet.has(word);
    }).length;
    return keptCount * 2 >= fix.other.length;
}

// A block's words as a note quotes them, whole or not at all.
function toQuotedBlock(fix: LineFixBlockType) {
    return fix.text.length > MAX_QUOTED_BLOCK_CHARS ? null : fix.text;
}

/** Said under a note naming a line of a longer block: send it back whole. */
export function genWholeBlockNote(fix: LineFixBlockType) {
    const quoted = toQuotedBlock(fix);
    return (
        `(Block ${fix.n} holds more than that line` +
        (quoted === null ? '' : `; it reads now: "${quoted}"`) +
        `. Send it back whole -- {block: ${fix.n}, text: <every word of ` +
        `block ${fix.n} as it reads now, only that one sentence changed>} -- ` +
        'never the line alone.)'
    );
}

/** The refusal of a fix that would leave a block little but its line. */
export function genLineFixRefusal(fixList: readonly LineFixBlockType[]) {
    return (
        'Nothing was changed: ' +
        fixList
            .map((fix) => {
                const quoted = toQuotedBlock(fix);
                return (
                    `block ${fix.n} holds more than the line to fix, and this ` +
                    'would leave little but that line -- the rest of it would ' +
                    `be lost. Send block ${fix.n} back whole, every word as it ` +
                    'reads now with only that one sentence changed' +
                    (quoted === null ? '.' : `: "${quoted}"`)
                );
            })
            .join(' And ')
    );
}

/**
 * Said under the lesson written: the hospital examples, by the block each
 * is in now where the window read it, for one edit.
 */
export function genHospitalExampleNote(
    found: readonly string[],
    blockNumbers: readonly (number | null)[] = [],
) {
    if (found.length === 0) {
        return null;
    }
    const said = found
        .map((example, index) => {
            const block = blockNumbers[index] ?? null;
            return block === null
                ? `"${example}"`
                : `block ${block}: "${example}"`;
        })
        .join('; ');
    const isEveryNumbered = found.every((_example, index) => {
        return (blockNumbers[index] ?? null) !== null;
    });
    const scene =
        "a scene of the hearers' own week where what THAT point's verses " +
        'tell happens again, set where no other example of the lesson is';
    // The change spelt out (BN-152's first run: told "its words alone",
    // the model sent the scene as `words`, the field a style picks words
    // with, and was refused).
    const target = isEveryNumbered
        ? `ONLY block${found.length === 1 ? '' : 's'} ` +
          `${blockNumbers.slice(0, found.length).join(' and ')} -- {block: ` +
          (found.length === 1 ? blockNumbers[0] : '<each>') +
          `, text: "**For example:** <${scene}>"}` +
          (found.length === 1 ? '' : ' for each') +
          ' --'
        : (found.length === 1
              ? 'that **For example:** line'
              : 'those **For example:** lines') + ` to ${scene},`;
    return (
        '(The change is made, but ' +
        (found.length === 1 ? 'an example is' : 'examples are') +
        ` set in a hospital -- ${said} -- the scene these lessons reach for ` +
        'most, which hearers have heard many times. With ONE more edit, ' +
        `change ${target} every other block as it is now -- then answer.)`
    );
}
