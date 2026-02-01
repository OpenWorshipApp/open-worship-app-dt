import { createContext, Fragment, use, useState } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import type DirSource from '../helper/DirSource';
import FileSource from '../helper/FileSource';
import type { MimetypeNameType } from '../server/fileHelpers';
import LoadingComp from './LoadingComp';
import { GotoSettingDirectoryPathComp } from './NoDirSelectedComp';
import { useFileSourceIsOnScreen } from '../_screen/screenHelpers';
import { checkAreArraysEqual } from '../server/comparisonHelpers';
import { tran } from '../lang/langHelpers';

const UNKNOWN_COLOR_NOTE = 'unknown';

export const FilePathLoadedContext = createContext<{
    onLoaded?: (filePaths: string[] | null) => void;
} | null>(null);

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
    const filePathLoadedCtx = use(FilePathLoadedContext);
    const [filePaths, setFilePaths] = useState<string[] | null | undefined>(
        undefined,
    );
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
    const refresh = async () => {
        const newFilePaths = await dirSource.getFilePaths(mimetypeName);
        if (newFilePaths !== null) {
            const promises = newFilePaths.map(async (filePath) => {
                const fileSource = FileSource.getInstance(filePath);
                const color = await fileSource.getColorNote();
                fileSource.colorNote = color;
            });
            await Promise.all(promises);
        }
        if (checkAreArraysEqual(filePaths, newFilePaths)) {
            return;
        }
        setFilePaths(newFilePaths);
        if (filePathLoadedCtx?.onLoaded !== undefined) {
            filePathLoadedCtx.onLoaded(newFilePaths);
        }
    };
    useAppEffect(() => {
        if (filePaths === undefined) {
            refresh();
        }
    }, [filePaths?.join('|')]);
    if (filePaths === undefined) {
        return <LoadingComp />;
    }
    if (filePaths === null) {
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
                            await refresh();
                        }}
                    ></i>
                </button>
            </div>
        );
    }
    const filePathColorMap: { [key: string]: string[] } = {
        [UNKNOWN_COLOR_NOTE]: [],
    };
    for (const filePath of filePaths) {
        const fileSource = FileSource.getInstance(filePath);
        const colorNote = fileSource.colorNote ?? UNKNOWN_COLOR_NOTE;
        filePathColorMap[colorNote] = filePathColorMap[colorNote] ?? [];
        filePathColorMap[colorNote].push(filePath);
    }
    if (Object.keys(filePathColorMap).length === 1) {
        return bodyHandler(filePaths);
    }
    const colorNotes = Object.keys(filePathColorMap)
        .filter((key) => {
            return key !== UNKNOWN_COLOR_NOTE;
        })
        .sort((a, b) => a.localeCompare(b));
    colorNotes.push(UNKNOWN_COLOR_NOTE);
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
