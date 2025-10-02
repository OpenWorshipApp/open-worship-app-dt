import { Fragment } from 'react/jsx-runtime';
import BibleItem from '../bible-list/BibleItem';
import BibleViewTitleEditorComp from '../bible-reader/BibleViewTitleEditorComp';
import BibleCrossRefOpenAIItemRendererBodyComp from './BibleCrossRefOpenAIItemRendererBodyComp';
import BibleCrossRefItemRendererBodyComp from './BibleCrossRefItemRendererBodyComp';
import BibleCrossRefWrapperComp from './BibleCrossRefWrapperComp';
import BibleCrossRefAnthropicItemRendererBodyComp from './BibleCrossRefAnthropicItemRendererBodyComp';
import { useAISetting } from '../helper/ai/aiHelpers';

export default function BibleCrossRefRendererComp({
    bibleItem,
    setBibleItem,
}: Readonly<{
    bibleItem: BibleItem;
    setBibleItem: (bibleItem: BibleItem) => void;
}>) {
    const aiSetting = useAISetting();
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
                        <BibleCrossRefWrapperComp
                            title="Bible Reference"
                            settingName="show-standard-bible-ref"
                        >
                            <BibleCrossRefItemRendererBodyComp
                                bibleKey={bibleItem.bibleKey}
                                bookKey={book}
                                chapter={chapter}
                                verse={verse}
                                index={i}
                            />
                        </BibleCrossRefWrapperComp>
                        {aiSetting.anthropicAPIKey ? (
                            <BibleCrossRefWrapperComp
                                title="Anthropic Bible Reference"
                                settingName="show-ai-bible-ref"
                            >
                                <BibleCrossRefAnthropicItemRendererBodyComp
                                    bibleKey={bibleItem.bibleKey}
                                    bookKey={book}
                                    chapter={chapter}
                                    verse={verse}
                                    index={i}
                                />
                            </BibleCrossRefWrapperComp>
                        ) : null}
                        {aiSetting.openAIAPIKey ? (
                            <BibleCrossRefWrapperComp
                                title="OpenAI Bible Reference"
                                settingName="show-ai-bible-ref"
                            >
                                <BibleCrossRefOpenAIItemRendererBodyComp
                                    bibleKey={bibleItem.bibleKey}
                                    bookKey={book}
                                    chapter={chapter}
                                    verse={verse}
                                    index={i}
                                />
                            </BibleCrossRefWrapperComp>
                        ) : null}
                    </Fragment>
                );
            })}
        </>
    );
}
