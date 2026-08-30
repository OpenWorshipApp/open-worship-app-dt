import './BibleSelectionToolbarComp.scss';

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    VERSE_HIGHLIGHT_COLOR_KEYS,
    type VerseHighlightColorKeyType,
} from '../bible-list/note/noteItemHelpers';
import { useBibleVerseAnnotations } from '../bible-list/note/bibleNoteShortVerseHelpers';
import {
    addVerseComment,
    addVerseHighlight,
} from '../bible-list/note/verseAnnotationHelpers';
import {
    readVerseSelection,
    removeAnnotationRefs,
    toOverlappingAnnotationRefs,
    toVerseAnchor,
    type VerseCommentTargetType,
    type VerseSelectionType,
} from './verseAnnotationActionHelpers';
import VerseCommentEditorComp from './VerseCommentEditorComp';
import VerseCommentHoverToolComp from './VerseCommentHoverToolComp';

const TOOLBAR_GAP_PIXEL = 8;
const TOOLBAR_EDGE_PIXEL = 8;

function clearSelection() {
    const selection = globalThis.getSelection();
    if (selection !== null && selection.rangeCount > 0) {
        selection.removeAllRanges();
    }
}

/**
 * The marking toolbar that appears over a run of selected verse text, plus the
 * two things it opens: the comment editor and the hover tool.
 *
 * All three live in one always-mounted host because they outlive each other —
 * pressing "comment" destroys the selection that raised the toolbar, and the
 * editor has to stay up afterwards.
 */
export default function BibleSelectionToolbarComp() {
    const [selection, setSelection] = useState<VerseSelectionType | null>(null);
    const [commentTarget, setCommentTarget] =
        useState<VerseCommentTargetType | null>(null);
    const annotationsMap = useBibleVerseAnnotations();
    const annotationsMapRef = useAppCurrentRef(annotationsMap);
    const selectionRef = useAppCurrentRef(selection);
    // Per instance: the presenter's Bibles tab and the lookup previewer can each
    // mount one of these, and a module-level timer would let one host's pending
    // read cancel the other's.
    const attemptReading = useMemo(() => {
        return genTimeoutAttempt(150);
    }, []);

    useAppEffect(() => {
        const handleSelectionChange = () => {
            const currentSelection = globalThis.getSelection();
            // The O(1) early-out that keeps this listener honest: a collapsed
            // selection is the overwhelmingly common case, and answering it
            // costs nothing and never schedules the real read.
            if (currentSelection === null || currentSelection.isCollapsed) {
                attemptReading(() => {});
                setSelection(null);
                return;
            }
            attemptReading(() => {
                setSelection(readVerseSelection());
            });
        };
        // Scrolling moves the selection under a fixed toolbar; re-reading is
        // what keeps the two together, and the same debounce covers it.
        const handleScroll = () => {
            if (selectionRef.current === null) {
                return;
            }
            attemptReading(() => {
                setSelection(readVerseSelection());
            });
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('scroll', handleScroll, {
            capture: true,
            passive: true,
        });
        return () => {
            document.removeEventListener(
                'selectionchange',
                handleSelectionChange,
            );
            document.removeEventListener('scroll', handleScroll, {
                capture: true,
            });
        };
    }, [attemptReading]);

    const handleHighlighting = useCallback(
        async (color: VerseHighlightColorKeyType) => {
            const currentSelection = selectionRef.current;
            if (currentSelection === null) {
                return;
            }
            const anchor = await toVerseAnchor(currentSelection.verseKey);
            if (anchor === null) {
                return;
            }
            await addVerseHighlight(anchor, currentSelection.offsets, color);
            clearSelection();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handleErasing = useCallback(async () => {
        const currentSelection = selectionRef.current;
        if (currentSelection === null) {
            return;
        }
        const { verseKey, offsets } = currentSelection;
        const refs = toOverlappingAnnotationRefs(
            annotationsMapRef.current[verseKey],
            offsets.start,
            offsets.end,
        );
        if (refs.length === 0) {
            showSimpleToast(
                tran('Remove Marks'),
                tran('No mark in the selected text'),
            );
            return;
        }
        await removeAnnotationRefs(refs);
        clearSelection();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCommenting = useCallback(async () => {
        const currentSelection = selectionRef.current;
        if (currentSelection === null) {
            return;
        }
        const anchor = await toVerseAnchor(currentSelection.verseKey);
        if (anchor === null) {
            return;
        }
        const added = await addVerseComment(anchor, currentSelection.offsets);
        if (added === null) {
            return;
        }
        clearSelection();
        setCommentTarget({
            filePath: added.filePath,
            noteItemId: added.noteItemId,
            commentId: added.annotationId,
            comment: '',
            title: anchor.title,
            verseKey: anchor.verseKey,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCommentEditorClosing = useCallback(() => {
        setCommentTarget(null);
    }, []);

    return (
        <>
            {selection === null ? null : (
                <RenderSelectionToolbarComp
                    selection={selection}
                    onHighlight={handleHighlighting}
                    onErase={handleErasing}
                    onComment={handleCommenting}
                />
            )}
            <VerseCommentHoverToolComp onEdit={setCommentTarget} />
            {commentTarget === null ? null : (
                <VerseCommentEditorComp
                    key={commentTarget.commentId}
                    target={commentTarget}
                    onClose={handleCommentEditorClosing}
                />
            )}
        </>
    );
}

function RenderSelectionToolbarComp({
    selection,
    onHighlight,
    onErase,
    onComment,
}: Readonly<{
    selection: VerseSelectionType;
    onHighlight: (color: VerseHighlightColorKeyType) => void;
    onErase: () => void;
    onComment: () => void;
}>) {
    // Portalled to `document.body`, which is OUTSIDE the element the app puts
    // `data-bs-theme` on — so every `--bs-*` token here resolved to the LIGHT
    // default and the toolbar came up white on the dark reader. Carrying the
    // theme on its own root is what the other portalled surfaces do too.
    const { theme } = useThemeSource();
    const { rect } = selection;
    const left = Math.min(
        Math.max(rect.left + rect.width / 2, TOOLBAR_EDGE_PIXEL),
        globalThis.innerWidth - TOOLBAR_EDGE_PIXEL,
    );
    return createPortal(
        <div
            className="app-verse-selection-toolbar"
            data-bs-theme={theme}
            style={{ left, top: rect.top - TOOLBAR_GAP_PIXEL }}
            // Without this the press collapses the selection before the click
            // handler ever runs, and every button here acts on that selection.
            onMouseDown={(event) => {
                event.preventDefault();
            }}
        >
            {VERSE_HIGHLIGHT_COLOR_KEYS.map((color) => {
                return (
                    <button
                        key={color}
                        type="button"
                        className="app-verse-selection-toolbar__swatch"
                        style={{
                            backgroundColor: `var(--owa-verse-hl-${color})`,
                        }}
                        aria-label={color}
                        title={tran('Highlight')}
                        onClick={() => {
                            onHighlight(color);
                        }}
                    />
                );
            })}
            <span className="app-verse-selection-toolbar__divider" />
            <button
                type="button"
                className="app-verse-selection-toolbar__button"
                title={tran('Add Comment')}
                onClick={onComment}
            >
                <i className="bi bi-chat-left-text" />
            </button>
            <button
                type="button"
                className="app-verse-selection-toolbar__button"
                title={tran('Remove Marks')}
                onClick={onErase}
            >
                <i className="bi bi-eraser" />
            </button>
        </div>,
        document.body,
    );
}
