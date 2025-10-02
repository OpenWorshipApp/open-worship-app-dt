import { Fragment } from 'react/jsx-runtime';
import BibleItem from '../bible-list/BibleItem';
import BibleViewTitleEditorComp from '../bible-reader/BibleViewTitleEditorComp';
import BibleCrossRefOpenAIItemRendererBodyComp from './BibleCrossRefOpenAIItemRendererBodyComp';
import BibleCrossRefItemRendererBodyComp from './BibleCrossRefItemRendererBodyComp';
import BibleCrossRefWrapperComp from './BibleCrossRefWrapperComp';
import BibleCrossRefAnthropicItemRendererBodyComp from './BibleCrossRefAnthropicItemRendererBodyComp';
import {
    defaultRefreshingRef,
    RefreshingRefType,
    useAISetting,
} from '../helper/ai/aiHelpers';
import { RefObject, useRef } from 'react';

export default function BibleCrossRefRendererComp({
    bibleItem,
    setBibleItem,
}: Readonly<{
    bibleItem: BibleItem;
    setBibleItem: (bibleItem: BibleItem) => void;
}>) {
    const normalRef = useRef<RefreshingRefType>(defaultRefreshingRef);
    const anthropicRef = useRef<RefreshingRefType>(defaultRefreshingRef);
    const openAIRef = useRef<RefreshingRefType>(defaultRefreshingRef);
    const aiSetting = useAISetting();
    const { bookKey: book, chapter, verseStart } = bibleItem.target;
    // TODO: support multiple verses
    const verses = [verseStart];
    const handleRefreshing = (ref: RefObject<RefreshingRefType | null>) => {
        if (ref.current !== null) {
            ref.current.refresh();
        }
    };
    return (
        <>
            {verses.map((verse, i) => {
                const cloneBibleItem = bibleItem.clone();
                cloneBibleItem.target.verseStart = verse;
                cloneBibleItem.target.verseEnd = verse;
                return (
                    <Fragment key={verse}>
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
                            onRefresh={handleRefreshing.bind(null, normalRef)}
                        >
                            <BibleCrossRefItemRendererBodyComp
                                ref={normalRef}
                                bibleKey={bibleItem.bibleKey}
                                bookKey={book}
                                chapter={chapter}
                                verse={verse}
                                index={i}
                            />
                        </BibleCrossRefWrapperComp>
                        {aiSetting.anthropicAPIKey ? (
                            <BibleCrossRefWrapperComp
                                title={
                                    <>
                                        <i className="bi bi-robot" /> Anthropic
                                        Bible Reference
                                    </>
                                }
                                settingName="show-ai-bible-ref"
                                onRefresh={handleRefreshing.bind(
                                    null,
                                    anthropicRef,
                                )}
                            >
                                <BibleCrossRefAnthropicItemRendererBodyComp
                                    ref={anthropicRef}
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
                                title={
                                    <>
                                        <i className="bi bi-robot" /> OpenAI
                                        Bible Reference
                                    </>
                                }
                                settingName="show-ai-bible-ref"
                                onRefresh={handleRefreshing.bind(
                                    null,
                                    openAIRef,
                                )}
                            >
                                <BibleCrossRefOpenAIItemRendererBodyComp
                                    ref={openAIRef}
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
