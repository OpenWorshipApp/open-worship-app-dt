import React, { useCallback, useState } from 'react';
import FileReadError from './FileReadError';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../others/AppContextMenu';
import {
    copyToClipboard, openExplorer,
} from '../server/appHelper';
import FileSource from '../helper/FileSource';
import ItemSource from '../helper/ItemSource';
import appProvider from '../server/appProvider';
import { useFSEvents } from '../helper/dirSourceHelpers';
import { openConfirm } from '../alert/alertHelpers';
import ItemColorNote from './ItemColorNote';

const RenderRenaming = React.lazy(() => {
    return import('./RenderRenaming');
});

export const genCommonMenu = (fileSource: FileSource) => {
    return [
        {
            title: 'Copy Path to Clipboard', onClick: () => {
                copyToClipboard(fileSource.filePath);
            },
        },
        {
            title: `Reveal in ${appProvider.systemUtils.isMac ?
                'Finder' : 'File Explorer'}`,
            onClick: () => {
                openExplorer(fileSource.filePath);
            },
        },
    ];
};


export default function FileItemHandler({
    data, reload, index, fileSource, className,
    contextMenu, onDrop, onClick, renderChild,
    isPointer, onDelete, isDisabledColorNote,
}: {
    data: ItemSource<any> | null | undefined,
    reload: () => void,
    index: number,
    fileSource: FileSource,
    className?: string
    contextMenu?: ContextMenuItemType[],
    onDrop?: (event: any) => void,
    onClick?: () => void,
    renderChild: (lyric: ItemSource<any>) => any,
    isPointer?: boolean,
    onDelete?: () => void,
    isDisabledColorNote?: boolean,
}) {
    const [isRenaming, setIsRenaming] = useState(false);
    useFSEvents(['select'], fileSource);
    const applyClick = () => {
        fileSource.fireSelectEvent();
        onClick?.();
    };
    const selfContextMenu = [
        {
            title: 'Duplicate',
            onClick: () => {
                fileSource.duplicate();
            },
        }, {
            title: 'Rename',
            onClick: () => {
                setIsRenaming(true);
            },
        }, {
            title: 'Reload',
            onClick: () => {
                reload();
            },
        }, {
            title: 'Delete',
            onClick: async () => {
                const isOk = await openConfirm(
                    `Deleting "${fileSource.fileName}"`,
                    'Are you sure to delete this file?');
                if (isOk) {
                    await fileSource.delete();
                    onDelete?.();
                }
            },
        }];
    const callContextMenu = useCallback((event: any) => {
        showAppContextMenu(event, selfContextMenu);
    }, [selfContextMenu]);
    if (data === null) {
        return null;
    }
    if (data === undefined) {
        return <FileReadError onContextMenu={callContextMenu} />;
    }
    const moreClassName = `${data.isSelected ? 'active' : ''} `
        + `${className || ''}`;
    return (
        <li className={`list-group-item mx-1 ${moreClassName} 
        ${isPointer ? 'pointer' : ''}`}
            onClick={applyClick}
            data-index={index + 1}
            title={fileSource.filePath}
            onContextMenu={(event) => {
                showAppContextMenu(event as any, [
                    ...(contextMenu || []),
                    ...genCommonMenu(fileSource),
                    ...selfContextMenu,
                ]);
            }}
            onDragOver={(event) => {
                if (onDrop) {
                    event.preventDefault();
                    event.currentTarget.classList
                        .add('receiving-child');
                }
            }}
            onDragLeave={(event) => {
                if (onDrop) {
                    event.preventDefault();
                    event.currentTarget.classList
                        .remove('receiving-child');
                }
            }}
            onDrop={(event) => {
                if (onDrop) {
                    event.currentTarget.classList
                        .remove('receiving-child');
                    onDrop(event);
                }
            }}>
            {isRenaming ? <RenderRenaming
                setIsRenaming={setIsRenaming}
                fileSource={fileSource} /> :
                <>
                    {renderChild(data)}
                    {!isDisabledColorNote &&
                        <div className='color-note-container'>
                            <ItemColorNote item={data.fileSource} />
                        </div>
                    }
                </>
            }
        </li>
    );
}
