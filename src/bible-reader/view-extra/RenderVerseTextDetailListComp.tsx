import type { RefObject } from 'react';
import { useCallback } from 'react';

import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import type { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import type LookupBibleItemController from '../LookupBibleItemController';
import type BibleItem from '../../bible-list/BibleItem';
import {
    bibleTextToSpeech,
    useIsAudioAIEnabled,
} from '../../helper/ai/openAIAudioHelpers';
import RenderVerseTextViewComp from './RenderVerseTextViewComp';
import { getAISetting } from '../../helper/ai/aiHelpers';
import { checkIsVerticalPartialInvisible } from '../../helper/helpers';
import appProvider from '../../server/appProvider';
import { useAppCurrentRef } from '../../helper/appHooks';

function handleNextChapterSelection(
    lookupBibleItemController: LookupBibleItemController,
    targetElement: HTMLDivElement,
) {
    targetElement.click();
    lookupBibleItemController.shouldSelectFirstItem = true;
    lookupBibleItemController.tryJumpingChapter(true);
}

function handleNextVersionSelection(
    currentTarget: HTMLDivElement,
    nextKjvVerseKey: string,
) {
    const audioAISetting = getAISetting();
    if (!audioAISetting.isAutoPlay || !appProvider.isPageReader) {
        return;
    }
    const parentElement = currentTarget.parentElement;
    if (parentElement === null) {
        return;
    }
    const nextTarget = parentElement.querySelector(
        `[data-kjv-verse-key="${nextKjvVerseKey}"]`,
    );
    if (!(nextTarget instanceof HTMLDivElement)) {
        return;
    }
    if (
        nextTarget.parentElement?.parentElement &&
        checkIsVerticalPartialInvisible(
            nextTarget.parentElement.parentElement,
            nextTarget,
        )
    ) {
        const dblclickEvent = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
        });
        nextTarget.dispatchEvent(dblclickEvent);
    } else {
        nextTarget.click();
    }
}

export default function RenderVerseTextDetailListComp({
    bibleItem,
    verseInfo,
    nextVerseInfo,
    extraVerseInfoList = [],
    verseTextRef,
    audioSrcMap,
    refreshAudio,
    isExtraVerses,
}: Readonly<{
    bibleItem: BibleItem;
    verseInfo: CompiledVerseType;
    nextVerseInfo: CompiledVerseType | null;
    extraVerseInfoList?: CompiledVerseType[];
    verseTextRef: RefObject<HTMLDivElement | null>;
    audioSrcMap: { [key: string]: string | undefined | null };
    refreshAudio: () => void;
    isExtraVerses: boolean;
}>) {
    const { isAudioEnabled } = useIsAudioAIEnabled(bibleItem);
    const bibleItemViewController = useBibleItemsViewControllerContext();
    const verseInfoList = [verseInfo, ...extraVerseInfoList];
    const nextVerseInfoRef = useAppCurrentRef(nextVerseInfo);
    const handleAudioStarting = useCallback(() => {
        if (nextVerseInfoRef.current === null) {
            return;
        }
        bibleTextToSpeech(nextVerseInfoRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const verseTextRefRef = useAppCurrentRef(verseTextRef);
    const verseInfoRef = useAppCurrentRef(verseInfo);
    const bibleItemViewControllerRef = useAppCurrentRef(
        bibleItemViewController,
    );
    const handleAudioEnding = useCallback(() => {
        const verseTextElement = verseTextRefRef.current.current;
        if (verseTextElement === null) {
            return;
        }
        if (
            verseInfoRef.current.isLast &&
            bibleItemViewControllerRef.current.isLookup
        ) {
            handleNextChapterSelection(
                bibleItemViewControllerRef.current as LookupBibleItemController,
                verseTextElement,
            );
        }
        if (nextVerseInfoRef.current === null) {
            return;
        }
        handleNextVersionSelection(
            verseTextElement,
            nextVerseInfoRef.current.kjvBibleVersesKey,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return verseInfoList.map((verseInfo) => {
        return (
            <RenderVerseTextViewComp
                key={verseInfo.bibleKey}
                bibleItem={bibleItem}
                verseInfo={verseInfo}
                isAudioEnabled={isAudioEnabled}
                isExtraVerses={isExtraVerses}
                audioSrcMap={audioSrcMap}
                refreshAudio={refreshAudio}
                handleAudioStarting={handleAudioStarting}
                handleAudioEnding={handleAudioEnding}
            />
        );
    });
}
