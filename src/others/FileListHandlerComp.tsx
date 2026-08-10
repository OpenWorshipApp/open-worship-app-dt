import type { MouseEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

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
} from './droppingFileHelpers';
import NoDirSelectedComp from './NoDirSelectedComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';
import type { OptionalPromise } from '../helper/typeHelpers';
import {
    DirSourceContext,
    useDirSourceWatching,
    useFilePaths,
} from '../helper/dirSourceHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import FileListFilterIconsComp, {
    FileListFilterInputComp,
} from './FileListFilterComp';
import { useFileListFilterData } from './fileListFilterHelpers';
import AskingNewNameComp from './AskingNewNameComp';
import StickyAutoHideComp from './StickyAutoHideComp';
import EmptyFileListComp from './EmptyFileListComp';

export type FileListType = FileSource[] | null | undefined;

/**
 * One kind of file the list can create. A list that holds more than one kind
 * (the documents list holds slide documents and lyrics) declares them here and
 * each gets its own entry in the list menu, so `title` reads as an action
 * ("New Lyric") rather than as a type name. Falls back to a lone "New File".
 */
export type NewFileKindType = {
    key: string | null;
    title: string;
    iconName: string;
};
const DEFAULT_NEW_FILE_KINDS: NewFileKindType[] = [
    { key: null, title: 'New File', iconName: 'file-earmark-plus' },
];
type NewFileHandlerType = (
    dirPath: string,
    newName: string,
    kindKey: string | null,
) => Promise<boolean>;

/**
 * The list's only button: it opens the same menu as right-clicking the empty
 * card body. Lists with a header put it there; header-less lists (the
 * background/foreground tabs) put it in the path row, where their old `+` was —
 * otherwise those tabs would have no button at all.
 */
function ListMenuButtonComp({
    onShowMenu,
    className,
}: Readonly<{
    // `undefined` when the list has no directory to act on.
    onShowMenu?: (event: any) => void;
    className: string;
}>) {
    const onShowMenuRef = useAppCurrentRef(onShowMenu);
    const handleClicking = useCallback((event: MouseEvent) => {
        // the path row itself toggles the path editor on click
        event.stopPropagation();
        onShowMenuRef.current?.(event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (onShowMenu === undefined) {
        return null;
    }
    return (
        <div
            className={`app-caught-hover-pointer ${className}`}
            title={tran('More Options')}
            onClick={handleClicking}
            style={{
                color: 'var(--bs-secondary-color)',
                fontSize: '17px',
            }}
        >
            <i className="bi bi-three-dots-vertical" />
        </div>
    );
}

function RenderHeaderComp({
    isOnScreen,
    header,
    onShowMenu,
}: Readonly<{
    isOnScreen: boolean;
    header: any;
    onShowMenu?: (event: any) => void;
}>) {
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
            <ListMenuButtonComp onShowMenu={onShowMenu} className="float-end" />
        </div>
    );
}

type PropsType = {
    className: string;
    mimetypeName: MimetypeNameType;
    extraMimetypeNames?: MimetypeNameType[];
    dirSource: DirSource;
    header?: any;
    bodyHandler: (filePaths: string[], colorNote?: string) => any;
    onNewFile?: NewFileHandlerType;
    newFileKinds?: NewFileKindType[];
    onFileDeleted?: (filePath: string) => void;
    contextMenuItems?: ContextMenuItemType[];
    genContextMenuItems?: (
        dirSource: DirSource,
        event?: MouseEvent<HTMLElement>,
    ) => OptionalPromise<ContextMenuItemType[]>;
    checkExtraFile?: (filePath: string) => boolean;
    takeDroppedFile?: (file: DroppedFileType) => boolean;
    userClassName?: string;
    defaultFolderName?: string;
    fileSelectionOption?: FileSelectionOptionType;
    checkIsOnScreen?: (filePaths: string[]) => Promise<boolean>;
    onItemsAdding?: (
        defaultContextMenuItems: ContextMenuItemType[],
        event: any,
    ) => void;
    sortFilePaths?: (filePaths: string[]) => string[];
    disableColorNoteGrouping?: boolean;
};

export default function FileListHandlerComp({
    className,
    mimetypeName,
    extraMimetypeNames = [],
    dirSource,
    header,
    bodyHandler,
    contextMenuItems,
    genContextMenuItems,
    onNewFile,
    newFileKinds,
    checkExtraFile,
    takeDroppedFile,
    userClassName,
    defaultFolderName,
    fileSelectionOption,
    checkIsOnScreen,
    onItemsAdding,
    sortFilePaths,
    disableColorNoteGrouping,
}: Readonly<PropsType>) {
    const [isOnScreen, setIsOnScreen] = useState(false);
    const onNewFileRef = useAppCurrentRef(onNewFile);
    const dirSourceRef = useAppCurrentRef(dirSource);
    const [newFileKindKey, setNewFileKindKey] = useState<string | null>(null);
    const newFileKindKeyRef = useAppCurrentRef(newFileKindKey);
    const handleNameApplying = useCallback(async (name: string | null) => {
        if (name === null) {
            setIsCreatingNew(false);
            return;
        }
        onNewFileRef
            .current?.(
                dirSourceRef.current.dirPath,
                name,
                newFileKindKeyRef.current,
            )
            .then((isSuccess) => {
                setIsCreatingNew(isSuccess);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    // Every kind the list can create gets its own top-level menu entry, so a
    // list holding documents and lyrics advertises both without a nested step.
    // The items are built when the menu opens, not memoized: `tran` must run
    // after a locale switch, not once at mount.
    const genNewFileMenuItems = useMemo(() => {
        if (onNewFile === undefined) {
            return undefined;
        }
        const kinds = newFileKinds ?? DEFAULT_NEW_FILE_KINDS;
        return () => {
            return kinds.map((kind) => {
                return {
                    childBefore: genContextMenuItemIcon(kind.iconName),
                    menuElement: tran(kind.title),
                    onSelect: () => {
                        setNewFileKindKey(kind.key);
                        setIsCreatingNew(true);
                    },
                };
            });
        };
    }, [onNewFile, newFileKinds]);
    useDirSourceWatching(dirSource);
    // The file list is read here rather than inside `RenderListComp` because
    // the filter/sort icons live up in the path title row and need to know
    // which document types the directory actually holds.
    const filePaths = useFilePaths(dirSource, [
        mimetypeName,
        ...extraMimetypeNames,
    ]);
    const filterData = useFileListFilterData(dirSource);
    const handleItemsAdding = useMemo(() => {
        if (fileSelectionOption === undefined) {
            return undefined;
        }
        return (event: any) => {
            if (onItemsAdding === undefined) {
                handleFilesSelectionMenuItem(fileSelectionOption);
                return;
            }
            const menuItems: ContextMenuItemType[] = [
                {
                    childBefore: genContextMenuItemIcon('plus-lg'),
                    menuElement: tran('Add Local Files'),
                    onSelect: () => {
                        handleFilesSelectionMenuItem(fileSelectionOption);
                    },
                },
            ];
            onItemsAdding(menuItems, event);
        };
    }, [onItemsAdding, fileSelectionOption]);
    const noDirFolderName = dirSource.dirPath ? undefined : defaultFolderName;
    const contextMenuOptions = {
        contextMenuItems,
        genContextMenuItems,
        addItems: handleItemsAdding,
        genNewFileMenuItems,
    };
    const handleMenuShowing = genDroppingFileOnContextMenu(
        dirSource,
        contextMenuOptions,
    );
    // A directory that holds nothing renders an empty card body, with the
    // right-click menu as its only, invisible, way in. `undefined`/`null` are
    // still loading and failed to read, both of which `RenderListComp` speaks
    // to itself.
    const isEmptyDir = !!dirSource.dirPath && filePaths?.length === 0;
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
                        onShowMenu={handleMenuShowing}
                    />
                ) : null}
                <div
                    className="card-body d-flex flex-column pb-5 app-inner-shadow"
                    onContextMenu={handleMenuShowing}
                >
                    <StickyAutoHideComp>
                        <PathSelectorComp
                            prefix={`path-${className}`}
                            dirSource={dirSource}
                            extraElements={
                                <>
                                    <FileListFilterIconsComp
                                        filePaths={filePaths ?? []}
                                        filterData={filterData}
                                    />
                                    {header ? null : (
                                        <ListMenuButtonComp
                                            onShowMenu={handleMenuShowing}
                                            className="px-1"
                                        />
                                    )}
                                </>
                            }
                        />
                        {noDirFolderName === undefined &&
                        filterData.isSearchShowing ? (
                            <FileListFilterInputComp filterData={filterData} />
                        ) : null}
                    </StickyAutoHideComp>
                    {noDirFolderName !== undefined ? (
                        <NoDirSelectedComp
                            dirSource={dirSource}
                            defaultFolderName={noDirFolderName}
                        />
                    ) : (
                        <ul className="list-group flex-fill d-flex">
                            {onNewFile !== undefined && isCreatingNew ? (
                                <AskingNewNameComp
                                    applyName={handleNameApplying}
                                />
                            ) : null}
                            <RenderListComp
                                dirSource={dirSource}
                                filePaths={filePaths}
                                filterData={filterData}
                                bodyHandler={bodyHandler}
                                setIsOnScreen={setIsOnScreen}
                                checkIsOnScreen={checkIsOnScreen}
                                sortFilePaths={sortFilePaths}
                                disableColorNoteGrouping={
                                    disableColorNoteGrouping
                                }
                            />
                            {isEmptyDir && !isCreatingNew ? (
                                <EmptyFileListComp
                                    dirSource={dirSource}
                                    contextMenuOptions={contextMenuOptions}
                                />
                            ) : null}
                        </ul>
                    )}
                    <ScrollingHandlerComp shouldShowPlayToBottom={false} />
                </div>
            </div>
        </DirSourceContext>
    );
}
