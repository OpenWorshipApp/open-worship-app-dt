import type { MouseEvent } from 'react';
import { createContext, lazy, useState } from 'react';

import { tran } from '../lang/langHelpers';
import PathSelectorComp from './PathSelectorComp';
import type { MimetypeNameType } from '../server/fileHelpers';
import { fsCheckDirExist } from '../server/fileHelpers';
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
import appProvider from '../server/appProvider';
import { useAppEffect } from '../helper/debuggerHelpers';
import { handleError } from '../helper/errorHelpers';
import NoDirSelectedComp from './NoDirSelectedComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';
import type { OptionalPromise } from '../helper/typeHelpers';
import { checkAreArraysEqual } from '../server/comparisonHelpers';

const LazyAskingNewNameComp = lazy(() => {
    return import('./AskingNewNameComp');
});

async function handleFileChanging(
    dirSource: DirSource,
    eventType: string,
    fileFullName: string | null,
) {
    if (fileFullName === null) {
        return;
    }
    if (eventType !== 'rename') {
        return;
    }
    try {
        for (const mimetypeName of Object.keys(
            dirSource.filePathsMap,
        ) as MimetypeNameType[]) {
            const newFilePaths =
                await dirSource.getFilePathsQuick(mimetypeName);
            if (
                !checkAreArraysEqual(
                    dirSource.filePathsMap[mimetypeName],
                    newFilePaths,
                )
            ) {
                dirSource.fireReloadEvent();
            }
        }
    } catch (_error) {
        dirSource.fireReloadEvent();
    }
}
async function watchDir(dirSource: DirSource, signal: AbortSignal) {
    const isDirExist = await fsCheckDirExist(dirSource.dirPath);
    if (!isDirExist) {
        return;
    }
    try {
        appProvider.fileUtils.watch(
            dirSource.dirPath,
            {
                signal,
            },
            handleFileChanging.bind(null, dirSource),
        );
    } catch (error) {
        handleError(error);
    }
}

export const DirSourceContext = createContext<DirSource | null>(null);

export type FileListType = FileSource[] | null | undefined;

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
}: Readonly<{
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
}>) {
    const [isOnScreen, setIsOnScreen] = useState(false);
    const handleNameApplying = async (name: string | null) => {
        if (name === null) {
            setIsCreatingNew(false);
            return;
        }
        onNewFile?.(dirSource.dirPath, name).then((isSuccess) => {
            setIsCreatingNew(isSuccess);
        });
    };
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    useAppEffect(() => {
        const abortController = new AbortController();
        watchDir(dirSource, abortController.signal);
        return () => {
            abortController.abort();
        };
    }, [dirSource.dirPath]);
    const handleItemsAdding =
        fileSelectionOption === undefined
            ? undefined
            : () => {
                  handleFilesSelectionMenuItem(fileSelectionOption);
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
                                onClick={() => setIsCreatingNew(true)}
                                style={{
                                    color: 'var(--bs-info-text-emphasis)',
                                    fontSize: '20px',
                                }}
                            >
                                <i className="bi bi-file-earmark-plus" />
                            </div>
                        ) : null}
                    </div>
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
                        addItems={
                            onItemsAdding === undefined
                                ? handleItemsAdding
                                : onItemsAdding.bind(
                                      null,
                                      genItemsAddingContextMenuItems(
                                          handleItemsAdding,
                                      ),
                                  )
                        }
                    />
                    {!dirSource.dirPath && defaultFolderName ? (
                        <NoDirSelectedComp
                            dirSource={dirSource}
                            defaultFolderName={defaultFolderName}
                        />
                    ) : (
                        <ul className="list-group flex-fill d-flex app-inner-shadow">
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
                            />
                        </ul>
                    )}
                    <ScrollingHandlerComp shouldShowPlayToBottom={false} />
                </div>
            </div>
        </DirSourceContext>
    );
}
