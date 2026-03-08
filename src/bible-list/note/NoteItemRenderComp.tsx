import { useState, type MouseEvent } from 'react';

import NoteItem from './NoteItem';
import { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { useFileSourceRefreshEvents } from '../../helper/dirSourceHelpers';
import {
    genRemovingAttachedBackgroundMenu,
    extractDropData,
    handleAttachBackgroundDrop,
    handleDragStart,
} from '../../helper/dragHelpers';
import { DragTypeEnum } from '../../helper/DragInf';
import FileSource from '../../helper/FileSource';
import { changeDragEventStyle, stopDraggingState } from '../../helper/helpers';
import { attachBackgroundManager } from '../../others/AttachBackgroundManager';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import ItemReadErrorComp from '../../others/ItemReadErrorComp';
import Note from './Note';
import { openNoteItemContextMenu } from './noteHelpers';
import NoteEditorComp from './NoteEditorComp';

export default function NoteItemRenderComp({
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
    const [showingNote, setShowingNote] = useState(false);
    useFileSourceRefreshEvents(['select'], filePath);

    const handleContextMenuOpening = async (event: MouseEvent<any>) => {
        const menuItems: ContextMenuItemType[] = [];
        const attachedBackgroundData =
            await attachBackgroundManager.getAttachedBackground(
                filePath,
                noteItem.id,
            );
        if (attachedBackgroundData !== null) {
            menuItems.push(
                ...genRemovingAttachedBackgroundMenu(filePath, noteItem.id),
            );
        }
        openNoteItemContextMenu(event, noteItem, index, menuItems);
    };

    if (noteItem.isError) {
        return <ItemReadErrorComp onContextMenu={handleContextMenuOpening} />;
    }
    const handleDataDropping = async (event: any) => {
        changeDragEventStyle(event, 'opacity', '1');
        const droppedData = extractDropData(event);
        if (droppedData?.type === DragTypeEnum.NOTE_ITEM) {
            const note = await Note.fromFilePath(filePath);
            if (note === null) {
                return;
            }
            const droppedNoteItem = droppedData.item as NoteItem;
            if (droppedNoteItem.filePath !== undefined) {
                if (droppedNoteItem.filePath === noteItem.filePath) {
                    const toIndex = note.getItemIndex(noteItem);
                    note.moveItemToIndex(droppedNoteItem, toIndex);
                    stopDraggingState(event);
                    note.save();
                }
            }
        } else {
            handleAttachBackgroundDrop(event, {
                filePath,
                id: noteItem.id,
            });
        }
    };
    const fileSource = FileSource.getInstance(filePath);
    return (
        <>
            <li
                className="list-group-item item app-caught-hover-pointer px-3"
                data-note-item-id={`${fileSource.name}-${noteItem.id}`}
                data-index={index + 1}
                draggable
                onDragStart={(event) => {
                    handleDragStart(event, noteItem);
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    changeDragEventStyle(event, 'opacity', '0.5');
                }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    changeDragEventStyle(event, 'opacity', '1');
                }}
                onDrop={handleDataDropping}
                onClick={() => {
                    setShowingNote((prev) => !prev);
                }}
                onContextMenu={handleContextMenuOpening}
            >
                <div className="d-flex ps-1">
                    <ItemColorNoteComp item={noteItem} />
                    <div className="d-flex flex-fill">
                        Note id:{noteItem.id}
                    </div>
                </div>
            </li>
            {showingNote ? (
                <NoteEditorComp note={note} noteItem={noteItem} />
            ) : null}
        </>
    );
}
