import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import FileReadErrorComp from './FileReadErrorComp';
import {
    copyToClipboard,
    showFileOrDirExplorer,
    trashAllMaterialFiles,
} from '../server/appHelpers';
import FileSource from '../helper/FileSource';
import type { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import appProvider from '../server/appProvider';
import { useFileSourceRefreshEvents } from '../helper/dirSourceHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import ItemColorNoteComp from './ItemColorNoteComp';
import {
    getMenuTitleRevealFile,
    RECEIVING_DROP_CLASSNAME,
} from '../helper/helpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useFileSourceIsOnScreen } from '../_screen/screenHelpers';
import RenderRenamingComp from './RenderRenamingComp';
import LoadingComp from './LoadingComp';

export const genCommonMenu = (filePath: string): ContextMenuItemType[] => {
    return [
        {
            menuElement: tran('Copy Path to Clipboard'),
            onSelect: () => {
                copyToClipboard(filePath);
            },
        },
        {
            menuElement: getMenuTitleRevealFile(),
            onSelect: () => {
                showFileOrDirExplorer(filePath);
            },
        },
    ];
};

function genContextMenu(
    filePath: string,
    setIsRenaming: (value: boolean) => void,
    reload: () => void,
): ContextMenuItemType[] {
    return [
        {
            menuElement: tran('Duplicate'),
            onSelect: () => {
                FileSource.getInstance(filePath).duplicate();
            },
        },
        {
            menuElement: tran('Rename'),
            onSelect: () => {
                setIsRenaming(true);
            },
        },
        {
            menuElement: tran('Reload'),
            onSelect: () => {
                reload();
            },
        },
    ];
}

export function genTrashContextMenu(
    filePath: string,
    onTrashed?: () => void,
): ContextMenuItemType[] {
    return [
        {
            menuElement: tran('Move to Trash'),
            onSelect: async () => {
                const fileSource = FileSource.getInstance(filePath);
                const isOk = await showAppConfirm(
                    tran('Moving File to Trash'),
                    tran('Are you sure you want to move') +
                        ` "${fileSource.fullName}" ` +
                        tran('to trash?'),
                    {
                        confirmButtonLabel: 'Yes',
                    },
                );
                if (isOk) {
                    const fileSource = FileSource.getInstance(filePath);
                    await fileSource.trash();
                    await trashAllMaterialFiles(fileSource);
                    onTrashed?.();
                }
            },
        },
    ];
}

export function genShowOnScreensContextMenu(
    onClick: (event: any) => void,
): ContextMenuItemType[] {
    if (!appProvider.isPagePresenter) {
        return [];
    }
    return [
        {
            menuElement: tran('Show on Screens'),
            onSelect: onClick,
        },
    ];
}

export default function FileItemHandlerComp({
    fileData,
    reload,
    index,
    filePath,
    className,
    contextMenuItems,
    onDrop,
    onClick,
    renderChild,
    preDelete,
    isDisabledColorNote,
    userClassName,
    isSelected,
    renamedCallback,
    checkIsOnScreen,
}: Readonly<{
    fileData: AppDocumentSourceAbs | null | undefined;
    reload: () => void;
    index: number;
    filePath: string;
    className?: string;
    contextMenuItems?: ContextMenuItemType[];
    onDrop?: (event: any) => void;
    onClick?: () => void;
    renderChild: (data: AppDocumentSourceAbs) => any;
    preDelete?: () => void;
    isDisabledColorNote?: boolean;
    userClassName?: string;
    isSelected: boolean;
    renamedCallback?: (newFileSource: FileSource) => void;
    checkIsOnScreen?: (filePath: string) => Promise<boolean>;
}>) {
    const isOnScreen = useFileSourceIsOnScreen(
        [filePath],
        async (filePaths) => {
            if (checkIsOnScreen === undefined) {
                return false;
            }
            return await checkIsOnScreen(filePaths[0]);
        },
    );
    const [isRenaming, setIsRenaming] = useState(false);
    useFileSourceRefreshEvents(['select']);
    const handleClicking = useCallback(() => {
        FileSource.getInstance(filePath).fireSelectEvent();
        onClick?.();
    }, [filePath, onClick]);

    if (fileData === null) {
        return <FileReadErrorComp reload={reload} />;
    }
    const selfContextMenu = genContextMenu(filePath, setIsRenaming, reload);
    const preDelete1 = () => {
        fileData?.preDelete();
        preDelete?.();
    };
    selfContextMenu.push(...genTrashContextMenu(filePath, preDelete1));
    const moreClassName =
        `${isSelected ? 'active' : ''} ` + `${className ?? ''}`;
    const fileSource = FileSource.getInstance(filePath);
    const isPointer = !!onClick;
    return (
        <li
            className={
                `list-group-item ${moreClassName} app-overflow-hidden` +
                ` ${userClassName ?? ''} ${isPointer ? 'pointer' : ''}`
            }
            onClick={handleClicking}
            data-index={index + 1}
            title={fileSource.fullName}
            onContextMenu={(event) => {
                showAppContextMenu(event as any, [
                    ...(contextMenuItems ?? []),
                    ...genCommonMenu(filePath),
                    ...selfContextMenu,
                ]);
            }}
            onDragOver={(event) => {
                if (onDrop) {
                    event.preventDefault();
                    event.currentTarget.classList.add(RECEIVING_DROP_CLASSNAME);
                }
            }}
            onDragLeave={(event) => {
                if (onDrop) {
                    event.preventDefault();
                    event.currentTarget.classList.remove(
                        RECEIVING_DROP_CLASSNAME,
                    );
                }
            }}
            onDrop={(event) => {
                if (onDrop) {
                    event.currentTarget.classList.remove(
                        RECEIVING_DROP_CLASSNAME,
                    );
                    onDrop(event);
                }
            }}
        >
            {isRenaming ? (
                <RenderRenamingComp
                    setIsRenaming={setIsRenaming}
                    filePath={filePath}
                    renamedCallback={renamedCallback}
                />
            ) : (
                <>
                    <div
                        className={
                            'd-flex ' + (isOnScreen ? 'app-on-screen' : '')
                        }
                    >
                        {fileData === undefined ? (
                            <div
                                className="w-100 app-overflow-hidden p-1"
                                style={{ maxHeight: '45px' }}
                            >
                                <LoadingComp />
                            </div>
                        ) : (
                            renderChild(fileData)
                        )}
                    </div>
                    {isDisabledColorNote ? null : (
                        <div className="color-note-container">
                            <ItemColorNoteComp item={fileSource} />
                        </div>
                    )}
                </>
            )}
        </li>
    );
}
