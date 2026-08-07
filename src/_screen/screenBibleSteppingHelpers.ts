import type { BibleTargetType } from '../bible-list/bibleRenderHelpers';
import { handleError } from '../helper/errorHelpers';
import appProvider from '../server/appProvider';
import ScreenBibleManager from './managers/ScreenBibleManager';

// The bible data modules are pulled in only when the shortcut actually fires:
// this module is loaded by every window through `ScreenManager`, and nothing
// here is needed until a key is pressed on a screen output.
async function countChapterVerses(
    bibleKey: string,
    bookKey: string,
    chapter: number,
) {
    const { getVerses } =
        await import('../helper/bible-helpers/bibleInfoHelpers');
    const verses = await getVerses(bibleKey, bookKey, chapter);
    return verses === null ? 0 : Object.keys(verses).length;
}

/**
 * Move the presented verse window one step forward/backward, keeping its size,
 * so `JHN 3:12` steps to `JHN 3:13` and `JHN 3:12-14` steps to `JHN 3:15-17`.
 * Running off either end of the chapter rolls over into the neighbouring
 * chapter (and book) through `getJumpingChapter`, taking the same number of
 * verses from that chapter's near edge.
 */
export async function toSteppedBibleTarget(
    bibleKey: string,
    target: BibleTargetType,
    isNext: boolean,
): Promise<BibleTargetType | null> {
    const { bookKey, chapter, verseStart, verseEnd } = target;
    const span = Math.max(0, verseEnd - verseStart);
    const verseCount = await countChapterVerses(bibleKey, bookKey, chapter);
    if (verseCount === 0) {
        return null;
    }
    const newVerseStart = isNext ? verseEnd + 1 : verseStart - 1 - span;
    if (newVerseStart >= 1 && newVerseStart + span <= verseCount) {
        return {
            bookKey,
            chapter,
            verseStart: newVerseStart,
            verseEnd: newVerseStart + span,
        };
    }
    const { bibleRenderHelper } =
        await import('../bible-list/bibleRenderHelpers');
    const jumpedTarget = await bibleRenderHelper.getJumpingChapter(
        bibleKey,
        target,
        isNext,
    );
    if (jumpedTarget === null) {
        return null;
    }
    // `getJumpingChapter` returns the whole chapter, so its `verseEnd` is that
    // chapter's verse count.
    const jumpedVerseCount = jumpedTarget.verseEnd;
    if (jumpedVerseCount < 1) {
        return null;
    }
    return {
        bookKey: jumpedTarget.bookKey,
        chapter: jumpedTarget.chapter,
        verseStart: isNext ? 1 : Math.max(1, jumpedVerseCount - span),
        verseEnd: isNext
            ? Math.min(jumpedVerseCount, 1 + span)
            : jumpedVerseCount,
    };
}

export async function stepScreenBibleItem(screenId: number, isNext: boolean) {
    const screenBibleManager = ScreenBibleManager.getInstance(screenId);
    if (screenBibleManager === null) {
        return;
    }
    const bibleItemJson =
        screenBibleManager.screenViewData?.bibleItemData?.bibleItem;
    if (bibleItemJson === undefined) {
        return;
    }
    const newTarget = await toSteppedBibleTarget(
        bibleItemJson.bibleKey,
        bibleItemJson.target,
        isNext,
    );
    if (newTarget === null) {
        return;
    }
    // No `filePath`: re-running `applyAttachBackground` on every step would
    // overwrite whatever background the operator has on that screen.
    await screenBibleManager.applyNewBibleItemJson(
        { ...bibleItemJson, target: newTarget },
        undefined,
    );
}

/**
 * `Ctrl/Alt+ArrowLeft/Right` pressed on a `screen.html` output window is
 * forwarded here by the main process (`screen:app:change-bible` →
 * `ElectronMainController.changeBible` → `app:main:change-bible`). Only the main
 * window holds the screen managers, so this is where the stepping happens.
 */
export function initScreenBibleStepping() {
    if (appProvider.isPageScreen) {
        return;
    }
    appProvider.messageUtils.listenForData(
        'app:main:change-bible',
        (_event, data: { screenId: number; isNext: boolean }) => {
            const { screenId, isNext } = data ?? {};
            if (typeof screenId !== 'number' || typeof isNext !== 'boolean') {
                return;
            }
            stepScreenBibleItem(screenId, isNext).catch(handleError);
        },
    );
}
