import { Fragment } from 'react';

import type { CompiledVerseType } from '../../bible-list/bibleRenderHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import RenderCustomVerseComp from '../RenderCustomVerseComp';
import AudioPlayerComp from './AudioPlayerComp';
import { HoverMotionHandler } from '../../helper/domHelpers';
import RenderVerseLookupTextComp from '../../location-name-lookup/RenderVerseLookupTextComp';
import RenderCustomVerseLookupComp from '../../location-name-lookup/RenderCustomVerseLookupComp';
import { checkCanLookupVerseText } from '../../location-name-lookup/verseTextIndexHelpers';

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
    // Only mounted when the text can actually carry matches: mounting it is what
    // subscribes to — and therefore loads — the in-text lookup index. Keyed on
    // THIS row's bible, so in a multi-version view only the KJV column decorates.
    const canLookupText = checkCanLookupVerseText(bibleKey);
    let textElement;
    if (customText !== null) {
        // Custom HTML still gets decorated — the words-of-Christ markup makes
        // most gospel verses "custom", so skipping them would leave the feature
        // absent exactly where the names are densest.
        textElement = canLookupText ? (
            <RenderCustomVerseLookupComp
                bibleItem={bibleItem}
                customHtml={customText}
                kjvShortVerse={verseInfo.kjvBibleVersesKey}
            />
        ) : (
            <RenderCustomVerseComp
                bibleItem={bibleItem}
                customHtml={customText}
            />
        );
    } else if (canLookupText) {
        textElement = (
            <RenderVerseLookupTextComp
                text={text}
                kjvShortVerse={verseInfo.kjvBibleVersesKey}
            />
        );
    } else {
        textElement = text;
    }
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
                    data-dict-locale={verseInfo.locale}
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
                            className={
                                `text-muted px-1 ` +
                                `${HoverMotionHandler.lowVisibleClassname}-10`
                            }
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
                <span style={style} data-dict-locale={verseInfo.locale}>
                    {textElement}
                </span>
            )}
        </Fragment>
    );
}
