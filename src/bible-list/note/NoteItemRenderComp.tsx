import { useCallback, type MouseEvent, type DragEvent, useState } from 'react';

import type NoteItem from './NoteItem';
import { type ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { useFileSourceRefreshEvents } from '../../helper/dirSourceHelpers';
import {
    genRemovingAttachedBackgroundMenu,
    extractDropData,
    handleAttachBackgroundDrop,
    handleDragStart as handleDragStartHelper,
} from '../../helper/dragHelpers';
import { DragTypeEnum } from '../../helper/DragInf';
import FileSource from '../../helper/FileSource';
import { changeDragEventStyle, stopDraggingState } from '../../helper/helpers';
import { attachBackgroundManager } from '../../others/AttachBackgroundManager';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import ItemReadErrorComp from '../../others/ItemReadErrorComp';
import Note from './Note';
import { openNoteItemContextMenu } from './noteHelpers';
import { tran } from '../../lang/langHelpers';
import appProvider from '../../server/appProvider';
import { openPopupWindow } from '../../helper/domHelpers';
import { NoteTitleEditorComp } from './NoteEditorComp';
import { exportBibleNoteItem } from './bibleNoteItemArchiveHelpers';

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
        {
            width: 860,
        },
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
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const setIsEditingTitle1 = useCallback(
        (isOpened: boolean) => {
            setIsEditingTitle(isOpened);
            noteItem.isOpened = isOpened;
            note.updateAndSaveNoteItem(noteItem, true);
        },
        [noteItem, note],
    );
    useFileSourceRefreshEvents(['select'], filePath);

    const handleContextMenuOpening = useCallback(
        async (event: MouseEvent<any>) => {
            const menuItems: ContextMenuItemType[] = [
                {
                    menuElement: tran('Open'),
                    onSelect: () => {
                        handleOpening(note, noteItem);
                    },
                },
                {
                    menuElement: tran('Export'),
                    onSelect: () => {
                        exportBibleNoteItem(noteItem);
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
        },
        [note, noteItem, filePath, index],
    );
    const handleDataDropping = useCallback(
        async (event: any) => {
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
        },
        [noteItem, filePath],
    );

    const handleDragStartEvent = useCallback(
        (event: DragEvent<HTMLLIElement>) => {
            handleDragStartHelper(event, noteItem);
        },
        [noteItem],
    );
    const handleDragOver = useCallback((event: DragEvent<HTMLLIElement>) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '0.5');
    }, []);
    const handleDragLeave = useCallback((event: DragEvent<HTMLLIElement>) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '1');
    }, []);
    const handleBibleNoteOpening = useCallback(() => {
        handleOpening(note, noteItem);
    }, [note, noteItem]);
    const handleStartEditingTitle = useCallback(() => {
        if (isEditingTitle) {
            return;
        }
        setIsEditingTitle1(!isEditingTitle);
    }, [isEditingTitle, setIsEditingTitle1]);

    if (noteItem.isError) {
        return <ItemReadErrorComp onContextMenu={handleContextMenuOpening} />;
    }
    const fileSource = FileSource.getInstance(filePath);
    return (
        <li
            className="list-group-item item ps-2 pe-1"
            title={tran('Double click to open note')}
            style={{
                height: 28,
            }}
            data-note-item-id={`${fileSource.name}-${noteItem.id}`}
            data-index={index + 1}
            draggable
            onDragStart={handleDragStartEvent}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDataDropping}
            onDoubleClick={handleStartEditingTitle}
            onContextMenu={handleContextMenuOpening}
        >
            <div className="d-flex ps-1">
                <ItemColorNoteComp item={noteItem} />
                <i
                    className={'bi bi-journal mx-1 app-caught-hover-pointer'}
                    title={tran('Open BibleNote')}
                    onClick={handleBibleNoteOpening}
                />
                {isEditingTitle ? (
                    <NoteTitleEditorComp
                        note={note}
                        noteItem={noteItem}
                        onEscape={() => {
                            setIsEditingTitle1(false);
                        }}
                        onEnter={() => {
                            setIsEditingTitle1(false);
                        }}
                        onBlur={() => {
                            setIsEditingTitle1(false);
                        }}
                    />
                ) : (
                    <div className="d-flex flex-fill app-ellipsis">
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
    );
}
