/**
 * Which passage the Reader is on for ONE Resources file: what the 🤖 on its
 * row hands the assistant beside the file (`resourceReadingAskHelpers.ts`),
 * so the tab it opens starts at the verses the person is reading instead of
 * at verse 1 (2026-10-22).
 *
 * The previewer provides a GETTER, not the panes: a context value that
 * changed with every verse click would re-render every row of every folder
 * for something only a press reads. The getter is asked at the press.
 */
import { createContext } from 'react';

import type { ResourceReadingType } from '../helper/ai/resourceReadingAskHelpers';
import {
    BIBLE_SHOWN_CHAPTER_COUNT,
    type BibleTargetType,
    checkIsCrossChapterTarget,
    toTargetChapterList,
} from '../helper/bible-helpers/bibleTargetHelpers';
import {
    checkIsBookLevelName,
    checkIsMatchedName,
} from './resourcesScanHelpers';

/** One pane open in the Reader, as much of it as a row needs. */
export type ResourceReadingPaneType = {
    bibleKey: string;
    target: BibleTargetType;
    toTitle: () => Promise<string>;
};

export const ResourcesReadingContext = createContext<
    (() => ResourceReadingPaneType[]) | null
>(null);

/**
 * The first pane this file was listed for, in the panel's own terms (the
 * chapters `ResourcesPreviewerComp` scans), and whether the pane's verses
 * belong to the file: only for a chapter file, and only when the passage
 * stays inside that chapter -- a passage running from 18:30 into 19 says
 * nothing useful as "verses 30 to 5".
 */
export function findResourceReadingPane(
    fileName: string,
    paneList: readonly ResourceReadingPaneType[],
) {
    for (const pane of paneList) {
        const { target } = pane;
        const isBookLevel = checkIsBookLevelName(fileName, target.bookKey);
        const chapter = toTargetChapterList(
            target,
            0,
            BIBLE_SHOWN_CHAPTER_COUNT,
        ).find((one) => {
            return checkIsMatchedName(fileName, target.bookKey, one);
        });
        if (chapter === undefined) {
            continue;
        }
        return {
            pane,
            chapter: isBookLevel ? target.chapter : chapter,
            hasVerses:
                !isBookLevel &&
                chapter === target.chapter &&
                !checkIsCrossChapterTarget(target),
        };
    }
    return null;
}

/**
 * The reading to hand over with this file, or null when no pane is on its
 * book (a free-text search hit, an "other" file). A title that cannot be
 * worked out leaves the file to open on its own.
 */
export async function toResourceReading(
    fileName: string,
    paneList: readonly ResourceReadingPaneType[],
): Promise<ResourceReadingType | null> {
    const found = findResourceReadingPane(fileName, paneList);
    if (found === null) {
        return null;
    }
    const { pane, chapter, hasVerses } = found;
    let title: string;
    try {
        title = (await pane.toTitle()).trim();
    } catch (_error) {
        return null;
    }
    if (title.length === 0) {
        return null;
    }
    return {
        bookKey: pane.target.bookKey,
        chapter,
        ...(hasVerses
            ? {
                  verseStart: pane.target.verseStart,
                  verseEnd: pane.target.verseEnd,
              }
            : {}),
        title,
        bibleKey: pane.bibleKey,
    };
}
