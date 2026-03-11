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
import NoteEditorComp, { NoteTitleEditorComp } from './NoteEditorComp';
import { tran } from '../../lang/langHelpers';
import appProvider from '../../server/appProvider';
import { openPopupWindow } from '../../helper/domHelpers';

export function handleOpening(note: Note, noteItem: NoteItem) {
    const fileFullName = note.fileSource.fullName;
    const fileFullNameEncoded = encodeURIComponent(fileFullName);
    const pathName =
        `${appProvider.noteItemEditorHomePage}?` +
        `file=${fileFullNameEncoded}`;
    const noteId = noteItem.id;
    const url = `${pathName}&id=${noteId}`;
    return openPopupWindow(
        url,
        `${fileFullName}-${noteId}_${Date.now()}`,
        crypto.randomUUID(),
    );
}

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
    const [showingNote, setShowingNote] = useState(noteItem.isOpened);
    const setShowingNote1 = (isOpened: boolean) => {
        setShowingNote(isOpened);
        noteItem.isOpened = isOpened;
        note.updateAndSaveNoteItem(noteItem, true);
    };
    useFileSourceRefreshEvents(['select'], filePath);

    const handleContextMenuOpening = async (event: MouseEvent<any>) => {
        const menuItems: ContextMenuItemType[] = [
            {
                menuElement: tran('Open'),
                onSelect: () => {
                    handleOpening(note, noteItem);
                },
            },
        ];
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
                className="list-group-item item ps-3 pe-1 py-1"
                style={{
                    height: 40,
                }}
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
                onDoubleClick={() => {
                    handleOpening(note, noteItem);
                }}
                onContextMenu={handleContextMenuOpening}
            >
                <div className="d-flex ps-1">
                    <ItemColorNoteComp item={noteItem} />
                    <i
                        className={
                            `bi bi-journal${showingNote ? '-text' : ''} ` +
                            'mx-1 app-caught-hover-pointer'
                        }
                        title={tran('Open note')}
                        onClick={() => {
                            setShowingNote1(!showingNote);
                        }}
                    />
                    {showingNote ? (
                        <NoteTitleEditorComp note={note} noteItem={noteItem} />
                    ) : (
                        <div className="d-flex flex-fill">
                            {noteItem.title ? (
                                noteItem.title
                            ) : (
                                <span className="fst-italic text-warning">
                                    {tran('No title')}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </li>
            {showingNote ? (
                <NoteEditorComp note={note} noteItem={noteItem} />
            ) : null}
        </>
    );
}
