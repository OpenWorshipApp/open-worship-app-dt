import { Fragment, useMemo } from 'react';

import { showGraphPreviewContextMenu } from '../graph-view/graphContextMenuHelpers';
import { DEFAULT_LANG_CODE } from '../lang/langHelpers';
import { openDetailPanel } from './detailPanelHelpers';
import {
    findLookupTextMatches,
    toVerseTextSegmentList,
    useLookupTextIndex,
    type LookupTextMatchType,
} from './verseTextIndexHelpers';
import {
    findTranslatedLookupMatches,
    useLookupTextNeedles,
} from './verseTextTranslatedHelpers';

export const VERSE_LOOKUP_LINK_CLASS = 'verse-lookup-link';

export function handleMatchClicking(
    event: { stopPropagation: () => void },
    match: LookupTextMatchType,
) {
    // The verse container turns a click into a verse selection; opening a record
    // is a different intent and must not do both.
    event.stopPropagation();
    // A click that ends a drag-selection is the user selecting text that happens
    // to end on a name, not a request to open it.
    const selection = globalThis.getSelection();
    if (selection !== null && !selection.isCollapsed) {
        return;
    }
    openDetailPanel({
        kind: match.kind,
        target: match.recordId,
        // Provisional title until the full record resolves in the panel.
        name: match.text,
    });
}

/**
 * How to find the names in one verse of one bible, or null while the files it
 * needs are still loading.
 *
 * Both render paths below take their matcher from here so the choice between
 * English and a translation is made once. Both stores are subscribed
 * unconditionally — the needles one with an empty code on the English path,
 * which subscribes to nothing — because the language changes when the reader
 * switches bibles and a conditional hook cannot survive that.
 *
 * The index is needed either way: it carries the record ids and the verse
 * evidence, neither of which is per-language.
 */
export function useVerseLookupMatcher(
    lookupLangCode: string,
    kjvShortVerse: string,
) {
    const isTranslated = lookupLangCode !== DEFAULT_LANG_CODE;
    const lookupTextIndex = useLookupTextIndex();
    const lookupTextNeedles = useLookupTextNeedles(
        isTranslated ? lookupLangCode : '',
    );
    return useMemo(() => {
        if (lookupTextIndex === null) {
            return null;
        }
        if (!isTranslated) {
            return (text: string) => {
                return findLookupTextMatches(
                    lookupTextIndex,
                    text,
                    kjvShortVerse,
                );
            };
        }
        if (lookupTextNeedles === null) {
            return null;
        }
        return (text: string) => {
            return findTranslatedLookupMatches(
                lookupTextIndex,
                lookupTextNeedles,
                text,
                kjvShortVerse,
            );
        };
    }, [lookupTextIndex, lookupTextNeedles, isTranslated, kjvShortVerse]);
}

/**
 * Verse text with every unambiguously identified name and location made
 * clickable.
 *
 * Matches are rendered as plain `span`s, NOT buttons: `.app-selectable-text`
 * forces `user-select: none` onto `button` and `[role="button"]` descendants
 * (see `others/appInit.scss`), which would silently drop every name out of a
 * copied verse. Keeping them as spans leaves selection and copying byte-for-byte
 * identical to undecorated text.
 */
export default function RenderVerseLookupTextComp({
    text,
    kjvShortVerse,
    lookupLangCode,
}: Readonly<{
    text: string;
    kjvShortVerse: string;
    lookupLangCode: string;
}>) {
    const findMatchList = useVerseLookupMatcher(lookupLangCode, kjvShortVerse);
    const segmentList = useMemo(() => {
        if (findMatchList === null || text === '') {
            return null;
        }
        return toVerseTextSegmentList(text, findMatchList(text));
    }, [findMatchList, text]);
    if (segmentList === null) {
        return text;
    }
    return segmentList.map((segment, index) => {
        if (segment.kind === 'text') {
            return <Fragment key={`t-${index}`}>{segment.text}</Fragment>;
        }
        const { match } = segment;
        return (
            <span
                key={`m-${index}`}
                className={`${VERSE_LOOKUP_LINK_CLASS} ${match.kind}`}
                title={match.text}
                onClick={(event) => {
                    handleMatchClicking(event, match);
                }}
                onContextMenu={(event) => {
                    showGraphPreviewContextMenu(event.nativeEvent, {
                        kind: match.kind,
                        recordId: match.recordId,
                        name: match.text,
                    });
                }}
            >
                {match.text}
            </span>
        );
    });
}
