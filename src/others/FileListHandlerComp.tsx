import type { MouseEvent } from 'react';
import { lazy, useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import PathSelectorComp from './PathSelectorComp';
import type { MimetypeNameType } from '../server/fileHelpers';
import type FileSource from '../helper/FileSource';
import RenderListComp from './RenderListComp';
import type DirSource from '../helper/DirSource';
import type {
    DroppedFileType,
    FileSelectionOptionType,
} from './droppingFileHelpers';
import {
    genOnDragOver,
    genOnDragLeave,
    genOnDrop,
    genDroppingFileOnContextMenu,
    handleFilesSelectionMenuItem,
    genItemsAddingContextMenuItems,
} from './droppingFileHelpers';
import NoDirSelectedComp from './NoDirSelectedComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';
import type { OptionalPromise } from '../helper/typeHelpers';
import {
    DirSourceContext,
    useDirSourceWatching,
} from '../helper/dirSourceHelpers';

const LazyAskingNewNameComp = lazy(() => {
    return import('./AskingNewNameComp');
});

export type FileListType = FileSource[] | null | undefined;

function RenderHeaderComp({
    isOnScreen,
    header,
    onNewFile,
    dirSource,
    setIsCreatingNew,
}: Readonly<{
    isOnScreen: boolean;
    header: any;
    onNewFile?: (dirPath: string, newName: string) => Promise<boolean>;
    dirSource: DirSource;
    setIsCreatingNew: (isCreating: boolean) => void;
}>) {
    const handleSetCreatingNew = useCallback(() => {
        setIsCreatingNew(true);
    }, [setIsCreatingNew]);
    return (
        <div
            className="card-header"
            style={{
                maxHeight: '30px',
            }}
        >
            <strong className={isOnScreen ? 'app-on-screen' : ''}>
                {header}
            </strong>
            {onNewFile && dirSource.dirPath ? (
                <div
                    className="float-end app-caught-hover-pointer"
                    title={tran('New File')}
                    onClick={handleSetCreatingNew}
                    style={{
                        color: 'var(--bs-info-text-emphasis)',
                        fontSize: '20px',
                    }}
                >
                    <i className="bi bi-file-earmark-plus" />
                </div>
            ) : null}
        </div>
    );
}

type PropsType = {
    className: string;
    mimetypeName: MimetypeNameType;
    dirSource: DirSource;
    header?: any;
    bodyHandler: (filePaths: string[]) => any;
    onNewFile?: (dirPath: string, newName: string) => Promise<boolean>;
    onFileDeleted?: (filePath: string) => void;
    contextMenuItems?: ContextMenuItemType[];
    genContextMenuItems?: (
        dirSource: DirSource,
        event: MouseEvent<HTMLElement>,
    ) => OptionalPromise<ContextMenuItemType[]>;
    checkExtraFile?: (filePath: string) => boolean;
    takeDroppedFile?: (file: DroppedFileType) => boolean;
    userClassName?: string;
    defaultFolderName?: string;
    fileSelectionOption?: FileSelectionOptionType;
    checkIsOnScreen?: (filePaths: string[]) => Promise<boolean>;
    onItemsAdding?: (
        event: any,
        defaultContextMenuItems: ContextMenuItemType[],
    ) => void;
    sortFilePaths?: (filePaths: string[]) => string[];
};

export default function FileListHandlerComp({
    className,
    mimetypeName,
    dirSource,
    header,
    bodyHandler,
    contextMenuItems,
    genContextMenuItems,
    onNewFile,
    checkExtraFile,
    takeDroppedFile,
    userClassName,
    defaultFolderName,
    fileSelectionOption,
    checkIsOnScreen,
    onItemsAdding,
    sortFilePaths,
}: Readonly<PropsType>) {
    const [isOnScreen, setIsOnScreen] = useState(false);
    const handleNameApplying = useCallback(
        async (name: string | null) => {
            if (name === null) {
                setIsCreatingNew(false);
                return;
            }
            onNewFile?.(dirSource.dirPath, name).then((isSuccess) => {
                setIsCreatingNew(isSuccess);
            });
        },
        [onNewFile, dirSource],
    );
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    useDirSourceWatching(dirSource);
    const handleItemsAdding =
        fileSelectionOption === undefined
            ? undefined
            : () => {
                  handleFilesSelectionMenuItem(fileSelectionOption);
              };
    // Do not use `useCallback` for `handleItemsAdding`, undefined value is
    // needed for checking whether to show the menu item in
    // `genContextMenuItems`
    const handleItemAdding =
        onItemsAdding === undefined
            ? (handleItemsAdding ?? (() => {}))
            : (event: any) => {
                  onItemsAdding(
                      genItemsAddingContextMenuItems(handleItemsAdding),
                      event,
                  );
              };
    return (
        <DirSourceContext value={dirSource}>
            <div
                className={
                    `${className} card w-100 h-100 app-inner-shadow` +
                    ` ${userClassName ?? ''} app-zero-border-radius`
                }
                onDragOver={genOnDragOver(dirSource)}
                onDragLeave={genOnDragLeave()}
                tabIndex={0}
                onDrop={genOnDrop({
                    dirSource,
                    mimetypeName: mimetypeName,
                    checkIsExtraFile: checkExtraFile,
                    takeDroppedFile,
                })}
            >
                {header ? (
                    <RenderHeaderComp
                        isOnScreen={isOnScreen}
                        header={header}
                        onNewFile={onNewFile}
                        dirSource={dirSource}
                        setIsCreatingNew={setIsCreatingNew}
                    />
                ) : null}
                <div
                    className="card-body d-flex flex-column pb-5 app-inner-shadow"
                    onContextMenu={genDroppingFileOnContextMenu(dirSource, {
                        contextMenuItems,
                        genContextMenuItems,
                        addItems: handleItemsAdding,
                        onStartNewFile:
                            onNewFile === undefined
                                ? undefined
                                : () => {
                                      setIsCreatingNew(true);
                                  },
                    })}
                >
                    <PathSelectorComp
                        prefix={`path-${className}`}
                        dirSource={dirSource}
                        addItems={handleItemAdding}
                    />
                    {!dirSource.dirPath && defaultFolderName ? (
                        <NoDirSelectedComp
                            dirSource={dirSource}
                            defaultFolderName={defaultFolderName}
                        />
                    ) : (
                        <ul className="list-group flex-fill d-flex">
                            {onNewFile !== undefined && isCreatingNew ? (
                                <LazyAskingNewNameComp
                                    applyName={handleNameApplying}
                                />
                            ) : null}
                            <RenderListComp
                                dirSource={dirSource}
                                bodyHandler={bodyHandler}
                                mimetypeName={mimetypeName}
                                setIsOnScreen={setIsOnScreen}
                                checkIsOnScreen={checkIsOnScreen}
                                sortFilePaths={sortFilePaths}
                            />
                        </ul>
                    )}
                    <ScrollingHandlerComp shouldShowPlayToBottom={false} />
                </div>
            </div>
        </DirSourceContext>
    );
}
