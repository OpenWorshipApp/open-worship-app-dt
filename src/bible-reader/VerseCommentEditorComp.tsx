import { useMemo, useState } from 'react';

import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import { updateVerseComment } from '../bible-list/note/verseAnnotationHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import {
    toVerseBibleKey,
    type VerseCommentTargetType,
} from './verseAnnotationActionHelpers';

/**
 * A plain `textarea` in a floating widget — deliberately not the `bible-note`
 * editor, which is a whole lexical/excalidraw/katex bundle and would be a
 * startling amount of machinery for a sentence about a phrase.
 */
export default function VerseCommentEditorComp({
    target,
    onClose,
}: Readonly<{
    target: VerseCommentTargetType;
    onClose: () => void;
}>) {
    const [comment, setComment] = useState(target.comment);
    // Both the reference in the title bar and what gets typed under it belong to
    // one translation: a note on a Khmer verse is written in Khmer, and the
    // widget rendering it in the UI face while the passage behind it uses the
    // bible's own is two scripts for one thought.
    const fontFamily = useBibleFontFamily(
        toVerseBibleKey(target.verseKey) ?? '',
    );
    // Per instance, and the instance is per open editor: a module-level timer
    // would let one editor's pending save be cancelled by another's typing.
    const attemptSaving = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const targetRef = useAppCurrentRef(target);
    const commentRef = useAppCurrentRef(comment);
    // Flush on unmount: the debounce is there to spare the disk a write per
    // keystroke, not to lose the last one when the widget closes.
    useAppEffect(() => {
        return () => {
            const { filePath, noteItemId, commentId } = targetRef.current;
            updateVerseComment(
                filePath,
                noteItemId,
                commentId,
                commentRef.current,
            );
        };
    }, []);
    return (
        <FloatingWidgetComp
            title={
                <span
                    className="app-ellipsis"
                    style={{ fontFamily }}
                    title={target.title}
                >
                    {target.title}
                </span>
            }
            onClose={onClose}
            persistKey="verse-comment-editor"
            options={{
                width: 360,
                height: 220,
                minWidth: 240,
                minHeight: 150,
            }}
        >
            <textarea
                className="form-control h-100 w-100"
                style={{ resize: 'none', fontFamily }}
                autoFocus
                value={comment}
                placeholder={tran('Write a comment')}
                onChange={(event) => {
                    const newComment = event.target.value;
                    setComment(newComment);
                    attemptSaving(() => {
                        const { filePath, noteItemId, commentId } =
                            targetRef.current;
                        updateVerseComment(
                            filePath,
                            noteItemId,
                            commentId,
                            newComment,
                        );
                    });
                }}
            />
        </FloatingWidgetComp>
    );
}
