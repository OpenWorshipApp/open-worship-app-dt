import { useGetBibleRef } from './bibleRefsHelpers';
import BibleRefRenderFoundItemComp from './BibleRefRenderFoundItemComp';
import LoadingComp from '../others/LoadingComp';

export default function BibleRefItemRendererComp({
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
        <div className="w-100">
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
        </div>
    );
}
