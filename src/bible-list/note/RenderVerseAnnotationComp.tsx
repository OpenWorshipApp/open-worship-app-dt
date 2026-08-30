import { use, useCallback, useState } from 'react';

import {
    showAppContextMenu,
    type ContextMenuItemType,
} from '../../context-menu/appContextMenuHelpers';
import ContextMenuDotsButtonComp from '../../context-menu/ContextMenuDotsButtonComp';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import {
    escapeSelectorValue,
    notifyElementHighlight,
} from '../../helper/domHelpers';
import { tran } from '../../lang/langHelpers';
import { BibleItemsViewControllerContext } from '../../bible-reader/BibleItemsViewController';
import VerseCommentEditorComp from '../../bible-reader/VerseCommentEditorComp';
import {
    openVerseBibleItem,
    toVerseBibleItem,
    type VerseCommentTargetType,
} from '../../bible-reader/verseAnnotationActionHelpers';
import {
    VERSE_HIGHLIGHT_COLOR_KEYS,
    type VerseCommentType,
    type VerseHighlightColorKeyType,
    type VerseHighlightType,
} from './noteItemHelpers';
import {
    removeVerseAnnotation,
    updateVerseHighlightColor,
} from './verseAnnotationHelpers';

function checkIsHighlight(
    annotation: VerseHighlightType | VerseCommentType,
): annotation is VerseHighlightType {
    return 'color' in annotation;
}

/**
 * Flash the verse this mark belongs to, if it is already on screen.
 *
 * A plain DOM flash rather than `BibleItemsViewController.handleVersesHighlighting`:
 * the controller's method does this same query, and this one also works from a
 * window that has no controller at all.
 */
function revealVerse(verseKey: string) {
    const index = verseKey.indexOf(') ');
    const kjvVerseKey = index === -1 ? verseKey : verseKey.slice(index + 2);
    notifyElementHighlight(() => {
        return document.querySelector(
            `.bible-view div[data-kjv-verse-key=` +
                `"${escapeSelectorValue(kjvVerseKey)}"]`,
        );
    });
}

/**
 * One mark under an expanded verse row: a highlight, or a comment.
 *
 * The marked words are what the row shows, not the offsets — the numbers are
 * meaningless to read, and the snapshot is already stored for the painter's
 * integrity check.
 */
export default function RenderVerseAnnotationComp({
    filePath,
    noteItemId,
    verseKey,
    verseTitle,
    annotation,
}: Readonly<{
    filePath: string;
    noteItemId: number;
    verseKey: string;
    verseTitle: string;
    annotation: VerseHighlightType | VerseCommentType;
}>) {
    const [commentTarget, setCommentTarget] =
        useState<VerseCommentTargetType | null>(null);
    // Read nullably rather than through `useBibleItemsViewControllerContext`,
    // which THROWS when there is no provider: the panel is the reader's today,
    // and a row that merely cannot open a view is a better failure than a panel
    // that cannot render.
    const viewController = use(BibleItemsViewControllerContext);
    const viewControllerRef = useAppCurrentRef(viewController);
    const isHighlight = checkIsHighlight(annotation);
    const annotationRef = useAppCurrentRef(annotation);
    const filePathRef = useAppCurrentRef(filePath);
    const noteItemIdRef = useAppCurrentRef(noteItemId);
    const verseTitleRef = useAppCurrentRef(verseTitle);
    const verseKeyRef = useAppCurrentRef(verseKey);

    const handleRemoving = useCallback(() => {
        removeVerseAnnotation(
            filePathRef.current,
            noteItemIdRef.current,
            annotationRef.current.id,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Clicking a mark goes TO the verse — it opens it as another bible view and
    // flashes it if it is already on screen. Editing a comment moved onto the
    // row's own menu, so one gesture has one meaning whichever kind of mark it
    // lands on.
    const handleOpening = useCallback(() => {
        revealVerse(verseKeyRef.current);
        const viewController = viewControllerRef.current;
        if (viewController === null) {
            return;
        }
        const bibleItem = toVerseBibleItem(verseKeyRef.current);
        if (bibleItem === null) {
            return;
        }
        openVerseBibleItem(viewController, bibleItem);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCommentEditing = useCallback(() => {
        const currentAnnotation = annotationRef.current;
        if (checkIsHighlight(currentAnnotation)) {
            return;
        }
        setCommentTarget({
            filePath: filePathRef.current,
            noteItemId: noteItemIdRef.current,
            commentId: currentAnnotation.id,
            comment: currentAnnotation.comment,
            title: verseTitleRef.current,
            verseKey: verseKeyRef.current,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleContextMenuOpening = useCallback((event: any) => {
        const currentAnnotation = annotationRef.current;
        const menuItems: ContextMenuItemType[] = [];
        if (checkIsHighlight(currentAnnotation)) {
            for (const color of VERSE_HIGHLIGHT_COLOR_KEYS) {
                if (color === currentAnnotation.color) {
                    continue;
                }
                menuItems.push({
                    childBefore: (
                        <span
                            className="app-verse-annotation__swatch me-1"
                            style={{
                                backgroundColor: `var(--owa-verse-hl-${color})`,
                            }}
                        />
                    ),
                    menuElement: color,
                    onSelect: () => {
                        updateVerseHighlightColor(
                            filePathRef.current,
                            noteItemIdRef.current,
                            currentAnnotation.id,
                            color as VerseHighlightColorKeyType,
                        );
                    },
                });
            }
        }
        if (!checkIsHighlight(currentAnnotation)) {
            menuItems.push({
                childBefore: genContextMenuItemIcon('pencil-square'),
                menuElement: tran('Edit Comment'),
                onSelect: handleCommentEditing,
            });
        }
        menuItems.push({
            childBefore: genContextMenuItemIcon('trash3', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Delete'),
            onSelect: handleRemoving,
        });
        showAppContextMenu(event, menuItems);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <li
                className={
                    'list-group-item app-verse-annotation' +
                    ' app-caught-hover-pointer app-has-action-rail' +
                    (isHighlight ? '' : ' app-verse-annotation--comment')
                }
                title={tran('Click to open the verse')}
                onClick={handleOpening}
                onContextMenu={handleContextMenuOpening}
            >
                <div className="app-verse-annotation__line app-ellipsis">
                    {/* The words wear the mark itself — the same wash the
                        reader paints them with, from the same custom property.
                        A comment gets no wash: the sheet underlines it, exactly
                        as the verse is underlined. */}
                    {/* The face is inherited from the verse block above, which
                        owns it for the whole row — see `VerseNoteItemRenderComp`. */}
                    <span
                        className="app-verse-annotation__text"
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
                <div className="app-action-rail app-action-rail--pinned">
                    <ContextMenuDotsButtonComp
                        onOpening={handleContextMenuOpening}
                    />
                </div>
            </li>
            {commentTarget === null ? null : (
                <VerseCommentEditorComp
                    target={commentTarget}
                    onClose={() => {
                        setCommentTarget(null);
                    }}
                />
            )}
        </>
    );
}
