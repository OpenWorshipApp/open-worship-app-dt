import './RenderVersesOptionComp.scss';

import { type RefObject, useCallback, useRef, useState } from 'react';

import { tran } from '../lang/langHelpers';
import RenderVerseNumOptionComp, { mouseUp } from './RenderVerseNumOptionComp';
import {
    useAppEffect,
    useAppStateAsync,
    useAppCurrentRef,
} from '../helper/appHooks';
import { useBibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import { genVerseList } from '../bible-list/bibleHelpers';
import { getVersesCount } from '../helper/bible-helpers/bibleLogicHelpers2';
import type BibleItem from '../bible-list/BibleItem';
import { type BibleTargetType } from '../bible-list/bibleRenderHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

function useTouchDrag(
    verseSelectRef: RefObject<HTMLDivElement | null>,
    {
        verseList,
        handleVerseChange,
        handleApplying,
    }: {
        verseList?: [number, string][] | null;
        handleVerseChange: (verseStart: number, verseEnd?: number) => void;
        handleApplying: (verseStart: number, verseEnd?: number) => void;
    },
) {
    const handleVerseChangeRef = useAppCurrentRef(handleVerseChange);
    const handleApplyingRef = useAppCurrentRef(handleApplying);
    useAppEffect(() => {
        const container = verseSelectRef.current;
        if (container === null) {
            return;
        }
        const getVerseIndexFromPoint = (clientX: number, clientY: number) => {
            const element = document.elementFromPoint(clientX, clientY);
            const itemElement = element?.closest('[data-verse-index]');
            if (!(itemElement instanceof HTMLElement)) {
                return null;
            }
            const ind = Number.parseInt(
                itemElement.dataset.verseIndex ?? '',
                10,
            );
            return Number.isNaN(ind) ? null : ind;
        };
        let dragStart: number | null = null;
        let dragEnd: number | null = null;
        const handleTouchStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (touch === undefined) {
                return;
            }
            const ind = getVerseIndexFromPoint(touch.clientX, touch.clientY);
            if (ind === null) {
                return;
            }
            event.preventDefault();
            dragStart = ind;
            dragEnd = ind;
            handleVerseChangeRef.current(ind);
        };
        const handleTouchMove = (event: TouchEvent) => {
            if (dragStart === null) {
                return;
            }
            event.preventDefault();
            const touch = event.touches[0];
            if (touch === undefined) {
                return;
            }
            const ind = getVerseIndexFromPoint(touch.clientX, touch.clientY);
            if (ind === null) {
                return;
            }
            dragEnd = ind;
            handleVerseChangeRef.current(
                Math.min(dragStart, ind),
                Math.max(dragStart, ind),
            );
        };
        const handleTouchEnd = () => {
            if (dragStart === null || dragEnd === null) {
                return;
            }
            handleApplyingRef.current(
                Math.min(dragStart, dragEnd),
                Math.max(dragStart, dragEnd),
            );
            dragStart = null;
            dragEnd = null;
        };
        container.addEventListener('touchstart', handleTouchStart, {
            passive: false,
        });
        container.addEventListener('touchmove', handleTouchMove, {
            passive: false,
        });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchEnd);
        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [verseList?.length]);
}

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
    const targetRef = useAppCurrentRef(target);
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleApplying = useCallback(
        (newVerseStart: number, newVerseEnd?: number) => {
            const newSelectedTarget = {
                verseStart: newVerseStart,
                verseEnd: newVerseEnd ?? newVerseStart,
            };
            setSelectedTarget(newSelectedTarget);
            const newTarget: BibleTargetType = {
                ...targetRef.current,
                ...newSelectedTarget,
            };
            viewControllerRef.current.applyTargetOrBibleKey(
                bibleItemRef.current,
                {
                    target: newTarget,
                },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const verseListRef = useAppCurrentRef(verseList);
    const handleFullVersesClick = useCallback(() => {
        if (!verseListRef.current) {
            return;
        }
        viewControllerRef.current.applyTargetOrBibleKey(bibleItemRef.current, {
            target: {
                ...targetRef.current,
                verseStart: 1,
                verseEnd: verseListRef.current.length,
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const verseSelectRef = useRef<HTMLDivElement>(null);
    useTouchDrag(verseSelectRef, {
        verseList,
        handleVerseChange,
        handleApplying,
    });

    return (
        <div
            className="render-found full-view-hide"
            style={{ fontFamily, display: verseList ? undefined : 'none' }}
        >
            <div
                ref={verseSelectRef}
                className={
                    'verse-select w-100 d-flex p-0 align-content-start ' +
                    'flex-wrap app-inner-shadow'
                }
            >
                {(verseList ?? []).map(([verseNum, verseNumStr], i) => {
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
