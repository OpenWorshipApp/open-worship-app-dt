import { Fragment } from 'react';

import {
    BIBLE_VIEW_TEXT_CLASS,
    useBibleViewFontSizeContext,
} from '../../helper/bibleViewHelpers';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import { bibleRenderHelper } from '../../bible-list/bibleRenderHelpers';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import { getVersesCount } from '../../helper/bible-helpers/bibleLogicHelpers2';
import LoadingComp from '../../others/LoadingComp';
import { getBibleInfoIsRtl } from '../../helper/bible-helpers/bibleInfoHelpers';
import { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderRestVerseNumListComp from './RenderRestVerseNumListComp';
import RenderVerseTextComp from './RenderVerseTextComp';

function RenderVerseTitleComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const [title] = useAppStateAsync(() => {
        return bibleItem.toTitle();
    }, [bibleItem]);
    return (
        <>
            <hr />
            <span className="text-muted " data-bible-key={bibleItem.bibleKey}>
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
                    `No verses found for this Bible item.
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
                onSelect={(verse) => {
                    viewController.applyTargetOrBibleKey(bibleItem, {
                        target: { ...bibleItem.target, verseStart: verse },
                    });
                }}
                toTitle={(verse) => {
                    return `${verse}-${target.verseStart}`;
                }}
            />
            <RenderVerseListDetailComp
                bibleItem={bibleItem}
                extraBibleKeys={extraBibleKeys}
            />
            <RenderRestVerseNumListComp
                from={target.verseEnd + 1}
                bibleItem={bibleItem}
                verseCount={verseCount ?? 0}
                onSelect={(verse) => {
                    viewController.applyTargetOrBibleKey(bibleItem, {
                        target: { ...bibleItem.target, verseEnd: verse },
                    });
                }}
                toTitle={(verse) => {
                    return `${target.verseStart}-${verse}`;
                }}
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
