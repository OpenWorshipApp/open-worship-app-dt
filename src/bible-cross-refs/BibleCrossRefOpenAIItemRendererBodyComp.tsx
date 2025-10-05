import { RefObject } from 'react';
import { useGetBibleCrossRefOpenAI } from '../helper/ai/openAIBibleCrossRefHelpers';
import LoadingComp from '../others/LoadingComp';
import { RefreshingRefType } from '../helper/ai/aiHelpers';
import RenderAIBibleCrossReferenceComp from './RenderAIBibleCrossReferenceComp';
import { useGenRefreshRef } from '../helper/ai/bibleCrossRefHelpers';

export default function BibleCrossRefOpenAIItemRendererBodyComp({
    ref,
    bookKey,
    chapter,
    verse,
    index,
}: Readonly<{
    ref: RefObject<RefreshingRefType>;
    bookKey: string;
    chapter: number;
    verse: number;
    index: number;
}>) {
    const { bibleCrossRef, refresh } = useGetBibleCrossRefOpenAI(
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
                    <RenderAIBibleCrossReferenceComp
                        key={item.title}
                        crossReference={item}
                    />
                );
            })}
        </>
    );
}
