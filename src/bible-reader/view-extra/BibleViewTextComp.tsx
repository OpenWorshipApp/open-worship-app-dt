import { Fragment, useCallback, useRef } from 'react';

import {
    BIBLE_VIEW_TEXT_CLASS,
    useBibleViewFontSizeContext,
} from '../../helper/bibleViewHelpers';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import { bibleRenderHelper } from '../../bible-list/bibleRenderHelpers';
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
import { tran } from '../../lang/langHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';
import { useVerseHighlightPainting } from '../verseHighlightPainter';
import { useVerseCommentHover } from '../verseCommentHoverHelpers';

type VerseTextListType = NonNullable<
    Awaited<ReturnType<typeof bibleRenderHelper.toVerseTextList>>
>;
type VerseListDetailType = {
    bibleItem: ReadIdOnlyBibleItem;
    title: string | null;
    verseCount: number | null;
    verseList: VerseTextListType | null;
    extraVerseInfoListList: VerseTextListType[];
    // The verse numbers before and after the passage; the main one only.
    restBeforeList: RestVerseType[];
    restAfterList: RestVerseType[];
};
type PassageViewType = {
    key: string;
    isRtl: boolean;
    main: VerseListDetailType;
    extraList: VerseListDetailType[];
};

function toPassageKey(bibleItem: ReadIdOnlyBibleItem) {
    const { bibleKey, target } = bibleItem;
    return [
        bibleKey,
        target.bookKey,
        target.chapter,
        target.verseStart,
        target.verseEnd,
    ].join(':');
}

// Primitives only: a re-render that hands over a NEW item object for the SAME
// passage -- every update of the view controller does -- reads nothing again.
export function toPassageViewKey(
    bibleItem: ReadIdOnlyBibleItem,
    extraBibleItems: ReadIdOnlyBibleItem[] | undefined,
) {
    return [
        toPassageKey(bibleItem),
        bibleItem.extraBibleKeys.join(','),
        ...(extraBibleItems ?? []).map(toPassageKey),
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

async function loadVerseListDetail(
    bibleItem: ReadIdOnlyBibleItem,
    extraBibleKeys: string[],
    isExtraBibleItem: boolean,
): Promise<VerseListDetailType> {
    const { bibleKey, target } = bibleItem;
    const [
        title,
        verseCount,
        verseList,
        extraVerseInfoListList,
        restBeforeList,
    ] = await Promise.all([
        isExtraBibleItem ? bibleItem.toTitle() : null,
        getVersesCount(bibleKey, target.bookKey, target.chapter),
        bibleRenderHelper.toVerseTextList(bibleKey, target),
        Promise.all(
            extraBibleKeys.map((key) => {
                return bibleRenderHelper.toVerseTextList(key, target);
            }),
        ),
        isExtraBibleItem
            ? []
            : loadRestVerseList(bibleKey, 1, target.verseStart - 1),
    ]);
    const restAfterList =
        isExtraBibleItem || !verseCount
            ? []
            : await loadRestVerseList(
                  bibleKey,
                  target.verseEnd + 1,
                  verseCount,
              );
    return {
        bibleItem,
        title,
        verseCount: verseCount ?? null,
        verseList: verseList ?? null,
        restBeforeList,
        restAfterList,
        extraVerseInfoListList: extraVerseInfoListList.filter(
            (list): list is VerseTextListType => {
                return !!list;
            },
        ),
    };
}

/**
 * Everything one passage paints, read in ONE go. Read piece by piece -- the
 * verse count, the verses, the extra bibles, the direction -- each landed on
 * its own, and a view moving to another passage painted frames mixing the
 * two: the new chapter's verse numbers around the old chapter's text.
 */
async function loadPassageView(
    key: string,
    bibleItem: ReadIdOnlyBibleItem,
    extraBibleItems: ReadIdOnlyBibleItem[] | undefined,
): Promise<PassageViewType> {
    const { extraBibleKeys } = bibleItem;
    const [isRtl, main, extraList] = await Promise.all([
        getBibleInfoIsRtl(bibleItem.bibleKey),
        loadVerseListDetail(bibleItem, extraBibleKeys, false),
        Promise.all(
            (extraBibleItems ?? []).map((extraBibleItem) => {
                return loadVerseListDetail(
                    extraBibleItem,
                    extraBibleKeys,
                    true,
                );
            }),
        ),
    ]);
    return { key, isRtl: !!isRtl, main, extraList };
}

function RenderVerseTitleComp({
    bibleItem,
    title,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem; title: string | null }>) {
    const fontFamily = useBibleFontFamily(bibleItem.bibleKey);
    return (
        <>
            <hr />
            <span className="text-muted " style={{ fontFamily }}>
                {title}
            </span>
        </>
    );
}

function RenderVerseListDetailComp({
    bibleItem,
    detail,
    isExtraBibleItem = false,
}: Readonly<{
    // The item painted: the live one once its own passage has been read.
    bibleItem: ReadIdOnlyBibleItem;
    detail: VerseListDetailType;
    isExtraBibleItem?: boolean;
}>) {
    const { verseList, verseCount, extraVerseInfoListList } = detail;
    if (verseList === null || verseCount === null) {
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
            {isExtraBibleItem ? (
                <RenderVerseTitleComp
                    bibleItem={bibleItem}
                    title={detail.title}
                />
            ) : null}
            {verseList.map((verseInfo, i) => {
                const extraVerseInfoList = extraVerseInfoListList
                    .map((verseInfoList) => {
                        return verseInfoList[i];
                    })
                    .filter((v) => !!v);
                return (
                    <RenderVerseTextComp
                        key={verseInfo.localeVerse}
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
    extraBibleItems,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    extraBibleItems?: ReadIdOnlyBibleItem[];
}>) {
    const fontSize = useBibleViewFontSizeContext();
    const viewController = useBibleItemsViewControllerContext();
    const passageViewKey = toPassageViewKey(bibleItem, extraBibleItems);
    // Keeps the passage on screen, whole, until the next one is read whole.
    const [passageView] = useAppStateAsync(() => {
        return loadPassageView(passageViewKey, bibleItem, extraBibleItems);
    }, [passageViewKey]);
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
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
    // painted with the items it was read for.
    const isCurrent = passageView?.key === passageViewKey;
    const shownBibleItem =
        isCurrent || !passageView ? bibleItem : passageView.main.bibleItem;
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
                        restVerseList={passageView.main.restBeforeList}
                        onSelect={handleSelectVerseStart}
                        toTitle={handleVerseStartTitle}
                    />
                    <RenderVerseListDetailComp
                        bibleItem={shownBibleItem}
                        detail={passageView.main}
                    />
                    <RenderRestVerseNumListComp
                        bibleItem={shownBibleItem}
                        restVerseList={passageView.main.restAfterList}
                        onSelect={handleSelectVerseEnd}
                        toTitle={handleVerseEndTitle}
                    />
                    {passageView.extraList.map((detail, i) => {
                        return (
                            <Fragment key={i}>
                                <RenderVerseListDetailComp
                                    bibleItem={
                                        isCurrent && extraBibleItems?.[i]
                                            ? extraBibleItems[i]
                                            : detail.bibleItem
                                    }
                                    detail={detail}
                                    isExtraBibleItem
                                />
                            </Fragment>
                        );
                    })}
                </>
            ) : (
                <LoadingComp />
            )}
        </div>
    );
}
