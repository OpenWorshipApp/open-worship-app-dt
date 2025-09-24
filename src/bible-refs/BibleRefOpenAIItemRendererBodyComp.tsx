import LoadingComp from '../others/LoadingComp';
import { useGetBibleRefOpenAI } from '../helper/aiHelpers';
import BibleRefAIRenderFoundItemComp from './BibleRefAIRenderFoundItemComp';

export default function BibleRefOpenAIItemRendererBodyComp({
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
    const bibleRef = useGetBibleRefOpenAI(bookKey, chapter, verse);
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
            {bibleRef.map((item, i) => {
                return (
                    <BibleRefAIRenderFoundItemComp
                        key={item + i}
                        bibleKey={bibleKey}
                        bibleVersesKey={item}
                    />
                );
            })}
        </>
    );
}
