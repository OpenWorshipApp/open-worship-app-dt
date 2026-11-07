import { getVerses } from '../helper/bible-helpers/bibleInfoHelpers';
import {
    checkIsCrossChapterTarget,
    toTargetChapterSliceList,
} from '../helper/bible-helpers/bibleTargetHelpers';
import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type BibleItem from './BibleItem';

export type BiblePassageVerseType = {
    chapter: number;
    verse: number;
    // One plain verse text per Bible key, in the order the keys were given.
    textList: string[];
};

// Shared by Generate Slides and Create Lyric, and kept light on purpose: the
// lyric path must not pull the slide editor's canvas modules in with it.
//
// Every verse of the passage, in order across its chapters, once EVERY key is
// known to have each one: a document is never made of a partial passage or of
// the Bible renderer's "??" missing-verse placeholder. A version lacking one
// is named in a toast and the answer is null. Each chapter is read once per
// version, and the texts come from those same reads.
export async function readBiblePassageVerses(
    bibleItem: BibleItem,
    bibleKeys: string[],
    toastTitle: string,
): Promise<BiblePassageVerseType[] | null> {
    const { bookKey, verseStart, verseEnd } = bibleItem.target;
    if (
        bibleItem.isError ||
        !Number.isInteger(verseStart) ||
        !Number.isInteger(verseEnd) ||
        // `John 1:20-2:3` ends on a smaller verse in a later chapter.
        (!checkIsCrossChapterTarget(bibleItem.target) && verseStart > verseEnd)
    ) {
        throw new Error('Bible passage is unavailable');
    }
    // One slice per chapter the passage covers; one, itself, when it stays in
    // its chapter.
    const sliceList = toTargetChapterSliceList(bibleItem.target);
    // A chapter the passage runs on through ends where the first version read
    // -- the passage's own -- ends it, as the Reader counts it.
    const sliceVerseEndList = sliceList.map((slice) => slice.verseEnd);
    // [key index][slice index][verse - slice.verseStart]
    const textTable: string[][][] = [];
    for (const bibleKey of bibleKeys) {
        const keyTextList: string[][] = [];
        for (const [sliceIndex, slice] of sliceList.entries()) {
            const verses = await getVerses(bibleKey, bookKey, slice.chapter);
            const sliceVerseEnd = (sliceVerseEndList[sliceIndex] ??=
                Object.keys(verses ?? {}).length);
            const sliceTextList: string[] = [];
            let isAvailable = !!verses && slice.verseStart <= sliceVerseEnd;
            for (
                let verse = slice.verseStart;
                isAvailable && verse <= sliceVerseEnd;
                verse++
            ) {
                const text = verses?.[String(verse)]?.trim() ?? '';
                isAvailable = text !== '';
                sliceTextList.push(text);
            }
            if (!isAvailable) {
                showSimpleToast(
                    toastTitle,
                    `${tran('Bible passage is unavailable in')}: ${bibleKey}`,
                );
                return null;
            }
            keyTextList.push(sliceTextList);
        }
        textTable.push(keyTextList);
    }
    return sliceList.flatMap((slice, sliceIndex) => {
        const verseList: BiblePassageVerseType[] = [];
        const sliceVerseEnd = sliceVerseEndList[sliceIndex] ?? 0;
        for (let verse = slice.verseStart; verse <= sliceVerseEnd; verse++) {
            const offset = verse - slice.verseStart;
            verseList.push({
                chapter: slice.chapter,
                verse,
                textList: textTable.map((keyTextList) => {
                    return keyTextList[sliceIndex]?.[offset] ?? '';
                }),
            });
        }
        return verseList;
    });
}
