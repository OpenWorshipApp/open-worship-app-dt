import { useGetBibleCrossRefOpenAI } from '../helper/ai/openAIBibleCrossRefHelpers';
import LoadingComp from '../others/LoadingComp';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

export default function BibleCrossRefOpenAIItemRendererBodyComp({
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
    const bibleCrossRef = useGetBibleCrossRefOpenAI(bookKey, chapter, verse);
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
            {bibleCrossRef.map((item, i) => {
                return (
                    <BibleCrossRefAIRenderFoundItemComp
                        key={item + i}
                        bibleKey={bibleKey}
                        bibleVersesKey={item}
                    />
                );
            })}
        </>
    );
}
