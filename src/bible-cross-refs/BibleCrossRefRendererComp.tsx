import { useCallback, type RefObject } from 'react';
import { useRef } from 'react';
import { Fragment } from 'react/jsx-runtime';

import type BibleItem from '../bible-list/BibleItem';
import SelectedBibleVerseHeaderComp from '../bible-reader/SelectedBibleVerseHeaderComp';
import BibleCrossRefOpenAIItemRendererBodyComp from './BibleCrossRefOpenAIItemRendererBodyComp';
import BibleCrossRefWrapperComp from './BibleCrossRefWrapperComp';
import BibleCrossRefAnthropicItemRendererBodyComp from './BibleCrossRefAnthropicItemRendererBodyComp';
import type { RefreshingRefType } from '../helper/ai/aiHelpers';
import { useAvailable as useOpenAIAvailable } from '../helper/ai/openAIHelpers';
import {
    BibleKeyContext,
    defaultRefreshingRef,
} from '../helper/ai/bibleCrossRefHelpers';
import { useAvailable as useAnthropicAvailable } from '../helper/ai/anthropicHelpers';
import { tran } from '../lang/langHelpers';
import BibleCrossRefAIItemRendererBodyComp from './BibleCrossRefAIItemRendererBodyComp';
import appProvider from '../server/appProvider';

function genAiVigilant() {
    return (
        <i
            className="bi bi-lightbulb app-caught-hover-pointer"
            title={
                tran('Generated using AI technology.') +
                ' Results may vary and may not be ' +
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
    const handleRefreshing = useCallback(
        (ref: RefObject<RefreshingRefType | null>) => {
            if (ref.current !== null) {
                ref.current.refresh();
            }
        },
        [],
    );
    const bibleKey = bibleItem.bibleKey;
    return (
        <BibleKeyContext.Provider value={bibleKey}>
            {verses.map((verse, i) => {
                const cloneBibleItem = bibleItem.clone();
                cloneBibleItem.target.verseStart = verse;
                cloneBibleItem.target.verseEnd = verse;
                return (
                    <Fragment key={verse}>
                        <SelectedBibleVerseHeaderComp
                            bibleItem={cloneBibleItem}
                            onBibleKeyChange={(newBibleKey) => {
                                const newBibleItem = bibleItem.clone();
                                newBibleItem.bibleKey = newBibleKey;
                                setBibleItem(newBibleItem);
                            }}
                            onTargetChange={(newBibleTarget) => {
                                cloneBibleItem.target = newBibleTarget;
                                setBibleItem(cloneBibleItem);
                            }}
                        />
                        <hr />
                        <div className="d-flex flex-wrap">
                            <BibleCrossRefWrapperComp
                                title={
                                    <>
                                        {genAiVigilant()}
                                        AI {tran('Cross References')}
                                    </>
                                }
                                settingName="show-standard-bible-ref"
                                onRefresh={handleRefreshing.bind(
                                    null,
                                    normalRef,
                                )}
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
                        </div>
                    </Fragment>
                );
            })}
        </BibleKeyContext.Provider>
    );
}
