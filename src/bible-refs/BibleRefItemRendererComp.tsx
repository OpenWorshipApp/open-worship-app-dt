import LoadingComp from '../others/LoadingComp';
import { useGetBibleRefAI } from '../helper/aiHelpers';
import BibleRefRenderFoundItemComp, {
    BibleRefAIRenderFoundItemComp,
} from './BibleRefRenderFoundItemComp';
import { useGetBibleRef } from './bibleRefsHelpers';

function BibleRefAIItemRendererBodyComp({
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
    const bibleRef = useGetBibleRefAI(bookKey, chapter, verse);
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
            {bibleRef.map((item, i) => {
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

export function BibleRefAIItemRendererComp({
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
    return (
        <div className="card w-100 my-1">
            <div className="card-header alert alert-secondary">
                <h5 className="mb-0">AI Bible Reference</h5>
            </div>
            <div className="card-body">
                <BibleRefAIItemRendererBodyComp
                    bibleKey={bibleKey}
                    bookKey={bookKey}
                    chapter={chapter}
                    verse={verse}
                    index={index}
                />
            </div>
        </div>
    );
}

function BibleRefItemRendererBodyComp({
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
    return (
        <div className="card w-100 my-1">
            <div className="card-header alert alert-secondary">
                <h5 className="mb-0">Bible Reference</h5>
            </div>
            <div className="card-body">
                <BibleRefItemRendererBodyComp
                    bibleKey={bibleKey}
                    bookKey={bookKey}
                    chapter={chapter}
                    verse={verse}
                    index={index}
                />
            </div>
        </div>
    );
}
