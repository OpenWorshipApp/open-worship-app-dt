/**
 * What a passage IS: a book, a start chapter and verse, and an end verse —
 * in the start chapter, or in `chapterEnd` when the passage runs on into a
 * later chapter of the same book (`John 1:2-3:4`).
 *
 * A leaf module on purpose: no runtime imports, so the screen window, the
 * stepping shortcut and the parsers can ask "how many chapters is this?"
 * without pulling the bible database into their import graph.
 */

export type BibleTargetType = {
    bookKey: string;
    chapter: number;
    verseStart: number;
    // In `chapterEnd` when the passage crosses chapters, else in `chapter`.
    verseEnd: number;
    // Only ever written when it is a LATER chapter than `chapter`: a
    // one-chapter passage is stored exactly as it was before ranges could
    // cross chapters, so old files, settings and screens read unchanged.
    chapterEnd?: number;
};

// A passage over more chapters than this opens with only these, and a `...`
// below them reads one more per press: a whole book is never read at once.
export const BIBLE_SHOWN_CHAPTER_COUNT = 3;

export function getTargetChapterEnd(target: BibleTargetType) {
    const { chapter, chapterEnd } = target;
    return typeof chapterEnd === 'number' && chapterEnd > chapter
        ? chapterEnd
        : chapter;
}

export function checkIsCrossChapterTarget(target: BibleTargetType) {
    return getTargetChapterEnd(target) > target.chapter;
}

export function getTargetChapterCount(target: BibleTargetType) {
    return getTargetChapterEnd(target) - target.chapter + 1;
}

/**
 * The chapters a passage covers, `count` of them from the `start`-th: what a
 * view showing only some of them reads.
 */
export function toTargetChapterList(
    target: BibleTargetType,
    start = 0,
    count?: number,
) {
    const chapterEnd = getTargetChapterEnd(target);
    const first = target.chapter + Math.max(0, start);
    const last =
        count === undefined
            ? chapterEnd
            : Math.min(chapterEnd, first + Math.max(0, count) - 1);
    const chapterList: number[] = [];
    for (let chapter = first; chapter <= last; chapter++) {
        chapterList.push(chapter);
    }
    return chapterList;
}

/**
 * The same passage with `chapterEnd` written only when it means something.
 * The key is DELETED rather than set to `undefined`: equality checks, JSON
 * and stored settings all see keys.
 */
export function normalizeBibleTarget(target: BibleTargetType): BibleTargetType {
    const { bookKey, chapter, verseStart, verseEnd } = target;
    const chapterEnd = getTargetChapterEnd(target);
    if (chapterEnd > chapter) {
        return { bookKey, chapter, verseStart, verseEnd, chapterEnd };
    }
    return { bookKey, chapter, verseStart, verseEnd };
}

export function toSingleChapterTarget(
    bookKey: string,
    chapter: number,
    verseStart: number,
    verseEnd: number,
): BibleTargetType {
    return { bookKey, chapter, verseStart, verseEnd };
}

export function toBibleTargetIdentityKey(target: BibleTargetType) {
    const { bookKey, chapter, verseStart, verseEnd } = target;
    const chapterEnd = getTargetChapterEnd(target);
    const key = `${bookKey} ${chapter}:${verseStart}`;
    if (chapterEnd > chapter) {
        return `${key}-${chapterEnd}:${verseEnd}`;
    }
    return `${key}-${verseEnd}`;
}

export function checkIsSameBibleTarget(
    target1: BibleTargetType,
    target2: BibleTargetType,
) {
    return (
        target1.bookKey === target2.bookKey &&
        target1.chapter === target2.chapter &&
        target1.verseStart === target2.verseStart &&
        target1.verseEnd === target2.verseEnd &&
        getTargetChapterEnd(target1) === getTargetChapterEnd(target2)
    );
}

export type BibleChapterSliceType = {
    chapter: number;
    // `null` up to the end of the chapter: only reading the chapter knows
    // how many verses that is.
    verseStart: number;
    verseEnd: number | null;
    isFirstChapter: boolean;
    isLastChapter: boolean;
};

/**
 * One slice per chapter: the first from `verseStart`, the middle ones whole,
 * the last up to `verseEnd`. A one-chapter passage is one slice, itself.
 */
export function toTargetChapterSliceList(
    target: BibleTargetType,
    start = 0,
    count?: number,
): BibleChapterSliceType[] {
    const chapterEnd = getTargetChapterEnd(target);
    return toTargetChapterList(target, start, count).map((chapter) => {
        const isFirstChapter = chapter === target.chapter;
        const isLastChapter = chapter === chapterEnd;
        return {
            chapter,
            verseStart: isFirstChapter ? target.verseStart : 1,
            verseEnd: isLastChapter ? target.verseEnd : null,
            isFirstChapter,
            isLastChapter,
        };
    });
}
