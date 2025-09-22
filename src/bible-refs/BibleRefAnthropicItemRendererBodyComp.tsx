import LoadingComp from '../others/LoadingComp';
import BibleRefAIRenderFoundItemComp from './BibleRefAIRenderFoundItemComp';
import {
    CrossReferenceType,
    useGetBibleRefAnthropic,
} from '../helper/anthropicBibleCrossHelpers';

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
            <strong>{crossReference.title}</strong>
            {crossReference.verses.map((item, i) => {
                return (
                    <BibleRefAIRenderFoundItemComp
                        key={item + i}
                        bibleKey={bibleKey}
                        bibleVersesKey={item}
                    />
                );
            })}
        </div>
    );
}

export default function BibleRefAnthropicItemRendererBodyComp({
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
    const bibleRef = useGetBibleRefAnthropic(bookKey, chapter, verse);
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
            {bibleRef.map((item) => {
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
