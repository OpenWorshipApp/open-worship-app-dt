import { RefObject } from 'react';
import LoadingComp from '../others/LoadingComp';
import BibleCrossRefRenderFoundItemComp from './BibleCrossRefRenderFoundItemComp';
import { useGetBibleCrossRef } from './bibleCrossRefsHelpers';
import { RefreshingRefType } from '../helper/ai/aiHelpers';
import { useGenRefreshRef } from '../helper/ai/bibleCrossRefHelpers';

export default function BibleCrossRefItemRendererBodyComp({
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
    const { bibleCrossRef, refresh } = useGetBibleCrossRef(
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
            {bibleCrossRef.map((items, i) => {
                return items.map((item, j) => {
                    return (
                        <BibleCrossRefRenderFoundItemComp
                            key={item.text + i + j}
                            bibleVersesKey={item.text}
                            itemInfo={item}
                        />
                    );
                });
            })}
        </>
    );
}
