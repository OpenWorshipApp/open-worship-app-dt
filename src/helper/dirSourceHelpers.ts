import type { DependencyList } from 'react';
import { createContext, use, useRef, useState } from 'react';

import { useAppEffect, useAppEffectAsync } from './debuggerHelpers';
import DirSource from './DirSource';
import type { FileSourceEventType } from './FileSource';
import FileSource from './FileSource';
import { fsCheckDirExist, type MimetypeNameType } from '../server/fileHelpers';
import { checkAreArraysEqual } from '../server/comparisonHelpers';
import appProvider from '../server/appProvider';
import { handleError } from './errorHelpers';
import { notifyNewElementAdded } from './domHelpers';

export const DirSourceContext = createContext<DirSource | null>(null);

export const FilePathLoadedContext = createContext<{
    onLoaded?: (filePaths: string[] | null) => void;
} | null>(null);

function notifyNewFilePaths(oldFilePaths: string[], newFilePaths: string[]) {
    if (oldFilePaths.length === 0) {
        return;
    }
    const diffFilePaths = newFilePaths.filter((filePath) => {
        return !oldFilePaths.includes(filePath);
    });
    for (const filePath of diffFilePaths) {
        setTimeout(() => {
            const src = FileSource.getInstance(filePath).src;
            notifyNewElementAdded(() => {
                return document.querySelector(
                    `[data-file-item-file-src="${src}"]`,
                );
            });
        }, 0);
    }
}

export function useFilePaths(
    dirSource: DirSource,
    mimetypeNames: MimetypeNameType[],
) {
    const filePathLoadedCtx = use(FilePathLoadedContext);
    const [filePaths, setFilePaths] = useState<string[] | null | undefined>(
        undefined,
    );
    const refresh = async () => {
        const newFilePathsList = await Promise.all(
            mimetypeNames.map((mimetypeName) => {
                return dirSource.getFilePaths(mimetypeName);
            }),
        );
        let newFilePaths = newFilePathsList
            .filter((filePaths) => {
                return filePaths !== null;
            })
            .flat();
        newFilePaths = Array.from(new Set(newFilePaths));
        const promises = newFilePaths.map(async (filePath) => {
            const fileSource = FileSource.getInstance(filePath);
            const color = await fileSource.getColorNote();
            fileSource.colorNote = color;
        });
        await Promise.all(promises);
        if (checkAreArraysEqual(filePaths, newFilePaths)) {
            return;
        }
        setFilePaths((oldFilePaths) => {
            if (!oldFilePaths) {
                return newFilePaths;
            }
            notifyNewFilePaths(oldFilePaths, newFilePaths ?? []);
            return newFilePaths;
        });
        filePathLoadedCtx?.onLoaded?.(newFilePaths);
    };
    useAppEffect(() => {
        setFilePaths(undefined);
        const registeredEvent = dirSource.registerEventListener(
            ['refresh'],
            refresh,
        );
        return () => {
            dirSource.unregisterEventListener(registeredEvent);
        };
    }, [dirSource, mimetypeNames.join(',')]);
    useAppEffect(() => {
        if (filePaths !== undefined) {
            return;
        }
        refresh();
    }, [filePaths]);

    return filePaths;
}

export function useGenDirSourceReload(settingName: string) {
    const [dirSource, setDirSource] = useState<DirSource | null>(null);
    useAppEffectAsync(
        async (methodContext) => {
            if (dirSource === null) {
                const newDirSource = await DirSource.getInstance(settingName);
                methodContext.setDirSource(newDirSource);
                return;
            }
            const registeredEvent = dirSource.registerEventListener(
                ['reload'],
                () => {
                    methodContext.setDirSource(null);
                },
            );
            return () => {
                dirSource.unregisterEventListener(registeredEvent);
            };
        },
        [dirSource],
        { setDirSource },
    );
    return dirSource;
}

export function useFileSourceRefreshEvents(
    events: FileSourceEventType[],
    filePath?: string,
) {
    const [n, setN] = useState(0);
    useAppEffect(() => {
        const update = () => {
            setN((n) => {
                return n + 1;
            });
        };
        const staticEvents = FileSource.registerFileSourceEventListener(
            events,
            update,
            filePath,
        );
        return () => {
            FileSource.unregisterEventListener(staticEvents);
        };
    }, [JSON.stringify(events), filePath]);
    return n;
}

export function useFileSourceEvents<T>(
    events: FileSourceEventType[],
    callback: (data: T) => void,
    deps?: DependencyList,
    filePath?: string,
) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useAppEffect(() => {
        const staticEvents = FileSource.registerFileSourceEventListener(
            events,
            (data: T) => {
                callbackRef.current(data);
            },
            filePath,
        );
        return () => {
            FileSource.unregisterEventListener(staticEvents);
        };
    }, [JSON.stringify(events), filePath, ...(deps ?? [])]);
}

async function handleFileEvent(dirSource: DirSource, ...args: any[]) {
    if (args[0] === 'change') {
        if (typeof args[1] === 'string') {
            dirSource.alertFileChanging(args[1]);
        }
    }
    try {
        const mimetypeNames = Object.keys(
            dirSource.filePathsMap,
        ) as MimetypeNameType[];
        if (mimetypeNames.length === 0) {
            dirSource.fireRefreshEvent();
        }
        for (const mimetypeName of mimetypeNames) {
            const oldFilePaths = dirSource.filePathsMap[mimetypeName];
            const newFilePaths =
                await dirSource.getFilePathsQuick(mimetypeName);
            if (!checkAreArraysEqual(oldFilePaths, newFilePaths)) {
                dirSource.fireRefreshEvent();
            }
        }
    } catch (_error) {
        dirSource.fireRefreshEvent();
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
            handleFileEvent.bind(null, dirSource),
        );
    } catch (error) {
        handleError(error);
    }
}

export function useDirSourceWatching(dirSource: DirSource | null) {
    useAppEffect(() => {
        if (dirSource === null) {
            return;
        }
        const abortController = new AbortController();
        watchDir(dirSource, abortController.signal);
        return () => {
            abortController.abort();
        };
    }, [dirSource?.dirPath]);
}
