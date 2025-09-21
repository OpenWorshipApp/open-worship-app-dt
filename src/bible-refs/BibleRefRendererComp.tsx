import BibleItem from '../bible-list/BibleItem';
import BibleViewTitleEditorComp from '../bible-reader/BibleViewTitleEditorComp';
import BibleRefItemRendererComp, {
    BibleRefAIItemRendererComp,
} from './BibleRefItemRendererComp';

export default function BibleRefRendererComp({
    bibleItem,
    setBibleItem,
}: Readonly<{
    bibleItem: BibleItem;
    setBibleItem: (bibleItem: BibleItem) => void;
}>) {
    const { bookKey: book, chapter, verseStart } = bibleItem.target;
    // TODO: support multiple verses
    const arr = [verseStart];
    return (
        <div className="w-100">
            <div
                className="alert alert-info p-1"
                data-bible-key={bibleItem.bibleKey}
            >
                ({bibleItem.bibleKey}){' '}
                <BibleViewTitleEditorComp
                    bibleItem={bibleItem}
                    // TODO: support multiple verses
                    isOneVerse
                    onTargetChange={(newBibleTarget) => {
                        const newBibleItem = bibleItem.clone();
                        newBibleItem.target = newBibleTarget;
                        setBibleItem(newBibleItem);
                    }}
                />
            </div>
            {arr.map((verse, i) => {
                return (
                    <>
                        <BibleRefItemRendererComp
                            key={`verse-${verse}`}
                            bibleKey={bibleItem.bibleKey}
                            bookKey={book}
                            chapter={chapter}
                            verse={verse}
                            index={i}
                        />
                        <hr key={`hr-${verse}`} />
                        <center key={`ai-title-${verse}`}>AI</center>
                        <BibleRefAIItemRendererComp
                            key={`ai-verse-${verse}`}
                            bibleKey={bibleItem.bibleKey}
                            bookKey={book}
                            chapter={chapter}
                            verse={verse}
                            index={i}
                        />
                    </>
                );
            })}
        </div>
    );
}
