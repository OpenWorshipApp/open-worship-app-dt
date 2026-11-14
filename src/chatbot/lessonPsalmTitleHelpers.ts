/**
 * A psalm's title, read with the psalm (BN-147, closing BN-122,
 * 2026-11-11, the goal _chatbot completely smart enough to help prepare a
 * best preaching lesson_).
 *
 * Psalm backgrounds were the thinnest the blind readers found -- "David, a
 * shepherd himself, wrote this psalm"; "add the sons of Korah, the
 * occasion" -- because the KJV prints a title over 116 psalms ("To the chief
 * Musician for the sons of Korah, A Song upon Alamoth"; "when Nathan the
 * prophet came unto him") and neither the app's KJV nor an installed one
 * carries it, so the model read none and told the background from memory.
 * The titles are the KJV's own words, read off eBible.org's public-domain
 * KJV (its \d lines) into `kjvPsalmTitles.json`, ~6 KB loaded only when a
 * new lesson reads a psalm from the KJV. Pure but for that one import.
 */

// "Psalm 46", "Psalms 46:1-11", "PSA 23", "Ps 42-43" (two whole chapters).
const PSALM_PASSAGE_PATTERN =
    /^\s*(?:psalms?|psa|ps)\.?\s+(\d{1,3})(?::(\d{1,3})(?:-\d{1,3})?)?(?:\s*-\s*(\d{1,3}))?/i;
// The most chapters one passage names a title for.
const MAX_PSALM_TITLE_CHAPTERS = 3;

/** The psalms a passage reads, by chapter number; none for another book. */
export function readPsalmChapters(passage: string): number[] {
    const match = PSALM_PASSAGE_PATTERN.exec(String(passage ?? ''));
    if (match === null) {
        return [];
    }
    const first = Number(match[1]);
    // A verse range stays in its chapter; a range of whole chapters does not.
    const last =
        match[2] === undefined && match[3] !== undefined
            ? Number(match[3])
            : first;
    const chapterList: number[] = [];
    for (
        let chapter = first;
        chapter <= last && chapterList.length < MAX_PSALM_TITLE_CHAPTERS;
        chapter++
    ) {
        if (chapter >= 1 && chapter <= 150) {
            chapterList.push(chapter);
        }
    }
    return chapterList;
}

export type PsalmTitleType = { chapter: number; title: string };

/** The titles the KJV prints over these psalms, read when asked for. */
export async function loadPsalmTitles(
    chapterList: readonly number[],
): Promise<PsalmTitleType[]> {
    if (chapterList.length === 0) {
        return [];
    }
    const titleMap: Record<string, string> = (
        await import('../helper/bible-helpers/bible-data/kjvPsalmTitles.json')
    ).default;
    return chapterList.flatMap((chapter) => {
        const title = titleMap[String(chapter)];
        return typeof title === 'string' ? [{ chapter, title }] : [];
    });
}

// BN-279 (2026-11-14, ab101..ab103): every Psalm 40 lesson read Psalm 39:13
// and told it as the setting -- "his plea for strength before the end of his
// life in Psalm 39:13", "David looking back on God's answer to his prayer in
// Psalm 39" -- and Psalm 23's told Psalm 22:28-31 so ("It follows a
// declaration that the kingdom belongs to the LORD"). The lesson shape's
// "the verses just before it, for its setting" won over its "never the
// psalm before it": a psalm opened at its first verse has no verses before
// it, and the blind readers marked every such background down.

// The psalm a passage opens at its first verse (a whole psalm, or 1-…),
// or null.
function readPsalmOpenedAtStart(passage: string) {
    const match = PSALM_PASSAGE_PATTERN.exec(String(passage ?? ''));
    if (match === null) {
        return null;
    }
    const chapter = Number(match[1]);
    const verse = match[2] === undefined ? 1 : Number(match[2]);
    return verse === 1 && chapter > 1 && chapter <= 150 ? chapter : null;
}

/**
 * Said over a new lesson's read of a psalm from its first verse: the psalm
 * before is another psalm, never its setting.
 */
export function genPsalmOwnSettingNote(passage: string | null) {
    const chapter = readPsalmOpenedAtStart(passage ?? '');
    if (chapter === null) {
        return null;
    }
    return (
        `(Psalm ${chapter} starts at its first verse: Psalm ${chapter - 1} ` +
        'before it is another psalm, never its setting -- read none of it ' +
        `for the Background, which is told from Psalm ${chapter}'s own ` +
        'title and words.)'
    );
}

/**
 * Said over a read, in a new lesson on a psalm from its first verse, of the
 * psalm just before it -- a verse of it may serve elsewhere, never as the
 * Background.
 */
export function genPreviousPsalmReadNote(
    readRefs: string,
    passage: string | null,
) {
    const chapter = readPsalmOpenedAtStart(passage ?? '');
    if (chapter === null) {
        return null;
    }
    const refList = String(readRefs ?? '')
        .split(';')
        .map((ref) => ref.trim())
        .filter((ref) => ref !== '');
    const isPsalmBefore =
        refList.length > 0 &&
        refList.every((ref) => {
            const chapterList = readPsalmChapters(ref);
            return chapterList.length === 1 && chapterList[0] === chapter - 1;
        });
    if (!isPsalmBefore) {
        return null;
    }
    return (
        `(Psalm ${chapter - 1} is another psalm, not the setting of Psalm ` +
        `${chapter}: tell none of the Background from it.)`
    );
}

/** Said over a new lesson's psalm read: its title, Scripture's own words. */
export function genPsalmTitleNote(titleList: readonly PsalmTitleType[]) {
    if (titleList.length === 0) {
        return null;
    }
    const said = titleList.map((item) => {
        return `Psalm ${item.chapter}: "${item.title}"`;
    });
    return (
        "(The title the KJV prints over the psalm -- Scripture's own words, " +
        `which this read leaves out -- ${said.join('; ')}. Tell its ` +
        "Background from these words and the psalm's own, never from " +
        'memory: who it is for or by, and the occasion when the title gives ' +
        'one.)'
    );
}
