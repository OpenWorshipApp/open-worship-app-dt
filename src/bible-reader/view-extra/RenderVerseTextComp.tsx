import { Fragment, useCallback, type MouseEvent } from 'react';

import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import type { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderCustomVerseComp from '../RenderCustomVerseComp';
import { cleanupVerseNumberClicked } from './viewExtraHelpers';
import RenderVerseTextDetailComp from './RenderVerseTextDetailComp';
import { useAppCurrentRef } from '../../helper/appHooks';
import {
    revealBibleNoteRefs,
    useShortBibleNoteVerses,
} from '../../bible-list/note/bibleNoteShortVerseHelpers';

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
    const handleDoubleClick = useCallback((event: MouseEvent) => {
        cleanupVerseNumberClicked(event);
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
        const bibleNoteRefs = event.currentTarget.dataset.bibleId;
        if (!bibleNoteRefs) {
            return;
        }
        revealBibleNoteRefs(bibleNoteRefs.split(','));
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
