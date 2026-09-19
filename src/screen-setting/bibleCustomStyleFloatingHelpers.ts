import { useSyncExternalStore } from 'react';

import { getSetting, setSetting } from '../helper/settingHelpers';

const SETTING_NAME = 'bible-custom-style-floating';

// A tiny shared store so every entry point (bible previewer footer, mini-screen
// footer, ...) stays in sync and only a single floating widget is ever shown,
// regardless of how many toggle buttons are mounted.
const listeners = new Set<() => void>();

export function getIsBibleCustomStyleFloatingShowing() {
    return getSetting(SETTING_NAME) === 'true';
}

export function setIsBibleCustomStyleFloatingShowing(isShowing: boolean) {
    setSetting(SETTING_NAME, `${isShowing}`);
    for (const listener of listeners) {
        listener();
    }
}

export function toggleBibleCustomStyleFloatingShowing() {
    setIsBibleCustomStyleFloatingShowing(
        !getIsBibleCustomStyleFloatingShowing(),
    );
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useBibleCustomStyleFloatingShowing() {
    return useSyncExternalStore(
        subscribe,
        getIsBibleCustomStyleFloatingShowing,
        getIsBibleCustomStyleFloatingShowing,
    );
}
