import type { DependencyList } from 'react';
import { createContext, use, useRef, useState } from 'react';

import { useAppEffect, useAppEffectAsync, useAppCurrentRef } from './appHooks';
import DirSource from './DirSource';
import type { FileSourceEventType } from './FileSource';
import FileSource from './FileSource';
import { type MimetypeNameType } from '../server/fileHelpers';
import { checkAreArraysEqual } from '../server/comparisonHelpers';
import { notifyElementHighlight } from './domHelpers';
import { type ListenerType } from '../event/EventHandler';

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
            notifyElementHighlight(() => {
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
            return color ?? '';
        });
        const newColorNotesKey = (await Promise.all(promises)).join(',');
        // read through the ref — the listener registered in the effect below
        // captures a stale `filePaths` (usually undefined), which made this
        // guard never suppress redundant list re-renders.
        // Color notes join the comparison because setting one leaves the path
        // list identical: comparing paths alone swallowed the refresh, so the
        // item never moved into its color group until the list was reloaded.
        if (
            checkAreArraysEqual(filePathsRef.current, newFilePaths) &&
            colorNotesKeyRef.current === newColorNotesKey
        ) {
            return;
        }
        colorNotesKeyRef.current = newColorNotesKey;
        setFilePaths((oldFilePaths) => {
            if (!oldFilePaths) {
                return newFilePaths;
            }
            notifyNewFilePaths(oldFilePaths, newFilePaths ?? []);
            return newFilePaths;
        });
        filePathLoadedCtx?.onLoaded?.(newFilePaths);
    };
    const filePathsRef = useAppCurrentRef(filePaths);
    const colorNotesKeyRef = useRef<string | null>(null);
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
    const [_n, setN] = useState(Date.now());
    useAppEffect(() => {
        const update = (_data: any, time: number) => {
            setN(time);
        };
        if (filePath !== undefined) {
            const fileSource = FileSource.getInstance(filePath);
            const registeredEvent = fileSource.registerEventListener(
                events,
                update,
            );
            return () => {
                fileSource.unregisterEventListener(registeredEvent);
            };
        }
        const staticEvents = FileSource.registerFileSourceEventListener(
            events,
            update,
            filePath,
        );
        return () => {
            FileSource.unregisterEventListener(staticEvents);
        };
    }, [JSON.stringify(events), filePath]);
}

export function useFileSourceEvents<T>(
    events: FileSourceEventType[],
    callback: ListenerType<T>,
    deps?: DependencyList,
    filePath?: string,
) {
    const callbackRef = useAppCurrentRef(callback);
    useAppEffect(() => {
        const update = (data: T, time: number) => {
            callbackRef.current(data, time);
        };
        if (filePath !== undefined) {
            const fileSource = FileSource.getInstance(filePath);
            const registeredEvent = fileSource.registerEventListener(
                events,
                update,
            );
            return () => {
                fileSource.unregisterEventListener(registeredEvent);
            };
        }
        const staticEvents = FileSource.registerFileSourceEventListener(
            events,
            update,
            filePath,
        );
        return () => {
            FileSource.unregisterEventListener(staticEvents);
        };
    }, [JSON.stringify(events), filePath, ...(deps ?? [])]);
}
