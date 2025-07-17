import { createContext, use, useState } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import DirSource from '../helper/DirSource';
import FileSource from '../helper/FileSource';
import { MimetypeNameType } from '../server/fileHelpers';
import LoadingComp from './LoadingComp';
import { GotoSettingDirectoryPathComp } from './NoDirSelectedComp';
import { useFileSourceIsOnScreen } from '../_screen/screenHelpers';

const UNKNOWN_COLOR_NOTE = 'unknown';

export const FilePathLoadedContext = createContext<{
    onLoaded?: (filePaths: string[] | undefined) => void;
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
        null,
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
        if (newFilePaths !== undefined) {
            const promises = newFilePaths.map(async (filePath) => {
                const fileSource = FileSource.getInstance(filePath);
                const color = await fileSource.getColorNote();
                fileSource.colorNote = color;
            });
            await Promise.all(promises);
        }
        setFilePaths(newFilePaths);
        if (filePathLoadedCtx?.onLoaded !== undefined) {
            filePathLoadedCtx.onLoaded(newFilePaths);
        }
    };
    useAppEffect(() => {
        if (filePaths === null) {
            refresh();
        }
    }, [filePaths]);
    if (filePaths === undefined) {
        return (
            <div
                className="alert alert-warning app-caught-hover-pointer"
                onClick={() => {
                    dirSource.fireReloadEvent();
                }}
            >
                Fail To Get File List
                <GotoSettingDirectoryPathComp />
            </div>
        );
    }
    if (filePaths === null) {
        return <LoadingComp />;
    }
    const filePathColorMap: { [key: string]: string[] } = {
        [UNKNOWN_COLOR_NOTE]: [],
    };
    filePaths.forEach((filePath) => {
        const fileSource = FileSource.getInstance(filePath);
        const colorNote = fileSource.colorNote ?? UNKNOWN_COLOR_NOTE;
        filePathColorMap[colorNote] = filePathColorMap[colorNote] ?? [];
        filePathColorMap[colorNote].push(filePath);
    });
    if (Object.keys(filePathColorMap).length === 1) {
        return bodyHandler(filePaths);
    }
    const colorNotes = Object.keys(filePathColorMap)
        .filter((key) => {
            return key !== UNKNOWN_COLOR_NOTE;
        })
        .sort((a, b) => a.localeCompare(b));
    colorNotes.push(UNKNOWN_COLOR_NOTE);
    return (
        <>
            {colorNotes.map((colorNote) => {
                const subFilePaths = filePathColorMap[colorNote];
                return (
                    <div key={colorNote}>
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
                    </div>
                );
            })}
        </>
    );
}
