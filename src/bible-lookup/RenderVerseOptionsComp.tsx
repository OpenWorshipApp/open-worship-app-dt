import './RenderVersesOptionComp.scss';

import RenderVerseNumOptionComp, { mouseUp } from './RenderVerseNumOptionComp';
import { useAppEffect, useAppStateAsync } from '../helper/debuggerHelpers';
import { useBibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import { genVerseList } from '../bible-list/bibleHelpers';
import { useMemo } from 'react';
import { getVersesCount } from '../helper/bible-helpers/serverBibleHelpers2';
import BibleItem from '../bible-list/BibleItem';

export default function RenderVerseOptionsComp({
    bibleItem,
}: Readonly<{
    bibleItem: BibleItem;
}>) {
    const { bibleKey, target } = bibleItem;
    const [verseList] = useAppStateAsync(() => {
        return genVerseList({
            bibleKey: bibleKey,
            bookKey: target.bookKey,
            chapter: target.chapter,
        });
    }, [bibleKey, target.bookKey, target.chapter]);
    const viewController = useBibleItemsViewControllerContext();
    const [verseCount] = useAppStateAsync(() => {
        return getVersesCount(bibleKey, target.bookKey, target.chapter);
    }, [bibleKey, target.bookKey, target.chapter]);
    const isFull = useMemo(() => {
        return (
            target.verseStart === 1 &&
            verseCount &&
            target.verseEnd === verseCount
        );
    }, [verseCount, target.verseStart, target.verseEnd]);
    useAppEffect(() => {
        document.body.addEventListener('mouseup', mouseUp);
        return () => {
            document.body.removeEventListener('mouseup', mouseUp);
        };
    }, []);
    if (!verseList) {
        return null;
    }
    return (
        <div className="render-found full-view-hide" data-bible-key={bibleKey}>
            <div
                className={
                    'verse-select w-100 d-flex p-1 align-content-start ' +
                    'flex-wrap app-inner-shadow'
                }
            >
                {verseList.map(([verseNum, verseNumStr], i) => {
                    return (
                        <RenderVerseNumOptionComp
                            key={verseNumStr}
                            bibleItem={bibleItem}
                            index={i}
                            verseNum={verseNum}
                            verseNumText={verseNumStr}
                            onVerseChange={(newVerseStart, newVerseEnd) => {
                                viewController.applyTargetOrBibleKey(
                                    bibleItem,
                                    {
                                        target: {
                                            ...target,
                                            verseStart: newVerseStart,
                                            verseEnd:
                                                newVerseEnd ?? newVerseStart,
                                        },
                                    },
                                );
                            }}
                        />
                    );
                })}
                {isFull ? null : (
                    <span
                        className="p-2 app-caught-hover-pointer"
                        title="Full Verse"
                        onClick={() => {
                            viewController.applyTargetOrBibleKey(bibleItem, {
                                target: {
                                    ...target,
                                    verseStart: 1,
                                    verseEnd: verseList.length,
                                },
                            });
                        }}
                    >
                        <i className="bi bi-asterisk" />
                    </span>
                )}
            </div>
        </div>
    );
}
