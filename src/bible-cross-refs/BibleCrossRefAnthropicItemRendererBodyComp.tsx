import { RefObject } from 'react';
import { useGetBibleCrossRefAnthropic } from '../helper/ai/anthropicBibleCrossRefHelpers';
import LoadingComp from '../others/LoadingComp';
import { RefreshingRefType } from '../helper/ai/aiHelpers';
import { useGenRefreshRef } from '../helper/ai/bibleCrossRefHelpers';
import RenderAIBibleCrossReferenceListComp from './RenderAIBibleCrossReferenceListComp';

export default function BibleCrossRefAnthropicItemRendererBodyComp({
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
        <RenderAIBibleCrossReferenceListComp
            index={index}
            bibleCrossRef={bibleCrossRef}
        />
    );
}
