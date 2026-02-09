import { useRef, useState } from 'react';

import { VERSE_TEXT_CLASS } from '../../helper/bibleViewHelpers';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import type { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { getSelectedText } from '../../helper/textSelectionHelpers';
import FileSource from '../../helper/FileSource';
import {
    bibleTextToSpeech,
    checkIsAIAudioAvailableForBible,
} from '../../helper/ai/openAIAudioHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderVerseTextDetailListComp from './RenderVerseTextDetailListComp';

export default function RenderVerseTextDetailComp({
    bibleItem,
    verseInfo,
    nextVerseInfo,
    extraVerseInfoList = [],
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    verseInfo: CompiledVerseType;
    nextVerseInfo: CompiledVerseType | null;
    extraVerseInfoList?: CompiledVerseType[];
    index: number;
}>) {
    const bibleItemViewController = useBibleItemsViewControllerContext();
    const verseTextRef = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        if (
            verseInfo.isFirst &&
            verseTextRef.current !== null &&
            bibleItemViewController.shouldSelectFirstItem
        ) {
            bibleItemViewController.shouldSelectFirstItem = false;
            verseTextRef.current.click();
        }
    }, [verseTextRef.current, verseInfo]);
    const [audioSrcMap, setAudioSrcMap] = useState<{
        [key: string]: string | undefined | null;
    }>({});
    const setAudioSrcMap1 = (key: string, value: string | undefined | null) => {
        setAudioSrcMap((oldAudioSrcMap) => {
            return {
                ...oldAudioSrcMap,
                [key]: value,
            };
        });
    };
    const viewController = useBibleItemsViewControllerContext();
    const isExtraVerses = extraVerseInfoList.length > 0;
    const loadAudio = async (isForce?: boolean) => {
        const isAudioEnabled = await checkIsAIAudioAvailableForBible(bibleItem);
        if (!isAudioEnabled) {
            return;
        }
        const { bibleVersesKey } = verseInfo;
        setAudioSrcMap1(bibleVersesKey, undefined);
        const speechFile = await bibleTextToSpeech(verseInfo, isForce);
        if (speechFile === null) {
            setAudioSrcMap1(bibleVersesKey, null);
            return;
        }
        setAudioSrcMap1(bibleVersesKey, FileSource.getInstance(speechFile).src);
    };
    const handleVerseClicking = (event: any) => {
        if (getSelectedText()) {
            return;
        }
        viewController.handleVersesSelecting(
            event.currentTarget,
            event.altKey,
            false,
            bibleItem,
        );
        loadAudio();
    };
    const handleVerseDBClicking = (event: any) => {
        event.stopPropagation();
        event.preventDefault();
        const selection = globalThis.getSelection();
        if (selection !== null && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
        viewController.handleVersesSelecting(
            event.currentTarget,
            true,
            false,
            bibleItem,
        );
        loadAudio();
    };
    const handleAudioRefreshing = () => {
        loadAudio(true);
    };
    return (
        <div
            ref={verseTextRef}
            className={
                VERSE_TEXT_CLASS + (isExtraVerses ? ' extra-verses' : '')
            }
            data-kjv-verse-key={verseInfo.kjvBibleVersesKey}
            data-verse-key={verseInfo.bibleVersesKey}
            data-is-first={verseInfo.isFirst ? '1' : '0'}
            data-is-last={verseInfo.isLast ? '1' : '0'}
            onClick={handleVerseClicking}
            onDoubleClick={handleVerseDBClicking}
        >
            <RenderVerseTextDetailListComp
                bibleItem={bibleItem}
                verseInfo={verseInfo}
                nextVerseInfo={nextVerseInfo}
                extraVerseInfoList={extraVerseInfoList}
                verseTextRef={verseTextRef}
                audioSrcMap={audioSrcMap}
                refreshAudio={handleAudioRefreshing}
                isExtraVerses={isExtraVerses}
            />
        </div>
    );
}
