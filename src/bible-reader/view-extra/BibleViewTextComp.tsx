import { useCallback, useMemo, useRef, useState } from 'react';

import {
    BIBLE_VIEW_TEXT_CLASS,
    useBibleViewFontSizeContext,
} from '../../helper/bibleViewHelpers';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import {
    bibleRenderHelper,
    type CompiledVerseType,
} from '../../bible-list/bibleRenderHelpers';
import { useAppStateAsync, useAppCurrentRef } from '../../helper/appHooks';
import {
    getVersesCount,
    toLocaleNumBible,
} from '../../helper/bible-helpers/bibleLogicHelpers2';
import LoadingComp from '../../others/LoadingComp';
import { getBibleInfoIsRtl } from '../../helper/bible-helpers/bibleInfoHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderRestVerseNumListComp, {
    type RestVerseType,
} from './RenderRestVerseNumListComp';
import RenderVerseTextComp from './RenderVerseTextComp';
import RenderShowNextChapterButtonComp from './RenderShowNextChapterButtonComp';
import { tran } from '../../lang/langHelpers';
import { useVerseHighlightPainting } from '../verseHighlightPainter';
import { useVerseCommentHover } from '../verseCommentHoverHelpers';
import {
    BIBLE_SHOWN_CHAPTER_COUNT,
    getTargetChapterCount,
    getTargetChapterEnd,
    toBibleTargetIdentityKey,
} from '../../helper/bible-helpers/bibleTargetHelpers';
import { handleError } from '../../helper/errorHelpers';

type PassageViewType = {
    key: string;
    isRtl: boolean;
    // The item the passage was read for.
    bibleItem: ReadIdOnlyBibleItem;
    verseList: CompiledVerseType[] | null;
    // The same chapters in each extra bible, in `extraBibleKeys` order.
    extraVerseInfoListList: CompiledVerseType[][];
    // The verse numbers before and after the passage; "after" only once the
    // passage's last chapter is shown.
    restBeforeList: RestVerseType[];
    restAfterList: RestVerseType[];
    chapterCount: number;
    shownChapterCount: number;
};

// Primitives only: a re-render that hands over a NEW item object for the SAME
// passage -- every update of the view controller does -- reads nothing again.
export function toPassageViewKey(bibleItem: ReadIdOnlyBibleItem) {
    return [
        bibleItem.bibleKey,
        toBibleTargetIdentityKey(bibleItem.target),
        bibleItem.extraBibleKeys.join(','),
    ].join('|');
}

async function loadRestVerseList(
    bibleKey: string,
    from: number,
    to: number,
): Promise<RestVerseType[]> {
    const verseList: number[] = [];
    for (let verse = from; verse <= to; verse++) {
        verseList.push(verse);
    }
    const labelList = await Promise.all(
        verseList.map((verse) => {
            return toLocaleNumBible(bibleKey, verse);
        }),
    );
    return verseList.map((verse, i) => {
        return { verse, label: labelList[i] };
    });
}

// The verses after the passage, in the chapter it ENDS in.
async function loadRestAfterList(bibleItem: ReadIdOnlyBibleItem) {
    const { bibleKey, target } = bibleItem;
    const verseCount = await getVersesCount(
        bibleKey,
        target.bookKey,
        getTargetChapterEnd(target),
    );
    if (!verseCount) {
        return [];
    }
    return await loadRestVerseList(bibleKey, target.verseEnd + 1, verseCount);
}

// `count` chapters from the `start`-th, in the bible and in each extra one.
async function loadChapterRange(
    bibleItem: ReadIdOnlyBibleItem,
    start: number,
    count: number,
) {
    const { bibleKey, target, extraBibleKeys } = bibleItem;
    const range = { start, count };
    const [verseList, extraVerseInfoListList] = await Promise.all([
        bibleRenderHelper.toVerseTextList(bibleKey, target, false, range),
        Promise.all(
            extraBibleKeys.map((key) => {
                return bibleRenderHelper.toVerseTextList(
                    key,
                    target,
                    false,
                    range,
                );
            }),
        ),
    ]);
    return { verseList, extraVerseInfoListList };
}

/**
 * Everything one passage paints, read in ONE go. Read piece by piece -- the
 * verses, the extra bibles, the direction -- each landed on its own, and a
 * view moving to another passage painted frames mixing the two: the new
 * chapter's verse numbers around the old chapter's text.
 *
 * A passage over more than `BIBLE_SHOWN_CHAPTER_COUNT` chapters is read only
 * that far; `loadNextChapterView` reads the rest one chapter per press.
 */
async function loadPassageView(
    key: string,
    bibleItem: ReadIdOnlyBibleItem,
): Promise<PassageViewType> {
    const { bibleKey, target } = bibleItem;
    const chapterCount = getTargetChapterCount(target);
    const shownChapterCount = Math.min(chapterCount, BIBLE_SHOWN_CHAPTER_COUNT);
    const [isRtl, chapterRange, restBeforeList] = await Promise.all([
        getBibleInfoIsRtl(bibleKey),
        loadChapterRange(bibleItem, 0, shownChapterCount),
        loadRestVerseList(bibleKey, 1, target.verseStart - 1),
    ]);
    const restAfterList =
        shownChapterCount < chapterCount
            ? []
            : await loadRestAfterList(bibleItem);
    return {
        key,
        isRtl: !!isRtl,
        bibleItem,
        verseList: chapterRange.verseList,
        extraVerseInfoListList: chapterRange.extraVerseInfoListList.map(
            (list) => list ?? [],
        ),
        restBeforeList,
        restAfterList,
        chapterCount,
        shownChapterCount,
    };
}

// The view with ONE more chapter appended: nothing already read is read again.
async function loadNextChapterView(
    view: PassageViewType,
): Promise<PassageViewType> {
    const { bibleItem } = view;
    const chapterRange = await loadChapterRange(
        bibleItem,
        view.shownChapterCount,
        1,
    );
    // A chapter the bible lacks ends the passage where it is.
    const shownChapterCount =
        chapterRange.verseList === null
            ? view.chapterCount
            : view.shownChapterCount + 1;
    const restAfterList =
        shownChapterCount < view.chapterCount
            ? []
            : await loadRestAfterList(bibleItem);
    return {
        ...view,
        verseList: [
            ...(view.verseList ?? []),
            ...(chapterRange.verseList ?? []),
        ],
        extraVerseInfoListList: view.extraVerseInfoListList.map((list, i) => {
            return [...list, ...(chapterRange.extraVerseInfoListList[i] ?? [])];
        }),
        restAfterList,
        shownChapterCount,
    };
}

function RenderVerseListComp({
    bibleItem,
    passageView,
}: Readonly<{
    // The item painted: the live one once its own passage has been read.
    bibleItem: ReadIdOnlyBibleItem;
    passageView: PassageViewType;
}>) {
    const { verseList, extraVerseInfoListList } = passageView;
    // Paired by the verse's own key, not by position: across chapters one
    // bible numbering a chapter differently must not shift every verse after.
    const extraVerseMapList = useMemo(() => {
        return extraVerseInfoListList.map((list) => {
            return new Map(
                list.map((verseInfo) => {
                    return [verseInfo.kjvBibleVersesKey, verseInfo];
                }),
            );
        });
    }, [extraVerseInfoListList]);
    if (verseList === null) {
        return (
            <div className={`${BIBLE_VIEW_TEXT_CLASS} p-1`}>
                <span className="text-danger">
                    {tran('No verses found for this Bible item')}
                </span>
            </div>
        );
    }
    return (
        <div>
            {verseList.map((verseInfo, i) => {
                const extraVerseInfoList = extraVerseMapList
                    .map((verseMap) => {
                        return verseMap.get(verseInfo.kjvBibleVersesKey);
                    })
                    .filter((v): v is CompiledVerseType => !!v);
                return (
                    <RenderVerseTextComp
                        key={verseInfo.kjvBibleVersesKey}
                        bibleItem={bibleItem}
                        verseInfo={verseInfo}
                        extraVerseInfoList={extraVerseInfoList}
                        nextVerseInfo={verseList[i + 1] ?? null}
                        index={i}
                    />
                );
            })}
        </div>
    );
}

export default function BibleViewTextComp({
    bibleItem,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
}>) {
    const fontSize = useBibleViewFontSizeContext();
    const viewController = useBibleItemsViewControllerContext();
    const passageViewKey = toPassageViewKey(bibleItem);
    // Keeps the passage on screen, whole, until the next one is read whole.
    const [passageView, setPassageView] = useAppStateAsync(() => {
        return loadPassageView(passageViewKey, bibleItem);
    }, [passageViewKey]);
    const passageViewRef = useAppCurrentRef(passageView);
    const [isLoadingChapter, setIsLoadingChapter] = useState(false);
    const isLoadingChapterRef = useAppCurrentRef(isLoadingChapter);
    const handleShowNextChapter = useCallback(() => {
        const view = passageViewRef.current;
        if (!view || isLoadingChapterRef.current) {
            return;
        }
        setIsLoadingChapter(true);
        loadNextChapterView(view)
            .then((newView) => {
                // Only onto the view it was read from: the passage may have
                // changed, or another press landed first.
                setPassageView((currentView) => {
                    return currentView?.key === view.key &&
                        currentView.shownChapterCount === view.shownChapterCount
                        ? newView
                        : currentView;
                });
            })
            .catch(handleError)
            .finally(() => {
                setIsLoadingChapter(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    // Before the passage: a new start in the chapter it starts in.
    const handleSelectVerseStart = useCallback((verse: number) => {
        viewControllerRef.current.applyTargetOrBibleKey(bibleItemRef.current, {
            target: { ...bibleItemRef.current.target, verseStart: verse },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const targetRef = useAppCurrentRef(bibleItem.target);
    const handleVerseStartTitle = useCallback((verse: number) => {
        return `${verse}-${targetRef.current.verseStart}`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // After the passage: a new end in the chapter it ends in.
    const handleSelectVerseEnd = useCallback((verse: number) => {
        viewControllerRef.current.applyTargetOrBibleKey(bibleItemRef.current, {
            target: { ...bibleItemRef.current.target, verseEnd: verse },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleVerseEndTitle = useCallback((verse: number) => {
        return `${targetRef.current.verseStart}-${verse}`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // ONE per bible view, not one per verse: the painter watches this whole
    // container for the DOM changes that invalidate a mark's range.
    const containerRef = useRef<HTMLDivElement>(null);
    useVerseHighlightPainting(containerRef);
    useVerseCommentHover(containerRef);
    // Until the passage asked for has been read, the one read before stays,
    // painted with the item it was read for.
    const isCurrent = passageView?.key === passageViewKey;
    const shownBibleItem =
        isCurrent || !passageView ? bibleItem : passageView.bibleItem;
    const isExtraVerses = shownBibleItem.extraBibleKeys.length > 0;
    return (
        <div
            ref={containerRef}
            className={`${BIBLE_VIEW_TEXT_CLASS} app-selectable-text p-1`}
            data-bible-item-id={bibleItem.id}
            dir={passageView?.isRtl && !isExtraVerses ? 'rtl' : undefined}
            style={{
                fontSize: `${fontSize}px`,
                paddingBottom: '100px',
            }}
        >
            {passageView ? (
                <>
                    <RenderRestVerseNumListComp
                        bibleItem={shownBibleItem}
                        restVerseList={passageView.restBeforeList}
                        onSelect={handleSelectVerseStart}
                        toTitle={handleVerseStartTitle}
                    />
                    <RenderVerseListComp
                        bibleItem={shownBibleItem}
                        passageView={passageView}
                    />
                    {passageView.shownChapterCount <
                    passageView.chapterCount ? (
                        <RenderShowNextChapterButtonComp
                            onClick={handleShowNextChapter}
                            isLoading={isLoadingChapter}
                        />
                    ) : null}
                    <RenderRestVerseNumListComp
                        bibleItem={shownBibleItem}
                        restVerseList={passageView.restAfterList}
                        onSelect={handleSelectVerseEnd}
                        toTitle={handleVerseEndTitle}
                    />
                </>
            ) : (
                <LoadingComp />
            )}
        </div>
    );
}
