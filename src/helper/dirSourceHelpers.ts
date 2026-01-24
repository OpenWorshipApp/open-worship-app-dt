import type { DependencyList } from 'react';
import { useState } from 'react';

import { useAppEffect, useAppEffectAsync } from './debuggerHelpers';
import DirSource from './DirSource';
import type { FileSourceEventType } from './FileSource';
import FileSource from './FileSource';

export function useGenDirSource(settingName: string) {
    const [dirSource, setDirSource] = useState<DirSource | null>(null);
    useAppEffectAsync(
        async (methodContext) => {
            if (dirSource !== null) {
                const registeredEvent = dirSource.registerEventListener(
                    ['reload'],
                    () => {
                        methodContext.setDirSource(null);
                    },
                );
                return () => {
                    dirSource.unregisterEventListener(registeredEvent);
                };
            }
            const newDirSource = await DirSource.getInstance(settingName);
            methodContext.setDirSource(newDirSource);
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
            setN(n + 1);
        };
        const staticEvents = FileSource.registerFileSourceEventListener(
            events,
            update,
            filePath,
        );
        return () => {
            FileSource.unregisterEventListener(staticEvents);
        };
    }, [filePath, n]);
}

export function useFileSourceEvents<T>(
    events: FileSourceEventType[],
    callback: (data: T) => void,
    deps?: DependencyList,
    filePath?: string,
) {
    useAppEffect(() => {
        const staticEvents = FileSource.registerFileSourceEventListener(
            events,
            callback,
            filePath,
        );
        return () => {
            FileSource.unregisterEventListener(staticEvents);
        };
    }, [callback, filePath, ...(deps ?? [])]);
}
