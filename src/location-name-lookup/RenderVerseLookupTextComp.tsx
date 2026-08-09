import { Fragment, useMemo } from 'react';

import { openDetailPanel } from './detailPanelHelpers';
import {
    toVerseTextSegments,
    useLookupTextIndex,
    type LookupTextMatchType,
} from './verseTextIndexHelpers';

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
}: Readonly<{
    text: string;
    kjvShortVerse: string;
}>) {
    const lookupTextIndex = useLookupTextIndex();
    const segmentList = useMemo(() => {
        return toVerseTextSegments(lookupTextIndex, text, kjvShortVerse);
    }, [lookupTextIndex, text, kjvShortVerse]);
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
            >
                {match.text}
            </span>
        );
    });
}
