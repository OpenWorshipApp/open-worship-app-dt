import { Fragment, useCallback } from 'react';

import {
    BIBLE_VIEW_TEXT_CLASS,
    useBibleViewFontSizeContext,
} from '../../helper/bibleViewHelpers';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import { bibleRenderHelper } from '../../bible-list/bibleRenderHelpers';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import {
    getVersesCount,
    useBibleFontFamily,
} from '../../helper/bible-helpers/bibleLogicHelpers2';
import LoadingComp from '../../others/LoadingComp';
import { getBibleInfoIsRtl } from '../../helper/bible-helpers/bibleInfoHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderRestVerseNumListComp from './RenderRestVerseNumListComp';
import RenderVerseTextComp from './RenderVerseTextComp';
import { tran } from '../../lang/langHelpers';

function RenderVerseTitleComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const fontFamily = useBibleFontFamily(bibleItem.bibleKey);
    const [title] = useAppStateAsync(() => {
        return bibleItem.toTitle();
    }, [bibleItem]);
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
    extraBibleKeys,
    isExtraBibleItem = false,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    extraBibleKeys: string[];
    isExtraBibleItem?: boolean;
}>) {
    const { bibleKey, target } = bibleItem;
    const [verseCount] = useAppStateAsync(() => {
        return getVersesCount(bibleKey, target.bookKey, target.chapter);
    }, [bibleKey, target.bookKey, target.chapter]);
    const [verseList] = useAppStateAsync(() => {
        return bibleRenderHelper.toVerseTextList(bibleKey, target);
    }, [bibleKey, target]);
    const [extraVerseInfoListList] = useAppStateAsync(async () => {
        const results = await Promise.all(
            extraBibleKeys.map((key) => {
                return bibleRenderHelper.toVerseTextList(key, target);
            }),
        );
        return results.filter((list) => {
            return list !== null;
        });
    }, [extraBibleKeys, target]);
    if (verseList === undefined || verseCount === undefined) {
        return <LoadingComp />;
    }
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
                <RenderVerseTitleComp bibleItem={bibleItem} />
            ) : null}
            {verseList.map((verseInfo, i) => {
                const extraVerseInfoList = extraVerseInfoListList
                    ? extraVerseInfoListList
                          .map((verseInfoList) => {
                              return verseInfoList[i];
                          })
                          .filter((v) => !!v)
                    : [];
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
    const { bibleKey, extraBibleKeys, target } = bibleItem;
    const fontSize = useBibleViewFontSizeContext();
    const viewController = useBibleItemsViewControllerContext();
    const [verseCount] = useAppStateAsync(() => {
        return getVersesCount(bibleKey, target.bookKey, target.chapter);
    }, [bibleKey, target.bookKey, target.chapter]);
    const [isRtl] = useAppStateAsync(() => {
        return getBibleInfoIsRtl(bibleKey);
    }, [bibleKey]);
    const isExtraVerses = extraBibleKeys.length > 0;
    const handleSelectVerseStart = useCallback(
        (verse: number) => {
            viewController.applyTargetOrBibleKey(bibleItem, {
                target: { ...bibleItem.target, verseStart: verse },
            });
        },
        [viewController, bibleItem],
    );
    const handleVerseStartTitle = useCallback(
        (verse: number) => {
            return `${verse}-${target.verseStart}`;
        },
        [target.verseStart],
    );
    const handleSelectVerseEnd = useCallback(
        (verse: number) => {
            viewController.applyTargetOrBibleKey(bibleItem, {
                target: { ...bibleItem.target, verseEnd: verse },
            });
        },
        [viewController, bibleItem],
    );
    const handleVerseEndTitle = useCallback(
        (verse: number) => {
            return `${target.verseStart}-${verse}`;
        },
        [target.verseStart],
    );
    return (
        <div
            className={`${BIBLE_VIEW_TEXT_CLASS} app-selectable-text p-1`}
            data-bible-item-id={bibleItem.id}
            dir={isRtl && !isExtraVerses ? 'rtl' : undefined}
            style={{
                fontSize: `${fontSize}px`,
                paddingBottom: '100px',
            }}
        >
            <RenderRestVerseNumListComp
                to={target.verseStart - 1}
                bibleItem={bibleItem}
                verseCount={verseCount ?? 0}
                onSelect={handleSelectVerseStart}
                toTitle={handleVerseStartTitle}
            />
            <RenderVerseListDetailComp
                bibleItem={bibleItem}
                extraBibleKeys={extraBibleKeys}
            />
            <RenderRestVerseNumListComp
                from={target.verseEnd + 1}
                bibleItem={bibleItem}
                verseCount={verseCount ?? 0}
                onSelect={handleSelectVerseEnd}
                toTitle={handleVerseEndTitle}
            />
            {extraBibleItems?.length
                ? extraBibleItems.map((extraBibleItem, i) => {
                      return (
                          <Fragment key={i}>
                              <RenderVerseListDetailComp
                                  bibleItem={extraBibleItem}
                                  extraBibleKeys={extraBibleKeys}
                                  isExtraBibleItem
                              />
                          </Fragment>
                      );
                  })
                : null}
        </div>
    );
}
