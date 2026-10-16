import './bibleChapterDivider.scss';

import type { CSSProperties } from 'react';

import { tran } from '../../lang/langHelpers';

/**
 * `-2-----` above the first verse of each chapter of a passage that crosses
 * chapters, so the verse numbers starting over at 1 read as a new chapter.
 * Not selectable: copying a selection takes the verses, not the rule.
 */
export default function RenderBibleChapterDividerComp({
    localeChapter,
    style,
}: Readonly<{
    // The number as the bible writes it (Khmer digits for a Khmer bible).
    localeChapter: string;
    style?: CSSProperties;
}>) {
    return (
        <div
            className="bible-chapter-divider app-not-selectable-text"
            role="separator"
            aria-label={`${tran('Chapter')} ${localeChapter}`}
        >
            <span className="bible-chapter-divider-label" style={style}>
                {localeChapter}
            </span>
        </div>
    );
}
