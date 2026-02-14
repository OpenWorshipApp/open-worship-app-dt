import type { RefObject } from 'react';

import LoadingComp from '../others/LoadingComp';
import { useGettingBibleCrossRefAI } from './bibleCrossRefsHelpers';
import type { RefreshingRefType } from '../helper/ai/aiHelpers';
import { useGenRefreshRef } from '../helper/ai/bibleCrossRefHelpers';
import RenderAIBibleCrossReferenceListComp from './RenderAIBibleCrossReferenceListComp';
import { tran } from '../lang/langHelpers';

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
