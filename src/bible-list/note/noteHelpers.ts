import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { dirSourceSettingNames } from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import FileSource from '../../helper/FileSource';
import { tran } from '../../lang/langHelpers';
import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import { addExtension } from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import Note from './Note';
import type NoteItem from './NoteItem';

export async function moveNoteItemTo(
    event: any,
    note: Note,
    noteItem?: NoteItem,
) {
    // The SETTING name (`select-dir-bible-notes`), not the folder name.
    // `DirSource.getInstance` looks its argument up as a setting, so passing
    // `defaultDataDirNames.BIBLE_NOTES` read a setting that has never existed:
    // every "Move To" and "Move All Items To" answered `No other notes found`
    // however many note files were sitting right there in the list.
    const dirSource = await DirSource.getInstance(
        dirSourceSettingNames.BIBLE_NOTES,
    );
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
        showSimpleToast(tran('Move Note Item'), tran('No other notes found'));
        return;
    }
    const menuItems: ContextMenuItemType[] = targetNames.map((name) => {
        return {
            childBefore: genContextMenuItemIcon('journal-text'),
            menuElement: name,
            onSelect: async () => {
                const noteFileSource = FileSource.getInstance(note.filePath);
                const { baseDirPath: basePath, dotExtension } = noteFileSource;
                const fileSource = FileSource.getInstance(
                    basePath,
                    addExtension(name, dotExtension),
                );
                const targetNote = await Note.fromFilePath(fileSource.filePath);
                if (!targetNote) {
                    showSimpleToast(
                        tran('Move Note Item'),
                        tran('Target note not found'),
                    );
                    return;
                }
                targetNote.moveItemFrom(note.filePath, noteItem);
            },
        };
    });
    showAppContextMenu(event, menuItems);
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
        showSimpleToast(
            tran('Open Note Item Context Menu'),
            tran('Unable to get note'),
        );
        return;
    }
    const menuItem: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('files'),
            menuElement: tran('Duplicate'),
            onSelect: () => {
                note.duplicate(index);
                note.save();
            },
        },
        {
            childBefore: genContextMenuItemIcon('folder-symlink'),
            menuElement: tran('Move To'),
            onSelect: (event1: any) => {
                moveNoteItemTo(event1, note, noteItem);
            },
        },
        {
            childBefore: genContextMenuItemIcon('trash3', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Delete'),
            onSelect: async () => {
                const isOk = await showAppConfirm(
                    tran('Delete Note Item'),
                    tran('Are you sure to delete this note item?'),
                    {
                        cancelButtonLabel: 'No',
                        confirmButtonLabel: 'Yes',
                    },
                );
                if (!isOk) {
                    return;
                }
                await note.deleteNoteItem(noteItem);
            },
        },
    ];
    if (index !== 0) {
        menuItem.push({
            childBefore: genContextMenuItemIcon('arrow-up'),
            menuElement: tran('Move up'),
            onSelect: () => {
                note.swapItems(index, index - 1);
                note.save();
            },
        });
    }
    if (index !== note.itemsLength - 1) {
        menuItem.push({
            childBefore: genContextMenuItemIcon('arrow-down'),
            menuElement: tran('Move down'),
            onSelect: () => {
                note.swapItems(index, index + 1);
                note.save();
            },
        });
    }
    showAppContextMenu(event, [...extraMenuItems, ...menuItem]);
}

export function sortNoteFilePaths(filePaths: string[]) {
    // move default file to the top
    const newFilePath = [...filePaths];
    newFilePath.sort((a, b) => {
        const aIsDefault = Note.checkIsDefault(a);
        const bIsDefault = Note.checkIsDefault(b);
        if (aIsDefault && !bIsDefault) {
            return -1;
        }
        if (!aIsDefault && bIsDefault) {
            return 1;
        }
        return 0;
    });
    return newFilePath;
}
