import './RenderVersesOptionComp.scss';

import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import RenderVerseNumOptionComp, { mouseUp } from './RenderVerseNumOptionComp';
import { useAppEffect, useAppStateAsync } from '../helper/debuggerHelpers';
import { useBibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import { genVerseList } from '../bible-list/bibleHelpers';
import {
    getVersesCount,
    useBibleFontFamily,
} from '../helper/bible-helpers/bibleLogicHelpers2';
import type BibleItem from '../bible-list/BibleItem';
import { type BibleTargetType } from '../bible-list/bibleRenderHelpers';

export default function RenderVerseOptionsComp({
    bibleItem,
}: Readonly<{
    bibleItem: BibleItem;
}>) {
    const { bibleKey, target } = bibleItem;
    const fontFamily = useBibleFontFamily(bibleKey);
    const [verseList] = useAppStateAsync(() => {
        return genVerseList({
            bibleKey: bibleKey,
            bookKey: target.bookKey,
            chapter: target.chapter,
        });
    }, [bibleKey, target.bookKey, target.chapter]);
    const [selectedTarget, setSelectedTarget] = useState({
        verseStart: 1,
        verseEnd: 1,
    });
    useAppEffect(() => {
        setSelectedTarget({
            verseStart: target.verseStart,
            verseEnd: target.verseEnd,
        });
    }, [target.verseStart, target.verseEnd]);
    const { verseStart, verseEnd } = selectedTarget;
    const viewController = useBibleItemsViewControllerContext();
    const [verseCount] = useAppStateAsync(() => {
        return getVersesCount(bibleKey, target.bookKey, target.chapter);
    }, [bibleKey, target.bookKey, target.chapter]);
    const isFull = verseStart === 1 && verseCount && verseEnd === verseCount;
    useAppEffect(() => {
        document.body.addEventListener('mouseup', mouseUp);
        return () => {
            document.body.removeEventListener('mouseup', mouseUp);
        };
    }, []);
    const handleVerseChange = useCallback(
        (newVerseStart: number, newVerseEnd?: number) => {
            const newSelectedTarget = {
                verseStart: newVerseStart,
                verseEnd: newVerseEnd ?? newVerseStart,
            };
            setSelectedTarget(newSelectedTarget);
        },
        [],
    );
    const handleApplying = useCallback(
        (newVerseStart: number, newVerseEnd?: number) => {
            const newSelectedTarget = {
                verseStart: newVerseStart,
                verseEnd: newVerseEnd ?? newVerseStart,
            };
            setSelectedTarget(newSelectedTarget);
            const newTarget: BibleTargetType = {
                ...target,
                ...newSelectedTarget,
            };
            viewController.applyTargetOrBibleKey(bibleItem, {
                target: newTarget,
            });
        },
        [target, viewController, bibleItem],
    );
    const handleFullVersesClick = useCallback(() => {
        if (!verseList) {
            return;
        }
        viewController.applyTargetOrBibleKey(bibleItem, {
            target: {
                ...target,
                verseStart: 1,
                verseEnd: verseList.length,
            },
        });
    }, [verseList, viewController, bibleItem, target]);
    if (!verseList) {
        return null;
    }
    return (
        <div className="render-found full-view-hide" style={{ fontFamily }}>
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
                            index={i}
                            verseNum={verseNum}
                            verseNumText={verseNumStr}
                            verseStart={verseStart}
                            verseEnd={verseEnd}
                            onVerseChange={handleVerseChange}
                            onApply={handleApplying}
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
                        onClick={handleFullVersesClick}
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
