import type { RefObject } from 'react';

import { useGetBibleCrossRefOpenAI } from '../helper/ai/openAIBibleCrossRefHelpers';
import LoadingComp from '../others/LoadingComp';
import type { RefreshingRefType } from '../helper/ai/aiHelpers';
import { useGenRefreshRef } from '../helper/ai/bibleCrossRefHelpers';
import RenderAIBibleCrossReferenceListComp from './RenderAIBibleCrossReferenceListComp';
import { tran } from '../lang/langHelpers';

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
                {tran('Data not available for')} "{bookKey} {chapter}:{verse}"
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
