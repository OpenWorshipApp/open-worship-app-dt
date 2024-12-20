import { lazy, useState } from 'react';

import FileReadError from './FileReadError';
import {
    ContextMenuItemType, showAppContextMenu,
} from '../others/AppContextMenu';
import {
    copyToClipboard, openExplorer, trashFile,
} from '../server/appHelpers';
import FileSource from '../helper/FileSource';
import ItemSource from '../helper/ItemSource';
import appProvider from '../server/appProvider';
import { useFileSourceRefreshEvents } from '../helper/dirSourceHelpers';
import { openAppConfirm } from '../alert/alertHelpers';
import ItemColorNote from './ItemColorNote';
const LazyRenderRenaming = lazy(() => {
    return import('./RenderRenaming');
});

export const genCommonMenu = (filePath: string): ContextMenuItemType[] => {
    return [
        {
            menuTitle: 'Copy Path to Clipboard', onClick: () => {
                copyToClipboard(filePath);
            },
        },
        {
            menuTitle: (
                `Reveal in ${appProvider.systemUtils.isMac ?
                    'Finder' : 'File Explorer'}`
            ),
            onClick: () => {
                openExplorer(filePath);
            },
        },
    ];
};

function genContextMenu(
    filePath: string, setIsRenaming: (value: boolean) => void,
    reload: () => void,

): ContextMenuItemType[] {
    return [
        {
            menuTitle: 'Duplicate',
            onClick: () => {
                FileSource.getInstance(filePath).duplicate();
            },
        }, {
            menuTitle: 'Rename',
            onClick: () => {
                setIsRenaming(true);
            },
        }, {
            menuTitle: 'Reload',
            onClick: () => {
                reload();
            },
        },
    ];
}

export function genTrashContextMenu(
    filePath: string, onTrashed?: () => void,
): ContextMenuItemType[] {
    return [
        {
            menuTitle: 'Move to Trash',
            onClick: async () => {
                const fileSource = FileSource.getInstance(filePath);
                const isOk = await openAppConfirm(
                    'Moving File to Trash',
                    'Are you sure you want to move ' +
                    `"${fileSource.fileFullName}" to trash?`,
                );
                if (isOk) {
                    await trashFile(filePath);
                    onTrashed?.();
                }
            },
        },
    ];
}

export function genShowOnScreensContextMenu(
    onClick: (event: any) => void,
): ContextMenuItemType[] {
    return [
        {
            menuTitle: 'Show on Screens',
            onClick,
        },
    ];
}

export default function FileItemHandler({
    data, reload, index, filePath, className,
    contextMenuItems, onDrop, onClick, renderChild,
    isPointer, onTrashed, isDisabledColorNote,
    userClassName,
}: Readonly<{
    data: ItemSource<any> | null | undefined,
    reload: () => void,
    index: number,
    filePath: string,
    className?: string
    contextMenuItems?: ContextMenuItemType[],
    onDrop?: (event: any) => void,
    onClick?: () => void,
    renderChild: (lyric: ItemSource<any>) => any,
    isPointer?: boolean,
    onTrashed?: () => void,
    isDisabledColorNote?: boolean,
    userClassName?: string,
}>) {
    const [isRenaming, setIsRenaming] = useState(false);
    useFileSourceRefreshEvents(['select']);
    const applyClick = () => {
        FileSource.getInstance(filePath).fireSelectEvent();
        onClick?.();
    };
    const selfContextMenu = genContextMenu(
        filePath, setIsRenaming, reload,
    );
    selfContextMenu.push(...genTrashContextMenu(filePath, onTrashed));

    const handleContextMenuOpening = (event: any) => {
        showAppContextMenu(event, selfContextMenu);
    };
    if (data === null) {
        return null;
    }
    if (data === undefined) {
        return <FileReadError onContextMenu={handleContextMenuOpening} />;
    }
    const moreClassName = (
        `${data.isSelected ? 'active' : ''} ` + `${className ?? ''}`
    );
    const fileSource = FileSource.getInstance(filePath);
    return (
        <li className={
            `list-group-item m-1 ${moreClassName} ` +
            `${userClassName ?? ''} ${isPointer ? 'pointer' : ''}`
        }
            style={{
                borderRadius: '0.25rem',
            }}
            onClick={applyClick}
            data-index={index + 1}
            title={filePath}
            onContextMenu={(event) => {
                showAppContextMenu(event as any, [
                    ...(contextMenuItems || []),
                    ...genCommonMenu(filePath),
                    ...selfContextMenu,
                ]);
            }}
            onDragOver={(event) => {
                if (onDrop) {
                    event.preventDefault();
                    event.currentTarget.classList.add('receiving-child');
                }
            }}
            onDragLeave={(event) => {
                if (onDrop) {
                    event.preventDefault();
                    event.currentTarget.classList.remove('receiving-child');
                }
            }}
            onDrop={(event) => {
                if (onDrop) {
                    event.currentTarget.classList.remove('receiving-child');
                    onDrop(event);
                }
            }}>
            {isRenaming ? (
                <LazyRenderRenaming
                    setIsRenaming={setIsRenaming}
                    filePath={filePath}
                />
            ) :
                <>
                    {renderChild(data)}
                    {!isDisabledColorNote && (
                        <div className='color-note-container'>
                            <ItemColorNote item={fileSource} />
                        </div>
                    )}
                </>
            }
        </li>
    );
}
