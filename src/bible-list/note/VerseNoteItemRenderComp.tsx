import './VerseNoteItemRenderComp.scss';

import { useCallback, useState } from 'react';
import type { DragEvent } from 'react';

import {
    showAppContextMenu,
    type ContextMenuItemType,
} from '../../context-menu/appContextMenuHelpers';
import ContextMenuDotsButtonComp from '../../context-menu/ContextMenuDotsButtonComp';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import FileSource from '../../helper/FileSource';
import { useAppCurrentRef } from '../../helper/appHooks';
import { addDragPayload, handleDragStart } from '../../helper/dragHelpers';
import { tran } from '../../lang/langHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import {
    toVerseBibleItem,
    toVerseBibleKey,
} from '../../bible-reader/verseAnnotationActionHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';
import { saveBibleItem } from '../bibleHelpers';
import type Note from './Note';
import type NoteItem from './NoteItem';
import { moveNoteItemTo } from './noteHelpers';
import RenderVerseAnnotationComp from './RenderVerseAnnotationComp';

/**
 * A verse's marks in the Bible Notes list: one collapsible row per verse,
 * holding every highlight and comment made on it.
 *
 * Deliberately NOT `BibleNoteItemRenderComp`. That row double-clicks into the
 * `bible-note` editor, whose first autosave rewrites `content` and would erase
 * this item's marks; it also offers Export, which predates verse items. A verse
 * row does neither, and carries actions of its own instead — what it is about is
 * a VERSE, which is a thing the app can present, so it can be added to the Bible
 * list from its menu or dragged straight onto it. Dragged onto another note
 * file it moves there instead, marks and all: the same drag says both.
 */
export default function VerseNoteItemRenderComp({
    index,
    noteItem,
    filePath,
    note,
}: Readonly<{
    index: number;
    noteItem: NoteItem;
    filePath: string;
    note: Note;
}>) {
    const [isOpened, setIsOpened] = useState(noteItem.isOpened);
    const noteRef = useAppCurrentRef(note);
    const noteItemRef = useAppCurrentRef(noteItem);
    const handleToggling = useCallback(() => {
        setIsOpened((oldIsOpened) => {
            const newIsOpened = !oldIsOpened;
            noteItemRef.current.isOpened = newIsOpened;
            // Silent: remembering whether a row is open must not flash the list
            // and scroll it back to this item every time it is folded.
            noteRef.current.updateAndSaveNoteItem(noteItemRef.current, true);
            return newIsOpened;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAddingToBibleList = useCallback(async () => {
        const bibleItem = toVerseBibleItem(noteItemRef.current.verseKey ?? '');
        if (bibleItem === null) {
            return;
        }
        await saveBibleItem(bibleItem);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleContextMenuOpening = useCallback((event: any) => {
        const menuItems: ContextMenuItemType[] = [
            {
                childBefore: genContextMenuItemIcon('book'),
                menuElement: tran('Add to Bible List'),
                onSelect: handleAddingToBibleList,
            },
            {
                childBefore: genContextMenuItemIcon('folder-symlink'),
                menuElement: tran('Move To'),
                onSelect: (event1: any) => {
                    moveNoteItemTo(
                        event1,
                        noteRef.current,
                        noteItemRef.current,
                    );
                },
            },
            {
                childBefore: genContextMenuItemIcon('trash3', {
                    color: 'var(--bs-danger)',
                }),
                menuElement: tran('Delete'),
                onSelect: async () => {
                    const isOk = await showAppConfirm(
                        tran('Delete Verse Marks'),
                        tran('Are you sure to delete all marks on this verse?'),
                        { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
                    );
                    if (!isOk) {
                        return;
                    }
                    await noteRef.current.deleteNoteItem(noteItemRef.current);
                },
            },
        ];
        showAppContextMenu(event, menuItems);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // TWO payloads, because this row is two things depending on where it lands.
    // To the Bibles panel it is the VERSE — `BibleFileComp` saves a dropped item
    // that carries no `filePath` — and that goes in the `text` entry every drop
    // target reads by default. To another note file it is the note item itself,
    // marks and all, which rides its own mime type; `extractDropDataOfType` is
    // what lets the note list ask for that one instead of the `text` payload.
    const handleDragStarting = useCallback(
        (event: DragEvent<HTMLLIElement>) => {
            const bibleItem = toVerseBibleItem(
                noteItemRef.current.verseKey ?? '',
            );
            if (bibleItem === null) {
                event.preventDefault();
                return;
            }
            handleDragStart(event, bibleItem);
            addDragPayload(event, noteItemRef.current);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const fileSource = FileSource.getInstance(filePath);
    // Everything in this row belongs to one translation — the reference, the
    // marked words, and what you wrote about them — so the face is set ONCE on
    // the whole block and inherited. Set only on the marked words, it left the
    // comment beside them in the UI font: one line in two scripts.
    const fontFamily = useBibleFontFamily(
        toVerseBibleKey(noteItem.verseKey ?? '') ?? '',
    );
    const { highlights, comments } = noteItem;
    return (
        <li
            className={
                'list-group-item item app-verse-note-item app-has-action-rail'
            }
            // The same attribute the ordinary note row carries: it is what
            // `revealBibleNoteRefs` flashes when a marked verse number is
            // clicked in the reader.
            data-note-item-id={`${fileSource.name}-${noteItem.id}`}
            data-index={index + 1}
            title={tran('Drag to the Bible list, or to another note file')}
            draggable
            onDragStart={handleDragStarting}
            onContextMenu={handleContextMenuOpening}
        >
            {/* The row's own column. `.list-group-item.item` is a flex ROW whose
                first child is the index-number gutter, so the header and the
                marks below it have to share one flex item or they line up
                beside each other instead of stacking. */}
            <div className="app-verse-note-item__body" style={{ fontFamily }}>
                <div
                    className={
                        'app-verse-note-item__head app-caught-hover-pointer'
                    }
                    onClick={handleToggling}
                >
                    <i
                        className={
                            'bi bi-chevron-right app-verse-note-item__chevron' +
                            (isOpened ? ' is-open' : '')
                        }
                    />
                    <i className="bi bi-highlighter app-verse-note-item__glyph" />
                    <div
                        className={
                            'flex-fill app-ellipsis app-verse-note-item__title'
                        }
                    >
                        {noteItem.title}
                    </div>
                    {/* Folded only: open, the marks themselves are the count,
                        and a number beside them says nothing twice. */}
                    {isOpened ? null : (
                        <span className="app-verse-note-item__count">
                            {noteItem.annotationCount}
                        </span>
                    )}
                </div>
                {!isOpened ? null : (
                    <ul className="list-group app-verse-annotation-list">
                        {highlights.map((highlight) => {
                            return (
                                <RenderVerseAnnotationComp
                                    key={highlight.id}
                                    filePath={filePath}
                                    noteItemId={noteItem.id}
                                    verseKey={noteItem.verseKey ?? ''}
                                    verseTitle={noteItem.title}
                                    annotation={highlight}
                                />
                            );
                        })}
                        {comments.map((comment) => {
                            return (
                                <RenderVerseAnnotationComp
                                    key={comment.id}
                                    filePath={filePath}
                                    noteItemId={noteItem.id}
                                    verseKey={noteItem.verseKey ?? ''}
                                    verseTitle={noteItem.title}
                                    annotation={comment}
                                />
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className="app-action-rail app-action-rail--pinned">
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            </div>
        </li>
    );
}
