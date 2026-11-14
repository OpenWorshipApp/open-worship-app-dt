/**
 * How alike two texts are written, read from their letters alone -- no
 * language's words, so it holds for a language no installed package names
 * (2026-11-13, EC-547). Pure and small: a few thousand letters a call.
 */

// Lower case, a letter typed with its accent as the accented letter, and
// every run of what is neither a letter nor a mark one space: a word's
// edges count, a digit or a sign does not.
function toLikenessText(text: string) {
    const clean = String(text ?? '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{M}]+/gu, ' ')
        .trim();
    return ` ${clean} `;
}

/** The runs of three characters a text writes, each counted. */
export function countLetterRuns(text: string) {
    const characterList = [...toLikenessText(text)];
    const countMap = new Map<string, number>();
    for (let index = 0; index + 3 <= characterList.length; index += 1) {
        const run =
            characterList[index] +
            characterList[index + 1] +
            characterList[index + 2];
        countMap.set(run, (countMap.get(run) ?? 0) + 1);
    }
    return countMap;
}

/**
 * How alike two texts' runs of three characters are (`countLetterRuns`):
 * the cosine of their counts, 1 for two written alike, 0 for two with no run
 * in common.
 */
export function measureLetterRunLikeness(
    countMap: ReadonlyMap<string, number>,
    otherCountMap: ReadonlyMap<string, number>,
) {
    let product = 0;
    let size = 0;
    let otherSize = 0;
    for (const [run, count] of countMap) {
        size += count * count;
        product += count * (otherCountMap.get(run) ?? 0);
    }
    for (const count of otherCountMap.values()) {
        otherSize += count * count;
    }
    return size === 0 || otherSize === 0
        ? 0
        : product / Math.sqrt(size * otherSize);
}

/**
 * How much of one text's runs of three characters another writes too: 1
 * when every run of `countMap` is in `otherCountMap` as often, whatever
 * else that one writes -- a phrase out of a longer text (2026-11-13,
 * EC-575) -- and 0 when none is.
 */
export function measureLetterRunContainment(
    countMap: ReadonlyMap<string, number>,
    otherCountMap: ReadonlyMap<string, number>,
) {
    let total = 0;
    let shared = 0;
    for (const [run, count] of countMap) {
        total += count;
        shared += Math.min(count, otherCountMap.get(run) ?? 0);
    }
    return total === 0 ? 0 : shared / total;
}

/** The letters a text writes, each counted, in lower case. */
export function countLetters(text: string) {
    const countMap = new Map<string, number>();
    for (const letter of String(text ?? '')
        .normalize('NFC')
        .toLowerCase()
        .match(/\p{L}/gu) ?? []) {
        countMap.set(letter, (countMap.get(letter) ?? 0) + 1);
    }
    return countMap;
}

// A letter written this often in a text -- one in 200 of its letters, and
// twice at least -- is one of its own: a letter written once is a name's.
const OFTEN_LETTER_SHARE = 1 / 200;

/**
 * The letters one text writes often (`OFTEN_LETTER_SHARE`) that another
 * never writes at all, both counted by `countLetters`: one language's own
 * letter that another lacks, never one of the thousands of a script that
 * writes a word a letter.
 */
export function listOftenUnwrittenLetters(
    countMap: ReadonlyMap<string, number>,
    otherCountMap: ReadonlyMap<string, number>,
) {
    let total = 0;
    for (const count of countMap.values()) {
        total += count;
    }
    const least = Math.max(2, total * OFTEN_LETTER_SHARE);
    return [...countMap]
        .filter(([letter, count]) => {
            return count >= least && !otherCountMap.has(letter);
        })
        .map(([letter]) => {
            return letter;
        });
}
