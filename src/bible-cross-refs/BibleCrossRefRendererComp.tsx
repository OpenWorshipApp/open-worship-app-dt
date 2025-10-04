import { Fragment } from 'react/jsx-runtime';
import BibleItem from '../bible-list/BibleItem';
import BibleViewTitleEditorComp from '../bible-reader/BibleViewTitleEditorComp';
import BibleCrossRefOpenAIItemRendererBodyComp from './BibleCrossRefOpenAIItemRendererBodyComp';
import BibleCrossRefItemRendererBodyComp from './BibleCrossRefItemRendererBodyComp';
import BibleCrossRefWrapperComp from './BibleCrossRefWrapperComp';
import BibleCrossRefAnthropicItemRendererBodyComp from './BibleCrossRefAnthropicItemRendererBodyComp';
import { RefreshingRefType } from '../helper/ai/aiHelpers';
import { useAvailable as useOpenAIAvailable } from '../helper/ai/openAIHelpers';
import { RefObject, useRef } from 'react';
import { defaultRefreshingRef } from '../helper/ai/bibleCrossRefHelpers';
import { useAvailable as useAnthropicAvailable } from '../helper/ai/anthropicHelpers';

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
    const isOpenAIAvailable = useOpenAIAvailable();
    const isAnthropicAvailable = useAnthropicAvailable();
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
                            title="Open Worship"
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
                        {isOpenAIAvailable ? (
                            <BibleCrossRefWrapperComp
                                title={
                                    <>
                                        <i className="bi bi-robot" /> OpenAI
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
                        {isAnthropicAvailable ? (
                            <BibleCrossRefWrapperComp
                                title={
                                    <>
                                        <i className="bi bi-robot" /> Anthropic
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
                    </Fragment>
                );
            })}
        </>
    );
}
