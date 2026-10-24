import { useState } from 'react';

import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
import type { ScreenBackgroundManagerEventType } from './ScreenBackgroundManager';
import ScreenBackgroundManager from './ScreenBackgroundManager';
import type { ScreenLongTextManagerEventType } from '../screenBibleHelpers';
import ScreenLongTextManager from './ScreenLongTextManager';
import type { ScreenVaryAppDocumentManagerEventType } from './ScreenVaryAppDocumentManager';
import ScreenVaryAppDocumentManager from './ScreenVaryAppDocumentManager';
import type EventHandler from '../../event/EventHandler';
import type { ScreenForegroundEventType } from './ScreenForegroundManager';
import ScreenForegroundManager from './ScreenForegroundManager';
import type { ScreenDrawEventType } from './ScreenDrawManager';
import ScreenDrawManager from './ScreenDrawManager';
import type { ScreenFocusEventType } from './ScreenFocusManager';
import ScreenFocusManager from './ScreenFocusManager';
import { type ListenerType } from '../../event/EventHandler';

export function useScreenEvents<T extends string>(
    events: T[],
    StaticHandler: EventHandler<T>,
    eventHandler?: EventHandler<T>,
    callback?: ListenerType<any>,
) {
    const [_n, setN] = useState(Date.now());

    const callbackRef = useAppCurrentRef(callback);

    useAppEffect(() => {
        const update = (data: any, time: number) => {
            setN(time);
            callbackRef.current?.(data, time);
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
    }, [JSON.stringify(events), eventHandler, StaticHandler]);
}

export function useScreenBackgroundManagerEvents(
    events: ScreenBackgroundManagerEventType[],
    screenBackgroundManager?: ScreenBackgroundManager,
    callback?: ListenerType<void>,
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
    callback?: ListenerType<void>,
) {
    useScreenEvents(
        events,
        ScreenVaryAppDocumentManager as any,
        screenVaryAppDocumentManager,
        callback,
    );
}

export function useScreenLongTextManagerEvents(
    events: ScreenLongTextManagerEventType[],
    screenFulTextManager?: ScreenLongTextManager,
    callback?: ListenerType<any>,
) {
    useScreenEvents(
        events,
        ScreenLongTextManager as any,
        screenFulTextManager,
        callback,
    );
}

export function useScreenForegroundManagerEvents(
    events: ScreenForegroundEventType[],
    screenForegroundManager?: ScreenForegroundManager,
    callback?: ListenerType<void>,
) {
    useScreenEvents(
        events,
        ScreenForegroundManager as any,
        screenForegroundManager,
        callback,
    );
}

export function useScreenDrawManagerEvents(
    events: ScreenDrawEventType[],
    screenDrawManager?: ScreenDrawManager,
    callback?: ListenerType<void>,
) {
    useScreenEvents(
        events,
        ScreenDrawManager as any,
        screenDrawManager,
        callback,
    );
}

export function useScreenFocusManagerEvents(
    events: ScreenFocusEventType[],
    screenFocusManager?: ScreenFocusManager,
    callback?: ListenerType<void>,
) {
    useScreenEvents(
        events,
        ScreenFocusManager as any,
        screenFocusManager,
        callback,
    );
}

// Lives in the leaf, so the Bible columns can register theirs without pulling
// every manager in; re-exported for the managers that always took it here.
export { registerScrollingSyncEvent } from './screenScrollSyncHelpers';
