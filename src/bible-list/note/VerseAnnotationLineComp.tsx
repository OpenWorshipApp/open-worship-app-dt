import './VerseAnnotationLineComp.scss';

import type { VerseHighlightColorKeyType } from './noteItemHelpers';

/** What a line needs of a mark: the words, and the colour or the comment. */
export type VerseAnnotationLineType =
    | { text: string; color: VerseHighlightColorKeyType }
    | { text: string; comment: string };

/**
 * One mark as a line of words: a highlight in the very wash the reader paints
 * those words with, a comment underlined as it is in the verse, with what was
 * written about it beside.
 *
 * Only the drawing. What pressing it does belongs to whoever holds the row --
 * the Bible Notes panel, where a mark can be edited, and the Resources panel,
 * where a note file from somebody's folder is only ever read.
 */
export default function VerseAnnotationLineComp({
    annotation,
}: Readonly<{ annotation: VerseAnnotationLineType }>) {
    const isHighlight = 'color' in annotation;
    return (
        <div className="app-verse-annotation__line app-ellipsis">
            {/* The face is inherited from the verse block above, which owns it
                for the whole row. */}
            <span
                className={
                    'app-verse-annotation__text' +
                    (isHighlight ? '' : ' app-verse-annotation__text--comment')
                }
                style={
                    isHighlight
                        ? {
                              backgroundColor: `var(--owa-verse-hl-${annotation.color})`,
                          }
                        : undefined
                }
            >
                {annotation.text}
            </span>
            {isHighlight || !annotation.comment ? null : (
                <span className="app-verse-annotation__comment">
                    {annotation.comment}
                </span>
            )}
        </div>
    );
}
