import { Fragment, useCallback, useRef, type MouseEvent } from 'react';

import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import type { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderCustomVerseComp from '../RenderCustomVerseComp';
import { cleanupVerseNumberClicked } from './viewExtraHelpers';
import RenderVerseTextDetailComp from './RenderVerseTextDetailComp';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import {
    revealBibleNoteRefs,
    useShortBibleNoteVerses,
} from '../../bible-list/note/bibleNoteShortVerseHelpers';

// The verse number carries BOTH gestures — one click reveals the verse's bible
// notes, two selects the verse — so the reveal has to wait out the double-click
// window. `stopPropagation` on the click is not enough: `dblclick` is its own
// event and still reaches the wrapper, so a plain double-click used to fire the
// reveal twice (two note-file opens, two multi-second highlight polls) and only
// then select the verse. Same 400ms the floating widget's own double-press
// detection uses.
const DOUBLE_CLICK_MILLISECOND = 400;

export default function RenderVerseTextComp({
    bibleItem,
    verseInfo,
    nextVerseInfo,
    index,
    extraVerseInfoList = [],
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    verseInfo: CompiledVerseType;
    nextVerseInfo: CompiledVerseType | null;
    extraVerseInfoList?: CompiledVerseType[];
    index: number;
}>) {
    const bibleNoteShortVerses = useShortBibleNoteVerses();
    const viewController = useBibleItemsViewControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const verseInfoRef = useAppCurrentRef(verseInfo);
    // PER INSTANCE: one of these is mounted per verse, so a module-level timer
    // would let one verse's pending reveal be cancelled by a click on another.
    const revealTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const cancelPendingReveal = useCallback(() => {
        if (revealTimeoutIdRef.current !== null) {
            clearTimeout(revealTimeoutIdRef.current);
            revealTimeoutIdRef.current = null;
        }
    }, []);
    // Nothing should reach into the notes list after this verse is gone.
    useAppEffect(() => {
        return cancelPendingReveal;
    }, [cancelPendingReveal]);
    const cancelPendingRevealRef = useAppCurrentRef(cancelPendingReveal);
    const handleDoubleClick = useCallback((event: MouseEvent) => {
        cleanupVerseNumberClicked(event);
        // The first half of this gesture already scheduled a reveal; selecting
        // the verse is what the user actually asked for.
        cancelPendingRevealRef.current();
        viewControllerRef.current.applyTargetOrBibleKey(bibleItemRef.current, {
            target: {
                ...bibleItemRef.current.target,
                verseStart: verseInfoRef.current.verse,
                verseEnd: verseInfoRef.current.verse,
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // The notes are read back off the element rather than closed over: one span
    // is drawn per compared bible, they are all this one handler, and the
    // attribute already holds the answer this click wants.
    const handleClick = useCallback((event: MouseEvent<HTMLSpanElement>) => {
        cleanupVerseNumberClicked(event);
        // Read NOW: React nulls `currentTarget` once the handler returns, and
        // the reveal below is deferred past that point.
        const bibleNoteRefs = event.currentTarget.dataset.bibleId;
        cancelPendingRevealRef.current();
        if (!bibleNoteRefs) {
            return;
        }
        revealTimeoutIdRef.current = setTimeout(() => {
            revealTimeoutIdRef.current = null;
            revealBibleNoteRefs(bibleNoteRefs.split(','));
        }, DOUBLE_CLICK_MILLISECOND);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isExtraVerses = extraVerseInfoList.length > 0;
    const verseInfoList = [verseInfo, ...extraVerseInfoList];
    const isNewLine =
        !isExtraVerses &&
        viewController.shouldNewLine &&
        (verseInfo.isNewLine ||
            (viewController.shouldModelNewLine && verseInfo.isModelNewLine));
    return (
        <>
            {!isNewLine || verseInfo.newLineTitlesHtmlText === null ? null : (
                <>
                    {index > 0 ? <br /> : null}
                    <div className="mt-2">
                        <RenderCustomVerseComp
                            bibleItem={bibleItem}
                            customHtml={verseInfo.newLineTitlesHtmlText}
                        />
                    </div>
                </>
            )}
            {isNewLine && verseInfo.newLineTitlesHtmlText === null ? (
                <br />
            ) : null}
            <div
                className={
                    'verse-number app-caught-hover-pointer' +
                    (isExtraVerses ? ' extra-verses' : '')
                }
                title={
                    'Click to reveal the bible notes of this verse,' +
                    ` double click to select verse ${verseInfo.localeVerse}`
                }
                onDoubleClick={handleDoubleClick}
            >
                <div>
                    {verseInfo.isNewLine ? (
                        <span className="verse-number-text">&nbsp;&nbsp;</span>
                    ) : null}
                    {verseInfoList.map((extraVerseInfo, i) => (
                        <Fragment key={extraVerseInfo.bibleKey}>
                            {i > 0 ? ', ' : null}
                            <span
                                className="verse-number-text"
                                style={extraVerseInfo.style}
                                // `<note file path>@<note item id>,...`, absent
                                // when no note mentions this verse — the marking
                                // and the click payload are the one attribute
                                data-bible-id={bibleNoteShortVerses[
                                    extraVerseInfo.kjvBibleVersesKey
                                ]?.join(',')}
                                onClick={handleClick}
                            >
                                {extraVerseInfo.localeVerse}
                            </span>
                        </Fragment>
                    ))}
                </div>
            </div>
            <RenderVerseTextDetailComp
                bibleItem={bibleItem}
                verseInfo={verseInfo}
                nextVerseInfo={nextVerseInfo}
                extraVerseInfoList={extraVerseInfoList}
                index={index}
            />
        </>
    );
}
