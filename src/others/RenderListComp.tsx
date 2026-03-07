import { Fragment, useMemo } from 'react';

import type DirSource from '../helper/DirSource';
import FileSource from '../helper/FileSource';
import type { MimetypeNameType } from '../server/fileHelpers';
import LoadingComp from './LoadingComp';
import { GotoSettingDirectoryPathComp } from './NoDirSelectedComp';
import { useFileSourceIsOnScreen } from '../_screen/screenHelpers';
import { tran } from '../lang/langHelpers';
import { useFilePaths } from '../helper/dirSourceHelpers';

const UNKNOWN_COLOR_NOTE = 'unknown';

function RenderFileItemsWithColorNote({
    filePaths,
    bodyHandler,
}: {
    filePaths: string[];
    bodyHandler: (filePaths: string[]) => any;
}) {
    const filePathColorMap = useMemo(() => {
        const newFilePathColorMap: { [key: string]: string[] } = {
            [UNKNOWN_COLOR_NOTE]: [],
        };
        for (const filePath of filePaths) {
            const fileSource = FileSource.getInstance(filePath);
            const colorNote = fileSource.colorNote ?? UNKNOWN_COLOR_NOTE;
            newFilePathColorMap[colorNote] =
                newFilePathColorMap[colorNote] ?? [];
            newFilePathColorMap[colorNote].push(filePath);
        }
        return newFilePathColorMap;
    }, [filePaths]);
    const colorNotes = useMemo(() => {
        const newColorNotes = Object.keys(filePathColorMap)
            .filter((key) => {
                return key !== UNKNOWN_COLOR_NOTE;
            })
            .sort((a, b) => a.localeCompare(b));
        newColorNotes.push(UNKNOWN_COLOR_NOTE);
        return newColorNotes;
    }, [filePathColorMap]);

    if (Object.keys(filePathColorMap).length === 1) {
        return bodyHandler(filePaths);
    }
    return colorNotes.map((colorNote) => {
        const subFilePaths = filePathColorMap[colorNote];
        return (
            <Fragment key={colorNote}>
                <hr
                    style={
                        colorNote === UNKNOWN_COLOR_NOTE
                            ? {}
                            : {
                                  backgroundColor: colorNote,
                                  height: '1px',
                                  border: 0,
                              }
                    }
                />
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
}: Readonly<{
    dirSource: DirSource;
    mimetypeName: MimetypeNameType;
    bodyHandler: (filePaths: string[]) => any;
    setIsOnScreen: (isOnScreen: boolean) => void;
    checkIsOnScreen?: (filePaths: string[]) => Promise<boolean>;
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
        />
    );
}
