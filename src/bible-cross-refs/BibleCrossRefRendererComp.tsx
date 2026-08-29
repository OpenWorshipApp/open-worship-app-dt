import { useCallback, type RefObject } from 'react';
import { useRef } from 'react';
import { Fragment } from 'react/jsx-runtime';

import './BibleCrossRefComp.scss';

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

// Says a model wrote the text below, and opens the page that explains what that
// means for accuracy. `bi-cpu` rather than the lightbulb it shared with the
// translation note: one glyph cannot carry two different claims.
function genAiVigilant() {
    const label =
        tran('Generated using AI technology.') +
        ' Results may vary and may not be ' +
        'accurate. Please use with caution.';
    return (
        <button
            type="button"
            className="app-xref-note bi bi-cpu"
            title={label}
            aria-label={label}
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
                        <div className="app-xref-panel">
                            <BibleCrossRefWrapperComp
                                title={`AI ${tran('Cross References')}`}
                                note={genAiVigilant()}
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
                                    title="Custom OpenAI"
                                    note={genAiVigilant()}
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
                                    title="Custom Anthropic"
                                    note={genAiVigilant()}
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
