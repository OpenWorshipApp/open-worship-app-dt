import { RefObject } from 'react';

import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import LookupBibleItemController from '../LookupBibleItemController';
import BibleItem from '../../bible-list/BibleItem';
import {
    bibleTextToSpeech,
    useIsAudioAIEnabled,
} from '../../helper/ai/openAIAudioHelpers';
import RenderVerseTextViewComp from './RenderVerseTextViewComp';
import { getAISetting } from '../../helper/ai/aiHelpers';
import { checkIsVerticalPartialInvisible } from '../../helper/helpers';
import appProvider from '../../server/appProvider';

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
    const handleAudioStarting = () => {
        if (nextVerseInfo === null) {
            return;
        }
        bibleTextToSpeech(nextVerseInfo);
    };
    const handleAudioEnding = () => {
        if (verseTextRef.current === null) {
            return;
        }
        if (verseInfo.isLast && bibleItemViewController.isLookup) {
            handleNextChapterSelection(
                bibleItemViewController as LookupBibleItemController,
                verseTextRef.current,
            );
        }
        if (nextVerseInfo === null) {
            return;
        }
        handleNextVersionSelection(
            verseTextRef.current,
            nextVerseInfo.kjvBibleVersesKey,
        );
    };
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
