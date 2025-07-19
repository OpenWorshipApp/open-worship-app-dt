import {
    fsCopyFilePathToPath,
    isSupportedExt,
    MimetypeNameType,
    selectFiles,
} from '../server/fileHelpers';
import DirSource from '../helper/DirSource';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { changeDragEventStyle } from '../helper/helpers';
import { OptionalPromise } from '../helper/typeHelpers';

export function genOnDragOver(dirSource: DirSource) {
    return (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const items = Object.entries(event.dataTransfer.items);
        if (!dirSource.dirPath) {
            changeDragEventStyle(event, 'opacity', '0.5');
            return;
        }
        if (
            items.length > 0 &&
            items.every(([_, { kind }]) => {
                return kind === 'file';
            })
        ) {
            changeDragEventStyle(event, 'opacity', '0.5');
        }
    };
}

export function genOnDragLeave() {
    return (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '1');
    };
}

export type DroppedFileType = File | string;

async function* readDroppedFiles(
    event: React.DragEvent<HTMLDivElement>,
): AsyncGenerator<File> {
    async function* readDirectory(
        item: DataTransferItem,
    ): AsyncGenerator<File> {
        const handle = item.webkitGetAsEntry?.() as FileSystemDirectoryEntry;
        if (!handle) {
            return;
        }
        if (handle.isFile) {
            const file = item.getAsFile();
            if (file) {
                yield file;
            }
        }
        // TODO: Handle directory reading
    }
    for (const item of event.dataTransfer.items) {
        if (item.kind === 'file') {
            yield* readDirectory(item);
        }
    }
}

function checkAndCopyFiles(
    {
        checkIsValidFile,
        takeFile,
    }: {
        checkIsValidFile: (fileFullName: string) => boolean;
        takeFile?: (file: DroppedFileType | string) => boolean;
    },
    dirPath: string,
    file: DroppedFileType | string,
) {
    const isString = typeof file === 'string';
    if (!takeFile?.(file) && checkIsValidFile(isString ? file : file.name)) {
        return fsCopyFilePathToPath(file, dirPath);
    }
    return null;
}

export function genOnDrop({
    dirSource,
    mimetypeName,
    checkIsExtraFile,
    takeDroppedFile,
}: {
    dirSource: DirSource;
    mimetypeName: MimetypeNameType;
    checkIsExtraFile?: (fileFullName: string) => boolean;
    takeDroppedFile?: (file: DroppedFileType) => boolean;
}) {
    const checkIsValidFile = (fileFullName: string) => {
        return (
            checkIsExtraFile?.(fileFullName) ||
            isSupportedExt(fileFullName, mimetypeName)
        );
    };
    return async (event: React.DragEvent<HTMLDivElement>) => {
        changeDragEventStyle(event, 'opacity', '1');
        event.preventDefault();
        if (dirSource.dirPath === null) {
            showSimpleToast('Open Folder', 'Please open a folder first');
            return;
        }
        const promises = [];
        for await (const file of readDroppedFiles(event)) {
            const copyingPromise = checkAndCopyFiles(
                {
                    checkIsValidFile,
                    takeFile: takeDroppedFile,
                },
                dirSource.dirPath,
                file,
            );
            if (copyingPromise !== null) {
                promises.push(copyingPromise);
            }
        }
        await Promise.all(promises);
    };
}

export type FileSelectionOptionType = {
    windowTitle: string;
    extensions: string[];

    dirPath: string;
    onFileSelected?: (filePaths: string[]) => void;
    takeSelectedFile?: (filePath: string) => boolean;
};

export async function handleFilesSelectionMenuItem(
    fileSelectionOption: FileSelectionOptionType,
) {
    const {
        dirPath,
        windowTitle,
        extensions,
        onFileSelected,
        takeSelectedFile,
    } = fileSelectionOption;
    const filePaths = selectFiles([{ name: windowTitle, extensions }]);
    onFileSelected?.(filePaths);
    const promises = [];
    for (const filePath of filePaths) {
        const copyingPromise = checkAndCopyFiles(
            {
                checkIsValidFile: () => true,
                takeFile: () => {
                    return !!takeSelectedFile?.(filePath);
                },
            },
            dirPath,
            filePath,
        );
        if (copyingPromise !== null) {
            promises.push(copyingPromise);
        }
    }
    await Promise.all(promises);
}

export function genOnContextMenu(
    dirSource: DirSource,
    {
        contextMenuItems,
        genContextMenuItems,
        addItems,
        onStartNewFile,
    }: {
        contextMenuItems?: ContextMenuItemType[];
        genContextMenuItems?: (
            dirSource: DirSource,
            event: React.MouseEvent<HTMLElement>,
        ) => OptionalPromise<ContextMenuItemType[]>;
        addItems?: () => void;
        onStartNewFile?: () => void;
    },
) {
    if (!dirSource.dirPath) {
        return;
    }
    return async (event: React.MouseEvent<any>) => {
        const menuItems: ContextMenuItemType[] = [...(contextMenuItems ?? [])];
        if (addItems !== undefined) {
            menuItems.push({
                menuElement: '`Add Items',
                onSelect: addItems,
            });
        }
        if (onStartNewFile !== undefined) {
            menuItems.push({
                menuElement: '`Create New File',
                onSelect: onStartNewFile,
            });
        }
        if (genContextMenuItems !== undefined) {
            const subContextMenuItems = await genContextMenuItems(
                dirSource,
                event,
            );
            menuItems.push(...subContextMenuItems);
        }
        if (menuItems.length === 0) {
            return;
        }
        showAppContextMenu(event as any, menuItems);
    };
}
