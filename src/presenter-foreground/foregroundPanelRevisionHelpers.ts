import { useState } from 'react';

import { useAppEffect } from '../helper/appHooks';

/**
 * A foreground panel told that its settings were written from OUTSIDE it.
 *
 * Every field of a panel reads its setting once, when it mounts
 * (`useStateSettingString` and its siblings watch nothing afterwards), which
 * is right while the panel is the only thing that writes them. The help
 * window's assistant writes them too now -- a quick text's words, a
 * countdown's minutes, a session's colours -- and a panel left open beside it
 * kept showing the old values and then wrote them back over the change the
 * first time a control was touched.
 *
 * A panel takes the revision into the keys it already remounts by (its body
 * is keyed by the session, its Properties by the prefix), so one notice
 * remounts exactly what reads those settings. Only MOUNTED panels listen: a
 * module Set of callbacks, emptied as panels close, and no file watch -- a
 * setting is a file, and a watcher per field is what this app cannot afford.
 */
const listenerMap = new Map<string, Set<() => void>>();

export function subscribeForegroundPanel(
    widgetKey: string,
    listener: () => void,
) {
    let listenerSet = listenerMap.get(widgetKey);
    if (listenerSet === undefined) {
        listenerSet = new Set();
        listenerMap.set(widgetKey, listenerSet);
    }
    const currentSet = listenerSet;
    currentSet.add(listener);
    return () => {
        currentSet.delete(listener);
        if (currentSet.size === 0) {
            listenerMap.delete(widgetKey);
        }
    };
}

/** Tell the open panels of a component to read their settings again. */
export function notifyForegroundPanel(widgetKey: string) {
    // Copied: a listener remounts its panel, which can edit the set mid-loop.
    for (const listener of Array.from(listenerMap.get(widgetKey) ?? [])) {
        listener();
    }
}

/** How many outside writes this panel has been told of -- part of its keys. */
export function useForegroundPanelRevision(widgetKey: string) {
    const [revision, setRevision] = useState(0);
    useAppEffect(() => {
        return subscribeForegroundPanel(widgetKey, () => {
            setRevision((old) => {
                return old + 1;
            });
        });
    }, [widgetKey]);
    return revision;
}
