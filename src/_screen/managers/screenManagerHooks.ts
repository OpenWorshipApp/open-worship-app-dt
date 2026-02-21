import { createContext, use, useState } from 'react';

import ScreenManager from './ScreenManager';
import type { ScreenManagerEventType } from './ScreenManagerBase';
import ScreenManagerBase from './ScreenManagerBase';
import {
    useScreenEvents,
    useScreenBackgroundManagerEvents,
    useScreenVaryAppDocumentManagerEvents,
    useScreenBibleManagerEvents,
    useScreenForegroundManagerEvents,
} from './screenEventHelpers';
import { genVideoIDFromSrc } from '../screenHelpers';

export const ScreenManagerBaseContext = createContext<ScreenManagerBase | null>(
    null,
);

export function useScreenManagerBaseContext(): ScreenManagerBase {
    const screenManagerBase = use(ScreenManagerBaseContext);
    if (screenManagerBase === null) {
        throw new Error(
            'useScreenManager must be used within a ScreenManagerBase ' +
                'Context Provider',
        );
    }
    return screenManagerBase;
}

export function useScreenManagerContext(): ScreenManager {
    const screenManagerBase = useScreenManagerBaseContext();
    if (screenManagerBase instanceof ScreenManager) {
        return screenManagerBase;
    }
    throw new Error('screenManagerBase is not found.');
}

export function useScreenManagerEvents(
    events: ScreenManagerEventType[],
    screenManagerBase?: ScreenManagerBase,
    callback?: () => void,
) {
    useScreenEvents(
        events,
        ScreenManagerBase as any,
        screenManagerBase,
        callback,
    );
}

export function useScreenUpdateEvents(
    screenManagerBase?: ScreenManagerBase,
    callback?: () => void,
) {
    useScreenEvents(
        ['update'],
        ScreenManagerBase as any,
        screenManagerBase,
        callback,
    );
    useScreenBackgroundManagerEvents(['update'], undefined, callback);
    useScreenVaryAppDocumentManagerEvents(['update'], undefined, callback);
    useScreenBibleManagerEvents(['update'], undefined, callback);
    useScreenForegroundManagerEvents(['update'], undefined, callback);
}

function getVideoSources(screenManager: ScreenManager): [string, string][] {
    const backgroundSrc = screenManager.screenBackgroundManager.backgroundSrc;
    if (backgroundSrc?.type !== 'video' || !backgroundSrc.src) {
        return [];
    }
    const newVideoID = genVideoIDFromSrc(backgroundSrc.src);
    return [[backgroundSrc.src, newVideoID]] as const;
}
export function useScreenVideoSources() {
    const screenManager = useScreenManagerContext();
    const [videoSources, setVideoSources] = useState<[string, string][]>(
        getVideoSources(screenManager),
    );
    const update = () => {
        const newVideoSources = getVideoSources(screenManager);
        setVideoSources(newVideoSources);
    };
    useScreenBackgroundManagerEvents(['update'], undefined, update);
    return videoSources;
}
