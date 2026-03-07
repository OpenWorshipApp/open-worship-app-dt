import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { defaultDataDirNames } from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import FileSource from '../../helper/FileSource';
import { tran } from '../../lang/langHelpers';
import { addExtension } from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import Note from './Note';
import NoteItem from './NoteItem';

export async function moveNoteItemTo(
    event: any,
    note: Note,
    noteItem?: NoteItem,
) {
    const dirSource = await DirSource.getInstance(defaultDataDirNames.NOTES);
    const filePaths = await dirSource.getFilePaths('note');
    const targetNames = (filePaths ?? [])
        .map((filePath) => {
            return FileSource.getInstance(filePath).name;
        })
        .filter((name) => {
            const fileSource = FileSource.getInstance(note.filePath);
            return name !== fileSource.name;
        });
    if (targetNames.length === 0) {
        showSimpleToast('Move Note Item', 'No other notes found');
        return;
    }
    showAppContextMenu(
        event,
        targetNames.map((name) => {
            return {
                menuElement: name,
                onSelect: async () => {
                    const noteFileSource = FileSource.getInstance(
                        note.filePath,
                    );
                    const { baseDirPath: basePath, dotExtension } =
                        noteFileSource;
                    const fileSource = FileSource.getInstance(
                        basePath,
                        addExtension(name, dotExtension),
                    );
                    const targetNote = await Note.fromFilePath(
                        fileSource.filePath,
                    );
                    if (!targetNote) {
                        showSimpleToast(
                            'Move Note Item',
                            'Target note not found',
                        );
                        return;
                    }
                    targetNote.moveItemFrom(note.filePath, noteItem);
                },
            };
        }),
    );
}

export async function openNoteItemContextMenu(
    event: any,
    noteItem: NoteItem,
    index: number,
    extraMenuItems: ContextMenuItemType[],
) {
    const note = noteItem.filePath
        ? await Note.fromFilePath(noteItem.filePath)
        : null;
    if (note === null) {
        showSimpleToast('Open Note Item Context Menu', 'Unable to get note');
        return;
    }
    const menuItem: ContextMenuItemType[] = [
        {
            menuElement: tran('Duplicate'),
            onSelect: () => {
                note.duplicate(index);
                note.save();
            },
        },
        {
            menuElement: tran('Move To'),
            onSelect: (event1: any) => {
                moveNoteItemTo(event1, note, noteItem);
            },
        },
        {
            menuElement: tran('Delete'),
            onSelect: async () => {
                await note.deleteNoteItem(noteItem);
            },
        },
    ];
    if (index !== 0) {
        menuItem.push({
            menuElement: tran('Move up'),
            onSelect: () => {
                note.swapItems(index, index - 1);
                note.save();
            },
        });
    }
    if (index !== note.itemsLength - 1) {
        menuItem.push({
            menuElement: tran('Move down'),
            onSelect: () => {
                note.swapItems(index, index + 1);
                note.save();
            },
        });
    }
    showAppContextMenu(event, [...extraMenuItems, ...menuItem]);
}
