import { Fragment } from 'react';

import type { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderCustomVerseComp from '../RenderCustomVerseComp';
import AudioPlayerComp from './AudioPlayerComp';
import { HoverMotionHandler } from '../../helper/domHelpers';

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
    const { bibleKey, text, customText, bibleVersesKey, isRtl, style } =
        verseInfo;
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
                <div
                    className="text d-flex"
                    data-bible-key={bibleKey}
                    style={style}
                >
                    <div
                        className={
                            'app-top-hover-motion-10 flex-fill' +
                            (isRtl ? ' rtl' : '')
                        }
                    >
                        {textElement}
                        <span
                            className={`text-muted px-1 ${HoverMotionHandler.lowVisibleClassname}-10`}
                            style={{
                                fontSize: '0.8em',
                                opacity: '0.6',
                            }}
                        >
                            {bibleKey}
                        </span>
                    </div>
                </div>
            ) : (
                <span data-bible-key={bibleKey} style={style}>
                    {textElement}
                </span>
            )}
        </Fragment>
    );
}
