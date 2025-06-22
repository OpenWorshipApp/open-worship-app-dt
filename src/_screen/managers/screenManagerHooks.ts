import { createContext, use } from 'react';

import ScreenManager from './ScreenManager';
import ScreenManagerBase, { ScreenManagerEventType } from './ScreenManagerBase';
import {
    useScreenEvents,
    useScreenBackgroundManagerEvents,
    useScreenVaryAppDocumentManagerEvents,
    useScreenBibleManagerEvents,
    useScreenOtherManagerEvents,
} from './screenEventHelpers';

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
    useScreenOtherManagerEvents(['update'], undefined, callback);
}
