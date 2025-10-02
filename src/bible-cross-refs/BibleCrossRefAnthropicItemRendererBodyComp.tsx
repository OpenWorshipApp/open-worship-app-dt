import {
    CrossReferenceType,
    useGetBibleCrossRefAnthropic,
} from '../helper/ai/anthropicBibleCrossRefHelpers';
import LoadingComp from '../others/LoadingComp';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';

function RenderCrossReferenceComp({
    crossReference,
    bibleKey,
}: Readonly<{
    crossReference: CrossReferenceType;
    bibleKey: string;
}>) {
    return (
        <div>
            <hr />
            <strong style={{ color: '#88ff00b8' }}>
                {crossReference.title}
            </strong>
            {crossReference.verses.map((item, i) => {
                return (
                    <BibleCrossRefAIRenderFoundItemComp
                        key={item + i}
                        bibleKey={bibleKey}
                        bibleVersesKey={item}
                    />
                );
            })}
        </div>
    );
}

export default function BibleCrossRefAnthropicItemRendererBodyComp({
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
    const bibleCrossRef = useGetBibleCrossRefAnthropic(bookKey, chapter, verse);
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
                    <RenderCrossReferenceComp
                        key={item.title}
                        crossReference={item}
                        bibleKey={bibleKey}
                    />
                );
            })}
        </>
    );
}
