import { useCallback } from 'react';
import { createPortal } from 'react-dom';

import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import { useThemeSource } from '../others/themeHelpers';
import { removeVerseAnnotation } from '../bible-list/note/verseAnnotationHelpers';
import {
    toVerseAnchor,
    toVerseBibleKey,
    type VerseCommentTargetType,
} from './verseAnnotationActionHelpers';
import {
    cancelHoveredCommentClearing,
    scheduleHoveredCommentClearing,
    useHoveredVerseComment,
    type HoveredVerseCommentType,
} from './verseCommentHoverHelpers';

const TOOLTIP_GAP_PIXEL = 6;
const TOOLTIP_EDGE_PIXEL = 8;

/**
 * The tooltip that appears over commented words: the comment itself, plus the
 * two things to do with it.
 *
 * Mounted once per bible-view host and driven by a module-level store, because
 * the hover is detected in every bible view but only ever one tooltip is shown.
 */
export default function VerseCommentHoverToolComp({
    onEdit,
}: Readonly<{
    onEdit: (target: VerseCommentTargetType) => void;
}>) {
    const hoveredComment = useHoveredVerseComment();
    const onEditRef = useAppCurrentRef(onEdit);
    const hoveredCommentRef = useAppCurrentRef(hoveredComment);
    const handleEditing = useCallback(async () => {
        const current = hoveredCommentRef.current;
        if (current === null) {
            return;
        }
        const anchor = await toVerseAnchor(current.verseKey);
        onEditRef.current({
            filePath: current.filePath,
            noteItemId: current.noteItemId,
            commentId: current.commentId,
            comment: current.comment,
            title: anchor?.title ?? current.verseKey,
            verseKey: current.verseKey,
        });
        scheduleHoveredCommentClearing();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRemoving = useCallback(async () => {
        const current = hoveredCommentRef.current;
        if (current === null) {
            return;
        }
        await removeVerseAnnotation(
            current.filePath,
            current.noteItemId,
            current.commentId,
        );
        scheduleHoveredCommentClearing();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (hoveredComment === null) {
        return null;
    }
    return (
        <RenderHoverToolComp
            hoveredComment={hoveredComment}
            onEdit={handleEditing}
            onRemove={handleRemoving}
        />
    );
}

function RenderHoverToolComp({
    hoveredComment,
    onEdit,
    onRemove,
}: Readonly<{
    hoveredComment: HoveredVerseCommentType;
    onEdit: () => void;
    onRemove: () => void;
}>) {
    // Portalled to `document.body`, outside the element carrying
    // `data-bs-theme` — without this its `--bs-*` tokens resolve light whatever
    // the app is set to. Same reason as the selection toolbar.
    const { theme } = useThemeSource();
    // The same face the comment was written in — see `VerseCommentEditorComp`.
    const fontFamily = useBibleFontFamily(
        toVerseBibleKey(hoveredComment.verseKey) ?? '',
    );
    const { rect, comment } = hoveredComment;
    const left = Math.min(
        Math.max(rect.left, TOOLTIP_EDGE_PIXEL),
        globalThis.innerWidth - TOOLTIP_EDGE_PIXEL,
    );
    return createPortal(
        <div
            className="app-verse-comment-hover"
            data-bs-theme={theme}
            style={{ left, top: rect.bottom + TOOLTIP_GAP_PIXEL }}
            // The pointer leaving the words schedules this away; entering it
            // cancels that, which is the only reason its buttons are reachable.
            onMouseEnter={cancelHoveredCommentClearing}
            onMouseLeave={scheduleHoveredCommentClearing}
        >
            <div
                className="app-verse-comment-hover__text"
                style={{ fontFamily }}
            >
                {comment ? (
                    comment
                ) : (
                    <span className="fst-italic text-muted">
                        {tran('No comment yet')}
                    </span>
                )}
            </div>
            <div className="app-verse-comment-hover__actions">
                <button
                    type="button"
                    className="app-verse-comment-hover__button"
                    title={tran('Edit Comment')}
                    onClick={onEdit}
                >
                    <i className="bi bi-pencil-square" />
                </button>
                <button
                    type="button"
                    className="app-verse-comment-hover__button"
                    title={tran('Delete Comment')}
                    onClick={onRemove}
                >
                    <i className="bi bi-trash3" />
                </button>
            </div>
        </div>,
        document.body,
    );
}
