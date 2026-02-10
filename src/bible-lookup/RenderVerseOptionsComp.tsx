import './RenderVersesOptionComp.scss';

import { useMemo } from 'react';

import { tran } from '../lang/langHelpers';
import RenderVerseNumOptionComp, { mouseUp } from './RenderVerseNumOptionComp';
import { useAppEffect, useAppStateAsync } from '../helper/debuggerHelpers';
import { useBibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import { genVerseList } from '../bible-list/bibleHelpers';
import { getVersesCount } from '../helper/bible-helpers/bibleLogicHelpers2';
import type BibleItem from '../bible-list/BibleItem';

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
                    <div
                        className="item alert pointer text-center px-2"
                        title={tran('Show all verses')}
                        style={{
                            color: 'var(--bs-info-text-emphasis)',
                        }}
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
                        <span>
                            <i className="bi bi-arrows-expand-vertical" />
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
