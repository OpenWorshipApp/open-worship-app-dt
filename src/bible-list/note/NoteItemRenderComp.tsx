import type { MouseEvent } from 'react';

import NoteItem from './NoteItem';
import BibleItemsViewController, {
    useBibleItemsViewControllerContext,
} from '../../bible-reader/BibleItemsViewController';
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
import { tran } from '../../lang/langHelpers';
import { attachBackgroundManager } from '../../others/AttachBackgroundManager';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import ItemReadErrorComp from '../../others/ItemReadErrorComp';
import Note from './Note';
import { openNoteItemContextMenu } from './noteHelpers';

function handleOpening(
    _event: any,
    _viewController: BibleItemsViewController,
    noteItem: NoteItem,
) {
    console.log('Opening note', noteItem);
}

export default function NoteItemRenderComp({
    index,
    noteItem,
    filePath,
}: Readonly<{
    index: number;
    noteItem: NoteItem;
    filePath: string;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    useFileSourceRefreshEvents(['select'], filePath);

    const handleContextMenuOpening = async (event: MouseEvent<any>) => {
        const menuItems: ContextMenuItemType[] = [
            {
                menuElement: tran('Open'),
                onSelect: (event: any) => {
                    handleOpening(event, viewController, noteItem);
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
            onDoubleClick={(event) => {
                handleOpening(event, viewController, noteItem);
            }}
            onContextMenu={handleContextMenuOpening}
        >
            <div className="d-flex ps-1">
                <ItemColorNoteComp item={noteItem} />
                <div className="d-flex flex-fill">Note id:{noteItem.id}</div>
            </div>
        </li>
    );
}
