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
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useFileSourceIsOnScreen } from '../_screen/screenHelpers';
import RenderRenamingComp from './RenderRenamingComp';
import LoadingComp from './LoadingComp';
import { useAppCurrentRef } from '../helper/appHooks';

export const genCommonMenu = (filePath: string): ContextMenuItemType[] => {
    return [
        {
            childBefore: genContextMenuItemIcon('clipboard'),
            menuElement: tran('Copy Path to Clipboard'),
            onSelect: () => {
                copyToClipboard(filePath);
            },
        },
        {
            childBefore: genContextMenuItemIcon('folder2-open'),
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
            childBefore: genContextMenuItemIcon('files'),
            menuElement: tran('Duplicate'),
            onSelect: () => {
                FileSource.getInstance(filePath).duplicate();
            },
        },
        {
            childBefore: genContextMenuItemIcon('input-cursor-text'),
            menuElement: tran('Rename'),
            onSelect: () => {
                setIsRenaming(true);
            },
        },
        {
            childBefore: genContextMenuItemIcon('arrow-clockwise'),
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
            childBefore: genContextMenuItemIcon('trash3', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Move to Trash'),
            onSelect: async () => {
                const fileSource = FileSource.getInstance(filePath);
                const isOk = await showAppConfirm(
                    tran('Moving File to Trash'),
                    tran('Are you sure you want to move') +
                        ` "${fileSource.fullName}" ` +
                        tran('to trash?'),
                    {
                        cancelButtonLabel: 'No',
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

/**
 * "Reveal Original" — point at wherever this element actually lives in the app.
 *
 * Takes the whole reveal action rather than an element getter: some origins need
 * their panel opened before they have an element at all (see
 * `notifyPresentingFlowItemOrigin`), and a getter-only signature had no way to say so.
 */
export function genRevealOriginal(reveal: () => void): ContextMenuItemType {
    return {
        childBefore: genContextMenuItemIcon('eye'),
        menuElement: tran('Reveal Original'),
        onSelect: reveal,
    };
}

/**
 * `label` is for the things that reach a screen without being SHOWN there — a
 * presenting flow's clear actions are run on it — so the menu says what will actually
 * happen while keeping one screen-choosing entry point.
 */
export function genShowOnScreensContextMenu(
    onClick: (event: any) => void,
    label = 'Show on Screens',
): ContextMenuItemType[] {
    if (!appProvider.isPagePresenter) {
        return [];
    }
    return [
        {
            childBefore: genContextMenuItemIcon('display'),
            menuElement: tran(label),
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
    onDragStart,
}: Readonly<{
    fileData: AppDocumentSourceAbs | null | undefined;
    reload: () => void;
    index: number;
    filePath: string;
    className?: string;
    contextMenuItems?: ContextMenuItemType[];
    onDrop?: (event: any) => void;
    onClick?: (event: any) => void;
    renderChild: (data: AppDocumentSourceAbs) => any;
    preDelete?: () => void;
    isDisabledColorNote?: boolean;
    userClassName?: string;
    isSelected: boolean;
    renamedCallback?: (newFileSource: FileSource) => void;
    checkIsOnScreen?: (filePath: string) => Promise<boolean>;
    // Set to make the row draggable (a document dragged into a presenting flow).
    onDragStart?: (event: any) => void;
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
    const filePathRef = useAppCurrentRef(filePath);
    const onClickRef = useAppCurrentRef(onClick);
    // The event is forwarded so a row can read its modifiers — a Ctrl/⌘ click on
    // a document opens its floating slides preview instead of selecting it.
    const handleClicking = useCallback((event: any) => {
        FileSource.getInstance(filePathRef.current).fireSelectEvent();
        onClickRef.current?.(event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const reloadRef = useAppCurrentRef(reload);
    const fileDataRef = useAppCurrentRef(fileData);
    const preDeleteRef = useAppCurrentRef(preDelete);
    const contextMenuItemsRef = useAppCurrentRef(contextMenuItems);
    const handleContextMenuOpening = useCallback((event: any) => {
        const selfContextMenu = genContextMenu(
            filePathRef.current,
            setIsRenaming,
            reloadRef.current,
        );
        const preDelete1 = () => {
            fileDataRef.current?.preDelete();
            preDeleteRef.current?.();
        };
        selfContextMenu.push(
            ...genTrashContextMenu(filePathRef.current, preDelete1),
        );
        showAppContextMenu(event, [
            ...(contextMenuItemsRef.current ?? []),
            ...genCommonMenu(filePathRef.current),
            ...selfContextMenu,
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onDropRef = useAppCurrentRef(onDrop);
    const handleDragOver = useCallback((event: any) => {
        if (onDropRef.current) {
            event.preventDefault();
            event.currentTarget.classList.add(RECEIVING_DROP_CLASSNAME);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDragLeave = useCallback((event: any) => {
        if (onDropRef.current) {
            event.preventDefault();
            event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDropEvent = useCallback((event: any) => {
        if (onDropRef.current) {
            event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
            onDropRef.current(event);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (fileData === null) {
        return (
            <FileReadErrorComp
                reload={reload}
                fileSource={FileSource.getInstance(filePath)}
            />
        );
    }
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
            data-file-item-file-src={fileSource.src}
            title={fileSource.fullName}
            onContextMenu={isRenaming ? undefined : handleContextMenuOpening}
            draggable={!isRenaming && onDragStart !== undefined}
            onDragStart={onDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropEvent}
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
