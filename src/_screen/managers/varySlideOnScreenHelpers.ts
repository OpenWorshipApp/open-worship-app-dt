import { useCallback, useSyncExternalStore } from 'react';

import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import ScreenManagerBase from './ScreenManagerBase';
import { genRefCountedScreenUpdateSubscriber } from './screenUpdateSubscriberHelpers';
import ScreenVaryAppDocumentManager from './ScreenVaryAppDocumentManager';

/**
 * "Which screens is THIS slide on?", for one slide preview.
 *
 * Every slide preview used to answer that by subscribing to the manager's
 * global `update` event (`useScreenVaryAppDocumentManagerEvents(['update'])`),
 * which re-rendered EVERY preview on EVERY screen change even though at most
 * two of them change their highlight. Measured live on refactor23: one click
 * with a 89-slide document open cost 96 React commits, and with the presenting flow
 * preview open as well 205 commits / 204 `root.render()` calls into the
 * previews' shadow roots — the same for a presenting flow click and for a click on the
 * previewer's own card, because the cost was never in the click path.
 *
 * Here the managers are subscribed ONCE for the whole window and every preview
 * reads through `useSyncExternalStore`. React compares snapshots by identity
 * and bails out when they match, so a preview whose answer did not change is
 * never re-rendered — which is why `readOnScreenList` must hand back the
 * PREVIOUS array whenever the set of screen ids is unchanged.
 */
export type OnScreenListType = ReturnType<
    typeof ScreenVaryAppDocumentManager.getDataList
>;

type CacheEntryType = {
    version: number;
    comparable: string;
    value: OnScreenListType;
};

const listenersMapper = new Map<string, Set<() => void>>();
const changeListeners = new Set<() => void>();
const cacheMapper = new Map<string, CacheEntryType>();
let version = 0;

export function toVarySlideOnScreenKey(filePath: string, id: number) {
    return `${filePath}-${id}`;
}

function handleScreenUpdating() {
    version += 1;
    for (const listeners of listenersMapper.values()) {
        for (const listener of listeners) {
            listener();
        }
    }
    for (const listener of changeListeners) {
        listener();
    }
}

// `ScreenManagerBase` too, not just the document manager: the on-screen map is
// filtered against the MANAGERS setting, so adding or removing a screen changes
// the answer without the document manager ever firing.
const screenUpdateSubscriber = genRefCountedScreenUpdateSubscriber(() => {
    return [ScreenVaryAppDocumentManager, ScreenManagerBase];
}, handleScreenUpdating);

function addOnScreenListener(cacheKey: string, listener: () => void) {
    const release = screenUpdateSubscriber.acquire();
    const listeners = listenersMapper.get(cacheKey) ?? new Set<() => void>();
    listeners.add(listener);
    listenersMapper.set(cacheKey, listeners);
    return () => {
        release();
        listeners.delete(listener);
        if (listeners.size > 0) {
            return;
        }
        // Nothing is showing this slide any more, so neither the listener set
        // nor its cached answer may outlive it — the map is bounded by what is
        // mounted, never by what has ever been looked at.
        listenersMapper.delete(cacheKey);
        cacheMapper.delete(cacheKey);
    };
}

/**
 * Run `callback` on every screen change WITHOUT re-rendering the caller.
 *
 * `useScreenVaryAppDocumentManagerEvents` cannot do this: it holds a
 * `useState(Date.now())` that it always sets, so the subscribing component
 * re-renders on every screen event whatever its callback decides. On
 * `VarySlidesComp` — which subscribes only to answer "is anything here on a
 * screen?" — that re-rendered the whole slide list, handing every preview a
 * fresh `children` element and so re-rendering all 89 shadow roots underneath
 * it. A callback that sets an unchanged boolean lets React bail out instead.
 */
export function useVarySlideOnScreenChangeEffect(callback: () => void) {
    const callbackRef = useAppCurrentRef(callback);
    useAppEffect(() => {
        const listener = () => {
            callbackRef.current();
        };
        const release = screenUpdateSubscriber.acquire();
        changeListeners.add(listener);
        return () => {
            release();
            changeListeners.delete(listener);
        };
    }, []);
}

function toComparable(onScreenList: OnScreenListType) {
    return onScreenList
        .map(([key]) => {
            return key;
        })
        .join(',');
}

function readOnScreenList(cacheKey: string, filePath: string, id: number) {
    const cached = cacheMapper.get(cacheKey);
    if (cached !== undefined && cached.version === version) {
        return cached.value;
    }
    const onScreenList = ScreenVaryAppDocumentManager.getDataList(filePath, id);
    const comparable = toComparable(onScreenList);
    // Only the SCREEN IDS are compared. The payload behind a key changes on
    // every present (a new itemJson for the same slide), and re-rendering the
    // preview for that would put back exactly the cascade this replaces —
    // nothing here renders anything but the ids.
    const value =
        cached !== undefined && cached.comparable === comparable
            ? cached.value
            : onScreenList;
    cacheMapper.set(cacheKey, { version, comparable, value });
    return value;
}

export function useVarySlideOnScreenList(varySlide: VarySlideType) {
    const { filePath, id } = varySlide;
    const cacheKey = toVarySlideOnScreenKey(filePath, id);
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            return addOnScreenListener(cacheKey, onStoreChange);
        },
        [cacheKey],
    );
    const getSnapshot = useCallback(() => {
        return readOnScreenList(cacheKey, filePath, id);
    }, [cacheKey, filePath, id]);
    return useSyncExternalStore(subscribe, getSnapshot);
}

/** Test seam: drops every cached answer and subscription. */
export function releaseVarySlideOnScreenCache() {
    listenersMapper.clear();
    changeListeners.clear();
    cacheMapper.clear();
    version = 0;
    screenUpdateSubscriber.reset();
}
