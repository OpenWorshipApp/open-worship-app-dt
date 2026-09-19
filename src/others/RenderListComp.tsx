import { useMemo } from 'react';

import type DirSource from '../helper/DirSource';
import LoadingComp from './LoadingComp';
import { GotoSettingDirectoryPathComp } from './NoDirSelectedComp';
import { useFileSourceIsOnScreen } from '../_screen/screenHelpers';
import { tran } from '../lang/langHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import {
    genColorBar,
    genColorNoteDataList,
    genFilePathColorMap,
} from '../helper/colorNoteHelpers';
import type { FileListFilterDataType } from './fileListFilterHelpers';
import {
    filterFilePaths,
    genCombinedSortFilePaths,
    MIN_FILTERABLE_FILE_COUNT,
} from './fileListFilterHelpers';

// Kept module-level so the filtering `useMemo` below does not see a new empty
// array on every render while the file list is still loading.
const EMPTY_FILE_PATHS: string[] = [];

function toIsCollapsedSettingName(dirSource: DirSource, colorNote: string) {
    return `${dirSource.settingName}-color-note-collapsed-${colorNote}`;
}

// Collapsing does not just hide the items, it stops rendering them at all,
// which is what makes a long list cheap on a low-spec machine.
function ColorNoteGroupComp({
    dirSource,
    colorNote,
    filePaths,
    bodyHandler,
}: Readonly<{
    dirSource: DirSource;
    colorNote: string;
    filePaths: string[];
    bodyHandler: (filePaths: string[], colorNote?: string) => any;
}>) {
    const [isCollapsed, setIsCollapsed] = useStateSettingBoolean(
        toIsCollapsedSettingName(dirSource, colorNote),
        false,
    );
    return (
        <>
            <div
                className={
                    'app-caught-hover-pointer d-flex align-items-center' +
                    ' w-100 px-1 mt-2'
                }
                style={{ gap: '4px' }}
                onClick={() => {
                    setIsCollapsed(!isCollapsed);
                }}
            >
                <i
                    className={`bi bi-chevron-${isCollapsed ? 'right' : 'down'}`}
                    style={{ fontSize: '0.7rem', opacity: '0.5' }}
                />
                <div className="flex-fill">{genColorBar(colorNote)}</div>
                <span
                    className="badge rounded-pill p-1"
                    style={{
                        fontSize: '0.7rem',
                        fontWeight: 'normal',
                        opacity: '0.2',
                    }}
                >
                    {filePaths.length}
                </span>
            </div>
            {isCollapsed ? null : bodyHandler(filePaths, colorNote)}
        </>
    );
}

function RenderFileItemsWithColorNote({
    dirSource,
    filePaths,
    bodyHandler,
    sortFilePaths,
}: {
    dirSource: DirSource;
    filePaths: string[];
    bodyHandler: (filePaths: string[], colorNote?: string) => any;
    sortFilePaths?: (filePaths: string[]) => string[];
}) {
    const filePathColorMap = useMemo(() => {
        return genFilePathColorMap(filePaths);
    }, [filePaths]);
    const colorNotes = useMemo(() => {
        return genColorNoteDataList(filePathColorMap);
    }, [filePathColorMap]);

    if (Object.keys(filePathColorMap).length === 1) {
        let newFilePaths = filePaths;
        if (sortFilePaths !== undefined) {
            newFilePaths = sortFilePaths(newFilePaths);
        }
        return bodyHandler(newFilePaths);
    }
    return colorNotes.map((colorNote) => {
        let subFilePaths = filePathColorMap[colorNote];
        // The "unknown" group is always seeded, and any group can be emptied by
        // the name/type filter — a header with nothing under it is just noise.
        if (!subFilePaths?.length) {
            return null;
        }
        if (sortFilePaths !== undefined) {
            subFilePaths = sortFilePaths(subFilePaths);
        }
        return (
            <ColorNoteGroupComp
                key={colorNote}
                dirSource={dirSource}
                colorNote={colorNote}
                filePaths={subFilePaths}
                bodyHandler={bodyHandler}
            />
        );
    });
}

function RenderNoMatchComp() {
    return (
        <div className="px-2 py-1" style={{ opacity: '0.5' }}>
            {tran('No matching files')}
        </div>
    );
}

function RenderFailListComp({ dirSource }: Readonly<{ dirSource: DirSource }>) {
    return (
        <div className="alert alert-warning app-caught-hover-pointer">
            {tran('Fail to Get File List')}
            <div className="d-flex flex-wrap justify-content-center">
                <GotoSettingDirectoryPathComp />
                <div className="m-2">
                    <button
                        className="btn btn-sm btn-info"
                        onClick={async (e) => {
                            e.preventDefault();
                            dirSource.fireRefreshEvent();
                        }}
                    >
                        {tran('Refresh')}
                        <i className="bi bi-arrow-clockwise" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function RenderListComp({
    dirSource,
    filePaths,
    filterData,
    bodyHandler,
    setIsOnScreen,
    checkIsOnScreen,
    sortFilePaths,
    disableColorNoteGrouping,
}: Readonly<{
    dirSource: DirSource;
    filePaths: string[] | null | undefined;
    filterData: FileListFilterDataType;
    bodyHandler: (filePaths: string[], colorNote?: string) => any;
    setIsOnScreen: (isOnScreen: boolean) => void;
    checkIsOnScreen?: (filePaths: string[]) => Promise<boolean>;
    sortFilePaths?: (filePaths: string[]) => string[];
    disableColorNoteGrouping?: boolean;
}>) {
    useFileSourceIsOnScreen(
        // The on-screen indicator is about the directory, not about what the
        // user is currently looking at, so it stays on the unfiltered list.
        filePaths ?? [],
        async (filePaths) => {
            if (checkIsOnScreen === undefined) {
                return false;
            }
            return await checkIsOnScreen(filePaths);
        },
        setIsOnScreen,
    );
    const { filterText, filterTypeName, sortData } = filterData;
    const allFilePaths = filePaths ?? EMPTY_FILE_PATHS;
    const filteredFilePaths = useMemo(() => {
        if (allFilePaths.length < MIN_FILTERABLE_FILE_COUNT) {
            return allFilePaths;
        }
        return filterFilePaths(allFilePaths, filterText, filterTypeName);
    }, [allFilePaths, filterText, filterTypeName]);
    const combinedSortFilePaths = useMemo(() => {
        return genCombinedSortFilePaths(sortFilePaths, sortData);
    }, [sortFilePaths, sortData]);
    if (filePaths === undefined) {
        return <LoadingComp />;
    }
    if (filePaths === null) {
        return <RenderFailListComp dirSource={dirSource} />;
    }
    // An empty directory is not a failed filter; only say so when there were
    // files to begin with.
    if (filteredFilePaths.length === 0) {
        return filePaths.length === 0 ? null : <RenderNoMatchComp />;
    }
    if (disableColorNoteGrouping) {
        let newFilePaths = filteredFilePaths;
        if (combinedSortFilePaths !== undefined) {
            newFilePaths = combinedSortFilePaths(newFilePaths);
        }
        return bodyHandler(newFilePaths);
    }
    return (
        <RenderFileItemsWithColorNote
            dirSource={dirSource}
            filePaths={filteredFilePaths}
            bodyHandler={bodyHandler}
            sortFilePaths={combinedSortFilePaths}
        />
    );
}
