import { useState } from 'react';

import { useAppEffect } from '../../helper/debuggerHelpers';
import type { ScreenBackgroundManagerEventType } from './ScreenBackgroundManager';
import ScreenBackgroundManager from './ScreenBackgroundManager';
import type { ScreenBibleManagerEventType } from '../screenBibleHelpers';
import ScreenBibleManager from './ScreenBibleManager';
import type { ScreenVaryAppDocumentManagerEventType } from './ScreenVaryAppDocumentManager';
import ScreenVaryAppDocumentManager from './ScreenVaryAppDocumentManager';
import type EventHandler from '../../event/EventHandler';
import type { ScreenForegroundEventType } from './ScreenForegroundManager';
import ScreenForegroundManager from './ScreenForegroundManager';

export function useScreenEvents<T extends string>(
    events: T[],
    StaticHandler: EventHandler<T>,
    eventHandler?: EventHandler<T>,
    callback?: (data: any) => void,
) {
    const [n, setN] = useState(0);
    useAppEffect(() => {
        const update = (data: any) => {
            setN((n) => {
                return n + 1;
            });
            callback?.(data);
        };
        const registeredEvents =
            eventHandler?.registerEventListener(events, update) ||
            StaticHandler.registerEventListener(events, update);
        return () => {
            if (eventHandler === undefined) {
                StaticHandler.unregisterEventListener(registeredEvents);
            } else {
                eventHandler.unregisterEventListener(registeredEvents);
            }
        };
    }, [StaticHandler, eventHandler, callback]);
    return n;
}

export function useScreenBackgroundManagerEvents(
    events: ScreenBackgroundManagerEventType[],
    screenBackgroundManager?: ScreenBackgroundManager,
    callback?: () => void,
) {
    useScreenEvents(
        events,
        ScreenBackgroundManager as any,
        screenBackgroundManager,
        callback,
    );
}

export function useScreenVaryAppDocumentManagerEvents(
    events: ScreenVaryAppDocumentManagerEventType[],
    screenVaryAppDocumentManager?: ScreenVaryAppDocumentManager,
    callback?: () => void,
) {
    useScreenEvents(
        events,
        ScreenVaryAppDocumentManager as any,
        screenVaryAppDocumentManager,
        callback,
    );
}

export function useScreenBibleManagerEvents(
    events: ScreenBibleManagerEventType[],
    screenFulTextManager?: ScreenBibleManager,
    callback?: (args: any) => void,
) {
    useScreenEvents(
        events,
        ScreenBibleManager as any,
        screenFulTextManager,
        callback,
    );
}

export function useScreenForegroundManagerEvents(
    events: ScreenForegroundEventType[],
    screenForegroundManager?: ScreenForegroundManager,
    callback?: () => void,
) {
    useScreenEvents(
        events,
        ScreenForegroundManager as any,
        screenForegroundManager,
        callback,
    );
}
