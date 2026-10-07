import { useState } from 'react';

import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
import type { ScreenBackgroundManagerEventType } from './ScreenBackgroundManager';
import ScreenBackgroundManager from './ScreenBackgroundManager';
import type { ScreenBibleManagerEventType } from '../screenBibleHelpers';
import ScreenBibleManager from './ScreenBibleManager';
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
import { getScrollSyncState } from './screenScrollSyncHelpers';
import { checkIsSubPixelScrolling } from '../../scrolling/subPixelScrollHelpers';

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

export function useScreenBibleManagerEvents(
    events: ScreenBibleManagerEventType[],
    screenFulTextManager?: ScreenBibleManager,
    callback?: ListenerType<any>,
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

// How long after a wheel on a container its scroll events still count as the
// operator's: Chrome animates a wheel notch over ~200ms and a touchpad's
// momentum arrives as more wheels; the rest is headroom for a slow machine,
// whose frames -- and so whose scroll events -- run late.
const WHEEL_SCROLL_WINDOW_MS = 1000;

// How long after a sync message scrolled a container the scroll events it
// fires are still that message's, unless the operator touched the container
// since. A remote scroll is never just the one event its `scrollTo` fires: the
// bible view's header shrinks over the first 118px and reflows the table, the
// browser's scroll anchoring and clamping answer that a frame or more later,
// and a slow machine is later still.
const REMOTE_SCROLL_QUIET_MS = 1000;

export function registerScrollingSyncEvent(
    divHaftScale: HTMLElement,
    callback: (scroll: { x: number; y: number }, isFromWheel: boolean) => void,
) {
    // Once per element, the latest callback answering. The bible view is
    // handed the same div again every time its host's effect re-runs, and
    // each pass used to stack another pair of listeners.
    const state = getScrollSyncState(divHaftScale);
    const isRegistered = state.callback !== null;
    state.callback = callback;
    if (isRegistered) {
        return;
    }
    // A wheel only reaches this element from a pointer over it, so the scroll
    // it drives is the operator's. It used to be cancelled unless
    // `getIsMouseOverApp()` and `getIsWindowFocused()` agreed, and neither
    // does when it matters: the first waits for a mouse MOVE after a (re)load,
    // so a pointer already resting on a mini screen scrolled nothing, and the
    // second is false for a window the pointer only hovers (the OS wheels the
    // window under the pointer), so the mini screen was dead until clicked.
    // Passive now, which also lets the browser scroll off the main thread.
    divHaftScale.addEventListener(
        'wheel',
        () => {
            state.wheelAt = state.inputAt = performance.now();
        },
        { passive: true },
    );
    divHaftScale.addEventListener(
        'pointerdown',
        () => {
            state.inputAt = performance.now();
        },
        { passive: true },
    );
    divHaftScale.addEventListener('scroll', (event) => {
        event.preventDefault();
        const now = performance.now();
        const isFromWheel =
            state.wheelAt > state.remoteAt &&
            now - state.wheelAt < WHEEL_SCROLL_WINDOW_MS;
        // Sliding by fractions of a pixel means an auto-scroll is driving it
        // -- this window's own, or a mini preview's sent frame by frame -- and
        // its driver broadcasts the exact position itself. Its offsets,
        // rounded to a pixel, used to echo back and knock the preview it came
        // from off its slide every few frames: the preview shook. Only a
        // wheel speaks for it.
        if (checkIsSubPixelScrolling(divHaftScale) && !isFromWheel) {
            return;
        }
        // A scroll a sync message set off (`applyRemoteScrollPercentage`)
        // must not be broadcast back, or two windows -- or two grouped mini
        // screens -- echo each other's scroll forever. It used to be a stamp
        // that the first scroll event matched and CONSUMED, so a second
        // listener on the same div, or the reflow's follow-up event, found it
        // gone and sent the remote position straight back out. Now every
        // event inside the quiet window is swallowed, unless the operator
        // wheeled or pressed this container after the remote scroll landed.
        if (
            state.inputAt < state.remoteAt &&
            now - state.remoteAt < REMOTE_SCROLL_QUIET_MS
        ) {
            return;
        }
        state.callback?.(
            {
                x:
                    divHaftScale.scrollLeft /
                    (divHaftScale.scrollWidth - divHaftScale.clientWidth),
                y:
                    divHaftScale.scrollTop /
                    (divHaftScale.scrollHeight - divHaftScale.clientHeight),
            },
            isFromWheel,
        );
    });
}
