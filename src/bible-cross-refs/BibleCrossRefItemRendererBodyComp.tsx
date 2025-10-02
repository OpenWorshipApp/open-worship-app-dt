import LoadingComp from '../others/LoadingComp';
import BibleCrossRefRenderFoundItemComp from './BibleCrossRefRenderFoundItemComp';
import { useGetBibleCrossRef } from './bibleCrossRefsHelpers';

export default function BibleCrossRefItemRendererBodyComp({
    bibleKey,
    bookKey,
    chapter,
    verse,
    index,
}: Readonly<{
    bibleKey: string;
    bookKey: string;
    chapter: number;
    verse: number;
    index: number;
}>) {
    const bibleCrossRef = useGetBibleCrossRef(bookKey, chapter, verse);
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
                            bibleKey={bibleKey}
                            bibleVersesKey={item.text}
                            itemInfo={item}
                        />
                    );
                });
            })}
        </>
    );
}
