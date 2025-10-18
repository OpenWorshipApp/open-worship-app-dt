import { Fragment } from 'react/jsx-runtime';
import BibleItem from '../bible-list/BibleItem';
import BibleViewTitleEditorComp from '../bible-reader/BibleViewTitleEditorComp';
import BibleCrossRefOpenAIItemRendererBodyComp from './BibleCrossRefOpenAIItemRendererBodyComp';
import BibleCrossRefWrapperComp from './BibleCrossRefWrapperComp';
import BibleCrossRefAnthropicItemRendererBodyComp from './BibleCrossRefAnthropicItemRendererBodyComp';
import { RefreshingRefType } from '../helper/ai/aiHelpers';
import { useAvailable as useOpenAIAvailable } from '../helper/ai/openAIHelpers';
import { RefObject, useRef } from 'react';
import {
    BibleKeyContext,
    defaultRefreshingRef,
} from '../helper/ai/bibleCrossRefHelpers';
import { useAvailable as useAnthropicAvailable } from '../helper/ai/anthropicHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { BibleSelectionMiniComp } from '../bible-lookup/BibleSelectionComp';
import BibleCrossRefAIItemRendererBodyComp from './BibleCrossRefAIItemRendererBodyComp';
import appProvider from '../server/appProvider';

function RenderVerseTextComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const [text] = useAppStateAsync(() => {
        return bibleItem.toText();
    }, [bibleItem]);
    return (
        <div
            data-bible-key={bibleItem.bibleKey}
            style={{
                maxHeight: '75px',
                overflow: 'auto',
            }}
        >
            {text}
        </div>
    );
}

function AIVigilantComp() {
    return (
        <i
            className="bi bi-lightbulb app-caught-hover-pointer"
            title={
                '`Generated using AI technology. ' +
                'Results may vary and may not be ' +
                'accurate. Please use with caution.'
            }
            style={{
                color: 'var(--bs-info-text-emphasis)',
            }}
            onClick={(event) => {
                event.stopPropagation();
                appProvider.browserUtils.openExternalURL(
                    `${appProvider.appInfo.homepage}/ai-vigilant`,
                );
            }}
        />
    );
}

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
    const bibleKey = bibleItem.bibleKey;
    return (
        <BibleKeyContext.Provider value={bibleKey}>
            {verses.map((verse, i) => {
                const cloneBibleItem = bibleItem.clone();
                cloneBibleItem.target.verseStart = verse;
                cloneBibleItem.target.verseEnd = verse;
                return (
                    <Fragment key={verse}>
                        <div
                            className="m-1 p-1"
                            data-bible-key={cloneBibleItem.bibleKey}
                        >
                            <div
                                className="alert alert-info p-0 px-1 m-0"
                                style={{ verticalAlign: 'center' }}
                            >
                                <BibleSelectionMiniComp
                                    bibleKey={bibleItem.bibleKey}
                                    onBibleKeyChange={(
                                        _isContextMenu,
                                        _oldValue,
                                        newValue,
                                    ) => {
                                        const newBibleItem = bibleItem.clone();
                                        newBibleItem.bibleKey = newValue;
                                        setBibleItem(newBibleItem);
                                    }}
                                    contextMenuTitle="`Add Extra Bible"
                                />
                                <BibleViewTitleEditorComp
                                    bibleItem={cloneBibleItem}
                                    isOneVerse
                                    onTargetChange={(newBibleTarget) => {
                                        cloneBibleItem.target = newBibleTarget;
                                        setBibleItem(cloneBibleItem);
                                    }}
                                    waitUntilGotVerseStart
                                />
                            </div>
                            <RenderVerseTextComp bibleItem={cloneBibleItem} />
                        </div>
                        <hr />
                        <BibleCrossRefWrapperComp
                            title={
                                <>
                                    <AIVigilantComp />
                                    AI Cross References
                                </>
                            }
                            settingName="show-standard-bible-ref"
                            onRefresh={handleRefreshing.bind(null, normalRef)}
                        >
                            <BibleCrossRefAIItemRendererBodyComp
                                ref={normalRef}
                                aiType="anthropic"
                                bibleKey={bibleKey}
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
                                        <i className="bi bi-robot" /> Custom
                                        OpenAI
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
                                        <i className="bi bi-robot" /> Custom
                                        Anthropic
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
        </BibleKeyContext.Provider>
    );
}
