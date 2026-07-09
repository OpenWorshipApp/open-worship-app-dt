import { Fragment, useCallback, type MouseEvent } from 'react';

import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import type { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderCustomVerseComp from '../RenderCustomVerseComp';
import { cleanupVerseNumberClicked } from './viewExtraHelpers';
import RenderVerseTextDetailComp from './RenderVerseTextDetailComp';
import { useAppCurrentRef } from '../../helper/appHooks';

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
                title={`Double click to select verse ${verseInfo.localeVerse}`}
                onDoubleClick={handleDoubleClick}
            >
                <div>
                    {verseInfo.isNewLine ? (
                        <span className="verse-number-text">&nbsp;&nbsp;</span>
                    ) : null}
                    {verseInfoList.map((extraVerseInfo, i) => (
                        <Fragment key={extraVerseInfo.bibleKey}>
                            {i > 0 ? ', ' : null}
                            <span style={extraVerseInfo.style}>
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
