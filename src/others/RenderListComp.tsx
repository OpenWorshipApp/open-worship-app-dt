import { Fragment, useMemo } from 'react';

import type DirSource from '../helper/DirSource';
import type { MimetypeNameType } from '../server/fileHelpers';
import LoadingComp from './LoadingComp';
import { GotoSettingDirectoryPathComp } from './NoDirSelectedComp';
import { useFileSourceIsOnScreen } from '../_screen/screenHelpers';
import { tran } from '../lang/langHelpers';
import { useFilePaths } from '../helper/dirSourceHelpers';
import {
    genColorBar,
    genColorNoteDataList,
    genFilePathColorMap,
} from '../helper/colorNoteHelpers';

function RenderFileItemsWithColorNote({
    filePaths,
    bodyHandler,
    sortFilePaths,
}: {
    filePaths: string[];
    bodyHandler: (filePaths: string[]) => any;
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
        if (sortFilePaths !== undefined) {
            subFilePaths = sortFilePaths(subFilePaths);
        }
        return (
            <Fragment key={colorNote}>
                {genColorBar(colorNote)}
                {bodyHandler(subFilePaths)}
            </Fragment>
        );
    });
}

function RenderFailListComp({ dirSource }: Readonly<{ dirSource: DirSource }>) {
    return (
        <div className="alert alert-warning app-caught-hover-pointer">
            {tran('Fail To Get File List')}
            <GotoSettingDirectoryPathComp />
            <button className="btn btn-sm">
                {tran('Refresh')}
                <i
                    className="bi bi-arrow-clockwise ms-2"
                    onClick={async (e) => {
                        e.preventDefault();
                        dirSource.fireRefreshEvent();
                    }}
                ></i>
            </button>
        </div>
    );
}

export default function RenderListComp({
    dirSource,
    mimetypeName,
    bodyHandler,
    setIsOnScreen,
    checkIsOnScreen,
    sortFilePaths,
}: Readonly<{
    dirSource: DirSource;
    mimetypeName: MimetypeNameType;
    bodyHandler: (filePaths: string[]) => any;
    setIsOnScreen: (isOnScreen: boolean) => void;
    checkIsOnScreen?: (filePaths: string[]) => Promise<boolean>;
    sortFilePaths?: (filePaths: string[]) => string[];
}>) {
    const filePaths = useFilePaths(dirSource, mimetypeName);
    useFileSourceIsOnScreen(
        filePaths ?? [],
        async (filePaths) => {
            if (checkIsOnScreen === undefined) {
                return false;
            }
            return await checkIsOnScreen(filePaths);
        },
        setIsOnScreen,
    );
    if (filePaths === undefined) {
        return <LoadingComp />;
    }
    if (filePaths === null) {
        return <RenderFailListComp dirSource={dirSource} />;
    }
    return (
        <RenderFileItemsWithColorNote
            filePaths={filePaths}
            bodyHandler={bodyHandler}
            sortFilePaths={sortFilePaths}
        />
    );
}
