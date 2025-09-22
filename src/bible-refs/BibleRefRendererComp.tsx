import { Fragment } from 'react/jsx-runtime';
import BibleItem from '../bible-list/BibleItem';
import BibleViewTitleEditorComp from '../bible-reader/BibleViewTitleEditorComp';
import BibleRefOpenAIItemRendererBodyComp from './BibleRefOpenAIItemRendererBodyComp';
import BibleRefItemRendererBodyComp from './BibleRefItemRendererBodyComp';
import BibleRefWrapperComp from './BibleRefWrapperComp';
import BibleRefAnthropicItemRendererBodyComp from './BibleRefAnthropicItemRendererBodyComp';

export default function BibleRefRendererComp({
    bibleItem,
    setBibleItem,
}: Readonly<{
    bibleItem: BibleItem;
    setBibleItem: (bibleItem: BibleItem) => void;
}>) {
    const { bookKey: book, chapter, verseStart } = bibleItem.target;
    // TODO: support multiple verses
    const verses = [verseStart];
    return (
        <>
            {verses.map((verse, i) => {
                const cloneBibleItem = bibleItem.clone();
                cloneBibleItem.target.verseStart = verse;
                cloneBibleItem.target.verseEnd = verse;
                return (
                    <Fragment key={verse}>
                        <hr />
                        <div
                            className="alert alert-info m-1 p-1"
                            data-bible-key={cloneBibleItem.bibleKey}
                        >
                            ({cloneBibleItem.bibleKey}){' '}
                            <BibleViewTitleEditorComp
                                bibleItem={cloneBibleItem}
                                isOneVerse
                                onTargetChange={(newBibleTarget) => {
                                    cloneBibleItem.target = newBibleTarget;
                                    setBibleItem(cloneBibleItem);
                                }}
                            />
                        </div>
                        <hr />
                        <BibleRefWrapperComp
                            title="Bible Reference"
                            settingName="show-standard-bible-ref"
                        >
                            <BibleRefItemRendererBodyComp
                                bibleKey={bibleItem.bibleKey}
                                bookKey={book}
                                chapter={chapter}
                                verse={verse}
                                index={i}
                            />
                        </BibleRefWrapperComp>
                        <BibleRefWrapperComp
                            title="Anthropic Bible Reference"
                            settingName="show-ai-bible-ref"
                        >
                            <BibleRefAnthropicItemRendererBodyComp
                                bibleKey={bibleItem.bibleKey}
                                bookKey={book}
                                chapter={chapter}
                                verse={verse}
                                index={i}
                            />
                        </BibleRefWrapperComp>
                        <BibleRefWrapperComp
                            title="OpenAI Bible Reference"
                            settingName="show-ai-bible-ref"
                        >
                            <BibleRefOpenAIItemRendererBodyComp
                                bibleKey={bibleItem.bibleKey}
                                bookKey={book}
                                chapter={chapter}
                                verse={verse}
                                index={i}
                            />
                        </BibleRefWrapperComp>
                    </Fragment>
                );
            })}
        </>
    );
}
