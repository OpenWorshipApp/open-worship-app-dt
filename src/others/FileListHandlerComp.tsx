import { createContext, lazy, useState } from 'react';

import PathSelectorComp from './PathSelectorComp';
import { MimetypeNameType, fsCheckDirExist } from '../server/fileHelpers';
import FileSource from '../helper/FileSource';
import RenderListComp from './RenderListComp';
import DirSource from '../helper/DirSource';
import {
    genOnDragOver,
    genOnDragLeave,
    genOnDrop,
    genOnContextMenu,
    DroppedFileType,
    FileSelectionOptionType,
    handleFilesSelectionMenuItem,
} from './droppingFileHelpers';
import appProvider from '../server/appProvider';
import { useAppEffect } from '../helper/debuggerHelpers';
import { handleError } from '../helper/errorHelpers';
import NoDirSelectedComp from './NoDirSelectedComp';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';

const LazyAskingNewNameComp = lazy(() => {
    return import('./AskingNewNameComp');
});

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
            (eventType, fileFullName) => {
                if (fileFullName === null) {
                    return;
                }
                if (eventType === 'rename') {
                    dirSource.fireReloadEvent();
                }
            },
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
    contextMenu,
    onNewFile,
    checkExtraFile,
    takeDroppedFile,
    userClassName,
    defaultFolderName,
    fileSelectionOption,
    checkIsOnScreen,
}: Readonly<{
    className: string;
    mimetypeName: MimetypeNameType;
    dirSource: DirSource;
    header?: any;
    bodyHandler: (filePaths: string[]) => any;
    onNewFile?: (dirPath: string, newName: string) => Promise<boolean>;
    onFileDeleted?: (filePath: string) => void;
    contextMenu?: ContextMenuItemType[];
    checkExtraFile?: (filePath: string) => boolean;
    takeDroppedFile?: (file: DroppedFileType) => boolean;
    userClassName?: string;
    defaultFolderName?: string;
    fileSelectionOption?: FileSelectionOptionType;
    checkIsOnScreen?: (filePaths: string[]) => Promise<boolean>;
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
                className={`${className} card w-100 h-100 app-inner-shadow ${userClassName ?? ''}`}
                onDragOver={genOnDragOver(dirSource)}
                onDragLeave={genOnDragLeave()}
                onDrop={genOnDrop({
                    dirSource,
                    mimetypeName: mimetypeName,
                    checkIsExtraFile: checkExtraFile,
                    takeDroppedFile,
                })}
            >
                {header !== undefined ? (
                    <div
                        className="card-header"
                        style={{
                            maxHeight: '35px',
                        }}
                    >
                        <strong className={isOnScreen ? 'app-on-screen' : ''}>
                            {header}
                        </strong>
                        {onNewFile && dirSource.dirPath ? (
                            <div
                                className="float-end app-caught-hover-pointer"
                                title="`New File"
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
                    onContextMenu={genOnContextMenu(dirSource, {
                        contextMenu,
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
                        addItems={handleItemsAdding}
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
                    <ScrollingHandlerComp shouldSnowPlayToBottom={false} />
                </div>
            </div>
        </DirSourceContext>
    );
}
