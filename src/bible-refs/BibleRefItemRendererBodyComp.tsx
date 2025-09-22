import LoadingComp from '../others/LoadingComp';
import BibleRefRenderFoundItemComp from './BibleRefRenderFoundItemComp';
import { useGetBibleRef } from './bibleRefsHelpers';

export default function BibleRefItemRendererBodyComp({
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
    const bibleRef = useGetBibleRef(bookKey, chapter, verse);
    if (bibleRef === undefined) {
        return <LoadingComp />;
    }
    if (bibleRef === null) {
        return (
            <div>
                `Data not available for "{bookKey} {chapter}:{verse}"
            </div>
        );
    }
    return (
        <>
            {index !== 0 ? <hr /> : null}
            {bibleRef.map((items, i) => {
                return items.map((item, j) => {
                    return (
                        <BibleRefRenderFoundItemComp
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
