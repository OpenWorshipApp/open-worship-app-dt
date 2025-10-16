import { RefObject } from 'react';
import LoadingComp from '../others/LoadingComp';
import { useGettingBibleCrossRefAI } from './bibleCrossRefsHelpers';
import { RefreshingRefType } from '../helper/ai/aiHelpers';
import { useGenRefreshRef } from '../helper/ai/bibleCrossRefHelpers';
import RenderAIBibleCrossReferenceComp from './RenderAIBibleCrossReferenceComp';

export default function BibleCrossRefAIItemRendererBodyComp({
    ref,
    aiType,
    bibleKey,
    bookKey,
    chapter,
    verse,
    index,
}: Readonly<{
    ref: RefObject<RefreshingRefType>;
    aiType: string;
    bibleKey: string;
    bookKey: string;
    chapter: number;
    verse: number;
    index: number;
}>) {
    const { bibleCrossRef, refresh } = useGettingBibleCrossRefAI(
        aiType,
        bibleKey,
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
            {index === 0 ? null : <hr />}
            {bibleCrossRef.map((item) => {
                return (
                    <RenderAIBibleCrossReferenceComp
                        key={item.title}
                        crossReference={item}
                    />
                );
            })}
        </>
    );
}
