import { Fragment } from 'react';

import { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderCustomVerseComp from '../RenderCustomVerseComp';
import AudioPlayerComp from './AudioPlayerComp';

export default function RenderVerseTextViewComp({
    bibleItem,
    verseInfo,
    isAudioEnabled,
    isExtraVerses,
    audioSrcMap,
    refreshAudio,
    handleAudioStarting,
    handleAudioEnding,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    verseInfo: CompiledVerseType;
    isAudioEnabled: boolean;
    isExtraVerses: boolean;
    audioSrcMap: { [key: string]: string | undefined | null };
    refreshAudio: () => void;
    handleAudioStarting: () => void;
    handleAudioEnding: () => void;
}>) {
    const { bibleKey, text, customText, bibleVersesKey, isRtl } = verseInfo;
    const textElement =
        customText === null ? (
            text
        ) : (
            <RenderCustomVerseComp
                bibleItem={bibleItem}
                customHtml={customText}
            />
        );
    return (
        <Fragment key={bibleKey}>
            {isAudioEnabled &&
            Object.keys(audioSrcMap).includes(bibleVersesKey) ? (
                <AudioPlayerComp
                    src={audioSrcMap[bibleVersesKey]}
                    onStart={handleAudioStarting}
                    onEnd={handleAudioEnding}
                    refreshAudio={refreshAudio}
                />
            ) : null}
            {isExtraVerses ? (
                <div className="text d-flex" data-bible-key={bibleKey}>
                    <div className={'flex-fill' + (isRtl ? ' rtl' : '')}>
                        {textElement}
                    </div>
                </div>
            ) : (
                <span data-bible-key={bibleKey}>{textElement}</span>
            )}
        </Fragment>
    );
}
