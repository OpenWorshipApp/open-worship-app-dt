import { RefObject } from 'react';
import {
    CrossReferenceType,
    useGetBibleCrossRefAnthropic,
} from '../helper/ai/anthropicBibleCrossRefHelpers';
import LoadingComp from '../others/LoadingComp';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';
import { RefreshingRefType, useGenRefreshRef } from '../helper/ai/aiHelpers';

function RenderCrossReferenceComp({
    crossReference,
    bibleKey,
}: Readonly<{
    crossReference: CrossReferenceType;
    bibleKey: string;
}>) {
    return (
        <div>
            <hr />
            <strong style={{ color: '#88ff00b8' }}>
                {crossReference.title}
            </strong>
            {crossReference.verses.map((item, i) => {
                return (
                    <BibleCrossRefAIRenderFoundItemComp
                        key={item + i}
                        bibleKey={bibleKey}
                        bibleVersesKey={item}
                    />
                );
            })}
        </div>
    );
}

export default function BibleCrossRefAnthropicItemRendererBodyComp({
    ref,
    bibleKey,
    bookKey,
    chapter,
    verse,
    index,
}: Readonly<{
    ref: RefObject<RefreshingRefType>;
    bibleKey: string;
    bookKey: string;
    chapter: number;
    verse: number;
    index: number;
}>) {
    const { bibleCrossRef, refresh } = useGetBibleCrossRefAnthropic(
        bookKey,
        chapter,
        verse,
    );
    useGenRefreshRef(ref, refresh);
    if (bibleCrossRef === undefined) {
        return <LoadingComp />;
    }
    if (bibleCrossRef === null) {
        return (
            <div>
                `Data not available for "{bookKey} {chapter}:{verse}"
            </div>
        );
    }
    return (
        <>
            {index !== 0 ? <hr /> : null}
            {bibleCrossRef.map((item) => {
                return (
                    <RenderCrossReferenceComp
                        key={item.title}
                        crossReference={item}
                        bibleKey={bibleKey}
                    />
                );
            })}
        </>
    );
}
